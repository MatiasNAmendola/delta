#!/usr/bin/env python3
"""Read-only comparison of sliced support centerlines with actual 3MF solid sections.
Usage: python check_boat_support_intersections.py --sliced sliced.3mf
Exit 0 no support penetration >0.1mm; 1 findings; 2 error.
"""
import argparse, json, zipfile, re, hashlib
from collections import defaultdict
from pathlib import Path
from xml.etree import ElementTree as ET
import numpy as np
import trimesh
from shapely.geometry import LineString
from shapely.ops import unary_union
from solidify_boat import section_region
ROOT=Path(__file__).resolve().parents[1]
def main():
 ap=argparse.ArgumentParser(description=__doc__);ap.add_argument('--source',type=Path,default=ROOT/'modelos/lancha-optimized-reinforced-v3-p1s.3mf');ap.add_argument('--sliced',type=Path,required=True);ap.add_argument('--preview',type=Path);a=ap.parse_args()
 with zipfile.ZipFile(a.source) as z:
  xml=ET.fromstring(z.read('3D/Objects/object_10.model'));v=np.array([[float(e.get(k)) for k in ('x','y','z')] for e in xml.findall('.//{*}vertex')]);f=np.array([[int(e.get(k)) for k in ('v1','v2','v3')] for e in xml.findall('.//{*}triangle')]);v+=[128,128,11.903163]
 m=trimesh.Trimesh(v,f,process=True)
 with zipfile.ZipFile(a.sliced) as z:g=z.read('Metadata/plate_1.gcode').decode()
 lines=defaultdict(list);role='Custom';pos=np.zeros(3);e=0;relative=False;maxz=defaultdict(float)
 for line in g.splitlines():
  if line.startswith('; FEATURE: '):role=line[11:].strip()
  line=line.split(';')[0].strip()
  if not line:continue
  cmd=line.split()[0];args={k:float(val) for k,val in re.findall(r'([XYZEFIJK])([-+]?\d*\.?\d+)',line)}
  if cmd=='M83':relative=True
  if cmd=='M82':relative=False
  if cmd=='G92' and 'E' in args:e=args['E']
  if cmd not in ('G0','G1','G2','G3'):continue
  new=np.array([args.get(k,pos[i]) for i,k in enumerate('XYZ')]);ev=args.get('E',0 if relative else e);delta=ev if relative else ev-e;e=ev
  if delta>0 and np.linalg.norm(new[:2]-pos[:2])>1e-8:
   maxz[role]=max(maxz[role],new[2])
   if role.startswith('Support'):
    points=[pos[:2],new[:2]]
    if cmd in ('G2','G3'):
     center=pos[:2]+[args.get('I',0),args.get('J',0)];r=np.linalg.norm(pos[:2]-center)
     t0=np.arctan2(*(pos[:2]-center)[::-1]);t1=np.arctan2(*(new[:2]-center)[::-1]);span=(t1-t0)%(2*np.pi) if cmd=='G3' else -((t0-t1)%(2*np.pi))
     ts=np.linspace(t0,t0+span,max(3,int(abs(span)*r/.05)+1));points=center+np.column_stack([np.cos(ts),np.sin(ts)])*r
    lines[round(new[2],5)].append((role,LineString(points)))
  pos=new
 checks=[];deep=[];support_bounds=[]
 for height,paths in sorted(lines.items()):
  # Centerline must not enter solid even 0.1mm beyond surface. Test midlayer
  # and top plane; intended external support contact is excluded by erosion.
  solid=unary_union([section_region(m,height-0.06),section_region(m,height-0.001)])
  region=solid.buffer(-0.1)
  deep_length=sum(seg.intersection(solid.buffer(-0.8)).length for _,seg in paths)
  if deep_length>1e-5:deep.append({'z_mm':height,'intruding_centerline_mm':round(deep_length,5)})
  if height>=20:support_bounds.append({'z_mm':height,'xy_bounds':unary_union([seg for _,seg in paths]).bounds})
  intrusions=[(role,seg.intersection(region).length) for role,seg in paths]
  length=sum(n for _,n in intrusions)
  if length>1e-5:checks.append({'z_mm':height,'intruding_centerline_mm':round(length,5)})
 if a.preview:
  import matplotlib;matplotlib.use('Agg')
  import matplotlib.pyplot as plt
  fig,axes=plt.subplots(1,3,figsize=(12,7))
  for ax,height in zip(axes,[5.0,17.0,22.64]):
   region=section_region(m,height-.06)
   for poly in ([region] if region.geom_type=='Polygon' else region.geoms):
    if poly.is_empty:continue
    xy=np.array(poly.exterior.coords);ax.fill(xy[:,0],xy[:,1],color='lightgray')
    for hole in poly.interiors:
     xy=np.array(hole.coords);ax.fill(xy[:,0],xy[:,1],color='white')
   for role,seg in lines.get(height,[]):
    xy=np.array(seg.coords);ax.plot(xy[:,0],xy[:,1],color='red',linewidth=.5)
   ax.set_title(f'z={height} mm');ax.set_aspect('equal');ax.set_xlim(105,151);ax.set_ylim(72,184)
  fig.suptitle('Gray: actual solid section; red: support centerlines');fig.tight_layout();fig.savefig(a.preview,dpi=140);plt.close(fig)
 parts=m.split();report={'source_sha256':hashlib.sha256(a.source.read_bytes()).hexdigest(),'watertight':bool(m.is_watertight),'winding_consistent':bool(m.is_winding_consistent),'shell_count':len(parts),'shell_volumes_mm3':[float(p.volume) for p in parts],'duplicate_faces':int(len(f)-len(np.unique(np.sort(f,axis=1),axis=0))),'mesh_bounds_mm':m.bounds.tolist(),'maximum_extrusion_z_by_role':dict(maxz),'support_layers_tested':len(lines),'support_penetrations_over_0_1mm':checks,'support_penetrations_over_0_8mm':deep,'support_above_20mm':support_bounds,'method':'Support centerlines intersect union of solid sections at layer top-.001 and midlayer (.06mm), eroded .1mm; no self-intersection certification.'}
 print(json.dumps(report,indent=2));return int(bool(checks))
if __name__=='__main__':
 try:raise SystemExit(main())
 except Exception as e:print(str(e));raise SystemExit(2)
