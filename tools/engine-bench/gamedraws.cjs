const { chromium } = require('/opt/node-tools/node_modules/playwright');
(async()=>{
  const b = await chromium.launch({ args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
  const p = await b.newPage({viewport:{width:400,height:800}, isMobile:true, hasTouch:true, userAgent:'Mozilla/5.0 (Linux; Android 12) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36'});
  await p.addInitScript(()=>{ window.__d=0; window.__prog=0; window.__tex=0; const P=WebGL2RenderingContext.prototype;
    for(const k of ["drawElements","drawArrays","drawElementsInstanced","drawArraysInstanced"]){const o=P[k];P[k]=function(...a){window.__d++;return o.apply(this,a);}}
    const u=P.useProgram; P.useProgram=function(x){window.__prog++; return u.call(this,x);}; window.__t0=performance.now(); });
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto('http://127.0.0.1:8767/delta/'); await p.waitForFunction(()=>!document.getElementById('loadingScreen'),null,{timeout:150000}); const tl=await p.evaluate(()=>performance.now()); console.log("load_ms",tl);
  // try to click start buttons
  try{await p.click('#playBtn',{timeout:3000});}catch{}
  await p.waitForTimeout(8000);
  const r = await p.evaluate(async()=>{ const d0=__d, p0=__prog; const t0=performance.now(); let f=0; while(performance.now()-t0<5000){ await new Promise(r=>requestAnimationFrame(r)); f++; }
    const s=(window.BABYLON_SCENE||null); return {frames:f, drawsPerFrame:(__d-d0)/f, useProgramPerFrame:(__prog-p0)/f, fpsSwiftshader:f/5}; });
  console.log(JSON.stringify(r), errs.slice(0,3));
  await p.screenshot({path:'game.png'});
  await b.close();
})();
