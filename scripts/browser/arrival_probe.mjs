// Diagnostic ciblé d'une arrivée (R05-3, hors CI) : après un vol vers un
// monument, captures et état de la sonde ?bench à intervalles fixes, pour
// distinguer un VRAI vide d'affichage d'une simple chute de draw calls.
//   node scripts/browser/arrival_probe.mjs <dist> <étiquette> <port> "<monument>" [départ]
import {createServer} from 'node:http';
import {readFile,writeFile} from 'node:fs/promises';
import {extname,join,resolve} from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {chromium}=require('playwright');
const [,,distArg,label,portArg,target,start]=process.argv;
const dist=resolve(distArg),port=+portArg;
const types={'.js':'text/javascript','.html':'text/html','.json':'application/json','.css':'text/css','.png':'image/png'};
const server=createServer(async(q,res)=>{
 let p=decodeURIComponent(q.url.split('?')[0]);if(p.endsWith('/'))p+='index.html';
 try{const b=await readFile(join(dist,p));res.writeHead(200,{'content-type':types[extname(p)]??'application/octet-stream'});res.end(b);}
 catch{res.writeHead(404);res.end();}
}).listen(port);
const browser=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const ctx=await browser.newContext({viewport:{width:412,height:860}});
await ctx.addInitScript(()=>{const st={d:0,last:0};window.__d=st;
 for(const C of [WebGL2RenderingContext,WebGLRenderingContext]){const P=C.prototype,de=P.drawElements;
  P.drawElements=function(){st.d++;return de.apply(this,arguments);};}
 const raf=window.requestAnimationFrame.bind(window);
 window.requestAnimationFrame=cb=>raf(t=>{if(st.d)st.last=st.d;st.d=0;cb(t);});});
const page=await ctx.newPage();
await page.goto(`http://localhost:${port}/?bench`);
await page.waitForFunction(()=>/volumes rendus/.test(document.body.innerText),null,{timeout:120000});
await page.waitForTimeout(20000);
const go=async name=>{await page.click('#landmark-open');await page.fill('#landmark-search',name);
 await page.waitForTimeout(600);await page.click(`button[aria-label="Voir ${name} dans Paris"]`);};
if(start){await go(start);await page.waitForTimeout(15000);}
const t0=Date.now();await go(target);
const rows=[];
for(const s of [2,5,10,20,40,60]){
 await page.waitForTimeout(Math.max(0,s*1000-(Date.now()-t0)));
 const p=await page.evaluate(()=>({...window.__parisProbe(),draws:window.__d.last}));
 rows.push({t:s,...p});
 await page.screenshot({path:`/tmp/claude-0/perf/arrivee-${label}-${s}s.png`});
}
await browser.close();server.close();
await writeFile(`/tmp/claude-0/perf/arrivee-${label}.json`,JSON.stringify(rows,null,1));
for(const r of rows)console.log(label,r.t+'s','draws',r.draws,'R',Math.round(r.radius),'exactes',r.metroExactTiles,
 'en vol',r.metroInFlight,'groupes',r.overviewGroups,'toits',r.overviewRoofsOnly,'|',r.status);
