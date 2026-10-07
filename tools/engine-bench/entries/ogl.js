import { Renderer, Camera, Transform, Box, Program, Mesh } from "ogl";
const r=new Renderer({canvas:document.querySelector("canvas")}); const gl=r.gl; const cam=new Camera(gl); const s=new Transform();
const p=new Program(gl,{vertex:`attribute vec3 position;uniform mat4 modelViewMatrix;uniform mat4 projectionMatrix;void main(){gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragment:`precision highp float;void main(){gl_FragColor=vec4(1.);}`});
new Mesh(gl,{geometry:new Box(gl),program:p}).setParent(s); requestAnimationFrame(function f(){r.render({scene:s,camera:cam});requestAnimationFrame(f);});
