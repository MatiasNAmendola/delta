import { N, mode, pos, color, run } from "./common.js";
import { WebGLRenderer, Scene, PerspectiveCamera, BoxGeometry, MeshLambertMaterial, InstancedMesh, Mesh, HemisphereLight, Matrix4, Color } from "three";
let r,s,c;
run(async()=>{ r=new WebGLRenderer({canvas:document.querySelector("canvas"),antialias:false}); s=new Scene(); c=new PerspectiveCamera(60,1,0.1,500); c.position.set(0,40,-60); c.lookAt(0,0,0); s.add(new HemisphereLight());
 const g=new BoxGeometry();
 if(mode==="instanced"){ const im=new InstancedMesh(g,new MeshLambertMaterial(),N); const m=new Matrix4(); for(let i=0;i<N;i++){const p=pos(i); m.makeTranslation(p[0],p[1],p[2]); im.setMatrixAt(i,m); im.setColorAt(i,new Color(...color(i)));} s.add(im); }
 else { const shared=new MeshLambertMaterial(); for(let i=0;i<N;i++){ const mat= mode==="separate"? new MeshLambertMaterial({color:new Color(...color(i))}) : shared; const me=new Mesh(g,mat); const p=pos(i); me.position.set(...p);
   if(mode!=="separate"){ me.matrixAutoUpdate=false; me.updateMatrix(); } s.add(me);} }
 r.render(s,c);
}, ()=>r.render(s,c));
