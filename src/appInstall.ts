/** Lancement autonome sur Android avec la PWA existante (pas un APK natif). */
interface InstallPrompt extends Event{
 prompt():Promise<void>;
 userChoice:Promise<{outcome:'accepted'|'dismissed'}>;
}
export function prepareAppInstallation(){
 const button=document.getElementById('install-app') as HTMLButtonElement;
 const storage=document.getElementById('persist-data') as HTMLButtonElement;
 const status=document.getElementById('app-install-status') as HTMLElement;
 const update=document.getElementById('update-app') as HTMLButtonElement;
 let deferred:InstallPrompt|null=null;
 const standalone=()=>window.matchMedia('(display-mode: standalone)').matches;
 if(standalone()){
  button.disabled=true;button.textContent='PARIS installé';
  status.textContent='Application installée et ouverte sans barre Chrome.';
 }
 window.addEventListener('beforeinstallprompt',event=>{
  event.preventDefault();deferred=event as InstallPrompt;
  button.disabled=false;button.textContent='Installer PARIS';
 });
 button.addEventListener('click',async()=>{
  if(standalone())return;
  if(!deferred){
   status.textContent='Dans Chrome Android : menu ⋮ → Ajouter à l’écran '+
    'd’accueil → Installer PARIS. Une première ouverture en ligne est requise.';
   return;
  }
  const prompt=deferred;deferred=null;
  try{
   await prompt.prompt();
   const answer=await prompt.userChoice;
   status.textContent=answer.outcome==='accepted'?
    'Installation demandée : retrouvez PARIS sur l’écran d’accueil.':
    'Installation annulée ; utilisez le menu Chrome.';
  }catch(error){
   console.warn('Installation PWA',error);
   status.textContent='Installation indisponible : utilisez le menu Chrome ⋮.';
  }
 });
 window.addEventListener('appinstalled',()=>{
  button.disabled=true;button.textContent='PARIS installé';
  status.textContent='PARIS est installé.';
 });
 storage.addEventListener('click',async()=>{
  try{
   if(!navigator.storage?.persist)throw Error('indisponible');
   const granted=await navigator.storage.persist();
   status.textContent=granted?
    'Stockage persistant autorisé. Conservez aussi des exports JSON.':
    'Stockage persistant refusé. Exportez vos parties régulièrement.';
  }catch{
   status.textContent='Persistance indisponible. Exportez vos sauvegardes JSON.';
  }
 });
 return (apply:()=>Promise<void>)=>{
  update.classList.remove('hidden');
  update.addEventListener('click',()=>{
   status.textContent='Enregistrement des modifications avant la mise à jour…';
   void apply();
  },{once:true});
 };
}
