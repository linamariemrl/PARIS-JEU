/** Moteur civique 0.26.3. Tous les chiffres calculés sont des scénarios
 * de jeu, JAMAIS des prévisions économiques, une composition électorale
 * de 2026 ou des crédits publics authentifiés. Les actes municipaux
 * majeurs sont débattus ; l'instruction et l'exécution restent distinctes.
 */
export const CITY_DOMAINS=[
 ['urbanisme','Urbanisme et foncier'],['logement','Logement et hébergement'],
 ['mobilite','Mobilité et transports'],['voirie','Voirie et espace public'],
 ['climat','Climat et résilience'],['nature','Parcs et biodiversité'],
 ['proprete','Propreté et déchets'],['eau','Eau et assainissement'],
 ['energie','Énergie'],['education','Écoles et éducation'],
 ['enfance','Petite enfance'],['jeunesse','Jeunesse'],
 ['sante','Santé publique'],['solidarites','Solidarités et précarité'],
 ['handicap','Accessibilité et handicap'],['aines','Vieillissement'],
 ['culture','Culture et bibliothèques'],['patrimoine','Patrimoine et monuments'],
 ['sport','Sports et équipements'],['economie','Économie et emploi'],
 ['commerce','Commerces et marchés'],['tourisme','Tourisme'],
 ['securite','Prévention et tranquillité'],['numerique','Services numériques'],
 ['democratie','Démocratie participative'],['finance','Finances et commande publique'],
 ['logistique','Logistique urbaine'],['recherche','Innovation et recherche']
] as const;
export type DomainId=typeof CITY_DOMAINS[number][0];
export type ProjectKind='innovation'|'construction'|'renovation'|'demolition'|'service';
export type DecisionAuthority='municipal'|'partagee'|'etat';
export type Measure='mobilite'|'climat'|'logement'|'services'|'economie'|'cohesion';
export interface ProjectTemplate{
 id:string;domain:DomainId;title:string;kind:ProjectKind;
 authority:DecisionAuthority;partners:string[];
 investMEUR:number;yearlyMEUR:number;durationDays:number;
 impact:Partial<Record<Measure,number>>;risk:string;
}
const raw:Array<[DomainId,string,ProjectKind,DecisionAuthority,string[],number,number,number,Partial<Record<Measure,number>>,string]>= [
 ['urbanisme','Réaménager un îlot urbain','construction','municipal',['DU','APUR','mairie de secteur'],42,1.5,630,{logement:4,services:2},'PLU, étude d’impact et maîtrise foncière obligatoires'],
 ['urbanisme','Reconstruire un ensemble municipal vétuste','demolition','municipal',['DU','DAC','DRAC'],26,0.7,540,{services:1,climat:1},'Diagnostic amiante et exclusion des monuments protégés'],
 ['logement','Réhabiliter 500 logements sociaux','renovation','municipal',['DLH','bailleurs sociaux'],68,1.7,480,{logement:6,climat:3},'Accords avec les propriétaires et relogement temporaire'],
 ['logement','Créer une résidence de logements abordables','construction','municipal',['DLH','bailleurs sociaux'],51,1.6,720,{logement:6,cohesion:2},'Terrain et autorisation d’urbanisme nécessaires'],
 ['mobilite','Créer un axe de bus à priorité renforcée','innovation','partagee',['Île-de-France Mobilités','RATP','DVD'],29,3.7,320,{mobilite:7,climat:2},'Convention de l’autorité organisatrice nécessaire'],
 ['mobilite','Renforcer les continuités cyclables','construction','municipal',['DVD','Préfecture de police'],12,1.2,260,{mobilite:5,climat:2},'Concertation et sécurité des carrefours'],
 ['voirie','Reconfigurer une place publique','construction','municipal',['DVD','DEVE','mairie de secteur'],24,1.8,330,{mobilite:2,cohesion:4},'Circulation locale et accessibilité à expertiser'],
 ['voirie','Réparer les chaussées prioritaires','renovation','municipal',['DVD'],18,0.5,180,{mobilite:3,services:2},'Priorisation par état réel des ouvrages'],
 ['climat','Adapter les écoles aux fortes chaleurs','renovation','municipal',['DCPA','DASCO'],17,1.9,240,{climat:5,services:3},'Diagnostic énergétique des bâtiments préalable'],
 ['nature','Créer une promenade végétalisée','construction','municipal',['DEVE','DVD'],11,1.3,300,{climat:4,cohesion:3},'Réseaux souterrains et emprises à vérifier'],
 ['proprete','Optimiser des tournées de collecte','innovation','municipal',['DPE'],6,2.1,150,{services:4,climat:2},'Essais terrain, conditions de travail et collecte'],
 ['eau','Moderniser les réseaux pluviaux','renovation','partagee',['Eau de Paris','Section de l’assainissement'],37,0.8,600,{climat:4,services:3},'Compétences et conventions à répartir'],
 ['energie','Installer du solaire sur des bâtiments municipaux','construction','municipal',['DCPA','Agence parisienne du climat'],22,0.5,330,{climat:5},'Bilan structurel et avis patrimoniaux'],
 ['education','Rénover des écoles publiques','renovation','municipal',['DASCO','Rectorat'],49,2,450,{services:6,cohesion:2},'Calendrier scolaire et répartition des compétences'],
 ['enfance','Ouvrir des places de crèche','construction','municipal',['DFPE','CAF'],32,5.2,420,{services:6,cohesion:3},'Recrutement et normes d’accueil'],
 ['jeunesse','Déployer des maisons de la jeunesse','service','municipal',['DJS','associations'],5,3.1,190,{cohesion:5,services:3},'Conventionnement des opérateurs'],
 ['sante','Créer des centres municipaux de santé','construction','partagee',['DSP','ARS Île-de-France'],16,6.5,390,{services:5,cohesion:3},'Autorisation et recrutement des soignants'],
 ['solidarites','Renforcer les accueils de jour','service','municipal',['DSOL','CASVP','associations'],7,5.5,180,{cohesion:7,services:3},'Capacité des opérateurs sociaux'],
 ['handicap','Accélérer la mise en accessibilité','renovation','municipal',['DCPA','DVD','associations'],21,0.6,300,{services:5,cohesion:5},'Audit d’accessibilité des sites'],
 ['aines','Développer l’aide de proximité aux aînés','service','municipal',['DSOL','CASVP'],4,4.4,140,{cohesion:5,services:4},'Recrutement et soutien aux aidants'],
 ['culture','Moderniser des bibliothèques','renovation','municipal',['DAC','DCPA'],15,1.5,310,{services:4,cohesion:3},'Protection du patrimoine et continuité du service'],
 ['patrimoine','Restaurer un ensemble historique municipal','renovation','partagee',['DAC','DRAC','architecte des Bâtiments de France'],37,1.1,520,{cohesion:4,economie:2},'Autorisation patrimoniale et propriété à établir'],
 ['sport','Rénover les équipements sportifs','renovation','municipal',['DJS','DCPA'],27,2.2,330,{services:5,cohesion:3},'Mise aux normes et indisponibilités temporaires'],
 ['economie','Soutenir des espaces d’innovation','innovation','municipal',['DAE','CCI Paris'],10,2.8,220,{economie:6},'Critères d’accès et impact économique à évaluer'],
 ['commerce','Réhabiliter un marché municipal','renovation','municipal',['DAE','commerçants'],9,0.9,250,{economie:4,cohesion:2},'Continuité de l’activité et concession éventuelle'],
 ['tourisme','Améliorer les parcours des visiteurs','service','municipal',['Paris je t’aime','DAC','DVD'],5,2.2,140,{economie:3,services:2},'Charge touristique et usages riverains'],
 ['securite','Déployer des médiateurs de quartier','service','partagee',['DPSP','Préfecture de police'],3,5.4,180,{cohesion:5,services:2},'Coordination sécurité, compétence de l’État préservée'],
 ['numerique','Unifier les démarches municipales','innovation','municipal',['DSIN','services de la Ville'],14,3,310,{services:6,economie:1},'Protection des données et cybersécurité'],
 ['democratie','Créer des jurys citoyens permanents','innovation','municipal',['DDCT','mairies de secteur'],2,1.5,130,{cohesion:5,services:1},'Tirage au sort, représentativité et publicité'],
 ['finance','Moderniser la commande publique','innovation','municipal',['DFA','DAJ'],4,0.5,220,{economie:2,services:3},'Contrôle juridique des marchés'],
 ['logistique','Créer des espaces de livraison mutualisés','construction','partagee',['DVD','DAE','opérateurs'],18,2.6,300,{mobilite:4,climat:2,economie:2},'Servitudes et accords des opérateurs'],
 ['recherche','Ouvrir des expérimentations urbaines','innovation','partagee',['APUR','universités','agences publiques'],6,2,260,{climat:2,services:2,economie:3},'Évaluation indépendante, données personnelles']
];
export const PROJECT_CATALOG:ReadonlyArray<ProjectTemplate>=raw.map((r,i)=>({
 id:'p'+String(i+1).padStart(2,'0'),domain:r[0],
 title:r[1],kind:r[2],authority:r[3],partners:r[4],
 investMEUR:r[5],yearlyMEUR:r[6],durationDays:r[7],impact:r[8],risk:r[9]
}));
export const PARTNERS=[
 ['Conseil de Paris','Vote, contrôle démocratique et arbitrages'],
 ['Services de la Ville','Instruction, exécution et commande publique'],
 ['Mairies de secteur','Avis, proximité, équipements et délégations'],
 ['Préfecture de police','Missions régaliennes et compétences propres'],
 ['Préfecture de région et DRAC','Contrôle de légalité et monuments historiques'],
 ['Région Île-de-France','Financements et compétences régionales'],
 ['Métropole du Grand Paris','Compétences intercommunales coordonnées'],
 ['Île-de-France Mobilités','Autorité organisatrice des mobilités'],
 ['RATP / SNCF','Exploitants, pas services municipaux'],
 ['ARS Île-de-France','Compétences sanitaires partagées'],
 ['Eau de Paris / opérateurs','Exploitation et ingénierie spécialisées'],
 ['APUR / agences / associations','Expertise, études et concertation']
] as const;
export type ProjectStatus='instruction'|'programme'|'accords'|'adopte'|'rejete'|'bloque'|'termine';
export interface SimulatedVotes{pour:number;contre:number;abstention:number;absents:number;adopte:boolean;}
export interface MunicipalProject{
 id:string;templateId:string;district:string;createdAt:number;
 status:ProjectStatus;votes?:SimulatedVotes;voteAt?:number;
 finishedAt?:number;partnerApproval?:{approved:boolean;date:number};message:string;
}
export interface MunicipalState{version:1;projects:MunicipalProject[];nextId:number;}
export const EMPTY_MUNICIPAL_STATE=():MunicipalState=>({version:1,projects:[],nextId:1});
const hash=(text:string)=>{
 let h=2166136261;
 for(let i=0;i<text.length;i++)h=Math.imul(h^text.charCodeAt(i),16777619);
 return h>>>0;
};
const clamp=(x:number,a:number,b:number)=>Math.max(a,Math.min(b,x));
export const findTemplate=(id:string)=>PROJECT_CATALOG.find(p=>p.id===id);
export function validateMunicipalState(value:unknown):MunicipalState{
 if(value===undefined)return EMPTY_MUNICIPAL_STATE();
 if(!value||typeof value!=='object')throw Error('Simulation municipale invalide');
 const s=value as MunicipalState;
 if(s.version!==1||!Array.isArray(s.projects)||s.projects.length>200||
   !Number.isInteger(s.nextId)||s.nextId<1||s.nextId>100000)throw Error('Dossiers municipaux invalides');
 const ids=new Set<string>();
 for(const p of s.projects){
  if(!p||typeof p.id!=='string'||ids.has(p.id)||p.id.length>50||
   !findTemplate(p.templateId)||typeof p.district!=='string'||p.district.length>90||
   !Number.isFinite(p.createdAt)||!['instruction','programme','accords','adopte','rejete','bloque','termine'].includes(p.status)||
   typeof p.message!=='string'||p.message.length>600)throw Error('Projet municipal corrompu');
  ids.add(p.id);
  if(p.partnerApproval&&(!Number.isFinite(p.partnerApproval.date)||
     typeof p.partnerApproval.approved!=='boolean'))
    throw Error('Accord institutionnel invalide');
  if(p.votes){
   const v=p.votes;
   if(![v.pour,v.contre,v.abstention,v.absents].every(x=>Number.isInteger(x)&&x>=0)||
      v.pour+v.contre+v.abstention+v.absents!==163||typeof v.adopte!=='boolean')
    throw Error('Procès-verbal de vote invalide');
  }
 }
 return {version:1,nextId:s.nextId,projects:s.projects.map(p=>({
  ...p,votes:p.votes?{...p.votes}:undefined,
  partnerApproval:p.partnerApproval?{...p.partnerApproval}:undefined
 }))};
}
export function prepareProject(state:MunicipalState,templateId:string,district:string,now:number):MunicipalState{
 if(state.projects.length>=200)throw Error('200 projets maximum dans cette partie');
 if(!findTemplate(templateId)||!Number.isFinite(now)||district.length>90)
  throw Error('Dossier incomplet');
 const proj:MunicipalProject={id:'CP-'+state.nextId,templateId,
  district:district||'Paris entier',createdAt:now,status:'instruction',
  message:'Instruction : études, concertation, contrôle juridique et maîtrise d’ouvrage à établir.'};
 return {...state,nextId:state.nextId+1,projects:[proj,...state.projects]};
}
const yearOf=(time:number)=>new Date(time).getUTCFullYear();
export function capacityOf(state:MunicipalState,now:number,annualCapitalMEUR=500,annualOperatingMEUR=125){
 const accepted=state.projects.filter(p=>
  p.votes?.adopte&&p.voteAt!==undefined&&yearOf(p.voteAt)===yearOf(now));
 const invest=accepted.reduce((s,p)=>s+(findTemplate(p.templateId)?.investMEUR??0),0);
 const recurrent=accepted.reduce((s,p)=>s+(findTemplate(p.templateId)?.yearlyMEUR??0),0);
 return {capital:annualCapitalMEUR,operating:annualOperatingMEUR,
  capitalReserved:invest,operatingReserved:recurrent,
  capitalLeft:Math.max(0,annualCapitalMEUR-invest),
  operatingLeft:Math.max(0,annualOperatingMEUR-recurrent)};
}
export function submitProject(state:MunicipalState,id:string,now:number):MunicipalState{
 const project=state.projects.find(p=>p.id===id);
 if(!project||project.status!=='instruction')throw Error('Projet non disponible pour délibération');
 if(!Number.isFinite(now)||now<project.createdAt)throw Error('Chronologie incohérente');
 const template=findTemplate(project.templateId)!;
 const next=state.projects.map(p=>({...p}));
 const target=next.find(p=>p.id===id)!;
 if(template.authority==='etat'){
  target.status='bloque';target.message='Compétence de l’État : simple vœu municipal, autorisation extérieure requise.';
  return {...state,projects:next};
 }
 const capacity=capacityOf(state,now);
 if(template.investMEUR>capacity.capitalLeft||template.yearlyMEUR>capacity.operatingLeft){
  target.status='bloque';
  target.message='Enveloppe fictive insuffisante : reprendre le programme ou un arbitrage budgétaire.';
  return {...state,projects:next};
 }
 target.status='programme';target.message='Projet inscrit à l’ordre du jour simulé du Conseil de Paris.';
 return {...state,projects:next};
}
/** Conseil FICTIF : 163 sièges, sans prétendre reproduire les élus et groupes
 * réels. Vote déterministe par dossier, étude et sensibilité simulés.
 * Adoption: majorité des suffrages exprimés (pour > contre), quorum de
 * présence de jeu >= 82. Les vrais processus sont bien plus complexes.
 */
