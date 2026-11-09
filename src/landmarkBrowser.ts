import type {HeritageAtlas} from './heritageAtlas';
import type {HeritageRole} from './heritageCategories';

interface CatalogEntry{
 name:string;role:HeritageRole;sourceUrl:string;
 priority:string;match:string;ref?:string;
}
interface CatalogDocument{
 schema:number;linked:CatalogEntry[];pending:CatalogEntry[];
}
const color:Record<HeritageRole,string>={
 political:'#eac49f',touristic:'#ded0b9',
 cultural:'#c8b9df',financial:'#b3cce3'
};
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
 private loading:Promise<void>|null=null;
 private visible=30;
 private filter='';
 private role='';
 private openState=false;
 constructor(private readonly atlas:HeritageAtlas,
   private readonly goTo:(ref:string,x:number,z:number)=>void){
  $('landmark-open').addEventListener('click',()=>void this.open());
  $('landmark-close').addEventListener('click',()=>this.close());
  $('landmark-search').addEventListener('input',event=>{
   this.filter=(event.target as HTMLInputElement).value.trim().toLocaleLowerCase('fr');
   this.visible=30;this.render();
  });
  $('landmark-category').addEventListener('change',event=>{
   this.role=(event.target as HTMLSelectElement).value;
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
  }catch(e){
   console.warn('Inventaire des monuments indisponible',e);
   $('landmark-status').textContent='Inventaire temporairement inaccessible.';
  }
 }
 private render():void{
  const root=$('landmark-list');
  root.replaceChildren();
  if(!this.catalog)return;
  const entries=[...this.catalog.linked,...this.catalog.pending]
   .filter(item=>(!this.role||item.role===this.role)&&
     (!this.filter||item.name.toLocaleLowerCase('fr').includes(this.filter)));
  $('landmark-status').textContent=entries.length+' édifices recensés, '+
    this.catalog.linked.length+' notices POP vérifiées dans le jeu. '+
    'Seuls les édifices identifiés par une emprise peuvent être colorés.';
  for(const item of entries.slice(0,this.visible)){
   const row=document.createElement('div');row.className='landmark-entry';
   const dot=document.createElement('span');dot.className='landmark-dot';
   dot.style.backgroundColor=color[item.role];
   const content=document.createElement('div');content.className='landmark-text';
   const name=document.createElement('strong');name.textContent=item.name;
   const kind=document.createElement('small');
   kind.textContent=roleName[item.role]+(item.ref?' · POP '+item.ref:
     ' · emprise à confirmer');
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
