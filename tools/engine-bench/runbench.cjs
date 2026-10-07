const { chromium } = require('/opt/node-tools/node_modules/playwright');
(async()=>{
  const b = await chromium.launch({ args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--disable-gpu-vsync','--disable-frame-rate-limit'] });
  const engines = process.argv[2].split(','); const modes = process.argv[3].split(',');
  for (const e of engines) for (const m of modes) {
    const res=[];
    for (let rep=0; rep<3; rep++){
      const p = await b.newPage(); let err=null; p.on('pageerror', x=>err=x.message);
      await p.goto(`http://127.0.0.1:8765/${e}.html?mode=${m}`);
      try { await p.waitForFunction(()=>window.RESULT, null, {timeout:120000}); res.push(await p.evaluate(()=>window.RESULT)); } catch(x){ res.push({err: err||x.message}); }
      await p.close();
    }
    const ok=res.filter(r=>!r.err); const med=k=>{const v=ok.map(r=>r[k]).sort((a,b)=>a-b); return v[Math.floor(v.length/2)];};
    console.log(JSON.stringify({engine:e, mode:m, build_ms:med('tBuild'), startup_ms:med('tStartTotal'), frameCpu_ms:med('medianFrameCpu'), p90:med('p90'), draws:med('drawsPerFrame'), errs:res.filter(r=>r.err).map(r=>r.err).slice(0,1)}));
  }
  await b.close();
})();
