import { WebGLEngine, Camera, MeshRenderer, PrimitiveMesh, BlinnPhongMaterial, DirectLight } from "@galacean/engine";
WebGLEngine.create({canvas:document.querySelector("canvas")}).then(engine=>{const root=engine.sceneManager.activeScene.createRootEntity();
const c=root.createChild("c"); c.addComponent(Camera); c.transform.setPosition(0,5,-10);
root.createChild("l").addComponent(DirectLight);
const b=root.createChild("b"); const r=b.addComponent(MeshRenderer); r.mesh=PrimitiveMesh.createCuboid(engine); r.setMaterial(new BlinnPhongMaterial(engine)); engine.run();});
