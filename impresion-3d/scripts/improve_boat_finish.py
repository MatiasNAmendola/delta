#!/usr/bin/env python3
"""Create/verify a finishing-profile copy; preserve all geometry and source settings.
Default read-only verification. --write creates project; --slice exports sliced copy.
Exit 0 validated, 1 validation findings, 2 execution error. Never sends a print.
"""
import argparse,hashlib,json,re,subprocess,sys,tempfile,zipfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT/'modelos/lancha-rounded-fenders-p1s.3mf'
OUTPUT=ROOT/'modelos/lancha-rounded-fenders-fine-finish-p1s.3mf'
SLICED=OUTPUT.with_name(OUTPUT.stem+'-sliced.3mf')
CHANGES={'outer_wall_speed':'70','outer_wall_acceleration':'2000','support_interface_top_layers':'3','support_interface_spacing':'0.25'}
def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def main():
 ap=argparse.ArgumentParser(description=__doc__);ap.add_argument('--write',action='store_true');ap.add_argument('--slice',action='store_true');ap.add_argument('--bambu',default='/Applications/BambuStudio.app/Contents/MacOS/BambuStudio');a=ap.parse_args();before=sha(SOURCE)
 with zipfile.ZipFile(SOURCE) as z:old=json.loads(z.read('Metadata/project_settings.config'))
 updated=dict(old)
 for k,v in CHANGES.items():updated[k]=[v,*old[k][1:]] if isinstance(old[k],list) else v
 groups=list(old.get('different_settings_to_system',['','','']))
 groups[0]=';'.join(sorted(set(groups[0].split(';'))|set(CHANGES)))
 updated['different_settings_to_system']=groups
 if a.write:
  with zipfile.ZipFile(SOURCE) as zi,zipfile.ZipFile(OUTPUT,'w',zipfile.ZIP_DEFLATED) as zo:
   for info in zi.infolist():zo.writestr(info,json.dumps(updated,indent=2,sort_keys=True).encode() if info.filename=='Metadata/project_settings.config' else zi.read(info.filename))
 if a.slice:
  with tempfile.TemporaryDirectory(prefix='boat-finish-state-') as state:
   command=[a.bambu,'--datadir',state,'--debug','2','--orient','0','--arrange','0','--slice','0','--export-3mf',str(SLICED),'--mstpp','90',str(OUTPUT)]
   run=subprocess.run(command,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,timeout=120)
   if run.returncode:raise RuntimeError(run.stdout[-4000:])
 findings=[]
 with zipfile.ZipFile(SOURCE) as zi,zipfile.ZipFile(OUTPUT) as zo:
  cfg=json.loads(zo.read('Metadata/project_settings.config'))
  changed=sorted(k for k in old.keys()|cfg.keys() if old.get(k)!=cfg.get(k))
  identical=all(zi.read(n)==zo.read(n) for n in zi.namelist() if n!='Metadata/project_settings.config')
  # Native GUI saves may rewrite metadata; byte equality is informational.
  for key,value in CHANGES.items():
   actual=cfg.get(key);actual=actual[0] if isinstance(actual,list) else actual
   if actual!=value:findings.append('Unexpected active profile value '+key)
  declared=set(cfg.get('different_settings_to_system',[''])[0].split(';'))
  if not set(CHANGES).issubset(declared):findings.append('Missing GUI override declarations')
 with zipfile.ZipFile(SLICED) as z:g=z.read('Metadata/plate_1.gcode').decode()
 effective={}
 for k,v in {**CHANGES,'support_top_z_distance':str(old['support_top_z_distance'])}.items():
  match=re.search(r'^; '+re.escape(k)+r' = (.*)$',g,re.M);effective[k]=match.group(1) if match else None
  if effective[k]!=v:findings.append('Unexpected effective setting '+k)
 if sha(SOURCE)!=before:findings.append('Source changed')
 print(json.dumps({'status':'PASS' if not findings else 'FAIL','findings':findings,'source_sha256':before,'source_unchanged':sha(SOURCE)==before,'geometry_and_other_contents_byte_identical':identical,'changed_keys':changed,'changes':{k:{'before':old[k],'after':cfg[k]} for k in changed},'effective_gcode_settings':effective,'output':OUTPUT.name,'sliced':SLICED.name,'sliced_sha256':sha(SLICED),'gcode_header':g.split('; HEADER_BLOCK_END')[0].splitlines()[1:]},indent=2))
 return int(bool(findings))
if __name__=='__main__':
 try:sys.exit(main())
 except Exception as e:print(str(e),file=sys.stderr);sys.exit(2)