export function holdCouncilVote(state:MunicipalState,id:string,now:number):MunicipalState{
 const p=state.projects.find(x=>x.id===id);
 if(!p||p.status!=='programme')throw Error('Le projet doit être programmé avant le vote');
 const t=findTemplate(p.templateId)!;
 const seed=hash(id+'|'+t.id+'|'+p.district);
 const absence=4+seed%15;
 const abstention=5+(seed>>>7)%16;
 const presence=163-absence;
 const expressed=presence-abstention;
 const pts=Object.values(t.impact).reduce((sum,v)=>sum+(v??0),0);
 const risk=t.kind==='demolition'?22:t.authority==='partagee'?8:0;
 const cost=t.investMEUR/10+t.yearlyMEUR/2;
 const variance=((seed>>>15)%45)-22;
 const popularity=clamp(49+pts*1.9-cost-risk+variance,10,90);
 const pour=Math.round(expressed*popularity/100);
 const contre=expressed-pour;
 const adopted=presence>=82&&pour>contre;
 const voted:SimulatedVotes={pour,contre,abstention,absents:absence,adopte:adopted};
 return {...state,projects:state.projects.map(x=>x.id!==id?x:{
  ...x,votes:voted,voteAt:now,
  status:adopted?(t.authority==='partagee'?'accords':'adopte'):'rejete',
  finishedAt:adopted&&t.authority==='municipal'?
    now+t.durationDays*86_400_000:undefined,
  message:adopted?(t.authority==='partagee'?
   'Délibération municipale adoptée dans le jeu. En attente de l’avis fictif des autorités partenaires avant toute exécution.':
   'Délibération adoptée dans le jeu. Chantier et marchés simulés en cours.'):
   'Délibération rejetée par le conseil fictif ; le projet n’est pas exécuté.'
 })};
}
/** Une autorité extérieure fictive peut accorder ou refuser sa convention.
 * Cette simulation ne contacte AUCUNE institution réelle.
 */
