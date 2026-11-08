const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('./dist/learn-app.js','utf8');
function fixture({admin=true,rank=12,id='treino-kihon-12-3',correct=true}={}){
 const nodes=new Map(),saved=[],messages=[],calls={close:0,push:0};
 const node=id=>{if(!nodes.has(id))nodes.set(id,{style:{},innerHTML:'',textContent:'',className:'',disabled:false,scrollTop:100,replaceChildren(){this.innerHTML='';},removeAttribute(){},close(){calls.close++;}});return nodes.get(id);};
 const context=vm.createContext({document:{querySelector:node,getElementById:id=>node('#'+id),querySelectorAll:()=>[]},Intl,Date,console,localStorage:{setItem:(key,value)=>saved.push(JSON.parse(value))},DojoAccounts:{canManage:()=>admin,queueProgress:()=>{}},DojoPush:{practiced:()=>calls.push++},DojoFeedback:{success:()=>{}},stopAudio(){},stats(){},toast:message=>messages.push(message),go:path=>calls.path=path});
 for(const file of ['curriculum.js','progression.js','kihon-catalog.js','training.js','answer-feedback.js','interactive-activities.js'])vm.runInContext(fs.readFileSync('./dist/'+file,'utf8'),context);
 vm.runInContext('const G=DojoGame,T=DojoTraining;',context);
 vm.runInContext(source.split('try{const saved=')[0],context);
 // Usa as funções reais ligadas ao botão e ao salvamento, com elementos de tela isolados.
 vm.runInContext(source.slice(source.indexOf('function save()'),source.indexOf('function dayKey()')),context);
 vm.runInContext('function dayKey(){return G.dayKey();}',context);
 vm.runInContext(source.slice(source.indexOf('function answer()'),source.indexOf('function prefillMaterial()')),context);
 vm.runInContext(`appReady=true;state.game.belt=${rank};state.learning.availableBelt=${rank};const found=C.phaseById(${JSON.stringify(id)});G.reserve(state.game);state.game.pendingEnergy=true;active={...found,deck:found.phase.questionIds.map(id=>C.QUESTIONS[id]),index:found.phase.questionIds.length-1,checked:true,correct:${correct?'found.phase.questionIds.length':'0'},wrong:${correct?'[]':'[found.phase.questionIds[0]]'},finished:false,charged:true};`,context);
 return {run:code=>vm.runInContext(code,context),node,saved,messages,calls};
}
test('Ver resultado completes an administrator review of a later locked phase, saves once and opens the result',()=>{
 const f=fixture();assert.equal(f.run("C.phaseUnlocked(state.learning,active.phase.id)"),true);
 f.run('answer()');assert.equal(f.run('active.finished'),true);assert.equal(f.run('state.learning.phases[active.phase.id].best'),100);
 assert.equal(f.run('state.xp'),20);assert.equal(f.run('state.game.pendingEnergy'),false);assert.equal(f.run('state.game.energy.count'),20);
 assert.match(f.node('#lesson-content').innerHTML,/FASE APROVADA/);assert.match(f.node('#lesson-content').innerHTML,/mascot-finish/);assert.match(f.node('#answer').innerHTML,/Voltar ao módulo/);assert.equal(f.node('#lesson').scrollTop,0);
 assert.equal(f.saved.length,1);assert.equal(f.saved[0].xp,20);assert.equal(f.calls.push,1);
 // Toques repetidos não duplicam a tentativa, o XP ou o consumo de energia.
 f.run('answer();finishAttempt()');assert.equal(f.saved.length,1);assert.equal(f.run('state.learning.phases[active.phase.id].attempts'),1);assert.equal(f.run('state.xp'),20);
});
test('a student cannot complete an unopened later phase through the administrator review path',()=>{
 const f=fixture({admin:false});f.run('answer()');assert.equal(f.run('active.finished'),false);assert.equal(f.saved.length,0);assert.equal(f.run('state.xp'),0);assert.equal(f.run('active.index'),11);assert.equal(f.messages.length,1);
 assert.equal(f.run('Object.keys(state.learning.phases).length'),0);
 // Uma falha conserva as respostas e a posição, permitindo tentar novamente.
 f.run('answer()');assert.equal(f.run('active.index'),11);assert.equal(f.run('active.checked'),true);assert.equal(f.saved.length,0);
});
test('Ver resultado concludes a below-threshold attempt with review guidance and without awarding XP',()=>{
 const f=fixture({admin:false,rank:0,id:'treino-kihon-0-1',correct:false});f.run('answer()');assert.equal(f.run('active.finished'),true);assert.equal(f.run('state.xp'),0);assert.equal(f.saved.length,1);assert.equal(f.run('state.learning.phases[active.phase.id].passed'),false);assert.equal(f.run('state.sessions[dayKey()]'),1);assert.equal(f.run('state.game.energy.count'),20);assert.match(f.node('#lesson-content').innerHTML,/É HORA DE REVISAR/);assert.match(f.node('#answer').innerHTML,/Voltar ao módulo/);
});
test('a regular student completes an available phase, restores progress and unlocks only the next phase',()=>{
 const f=fixture({admin:false,rank:0,id:'treino-kihon-0-1'});f.run('answer()');
 assert.equal(f.run('state.xp'),20);assert.equal(f.run("C.phaseUnlocked(state.learning,'treino-kihon-0-2')"),true);
 assert.equal(f.run("C.phaseUnlocked(state.learning,'treino-kihon-0-3')"),false);assert.equal(f.run("C.phaseUnlocked(state.learning,'treino-kihon-1-1')"),false);
 const restored=fixture({admin:false,rank:0,id:'treino-kihon-0-1'});restored.run('state='+JSON.stringify(f.saved[0]));
 assert.equal(restored.run("state.learning.phases['treino-kihon-0-1'].best"),100);assert.equal(restored.run('state.xp'),20);
 assert.equal(restored.run('state.game.energy.count'),20);assert.equal(restored.run("C.phaseUnlocked(state.learning,'treino-kihon-0-2')"),true);
 // Uma revisão no mesmo dia usa energia sem duplicar o XP da fase já aprovada.
 restored.run('G.reserve(state.game);state.game.pendingEnergy=true;answer()');
 assert.equal(restored.run('state.xp'),20);assert.equal(restored.run('state.game.energy.count'),15);assert.equal(restored.run("state.learning.phases['treino-kihon-0-1'].attempts"),2);assert.equal(restored.saved.length,1);
});
