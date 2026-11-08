/** Suivi de décisions locales, purement simulé et sans montant fictif. */
export type DossierAction='observer'|'prioriser'|'ouvrir';
export type PlaceKind='batiment'|'voirie'|'lieu';
export interface SelectedPlace {
 id:string;label:string;kind:PlaceKind;x:number;z:number;
}
export interface Dossier extends SelectedPlace {
 action:DossierAction;createdAt:number;
}
const DAY=86_400_000;
export function phaseOf(d:Dossier,now:number):string{
 const due=now-d.createdAt>=DAY;
 switch(d.action){
  case 'observer':return due?'Observation à réexaminer':'Observation programmée';
  case 'prioriser':return due?'Priorité à arbitrer':'Priorité enregistrée';
  case 'ouvrir':return due?'Dossier à suivre':'Dossier ouvert';
 }
}
export function registerDossier(list:readonly Dossier[],place:SelectedPlace,
 action:DossierAction,now:number):Dossier[]{
 if(!Number.isFinite(now)||!Number.isFinite(place.x)||!Number.isFinite(place.z)||
   !place.id||place.id.length>160||!place.label.trim()||
   place.label.length>200)throw Error('Lieu de dossier invalide');
 const dossier:Dossier={...place,action,createdAt:now};
 const without=list.filter(d=>d.id!==place.id);
 if(without.length>=250)throw Error('Limite de 250 dossiers atteinte');
 return [dossier,...without];
}
export function validateDossiers(value:unknown):Dossier[]{
 if(value===undefined)return [];
 if(!Array.isArray(value)||value.length>250)throw Error('Liste de dossiers invalide');
 const ids=new Set<string>();
 for(const item of value){
  if(!item||typeof item!=='object')throw Error('Dossier corrompu');
  const d=item as Partial<Dossier>;
  if(typeof d.id!=='string'||!d.id||d.id.length>160||
    typeof d.label!=='string'||!d.label.trim()||d.label.length>200||
    !['voirie','batiment','lieu'].includes(d.kind??'')||
    !['observer','prioriser','ouvrir'].includes(d.action??'')||
    !Number.isFinite(d.x)||!Number.isFinite(d.z)||
    !Number.isFinite(d.createdAt)||ids.has(d.id))throw Error('Dossier invalide');
  ids.add(d.id);
 }
 return value as Dossier[];
}
