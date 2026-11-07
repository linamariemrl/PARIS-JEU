import {IndicatorStore} from '../indicatorStore';

export interface OfficialBudget {
 schema:1; year:number;
 source:string; sourceUrl:string; fetchedAt:string;
 budgetType:string;
 operating:{revenueEUR:number;expenseEUR:number};
 capital:{revenueEUR:number;expenseEUR:number};
 /** Dette constatée: n'est pas fournie dans les crédits votés M57. */
 debtOutstandingEUR:null|number;
 debtOpeningReference?:{asOf:string;amountApproxEUR:number;notCurrent:true;
   source:string;sourceUrl:string};
 scope:'Ville-departement de Paris';
 status:'official';
 comment:string;
}
export interface FinancePlan{
  operatingExpenseChangePct:number;
  capitalExpenseChangePct:number;
  /** Emprunt projeté et non dette constatée. */
  projectedBorrowingEUR:number;
  decisions:{id:string;label:string;date:number}[];
  voteStatus:'proposition'|'vote_fictif';
}
export function emptyPlan():FinancePlan{
  return {operatingExpenseChangePct:0,capitalExpenseChangePct:0,
   projectedBorrowingEUR:0,decisions:[],voteStatus:'proposition'};
}
const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
export function validatePlan(value:FinancePlan):FinancePlan{
  if(!value||!Array.isArray(value.decisions))throw Error('Plan financier invalide');
  for(const x of [value.operatingExpenseChangePct,
     value.capitalExpenseChangePct,value.projectedBorrowingEUR])
    if(!Number.isFinite(x))throw Error('Montant financier non numérique');
  return {
    operatingExpenseChangePct:clamp(value.operatingExpenseChangePct,-20,20),
    capitalExpenseChangePct:clamp(value.capitalExpenseChangePct,-40,40),
    projectedBorrowingEUR:clamp(value.projectedBorrowingEUR,0,5_000_000_000),
    decisions:value.decisions.slice(-100).map(x=>({
      id:String(x.id).slice(0,80),label:String(x.label).slice(0,150),
      date:Number.isFinite(x.date)?x.date:0
    })),
    voteStatus:'proposition'
  };
}
export class FinanceModule{
  readonly id='finances';
  readonly schemaVersion=1;
  readonly indicators:IndicatorStore;
  baseline:OfficialBudget|null=null;
  plan=emptyPlan();
  constructor(store:IndicatorStore){this.indicators=store;}
  async loadOfficial(basePath:string):Promise<boolean>{
    try{
      const response=await fetch(basePath+'data/finance/budget-paris.json');
      if(!response.ok)return false;
      const data=await response.json() as OfficialBudget;
      if(!validBudget(data))return false;
      this.baseline=data;this.recalculate(Date.now());return true;
    }catch{return false;}
  }
  recalculate(gameDate:number){
    const b=this.baseline;
    if(!b)return;
    const opSpend=b.operating.expenseEUR*
      (1+this.plan.operatingExpenseChangePct/100);
    const capSpend=b.capital.expenseEUR*
      (1+this.plan.capitalExpenseChangePct/100);
    // Les crédits votés sont des références millésimées et ne sont
    // jamais antidatés ou présentés comme des dépenses réalisées.
    const budgetDate=Date.UTC(b.year,0,1);
    const need=Math.max(0,capSpend-b.capital.revenueEUR);
    const uncovered=Math.max(0,need-this.plan.projectedBorrowingEUR);
    const records:[
      string,number,'official'|'simulated'
    ][]=[
      ['finances.fonctionnement.recettes',b.operating.revenueEUR,'official'],
      ['finances.fonctionnement.depenses-votees',b.operating.expenseEUR,'official'],
      ['finances.investissement.recettes',b.capital.revenueEUR,'official'],
      ['finances.investissement.depenses-votees',b.capital.expenseEUR,'official'],
      ['finances.fonctionnement.depenses-projet',opSpend,'simulated'],
      ['finances.investissement.depenses-projet',capSpend,'simulated'],
      ['finances.fonctionnement.solde-projet',
       b.operating.revenueEUR-opSpend,'simulated'],
      ['finances.investissement.besoin-projet',need,'simulated'],
      ['finances.investissement.besoin-non-couvert-projet',uncovered,'simulated'],
      ['finances.emprunt-nouveau-projet',this.plan.projectedBorrowingEUR,'simulated']
    ];
    for(const [key,value,provenance] of records){
      this.indicators.put({
        key,level:'paris',spatialId:'75056',value,unit:'EUR',
        asOf:provenance==='official'?budgetDate:gameDate,
        provenance,source:b.sourceUrl
      });
    }
    const debt=b.debtOpeningReference;
    if(debt?.notCurrent&&Number.isFinite(debt.amountApproxEUR)){
      this.indicators.put({
        key:'finances.dette.reference-ouverture-estimee',
        level:'paris',spatialId:'75056',value:debt.amountApproxEUR,
        unit:'EUR',asOf:Date.parse(debt.asOf),
        provenance:'estimated',source:debt.sourceUrl
      });
    }
  }
  propose(operatingPct:number,capitalPct:number,borrowMillion:number,gameDate:number){
    const next=validatePlan({
      ...this.plan,operatingExpenseChangePct:operatingPct,
      capitalExpenseChangePct:capitalPct,
      projectedBorrowingEUR:borrowMillion*1_000_000,
      voteStatus:'proposition'
    });
    next.decisions.push({
      id:String(gameDate)+'-'+next.decisions.length,
      label:'Proposition budgétaire, fonctionnement '+next.operatingExpenseChangePct+
       ' %, investissement '+next.capitalExpenseChangePct+
       ' %, emprunt nouveau '+(next.projectedBorrowingEUR/1e6)+' M€',
      date:gameDate
    });
    this.plan=next;
    this.recalculate(gameDate);
  }
  restore(plan:FinancePlan,gameDate:number){
    this.plan=validatePlan(plan);
    this.recalculate(gameDate);
  }
}
export function validBudget(v:OfficialBudget):boolean{
  if(!v||v.schema!==1||v.status!=='official'||v.scope!=='Ville-departement de Paris')return false;
  if(!Number.isInteger(v.year)||v.year<2019||v.year>2100)return false;
  if(!v.source||!v.sourceUrl||!v.fetchedAt)return false;
  return [v.operating?.revenueEUR,v.operating?.expenseEUR,
    v.capital?.revenueEUR,v.capital?.expenseEUR].every(
      x=>Number.isFinite(x)&&x>=0);
}
