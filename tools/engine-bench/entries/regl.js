import createREGL from "regl";
const regl=createREGL({canvas:document.querySelector("canvas")}); const d=regl({vert:"attribute vec3 p;void main(){gl_Position=vec4(p,1);}",frag:"precision mediump float;void main(){gl_FragColor=vec4(1);}",attributes:{p:[[0,0,0],[1,0,0],[0,1,0]]},count:3});
regl.frame(()=>d());
