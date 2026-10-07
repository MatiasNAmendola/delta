import * as twgl from "twgl.js";
const gl=document.querySelector("canvas").getContext("webgl2"); const pi=twgl.createProgramInfo(gl,["attribute vec4 position;void main(){gl_Position=position;}","precision mediump float;void main(){gl_FragColor=vec4(1);}"]);
const bi=twgl.primitives.createCubeBufferInfo(gl,1); requestAnimationFrame(function f(){gl.useProgram(pi.program);twgl.setBuffersAndAttributes(gl,pi,bi);twgl.drawBufferInfo(gl,bi);requestAnimationFrame(f);});
