// Parcours reproductible de Paris (R04-2a), hors CI.
//   node scripts/browser/paris_route_benchmark.mjs <dist> <étiquette> [port]
// Parcours : Hôtel de Ville -> Notre-Dame -> Opéra Garnier -> Tour Eiffel ->
// Arc de Triomphe -> Sacré-Coeur, avec à chaque étape : arrivée (vol +
// chargement), orbite ~360°, dézoom complet, retour proche et mode Rue.
//
// Mesures par segment : intervalles d'image p50/p95/p99/max, tâches
// longues du fil principal (> 50 ms, PerformanceObserver), draw calls et
// triangles par image, chutes de draw calls (image sous 40 % de la médiane
// du segment : INDICATEUR heuristique d'activité GPU, PAS un décompte de
// trous visibles), tas JS, tampons GPU alloués par les appels instrumentés
// (estimation, pas la VRAM). État vérifiable via la sonde `?bench`
// (src/benchProbe.ts) : angle et rayon réels, tuiles exactes actives,
// requêtes en vol, groupes LOD, statut, sélection.
//
// LIMITES : Chromium headless avec WebGL logiciel (SwiftShader). Les temps
// d'image mesurent surtout le rendu logiciel et NE SONT PAS des FPS
// Android ; les tâches longues JS, les draw calls, triangles, trous et
// mémoire sont, eux, comparables entre deux versions dans ce banc.
import {createServer} from 'node:http';
import {readFile,writeFile,appendFile} from 'node:fs/promises';
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
const out=`/tmp/claude-0/perf/route-${label}`;
const progress=m=>{const line=new Date().toISOString()+' '+m;console.log(line);return appendFile(out+'.progress.log',line+'\n');};
/** Chaque étape est bornée : un blocage est signalé, jamais attendu indéfiniment. */
const STEP_MS=180000;
const bounded=(name,p)=>Promise.race([p,new Promise((_,rej)=>setTimeout(()=>
 rej(Error('étape bloquée plus de '+STEP_MS/1000+' s : '+name)),STEP_MS))]);
const probe=page=>page.evaluate(()=>window.__parisProbe?window.__parisProbe():null);
async function segment(page,name,action){
 await progress('début '+name);
 const before=await probe(page);
 const t0=await page.evaluate(()=>performance.now());
 const extra=await bounded(name,action())??{};
 const after=await probe(page);
 return {...(await page.evaluate(([name,t0])=>{
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
 },[name,t0])),before,after,extra};
}
const summarise=s=>({name:s.name,frames:s.frames,
 frameMs:{p50:q(s.dt,.5),p95:q(s.dt,.95),p99:q(s.dt,.99),max:q(s.dt,1)},
 longTasks:{count:s.longCount,totalMs:s.longTotal,maxMs:s.longMax},
 draws:{median:s.med,min:Math.min(...s.draws)},trianglesMedian:q(s.tris,.5),
 drawDrops:s.holes,heapMB:s.heapMB,gpuBufMB:s.gpuBufMB,
 state:{before:s.before,after:s.after},...s.extra});

const browser=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader',
 '--enable-unsafe-swiftshader','--enable-precise-memory-info']});
const ctx=await browser.newContext({viewport:{width:412,height:860}});
await ctx.addInitScript(instrument);
const page=await ctx.newPage();
const errors=[];page.on('pageerror',e=>errors.push(String(e)));
await page.goto(`http://localhost:${port}/?bench`);
await page.waitForFunction(()=>/volumes rendus/.test(document.body.innerText),null,{timeout:120000});
const results=[];
await writeFile(out+'.jsonl','');await writeFile(out+'.progress.log','');
const record=async seg=>{const r=summarise(seg);results.push(r);
 await appendFile(out+'.jsonl',JSON.stringify(r)+'\n');await progress('fin '+r.name+' ('+results.length+'/26)');};
/** Attendre un état stable (aucune tuile exacte en vol, nombre stable)
 * borné à `limit` ms ; renvoie le temps mis et si l'état s'est stabilisé. */
