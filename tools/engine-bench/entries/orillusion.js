import { Engine3D, Scene3D, Object3D, Camera3D, MeshRenderer, BoxGeometry, LitMaterial, View3D, DirectLight } from "@orillusion/core";
(async()=>{await Engine3D.init({canvasConfig:{canvas:document.querySelector("canvas")}}); const s=new Scene3D();
const co=new Object3D(); const cam=co.addComponent(Camera3D); s.addChild(co);
const lo=new Object3D(); lo.addComponent(DirectLight); s.addChild(lo);
const b=new Object3D(); const r=b.addComponent(MeshRenderer); r.geometry=new BoxGeometry(); r.material=new LitMaterial(); s.addChild(b);
const v=new View3D(); v.scene=s; v.camera=cam; Engine3D.startRenderView(v);})();
