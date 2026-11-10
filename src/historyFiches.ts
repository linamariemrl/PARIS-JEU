/** Fiches Histoire R09 : chargées à la demande, par arrondissement.
 * Contenu exclusivement issu des notices POP officielles (Etalab 2.0) ;
 * le récit historique est le texte officiel (champ HIST), jamais généré.
 * Voir scripts/build_history_fiches.py.
 */
export type FicheStatus='documentee'|'recit-officiel-partiel'|'reperes-dates'|'minimale';
export interface Fiche{
 ref:string;titre:string;base:string;majeur?:boolean;arrondissement?:number;
 reperes?:string[];historique?:string;description?:string;
 precisionProtection?:string;observations?:string;
 statut:FicheStatus;manques?:string[];source:string;licence:string;
}
export interface FicheEntry{
 ref:string;shard:string;titre:string;statut:FicheStatus;
 arrondissement:number|null;dansIndexDuJeu:boolean;x?:number;z?:number;
}
interface FicheIndex{schema:1;entrees:FicheEntry[];statistiques:unknown;}

const BASE=import.meta.env.BASE_URL+'data/metropole/places/fiches/';
const SHARD=/^(arr-(0[1-9]|1\d|20)|hors-arr)$/;
let indexPromise:Promise<Map<string,FicheEntry>>|null=null;
const shards=new Map<string,Promise<Map<string,Fiche>>>();

export const statusLabel:Record<FicheStatus,string>={
 'documentee':'Fiche documentée',
 'recit-officiel-partiel':'Récit officiel, rubriques incomplètes',
 'reperes-dates':'Repères datés, récit à documenter',
 'minimale':'Fiche minimale, histoire à documenter',
};
const missingLabel:Record<string,string>={
 identification:'désignation',localisation:'arrondissement',datation:'datation',
 auteurs:'auteurs',historique:'récit historique',protection:'protection ou label',
};

export function ficheIndex():Promise<Map<string,FicheEntry>>{
 indexPromise??=fetch(BASE+'index.json').then(async r=>{
  if(!r.ok)throw Error('Index des fiches absent');
  const doc=await r.json() as FicheIndex;
  if(doc.schema!==1||!Array.isArray(doc.entrees))throw Error('Index des fiches invalide');
  return new Map(doc.entrees.filter(e=>SHARD.test(e.shard)).map(e=>[e.ref,e]));
 }).catch(error=>{
  console.warn('Fiches Histoire indisponibles',error);
  indexPromise=null;
  return new Map<string,FicheEntry>();
 });
 return indexPromise;
}

export async function ficheFor(ref:string|undefined):Promise<Fiche|null>{
 if(!ref)return null;
 const entry=(await ficheIndex()).get(ref);
 if(!entry)return null;
 let shard=shards.get(entry.shard);
 if(!shard){
  shard=fetch(BASE+entry.shard+'.json').then(async r=>{
   if(!r.ok)throw Error('Fiches '+entry.shard+' absentes');
   const doc=await r.json() as {schema:1;fiches:Fiche[]};
   return new Map(doc.fiches.map(f=>[f.ref,f]));
  }).catch(error=>{
   console.warn('Fiches Histoire',entry.shard,error);
   shards.delete(entry.shard);
   return new Map<string,Fiche>();
  });
  shards.set(entry.shard,shard);
 }
 return (await shard).get(ref)??null;
}

/** Section « Histoire » ajoutée à la fiche existante. Aucune information
 * n'est ajoutée au-delà des champs de la notice officielle. */
export function renderFiche(f:Fiche):HTMLElement{
 const section=document.createElement('section');
 section.className='history-fiche';
 const h=document.createElement('h3');
 h.textContent='Histoire (notice officielle)';
 const status=document.createElement('p');
 status.className='history-status history-'+f.statut;
 status.textContent=statusLabel[f.statut]+' · '+f.base;
 section.append(h,status);
 if(f.historique){
  const text=document.createElement('div');
  text.className='history-text';
  const paragraphs=f.historique.split(/\n+/).filter(Boolean);
  const long=f.historique.length>700;
  paragraphs.forEach((para,i)=>{
   const p=document.createElement('p');p.textContent=para;
   if(long&&i>1)p.hidden=true;
   text.append(p);
  });
  section.append(text);
  if(long&&paragraphs.length>2){
   const more=document.createElement('button');
   more.type='button';more.className='history-more';more.textContent='Lire la suite';
   more.addEventListener('click',()=>{
    text.querySelectorAll('p[hidden]').forEach(p=>(p as HTMLElement).hidden=false);
    more.remove();
   });
   section.append(more);
  }
 }else{
  const none=document.createElement('p');
  none.className='history-unknown';
  none.textContent='La notice officielle ne contient pas encore de récit historique pour ce lieu ; '+
   'aucune histoire n’est inventée pour la remplacer.';
  section.append(none);
 }
 if(f.reperes?.length){
  const sub=document.createElement('h4');sub.textContent='Repères attestés';
  const ul=document.createElement('ul');
  for(const r of f.reperes){const li=document.createElement('li');li.textContent=r;ul.append(li);}
  section.append(sub,ul);
 }
 if(f.precisionProtection){
  const p=document.createElement('p');p.className='history-protection';
  p.textContent='Portée de la protection : '+f.precisionProtection;
  section.append(p);
 }
 if(f.manques?.length){
  const p=document.createElement('p');p.className='history-missing';
  p.textContent='Non renseigné par la notice : '+
   f.manques.map(m=>missingLabel[m]??m).join(', ')+'.';
  section.append(p);
 }
 try{
  const url=new URL(f.source);
  if(url.protocol==='https:'&&url.hostname==='pop.culture.gouv.fr'){
   const a=document.createElement('a');
   a.href=url.href;a.target='_blank';a.rel='noopener noreferrer';
   a.className='heritage-source';a.textContent='Notice POP/Mérimée ('+f.ref+')';
   section.append(a);
  }
 }catch{/* source invalide : pas de lien */}
 const lic=document.createElement('small');lic.className='history-licence';lic.textContent=f.licence;
 section.append(lic);
 return section;
}
