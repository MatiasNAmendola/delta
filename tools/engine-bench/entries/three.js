import { WebGLRenderer, Scene, PerspectiveCamera, BoxGeometry, MeshLambertMaterial, InstancedMesh, HemisphereLight, Matrix4 } from "three";
const r=new WebGLRenderer({canvas:document.querySelector("canvas")}); const s=new Scene(); const c=new PerspectiveCamera();
s.add(new HemisphereLight()); const m=new InstancedMesh(new BoxGeometry(),new MeshLambertMaterial(),2); m.setMatrixAt(0,new Matrix4()); s.add(m);
r.setAnimationLoop(()=>r.render(s,c));
