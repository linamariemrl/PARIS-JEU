import type {FinancePlan} from './modules/finances';
import type {Indicator} from './indicatorStore';

export const SAVE_SCHEMA=1;
export interface GameSave {
 schema:1;name:string;createdAt:string;updatedAt:string;
 gameTimestamp:number;timeRate:0|1|10|60;
 plan:FinancePlan;
 indicators:Indicator[];
}
interface DbSave{slot:string;save:GameSave}
const DB_NAME='paris-ville-saves-v1',STORE='games';
function open():Promise<IDBDatabase>{
 return new Promise((resolve,reject)=>{
  const request=indexedDB.open(DB_NAME,1);
  request.onupgradeneeded=()=>request.result.createObjectStore(STORE,{keyPath:'slot'});
  request.onsuccess=()=>resolve(request.result);
  request.onerror=()=>reject(request.error);
 });
}
async function transaction<T>(
 action:(store:IDBObjectStore,finish:(v:T)=>void,reject:(e:unknown)=>void)=>void,
 mode:IDBTransactionMode='readonly'):Promise<T>{
 const db=await open();
 try{
  return await new Promise<T>((resolve,reject)=>{
    const tx=db.transaction(STORE,mode);
    const store=tx.objectStore(STORE);
    let result:T;
    let collected=false;
    const done=(v:T)=>{result=v;collected=true;};
    action(store,done,reject);
    tx.oncomplete=()=>collected?resolve(result):reject(Error('Opération non terminée'));
    tx.onerror=()=>reject(tx.error);
    tx.onabort=()=>reject(tx.error);
  });
 }finally{db.close();}
}
/** Vérification stricte des imports, avant toute insertion IndexedDB.
 * Les anciennes sauvegardes schema 1 restent compatibles.
 */
export function validateSave(value:unknown):GameSave{
 if(!value||typeof value!=='object')throw Error('Sauvegarde invalide');
 const x=value as Partial<GameSave>;
 const plan=x.plan;
 if(x.schema!==SAVE_SCHEMA||!plan||typeof plan!=='object'||
    !Array.isArray(plan.decisions)||!Array.isArray(x.indicators)||
    !Number.isFinite(x.gameTimestamp)||![0,1,10,60].includes(x.timeRate as number))
   throw Error('Sauvegarde incompatible ou incomplète');
 const lower=Date.UTC(1900,0,1),upper=Date.UTC(2500,0,1);
 if((x.gameTimestamp as number)<lower||(x.gameTimestamp as number)>upper)
   throw Error('Date de simulation hors limites');
 if(typeof x.name!=='string'||!x.name.trim()||x.name.length>80||
    !Number.isFinite(Date.parse(x.createdAt??''))||
    !Number.isFinite(Date.parse(x.updatedAt??''))||
    x.indicators.length>50000||plan.decisions.length>100)
   throw Error('Sauvegarde trop volumineuse ou corrompue');
 for(const n of [plan.operatingExpenseChangePct,
   plan.capitalExpenseChangePct,plan.projectedBorrowingEUR]){
   if(typeof n!=='number'||!Number.isFinite(n))
     throw Error('Montants de scénario invalides');
 }
 for(const indicator of x.indicators){
   if(!indicator||typeof indicator.key!=='string'||typeof indicator.spatialId!=='string'||
      !Number.isFinite(indicator.value)||!Number.isFinite(indicator.asOf))
      throw Error('Indicateur de sauvegarde corrompu');
 }
 return x as GameSave;
}
export class SaveStore{
 async list():Promise<DbSave[]>{
  return transaction<DbSave[]>((store,done,reject)=>{
    const req=store.getAll();
    req.onsuccess=()=>done(req.result as DbSave[]);
    req.onerror=()=>reject(req.error);
  });
 }
 async put(slot:string,save:GameSave){
  if(slot.length>50)throw Error('Nom de case trop long');
  validateSave(save);
  await transaction<void>((store,done,reject)=>{
    const req=store.put({slot,save});
    req.onsuccess=()=>done();
    req.onerror=()=>reject(req.error);
  },'readwrite');
 }
 async get(slot:string):Promise<GameSave|null>{
  return transaction<GameSave|null>((store,done,reject)=>{
    const req=store.get(slot);
    req.onsuccess=()=>done((req.result as DbSave|undefined)?.save??null);
    req.onerror=()=>reject(req.error);
  });
 }
 async remove(slot:string){
  await transaction<void>((store,done,reject)=>{
    const req=store.delete(slot);
    req.onsuccess=()=>done();
    req.onerror=()=>reject(req.error);
  },'readwrite');
 }
}
