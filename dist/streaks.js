(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.DojoStreaks=api;})(typeof globalThis!=='undefined'?globalThis:this,()=>{
 'use strict';
 const milestones=[3,7,14,30,60,100,365];
 function valid(s){return typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s+'T12:00:00Z'))&&new Date(s+'T12:00:00Z').toISOString().slice(0,10)===s;}
 function shift(day,n){const d=new Date(day+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);}
 function summary(input,today){const days=[...new Set((Array.isArray(input)?input:[]).filter(d=>valid(d)&&d<=today))].sort(),set=new Set(days);let current=0,best=0,run=0,previous=null,cursor=set.has(today)?today:shift(today,-1);while(set.has(cursor)){current++;cursor=shift(cursor,-1);}for(const d of days){run=previous&&shift(previous,1)===d?run+1:1;best=Math.max(best,run);previous=d;}return {days,current,best,total:days.length,todayDone:set.has(today),next:milestones.find(n=>n>current)||current+30,badges:milestones.filter(n=>best>=n)};}
 function calendar(input,month,today){const s=summary(input,today),set=new Set(s.days),first=month+'-01';if(!valid(first))throw new Error('Mês inválido');const d=new Date(first+'T12:00:00Z'),offset=(d.getUTCDay()+6)%7;d.setUTCMonth(d.getUTCMonth()+1);d.setUTCDate(0);const total=d.getUTCDate(),cells=[];for(let i=0;i<Math.ceil((offset+total)/7)*7;i++){const n=i-offset+1,day=n>0&&n<=total?month+'-'+String(n).padStart(2,'0'):null;cells.push({day,number:day?n:null,done:day?set.has(day):false,today:day===today,future:day?day>today:false});}return cells;}
 return {summary,calendar,shift,valid,milestones};
});
