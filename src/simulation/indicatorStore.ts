/** Indicateurs partagés par module, par unité spatiale et provenance.
 * Identifiants IRIS/îlots ne seront ajoutés qu'après import de référentiels
 * officiels, pour ne pas confondre ces découpages.
 */
export type SpatialLevel='paris'|'arrondissement'|'quartier'|'ilot'|'commune';
export type Provenance='official'|'derived'|'estimated'|'simulated';
export interface Indicator{
  key:string;level:SpatialLevel;spatialId:string;value:number;
  unit:'EUR'|'persons'|'count'|'percent'|'km'|'tonnes';
  asOf:number;provenance:Provenance;source?:string;
}
export class IndicatorStore{
  private store=new Map<string,Indicator>();
  private id(level:SpatialLevel,spatialId:string,key:string){
    return level+':'+spatialId+':'+key;
  }
  put(item:Indicator){
    if(!Number.isFinite(item.value)||!item.key||!item.spatialId)
      throw new Error('Indicateur invalide');
    this.store.set(this.id(item.level,item.spatialId,item.key),{...item});
  }
  read(level:SpatialLevel,spatialId:string,key:string):Indicator|undefined{
    const found=this.store.get(this.id(level,spatialId,key));
    return found?{...found}:undefined;
  }
  list():Indicator[]{return [...this.store.values()].map(x=>({...x}));}
  restore(entries:Indicator[]){
    this.store.clear();
    for(const entry of entries)this.put(entry);
  }
}
