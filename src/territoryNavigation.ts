import {project} from './geo';
import type {MobileCamera} from './mobileCamera';

interface Region {
 properties:{kind:string;id:string;name:string;number?:number};
 geometry:{type:'Polygon'|'MultiPolygon';coordinates:unknown};
}

/** Navigation par limites territoriales réelles publiées dans le jeu.
 * Les bois restent des points-repères approximatifs, non des contours
 * inventés. Aucun appel de géocodage externe n'est nécessaire.
 */
export async function installTerritoryNavigation(
 camera:MobileCamera,onMove:()=>void
):Promise<void>{
 const select=document.getElementById('territory-jump') as HTMLSelectElement|null;
 if(!select)return;
 const options=new Map<string,{x:number;z:number;radius:number}>();
 const add=(parent:HTMLOptGroupElement,key:string,label:string,
            lon:number,lat:number,radius:number)=>{
  const coord=project([lon,lat]);
  options.set(key,{...coord,radius});
  const option=document.createElement('option');
  option.value=key;option.textContent=label;
  parent.append(option);
 };
 const paris=document.createElement('optgroup');
 paris.label='Vue d’ensemble';
 const arr=document.createElement('optgroup');
 arr.label='Paris · 20 arrondissements';
 const others=document.createElement('optgroup');
 others.label='29 communes limitrophes';
 add(paris,'paris','Paris et alentours · vue générale',2.3537,48.8545,20500);
 // Repères cartographiques, sans prétendre restituer les bois au centimètre.
 add(paris,'boulogne','Bois de Boulogne · repère',2.249,48.863,2300);
 add(paris,'vincennes','Bois de Vincennes · repère',2.434,48.831,2300);
 try{
  const response=await fetch(import.meta.env.BASE_URL+'data/metropole/limits.geojson');
  if(!response.ok)throw Error('Limites non disponibles');
  const data=await response.json() as {type:string;features:Region[]};
  if(data.type!=='FeatureCollection')throw Error('Limites incorrectes');
  const regions=data.features.filter(f=>f.geometry&&
   (f.properties.kind==='arrondissement'||f.properties.kind==='commune_limitrophe'));
  if(regions.filter(f=>f.properties.kind==='arrondissement').length!==20)
   throw Error('Arrondissements incomplets');
  for(const region of regions){
   const coordinates=region.geometry.coordinates;
   const polygons=region.geometry.type==='Polygon'?
    [coordinates]:region.geometry.type==='MultiPolygon'?coordinates:[];
   if(!Array.isArray(polygons))continue;
   const values:number[][]=[];
   for(const polygon of polygons){
    if(!Array.isArray(polygon)||!Array.isArray(polygon[0]))continue;
    for(const point of polygon[0]){
     if(Array.isArray(point)&&typeof point[0]==='number'&&
        typeof point[1]==='number')values.push([point[0],point[1]]);
    }
   }
   if(!values.length)continue;
   const longitude=(Math.min(...values.map(x=>x[0]))+
                    Math.max(...values.map(x=>x[0])))/2;
   const latitude=(Math.min(...values.map(x=>x[1]))+
                   Math.max(...values.map(x=>x[1])))/2;
   const kind=region.properties.kind;
   add(kind==='arrondissement'?arr:others,
     region.properties.id,region.properties.name,
     longitude,latitude,kind==='arrondissement'?1250:1750);
  }
  select.append(paris,arr,others);
  select.addEventListener('change',()=>{
   const target=options.get(select.value);
   select.value='';
   if(!target)return;
   camera.flyTo(target.x,target.z,target.radius);
   onMove();
  });
 }catch(error){
  console.warn('Navigation territoriale non disponible',error);
  select.append(paris);
  select.addEventListener('change',()=>{
   const target=options.get(select.value);select.value='';
   if(target){camera.flyTo(target.x,target.z,target.radius);onMove();}
  });
 }
}
