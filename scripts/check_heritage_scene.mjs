// Essai de bout en bout dans une vraie scène Babylon.js (NullEngine) :
// vraie tuile IGN contenant l'Hôtel de Ville, vraie table des emprises,
// vrai picking Babylon, bibliothèque de maquettes réelle avec un fetch
// simulé servant une maquette FACTICE (`test-fixture`, jamais publiée).
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync} from 'node:fs';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {build} from 'esbuild';

const root=new URL('..',import.meta.url);
const out=fileURLToPath(new URL('node_modules/.cache/heritage-scene/harness.mjs',root));
mkdirSync(new URL('node_modules/.cache/heritage-scene/',root),{recursive:true});
await build({
 entryPoints:[fileURLToPath(new URL('scripts/fixtures/heritage_scene_harness.ts',root))],
 bundle:true,platform:'node',format:'esm',outfile:out,logLevel:'error',
 define:{'import.meta.env.BASE_URL':'"/"'}
});
const {run}=await import(pathToFileURL(out).href+'?'+Date.now());
const json=p=>JSON.parse(readFileSync(new URL(p,root),'utf8'));
const pop=json('public/data/metropole/places/monuments.json').records
 .find(r=>r.ref==='PA00086319');
const results=[];
const warn=console.warn;
console.warn=()=>{};
let notes;
try{
 notes=await run({tile:json('public/data/4e/tiles/-1_0.json'),
  table:json('public/data/metropole/architecture/heritage-footprints.json'),
  ref:'PA00086319',ignId:'BATIMENT0000000245157267',pop:{x:pop.x,z:pop.z}},
  (ok,label)=>results.push([Boolean(ok),label]));
}finally{console.warn=warn;}
for(const [ok,label] of results)console.log((ok?'  ok   ':'  ÉCHEC ')+label);
for(const n of notes)console.log('  note '+n);
assert.ok(results.length>=25,'banc incomplet');
assert.ok(results.every(([ok])=>ok),'au moins une vérification de scène a échoué');
console.log('Scène Babylon : bascule, sélection, LOD, retours arrière et rejets vérifiés ('+
 results.length+' contrôles).');
