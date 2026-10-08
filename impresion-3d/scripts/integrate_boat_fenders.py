#!/usr/bin/env python3
"""Integrate fender relief into local hull wall, preserving windscreen and roof.
--write creates a separate 3MF, --preview renders proposed geometry. No profile edits.
"""
import argparse,hashlib,json,zipfile
from pathlib import Path
from xml.etree import ElementTree as ET
import numpy as np
import trimesh
from shapely.geometry import LineString
from solidify_boat import section_region
from render_boat_stl import render
ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT/'modelos/lancha-closed-windscreen-final-p1s.3mf'
OUTPUT=ROOT/'modelos/lancha-integrated-fenders-p1s.3mf'
OFFSET=np.array([.0056772232055664,.0014190673828125,11.903163])
def main():
 ap=argparse.ArgumentParser(description=__doc__);ap.add_argument('--write',action='store_true');ap.add_argument('--preview',action='store_true');a=ap.parse_args()
 before=hashlib.sha256(SOURCE.read_bytes()).hexdigest()
 with zipfile.ZipFile(SOURCE) as z:r=ET.fromstring(z.read('3D/Objects/object_10.model'))
 vertices=np.array([[float(e.get(k)) for k in ('x','y','z')] for e in r.findall('.//{*}vertex')])+OFFSET
 faces=np.array([[int(e.get(k)) for k in ('v1','v2','v3')] for e in r.findall('.//{*}triangle')])
 source=trimesh.Trimesh(vertices.copy(),faces,process=False);levels=np.arange(5.,14.,.5);regions=[section_region(source,z) for z in levels]
 for center in [-20.6,-5.5,14.2,38.]:
  selected=np.flatnonzero((abs(vertices[:,1]-center)<4.3)&(vertices[:,2]>5)&(vertices[:,2]<13))
  for side in [-1,1]:
   ids=selected[vertices[selected,0]*side>0];v=vertices[ids]
   if not len(ids):continue
   edges=[]
   for y in [center-4.5,center+4.5]:
    edge=[]
    for region in regions:
     cut=region.intersection(LineString([(-20,y),(20,y)]));edge.append(cut.bounds[2] if side==1 else -cut.bounds[0])
    edges.append(np.interp(v[:,2],levels,edge))
   t=np.clip((v[:,1]-center+4.5)/9,0,1);wall=(1-t)*edges[0]+t*edges[1]
   # Positive monotonic compression beyond estimated hull wall retains raised ring.
   taper=np.clip((4.3-abs(v[:,1]-center))/.8,0,1)*np.clip((13-v[:,2])/1,0,1)
   relief=np.maximum(abs(v[:,0])-wall,0)
   vertices[ids,0]=side*(abs(v[:,0])-relief*.85*taper)
 result=trimesh.Trimesh(vertices,faces,process=False)
 assert result.is_volume and result.is_winding_consistent
 changed=np.linalg.norm(result.vertices-source.vertices,axis=1)>1e-8
 assert not np.any(changed & (source.vertices[:,2]>=13))
 if a.write:
  ns='http://schemas.microsoft.com/3dmanufacturing/core/2015/02';ET.register_namespace('',ns);ET.register_namespace('p','http://schemas.microsoft.com/3dmanufacturing/production/2015/06')
  for e,xyz in zip(r.findall('.//{*}vertex'),vertices-OFFSET):
   for key,value in zip('xyz',xyz):e.set(key,str(value))
  with zipfile.ZipFile(SOURCE) as zi,zipfile.ZipFile(OUTPUT,'w',zipfile.ZIP_DEFLATED) as zo:
   for entry in zi.infolist():
    if entry.filename.startswith('Metadata/') and (entry.filename.endswith('.png') or entry.filename=='Metadata/plate_1.json'):continue
    data=zi.read(entry.filename)
    if entry.filename=='3D/Objects/object_10.model':data=ET.tostring(r,encoding='utf-8',xml_declaration=True)
    if entry.filename=='Metadata/model_settings.config':
     rr=ET.fromstring(data)
     for e in rr.findall('.//metadata'):
      if e.get('key') in ('name','source_file') and e.get('value','').endswith('.stl'):e.set('value',OUTPUT.with_suffix('.stl').name)
     data=ET.tostring(rr,encoding='utf-8',xml_declaration=True)
    zo.writestr(entry,data)
 if a.preview:
  import tempfile
  with tempfile.TemporaryDirectory() as tmp:
   path=Path(tmp)/'preview.stl';result.export(path)
   render(path,ROOT/'docs/lancha-integrated-fenders-front.png',view_vector=(.5,-.8,.35),focus=(0,-20,10),scale=22)
   render(path,ROOT/'docs/lancha-integrated-fenders-side.png',view_vector=(1,-.12,.25),focus=(0,0,10),scale=12)
 assert hashlib.sha256(SOURCE.read_bytes()).hexdigest()==before
 with zipfile.ZipFile(SOURCE) as old,zipfile.ZipFile(OUTPUT) as new:identical=old.read('Metadata/project_settings.config')==new.read('Metadata/project_settings.config')
 print(json.dumps({'source_sha256':before,'source_unchanged':True,'settings_identical':identical,'changed_vertex_count':int(changed.sum()),'changed_bounds_mm':[source.vertices[changed].min(0).tolist(),source.vertices[changed].max(0).tolist()],'all_geometry_above_13mm_unchanged':True,'watertight_by_indices':bool(result.is_watertight),'volume_mm3':result.volume,'previous_volume_mm3':source.volume,'output':OUTPUT.name},indent=2))
if __name__=='__main__':main()