const settle=async(limit)=>{
 const t0=Date.now();let last=null,stable=0;
 while(Date.now()-t0<limit){
  await page.waitForTimeout(1000);
  const p=await probe(page);
  const key=p&&p.metroInFlight===0?p.metroExactTiles+':'+p.overviewGroups:null;
  if(key!==null&&key===last){if(++stable>=3)return {settleMs:Date.now()-t0,settled:true};}else stable=0;
  last=key;
 }
 return {settleMs:Date.now()-t0,settled:false};
};
let stopped=null;
try{
await record(await segment(page,'démarrage',()=>settle(90000)));
const box=await (await page.$('canvas')).boundingBox();
const cx=box.x+box.width/2,cy=box.y+box.height/2;
const go=async name=>{
 await page.click('#landmark-open');await page.fill('#landmark-search',name);
 await page.waitForTimeout(600);
 await page.click(`button[aria-label="Voir ${name} dans Paris"]`);
 // Le panneau se ferme lui-même au clic sur « Voir » : vérifier, ne pas masquer.
 const open=await page.isVisible('#landmark-panel');
 const title=await page.textContent('#selection-title');
 if(open||!title||!title.includes(name.split(',')[0].slice(0,12))){
  await page.screenshot({path:`${out}-echec-${name.slice(0,12)}.png`});
  throw Error('arrivée non conforme : panneau '+(open?'ouvert':'fermé')+', sélection « '+title+' »');
 }
 return {selection:title};
};
/** Glisser jusqu'à un tour complet MESURÉ (alpha cumulé), 40 glissés max. */
const orbit=async()=>{
 await page.click('#orbit-view');
 let swept=0,prev=(await probe(page))?.alpha??0,drags=0;
 while(Math.abs(swept)<2*Math.PI&&drags<40){
  await page.mouse.move(cx-150,cy);await page.mouse.down();
  for(let s=1;s<=10;s++)await page.mouse.move(cx-150+s*30,cy);
  await page.mouse.up();await page.waitForTimeout(250);drags++;
  const a=(await probe(page))?.alpha??prev;swept+=a-prev;prev=a;
 }
 await page.click('#orbit-view');
 return {orbitDegrees:Math.round(Math.abs(swept)*180/Math.PI),drags};
};
const press=async(id,n)=>{for(let i=0;i<n;i++){await page.click(id);await page.waitForTimeout(350);}
 return {radiusReached:Math.round((await probe(page))?.radius??-1)};};
for(const name of ['Hôtel de ville','Cathédrale Notre-Dame','Théâtre national de l\'Opéra, dit opéra Garnier',
  'Tour Eiffel','Arc de Triomphe de l\'Etoile','Basilique du Sacré-Coeur, ses annexes et le square Louise-Michel']){
 const short=name.split(',')[0];
 await record(await segment(page,short+' : arrivée',async()=>({...await go(name),...await settle(60000)})));
 await record(await segment(page,short+' : orbite 360°',orbit));
 await record(await segment(page,short+' : dézoom complet',async()=>({...await press('#minus',14),...await settle(30000)})));
 await record(await segment(page,short+' : retour proche',async()=>({...await press('#plus',14),...await settle(60000)})));
}
await record(await segment(page,'mode Rue',async()=>{
 await page.click('#street-view');await page.waitForTimeout(6000);
 await page.click('#street-view');await page.waitForTimeout(4000);}));
}catch(e){stopped=String(e.message||e);await progress('ARRÊT : '+stopped);}
await page.screenshot({path:`/tmp/claude-0/perf/route-${label}.png`}).catch(()=>{});
await browser.close();server.close();
const summary={label,date:new Date().toISOString(),renderer:'Chromium headless, WebGL SwiftShader (logiciel)',
 viewport:'412x860',errors:errors.slice(0,5),stopped,complete:!stopped&&results.length===26,segments:results};
await writeFile(out+'.json',JSON.stringify(summary,null,1));
await progress('terminé : '+results.length+'/26 segments'+(summary.complete?'':' (INCOMPLET)'));
const tot=results.reduce((a,s)=>({long:a.long+s.longTasks.totalMs,drops:a.drops+s.drawDrops,max:Math.max(a.max,s.longTasks.maxMs)}),{long:0,drops:0,max:0});
console.log(label,'tâches longues',tot.long,'ms, pire',tot.max,'ms, chutes de draw calls (heuristique)',tot.drops,'erreurs',errors.length);
