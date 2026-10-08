#!/usr/bin/env python3
"""Create a separate v3-profile proposal with short smooth canopy and no raised front roof accessory.
Default verifies existing output; --write creates separate STL/3MF, never overwrites source.
"""
import argparse,hashlib,json,zipfile
from pathlib import Path
from xml.etree import ElementTree as ET
import numpy as np
import trimesh
from shapely.geometry import box, LineString
from solidify_boat import section_region
import smooth_boat_roof as smooth
import shorten_boat_awning as short
from render_boat_stl import render
ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT/'modelos/lancha-short-smooth-clean-roof-p1s.3mf'
OUTPUT=ROOT/'modelos/lancha-closed-windscreen-final-p1s.3mf'
STL=OUTPUT.with_suffix('.stl')
def main():
 global OUTPUT,STL
 ap=argparse.ArgumentParser(description=__doc__);ap.add_argument('--write',action='store_true');ap.add_argument('--preview',action='store_true');ap.add_argument('--fenders',action='store_true');a=ap.parse_args()
 if a.fenders:OUTPUT=OUTPUT.with_name('lancha-closed-windscreen-supported-fenders-p1s.3mf');STL=OUTPUT.with_suffix('.stl')
 before=hashlib.sha256(SOURCE.read_bytes()).hexdigest()
 with zipfile.ZipFile(SOURCE) as zi:
  xml=ET.fromstring(zi.read('3D/Objects/object_10.model'))
  vv=np.array([[float(e.get(k)) for k in ('x','y','z')] for e in xml.findall('.//{*}vertex')]);ff=np.array([[int(e.get(k)) for k in ('v1','v2','v3')] for e in xml.findall('.//{*}triangle')])
  vv+=np.array([.0056772232055664,.0014190673828125,11.903163]);reference=trimesh.Trimesh(vv,ff,process=False)
 # Recessed windscreen backing follows original pillar rake, closing air channels.
 xs=np.linspace(-9,9,37);zs=[13.2,19.8];vv=[]
 for z in zs:
  for x in xs:vv.append([x,max(-29.9,-38.3+.386*z+.45+.02*x*x) if z>19.4 else -38.3+.386*z+.45+.02*x*x,z])
  for x in xs:vv.append([x,-24,z])
 n=len(xs);faces=[]
 for i in range(n-1):
  for start,flip in [(0,False),(n,True)]:
   a0=start+i;b0=start+i+1;c0=start+i+2*n;d0=c0+1
   faces.extend([[a0,b0,d0],[a0,d0,c0]] if not flip else [[a0,d0,b0],[a0,c0,d0]])
  faces.extend([[i,n+i,n+i+1],[i,n+i+1,i+1],[2*n+i,2*n+i+1,3*n+i+1],[2*n+i,3*n+i+1,3*n+i]])
 for i in [0,n-1]:faces.extend([[i,i+2*n,i+3*n],[i,i+3*n,i+n]])
 backing=trimesh.Trimesh(vv,faces);backing.fix_normals()
 patch=reference.vertices[(abs(reference.vertices[:,0])<1.8)&(reference.vertices[:,1]>-32.4)&(reference.vertices[:,1]<-28)&(reference.vertices[:,2]>18.4)&(reference.vertices[:,2]<20.4)]
 additions=[backing,trimesh.convex.convex_hull(patch)]
 # Narrow under-fender webs grow from existing lower hull toward rounded defenses.
 for side in ([-1,1] if a.fenders else []):
  for y,width,reach in [(-20.6,3.2,15.45),(-5.5,3.2,16.15),(14.2,2.8,14.85)]:
   pts=[]
   for yy in [y-width/2,y+width/2]:
    pts.extend([[side*7.5,yy,2.0],[side*10.0,yy,7.8],[side*reach,yy,7.8]])
   additions.append(trimesh.convex.convex_hull(np.asarray(pts)))
 clean=trimesh.boolean.union([reference,*additions],engine='manifold')
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
 if a.preview:render(STL,ROOT/('docs/lancha-closed-windscreen-fenders-front.png' if a.fenders else 'docs/lancha-closed-windscreen-front.png'),view_vector=(.5,-.8,.35),focus=(0,-31,13),scale=33)
 with zipfile.ZipFile(SOURCE) as old,zipfile.ZipFile(OUTPUT) as new:unchanged=old.read('Metadata/project_settings.config')==new.read('Metadata/project_settings.config')
 sections=[]
 for z in [14,16,18]:
  line=LineString([(-3,-35),(-3,-24)])
  old=section_region(reference,z).intersection(line);new=section_region(clean,z).intersection(line)
  sections.append({'x_mm':-3,'z_mm':z,'before':old.wkt,'after':new.wkt,'gap_closed':new.geom_type=='LineString'})
 assert all(s['gap_closed'] for s in sections)
 assert hashlib.sha256(SOURCE.read_bytes()).hexdigest()==before
 print(json.dumps({'source_sha256':before,'source_unchanged':True,'windscreen_sections':sections,'settings_byte_identical':unchanged,'output':OUTPUT.name,'stl':STL.name,'watertight':bool(clean.is_watertight),'winding_consistent':bool(clean.is_winding_consistent),'components':len(clean.split()),'bounds_mm':clean.bounds.tolist(),'added_backing_and_web_volume_mm3':clean.volume-reference.volume,'proposal':'Recessed sloped windscreen backing joins pillars; optional lower fender webs only with --fenders. Original source unchanged.'},indent=2))
if __name__=='__main__':main()