export function negotiatePartnership(state:MunicipalState,id:string,now:number):MunicipalState{
 const selected=state.projects.find(p=>p.id===id);
 if(!selected||selected.status!=='accords'||!selected.votes?.adopte)
  throw Error('Aucun accord extérieur à examiner sur ce projet');
 const t=findTemplate(selected.templateId)!;
 if(t.authority!=='partagee')throw Error('Projet sans partenaire décisionnaire');
 const seed=hash(id+'|'+t.id+'|'+selected.district+'|convention');
 const approved=(seed%100)<70; // règle fictive publique, non probabilité empirique
 return {...state,projects:state.projects.map(p=>p.id!==id?p:{
  ...p,partnerApproval:{approved,date:now},
  status:approved?'adopte':'bloque',
  finishedAt:approved?now+t.durationDays*86_400_000:undefined,
  message:approved?
   'Accord simulé des partenaires obtenu. Le projet passe à l’exécution fictive.':
   'Accord simulé refusé : projet suspendu, nouvelle convention à négocier.'
 })};
}
export function advanceMunicipal(state:MunicipalState,now:number):MunicipalState{
 let changed=false;
 const projects=state.projects.map(p=>{
  if(p.status!=='adopte'||p.finishedAt===undefined||now<p.finishedAt)return p;
  changed=true;
  return {...p,status:'termine' as const,
   message:'Projet achevé dans la simulation. Les géométries IGN réelles restent inchangées.'};
 });
 return changed?{...state,projects}:state;
}
export type FlowMode='pietons'|'auto'|'velo'|'collectif';
export interface MobilitySnapshot{
 hour:number;districts:number;modes:Record<FlowMode,number>;
 pressure:number;projectEffect:number;label:string;
}
const FLOW_MODES:FlowMode[]=['pietons','auto','velo','collectif'];
/** 80 quartiers administratifs avec profils synthétiques stables.
 * Les indices sont relatifs à une référence arbitraire de 100, PAS des
 * personnes ou véhicules réellement comptés sur une voie.
 * Les décisions adoptées terminées influent sur les indices.
 */
