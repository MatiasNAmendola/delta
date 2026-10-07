import { AppBase, AppOptions, createGraphicsDevice, RenderComponentSystem, CameraComponentSystem, LightComponentSystem, Entity, StandardMaterial } from "playcanvas";
const canvas=document.querySelector("canvas");
createGraphicsDevice(canvas,{deviceTypes:["webgl2"]}).then(device=>{const o=new AppOptions(); o.graphicsDevice=device; o.componentSystems=[RenderComponentSystem,CameraComponentSystem,LightComponentSystem];
const app=new AppBase(canvas); app.init(o); app.start();
const cam=new Entity(); cam.addComponent("camera"); app.root.addChild(cam);
const l=new Entity(); l.addComponent("light"); app.root.addChild(l);
const b=new Entity(); b.addComponent("render",{type:"box"}); b.render.material=new StandardMaterial(); app.root.addChild(b);});
