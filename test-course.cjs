const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const C=require('./dist/curriculum.js');
test('course contains 6 increasingly demanding modules, 24 phases and valid question references',()=>{
 assert.equal(C.COURSE.length,6);assert.equal(C.COURSE.flatMap(m=>m.phases).length,24);
 const ids=C.COURSE.flatMap(m=>m.phases.map(p=>p.id));assert.equal(new Set(ids).size,24);
 C.COURSE.forEach((m,i)=>{assert.equal(m.level,i+1);if(i)assert.ok(m.pass>=C.COURSE[i-1].pass);for(const p of m.phases){assert.equal(new Set(p.questionIds).size,p.questionIds.length);for(const id of p.questionIds)assert.ok(C.QUESTIONS[id]);}});
 assert.ok(C.COURSE[5].phases[3].questionIds.length>C.COURSE[0].phases[3].questionIds.length);
});
test('a failed phase keeps the next phase locked and a genuine passing score releases it',()=>{
 const p=C.initial();assert.equal(C.phaseUnlocked(p,'dojo-1'),true);assert.equal(C.phaseUnlocked(p,'dojo-2'),false);
 C.record(p,'dojo-1',2,4,['s1','s2']);assert.equal(C.phaseUnlocked(p,'dojo-2'),false);
 const result=C.record(p,'dojo-1',3,4,['s1']);assert.equal(result.passed,true);assert.equal(C.phaseUnlocked(p,'dojo-2'),true);assert.equal(p.phases['dojo-1'].attempts,2);
});
test('the next module unlocks automatically after all prior phases pass',()=>{
 const p=C.initial();assert.throws(()=>C.record(p,'bases-1',4,4,[]),/bloqueada/);
 for(const phase of C.COURSE[0].phases)C.record(p,phase.id,phase.questionIds.length,phase.questionIds.length,[]);
 assert.equal(C.moduleUnlocked(p,'bases'),true);
 for(const phase of C.COURSE[1].phases)C.record(p,phase.id,phase.questionIds.length,phase.questionIds.length,[]);
 assert.equal(C.moduleUnlocked(p,'kihon'),true);assert.deepEqual(p.approvals,{});
});
test('a weaker later review does not erase an earlier approval or best score',()=>{
 const p=C.initial();C.record(p,'dojo-1',4,4,[]);const result=C.record(p,'dojo-1',1,4,['s1','s2','s3']);
 assert.equal(result.passed,false);assert.equal(p.phases['dojo-1'].passed,true);assert.equal(p.phases['dojo-1'].best,100);
});
test('complete learning path advances without manual approvals and finishes after 24 phases',()=>{
 const p=C.initial();for(const m of C.COURSE){assert.equal(C.moduleUnlocked(p,m.id),true);for(const phase of m.phases)C.record(p,phase.id,phase.questionIds.length,phase.questionIds.length,[]);if(m.requiresSensei){assert.equal(C.moduleComplete(p,m.id),false);C.approve(p,m.id,'Prática observada');}assert.equal(C.moduleComplete(p,m.id),true);}assert.equal(C.nextPhase(p),null);
});
test('romaji matching accepts accents and spacing but does not accept unrelated words',()=>{
 assert.equal(C.normalize('  Dōjō Kun! '),C.normalize('dojo kun'));assert.equal(C.normalize('Zenkutsu-dachi'),C.normalize('zenkutsu dachi'));assert.notEqual(C.normalize('gedan'),C.normalize('jodan'));
});
test('all pronunciation exercises and vocabulary terms have a real included MP3',()=>{
 const ctx=vm.createContext({});vm.runInContext(fs.readFileSync('./dist/audio-map.js','utf8')+'\nthis.registry=JAPANESE_AUDIO;',ctx);
 for(const name of [...C.VOCAB.map(w=>w.name),...Object.values(C.QUESTIONS).map(q=>q.audio).filter(Boolean)]){const asset=ctx.registry[name];assert.ok(asset,name);assert.ok(fs.statSync('./dist/'+asset.src).size>500);}
});
test('YouTube input rejects look-alike hosts and executable protocols',()=>{
 const ctx=vm.createContext({URL});vm.runInContext(fs.readFileSync('./dist/media.js','utf8'),ctx);
 const parse=s=>vm.runInContext('parseYouTube('+JSON.stringify(s)+')',ctx);
 assert.equal(parse('https://youtu.be/18Z_BcXfcf0'),'18Z_BcXfcf0');assert.equal(parse('https://www.youtube.com/watch?v=18Z_BcXfcf0&t=4s'),'18Z_BcXfcf0');assert.equal(parse('https://www.youtube.com.evil.test/watch?v=18Z_BcXfcf0'),null);assert.equal(parse('javascript:alert(1)'),null);assert.equal(parse('https://example.com/movie.mp4'),null);
});
