import type {Mesh,Scene} from '@babylonjs/core';
import {createTileProgressive} from './buildings';
import type {MetroOverview} from './metroOverview';
import type {Building,TileFile} from './types';

const PREFIX=import.meta.env.BASE_URL+'data/metropole/buildings/';
interface Info {id:string;ix:number;iz:number;count:number;bytes:number;}
interface MetroManifest{
 schema:2;tileMeters:number;totalBuildings:number;
 buildingsStoredIn4e:number;tiles:Info[];
}
interface Loaded {meshes:Mesh[];count:number;lastUsed:number;}

/** Bascule monotone vers la géométrie IGN exacte :
 * - préchargement en avant de la caméra ;
 * - assemblage progressif sur plusieurs frames ;
 * - aucune disparition au dézoom/rotation ;
 * - géométrie déjà visitée conservée jusqu'à pression mémoire ;
 * - repli vers les silhouettes lorsque l'ancienne tuile est hors champ.
 */
export class MetroTileManager{
  private tiles:Info[]=[];
  private active=new Map<string,Loaded>();
  private inFlight=new Set<string>();
  private wanted=new Set<string>();
  private tileCache=new Map<string,TileFile>();
  private tileMeters=800;
  private ready=false;
  private budget=18;
  private lastUpdate=0;
  private lastPointX=Infinity;
  private lastPointZ=Infinity;
  private lastRadius=Infinity;
  private expected=0;
  private failures=new Map<string,number>();
  private lastReport='';
  constructor(private scene:Scene,
    private materials:ReturnType<typeof import('./buildings').createMaterials>,
    private onStatus:(status:string,count:number)=>void,
    private overview?:MetroOverview){}

  async init():Promise<void>{
    try{
      const response=await fetch(PREFIX+'manifest.json');
      if(!response.ok)throw Error('Extraction métropolitaine non publiée');
      const m=await response.json() as MetroManifest;
      if(m.schema!==2||m.tiles.length<50||m.totalBuildings<15000||
         m.buildingsStoredIn4e!==2696||m.tileMeters!==800)
        throw Error('Index métropolitain incomplet');
      if(m.tiles.reduce((sum,t)=>sum+t.count,0)!==m.totalBuildings)
        throw Error('Compte des bâtiments incohérent');
      this.tiles=m.tiles;
      this.expected=m.totalBuildings;
      this.ready=true;
      this.report();
    }catch(e){
      console.warn('Extension non activée',e);
      this.onStatus('Le 4e reste disponible ; extension en préparation',0);
    }
  }

  setQuality(level:'low'|'medium'|'high'):void{
    // Le budget borne les maillages EXACTS et non les bâtiments représentés.
    this.budget=level==='low'?10:level==='high'?24:18;
    this.lastPointX=Infinity;
  }

  update(x:number,z:number,radius:number):void{
    if(!this.ready)return;
    const now=performance.now();
    if(now-this.lastUpdate<230)return;
    const moved=Math.hypot(x-this.lastPointX,z-this.lastPointZ)>95||
      Math.abs(radius-this.lastRadius)>160;
    if(!moved&&now-this.lastUpdate<1600)return;
    this.lastUpdate=now;this.lastPointX=x;this.lastPointZ=z;
    this.lastRadius=radius;

    // Les grands zooms n'exigent pas de charger tous les 287k maillages
    // sur un téléphone. Dès que l'on rapproche la caméra, les emprises
    // réelles de toutes les tuiles proches prennent le relais.
    const range=Math.max(1300,Math.min(3700,radius*1.55));
    const candidates=radius>4700?[]:this.tiles.filter(t=>{
      const cx=(t.ix+.5)*this.tileMeters;
      const cz=(t.iz+.5)*this.tileMeters;
      return Math.hypot(cx-x,cz-z)<range;
    }).sort((a,b)=>{
      const ax=(a.ix+.5)*this.tileMeters-x;
      const az=(a.iz+.5)*this.tileMeters-z;
      const bx=(b.ix+.5)*this.tileMeters-x;
      const bz=(b.iz+.5)*this.tileMeters-z;
      return ax*ax+az*az-bx*bx-bz*bz;
    }).slice(0,this.budget);

    this.wanted=new Set(candidates.map(t=>t.id));
    for(const id of this.wanted){
      const current=this.active.get(id);
      if(current)current.lastUsed=now;
    }

    // Une rotation ou un dézoom ne vide JAMAIS les tuiles déjà exactes.
    // L'éviction a lieu uniquement quand de nouvelles tuiles doivent
    // être chargées ET que le budget mémoire est atteint.
    for(const tile of candidates){
      if(this.inFlight.size>=2)break;
      if(this.active.has(tile.id)||this.inFlight.has(tile.id))continue;
      if(now-(this.failures.get(tile.id)??-Infinity)<12000)continue;
      if(!this.makeRoom(x,z))break;
      void this.load(tile);
    }
    this.report();
  }

