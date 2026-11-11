(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./progression.js'):root.DojoGame);if(typeof module==='object'&&module.exports)module.exports=api;else root.DojoEconomy=api;})(typeof globalThis!=='undefined'?globalThis:this,G=>{
 'use strict';
 const RULES=Object.freeze({lessonCoins:10,maxBalance:1000000,maxBoost:3,bonusXP:10});
 const PRODUCTS=Object.freeze([{id:'energy',name:'Mais um treino',price:25,description:'+5 energias para uma atividade.',kind:'energy'},{id:'xp',name:'Impulso de aprendizado',price:40,description:'+10 XP nas próximas 3 fases aprovadas com recompensa disponível.',kind:'xp'}]);
 const integer=(n,max=RULES.maxBalance)=>Number.isSafeInteger(n)&&n>=0?Math.min(n,max):0;
 function create(){return {version:1,balance:0,earned:0,spent:0,boostRemaining:0,claims:[],history:[]};}
 function normalize(input){const x=input&&typeof input==='object'?input:{};return {version:1,balance:integer(x.balance),earned:integer(x.earned),spent:integer(x.spent),boostRemaining:integer(x.boostRemaining,RULES.maxBoost),claims:Array.isArray(x.claims)?[...new Set(x.claims.filter(k=>typeof k==='string'&&/^\d{4}-\d{2}-\d{2}:[a-z0-9-]{1,100}$/.test(k)))]:[],history:Array.isArray(x.history)?x.history.filter(h=>h&&Number.isFinite(h.at)&&['earned','energy','xp','boost'].includes(h.kind)&&Number.isSafeInteger(h.coins)&&Math.abs(h.coins)<=40).slice(-40).map(h=>({kind:h.kind,coins:h.coins,at:h.at})):[]};}
 function record(w,kind,coins,now){w.history.push({kind,coins,at:now});w.history=w.history.slice(-40);}
 function award(w,{day,phase,eligible},now=Date.now()){
  if(!eligible)return {coins:0,bonusXP:0};
  if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||!Number.isFinite(Date.parse(day+'T12:00:00Z'))||new Date(day+'T12:00:00Z').toISOString().slice(0,10)!==day||!/^[a-z0-9-]{1,100}$/.test(phase))throw Error('Atividade inválida.');
  const key=day+':'+phase;if(w.claims.includes(key))return {coins:0,bonusXP:0};
  w.claims.push(key);const coins=Math.min(RULES.lessonCoins,RULES.maxBalance-w.balance);w.balance+=coins;w.earned=Math.min(RULES.maxBalance,w.earned+coins);const bonusXP=w.boostRemaining>0?RULES.bonusXP:0;if(bonusXP)w.boostRemaining--;record(w,'earned',coins,now);if(bonusXP)record(w,'boost',0,now);return {coins,bonusXP};
 }
 function availability(w,game,id,now=Date.now()){
  const p=PRODUCTS.find(p=>p.id===id);if(!p)return {ok:false,reason:'Bônus não encontrado.'};
  if(w.balance<p.price)return {ok:false,reason:'Faltam '+(p.price-w.balance)+' KC.'};
  if(p.kind==='energy'&&(G.unlimited(game,now)||G.refill(game,now)>G.RULES.maxEnergy-G.RULES.rewardEnergy))return {ok:false,reason:'Você precisa de espaço para as 5 energias. O limite é 25.'};
  if(p.kind==='xp'&&w.boostRemaining>0)return {ok:false,reason:'Use os '+w.boostRemaining+' bônus de XP ativos antes de comprar outro.'};
  return {ok:true,product:p};
 }
 function purchase(w,game,id,now=Date.now()){
  const ready=availability(w,game,id,now);if(!ready.ok)return ready;const p=ready.product;
  if(p.kind==='energy'){const gained=G.rewardEnergy(game,now);if(gained!==5)throw Error('Não foi possível aplicar a recarga.');}else w.boostRemaining=RULES.maxBoost;
  w.balance-=p.price;w.spent=Math.min(RULES.maxBalance,w.spent+p.price);record(w,p.kind,-p.price,now);return {ok:true,product:p};
 }
 return {RULES,PRODUCTS,create,normalize,award,availability,purchase};
});
