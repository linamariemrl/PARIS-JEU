// Parcours reproductible de Paris (R04-2a), hors CI.
//   node scripts/browser/paris_route_benchmark.mjs <dist> <étiquette> [port]
// Parcours : Hôtel de Ville -> Notre-Dame -> Opéra Garnier -> Tour Eiffel ->
// Arc de Triomphe -> Sacré-Coeur, avec à chaque étape : arrivée (vol +
// chargement), orbite ~360°, dézoom complet, retour proche et mode Rue.
//
// Mesures par segment : intervalles d'image p50/p95/p99/max, tâches
// longues du fil principal (> 50 ms, PerformanceObserver), draw calls et
// triangles par image, « trous » (image dont les draw calls tombent sous
// 40 % de la médiane du segment), tas JS, tampons GPU alloués.
//
// LIMITES : Chromium headless avec WebGL logiciel (SwiftShader). Les temps
// d'image mesurent surtout le rendu logiciel et NE SONT PAS des FPS
// Android ; les tâches longues JS, les draw calls, triangles, trous et
// mémoire sont, eux, comparables entre deux versions dans ce banc.
import {createServer} from 'node:http';
import {readFile,writeFile} from 'node:fs/promises';
import {extname,join,resolve} from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {chromium}=require('playwright');
const dist=resolve(process.argv[2]??'dist'),label=process.argv[3]??'run',port=+(process.argv[4]??5301);
const types={'.js':'text/javascript','.html':'text/html','.json':'application/json',
 '.css':'text/css','.png':'image/png','.webmanifest':'application/manifest+json'};
const server=createServer(async(q,res)=>{
 let p=decodeURIComponent(q.url.split('?')[0]);if(p.endsWith('/'))p+='index.html';
 try{const b=await readFile(join(dist,p));
  res.writeHead(200,{'content-type':types[extname(p)]??'application/octet-stream'});res.end(b);}
 catch{res.writeHead(404);res.end();}
}).listen(port);

const instrument=()=>{
 const st={draws:0,tris:0,frames:[],long:[],buf:0,sizes:new WeakMap()};window.__b=st;
 for(const C of [WebGL2RenderingContext,WebGLRenderingContext]){
  const P=C.prototype;
  const de=P.drawElements;P.drawElements=function(m,c){st.draws++;st.tris+=c/3;return de.apply(this,arguments);};
  const di=P.drawElementsInstanced;if(di)P.drawElementsInstanced=function(m,c,t,o,n){st.draws++;st.tris+=c/3*n;return di.apply(this,arguments);};
  const da=P.drawArrays;P.drawArrays=function(m,f,c){st.draws++;st.tris+=c/3;return da.apply(this,arguments);};
  const bb=P.bindBuffer;P.bindBuffer=function(t,b){this.__b=this.__b||{};this.__b[t]=b;return bb.apply(this,arguments);};
  const bd=P.bufferData;P.bufferData=function(t,d){const b=this.__b&&this.__b[t];const n=typeof d==='number'?d:(d?d.byteLength:0);
   if(b){st.buf+=n-(st.sizes.get(b)||0);st.sizes.set(b,n);}return bd.apply(this,arguments);};
  const db=P.deleteBuffer;P.deleteBuffer=function(b){if(b){st.buf-=st.sizes.get(b)||0;st.sizes.delete(b);}return db.apply(this,arguments);};
 }
 const raf=window.requestAnimationFrame.bind(window);
 window.requestAnimationFrame=cb=>raf(t=>{if(st.draws)st.frames.push([performance.now(),st.draws,st.tris]);
  st.draws=0;st.tris=0;cb(t);});
 try{new PerformanceObserver(l=>{for(const e of l.getEntries())st.long.push([e.startTime,e.duration]);})
  .observe({type:'longtask',buffered:true});}catch{}
};

const q=(a,p)=>{if(!a.length)return null;const s=[...a].sort((x,y)=>x-y);
 return Math.round(s[Math.min(s.length-1,Math.floor(p*(s.length-1)))]);};
