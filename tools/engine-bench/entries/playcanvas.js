import { Application, Entity, StandardMaterial, Color, Vec3 } from "playcanvas";
const app=new Application(document.querySelector("canvas")); app.start();
const cam=new Entity(); cam.addComponent("camera"); cam.setPosition(0,5,-10); app.root.addChild(cam);
const l=new Entity(); l.addComponent("light"); app.root.addChild(l);
const b=new Entity(); b.addComponent("render",{type:"box"}); b.render.material=new StandardMaterial(); app.root.addChild(b);
