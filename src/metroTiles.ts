import type {Mesh,Scene} from '@babylonjs/core';
import {createTile} from './buildings';
import type {MetroOverview} from './metroOverview';
import type {Building,TileFile} from './types';
const PREFIX=import.meta.env.BASE_URL+'data/metropole/buildings/';
interface Info {id:string;ix:number;iz:number;count:number;bytes:number;}
interface MetroManifest{
 schema:2;tileMeters:number;totalBuildings:number;
 buildingsStoredIn4e:number;tiles:Info[];
}
interface Loaded {meshes:Mesh[];count:number;}
/** Chargement géographique progressif; aucune tuile n'est promise si
 * l'extraction officielle n'a pas été validée par GitHub Actions.
 */
export class MetroTileManager{
  private tiles:Info[]=[];
  private active=new Map<string,Loaded>();
  private inFlight=new Set<string>();
  private wanted=new Set<string>();
  private tileMeters=800;
  private ready=false;
  private budget=10;
  private lastUpdate=0;
  private lastPointX=Infinity;
  private lastPointZ=Infinity;
  private lastRadius=Infinity;
  private expected=0;
  private failures=new Map<string,number>();
  constructor(private scene:Scene,
    private materials:ReturnType<typeof import('./buildings').createMaterials>,
    private onStatus:(status:string,count:number)=>void,
    private overview?:MetroOverview){}
  async init(){
    try{
      const response=await fetch(PREFIX+'manifest.json');
      if(!response.ok)throw Error('Extraction métropolitaine non encore publiée');
      const manifest=await response.json() as MetroManifest;
      if(manifest.schema!==2||manifest.tiles.length<50||
         manifest.totalBuildings<15000||manifest.buildingsStoredIn4e!==2696)
        throw Error('Index métropolitain incomplet, carte 4e conservée');
      if(manifest.tiles.reduce((s,t)=>s+t.count,0)!==manifest.totalBuildings)
        throw Error('Compte des tuiles non conforme');
      this.tiles=manifest.tiles;
      this.tileMeters=manifest.tileMeters;
      this.expected=manifest.totalBuildings;
      this.ready=true;
      this.report();
    }catch(e){
      console.info('Extension non activée',e);
      this.onStatus('Le 4e fonctionne; extraction des autres secteurs en préparation',0);
    }
  }
  setQuality(level:'low'|'medium'|'high'){
    this.budget=level==='low'?6:level==='high'?16:10;
    this.lastPointX=Infinity;
  }
  update(x:number,z:number,radius:number){
    if(!this.ready)return;
    const now=performance.now();
    if(now-this.lastUpdate<360)return;
    const changed=Math.hypot(x-this.lastPointX,z-this.lastPointZ)>120||
      Math.abs(radius-this.lastRadius)>300;
    // Vérifier périodiquement qu'un aperçu nouvellement disponible
    // autorise la libération d'un ancien maillage détaillé.
    if(!changed&&now-this.lastUpdate<1400)return;
    this.lastUpdate=now;this.lastPointX=x;this.lastPointZ=z;
    this.lastRadius=radius;
    // Le nombre de tuiles chargées reste borné pour Android.
    // Une vue d'ensemble devra disposer à terme d'un LOD agrégé.
    const range=Math.min(3000,Math.max(1200,radius*1.10));
    const candidates=radius>3900?[]:this.tiles.filter(t=>{
      const cx=(t.ix+.5)*this.tileMeters,cz=(t.iz+.5)*this.tileMeters;
      return Math.hypot(cx-x,cz-z)<range;
    }).sort((a,b)=>{
      const ax=(a.ix+.5)*this.tileMeters-x,az=(a.iz+.5)*this.tileMeters-z;
      const bx=(b.ix+.5)*this.tileMeters-x,bz=(b.iz+.5)*this.tileMeters-z;
      return ax*ax+az*az-bx*bx-bz*bz;
    }).slice(0,this.budget);
    this.wanted=new Set(candidates.map(t=>t.id));
    for(const [id,load] of this.active){
      if(this.wanted.has(id)||!this.overview?.hasTile(id))continue;
      // Activer l'aperçu AVANT de retirer le volume proche :
      // jamais de frame sans représentation de ce bâtiment.
      this.overview.setDetailed(id,false);
      for(const mesh of load.meshes)mesh.dispose();
      this.active.delete(id);
    }
    for(const t of candidates){
      if(this.active.has(t.id)||this.inFlight.has(t.id))continue;
      if(now-(this.failures.get(t.id)??-Infinity)<15000)continue;
      if(this.inFlight.size>=2)break;
      void this.load(t);
    }
    this.report();
  }
  private async load(info:Info){
    this.inFlight.add(info.id);
    try{
      const response=await fetch(PREFIX+'tiles/'+info.id+'.json');
      if(!response.ok)throw Error('Tuile introuvable: '+info.id);
      const data=await response.json() as TileFile;
      if(data.schema!==2||data.id!==info.id||data.buildings.length!==info.count||
        !data.localCoordinates)throw Error('Tuile métropolitaine invalide: '+info.id);
      if(!this.wanted.has(info.id))return;
      for(const b of data.buildings as Building[])b.localCoordinates=true;
      const meshes=createTile(this.scene,data,this.materials);
      this.active.set(info.id,{meshes,count:data.buildings.length});
      this.overview?.setDetailed(info.id,true);
      this.failures.delete(info.id);
    }catch(e){
      console.warn('Chargement de la tuile métropolitaine',info.id,e);
      this.failures.set(info.id,performance.now());
    }finally{
      this.inFlight.delete(info.id);
      this.lastPointX=Infinity;
      this.report();
    }
  }
  private report(){
    const count=[...this.active.values()].reduce((sum,item)=>sum+item.count,0);
    const failure=this.failures.size?
      ' / '+this.failures.size+' tuile(s) en nouvelle tentative':'';
    this.onStatus(count.toLocaleString('fr-FR')+' bâtiments voisins visibles, sur '+
      this.expected.toLocaleString('fr-FR')+' dans l’index IGN'+failure,count);
  }
}