  private makeRoom(x:number,z:number):boolean{
    if(this.active.size+this.inFlight.size<this.budget)return true;
    const removable=[...this.active.entries()]
      .filter(([id])=>!this.wanted.has(id)&&
        (this.overview?.hasTile(id)??false))
      .sort((a,b)=>{
        const distance=(id:string)=>{
          const [ix,iz]=id.split('_').map(Number);
          return Math.hypot((ix+.5)*this.tileMeters-x,
            (iz+.5)*this.tileMeters-z);
        };
        return distance(b[0])-distance(a[0])||
          a[1].lastUsed-b[1].lastUsed;
      });
    if(!removable.length)return false;
    const [id,data]=removable[0];
    // Rendre la silhouette opérationnelle AVANT la suppression.
    this.overview?.setDetailed(id,false);
    for(const mesh of data.meshes)mesh.dispose();
    this.active.delete(id);
    return true;
  }

  private remember(id:string,data:TileFile):void{
    this.tileCache.delete(id);
    this.tileCache.set(id,data);
    while(this.tileCache.size>12){
      const oldest=this.tileCache.keys().next().value;
      if(!oldest)break;
      this.tileCache.delete(oldest);
    }
  }

  private async load(tile:Info):Promise<void>{
    this.inFlight.add(tile.id);
    try{
      let data=this.tileCache.get(tile.id);
      if(!data){
        const response=await fetch(PREFIX+'tiles/'+tile.id+'.json');
        if(!response.ok)throw Error('Tuile absente : '+tile.id);
        data=await response.json() as TileFile;
        if(data.schema!==2||data.id!==tile.id||
          data.buildings.length!==tile.count||!data.localCoordinates)
          throw Error('Tuile IGN invalide : '+tile.id);
        for(const building of data.buildings as Building[])
          building.localCoordinates=true;
        this.remember(tile.id,data);
      }
      if(!this.wanted.has(tile.id))return;
      const meshes=await createTileProgressive(
        this.scene,data,this.materials,()=>this.wanted.has(tile.id)
      );
      if(!meshes.length)return;
      if(!this.wanted.has(tile.id)){
        for(const mesh of meshes)mesh.dispose();
        return;
      }
      this.active.set(tile.id,{
        meshes,count:data.buildings.length,lastUsed:performance.now()
      });
      // Substitution atomique : aucun état intermédiaire sans bâtiment.
      this.overview?.setDetailed(tile.id,true);
      this.failures.delete(tile.id);
    }catch(error){
      console.warn('Tuile 3D métropolitaine',tile.id,error);
      this.failures.set(tile.id,performance.now());
    }finally{
      this.inFlight.delete(tile.id);
      this.lastPointX=Infinity;
      this.report();
    }
  }

  private report():void{
    const exact=[...this.active.values()].reduce((n,v)=>n+v.count,0);
    const notice=exact.toLocaleString('fr-FR')+
      ' bâtiments en géométrie IGN exacte / '+
      this.expected.toLocaleString('fr-FR')+' répertoriés'+
      (this.inFlight.size?' · chargement de '+this.inFlight.size+' secteur(s)':'')+
      (this.failures.size?' · '+this.failures.size+' nouvelle(s) tentative(s)':'');
    if(notice===this.lastReport)return;
    this.lastReport=notice;
    this.onStatus(notice,exact);
  }
}
