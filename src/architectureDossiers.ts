/** Registre public des preuves architecturales.
 * Une feuille de dessin dont les cotes ne sont pas encore transcrites ne
 * prouve AUCUNE dimension du bâtiment. Ne pas confondre taille du papier
 * et dimension de l'édifice.
 */
export interface ArchitectureSource{
 id:string;type:string;title:string;url:string;portalId:string;notes:string;
}
export interface ArchitectureMeasure{
 element:string;value:number;unit:'m';sourceId:string;precision:string;
}
export interface ArchitectureDossier{
 id:string;ref:string|null;name:string;role:string;priority:number;
 phase:string;sourceNotice:string;documents:ArchitectureSource[];
 measurements:ArchitectureMeasure[];uncertainty:string[];
 geometry:string;publicationAllowed:boolean;
}
interface ArchitecturePayload{
 schema:1;dossiers:ArchitectureDossier[];
}
const officialHosts=[
 'pop.culture.gouv.fr','bibliotheques-specialisees.paris.fr',
 'parismuseescollections.paris.fr','www.parismuseescollections.paris.fr',
 'mediatheque-patrimoine.culture.gouv.fr','archives.paris.fr',
 'gallica.bnf.fr','citedelarchitecture.fr','www.citedelarchitecture.fr',
 'geoservices.ign.fr','opendata.paris.fr','toureiffel.paris',
 'www.toureiffel.paris','paris-arc-de-triomphe.fr',
 'www.paris-arc-de-triomphe.fr'
];
function approved(url:string):string|null{
 try{
  const parsed=new URL(url);
  return parsed.protocol==='https:'&&officialHosts.includes(parsed.hostname)?
   parsed.href:null;
 }catch{return null;}
}
export class ArchitectureDossiers{
 private byRef=new Map<string,ArchitectureDossier>();
 async init():Promise<void>{
  try{
   const response=await fetch(import.meta.env.BASE_URL+
     'data/metropole/architecture/dossiers.json');
   if(!response.ok)throw Error('Dossiers non disponibles');
   const body=await response.json() as ArchitecturePayload;
   if(body.schema!==1||!Array.isArray(body.dossiers)||
      body.dossiers.length<190)throw Error('Dossiers incomplets');
   for(const d of body.dossiers){
    if(!d.ref||!/^PA\d{8}$/.test(d.ref)||
       !Array.isArray(d.documents)||!Array.isArray(d.measurements)||
       !Array.isArray(d.uncertainty))continue;
    this.byRef.set(d.ref,d);
   }
  }catch(err){console.warn('Bibliothèque architecturale indisponible',err);}
 }
 forReference(ref:string|undefined):ArchitectureDossier|null{
  return ref?this.byRef.get(ref)??null:null;
 }
 /** La publication d'une géométrie requiert une revue mesurée explicite. */
 canPublish(ref:string,sourceIds:readonly string[]):boolean{
  const d=this.forReference(ref);
  if(!d||d.publicationAllowed!==true||!sourceIds.length)return false;
  const known=new Set(d.documents.map(s=>s.id));
  return sourceIds.every(id=>known.has(id));
 }
 appendTo(target:HTMLElement,ref:string|undefined):void{
  if(!ref)return;
  const d=this.forReference(ref);
  if(!d)return;
  const section=document.createElement('details');
  section.className='architecture-provenance';
  const title=document.createElement('summary');
  title.textContent='Plans, mesures et fidélité du monument';
  section.append(title);
  const status=document.createElement('p');
  status.textContent=d.publicationAllowed?
   'Modèle métrique documenté et contrôlé, selon la fiche technique.':
   'Maquette architecturale de référence non encore validée. '+
   'Le volume IGN actuel ne restitue pas les façades, sculptures et '+
   'ornements à l’échelle exacte.';
  section.append(status);
  if(d.measurements.length){
   const measures=document.createElement('ul');
   for(const m of d.measurements.slice(0,16)){
    const source=d.documents.find(s=>s.id===m.sourceId);
    if(!source||!Number.isFinite(m.value))continue;
    const row=document.createElement('li');
    row.textContent=m.element+' : '+m.value.toLocaleString('fr-FR')+
      ' '+m.unit+' ('+m.precision+').';
    measures.append(row);
   }
   if(measures.children.length)section.append(measures);
  }
  if(d.documents.length){
   const subtitle=document.createElement('h4');
   subtitle.textContent='Documents architecturaux repérés';
   section.append(subtitle);
   const sources=document.createElement('ul');
   for(const dsource of d.documents.slice(0,18)){
    const href=approved(dsource.url);
    if(!href)continue;
    const row=document.createElement('li');
    const link=document.createElement('a');
    link.textContent=dsource.title;
    link.href=href;link.rel='noopener noreferrer';link.target='_blank';
    row.append(link);
    sources.append(row);
   }
   section.append(sources);
  }else{
   const missing=document.createElement('p');
   missing.textContent='Aucun plan coté individuel encore indexé : recherche documentaire à mener.';
   section.append(missing);
  }
  if(d.uncertainty.length){
   const missing=document.createElement('p');
   missing.textContent='À documenter : '+d.uncertainty.slice(0,3).join(' ; ')+'.';
   section.append(missing);
  }
  target.append(section);
 }
}
