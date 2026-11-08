const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const A=require('./dist/interactive-activities.js'),C=require('./dist/curriculum.js'),T=require('./dist/training.js');

// Pequena superfície DOM para exercitar os eventos reais, sem tocar numa conta de aluno.
function scopeFor(q){
 const listeners={},fields=[],jumps=[],panels=[],pairButtons=[],one=new Map();
 const element=(dataset={})=>({dataset,style:{},disabled:false,hidden:false,textContent:'',value:'',attributes:{},classList:{toggle(){}},setAttribute(k,v){this.attributes[k]=v;},removeAttribute(k){delete this.attributes[k];},focus(){this.focused=true;}});
 one.set('[data-mission-status]',element());one.set('[data-mission-fill]',element());
 if(A.hasSteps(q))q.context.forEach((_,i)=>{fields.push({...element({stepAnswer:String(i)}),matches:s=>s==='[data-step-answer]'});jumps.push(element({stepJump:String(i)}));panels.push(element({stepPanel:String(i)}));});
 const next=element();
 if(q.type==='match')for(const side of ['name','meaning'])q.pairs.forEach((_,i)=>{const key=side==='name'?'pairName':'pairMeaning',badge=element(),button=element({[key]:String(i)});button.hasAttribute=k=>k===`data-pair-${side}`;button.querySelector=()=>badge;pairButtons.push(button);});
 const scope={querySelectorAll(selector){if(selector==='[data-step-jump]')return jumps;if(selector==='[data-step-panel]')return panels;if(selector==='[data-step-next]')return [next];if(selector==='[data-pair-name],[data-pair-meaning]')return pairButtons;if(selector==='button,input')return [...fields,...jumps,...pairButtons,next];return [];},querySelector(selector){const match=selector.match(/^\[data-step-answer="(\d+)"\]$/);return match?fields[Number(match[1])]:one.get(selector);},addEventListener(name,fn){listeners[name]=fn;}};
 const click=(selector,data={})=>listeners.click({target:{closest:s=>s===selector?{dataset:data}:null}});
 const input=(i,value)=>{fields[i].value=value;listeners.input({target:fields[i]});};
 return {scope,fields,panels,one,click,input,listeners};
}

test('pair construction never verifies early and permits correcting a wrong complete set',()=>{
 let state=A.createPairs(3);assert.equal(A.pairsComplete(state),false);
 state=A.selectPair(state,'name',0);state=A.selectPair(state,'meaning',1);assert.equal(A.pairsComplete(state),false);
 state=A.selectPair(state,'name',1);state=A.selectPair(state,'meaning',0);
 state=A.selectPair(state,'name',2);state=A.selectPair(state,'meaning',2);
 assert.equal(A.pairsComplete(state),true);assert.equal(A.pairsCorrect(state),false);
 state=A.selectPair(state,'name',0);state=A.selectPair(state,'meaning',0);
 assert.equal(A.pairsComplete(state),false,'Reusing a meaning unpairs its previous owner');
 state=A.selectPair(state,'name',1);state=A.selectPair(state,'meaning',1);
 assert.equal(A.pairsCorrect(state),true);
 assert.deepEqual(A.selectPair(state,'meaning',99).pairs,state.pairs);
});

test('pair events read only Japanese terms and lock all cards after a confirmed answer',()=>{
 const q={type:'match',pairs:[{name:'Mae geri',meaning:'Chute frontal'},{name:'Yoko geri',meaning:'Chute lateral'}]},s=scopeFor(q),ready=[],spoken=[];
 A.mount(q,s.scope,{changed:value=>ready.push(value),read:value=>spoken.push(value)});
 for(let i=0;i<2;i++){s.click('[data-pair-name]',{pairName:String(i)});s.click('[data-pair-meaning]',{pairMeaning:String(i)});}
 assert.deepEqual(spoken,['Mae geri','Yoko geri']);assert.equal(ready.at(-1),true);assert.equal(A.correct(),true);
 A.lock();s.click('[data-pair-reset]');assert.equal(A.correct(),true);assert.ok(s.scope.querySelectorAll('button,input').every(field=>field.disabled));
 A.clear();assert.equal(A.correct(),false);
});

test('advanced step cards retain every typed answer and preserve full-sequence grading',()=>{
 const phase=T.modulesForBelt(12)[0].phases[0],q=phase.questionIds.map(id=>C.QUESTIONS[id]).find(q=>q.skill==='classificacao'),s=scopeFor(q),ready=[];
 A.mount(q,s.scope,{changed:value=>ready.push(value)});assert.equal(A.complete(),false);
 const names=q.context.map(name=>require('./dist/kihon-catalog.js').terms.find(t=>t.name===name));
 const groups=names.map(t=>require('./dist/kihon-catalog.js').groups.find(g=>g.id===t.group).name);
 groups.forEach((value,i)=>s.input(i,value));assert.equal(A.complete(),true);assert.equal(ready.at(-1),true);
 assert.ok(q.answers.some(answer=>C.normalize(answer)===C.normalize(A.value())));
 s.click('[data-step-jump]',{stepJump:'0'});s.input(0,'grupo incorreto');
 assert.equal(q.answers.some(answer=>C.normalize(answer)===C.normalize(A.value())),false);
 s.input(0,'');assert.equal(A.complete(),false);assert.equal(ready.at(-1),false);
 s.click('[data-step-jump]',{stepJump:'3'});assert.equal(s.panels[3].hidden,false);assert.equal(s.panels[0].hidden,true);assert.equal(s.fields[3].value,groups[3]);
 A.clear();assert.equal(A.value(),null);
});

