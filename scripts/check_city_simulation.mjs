import assert from 'node:assert/strict';
import {
 CITY_DOMAINS,PROJECT_CATALOG,PARTNERS,EMPTY_MUNICIPAL_STATE,
 prepareProject,submitProject,holdCouncilVote,advanceMunicipal,
 validateMunicipalState,capacityOf,simulateMobility
} from '../src/simulation/cityEngine.ts';
const now=Date.UTC(2026,10,9,9,0,0);
assert.equal(CITY_DOMAINS.length,28);
assert.ok(PROJECT_CATALOG.length>=32);
assert.ok(PARTNERS.length>=10);
assert.ok(PROJECT_CATALOG.some(x=>x.kind==='demolition'));
assert.ok(PROJECT_CATALOG.some(x=>x.kind==='innovation'));
assert.ok(PROJECT_CATALOG.some(x=>x.authority==='partagee'));
assert.ok(PROJECT_CATALOG.every(x=>x.investMEUR>=0&&x.yearlyMEUR>=0&&
 Number.isFinite(x.durationDays)&&x.durationDays>0));
const original=EMPTY_MUNICIPAL_STATE();
assert.deepEqual(validateMunicipalState(undefined),original);
assert.throws(()=>validateMunicipalState({version:1,projects:[],nextId:-1}));
let state=prepareProject(original,PROJECT_CATALOG[0].id,'Paris entier',now);
assert.equal(state.projects[0].status,'instruction');
assert.equal(original.projects.length,0);
state=submitProject(state,state.projects[0].id,now);
assert.equal(state.projects[0].status,'programme');
const voted=holdCouncilVote(state,state.projects[0].id,now);
assert.ok(voted.projects[0].votes);
assert.equal(Object.values(voted.projects[0].votes).filter(x=>typeof x==='number').reduce((s,x)=>s+x,0),163);
assert.throws(()=>holdCouncilVote(voted,voted.projects[0].id,now));
const early=advanceMunicipal(voted,now+15*86400000);
assert.equal(early.projects[0].status,voted.projects[0].status);
const late=advanceMunicipal(voted,now+850*86400000);
if(voted.projects[0].votes.adopte)
 assert.equal(late.projects[0].status,'termine');
else assert.equal(late.projects[0].status,'rejete');
const a=capacityOf(voted,now);
assert.ok(a.capitalLeft>=0&&a.operatingLeft>=0);
assert.throws(()=>prepareProject(state,'not-a-project','Paris',now));
assert.throws(()=>validateMunicipalState({version:1,nextId:2,projects:[{
 ...voted.projects[0],votes:{pour:163,contre:2,abstention:0,absents:0,adopte:true}
}]}));
const districts=Array.from({length:80},(_,i)=>'Quartier '+i);
const rush=simulateMobility(now,districts,voted.projects);
const night=simulateMobility(Date.UTC(2026,10,9,3),districts,voted.projects);
assert.equal(rush.districts,80);
assert.notDeepEqual(rush.modes,night.modes);
assert.ok(rush.modes.pietons>0);
assert.equal(simulateMobility(now,districts,voted.projects).pressure,rush.pressure);
console.log('Conseil, 28 domaines, vote de 163 sièges, phases, finances et flux horaires : OK.');
