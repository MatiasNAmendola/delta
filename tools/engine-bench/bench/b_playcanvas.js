import { N, mode, pos, color, run } from "./common.js";
import { Application, Entity, StandardMaterial, Color, Vec3, Mat4, VertexBuffer, VertexFormat, createBox, Mesh, MeshInstance, BUFFER_STATIC } from "playcanvas";
let app;
run(async()=>{ app=new Application(document.querySelector("canvas"),{graphicsDeviceOptions:{antialias:false,deviceTypes:["webgl2"]}}); app.autoRender=false;
 const cam=new Entity(); cam.addComponent("camera"); cam.setPosition(0,40,-60); cam.lookAt(0,0,0); app.root.addChild(cam);
 const l=new Entity(); l.addComponent("light",{type:"directional"}); l.setEulerAngles(45,30,0); app.root.addChild(l);
 if(mode==="instanced"){ const mat=new StandardMaterial(); mat.update(); const e=new Entity(); e.addComponent("render",{type:"box",material:mat}); app.root.addChild(e);
   const mi=e.render.meshInstances[0]; const data=new Float32Array(N*16); const m=new Mat4(); for(let i=0;i<N;i++){const p=pos(i); m.setTranslate(p[0],p[1],p[2]); data.set(m.data,i*16);}
   const vb=new VertexBuffer(app.graphicsDevice, VertexFormat.getDefaultInstancingFormat(app.graphicsDevice), N, {data}); mi.setInstancing(vb); }
 else { const shared=new StandardMaterial(); shared.update(); for(let i=0;i<N;i++){ let mat=shared; if(mode==="separate"){ mat=new StandardMaterial(); mat.diffuse=new Color(...color(i)); mat.update(); }
   const e=new Entity(); e.addComponent("render",{type:"box",material:mat}); e.setPosition(...pos(i)); app.root.addChild(e);} }
 app.start(); app.render();
}, ()=>{ app.update(1/60); app.render(); });
