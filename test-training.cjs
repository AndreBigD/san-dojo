const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const C=require('./dist/curriculum.js'),G=require('./dist/progression.js'),T=require('./dist/training.js'),K=require('./dist/kihon-catalog.js');
test('13 grades each have distinct Kihon and Ido modules with 3 valid sequential phases',()=>{
 assert.equal(T.MODULES.length,26);assert.equal(T.MODULES.flatMap(m=>m.phases).length,78);
 for(let rank=0;rank<13;rank++){const modules=T.modulesForBelt(rank);assert.equal(modules.length,2);assert.deepEqual(modules.map(m=>m.type),['kihon','ido']);for(const m of modules)for(const p of m.phases){assert.ok(p.questionIds.length>=4);assert.equal(new Set(p.questionIds).size,p.questionIds.length);for(const id of p.questionIds)assert.ok(C.QUESTIONS[id],id);}if(rank)assert.ok(T.thresholds[rank]>=T.thresholds[rank-1]);}
 assert.ok(T.MODULES[24].phases[2].questionIds.length>T.MODULES[0].phases[2].questionIds.length);
});
test('future belt exercises are locked while previously reached belts remain available',()=>{
 const p=C.initial();p.availableBelt=0;assert.equal(C.phaseUnlocked(p,'treino-kihon-0-1'),true);assert.equal(C.phaseUnlocked(p,'treino-kihon-1-1'),false);assert.equal(C.phaseUnlocked(p,'treino-ido-0-2'),false);
 p.availableBelt=3;assert.equal(C.phaseUnlocked(p,'treino-kihon-0-1'),true);assert.equal(C.phaseUnlocked(p,'treino-ido-3-1'),true);assert.equal(C.phaseUnlocked(p,'treino-ido-4-1'),false);
});

test('every belt adds a real demand and advanced phases avoid elementary multiple-choice questions',()=>{
 for(let rank=1;rank<13;rank++){
  const a=T.DEMANDS[rank-1],b=T.DEMANDS[rank];
  assert.ok(b.terms>a.terms||b.sequence>a.sequence||b.rounds>a.rounds||a.choices&&!b.choices);
 }
 for(const m of T.MODULES){
  const used=new Set();
  for(const phase of m.phases)for(const id of phase.questionIds){
   assert.ok(!used.has(id),'Each phase must contain distinct work: '+id);used.add(id);
   const q=C.QUESTIONS[id];
   if(m.belt>=2)assert.equal(q.type,'input');
   if(q.answers)for(const a of q.answers){assert.ok(C.normalize(a).length>0,id);assert.ok(a.length<=600,id);}
  }
 }
 const black=T.modulesForBelt(12),white=T.modulesForBelt(0);
 assert.ok(black.every(m=>m.phases.every(p=>p.questionIds.some(id=>C.QUESTIONS[id].audioSequence?.length===9))));
 assert.ok(black.find(m=>m.type==='ido').phases.every(p=>p.questionIds.some(id=>id.endsWith('-transicoes'))));
 assert.ok(white.every(m=>m.phases.some(p=>p.questionIds.some(id=>C.QUESTIONS[id].type==='choice'))));
});
test('grade practice approval requires all six Kihon and Ido phase approvals',()=>{
 const p=C.initial(),g=G.create();p.availableBelt=0;assert.throws(()=>T.approve(p,g,0),/Conclua/);
 for(const m of T.modulesForBelt(0))for(const phase of m.phases)C.record(p,phase.id,phase.questionIds.length,phase.questionIds.length,[]);
 assert.equal(T.ready(p,0),true);T.approve(p,g,0,'Controle e ajustes observados.');assert.equal(g.mastery[0],true);assert.ok(p.approvals['grade-0']);assert.throws(()=>T.approve(p,g,1),/Conclua/);
});
test('200 weekly XP maintains the rank until the required study phases are passed',()=>{
 const start=Date.parse('2026-10-26T03:00:00Z'),end=start+7*86400000;
 const waiting=G.create(start);waiting.requireMastery=true;G.credit(waiting,200,start);G.reconcile(waiting,end);assert.equal(waiting.belt,0);assert.equal(waiting.history[0].kind,'awaiting_mastery');
 const ready=G.create(start);ready.requireMastery=true;ready.mastery={0:true};G.credit(ready,200,start);G.reconcile(ready,end);assert.equal(ready.belt,1);
});
test('maintenance and demotion thresholds remain valid with the new mastery gate',()=>{
 const start=Date.parse('2026-10-26T03:00:00Z');for(const [xp,expected]of [[80,3],[79,2],[250,3]]){const g=G.create(start);g.belt=3;g.requireMastery=true;G.credit(g,xp,start);G.reconcile(g,start+7*86400000);assert.equal(g.belt,expected);}
});
test('all 23 katas, 32 Kihon techniques, group sequences and training commands have MP3 assets',()=>{
 const ctx=vm.createContext({});vm.runInContext(fs.readFileSync('./dist/audio-map.js','utf8')+'\nthis.registry=JAPANESE_AUDIO;',ctx);vm.runInContext(fs.readFileSync('./dist/katas.js','utf8')+'\nthis.katas=KATA_CATALOG;',ctx);
 assert.equal(ctx.katas.length,23);assert.equal(K.terms.length,32);assert.deepEqual(K.groups.map(g=>g.name),['Te waza','Ashi waza','Shuto waza','Uke waza']);
 const names=[...ctx.katas.map(k=>k.name),...K.terms.map(t=>t.name),...K.groups.flatMap(g=>[g.name,'Sequência · '+g.name]),...T.COMMANDS.map((_,i)=>'Comandos da faixa '+String(i+1).padStart(2,'0'))];
 for(const name of names){assert.ok(ctx.registry[name],name);assert.ok(fs.statSync('./dist/'+ctx.registry[name].src).size>500,name);}
 for(const m of T.MODULES)for(const p of m.phases)for(const id of p.questionIds)for(const name of C.QUESTIONS[id].audioSequence||[])assert.ok(ctx.registry[name],id+': '+name);
});
