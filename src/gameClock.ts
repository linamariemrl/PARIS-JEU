/** Horloge de simulation. 1 seconde réelle = 1 minute de jeu à vitesse x1.
 * Date et heure affichées dans le fuseau Europe/Paris par Intl, y compris DST.
 * Pas de sauvegarde du temps avant le socle de simulation (étape 4).
 */
export type TimeSpeed=0|1|10|60;
export class GameClock{
  private timestamp:number;
  private previous:number|null=null;
  private speed:TimeSpeed=1;
  constructor(initialTimestamp=Date.now()) {this.timestamp=initialTimestamp;}
  private readonly dateFormatter=new Intl.DateTimeFormat('fr-FR',{
    timeZone:'Europe/Paris',day:'2-digit',month:'2-digit',year:'numeric',
    hour:'2-digit',minute:'2-digit',hourCycle:'h23'
  });
  private readonly weekdayFormatter=new Intl.DateTimeFormat('fr-FR',{
    timeZone:'Europe/Paris',weekday:'long'
  });
  tick(nowMs:number):boolean{
    if(this.previous===null){this.previous=nowMs;return false;}
    const delta=Math.max(0,Math.min(1000,nowMs-this.previous));
    this.previous=nowMs;
    if(!this.speed)return false;
    this.timestamp+=delta*60*this.speed;
    return true;
  }
  get current():number{return this.timestamp;}
  get rate():TimeSpeed{return this.speed;}
  setRate(speed:TimeSpeed):void{this.speed=speed;this.previous=null;}
  localHour():number {
    const parts=new Intl.DateTimeFormat('en-GB', {timeZone:'Europe/Paris',hour:'2-digit',hourCycle:'h23'}).format(new Date(this.timestamp));
    return Number(parts);
  }
  label():string {
    const weekday=this.weekdayFormatter.format(new Date(this.timestamp));
    return weekday+' '+this.dateFormatter.format(new Date(this.timestamp));
  }
}
