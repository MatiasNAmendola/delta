import { N, mode, pos, color, run } from "./common.js";
import { Engine } from "bjs7/Engines/engine";
import { Scene } from "bjs7/scene";
import { FreeCamera } from "bjs7/Cameras/freeCamera";
import { HemisphericLight } from "bjs7/Lights/hemisphericLight";
import { CreateBox } from "bjs7/Meshes/Builders/boxBuilder";
import { StandardMaterial } from "bjs7/Materials/standardMaterial";
import { Vector3, Matrix } from "bjs7/Maths/math.vector";
import { Color3 } from "bjs7/Maths/math.color";
import "bjs7/Meshes/thinInstanceMesh";
let e,s;
run(async()=>{ const c=document.querySelector("canvas"); e=new Engine(c,false); s=new Scene(e);
 const cam=new FreeCamera("c",new Vector3(0,40,-60),s); cam.setTarget(Vector3.Zero()); new HemisphericLight("l",new Vector3(0,1,0),s);
 if(mode==="instanced"){ const b=CreateBox("b",{},s); const m=new StandardMaterial("m",s); b.material=m; const buf=new Float32Array(N*16);
   for(let i=0;i<N;i++){ const p=pos(i); Matrix.Translation(p[0],p[1],p[2]).copyToArray(buf,i*16);} b.thinInstanceSetBuffer("matrix",buf,16,true);
   const cb=new Float32Array(N*4); for(let i=0;i<N;i++){const k=color(i); cb.set([k[0],k[1],k[2],1],i*4);} b.thinInstanceSetBuffer("color",cb,4,true); b.freezeWorldMatrix(); }
 else { const shared=new StandardMaterial("sh",s); for(let i=0;i<N;i++){ const b=CreateBox("b"+i,{},s); const p=pos(i); b.position.set(p[0],p[1],p[2]);
   if(mode==="separate"){ const m=new StandardMaterial("m"+i,s); m.diffuseColor=new Color3(...color(i)); b.material=m; } else { b.material=shared; b.freezeWorldMatrix(); } }
   if(mode==="shared_frozen"){ shared.freeze(); s.freezeActiveMeshes(); } }
 s.render();
}, ()=>s.render());