test('interactive grading uses the real lesson handler and counts a wrong first check as review',()=>{
 let matching=A.createPairs(2);const q={id:'synthetic-match',type:'match',pairs:[{name:'Yoi',meaning:'Preparar'},{name:'Yame',meaning:'Parar'}],why:'Yoi prepara; yame para.'};
 const s=scopeFor(q),nodes=new Map(),node=id=>{if(!nodes.has(id))nodes.set(id,{style:{},innerHTML:'',disabled:false});return nodes.get(id);};
 A.mount(q,s.scope);
 const context=vm.createContext({DojoActivities:A,C,active:{deck:[q],index:0,checked:false,tries:0,correct:0,wrong:[],combo:0},document:{querySelector:node,querySelectorAll:()=>[]},$:node,stopAudio(){},DojoFeedback:{success(){}},DojoReaction:{show(){}},renderQuestion(){},finishAttempt(){},go(){}});
 const source=fs.readFileSync('./dist/learn-app.js','utf8');vm.runInContext(source.slice(source.indexOf('function answer()'),source.indexOf('function finishAttempt()')),context);
 vm.runInContext('answer()',context);assert.equal(vm.runInContext('active.tries',context),0);
 s.click('[data-pair-name]',{pairName:'0'});s.click('[data-pair-meaning]',{pairMeaning:'1'});s.click('[data-pair-name]',{pairName:'1'});s.click('[data-pair-meaning]',{pairMeaning:'0'});
 vm.runInContext('answer()',context);assert.equal(vm.runInContext('active.tries',context),1);assert.equal(vm.runInContext('active.wrong.length',context),1);assert.equal(vm.runInContext('active.correct',context),0);
 s.click('[data-pair-name]',{pairName:'0'});s.click('[data-pair-meaning]',{pairMeaning:'0'});s.click('[data-pair-name]',{pairName:'1'});s.click('[data-pair-meaning]',{pairMeaning:'1'});
 vm.runInContext('answer()',context);assert.equal(vm.runInContext('active.checked',context),true);assert.equal(vm.runInContext('active.correct',context),0);assert.match(node('#answer').innerHTML,/Ver resultado/);
});

test('the real lesson handler checks all advanced cards together, keeping the first-try score',()=>{
 const q=C.QUESTIONS[T.modulesForBelt(12)[0].phases[0].questionIds.find(id=>C.QUESTIONS[id].skill==='classificacao')],s=scopeFor(q),nodes=new Map(),node=id=>{if(!nodes.has(id))nodes.set(id,{style:{},innerHTML:'',value:'',disabled:false});return nodes.get(id);};
 A.mount(q,s.scope);const context=vm.createContext({DojoActivities:A,C,active:{deck:[q],index:0,checked:false,tries:0,correct:0,wrong:[],combo:0},document:{querySelector:node,querySelectorAll:()=>[]},$:node,stopAudio(){},DojoFeedback:{success(){}},DojoReaction:{show(){}},renderQuestion(){},finishAttempt(){},go(){}});
 const source=fs.readFileSync('./dist/learn-app.js','utf8');vm.runInContext(source.slice(source.indexOf('function answer()'),source.indexOf('function finishAttempt()')),context);
 s.input(0,'Te waza');vm.runInContext('answer()',context);assert.equal(vm.runInContext('active.tries',context),0,'Partial work is not a graded attempt');
 const K=require('./dist/kihon-catalog.js'),groups=q.context.map(name=>K.groups.find(g=>g.id===K.terms.find(t=>t.name===name).group).name);
 groups.forEach((value,i)=>s.input(i,value));s.input(0,'errado');vm.runInContext('answer()',context);assert.equal(vm.runInContext('active.wrong.length',context),1);
 s.input(0,groups[0]);vm.runInContext('answer()',context);assert.equal(vm.runInContext('active.checked',context),true);assert.equal(vm.runInContext('active.correct',context),0);assert.ok(s.fields.every(field=>field.disabled));A.clear();
});

test('only beginner grades receive matching; advanced mastery and note gates stay unchanged',()=>{
 for(const module of T.MODULES)for(const phase of module.phases){const questions=phase.questionIds.map(id=>C.QUESTIONS[id]);if(module.belt<2)assert.equal(questions.filter(q=>q.type==='match').length,1);else assert.equal(questions.some(q=>q.type==='match'),false);}
 for(const m of T.modulesForBelt(12)){assert.equal(m.pass,95);for(const phase of m.phases)for(const ids of phase.questionSets){const qs=ids.map(id=>C.QUESTIONS[id]);assert.ok(qs.filter(A.hasSteps).length>=5);assert.ok(qs.every(q=>q.type==='input'));assert.ok(qs.some(q=>q.audioSequence?.length===9));}}
 const malicious={type:'input',skill:'descricao',context:['<img src=x onerror=bad()>','Safe'],answers:['a b']};assert.ok(A.markup(malicious).includes('&lt;img'));assert.equal(A.markup(malicious).includes('<img src=x'),false);
});
