export const N = 2400; // ~ trees*3 + houses*8 of our scene
export const mode = new URLSearchParams(location.search).get("mode") || "separate";
export let draws = 0;
for (const P of [WebGL2RenderingContext.prototype]) for (const k of ["drawElements","drawArrays","drawElementsInstanced","drawArraysInstanced"]) { const o=P[k]; P[k]=function(...a){draws++; return o.apply(this,a);} }
export function pos(i){ return [ (i%60)-30, 0, Math.floor(i/60)-20 ]; }
export function color(i){ return [((i*37)%255)/255, ((i*91)%255)/255, ((i*13)%255)/255]; }
export async function run(build, frame){
  const t0=performance.now(); await build(); const tBuild=performance.now()-t0; const tFirst=performance.now()-window.__t0;
  // warmup
  for(let i=0;i<20;i++){ frame(); await new Promise(r=>requestAnimationFrame(r)); }
  const times=[]; let d0=draws;
  for(let i=0;i<120;i++){ const a=performance.now(); frame(); times.push(performance.now()-a); await new Promise(r=>requestAnimationFrame(r)); }
  const dpf=(draws-d0)/120; times.sort((a,b)=>a-b);
  window.RESULT={mode, tBuild:+tBuild.toFixed(1), tStartTotal:+tFirst.toFixed(0), medianFrameCpu:+times[60].toFixed(2), p90:+times[108].toFixed(2), drawsPerFrame:dpf};
}
