import { luma } from "@luma.gl/core"; import { webgl2Adapter } from "@luma.gl/webgl"; import { Model, CubeGeometry, AnimationLoop } from "@luma.gl/engine";
luma.createDevice({adapters:[webgl2Adapter],createCanvasContext:{canvas:document.querySelector("canvas")}}).then(device=>{const m=new Model(device,{vs:`#version 300 es
in vec3 positions;void main(){gl_Position=vec4(positions,1.);}`,fs:`#version 300 es
precision highp float;out vec4 c;void main(){c=vec4(1);}`,geometry:new CubeGeometry()});
requestAnimationFrame(function f(){const rp=device.beginRenderPass({clearColor:[0,0,0,1]});m.draw(rp);rp.end();device.submit();requestAnimationFrame(f);});});
