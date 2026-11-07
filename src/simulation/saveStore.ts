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
export function validateSave(value:unknown):GameSave{
 const x=value as Partial<GameSave>;
 if(!x||x.schema!==SAVE_SCHEMA||!x.plan||!Array.isArray(x.indicators)||
    !Number.isFinite(x.gameTimestamp)||![0,1,10,60].includes(x.timeRate as number))
   throw Error('Sauvegarde incompatible ou incomplète');
 if(typeof x.name!=='string'||x.name.length>80||
    x.indicators.length>50000||x.plan.decisions.length>100)
   throw Error('Sauvegarde trop volumineuse ou corrompue');
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
