// Recette navigateur du flux RÉEL de src/main.ts (WebGL, Chromium).
// Hors CI : nécessite Playwright et un `dist` construit.
//   node scripts/browser/check_heritage_main_flow.mjs <dist> [port]
//
// La maquette servie est un FAUX `test-fixture` (toiture plate triangulée sur
// le polygone IGN réel de l'Hôtel de Ville), injecté UNIQUEMENT par
// interception réseau dans ce test. Le dossier de l'Hôtel de Ville est
// aussi altéré dans la requête interceptée (publicationAllowed=true) pour
// franchir le verrou de publication : le dépôt n'est jamais modifié.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {readFileSync} from 'node:fs';
import {extname,join,resolve} from 'node:path';
import {createRequire} from 'node:module';
import earcut from 'earcut';
const require=createRequire(import.meta.url);
const {chromium}=require('playwright');
const dist=resolve(process.argv[2]??'dist'),port=+(process.argv[3]??5199);
const root=new URL('../../',import.meta.url);
const json=p=>JSON.parse(readFileSync(new URL(p,root),'utf8'));
const types={'.js':'text/javascript','.html':'text/html','.json':'application/json',
 '.css':'text/css','.png':'image/png','.webmanifest':'application/manifest+json'};
const server=createServer(async(q,res)=>{
 let p=decodeURIComponent(q.url.split('?')[0]);if(p.endsWith('/'))p+='index.html';
 try{const b=await readFile(join(dist,p));
  res.writeHead(200,{'content-type':types[extname(p)]??'application/octet-stream'});res.end(b);}
 catch{res.writeHead(404);res.end();}
}).listen(port);

const REF='PA00086319',IGN='BATIMENT0000000245157267';
const tile=json('public/data/4e/tiles/-1_0.json');
const b=tile.buildings.find(x=>x.id===IGN);
const C=[2.3537,48.8545],MX=111320*Math.cos(C[1]*Math.PI/180),MZ=111132;
const positions=[],indices=[];
for(const poly of b.polygons){
 const flat=[],holes=[];let n=0;
 poly.forEach((r,i)=>{if(i)holes.push(n);for(const q of r.slice(0,-1)){flat.push((q[0]-C[0])*MX,(q[1]-C[1])*MZ);n++;}});
 const base=positions.length/3;
 for(let i=0;i<flat.length;i+=2)positions.push(flat[i],60,flat[i+1]);
 for(const t of earcut(flat,holes,2))indices.push(base+t);
}
const pop=json('public/data/metropole/places/monuments.json').records.find(r=>r.ref===REF);
const fixture=tier=>({schema:1,ref:REF,units:'m',coordinates:'paris-local-xyz',tier,
 sourceIds:['bhdv-cc64-pl34'],parts:[{name:'test-fixture-'+tier,kind:'roof',positions,indices,
 sourceIds:['bhdv-cc64-pl34']}]});
const index={schema:1,models:[{ref:REF,x:pop.x,z:pop.z,sourceIds:['bhdv-cc64-pl34'],
 fullReplacement:true,review:'measured-and-approved',
 lods:['high','medium','low'].map(t=>({tier:t,maxRadiusMeters:2500,file:REF+'-'+t+'.json'}))}]};

const instrument=()=>{
 const st={draws:0,frames:[]};window.__perf=st;
 for(const C of [WebGL2RenderingContext,WebGLRenderingContext]){
  const P=C.prototype,de=P.drawElements;
  P.drawElements=function(){st.draws++;return de.apply(this,arguments);};
 }
 const raf=window.requestAnimationFrame.bind(window);
 window.requestAnimationFrame=cb=>raf(t=>{if(st.draws)st.frames.push(st.draws);st.draws=0;cb(t);});
};

async function run(withModel){
 const browser=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const ctx=await browser.newContext({viewport:{width:412,height:860}});
 await ctx.addInitScript(instrument);
 const page=await ctx.newPage();
 const errors=[],logs=[];
 page.on('pageerror',e=>errors.push(String(e)));
 page.on('console',m=>{if(/Maquette|maquette|Emprise/.test(m.text()))logs.push(m.text());});
 if(withModel){
  await page.route('**/architecture/models/index.json',r=>r.fulfill({json:index}));
  await page.route(/architecture\/models\/PA00086319-(high|medium|low)\.json$/,r=>
   r.fulfill({json:fixture(r.request().url().match(/-(high|medium|low)\.json/)[1])}));
  await page.route('**/architecture/dossiers.json',async r=>{
   const res=await r.fetch();const d=await res.json();
   for(const x of d.dossiers)if(x.ref===REF)x.publicationAllowed=true;
   await r.fulfill({json:d});
  });
 }
 await page.goto(`http://localhost:${port}/`);
 await page.waitForFunction(()=>/volumes rendus/.test(document.body.innerText),null,{timeout:90000});
 await page.waitForTimeout(15000);
 await page.click('#landmark-open');
 await page.fill('#landmark-search','Hôtel de ville');
 await page.waitForTimeout(800);
 await page.click('button[aria-label="Voir Hôtel de ville dans Paris"]');
 await page.click('#landmark-close').catch(()=>{});
 await page.waitForTimeout(20000); // vol de caméra, tuiles, maquette
 const draws=await page.evaluate(()=>{const f=__perf.frames.slice(-5);return f.length?Math.round(f.reduce((a,b)=>a+b,0)/f.length):0;});
 await page.screenshot({path:`/tmp/claude-0/perf/mainflow-${withModel?'model':'base'}.png`});
 const canvas=await page.$('canvas');const box=await canvas.boundingBox();
 const cx=box.x+box.width/2,cy=box.y+box.height/2;
 // Effacer le titre posé par « Voir » : seul le tap doit le remplir.
 await page.evaluate(()=>{document.getElementById('selection-title').textContent='';
  document.getElementById('selection').classList.add('hidden');});
 await page.mouse.click(cx,cy);
 await page.waitForTimeout(2500);
 const title=await page.textContent('#selection-title');
 const shown=await page.evaluate(()=>!document.getElementById('selection').classList.contains('hidden'));
 await page.screenshot({path:`/tmp/claude-0/perf/mainflow-${withModel?'model':'base'}-tap.png`});
 // Mode quartiers : le sol et les bâtiments restent interrogeables.
 let hint='non testé : mode quartiers désactivé (quarters.json absent de ce dist)';
 if(await page.isEnabled('#quarter-mode')){
  await page.click('#quarter-mode');
  await page.mouse.click(cx,cy);
  await page.waitForTimeout(2500);
  hint=await page.textContent('#quarter-hint');
 }
 const extra=await page.textContent('#place-extra');
 await browser.close();
 return {withModel,draws,title,selectionShown:shown,quarterHint:hint,quarterCard:(extra||'').slice(0,120),
  modelLogs:logs.slice(0,5),errors:errors.slice(0,5)};
}
const base=await run(false);
const model=await run(true);
server.close();
console.log(JSON.stringify({base,model},null,1));
const ok=/h[ôo]tel de ville/i.test(base.title)&&/h[ôo]tel de ville/i.test(model.title)&&
 base.selectionShown&&model.selectionShown&&model.draws<base.draws&&
 !base.errors.length&&!model.errors.length&&!model.modelLogs.some(l=>/non validée|retirée/.test(l));
console.log(ok?'Flux main.ts : sélection de l\'Hôtel de Ville avec et sans maquette.':'ÉCHEC du flux main.ts');
process.exit(ok?0:1);
