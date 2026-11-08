import {GameClock} from '../gameClock';
import {CITY_DOMAINS,PROJECT_CATALOG,PARTNERS,EMPTY_MUNICIPAL_STATE,
 findTemplate,prepareProject,submitProject,holdCouncilVote,advanceMunicipal,
 validateMunicipalState,capacityOf,simulateMobility,
 type MunicipalState,type ProjectTemplate} from './cityEngine';

const el=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T;
const rounded=(x:number)=>new Intl.NumberFormat('fr-FR',{maximumFractionDigits:1}).format(x);
const stage:Record<string,string>={
 instruction:'À instruire',programme:'À l’ordre du jour',
 adopte:'Adopté, en travaux',rejete:'Rejeté',bloque:'À reprendre',
 termine:'Terminé (simulation)'
};
/** Interface du jeu, sans callbacks déclenchés par chaque frame 3D.
 * Les résultats chiffrés et le conseil sont explicitement fictifs.
 */
export class CityDashboard{
 private state:MunicipalState=EMPTY_MUNICIPAL_STATE();
 private selectedTemplate=PROJECT_CATALOG[0].id;
 private selectedProject='';
 private quarters:string[]=[];
 private lastHour=-1;
 private lastMobilityLabel='';
 constructor(private clock:GameClock,private changed:()=>void){
  el<HTMLInputElement>('city-search').addEventListener('input',()=>this.renderTemplates());
  el<HTMLButtonElement>('city-prepare').addEventListener('click',()=>this.prepare());
  el<HTMLButtonElement>('city-agenda').addEventListener('click',()=>this.schedule());
  el<HTMLButtonElement>('city-vote').addEventListener('click',()=>this.vote());
  this.render();
 }
 get snapshot():MunicipalState{return validateMunicipalState(this.state);}
 restore(value:unknown):void{
  this.state=validateMunicipalState(value);this.selectedProject='';
  this.render();
 }
 setNeighborhoods(names:string[]):void{
  this.quarters=[...new Set(names)].sort((a,b)=>a.localeCompare(b,'fr'));
  const suggestions=el('city-quarter-suggestions');
  suggestions.replaceChildren();
  for(const name of this.quarters){
   const option=document.createElement('option');
   option.value=name;suggestions.append(option);
  }
  this.renderMobility();
 }
 tick():void{
  const hour=Math.floor(this.clock.current/3_600_000);
  if(hour===this.lastHour)return;
  this.lastHour=hour;
  const result=advanceMunicipal(this.state,this.clock.current);
  if(result!==this.state){
   this.state=result;this.changed();
  }
  this.renderMobility();
  if(!el('finance-panel').classList.contains('hidden'))this.render();
 }
 private status(message:string):void{
  el('city-status').textContent=message;
 }
 private chosen():ProjectTemplate{
  return findTemplate(this.selectedTemplate)??PROJECT_CATALOG[0];
 }
 private chooseTemplate(t:ProjectTemplate):void{
  this.selectedTemplate=t.id;
  el('city-selected-title').textContent=t.title;
  el('city-selected-details').textContent=
   CITY_DOMAINS.find(d=>d[0]===t.domain)?.[1]+' · '+
   t.kind+' · investissement '+rounded(t.investMEUR)+' M€ (simulation) · fonctionnement '+
   rounded(t.yearlyMEUR)+' M€/an · '+t.durationDays+' jours de chantier simulés.\n'+
   'Instruction : '+t.partners.join(', ')+'. Risque : '+t.risk+'.';
  this.renderTemplates();
 }
 private renderTemplates():void{
  const text=el<HTMLInputElement>('city-search').value.trim().toLocaleLowerCase('fr');
  const hits=PROJECT_CATALOG.filter(t=>
   !text||(t.title+' '+CITY_DOMAINS.find(x=>x[0]===t.domain)?.[1]+' '+t.kind)
     .toLocaleLowerCase('fr').includes(text));
  const target=el('city-templates');
  target.replaceChildren();
  const showing=hits.slice(0,12);
  for(const t of showing){
   const button=document.createElement('button');
   button.type='button';button.className='city-project-choice';
   button.classList.toggle('is-selected',t.id===this.selectedTemplate);
   const strong=document.createElement('strong');strong.textContent=t.title;
   const small=document.createElement('small');
   small.textContent=(CITY_DOMAINS.find(d=>d[0]===t.domain)?.[1]??'')+
     ' · '+rounded(t.investMEUR)+' M€';
   button.append(strong,small);
   button.addEventListener('click',()=>this.chooseTemplate(t));
   target.append(button);
  }
  el('city-template-count').textContent=hits.length+' projets dans '+CITY_DOMAINS.length+
   ' domaines · '+showing.length+' affichés';
 }
 private prepare():void{
  try{
   const value=el<HTMLInputElement>('city-quarter').value.trim();
   if(value&&value!=='Paris entier'&&this.quarters.length&&!this.quarters.includes(value))
    throw Error('Quartier inconnu : choisir une dénomination officielle.');
   const selected=value||'Paris entier';
   this.state=prepareProject(this.state,this.selectedTemplate,selected,this.clock.current);
   this.selectedProject=this.state.projects[0].id;
   this.changed();this.render();
   this.status('Dossier '+this.selectedProject+
    ' créé : étude et contrôle juridique avant inscription au Conseil.');
  }catch(error){this.status(String(error));}
 }
 private schedule():void{
  try{
   if(!this.selectedProject)throw Error('Choisir un dossier à instruire.');
   this.state=submitProject(this.state,this.selectedProject,this.clock.current);
   this.changed();this.render();
   const project=this.state.projects.find(p=>p.id===this.selectedProject);
   this.status(project?.message??'Dossier réévalué.');
  }catch(error){this.status(String(error));}
 }
 private vote():void{
  try{
   if(!this.selectedProject)throw Error('Choisir un dossier inscrit à l’ordre du jour.');
   this.state=holdCouncilVote(this.state,this.selectedProject,this.clock.current);
   this.changed();this.render();
   const project=this.state.projects.find(p=>p.id===this.selectedProject);
   const v=project?.votes;
   if(v)this.status('Conseil fictif : '+v.pour+' pour · '+v.contre+
    ' contre · '+v.abstention+' abstentions · '+v.absents+' absents. '+
    (v.adopte?'Délibération adoptée.':'Délibération rejetée.'));
  }catch(error){this.status(String(error));}
 }
 private renderProjects():void{
  const root=el('city-projects');
  root.replaceChildren();
  for(const project of this.state.projects.slice(0,25)){
   const t=findTemplate(project.templateId)!;
   const row=document.createElement('button');
   row.type='button';row.className='city-project-choice city-project-case';
   row.classList.toggle('is-selected',project.id===this.selectedProject);
   const title=document.createElement('strong');title.textContent=
     project.id+' · '+t.title;
   const desc=document.createElement('small');
   desc.textContent=(stage[project.status]??project.status)+' · '+project.district+
     (project.votes?' · '+project.votes.pour+'/'+
     (project.votes.pour+project.votes.contre)+' exprimés favorables':'');
   row.append(title,desc);
   row.addEventListener('click',()=>{this.selectedProject=project.id;this.render();});
   root.append(row);
  }
  const current=this.state.projects.find(p=>p.id===this.selectedProject);
  el('city-project-detail').textContent=current?
   current.message+(current.votes?' · Conseil fictif de 163 sièges.':''):
   'Sélectionner un dossier pour poursuivre son instruction.';
  el<HTMLButtonElement>('city-agenda').disabled=current?.status!=='instruction';
  el<HTMLButtonElement>('city-vote').disabled=current?.status!=='programme';
  el('city-project-total').textContent=String(this.state.projects.length);
 }
 private renderMobility():void{
  const snapshot=simulateMobility(this.clock.current,this.quarters,this.state.projects);
  const signature=JSON.stringify([snapshot.hour,snapshot.modes,
   snapshot.districts,snapshot.projectEffect]);
  if(signature===this.lastMobilityLabel)return;
  this.lastMobilityLabel=signature;
  el('city-mobility-hour').textContent='Heure simulée : '+snapshot.hour+' h · '+
   snapshot.districts+' quartiers';
  const list:[
   string,number,string
  ][]=[
   ['Piétons',snapshot.modes.pietons,'pietons'],
   ['Automobiles',snapshot.modes.auto,'auto'],
   ['Vélos',snapshot.modes.velo,'velo'],
   ['Transports collectifs',snapshot.modes.collectif,'collectif']
  ];
  const container=el('city-mobility');
  container.replaceChildren();
  for(const [label,value,mode] of list){
   const line=document.createElement('div');line.className='city-flow-line';
   const title=document.createElement('span');title.textContent=label;
   const bar=document.createElement('div');bar.className='city-flow-bar';
   bar.setAttribute('role','meter');bar.setAttribute('aria-label',label);
   bar.setAttribute('aria-valuemin','0');bar.setAttribute('aria-valuemax','200');
   bar.setAttribute('aria-valuenow',String(Math.min(200,value)));
   const fill=document.createElement('i');fill.className='flow-'+mode;
   fill.style.width=Math.min(100,value/2)+'%';bar.append(fill);
   const val=document.createElement('b');val.textContent=String(value);
   line.append(title,bar,val);container.append(line);
  }
  el('city-mobility-note').textContent=snapshot.label+
   (snapshot.projectEffect?' · Effet des projets réalisés : '+snapshot.projectEffect+
    ' points de politique de mobilité.':' · Aucune politique achevée.');
 }
 render():void{
  this.chooseTemplate(this.chosen());
  const balance=capacityOf(this.state,this.clock.current);
  el('city-capital-left').textContent=rounded(balance.capitalLeft)+' / '+
   rounded(balance.capital)+' M€';
  el('city-op-left').textContent=rounded(balance.operatingLeft)+' / '+
   rounded(balance.operating)+' M€/an';
  this.renderProjects();
  this.renderMobility();
  el('city-institutions').textContent=PARTNERS.map(p=>p[0]+' : '+p[1]).join(' · ');
 }
}
