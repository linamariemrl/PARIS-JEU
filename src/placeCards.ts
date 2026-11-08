import {UrbanAtlas,type UrbanResult} from './urbanAtlas';
import {coordsOf} from './placeInspector';

export type PlaceKind='building'|'road'|'square'|'garden'|'ground'|'water';
export interface PlaceInfo{kind:PlaceKind;name?:string;buildingId?:string;}
function line(parent:HTMLElement,label:string,value:string):HTMLElement{
 const p=document.createElement('p');
 const key=document.createElement('strong');key.textContent=label+' : ';
 p.append(key,document.createTextNode(value));parent.append(p);
 return p;
}
function source(parent:HTMLElement,label:string,url:string):void{
 try{
  const parsed=new URL(url);
  const origins=['paris.fr','opendata.paris.fr','archives.paris.fr',
   'parismusees.paris.fr','carnavalet.paris.fr','bnf.fr','gallica.bnf.fr'];
  if(parsed.protocol!=='https:'||!origins.some(host=>
    parsed.hostname===host||parsed.hostname.endsWith('.'+host)))return;
  const a=document.createElement('a');
  a.textContent=label;a.href=parsed.href;a.target='_blank';
  a.rel='noopener noreferrer';a.className='heritage-source';
  parent.append(a);
 }catch{/* Aucune URL inventée */}
}
/** Une fiche par clic, même pour un point sans monument.
 * Source officielle des noms si le polygone existe ; quartier par
 * emprise administrative, jamais simple distance. L'adresse issue du
 * géocodage inverse reste une adresse VOISINE, pas un numéro arbitraire.
 */
export class PlaceCards{
 private token=0;
 private addressController:AbortController|null=null;
 private addressCache=new Map<string,{value:string;distance:number}>();
 constructor(private root:HTMLElement,private atlas:UrbanAtlas){}
 close():void{
  this.token++;
  this.addressController?.abort();this.addressController=null;
 }
 show(x:number,z:number,place:PlaceInfo):{title:string;urban:UrbanResult}{
  this.close();
  const token=this.token;
  const urban=this.atlas.identify(x,z);
  const name=place.name??urban.street?.name??
    (place.kind==='building'?'Bâtiment':
    place.kind==='garden'?'Espace vert':
    place.kind==='road'?'Voie de circulation':
    place.kind==='water'?'Surface d’eau':
    'Lieu de Paris');
  const section=document.createElement('section');
  section.className='urban-game-card';
  const categories:Record<PlaceKind,string>={
   building:'Adresse / bâtiment',road:'Rue ou voie',square:'Place',
   garden:'Parc, jardin ou square',water:'Eau et paysage',
   ground:'Lieu de Paris'
  };
  line(section,'Type',categories[place.kind]);
  if(urban.quarter){
   const arr=urban.quarter.arr;
   line(section,'Quartier',''+urban.quarter.name+
    (typeof arr==='number'&&arr>=1&&arr<=20?
      ' · '+arr+'e arr.':''));
  }
  if(urban.street&&urban.street.name!==name){
   line(section,'Voie',urban.street.name);
  }
  let address:HTMLElement|null=null;
  if(place.kind==='building'||place.kind==='ground'){
   address=line(section,'Adresse','Recherche dans la base officielle…');
  }
  const specific=urban.streetHistory;
  const contextual=urban.story;
  const title=document.createElement('h3');title.textContent=
    specific?'Histoire de la voie':'Histoire du quartier';
  section.append(title);
  const history=document.createElement('p');
  history.className='urban-history';
  history.textContent=specific??
    contextual?.summary??
    'La chronique historique précise de ce secteur n’est pas encore renseignée.';
  section.append(history);
  if(specific&&urban.streetSource){
   source(section,'Source : nomenclature officielle',urban.streetSource);
  }
  if(contextual?.source){
   source(section,specific?'Contexte du quartier':'Source historique du quartier',contextual.source);
  }
  if(!this.atlas.ready){
   const small=document.createElement('small');
   small.textContent='Atlas des voies en cours de chargement : libellé non confirmé.';
   section.append(small);
  }
  this.root.replaceChildren(section);
  if(address)void this.resolveAddress(x,z,address,token);
  return {title:name,urban};
 }
 private async resolveAddress(x:number,z:number,p:HTMLElement,token:number):Promise<void>{
  const coordinates=coordsOf(x,z);
  const cacheKey=Math.round(x/5)+':'+Math.round(z/5);
  const stored=this.addressCache.get(cacheKey);
  if(stored){
   this.writeAddress(p,stored.value,stored.distance);return;
  }
  const controller=new AbortController();
  this.addressController=controller;
  const deadline=window.setTimeout(()=>controller.abort(),7000);
  try{
   const query=new URL('https://data.geopf.fr/geocodage/reverse');
   query.searchParams.set('lon',coordinates.lon.toFixed(7));
   query.searchParams.set('lat',coordinates.lat.toFixed(7));
   query.searchParams.set('index','address');
   query.searchParams.set('limit','1');
   const response=await fetch(query.href,{signal:controller.signal});
   if(!response.ok)throw Error('Géocodage indisponible');
   const body=await response.json() as {features?:Array<{
    geometry?:{coordinates?:number[]};
    properties?:{label?:string};
   }>};
   if(token!==this.token)return;
   const found=body.features?.[0];
   const coordinatesFound=found?.geometry?.coordinates;
   const label=found?.properties?.label;
   if(!coordinatesFound||coordinatesFound.length<2||
      !label||typeof label!=='string')throw Error('Adresse non attestée');
   const metersX=111320*Math.cos(48.8545*Math.PI/180),metersZ=111132;
   const distance=Math.hypot(
    (coordinatesFound[0]-coordinates.lon)*metersX,
    (coordinatesFound[1]-coordinates.lat)*metersZ);
   if(!Number.isFinite(distance)||distance>80)
    throw Error('Aucune adresse suffisamment proche');
   this.addressCache.set(cacheKey,{value:label,distance});
   while(this.addressCache.size>180){
    const oldest=this.addressCache.keys().next().value;
    if(oldest)this.addressCache.delete(oldest);else break;
   }
   this.writeAddress(p,label,distance);
  }catch(error){
   if(token!==this.token)return;
   p.textContent='';
   const strong=document.createElement('strong');
   strong.textContent='Adresse : ';
   p.append(strong,document.createTextNode(
     'Numéro exact non vérifié à cette position.'));
   if(!(error instanceof DOMException&&error.name==='AbortError'))
    console.warn('Adresse officielle au clic',error);
  }finally{
   window.clearTimeout(deadline);
   if(this.addressController===controller)this.addressController=null;
  }
 }
 private writeAddress(p:HTMLElement,label:string,distance:number):void{
  p.textContent='';
  const heading=document.createElement('strong');
  heading.textContent='Adresse la plus proche : ';
  const precision=distance<=12?
   ' (point adressé voisin ; association cadastrale non confirmée)':
   ' (à '+Math.round(distance)+' m ; association au bâtiment non garantie)';
  p.append(heading,document.createTextNode(label+precision));
 }
}