async function segment(page,name,action){
 const t0=await page.evaluate(()=>performance.now());
 await action();
 return page.evaluate(([name,t0])=>{
  const st=window.__b,f=st.frames.filter(x=>x[0]>=t0),l=st.long.filter(x=>x[0]>=t0);
  const dt=f.slice(1).map((x,i)=>x[0]-f[i][0]);
  const draws=f.map(x=>x[1]),tris=f.map(x=>x[2]);
  const med=[...draws].sort((a,b)=>a-b)[Math.floor(draws.length/2)]||0;
  return {name,frames:f.length,dt,draws,tris,med,
   holes:draws.filter(d=>d<.4*med).length,
   longCount:l.length,longTotal:Math.round(l.reduce((a,x)=>a+x[1],0)),
   longMax:Math.round(Math.max(0,...l.map(x=>x[1]))),
   heapMB:performance.memory?Math.round(performance.memory.usedJSHeapSize/1048576):null,
   gpuBufMB:+(st.buf/1048576).toFixed(1)};
 },[name,t0]);
}
const summarise=s=>({name:s.name,frames:s.frames,
 frameMs:{p50:q(s.dt,.5),p95:q(s.dt,.95),p99:q(s.dt,.99),max:q(s.dt,1)},
 longTasks:{count:s.longCount,totalMs:s.longTotal,maxMs:s.longMax},
 draws:{median:s.med,min:Math.min(...s.draws)},trianglesMedian:q(s.tris,.5),
 holes:s.holes,heapMB:s.heapMB,gpuBufMB:s.gpuBufMB});

const browser=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader',
 '--enable-unsafe-swiftshader','--enable-precise-memory-info']});
const ctx=await browser.newContext({viewport:{width:412,height:860}});
await ctx.addInitScript(instrument);
const page=await ctx.newPage();
const errors=[];page.on('pageerror',e=>errors.push(String(e)));
await page.goto(`http://localhost:${port}/`);
await page.waitForFunction(()=>/volumes rendus/.test(document.body.innerText),null,{timeout:120000});
const results=[];
results.push(summarise(await segment(page,'démarrage',()=>page.waitForTimeout(15000))));
const box=await (await page.$('canvas')).boundingBox();
const cx=box.x+box.width/2,cy=box.y+box.height/2;
const go=async name=>{
 await page.click('#landmark-open');await page.fill('#landmark-search',name);
 await page.waitForTimeout(600);
 await page.click(`button[aria-label="Voir ${name} dans Paris"]`);
 await page.click('#landmark-close').catch(()=>{});
};
const orbit=async()=>{
 await page.click('#orbit-view');
 for(let k=0;k<12;k++){
  await page.mouse.move(cx-150,cy);await page.mouse.down();
  for(let s=1;s<=10;s++)await page.mouse.move(cx-150+s*30,cy);
  await page.mouse.up();await page.waitForTimeout(250);
 }
 await page.click('#orbit-view');
};
const press=async(id,n)=>{for(let i=0;i<n;i++){await page.click(id);await page.waitForTimeout(350);}};
for(const name of ['Hôtel de ville','Cathédrale Notre-Dame','Théâtre national de l\'Opéra, dit opéra Garnier',
  'Tour Eiffel','Arc de Triomphe de l\'Etoile','Basilique du Sacré-Coeur, ses annexes et le square Louise-Michel']){
 const short=name.split(',')[0];
 results.push(summarise(await segment(page,short+' : arrivée',async()=>{await go(name);await page.waitForTimeout(12000);})));
 results.push(summarise(await segment(page,short+' : orbite 360°',orbit)));
 results.push(summarise(await segment(page,short+' : dézoom complet',async()=>{await press('#minus',14);await page.waitForTimeout(4000);})));
 results.push(summarise(await segment(page,short+' : retour proche',async()=>{await press('#plus',14);await page.waitForTimeout(8000);})));
}
results.push(summarise(await segment(page,'mode Rue',async()=>{
 await page.click('#street-view');await page.waitForTimeout(6000);
 await page.click('#street-view');await page.waitForTimeout(4000);})));
await page.screenshot({path:`/tmp/claude-0/perf/route-${label}.png`});
await browser.close();server.close();
const out={label,date:new Date().toISOString(),renderer:'Chromium headless, WebGL SwiftShader (logiciel)',
 viewport:'412x860',errors:errors.slice(0,5),segments:results};
await writeFile(`/tmp/claude-0/perf/route-${label}.json`,JSON.stringify(out,null,1));
const tot=results.reduce((a,s)=>({long:a.long+s.longTasks.totalMs,holes:a.holes+s.holes,max:Math.max(a.max,s.longTasks.maxMs)}),{long:0,holes:0,max:0});
console.log(label,'tâches longues',tot.long,'ms, pire',tot.max,'ms, trous',tot.holes,'erreurs',errors.length);
