import {IndicatorStore} from '../indicatorStore';

type Kind='trees'|'green'|'water'|'roads';
type Manifest={schema:number;count:number;source?:string;sourceUrl?:string;extractedAt?:string};
export interface EnvironmentSnapshot{
 trees:number|null;green:number|null;water:number|null;roads:number|null;
 lastSourceUpdate:string|null;
}
const sources:Record<Kind,string>={
 trees:'data/metropole/trees/manifest.json',
 green:'data/metropole/surfaces/green.json',
 water:'data/metropole/surfaces/water.json',
 roads:'data/metropole/surfaces/roads.json'
};
/** Indicateurs d'inventaire géographique, jamais des dépenses ou des
 * mesures de biodiversité interpolées. Les archives restent datées de leur
 * extraction, et ne changent pas lorsque l'horloge du jeu avance.
 */
export class EnvironmentModule{
 readonly id='environnement';
 snapshot:EnvironmentSnapshot={
  trees:null,green:null,water:null,roads:null,lastSourceUpdate:null
 };
 constructor(private readonly store:IndicatorStore){}
 async load(base:string):Promise<void>{
  const items=await Promise.allSettled(
   (Object.keys(sources) as Kind[]).map(async kind=>{
     const response=await fetch(base+sources[kind]);
     if(!response.ok)throw Error('Inventaire non publié : '+kind);
     const data=await response.json() as Manifest;
     if(data.schema!==1||!Number.isInteger(data.count)||data.count<0)
       throw Error('Inventaire invalide : '+kind);
     return {kind,data};
   })
  );
  let newest=0;
  for(const result of items){
   if(result.status!=='fulfilled')continue;
   const {kind,data}=result.value;
   const asOf=Date.parse(data.extractedAt??'');
   const when=Number.isFinite(asOf)?asOf:Date.now();
   newest=Math.max(newest,when);
   this.snapshot[kind]=data.count;
   this.store.put({
     key:'inventaire.'+kind,level:'metropole',
     spatialId:'PARIS-ET-COMMUNES-LIMITROPHES',
     value:data.count,unit:'count',asOf:when,
     provenance:'official',source:data.sourceUrl
   });
  }
  // Le pilote 4e est dédoublonné lors de l'extraction des autres arbres.
  try{
   const response=await fetch(base+'data/4e/trees.json');
   if(response.ok){
    const data=await response.json() as Manifest;
    if(data.schema===1&&data.count>=100){
     if(this.snapshot.trees!==null)this.snapshot.trees+=data.count;
     const asOf=Date.parse(data.extractedAt??'');
     this.store.put({
      key:'inventaire.arbres.4e',level:'arrondissement',spatialId:'75104',
      value:data.count,unit:'count',
      asOf:Number.isFinite(asOf)?asOf:Date.now(),
      provenance:'official',source:data.sourceUrl
     });
    }
   }
  }catch{/* absence du pilote : conserver les chiffres déjà vérifiés */}
  if(newest)this.snapshot.lastSourceUpdate=new Date(newest).toISOString();
 }
}
