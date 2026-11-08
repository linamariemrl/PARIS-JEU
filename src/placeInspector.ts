import type {Building} from './types';
import {terrainAltitude} from './terrain';
import type {SurfaceTileManager} from './surfaceTiles';
import {CENTER} from './geo';

interface Monument {
 ref:string;x:number;z:number;name:string;category?:string;currentUse?:string;
 address?:string;protection?:string;date?:string;author?:string;
 materials?:string;roof?:string;description?:string;sourceUrl:string;
}
interface MonumentDocument{schema:number;count:number;records:Monument[];}
type SurfaceInfo=ReturnType<SurfaceTileManager['identify']>;

const X_SCALE=111320*Math.cos(CENTER[1]*Math.PI/180);
const Z_SCALE=111132;
export function coordsOf(x:number,z:number){
 return {lon:CENTER[0]+x/X_SCALE,lat:CENTER[1]+z/Z_SCALE};
}
export function centerOfBuilding(b:Building):{x:number;z:number}|null{
 const ring=b.polygons[0]?.[0];if(!ring?.length)return null;
 let minX=Infinity,minZ=Infinity,maxX=-Infinity,maxZ=-Infinity;
 for(const item of ring){
  const x=b.localCoordinates?item[0]:(item[0]-CENTER[0])*X_SCALE;
  const z=b.localCoordinates?item[1]:(item[1]-CENTER[1])*Z_SCALE;
  minX=Math.min(minX,x);maxX=Math.max(maxX,x);
  minZ=Math.min(minZ,z);maxZ=Math.max(maxZ,z);
 }
 return Number.isFinite(minX)?{x:(minX+maxX)/2,z:(minZ+maxZ)/2}:null;
}
function safeUrl(input:string):string|null{
 try{
  const url=new URL(input);
  if(url.protocol==='https:'&&
     (url.hostname==='pop.culture.gouv.fr'||
      url.hostname==='data.geopf.fr'))return url.href;
 }catch{}
 return null;
}
function row(root:HTMLElement,label:string,value:unknown){
 if(typeof value!=='string'||!value.trim())return;
 const p=document.createElement('p');
 const term=document.createElement('strong');
 term.textContent=label+' : ';
 p.append(term,document.createTextNode(value.trim()));
 root.append(p);
}
function source(root:HTMLElement,title:string,url:string){
 const href=safeUrl(url);
 if(!href)return;
 const p=document.createElement('p');
 const a=document.createElement('a');
 a.href=href;a.target='_blank';a.rel='noopener noreferrer';
 a.textContent=title;
 p.append(a);root.append(p);
}
/** Metadonnées liées à un clic uniquement, et non à chaque frame.
 * Une notice de monument = point publié par le ministère, pas preuve que
 * toute l'emprise d'un bâtiment voisin soit protégée.
 * Une adresse inverse = adresse la plus proche, non adresse cadastrale.
 */
