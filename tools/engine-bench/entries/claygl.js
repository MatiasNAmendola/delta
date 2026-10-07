import { application } from "claygl";
application.create(document.querySelector("canvas"),{init(app){this._camera=app.createCamera([0,2,5],[0,0,0]);app.createCube();app.createDirectionalLight([-1,-1,-1]);}});
