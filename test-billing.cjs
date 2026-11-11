const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const core=()=>import('./backend/dojo-billing/core.mjs');
const id='11111111-1111-4111-8111-111111111111',checkout='22222222-2222-4222-8222-222222222222';
test('monthly billing uses the approved price, hosted card checkout and clamped calendar months',async()=>{
 const C=await core(),body=C.checkoutPayload({id,price_cents:1199},'https://sandojokarate.com.br/','logo',new Date('2026-11-11T15:00:00Z'));
 assert.deepEqual(body.billingTypes,['CREDIT_CARD']);assert.deepEqual(body.chargeTypes,['RECURRENT']);assert.equal(body.items[0].value,11.99);assert.equal(body.subscription.cycle,'MONTHLY');assert.equal(body.subscription.nextDueDate,'2026-11-11');
 assert.equal(body.callback.successUrl,'https://sandojokarate.com.br/#subscription');assert.equal(C.paymentPeriod('2027-01-31').end,'2027-02-28T03:00:00.000Z');assert.equal(C.paymentPeriod('2028-01-31').end,'2028-02-29T03:00:00.000Z');
 assert.throws(()=>C.paymentPeriod('2026-02-30'));assert.throws(()=>C.checkoutPayload({id,price_cents:1},'https://sandojokarate.com.br/','logo'));
 assert.equal(C.billingMode('typo'),'disabled');assert.equal(C.checkoutURL(checkout,'sandbox'),'https://sandbox.asaas.com/checkoutSession/show?id='+checkout);
});
test('provider verification rejects another subscription, changed prices and unconfirmed or refunded payments',async()=>{
 const C=await core(),o={checkout_id:checkout,price_cents:1199},s={id:'sub_abc',customer:'cus_abc',checkoutSession:checkout,cycle:'MONTHLY',value:11.99};
 const p={id:'pay_abc',customer:'cus_abc',subscription:s.id,checkoutSession:checkout,billingType:'CREDIT_CARD',value:11.99,status:'CONFIRMED',dueDate:'2026-11-11'};
 assert.equal(C.paymentSnapshot(p,s,o).revoked,false);
 for(const patch of [{status:'PENDING'},{status:'REFUNDED'},{status:'CHARGEBACK_REQUESTED'},{deleted:true},{refunds:[{status:'DONE',value:1}]}])assert.equal(C.paymentSnapshot({...p,...patch},s,o).revoked,true);
 for(const patch of [{subscription:'sub_other'},{customer:'cus_other'},{value:1},{checkoutSession:'other'}])assert.throws(()=>C.paymentSnapshot({...p,...patch},s,o));
 assert.throws(()=>C.paymentSnapshot(p,{...s,checkoutSession:'other'},o));
 const secret='a'.repeat(40);assert.equal(await C.tokenMatches(secret,secret),true);assert.equal(await C.tokenMatches('wrong',secret),false);
});
test('billing handlers require login, guardian purchase consent and server price; sandbox is admin only',async()=>{
 const {createHandlers}=await import('./backend/dojo-billing/handler.mjs');const C=await core();let calls=0,admin=true,authorized=true,user=true,stored=false;
 const order={id,checkout_id:checkout,price_cents:1199,state:'pending'};
 const store={access:async()=>({profile:{active:authorized},guardian:{status:'authorized',consent_version:'2026-10-29.1'},admin}),reserve:async()=>({new:!stored,order}),completeCheckout:async()=>{stored=true;},ownOrder:async(u,m,oid)=>oid===id?order:null,status:async()=>({active:false,serverNow:new Date().toISOString()}),apply:async()=>{}};
 const h=createHandlers({store,getUser:async()=>user?{id}:null,provider:async()=>{calls++;return {id:checkout};},mode:'sandbox',salesEnabled:true,site:'https://sandojokarate.com.br/',webhookToken:'a'.repeat(40),imageBase64:'logo'});
 const req=(body,origin='https://sandojokarate.com.br')=>new Request('https://server/dojo-billing',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify(body)});
 const input={action:'checkout',confirm:true,terms:C.PLAN.terms,priceCents:1199};
 assert.equal((await h.billing(req(input,'https://evil.test'))).status,403);
 user=false;assert.equal((await h.billing(req(input))).status,401);user=true;
 admin=false;assert.equal((await h.billing(req(input))).status,403);admin=true;
 assert.equal((await h.billing(req({...input,priceCents:1}))).status,400);assert.equal(calls,0);
 assert.equal((await h.billing(req(input))).status,200);assert.equal(calls,1);
 assert.equal((await h.billing(req(input))).status,200);assert.equal(calls,1,'retry reuses the stored checkout');
 assert.equal((await h.billing(req({action:'cancel',confirm:true,orderId:'other'}))).status,404);
 authorized=false;assert.equal((await h.billing(req({action:'status'}))).status,200,'loss of study permission must not hide billing management');
});
test('webhooks verify token and fetch current payment and subscription; callbacks never activate access',async()=>{
 const {createHandlers}=await import('./backend/dojo-billing/handler.mjs');let applied=[],calls=[];
 const o={id,checkout_id:checkout,price_cents:1199};
 const s={id:'sub_abc',customer:'cus_abc',checkoutSession:checkout,cycle:'MONTHLY',value:11.99};
 const p={id:'pay_abc',customer:'cus_abc',subscription:s.id,billingType:'CREDIT_CARD',value:11.99,status:'CONFIRMED',dueDate:'2026-11-11'};
 const h=createHandlers({store:{lookup:async()=>o,apply:async(...args)=>applied.push(args)},getUser:async()=>null,provider:async path=>{calls.push(path);return path.startsWith('/payments/')?p:s;},mode:'sandbox',site:'https://sandojokarate.com.br/',webhookToken:'a'.repeat(40),imageBase64:'logo'});
 const req=(event,token='a'.repeat(40))=>new Request('https://server/webhook',{method:'POST',headers:{'asaas-access-token':token},body:JSON.stringify(event)});
 assert.equal((await h.webhook(req({id:'evt1',event:'PAYMENT_CONFIRMED',payment:{id:p.id}},'wrong'))).status,401);assert.equal(calls.length,0);
 assert.equal((await h.webhook(req({id:'evt1',event:'PAYMENT_CONFIRMED',payment:{id:p.id,value:0,status:'REFUNDED'}}))).status,200);
 assert.deepEqual(calls,['/payments/pay_abc','/subscriptions/sub_abc']);assert.equal(applied[0][5].status,'CONFIRMED','does not trust payment details in the notification');
 await h.webhook(req({id:'evt2',event:'CHECKOUT_PAID',checkout:{id:checkout}}));assert.equal(applied[1][5],null,'checkout completion grants no paid period');
});
test('a stored premium flag cannot grant unlimited energy; only the in-memory entitlement provider can',()=>{
 const G=require('./dist/progression.js'),g=G.create();g.premiumDemoUntil=Date.now()+99999999;g.plus=true;g.energy.count=0;assert.equal(G.unlimited(g),false);
 G.setPremiumProvider(()=>true);assert.deepEqual(G.reserve(g),{allowed:true,charged:false});G.setPremiumProvider(null);assert.equal(G.unlimited(g),false);
});
test('subscription screen shows price, recurring consent, preparation and cancellation without buying ranks',()=>{
 const U=require('./dist/subscription-ui.js');const offline=U.markup({},true);assert.ok(offline.includes('R$ 11,99'));assert.ok(offline.includes('Assinaturas em preparação'));assert.ok(!offline.includes('id="subscription-start"'));
 const live=U.markup({available:true,plan:{priceCents:1199}},true);assert.ok(live.includes('name="confirm" required'));assert.ok(live.includes('renovada automaticamente'));assert.ok(live.includes('Continuar no Asaas'));
 const cancelled=U.markup({active:true,periodEnd:'2026-12-11T03:00:00Z',order:{renewalCancelled:true}},true);assert.ok(cancelled.includes('A renovação foi cancelada'));assert.ok(!cancelled.includes('data-subscription-cancel'));
});
test('browser entitlement is short-lived, tied to the signed-in account and cleared on service failure',async()=>{
 let tick=1000,fail=false,listener;const user={id:'user-a'},G={setPremiumProvider(fn){this.provider=fn;}};
 const A={user,canStudy:()=>true,ready:Promise.resolve(),client:{functions:{invoke:async()=>fail?{error:true}:{data:{active:true,available:true,serverNow:'2026-11-11T12:00:00Z',periodEnd:'2026-12-11T03:00:00Z'}}}}};
 const context=vm.createContext({window:{SAN_DOJO_CONFIG:{paymentsEnabled:true},addEventListener:()=>{},dispatchEvent:()=>{}},DojoAccounts:A,DojoGame:G,performance:{now:()=>tick},Event:class{},document:{addEventListener:(name,fn)=>{if(name==='visibilitychange')listener=fn;},visibilityState:'visible'},setInterval:()=>{},URL});
 vm.runInContext(fs.readFileSync('./dist/subscription.js','utf8')+';this.P=DojoPayments;',context);
 await context.P.refresh();assert.equal(context.P.active(),true);tick+=300001;assert.equal(context.P.active(),false);
 await context.P.refresh();A.user={id:'user-b'};assert.equal(context.P.active(),false);A.user=user;fail=true;await context.P.refresh();assert.equal(context.P.active(),false);
});
