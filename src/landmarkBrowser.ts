import type {HeritageAtlas} from './heritageAtlas';
import type {HeritageRole} from './heritageCategories';
import type {ArchitectureDossiers} from './architectureDossiers';

interface CatalogEntry{
 name:string;role?:HeritageRole;sourceUrl:string;arrondissement?:number;
 priority:string;match:string;ref?:string;
}
interface CatalogDocument{
 schema:number;linked:CatalogEntry[];pending:CatalogEntry[];
}
interface ParisIndex{
 schema:1;includedCount:number;entries:Array<[string,number,string]>;
}
const MAJOR_BEIGE='#ded0b9';
const NEUTRAL_GREY='#bcbcbc';
const fold=(s:string)=>s.toLocaleLowerCase('fr').normalize('NFD')
 .replace(/[\u0300-\u036f]/g,'');
const roleName:Record<HeritageRole,string>={
 political:'Politique',touristic:'Touristique',
 cultural:'Culturel',financial:'Économique'
};
const $=<T extends HTMLElement>(id:string)=>document.getElementById(id) as T;
const trusted=(value:string):string|null=>{
 try{
  const u=new URL(value);
  if(u.protocol!=='https:')return null;
  if(['pop.culture.gouv.fr','paris.fr','cdn.paris.fr',
    'parisjetaime.com','assemblee-nationale.fr','senat.fr','bnf.fr',
    'economie.gouv.fr'].some(host=>u.hostname===host||
    u.hostname.endsWith('.'+host)))return u.href;
 }catch{/* Lien non approuvé */}
 return null;
};
/** Index consultable sur demande ; aucun objet WebGL ou requête
 * n'est déclenché pendant les images de la maquette.
 */
export class LandmarkBrowser{
 private catalog:CatalogDocument|null=null;
 private extraNotices:CatalogEntry[]=[];
 private parisCount=0;
 private loading:Promise<void>|null=null;
 private visible=30;
 private filter='';
 private role='';
 private arrondissement=0;
 private openState=false;
 constructor(private readonly atlas:HeritageAtlas,
   private readonly goTo:(ref:string,x:number,z:number)=>void,
   private readonly architecture?:ArchitectureDossiers){
  $('landmark-open').addEventListener('click',()=>void this.open());
  $('landmark-close').addEventListener('click',()=>this.close());
  $('landmark-search').addEventListener('input',event=>{
   this.filter=fold((event.target as HTMLInputElement).value.trim());
   this.visible=30;this.render();
  });
  $('landmark-category').addEventListener('change',event=>{
   this.role=(event.target as HTMLSelectElement).value;
   this.visible=30;this.render();
  });
  $('landmark-arrondissement').addEventListener('change',event=>{
   this.arrondissement=Number((event.target as HTMLSelectElement).value)||0;
   this.visible=30;this.render();
  });
  $('landmark-more').addEventListener('click',()=>{
   this.visible+=30;this.render();
  });
 }
 private async open():Promise<void>{
  this.openState=true;
  $('landmark-panel').classList.remove('hidden');
  if(!this.catalog){
   if(!this.loading)this.loading=this.load();
   await this.loading;
  }
  this.render();
 }
 close():void{
  this.openState=false;
  $('landmark-panel').classList.add('hidden');
 }
 refresh():void{if(this.openState)this.render();}
 private async load():Promise<void>{
  try{
   const response=await fetch(import.meta.env.BASE_URL+
     'data/metropole/places/landmark-catalog.json');
   if(!response.ok)throw Error('Inventaire non publié');
   const data=await response.json() as CatalogDocument;
   if(data.schema!==1||!Array.isArray(data.linked)||
      !Array.isArray(data.pending)||data.linked.length<100)
     throw Error('Inventaire incomplet');
   this.catalog=data;
   // Corpus complémentaire limité géographiquement aux vingt arrondissements.
   try{
    const response=await fetch(import.meta.env.BASE_URL+
      'data/metropole/places/monuments-paris-index.json');
    if(!response.ok)throw Error('Index des arrondissements absent');
    const idx=await response.json() as ParisIndex;
    if(idx.schema!==1||!Array.isArray(idx.entries)||
       idx.entries.length!==idx.includedCount)
      throw Error('Index géographique incomplet');
    const arrondissementByRef=new Map(idx.entries.map(
      ([ref,arr])=>[ref,arr] as const));
    for(const item of data.linked){
      if(item.ref)item.arrondissement=arrondissementByRef.get(item.ref);
    }
    const major=new Set(data.linked.map(e=>e.ref));
    this.extraNotices=idx.entries.filter(([ref])=>!major.has(ref))
      .map(([ref,arrondissement,name])=>({
        ref,name,arrondissement,priority:'documenté',
        match:'point-POP-localisé',
        sourceUrl:'https://pop.culture.gouv.fr/notice/merimee/'+ref
      }));
    this.parisCount=idx.includedCount;
   }catch(e){console.warn('Index du patrimoine parisien indisponible',e);}

  }catch(e){
   console.warn('Inventaire des monuments indisponible',e);
   $('landmark-status').textContent='Inventaire temporairement inaccessible.';
  }
 }
 private render():void{
  const root=$('landmark-list');
  root.replaceChildren();
  if(!this.catalog)return;
  const entries=[...this.catalog.linked,...this.catalog.pending,...this.extraNotices]
   .filter(item=>(!this.role||item.role===this.role)&&
     (!this.arrondissement||item.arrondissement===this.arrondissement)&&
     (!this.filter||fold(item.name).includes(this.filter)));
  $('landmark-status').textContent=entries.length+' résultats · '+
    this.parisCount+' notices POP dans les vingt arrondissements · '+
    this.catalog.linked.length+' majeures POP · '+
    this.catalog.pending.length+' lieux prioritaires non appariés. '+
    'Les points POP ne certifient pas les emprises IGN.';
  for(const item of entries.slice(0,this.visible)){
   const row=document.createElement('div');row.className='landmark-entry';
   const dot=document.createElement('span');dot.className='landmark-dot';
   dot.style.backgroundColor=item.priority==='majeur'?MAJOR_BEIGE:NEUTRAL_GREY;
   const content=document.createElement('div');content.className='landmark-text';
   const name=document.createElement('strong');name.textContent=item.name;
   const kind=document.createElement('small');
   kind.textContent=(item.role?roleName[item.role]:'Patrimoine documenté')+
     (item.arrondissement?' · '+item.arrondissement+'e arr.':'')+
     (item.ref?' · POP '+item.ref:' · emprise à confirmer');
   const dossier=this.architecture?.forReference(item.ref);
   if(dossier?.documents.length)
    kind.textContent+=' · '+dossier.documents.length+' documents architecturaux';
   content.append(name,kind);
   const url=trusted(item.sourceUrl);
   if(url){
    const link=document.createElement('a');
    link.href=url;link.target='_blank';link.rel='noopener noreferrer';
    link.textContent='Source officielle ou institutionnelle';
    content.append(link);
   }
   row.append(dot,content);
   const notice=item.ref?this.atlas.priorityNotice(item.ref):null;
   if(notice){
    const button=document.createElement('button');
    button.type='button';button.textContent='Voir';
    button.setAttribute('aria-label','Voir '+item.name+' dans Paris');
    button.addEventListener('click',()=>{
      this.close();this.goTo(item.ref!,notice.x,notice.z);
    });
    row.append(button);
   }
   root.append(row);
  }
  const more=$('landmark-more');
  more.classList.toggle('hidden',entries.length<=this.visible);
  more.textContent='Afficher davantage ('+Math.max(0,entries.length-this.visible)+')';
 }
}
