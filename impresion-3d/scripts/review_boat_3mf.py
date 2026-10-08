#!/usr/bin/env python3
"""Read-only project/G-code evidence. --slice uses isolated temporary Bambu state.
Exit 0: no findings; 1: supports/stale preview found; 2: execution error.
"""
import argparse, collections, hashlib, json, math, pathlib, re, subprocess, sys, tempfile, zipfile
from xml.etree import ElementTree as ET
ROOT = pathlib.Path(__file__).resolve().parents[1]
KEYS = 'printer_model printer_settings_id print_settings_id filament_settings_id filament_type layer_height enable_support support_type support_threshold_angle support_on_build_plate_only support_critical_regions_only support_remove_small_overhang support_style support_object_xy_distance support_top_z_distance support_bottom_z_distance sparse_infill_density bridge_no_support'.split()
def digest(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def inspect(source, sliced):
    result = {'source': source.name, 'source_sha256': digest(source)}
    with zipfile.ZipFile(source) as z:
        cfg=json.loads(z.read('Metadata/project_settings.config'))
        result['saved_settings']={k:cfg.get(k) for k in KEYS}
        model=ET.fromstring(z.read('3D/3dmodel.model'))
        result['build_items']=[dict(e.attrib) for e in model.findall('{*}build/{*}item')]
        settings=ET.fromstring(z.read('Metadata/model_settings.config'))
        result['actual_object_names']=[m.get('value') for m in settings.findall('object/metadata') if m.get('key')=='name']
        cached=json.loads(z.read('Metadata/plate_1.json')) if 'Metadata/plate_1.json' in z.namelist() else {}
        result['cached_preview_names']=[o['name'] for o in cached.get('bbox_objects',[])]
        result['stale_preview']=result['cached_preview_names']!=result['actual_object_names']
    if sliced:
        with zipfile.ZipFile(sliced) as z: gcode=z.read('Metadata/plate_1.gcode').decode()
        result['gcode_header']=gcode.split('; HEADER_BLOCK_END')[0].splitlines()[1:]
        result['emitted_settings']={k:re.search(r'^; '+re.escape(k)+r' = (.*)$',gcode,re.M).group(1) for k in KEYS if re.search(r'^; '+re.escape(k)+r' = (.*)$',gcode,re.M)}
        roles=collections.defaultdict(float); bands=collections.defaultdict(float)
        pos={'X':0.,'Y':0.,'Z':0.,'E':0.}; relative=False; role='Custom'
        for line in gcode.splitlines():
            if line.startswith('; FEATURE: '): role=line[11:].strip()
            line=line.split(';')[0].strip()
            if not line: continue
            command=line.split()[0]
            args={k:float(v) for k,v in re.findall(r'([XYZEFIJK])([-+]?\d*\.?\d+)',line)}
            if command=='M83': relative=True
            if command=='M82': relative=False
            if command=='G92': pos.update({k:v for k,v in args.items() if k in pos})
            if command not in ('G0','G1','G2','G3'): continue
            e=args.get('E',0 if relative else pos['E']); delta=e if relative else e-pos['E']
            moving=any(k in args and args[k]!=pos[k] for k in ('X','Y')) or (command in ('G2','G3') and any(k in args for k in ('I','J')))
            pos.update({k:v for k,v in args.items() if k in pos})
            if delta>0 and moving:
                roles[role]+=delta
                if role=='Support interface': bands['below_6mm' if pos['Z']<6 else '6_to_14mm' if pos['Z']<14 else '14_to_19mm' if pos['Z']<19 else '19mm_and_above']+=delta
        support=roles['Support']+roles['Support interface']; deposited=sum(v for k,v in roles.items() if k!='Custom')
        density=float(re.search(r'; filament_density: ([\d.]+)',gcode).group(1)); diameter=float(re.search(r'; filament_diameter: ([\d.]+)',gcode).group(1))
        result['extruded_filament_mm_by_feature']={k:round(v,5) for k,v in sorted(roles.items())}
        result['support_estimated_g']=round(support*math.pi*(diameter/2)**2*density/1000,4)
        result['support_percent_deposited_filament']=round(100*support/deposited,3)
        result['interface_filament_mm_by_height']={k:round(v,5) for k,v in sorted(bands.items())}
        result['method']='Positive extrusion during XY moves/arcs; excludes E-only unretraction and negative wipe. Interface height bands are not unique contact attribution. No support-only time inferred.'
    return result

def main():
    ap=argparse.ArgumentParser(description=__doc__); ap.add_argument('--source',type=pathlib.Path,default=ROOT/'modelos/lancha-optimized-reinforced-v3-p1s.3mf'); ap.add_argument('--sliced',type=pathlib.Path); ap.add_argument('--slice',action='store_true'); ap.add_argument('--bambu',default='/Applications/BambuStudio.app/Contents/MacOS/BambuStudio'); a=ap.parse_args()
    before=digest(a.source)
    with tempfile.TemporaryDirectory(prefix='boat-3mf-review-') as tmp:
        sliced=a.sliced
        if a.slice:
            sliced=pathlib.Path(tmp)/'sliced.3mf'
            cmd=[a.bambu,'--datadir',str(pathlib.Path(tmp)/'state'),'--debug','2','--orient','0','--arrange','0','--slice','0','--export-3mf',str(sliced),'--mstpp','90',str(a.source.resolve())]
            run=subprocess.run(cmd,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,timeout=120)
            if run.returncode: raise RuntimeError(run.stdout[-5000:])
        result=inspect(a.source,sliced)
        if digest(a.source)!=before: raise RuntimeError('Source changed during review')
        result['source_unchanged']=True
        print(json.dumps(result,indent=2,sort_keys=True))
        return 1 if result['stale_preview'] or result.get('support_estimated_g',0)>0 else 0
if __name__=='__main__':
    try: sys.exit(main())
    except Exception as e: print(str(e),file=sys.stderr); sys.exit(2)