export function simulateMobility(now:number,districts:readonly string[],
 projects:readonly MunicipalProject[]):MobilitySnapshot{
 const date=new Date(now);
 const hour=Number(new Intl.DateTimeFormat('en-GB',{
  timeZone:'Europe/Paris',hour:'2-digit',hourCycle:'h23'
 }).format(date));
 const weekdayText=new Intl.DateTimeFormat('en-US',{
  timeZone:'Europe/Paris',weekday:'short'
 }).format(date);
 const weekday=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].indexOf(weekdayText);
 const weekend=weekday===0||weekday===6;
 const peak=((hour>=7&&hour<=9)||(hour>=17&&hour<=19))?1.44:
  hour>=22||hour<5?.31:hour>=11&&hour<=14?1.16:.88;
 const weekendFactor=weekend?.78:1;
 let mass={pietons:0,auto:0,velo:0,collectif:0};
 const zones=districts.length?districts:['Paris entier'];
 for(const district of zones){
  const seed=hash(district);
  for(const mode of FLOW_MODES){
   const bias=.78+((seed>>>({pietons:1,auto:6,velo:11,collectif:15}[mode]))%39)/100;
   const nightlife=(mode==='pietons'&&hour>=20&&hour<24)?1.23:1;
   mass[mode]+=100*peak*weekendFactor*bias*nightlife;
  }
 }
 for(const mode of FLOW_MODES)mass[mode]=Math.round(mass[mode]/zones.length);
 let effect=0;
 for(const project of projects){
  if(project.status!=='termine')continue;
  const t=findTemplate(project.templateId);
  if(t)effect+=(t.impact.mobilite??0);
 }
 effect=Math.min(24,effect);
 mass.auto=Math.round(mass.auto*(1-effect*.008));
 mass.velo=Math.round(mass.velo*(1+effect*.014));
 mass.collectif=Math.round(mass.collectif*(1+effect*.011));
 mass.pietons=Math.round(mass.pietons*(1+effect*.006));
 const pressure=clamp(Math.round((mass.auto*.6+mass.collectif*.4)),0,300);
 return {hour,districts:districts.length,modes:mass,
  pressure,projectEffect:effect,label:'Indices de mobilité fictifs, base 100 ; non calibrés sur des comptages'};
}

