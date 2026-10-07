import { WebGPURenderer, Scene, PerspectiveCamera, BoxGeometry, MeshLambertNodeMaterial, InstancedMesh, HemisphereLight, Matrix4 } from "three/webgpu";
const r=new WebGPURenderer({canvas:document.querySelector("canvas")}); const s=new Scene(); const c=new PerspectiveCamera();
s.add(new HemisphereLight()); const m=new InstancedMesh(new BoxGeometry(),new MeshLambertNodeMaterial(),2); m.setMatrixAt(0,new Matrix4()); s.add(m);
r.setAnimationLoop(()=>r.render(s,c));
