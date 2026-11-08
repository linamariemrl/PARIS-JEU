import {GameClock} from '../gameClock';
import {CityDashboard} from './cityDashboard';
import type {QuarterAnchor} from './cityEngine';
import type {GameView} from '../gameView';
import {IndicatorStore} from './indicatorStore';
import {FinanceModule} from './modules/finances';
import {EnvironmentModule} from './modules/environment';
import {SaveStore,validateSave,validateBundle,type GameSave,type SaveBundle} from './saveStore';
import {phaseOf,registerDossier,type Dossier,type DossierAction,type SelectedPlace} from './dossiers';

const money=(v:number)=>new Intl.NumberFormat('fr-FR',{
 style:'currency',currency:'EUR',maximumFractionDigits:0}).format(v);
const node=<T extends HTMLElement>(id:string)=>
  document.getElementById(id) as T;
function safe(value:string){return value.replace(/[&<>"']/g,c=>({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
 }[c]??c));}

export class GameManagement {
 readonly indicators=new IndicatorStore();
 readonly finance=new FinanceModule(this.indicators);
 readonly environment=new EnvironmentModule(this.indicators);
 readonly saves=new SaveStore();
 readonly city:CityDashboard;
 private dossiers:Dossier[]=[];
 private selected:SelectedPlace|null=null;
 private lastDossierHour=-1;
 private restored=false;
 private writing=false;
 private pendingSave=false;
 private lastAutosave=Date.now();
 private currentName='Partie principale';
 private currentSlot='principal';
 private createdAt=new Date().toISOString();
 constructor(private clock:GameClock, private onRateChange:(rate:0|1|10|60)=>void,
   private onGoTo:(x:number,z:number)=>void,
   private captureView:()=>GameView,private onRestoreView:(view:GameView)=>void){
  this.city=new CityDashboard(clock,()=>void this.autosave(true));
  node<HTMLButtonElement>('finance-open').addEventListener('click',()=>this.open());
  node<HTMLButtonElement>('finance-close').addEventListener('click',()=>this.close());
  node<HTMLButtonElement>('budget-propose').addEventListener('click',()=>this.propose());
  node<HTMLButtonElement>('save-now').addEventListener('click',()=>void this.save());
  node<HTMLButtonElement>('save-new').addEventListener('click',()=>void this.save(true));
  node<HTMLButtonElement>('save-export').addEventListener('click',()=>void this.export());
  node<HTMLButtonElement>('save-export-all').addEventListener('click',()=>void this.exportAll());
  node<HTMLInputElement>('save-import').addEventListener('change',e=>void this.import(e));
  void this.finance.loadOfficial(import.meta.env.BASE_URL).then(()=>this.render());
  void this.environment.load(import.meta.env.BASE_URL).then(()=>this.render());
  const actions:[string,DossierAction][]=[
   ['action-observe','observer'],['action-priority','prioriser'],
   ['action-dossier','ouvrir']
  ];
  for(const [id,action] of actions)
   node<HTMLButtonElement>(id).addEventListener('click',()=>void this.act(action));
  try{
   const slot=window.localStorage.getItem('paris.activeSlot');
   if(slot&&/^[a-zA-Z0-9_-]{1,50}$/.test(slot))this.currentSlot=slot;
  }catch{/* Stockage local non accessible dans certains modes privés. */}
  void this.restoreActive();
  document.addEventListener('visibilitychange',()=>{
   if(document.hidden)void this.autosave(true);
  });
  window.addEventListener('pagehide',()=>void this.autosave(true));
 }
 private async restoreActive():Promise<void>{
  try{
   const save=await this.saves.get(this.currentSlot);
   if(save)await this.load(this.currentSlot);
  }catch(error){console.warn('Restauration de la dernière partie',error);}
  finally{this.restored=true;this.lastAutosave=Date.now();}
 }
 private rememberSlot(){
  try{window.localStorage.setItem('paris.activeSlot',this.currentSlot);}
  catch{/* Les parties restent en IndexedDB. */}
 }
 /** Sauvegardes sérialisées : aucune écriture avant restauration. */
 async autosave(force=false):Promise<void>{
  if(!this.restored||(!force&&Date.now()-this.lastAutosave<30000))return;
  if(this.writing){this.pendingSave=true;return;}
  this.writing=true;
  try{
   await this.saves.put(this.currentSlot,this.snapshot());
   this.lastAutosave=Date.now();this.rememberSlot();
   node('autosave-status').textContent=
    'Sauvegarde auto : '+new Date().toLocaleTimeString('fr-FR');
  }catch(error){
   node('autosave-status').textContent='Sauvegarde automatique impossible : '+
    String(error);
  }finally{
   this.writing=false;
   if(this.pendingSave){this.pendingSave=false;void this.autosave(true);}
  }
 }
 setSelection(place:SelectedPlace):void{
  this.selected=place;
  node('location-actions').classList.remove('hidden');
  const existing=this.dossiers.find(d=>d.id===place.id);
  node('location-action-status').textContent=existing?
   phaseOf(existing,this.clock.current):'Aucune action enregistrée pour ce lieu.';
 }
 clearSelection():void{
  this.selected=null;
  node('location-actions').classList.add('hidden');
 }
 private async act(action:DossierAction):Promise<void>{
  if(!this.selected)return;
  try{
   this.dossiers=registerDossier(this.dossiers,this.selected,action,this.clock.current);
   node('location-action-status').textContent=phaseOf(this.dossiers[0],this.clock.current);
   await this.saves.put(this.currentSlot,this.snapshot());
   this.status('Action territoriale enregistrée et sauvegardée.');
   this.open();
  }catch(error){node('location-action-status').textContent='Erreur : '+String(error);}
 }
 setNeighborhoods(anchors:QuarterAnchor[]):void{this.city.setNeighborhoods(anchors);}
 tickDossiers():void{
  this.city.tick();
  if(Date.now()-this.lastAutosave>=30000)void this.autosave();
  const hour=Math.floor(this.clock.current/3_600_000);
  if(hour===this.lastDossierHour)return;
  this.lastDossierHour=hour;
  this.renderDossiers();
  if(this.selected)this.setSelection(this.selected);
 }
 private renderDossiers():void{
  const target=node<HTMLDivElement>('dossier-list');
  target.replaceChildren();
  node('dossier-total').textContent=String(this.dossiers.length);
  if(!this.dossiers.length){
   const p=document.createElement('p');
   p.className='finance-source';
   p.textContent='Aucun dossier. Touchez un bâtiment, une route ou un lieu pour agir.';
   target.append(p);return;
  }
  for(const d of this.dossiers.slice(0,35)){
   const row=document.createElement('div');row.className='dossier-row';
   const info=document.createElement('span');
   const name=document.createElement('strong');name.textContent=d.label;
   const state=document.createElement('small');state.textContent=phaseOf(d,this.clock.current);
   info.append(name,state);
   const go=document.createElement('button');
   go.textContent='Voir';
   go.addEventListener('click',()=>{this.close();this.onGoTo(d.x,d.z);});
   row.append(info,go);target.append(row);
  }
  if(this.dossiers.length>35){
   const p=document.createElement('p');p.className='finance-source';
   p.textContent='Affichage limité aux 35 dossiers les plus récents.';
   target.append(p);
  }
 }
 private status(text:string){node('finance-status').textContent=text;}
 open(){
  node('finance-panel').classList.remove('hidden');
  this.city.render();
  void this.render();
 }
 close(){node('finance-panel').classList.add('hidden');}
 private async render(){
  this.renderDossiers();
  const b=this.finance.baseline;
  node('finance-year').textContent=b?
    'Budget primitif '+b.year+' publié, Ville-département':
    'Montants officiels non encore récupérés';
  node('finance-reference').textContent=b?.source??'Aucun montant n’est inventé.';
  node('fin-op-revenue').textContent=b?money(b.operating.revenueEUR):'Non disponible';
  node('fin-op-expense').textContent=b?money(b.operating.expenseEUR):'Non disponible';
  node('fin-cap-revenue').textContent=b?money(b.capital.revenueEUR):'Non disponible';
  node('fin-cap-expense').textContent=b?money(b.capital.expenseEUR):'Non disponible';
  const reference=b?.debtOpeningReference;
  node('fin-debt').textContent=b?.debtOutstandingEUR!==null&&b?
    money(b.debtOutstandingEUR):
    reference?money(reference.amountApproxEUR)+
      ' au 01/01/2026 (référence, pas dette actuelle)':
    'Dette actuelle non documentée';
  node<HTMLInputElement>('op-change').value=String(this.finance.plan.operatingExpenseChangePct);
  node<HTMLInputElement>('cap-change').value=String(this.finance.plan.capitalExpenseChangePct);
  node<HTMLInputElement>('borrow-change').value=String(this.finance.plan.projectedBorrowingEUR/1e6);
  node<HTMLButtonElement>('budget-propose').disabled=!b;
  node('fin-balance').textContent=b?
    money(b.operating.revenueEUR-
      b.operating.expenseEUR*(1+this.finance.plan.operatingExpenseChangePct/100)):
    'Indisponible';
  const need=b?Math.max(0,b.capital.expenseEUR*
     (1+this.finance.plan.capitalExpenseChangePct/100)-b.capital.revenueEUR):null;
  node('fin-investment-need').textContent=need===null?'Indisponible':money(need);
  node('fin-borrowing').textContent=money(this.finance.plan.projectedBorrowingEUR);
  node('fin-uncovered').textContent=need===null?'Indisponible':
    money(Math.max(0,need-this.finance.plan.projectedBorrowingEUR));
  const env=this.environment.snapshot;
  const count=(n:number|null)=>n===null?'Source non publiée':
    n.toLocaleString('fr-FR');
  node('env-trees').textContent=count(env.trees);
  node('env-green').textContent=count(env.green);
  node('env-water').textContent=count(env.water);
  node('env-roads').textContent=count(env.roads);
  node('env-source-date').textContent=env.lastSourceUpdate?
    'Dernière extraction : '+new Intl.DateTimeFormat('fr-FR',{
      day:'2-digit',month:'2-digit',year:'numeric',timeZone:'Europe/Paris'
    }).format(new Date(env.lastSourceUpdate)):'Certaines sources sont encore absentes.';
  const list=await this.saves.list().catch(()=>[]);
  const target=node<HTMLDivElement>('save-list');
  target.replaceChildren();
  for(const row of list.sort((a,b)=>b.save.updatedAt.localeCompare(a.save.updatedAt))){
    const wrap=document.createElement('div');wrap.className='save-row';
    wrap.innerHTML='<span>'+safe(row.save.name)+' <small>'+safe(row.save.updatedAt.slice(0,16).replace('T',' '))+'</small></span>';
    const load=document.createElement('button');
    load.textContent='Charger';load.addEventListener('click',()=>void this.load(row.slot));
    const remove=document.createElement('button');
    remove.textContent='×';remove.setAttribute('aria-label','Supprimer la sauvegarde');
    remove.addEventListener('click',()=>void this.remove(row.slot));
    wrap.append(load,remove);target.append(wrap);
  }
  node('current-slot').textContent=this.currentName;
 }
 private propose(){
  if(!this.finance.baseline){this.status('Budget officiel absent.');return;}
  const val=(id:string)=>Number(node<HTMLInputElement>(id).value);
  this.finance.propose(val('op-change'),val('cap-change'),val('borrow-change'),this.clock.current);
  this.status('Proposition enregistrée dans le scénario. Vote du Conseil de Paris non simulé.');
  void this.autosave(true);
  void this.render();
 }
 private snapshot():GameSave{
  const now=new Date().toISOString();
  return {
    schema:1,name:this.currentName,createdAt:this.createdAt,updatedAt:now,
    gameTimestamp:this.clock.current,timeRate:this.clock.rate,
    plan:this.finance.plan,indicators:this.indicators.list(),
    dossiers:this.dossiers.map(d=>({...d})),view:this.captureView(),
    municipal:this.city.snapshot
  };
 }
 private async save(newSlot=false){
  try{
    if(newSlot){
      const name=window.prompt('Nom de la nouvelle sauvegarde :','Nouvelle partie');
      if(!name)return;
      this.currentName=name.trim().slice(0,80)||'Nouvelle partie';
      this.currentSlot='partie-'+Date.now();
      this.createdAt=new Date().toISOString();
    }
    await this.saves.put(this.currentSlot,this.snapshot());
    this.rememberSlot();this.lastAutosave=Date.now();
    this.status('Sauvegarde enregistrée localement sur ce téléphone.');
    await this.render();
  }catch(e){this.status('Impossible de sauvegarder : '+String(e));}
 }
 private async load(slot:string){
  try{
    const s=await this.saves.get(slot);
    if(!s)return;
    const v=validateSave(s);
    this.currentSlot=slot;this.currentName=v.name;
    this.rememberSlot();
    this.createdAt=v.createdAt;
    this.clock.restore(v.gameTimestamp,v.timeRate);
    this.onRateChange(v.timeRate);
    this.indicators.restore(v.indicators);
    this.finance.restore(v.plan,v.gameTimestamp);
    this.dossiers=(v.dossiers??[]).map(d=>({...d}));
     this.city.restore(v.municipal);
    if(v.view)this.onRestoreView(v.view);
    if(this.selected)this.setSelection(this.selected);
    this.status('Partie restaurée : '+this.currentName);
    await this.render();
  }catch(e){this.status('Chargement impossible : '+String(e));}
 }
 private async remove(slot:string){
  if(!window.confirm('Supprimer cette sauvegarde locale ?'))return;
  try{
    await this.saves.remove(slot);
    if(slot===this.currentSlot){
      this.currentSlot='principal';this.currentName='Partie principale';
      this.createdAt=new Date().toISOString();this.rememberSlot();
    }
    this.status('Sauvegarde supprimée.');
    await this.render();
  }catch(e){this.status('Suppression impossible : '+String(e));}
 }
 private download(content:string,filename:string){
  const url=URL.createObjectURL(new Blob([content],{type:'application/json'}));
  const link=document.createElement('a');
  link.href=url;link.download=filename;link.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
 }
 private async exportAll(){
  try{
   const rows=await this.saves.list();
   const saves=rows.filter(row=>row.slot!==this.currentSlot);
   saves.push({slot:this.currentSlot,save:this.snapshot()});
   if(saves.length>30)throw Error('Plus de 30 cases : export par partie nécessaire');
   const bundle:SaveBundle={format:'paris-save-bundle',schema:1,
     exportedAt:new Date().toISOString(),saves};
   this.download(JSON.stringify(bundle,null,2),'PARIS-toutes-parties-'+Date.now()+'.json');
   this.status(saves.length+' sauvegardes exportées.');
  }catch(error){this.status('Export global impossible : '+String(error));}
 }
 private async export(){
  this.download(JSON.stringify(this.snapshot(),null,2),'PARIS-partie-'+Date.now()+'.json');
  this.status('Export JSON lancé vers les téléchargements Android.');
 }
 private async import(event:Event){
  const input=event.target as HTMLInputElement;
  const file=input.files?.[0];if(!file)return;
  try{
    if(file.size>8e6)throw Error('Fichier supérieur à 8 Mo');
    const parsed:unknown=JSON.parse(await file.text());
    if(parsed&&typeof parsed==='object'&&
      (parsed as {format?:string}).format==='paris-save-bundle'){
     const bundle=validateBundle(parsed);
     let first='';
     for(let i=0;i<bundle.saves.length;i++){
      const slot='importe-'+Date.now()+'-'+i;
      if(!first)first=slot;
      await this.saves.put(slot,bundle.saves[i].save);
     }
     await this.load(first);
     this.status(bundle.saves.length+' parties restaurées sans écraser les anciennes.');
    }else{
     const value=validateSave(parsed),slot='importe-'+Date.now();
     await this.saves.put(slot,value);await this.load(slot);
     this.status('Import effectué. Sauvegarde locale créée.');
    }
  }catch(e){this.status('Import refusé : '+String(e));}
  input.value='';
 }
}
