import {GameClock} from '../gameClock';
import {IndicatorStore} from './indicatorStore';
import {FinanceModule} from './modules/finances';
import {SaveStore,validateSave,type GameSave} from './saveStore';

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
 readonly saves=new SaveStore();
 private currentName='Partie principale';
 private currentSlot='principal';
 constructor(private clock:GameClock, private onRateChange:(rate:0|1|10|60)=>void){
  node<HTMLButtonElement>('finance-open').addEventListener('click',()=>this.open());
  node<HTMLButtonElement>('finance-close').addEventListener('click',()=>this.close());
  node<HTMLButtonElement>('budget-propose').addEventListener('click',()=>this.propose());
  node<HTMLButtonElement>('save-now').addEventListener('click',()=>void this.save());
  node<HTMLButtonElement>('save-new').addEventListener('click',()=>void this.save(true));
  node<HTMLButtonElement>('save-export').addEventListener('click',()=>void this.export());
  node<HTMLInputElement>('save-import').addEventListener('change',e=>void this.import(e));
  void this.finance.loadOfficial(import.meta.env.BASE_URL).then(()=>this.render());
 }
 private status(text:string){node('finance-status').textContent=text;}
 open(){
  node('finance-panel').classList.remove('hidden');
  void this.render();
 }
 close(){node('finance-panel').classList.add('hidden');}
 private async render(){
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
  void this.render();
 }
 private snapshot():GameSave{
  const now=new Date().toISOString();
  return {
    schema:1,name:this.currentName,createdAt:now,updatedAt:now,
    gameTimestamp:this.clock.current,timeRate:this.clock.rate,
    plan:this.finance.plan,indicators:this.indicators.list()
  };
 }
 private async save(newSlot=false){
  try{
    if(newSlot){
      const name=window.prompt('Nom de la nouvelle sauvegarde :','Nouvelle partie');
      if(!name)return;
      this.currentName=name.trim().slice(0,80)||'Nouvelle partie';
      this.currentSlot='partie-'+Date.now();
    }
    await this.saves.put(this.currentSlot,this.snapshot());
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
    this.clock.restore(v.gameTimestamp,v.timeRate);
    this.onRateChange(v.timeRate);
    this.indicators.restore(v.indicators);
    this.finance.restore(v.plan,v.gameTimestamp);
    this.status('Partie restaurée : '+this.currentName);
    await this.render();
  }catch(e){this.status('Chargement impossible : '+String(e));}
 }
 private async remove(slot:string){
  if(!window.confirm('Supprimer cette sauvegarde locale ?'))return;
  try{
    await this.saves.remove(slot);
    if(slot===this.currentSlot){this.currentSlot='principal';this.currentName='Partie principale';}
    this.status('Sauvegarde supprimée.');
    await this.render();
  }catch(e){this.status('Suppression impossible : '+String(e));}
 }
 private async export(){
  const text=JSON.stringify(this.snapshot(),null,2);
  const url=URL.createObjectURL(new Blob([text],{type:'application/json'}));
  const link=document.createElement('a');
  link.href=url;link.download='PARIS-partie-'+Date.now()+'.json';
  link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  this.status('Export JSON lancé vers les téléchargements Android.');
 }
 private async import(event:Event){
  const input=event.target as HTMLInputElement;
  const file=input.files?.[0];if(!file)return;
  try{
    if(file.size>3e6)throw Error('Fichier supérieur à 3 Mo');
    const value=validateSave(JSON.parse(await file.text()));
    const slot='importe-'+Date.now();
    await this.saves.put(slot,value);
    await this.load(slot);
    this.status('Import effectué. Sauvegarde locale créée.');
  }catch(e){this.status('Import refusé : '+String(e));}
  input.value='';
 }
}
