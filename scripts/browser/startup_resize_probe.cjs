// Diagnostic (hors CI) : horodate les tâches longues du démarrage et chaque
// changement de taille du canevas, et produit un profil CPU.
//   node scripts/browser/startup_resize_probe.cjs <dist> <port>
const {chromium}=require('playwright');const http=require('http'),fs=require('fs'),path=require('path');
const dist=process.argv[2],port=+process.argv[3];
const T={'.js':'text/javascript','.html':'text/html','.json':'application/json','.css':'text/css'};
const srv=http.createServer((q,r)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p.endsWith('/'))p+='index.html';
 fs.readFile(path.join(dist,p),(e,b)=>{if(e){r.writeHead(404);r.end();return;}r.writeHead(200,{'content-type':T[path.extname(p)]||'application/octet-stream'});r.end(b);});}).listen(port);
(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const ctx=await b.newContext({viewport:{width:412,height:860}});const page=await ctx.newPage();
 const cdp=await ctx.newCDPSession(page);await cdp.send('Profiler.enable');await cdp.send('Profiler.setSamplingInterval',{interval:500});
 await cdp.send('Profiler.start');
 await page.addInitScript(()=>{window.__rs=[];for(const k of ['width','height']){const d=Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype,k);Object.defineProperty(HTMLCanvasElement.prototype,k,{get(){return d.get.call(this);},set(v){const t=performance.now();d.set.call(this,v);window.__rs.push([Math.round(t),k,v,Math.round(performance.now()-t)]);},configurable:true});}window.__long=[];new PerformanceObserver(l=>{for(const e of l.getEntries())window.__long.push([Math.round(e.startTime),Math.round(e.duration)]);}).observe({type:'longtask',buffered:true});});
 await page.goto(`http://localhost:${port}/?bench`);
 await page.waitForFunction(()=>/volumes rendus/.test(document.body.innerText),null,{timeout:120000});
 await page.waitForTimeout(25000);
 const {profile}=await cdp.send('Profiler.stop');
 const long=await page.evaluate(()=>window.__long);
 // self time per function
 const byId=new Map(profile.nodes.map(n=>[n.id,n]));const self=new Map();
 const dt=profile.timeDeltas;for(let i=0;i<profile.samples.length;i++){const n=byId.get(profile.samples[i]);
  const k=n.callFrame.functionName+' '+(n.callFrame.url.split('/').pop())+':'+n.callFrame.lineNumber;self.set(k,(self.get(k)||0)+(dt[i]||0)/1000);}
 console.log('longtasks',JSON.stringify(long));console.log('resizes',JSON.stringify(await page.evaluate(()=>window.__rs)));
 console.log([...self].sort((a,b)=>b[1]-a[1]).slice(0,25).map(([k,v])=>v.toFixed(0).padStart(6)+' ms  '+k).join('\n'));
 fs.writeFileSync(require('os').tmpdir()+'/paris-startup.cpuprofile',JSON.stringify(profile));
 await b.close();srv.close();})();
