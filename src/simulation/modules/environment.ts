import {IndicatorStore} from '../indicatorStore';

type Kind='trees'|'green'|'water'|'roads';
interface TreeManifest{
  schema:number;count:number;source?:string;sourceUrl?:string;extractedAt?:string;
}
interface SurfaceManifest{
  schema:number;sourceCounts?:Record<string,number>;
}
export interface EnvironmentSnapshot{
  trees:number|null;green:number|null;water:number|null;roads:number|null;
  lastSourceUpdate:string|null;
}
const SOURCES:Record<Kind,string>={
  trees:'https://opendata.paris.fr/explore/dataset/les-arbres/',
  green:'https://opendata.paris.fr/explore/dataset/espaces_verts/',
  water:'https://geoservices.ign.fr/bdtopo',
  roads:'https://opendata.paris.fr/explore/dataset/plan-de-voirie-chaussees/'
};
/** Chargement de deux index légers UNIQUEMENT, jamais des dizaines de
 * milliers de polygones depuis le panneau de finances. Les inventaires
 * restent accessibles pendant le mode graphique stable 0.20.
 */
export class EnvironmentModule{
  readonly id='environnement';
  snapshot:EnvironmentSnapshot={
    trees:null,green:null,water:null,roads:null,lastSourceUpdate:null
  };
  constructor(private readonly store:IndicatorStore){}
  async load(base:string):Promise<void>{
    const [treesResult,surfacesResult]=await Promise.allSettled([
      fetch(base+'data/metropole/trees/manifest.json'),
      fetch(base+'data/metropole/surfaces/tiles/manifest.json')
    ]);
    const values:Partial<Record<Kind,number>>={};
    let asOf=Date.now();
    if(treesResult.status==='fulfilled'&&treesResult.value.ok){
      try{
        const index=await treesResult.value.json() as TreeManifest;
        if(index.schema===1&&Number.isInteger(index.count)&&index.count>=50000){
          values.trees=index.count;
          const date=Date.parse(index.extractedAt??'');
          if(Number.isFinite(date))asOf=date;
        }
      }catch(error){console.warn('Inventaire arbres',error);}
    }
    if(surfacesResult.status==='fulfilled'&&surfacesResult.value.ok){
      try{
        const index=await surfacesResult.value.json() as SurfaceManifest;
        if(index.schema===1&&index.sourceCounts){
          for(const key of ['green','water','roads'] as const){
            const n=index.sourceCounts[key];
            if(Number.isInteger(n)&&n>0)values[key]=n;
          }
        }
      }catch(error){console.warn('Inventaire surfacique',error);}
    }
    // Pilotage 4e dédoublonné lors de la préparation du manifeste arboré.
    try{
      const res=await fetch(base+'data/4e/trees.json');
      if(res.ok){
        const pilot=await res.json() as TreeManifest;
        if(pilot.schema===1&&Number.isInteger(pilot.count)&&pilot.count>100){
          if(values.trees!==undefined)values.trees+=pilot.count;
          this.store.put({
            key:'inventaire.arbres.4e',level:'arrondissement',
            spatialId:'75104',value:pilot.count,unit:'count',
            asOf,provenance:'official',source:SOURCES.trees
          });
        }
      }
    }catch(error){console.warn('Inventaire 4e non disponible',error);}
    for(const [key,value] of Object.entries(values) as [Kind,number][]){
      this.snapshot[key]=value;
      this.store.put({
        key:'inventaire.'+key,level:'metropole',
        spatialId:'PARIS-ET-COMMUNES-LIMITROPHES',
        value,unit:'count',asOf,provenance:'official',source:SOURCES[key]
      });
    }
    if(Object.keys(values).length)
      this.snapshot.lastSourceUpdate=new Date(asOf).toISOString();
  }
}
