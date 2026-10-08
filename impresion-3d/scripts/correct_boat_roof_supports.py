#!/usr/bin/env python3
"""Create a separate v3-profile proposal with short smooth canopy and no raised front roof accessory.
Default verifies existing output; --write creates separate STL/3MF, never overwrites source.
"""
import argparse,hashlib,json,zipfile
from pathlib import Path
from xml.etree import ElementTree as ET
import numpy as np
import trimesh
from shapely.geometry import box
import smooth_boat_roof as smooth
import shorten_boat_awning as short
from render_boat_stl import render
ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT/'modelos/lancha-optimized-reinforced-v3-p1s.3mf'
OUTPUT=ROOT/'modelos/lancha-short-smooth-clean-roof-p1s.3mf'
STL=OUTPUT.with_suffix('.stl')
def main():
 ap=argparse.ArgumentParser(description=__doc__);ap.add_argument('--write',action='store_true');ap.add_argument('--preview',action='store_true');a=ap.parse_args()
 before=hashlib.sha256(SOURCE.read_bytes()).hexdigest()
 reference=trimesh.load_mesh(short.OUTPUT)
 cutters=[smooth.panel(box(-14,-31,14,-29.25),40,front=True),smooth.panel(box(-14,-29.25,14,-25),40)]
 clean=trimesh.boolean.difference([reference,*cutters],engine='manifold')
 clean=max(clean.split(only_watertight=False),key=lambda p:p.volume)
 if not clean.is_volume or len(clean.split())!=1:raise RuntimeError('Expected single oriented closed solid')
 if a.write:
  clean.export(STL)
  ns='http://schemas.microsoft.com/3dmanufacturing/core/2015/02'
  ET.register_namespace('',ns)
  ET.register_namespace('p','http://schemas.microsoft.com/3dmanufacturing/production/2015/06')
  with zipfile.ZipFile(SOURCE) as zi,zipfile.ZipFile(OUTPUT,'w',zipfile.ZIP_DEFLATED) as zo:
   for entry in zi.infolist():
    if entry.filename.startswith('Metadata/') and (entry.filename.endswith('.png') or entry.filename=='Metadata/plate_1.json'):continue
    data=zi.read(entry.filename)
    if entry.filename=='3D/Objects/object_10.model':
     root=ET.fromstring(data);mesh=root.find('.//{*}mesh');mesh.clear();vertices=ET.SubElement(mesh,f'{{{ns}}}vertices');triangles=ET.SubElement(mesh,f'{{{ns}}}triangles')
     # Original 3MF component is centered in Z and XY; build restores these offsets.
     vv=clean.vertices-np.array([.0056772232055664,.0014190673828125,11.903163])
     for x,y,z in vv:ET.SubElement(vertices,f'{{{ns}}}vertex',x=str(x),y=str(y),z=str(z))
     for x,y,z in clean.faces:ET.SubElement(triangles,f'{{{ns}}}triangle',v1=str(x),v2=str(y),v3=str(z))
     data=ET.tostring(root,encoding='utf-8',xml_declaration=True)
    elif entry.filename=='Metadata/model_settings.config':
     root=ET.fromstring(data)
     for meta in root.findall('.//metadata'):
      if meta.get('key') in ('name','source_file') and meta.get('value','').endswith('.stl'):meta.set('value',STL.name)
      if 'face_count' in meta.attrib:meta.set('face_count',str(len(clean.faces)))
     for stat in root.findall('.//mesh_stat'):stat.set('face_count',str(len(clean.faces)))
     data=ET.tostring(root,encoding='utf-8',xml_declaration=True)
    # Cached thumbnails remain explicitly stale until opening/slicing refreshes them.
    zo.writestr(entry,data)
 if a.preview:render(STL,ROOT/'docs/lancha-clean-roof-front.png',view_vector=(.5,-.8,.35),focus=(0,-31,13),scale=33)
 with zipfile.ZipFile(SOURCE) as old,zipfile.ZipFile(OUTPUT) as new:unchanged=old.read('Metadata/project_settings.config')==new.read('Metadata/project_settings.config')
 assert hashlib.sha256(SOURCE.read_bytes()).hexdigest()==before
 print(json.dumps({'source_sha256':before,'source_unchanged':True,'settings_byte_identical':unchanged,'output':OUTPUT.name,'stl':STL.name,'watertight':bool(clean.is_watertight),'winding_consistent':bool(clean.is_winding_consistent),'components':len(clean.split()),'bounds_mm':clean.bounds.tolist(),'removed_accessory_volume_mm3':reference.volume-clean.volume,'proposal':'Short smooth canopy from prior separate variant; raised front accessory shaved to roof surface. Hull and recessed cabin preserved. Cached thumbnails refreshed by subsequent slicing.'},indent=2))
if __name__=='__main__':main()
