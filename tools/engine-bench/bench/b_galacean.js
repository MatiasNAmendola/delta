import { N, mode, pos, color, run } from "./common.js";
import { WebGLEngine, Camera, MeshRenderer, PrimitiveMesh, BlinnPhongMaterial, DirectLight, Color } from "@galacean/engine";
let engine;
run(async()=>{ engine=await WebGLEngine.create({canvas:document.querySelector("canvas")}); const root=engine.sceneManager.activeScene.createRootEntity();
 const c=root.createChild("c"); c.addComponent(Camera); c.transform.setPosition(0,40,-60); c.transform.lookAt(new (c.transform.position.constructor)(0,0,0));
 root.createChild("l").addComponent(DirectLight); const mesh=PrimitiveMesh.createCuboid(engine); const shared=new BlinnPhongMaterial(engine);
 // Galacean auto-batches/instances renderers sharing mesh+material ("instanced" == shared material path)
 for(let i=0;i<N;i++){ const b=root.createChild("b"+i); b.transform.setPosition(...pos(i)); const r=b.addComponent(MeshRenderer); r.mesh=mesh;
   if(mode==="separate"){ const m=new BlinnPhongMaterial(engine); m.baseColor=new Color(...color(i),1); r.setMaterial(m);} else r.setMaterial(shared); }
 engine.update();
}, ()=>engine.update());