export class PlaceInspector{
 private monuments:Monument[]=[];
 private current=0;
 constructor(private readonly target:HTMLElement){}
 async init():Promise<void>{
  try{
   const response=await fetch(import.meta.env.BASE_URL+
     'data/metropole/places/monuments.json');
   if(!response.ok)return;
   const result=await response.json() as MonumentDocument;
   if(result.schema!==1||result.count!==result.records?.length||
      result.records.length<100)return;
   this.monuments=result.records;
  }catch(error){console.warn('Atlas des monuments indisponible',error);}
 }
 begin(){this.current++;this.target.replaceChildren();return this.current;}
 fill(x:number,z:number,kind:SurfaceInfo,building:Building|null,
      token:number):void{
  if(token!==this.current)return;
  const [label,kindSource]=kind?[kind.label,kind.source]:
    ['Lieu de la carte','Carte 3D et limites territoriales'];
  const title=document.createElement('h3');
  title.textContent=building?'Données complémentaires du bâtiment':label;
  this.target.append(title);
  const coords=coordsOf(x,z);
  row(this.target,'Position',coords.lat.toFixed(6)+'° N, '+
    coords.lon.toFixed(6)+'° E');
  const altitude=terrainAltitude(x,z);
  row(this.target,'Altitude du terrain',altitude===null?
    'IGN non disponible pour ce point':
    altitude.toFixed(1)+' m (MNT RGE ALTI interpolé, maille 200 m)');
  if(kind){
   row(this.target,'Emprise de surface',kind.label);
   row(this.target,'Source géographique',kindSource);
   if(kind.kind==='road')
    row(this.target,'Matériau du sol','Non documenté par le PVP : la couleur de la chaussée est illustrative');
   if(kind.kind==='managed'||kind.kind==='planted'||kind.kind==='wood')
    row(this.target,'Revêtement exact','L’emprise ne précise pas les chemins, pelouses ni plantations internes');
  }
  row(this.target,'Périmètre des données',
    building?'Emprise cadastrale/IGN du bâtiment sélectionné':
    'Point choisi dans le modèle 3D');
  const close=this.monuments.map(item=>({
      ...item,distance:Math.hypot(item.x-x,item.z-z)
    })).filter(item=>item.distance<=50)
    .sort((a,b)=>a.distance-b.distance).slice(0,2);
  for(const item of close){
    const group=document.createElement('section');
    group.className='monument-notice';
    row(group,'Notice monument historique à proximité',item.name);
    row(group,'Distance du point',item.distance.toFixed(0)+' m (précision de localisation variable)');
    row(group,'Dénomination',item.category??'');
    row(group,'Destination déclarée',item.currentUse??'');
    row(group,'Adresse de la notice',item.address??'');
    row(group,'Protection',item.protection??'');
    row(group,'Datation',item.date??'');
    row(group,'Auteur / architecte',item.author??'');
    row(group,'Gros œuvre',item.materials??'');
    row(group,'Couverture',item.roof??'');
    row(group,'Description patrimoniale',item.description??'');
    row(group,'Référence Mérimée',item.ref);
    source(group,'Consulter la notice officielle',item.sourceUrl);
    row(group,'Précaution',
      'Localisation de la notice : son rattachement exact à l’emprise cliquée nécessite confirmation');
    this.target.append(group);
  }
  void this.reverseAddress(coords.lon,coords.lat,token);
  void this.reversePOI(coords.lon,coords.lat,token);
 }
 /** Les POI BD TOPO incluent parfois les équipements, services publics,
  * musées et lieux nommés, au-delà du seul patrimoine protégé.
  * Une présence voisine ne vaut pas certitude sur l'occupation du bâti.
  */
 private async reversePOI(lon:number,lat:number,token:number):Promise<void>{
   try{
     const url='https://data.geopf.fr/geocodage/reverse?lon='+
      lon.toFixed(7)+'&lat='+lat.toFixed(7)+'&index=poi&limit=4';
     const result=await fetch(url);
     if(!result.ok)return;
     const json=await result.json() as {features?:Array<{
       geometry?:{coordinates?:number[]};
       properties?:Record<string,unknown>;
     }>};
     if(token!==this.current)return;
     for(const feature of (json.features??[]).slice(0,3)){
       const position=feature.geometry?.coordinates;
       if(!position||position.length<2)continue;
       const dist=Math.hypot((position[0]-lon)*X_SCALE,
         (position[1]-lat)*Z_SCALE);
       if(!Number.isFinite(dist)||dist>65)continue;
       const p=feature.properties??{};
       const label=p.label??p.name??p.toponym;
       if(typeof label!=='string'||!label.trim())continue;
       const type=p.type??p.classification;
       row(this.target,'Lieu nommé / équipement IGN à proximité',
         label+' ('+Math.round(dist)+' m ; point POI, attribution au bâtiment non certifiée)');
       if(typeof type==='string')row(this.target,'Catégorie POI',type);
     }
   }catch(error){
     console.warn('Index POI IGN momentanément inaccessible',error);
   }
 }
 private async reverseAddress(lon:number,lat:number,token:number){
   try{
    const url='https://data.geopf.fr/geocodage/reverse?lon='+
      lon.toFixed(7)+'&lat='+lat.toFixed(7)+'&index=address&limit=1';
    const controller=new AbortController();
    const response=await fetch(url,{signal:controller.signal});
    if(!response.ok)return;
    const result=await response.json() as {features?:Array<{
      geometry:{type:string;coordinates:number[]};
      properties:Record<string,unknown>;
    }>};
    if(token!==this.current)return;
    const first=result.features?.[0];if(!first)return;
    const candidate=first.geometry.coordinates;
    const dx=(candidate[0]-lon)*X_SCALE,dz=(candidate[1]-lat)*Z_SCALE;
    const distance=Math.hypot(dx,dz);
    if(!Number.isFinite(distance)||distance>160)return;
    const text=first.properties.label;
    if(typeof text!=='string')return;
    row(this.target,'Adresse BAN la plus proche',
      text+' (à '+Math.round(distance)+' m ; non garantie comme adresse du bâtiment)');
    source(this.target,'Source : Géoplateforme/BAN',
      'https://data.geopf.fr/geocodage/reverse');
   }catch(error){
    console.warn('Géocodage inverse facultatif',error);
   }
 }
}
