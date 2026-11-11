const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');const E=require('./dist/dojo-economy.js'),G=require('./dist/progression.js'),V=require('./dist/player-avatar.js');const at=Date.parse('2026-11-11T15:00:00Z');
test('KC migrate from old saves with no retroactive rewards, and one phase can reward once per day',()=>{
 const w=E.normalize(undefined);assert.equal(w.balance,0);assert.deepEqual(E.award(w,{day:'2026-11-11',phase:'dojo-1',eligible:false},at),{coins:0,bonusXP:0});
 assert.equal(E.award(w,{day:'2026-11-11',phase:'dojo-1',eligible:true},at).coins,10);assert.equal(E.award(w,{day:'2026-11-11',phase:'dojo-1',eligible:true},at).coins,0);
 assert.equal(E.award(w,{day:'2026-11-11',phase:'dojo-2',eligible:true},at).coins,10);assert.equal(E.award(w,{day:'2026-11-12',phase:'dojo-1',eligible:true},at).coins,10);assert.equal(w.balance,30);
 const restored=E.normalize(JSON.parse(JSON.stringify(w)));assert.equal(E.award(restored,{day:'2026-11-11',phase:'dojo-1',eligible:true},at).coins,0);
 assert.throws(()=>E.award(w,{day:'2026-02-30',phase:'dojo-1',eligible:true},at));assert.throws(()=>E.award(w,{day:'2026-11-11',phase:'../oops',eligible:true},at));
});
test('energy purchases cost exactly 25 KC, never exceed 25 energy, and cannot debit when unavailable',()=>{
 const w=E.create(),game=G.create(at);w.balance=50;assert.equal(E.purchase(w,game,'energy',at).ok,false);assert.equal(w.balance,50);
 G.reserve(game,at);assert.equal(game.energy.count,20);assert.equal(E.purchase(w,game,'energy',at).ok,true);assert.equal(game.energy.count,25);assert.equal(w.balance,25);assert.equal(w.spent,25);
 assert.equal(E.purchase(w,game,'energy',at).ok,false);assert.equal(w.balance,25);
 game.energy.count=23;assert.equal(E.purchase(w,game,'energy',at).ok,false);assert.equal(game.energy.count,23);assert.equal(w.balance,25);
 game.energy.count=10;w.balance=24;assert.equal(E.purchase(w,game,'energy',at).ok,false);assert.equal(game.energy.count,10);assert.equal(w.balance,24);
 assert.equal(E.purchase(w,game,'unknown',at).ok,false);
});
test('the XP product affects only the next three eligible passing rewards, preserving failed and duplicate attempts',()=>{
 const w=E.create(),game=G.create(at);w.balance=80;assert.equal(E.purchase(w,game,'xp',at).ok,true);assert.equal(w.balance,40);assert.equal(w.boostRemaining,3);assert.equal(E.purchase(w,game,'xp',at).ok,false);assert.equal(w.balance,40);
 assert.equal(E.award(w,{day:'2026-11-11',phase:'p1',eligible:false},at).bonusXP,0);assert.equal(w.boostRemaining,3);
 for(let i=1;i<=3;i++){const result=E.award(w,{day:'2026-11-11',phase:'p'+i,eligible:true},at);assert.equal(result.bonusXP,10);assert.equal(result.coins,10);assert.equal(w.boostRemaining,3-i);assert.equal(E.award(w,{day:'2026-11-11',phase:'p'+i,eligible:true},at).bonusXP,0);}
 assert.equal(E.award(w,{day:'2026-11-11',phase:'p4',eligible:true},at).bonusXP,0);assert.equal(w.balance,80);assert.equal(w.history.length,8);
});
test('wallet migration bounds malformed values without accepting invalid claims or executable ledger content',()=>{
 const w=E.normalize({balance:-5,earned:Infinity,spent:NaN,boostRemaining:500,claims:['<script>','2026-11-11:p1','2026-11-11:p1'],history:[{kind:'<img onerror=x>',coins:10,at:1},{kind:'energy',coins:-25,at:1,html:'<script>'}]});
 assert.equal(w.balance,0);assert.equal(w.boostRemaining,3);assert.deepEqual(w.claims,['2026-11-11:p1']);assert.deepEqual(w.history,[{kind:'energy',coins:-25,at:1}]);
});
test('avatars support both character types, all hair choices and real belts independently of game progression',()=>{
 const game=G.create(at),before=JSON.stringify(game);game.belt=12;
 for(const character of ['masculino','feminino'])for(const [hair] of V.OPTIONS.hair)for(let belt=0;belt<G.BELTS.length;belt++){
  const a=V.normalize({configured:true,character,hair,skin:'morena',hairColor:'castanho',expression:'radiante',belt}),svg=V.svg(a);
  assert.match(svg,/viewBox="0 0 320 360"/);assert.match(svg,new RegExp('avatar '+character));assert.match(svg,new RegExp('faixa real '+G.BELTS[belt].name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));assert.doesNotMatch(svg,/<image|<script|foreignObject|https?:\/\/[^w]/);
 }
 assert.equal(game.belt,12);assert.equal(JSON.parse(before).belt,0);assert.equal(V.normalize({belt:1}).belt,1);assert.equal(game.belt,12);
 const dan=V.svg({belt:12});assert.equal((dan.match(/#e2b84c/g)||[]).length,1,'One golden stripe, on one belt tail');
 const malformed=V.normalize({character:'" onload="x',hair:'<script>',skin:'#fff"',hairColor:'url(x)',belt:99,photo:'data:image/png;base64,private'});assert.deepEqual(malformed,V.create());assert.doesNotMatch(V.svg(malformed),/onload|<script|data:image/);
});
function uiFixture(){
 const events={},nodes={},calls={saved:0,renders:[],toasts:[],closed:0};const doc={addEventListener:(name,fn)=>events[name]=fn,querySelectorAll:()=>[],getElementById:id=>nodes[id]??={innerHTML:'',textContent:'',showModal(){this.open=true;},close(){this.open=false;calls.closed++;}}};
 const state={wallet:E.create(),game:G.create(at),avatar:V.create()};state.wallet.balance=50;state.game.energy.count=20;
 const economy={...E,availability:(w,g,id)=>E.availability(w,g,id,at),purchase:(w,g,id)=>E.purchase(w,g,id,at)};
 const context=vm.createContext({document:doc,state,DojoEconomy:economy,DojoAvatar:V,DojoAccounts:{canStudy:()=>calls.allowed!==false},G,Date,console,save:()=>calls.saved++,render:v=>calls.renders.push(v),toast:t=>calls.toasts.push(t),go:v=>calls.renders.push(v),esc:s=>String(s)});vm.runInContext(fs.readFileSync('./dist/player-profile-ui.js','utf8'),context);
 return {state,calls,events,nodes,run:s=>vm.runInContext(s,context)};
}
test('purchase confirmation and double taps debit only once; cancelling and paused access spend nothing',()=>{
 const f=uiFixture();f.run("openKCConfirmation('energy')");assert.equal(f.state.wallet.balance,50);assert.match(f.nodes['kc-purchase-content'].innerHTML,/25 KC/);f.run('confirmKCPurchase();confirmKCPurchase()');assert.equal(f.state.wallet.balance,25);assert.equal(f.state.game.energy.count,25);assert.equal(f.calls.saved,1);
 const paused=uiFixture();paused.run("openKCConfirmation('energy')");paused.calls.allowed=false;paused.run('confirmKCPurchase()');assert.equal(paused.state.wallet.balance,50);assert.equal(paused.state.game.energy.count,20);assert.equal(paused.calls.saved,0);
 const cancel=uiFixture();cancel.run("openKCConfirmation('energy')");cancel.events.click({target:{closest:s=>s==='[data-kc-cancel]'?{}:null}});cancel.run('confirmKCPurchase()');assert.equal(cancel.state.wallet.balance,50);assert.equal(cancel.calls.saved,0);
});
test('avatar preview changes remain a draft until saving and do not change the app belt, XP or currency',()=>{
 const f=uiFixture(),before=JSON.stringify(f.state.game);f.run('mountAvatarEditor()');
 f.events.click({target:{closest:s=>s==='[data-avatar-character]'?{dataset:{avatarCharacter:'feminino'}}:null}});
 f.events.change({target:{matches:()=>true,name:'hair',value:'cacheado'}});f.events.change({target:{matches:()=>true,name:'belt',value:'8'}});
 assert.equal(f.state.avatar.configured,false);assert.equal(f.calls.saved,0);f.events.submit({target:{id:'avatar-form'},preventDefault(){}});
 assert.equal(f.state.avatar.character,'feminino');assert.equal(f.state.avatar.hair,'cacheado');assert.equal(f.state.avatar.belt,8);assert.equal(f.state.avatar.configured,true);assert.equal(f.calls.saved,1);assert.equal(JSON.stringify(f.state.game),before);assert.equal(f.state.wallet.balance,50);
});