export interface QuarterAnchor{name:string;x:number;z:number;}
export interface MobilityCorridor{
 from:string;to:string;distanceKm:number;index:number;primaryMode:FlowMode;
}
/** Matrice origine-destination fictive : position approchée des enveloppes
 * officielles des 80 quartiers, aucun trajet ou comptage réel. Au maximum
 * 80² paires recalculées seulement à l'heure de jeu, hors boucle 3D.
 */
export function simulateCorridors(now:number,anchors:readonly QuarterAnchor[],
 projects:readonly MunicipalProject[],limit=5):MobilityCorridor[]{
 if(anchors.length<2)return [];
 const snap=simulateMobility(now,anchors.map(a=>a.name),projects);
 const pairs:MobilityCorridor[]=[];
 const commute=snap.hour>=7&&snap.hour<=9?1.22:
   snap.hour>=17&&snap.hour<=20?1.32:.88;
 const scope=anchors.slice(0,80);
 for(let i=0;i<scope.length;i++)for(let j=i+1;j<scope.length;j++){
  const a=scope[i],b=scope[j];
  if(![a.x,a.z,b.x,b.z].every(Number.isFinite))continue;
  const distance=Math.hypot(a.x-b.x,a.z-b.z);
  if(distance<250||distance>19000)continue;
  const seed=hash(a.name+'|'+b.name);
  const attraction=.55+((seed>>>3)%80)/100;
  const proximity=1/(1+distance/3500);
  const index=Math.max(1,Math.round(100*attraction*proximity*commute));
  const mode:FlowMode=distance<1500?'pietons':
   distance<3200?'velo':distance<6500?'auto':'collectif';
  pairs.push({from:a.name,to:b.name,
   distanceKm:Math.round(distance/100)/10,index,primaryMode:mode});
 }
 return pairs.sort((a,b)=>b.index-a.index).slice(0,Math.max(0,Math.min(10,limit)));
}
