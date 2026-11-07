const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const C=require('./dist/curriculum.js'),G=require('./dist/progression.js'),T=require('./dist/training.js');
test('only an authenticated administrator at black belt can review locked phases without fabricated passes',()=>{
 const source=fs.readFileSync('./dist/learn-app.js','utf8').split('try{const saved=')[0];
 for(const [admin,belt,expected] of [[true,12,true],[false,12,false],[true,0,false]]){
  const course={...C},account={canManage:()=>admin};
  const context=vm.createContext({DojoCourse:course,G,DojoAccounts:account,document:{querySelector:()=>null}});
  vm.runInContext(source,context);vm.runInContext(`appReady=true;state.game.belt=${belt}`,context);
  assert.equal(vm.runInContext("C.phaseUnlocked(state.learning,'integracao-4')",context),expected);
  assert.equal(vm.runInContext('Object.keys(state.learning.phases).length',context),0);
 }
});
test('all six study phases plus weekly XP promote without a fabricated physical approval',()=>{
 const start=Date.parse('2026-11-02T03:00:00Z'),p=C.initial(),g=G.create(start);p.availableBelt=0;T.syncMastery(p,g);G.credit(g,200,start);
 for(const m of T.modulesForBelt(0))for(const phase of m.phases)C.record(p,phase.id,phase.questionIds.length,phase.questionIds.length,[]);
 T.syncMastery(p,g);assert.equal(g.mastery[0],true);assert.deepEqual(p.approvals,{});G.reconcile(g,start+7*86400000);assert.equal(g.belt,1);
});
test('five of six study phases keep the weekly belt gate locked even with enough XP',()=>{
 const start=Date.parse('2026-11-02T03:00:00Z'),p=C.initial(),g=G.create(start);p.availableBelt=0;const phases=T.modulesForBelt(0).flatMap(m=>m.phases);for(const phase of phases.slice(0,5))C.record(p,phase.id,phase.questionIds.length,phase.questionIds.length,[]);T.syncMastery(p,g);G.credit(g,200,start);G.reconcile(g,start+7*86400000);assert.equal(g.belt,0);assert.equal(g.history[0].kind,'awaiting_mastery');
});
function rewardFixture(enabled=true){
 let request,appends=0;const w={SAN_DOJO_CONFIG:{adsEnabled:enabled,rewardedAdsEnabled:enabled,rewardedAdsConsentReady:enabled},adsbygoogle:[],adBreak(options){request=options;}};
 const account={canStudy:()=>true};const ctx=vm.createContext({window:w,DojoAccounts:account,location:{protocol:'https:'},setTimeout,clearTimeout,document:{getElementById:()=>null,createElement:()=>({}),head:{appendChild(tag){appends++;queueMicrotask(()=>tag.onload());}}}});
 vm.runInContext(fs.readFileSync('./dist/rewarded-ads.js','utf8'),ctx);
 return {api:w.DojoRewarded,account,get request(){return request;},get appends(){return appends;}};
}
test('disabled ads never load an ad script or grant any energy',async()=>{const x=rewardFixture(false);let n=0;await assert.rejects(x.api.watch(()=>++n));assert.equal(x.appends,0);assert.equal(n,0);});
test('reward is granted once only by completed-ad callback; no-fill and dismissal do not grant',async()=>{
 for(const kind of ['complete','no-fill','dismiss']){const x=rewardFixture();let energy=0;const pending=x.api.watch(()=>{energy+=5;return 5;});await new Promise(r=>setTimeout(r,0));assert.ok(x.request);if(kind==='complete'){x.request.adViewed();x.request.adViewed();x.request.adBreakDone({breakStatus:'viewed'});}else if(kind==='dismiss'){x.request.adDismissed();x.request.adViewed();}else x.request.adBreakDone({breakStatus:'noAdPreloaded'});assert.equal(await pending,kind==='complete'?5:0);assert.equal(energy,kind==='complete'?5:0);}
});
test('revoked study access during an ad prevents the reward',async()=>{const x=rewardFixture();let n=0;const pending=x.api.watch(()=>++n);await new Promise(r=>setTimeout(r,0));x.account.canStudy=()=>false;x.request.adViewed();x.request.adBreakDone({breakStatus:'viewed'});assert.equal(await pending,0);assert.equal(n,0);});
