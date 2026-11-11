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
 const h=createHandlers({store:{lookup:async()=>o,paymentRecord:async()=>null,apply:async(...args)=>applied.push(args)},getUser:async()=>null,provider:async path=>{calls.push(path);return path.startsWith('/payments/')?p:s;},mode:'sandbox',site:'https://sandojokarate.com.br/',webhookToken:'a'.repeat(40),imageBase64:'logo'});
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
 const A={user,canStudy:()=>true,ready:Promise.resolve(),client:{functions:{invoke:async()=>fail?{error:true}:{data:{mode:'sandbox',active:true,available:true,serverNow:'2026-11-11T12:00:00Z',periodEnd:'2026-12-11T03:00:00Z'}}}}};
 const context=vm.createContext({window:{SAN_DOJO_CONFIG:{paymentsEnabled:true},addEventListener:()=>{},dispatchEvent:()=>{}},DojoAccounts:A,DojoGame:G,performance:{now:()=>tick},Event:class{},document:{addEventListener:(name,fn)=>{if(name==='visibilitychange')listener=fn;},visibilityState:'visible'},setInterval:()=>{},URL});
 vm.runInContext(fs.readFileSync('./dist/subscription.js','utf8')+';this.P=DojoPayments;',context);
 await context.P.refresh();assert.equal(context.P.active(),true);tick+=300001;assert.equal(context.P.active(),false);
 await context.P.refresh();A.user={id:'user-b'};assert.equal(context.P.active(),false);A.user=user;fail=true;await context.P.refresh();assert.equal(context.P.active(),false);
});
test('sandbox UI makes no requests for students and refuses production entitlements',async()=>{
 let calls=0,admin=false;
 const A={user:{id:'admin'},canManage:()=>admin,canStudy:()=>true,ready:Promise.resolve(),client:{functions:{invoke:async()=>{calls++;return {data:{mode:'production',active:true,available:true,serverNow:new Date().toISOString(),periodEnd:'2099-01-01T00:00:00Z'}};}}}};
 const context=vm.createContext({window:{SAN_DOJO_CONFIG:{paymentsEnabled:true,paymentsEnvironment:'sandbox',paymentsAdminOnly:true},addEventListener:()=>{},dispatchEvent:()=>{}},DojoAccounts:A,DojoGame:{setPremiumProvider(){}},DojoSubscriptionUI:require('./dist/subscription-ui.js'),performance:{now:()=>1000},Event:class{},document:{addEventListener:()=>{},visibilityState:'visible'},setInterval:()=>{},URL});
 vm.runInContext(fs.readFileSync('./dist/subscription.js','utf8')+';this.P=DojoPayments;',context);
 await context.P.refresh();assert.equal(calls,0);assert.equal(context.P.active(),false);
 admin=true;await context.P.refresh();assert.ok(calls>0);assert.equal(context.P.active(),false);assert.match(context.P.page(),/ambiente de assinaturas está diferente/);
});
test('public health reports only configuration presence, never secrets, accounts or financial data',async()=>{
 const {createHandlers}=await import('./backend/dojo-billing/handler.mjs');let calls=0;
 const handlers=createHandlers({store:{},getUser:async()=>{calls++;throw Error('must not authenticate');},provider:async()=>{calls++;throw Error('must not contact Asaas');},mode:' Sandbox ',site:'https://sandojokarate.com.br/',webhookToken:'private-token-'.repeat(4),apiKeyConfigured:true,salesEnabled:false});
 const response=await handlers.billing(new Request('https://server/functions/v1/dojo-billing/health'));assert.equal(response.status,200);
 const value=await response.json();assert.equal(value.environment,'disabled');assert.equal(value.modeNeedsFormatting,true);assert.equal(value.apiKeyConfigured,true);assert.equal(value.webhookTokenConfigured,true);
 assert.equal(calls,0);assert.ok(!JSON.stringify(value).includes('private-token'));assert.deepEqual(Object.keys(value).sort(),['apiKeyConfigured','checkoutEnabled','environment','modeConfigured','modeNeedsFormatting','service','version','webhookTokenConfigured'].sort());
 assert.equal((await handlers.billing(new Request('https://server/functions/v1/dojo-billing',{headers:{origin:'https://sandojokarate.com.br'}}))).status,405);
});

test('payment linking accepts a verified payment checkout or previously bound subscription, but rejects conflicting and missing links',async()=>{
 const C=await core(),o={checkout_id:checkout,price_cents:1199},s={id:'sub_abc',customer:'cus_abc',cycle:'MONTHLY',value:11.99};
 const p={id:'pay_abc',customer:'cus_abc',subscription:s.id,checkoutSession:checkout,billingType:'CREDIT_CARD',value:11.99,status:'CONFIRMED',dueDate:'2026-11-11'};
 assert.equal(C.paymentSnapshot(p,s,o).revoked,false,'checkout can be present on the payment only');
 const bare={...p,checkoutSession:null};
 assert.throws(()=>C.paymentSnapshot(bare,s,o));
 assert.equal(C.paymentSnapshot(bare,s,o,{payment:p.id,checkout}).revoked,false,'a server-filtered checkout list proves the initial link');
 assert.throws(()=>C.paymentSnapshot(bare,s,o,{payment:'pay_other',checkout}));
 assert.equal(C.paymentSnapshot(bare,s,{...o,subscription_id:s.id}).revoked,false);
 assert.throws(()=>C.paymentSnapshot(p,s,{...o,subscription_id:'sub_other'}));
 assert.throws(()=>C.paymentSnapshot(p,{...s,checkoutSession:'different'},o));
 assert.throws(()=>C.paymentSnapshot({...p,customer:null},{...s,customer:null},o));
 assert.throws(()=>C.paymentSnapshot(bare,s,{checkout_id:null,subscription_id:null,price_cents:1199}));
});

async function recoveryHarness({mode='sandbox',admin=true,active=false,providerError=null,listOverride=null,paymentPatch={},subscriptionPatch={},bySubscription=false,subscriptionPages=null}={}){
 const {createHandlers}=await import('./backend/dojo-billing/handler.mjs');
 const order={id,user_id:id,environment:mode,checkout_id:checkout,price_cents:1199,state:'pending',subscription_id:null};
 const subscription={id:'sub_abc',customer:'cus_abc',cycle:'MONTHLY',value:11.99,...subscriptionPatch};
 const payment={id:'pay_abc',customer:'cus_abc',subscription:'sub_abc',billingType:'CREDIT_CARD',value:11.99,status:'CONFIRMED',dueDate:'2026-11-11',...paymentPatch};
 let clock=new Date('2026-11-11T16:00:00Z');const calls=[],applied=[],lookups=[],reports=[];
 const records=new Map(),snapshotRecord=s=>({payment_id:s.payment,order_id:id,amount_cents:s.amount,period_start:s.start,period_end:s.end});
 if(active){const {paymentPeriod}=await core(),period=paymentPeriod(payment.dueDate);order.subscription_id=payment.subscription;order.state='active';records.set(payment.id,{payment:payment.id,amount:1199,status:'CONFIRMED',revoked:false,start:period.start,end:period.end});}
 const store={access:async()=>({admin}),status:async()=>({active,serverNow:clock.toISOString(),order:{id,state:order.state},payments:[...records.values()]}),ownOrder:async(user,env,oid)=>{lookups.push([user,env,oid]);return user===id&&env===mode&&oid===id?order:null;},currentPayments:async(user,env)=>user===id&&env===mode?[...records.values()].filter(s=>!s.revoked).map(s=>({order,record:snapshotRecord(s)})):[],paymentRecord:async(o,pid)=>records.has(pid)?snapshotRecord(records.get(pid)):null,apply:async(...a)=>{applied.push(a);order.subscription_id=a[4];order.state='active';if(a[5]){records.set(a[5].payment,a[5]);active=!a[5].revoked;}}};
 let subscriptionPage=0;
 const provider=async(path,method='GET')=>{
  calls.push({path,method});if(providerError)throw providerError;
  if(path.startsWith('/payments?')){const q=new URL('https://server'+path).searchParams;if(bySubscription&&!q.has('subscription'))return {data:[],hasMore:false};return listOverride||{data:[{id:payment.id}],hasMore:false};}
  if(path.startsWith('/subscriptions?'))return subscriptionPages?.[subscriptionPage++]||{data:[],hasMore:false};
  if(path==='/payments/pay_abc')return payment;if(path==='/subscriptions/sub_abc')return subscription;throw Error('Unexpected provider call');
 };
 const h=createHandlers({store,getUser:async header=>header==='Bearer signed-in'?{id}:null,provider,mode,site:'https://sandojokarate.com.br/',webhookToken:'a'.repeat(40),now:()=>clock,report:code=>reports.push(code)});
 const request=(input={})=>new Request('https://server/dojo-billing',{method:'POST',headers:{origin:'https://sandojokarate.com.br',authorization:'Bearer signed-in'},body:JSON.stringify({action:'status',...input})});
 return {h,request,calls,applied,lookups,reports,advance:ms=>{clock=new Date(clock.getTime()+ms);}};
}

test('refresh recovers a missing webhook for the signed-in order using GET only and coalesces repeated requests',async()=>{
 const T=await recoveryHarness();
 const replies=await Promise.all([T.h.billing(T.request({orderId:'attacker-order',checkoutId:'attacker-checkout',active:true})),T.h.billing(T.request())]);
 for(const response of replies){const value=await response.json();assert.equal(value.active,true);assert.equal(value.sync,'recovered');assert.equal(value.mode,'sandbox');assert.equal(value.payments.length,1);}
 assert.equal(T.applied.length,1);assert.deepEqual(T.lookups,[[id,'sandbox',id],[id,'sandbox',id]]);
 const query=new URL('https://server'+T.calls[0].path).searchParams;
 assert.equal(query.get('checkoutSession'),checkout);assert.equal(query.get('dueDate[ge]'),'2026-10-10');assert.equal(query.get('dueDate[le]'),'2026-11-11');
 assert.ok(T.calls.every(c=>c.method==='GET'));assert.equal(T.calls.length,3);
 await T.h.billing(T.request());assert.equal(T.calls.length,4,'Sandbox also rechecks active payments for the already-published test UI');
 await T.h.billing(T.request());assert.equal(T.calls.length,4,'repeated active refreshes share the one-minute backoff');
});

test('pending, refunded and invalid payments never become paid access during recovery',async()=>{
 for(const status of ['PENDING','REFUNDED','CHARGEBACK_REQUESTED']){
  const T=await recoveryHarness({paymentPatch:{status}}),value=await (await T.h.billing(T.request())).json();
  assert.equal(value.active,false);assert.equal(T.applied[0][5].revoked,true);
 }
 for(const options of [{paymentPatch:{customer:'cus_someone_else'}},{paymentPatch:{value:1}},{paymentPatch:{billingType:'PIX'}},{paymentPatch:{checkoutSession:'different'}},{subscriptionPatch:{checkoutSession:'different'}},{subscriptionPatch:{cycle:'WEEKLY'}},{listOverride:{data:[{id:'pay_abc'}],hasMore:true}},{paymentPatch:{id:'pay_wrong'}}]){
  const T=await recoveryHarness(options),value=await (await T.h.billing(T.request())).json();
  assert.equal(value.active,false);assert.equal(T.applied.length,0);assert.equal(value.sync,'payment_verification_failed');
 }
});

test('recovery is blocked for students in sandbox, gives safe actionable errors and never exposes provider responses',async()=>{
 const blocked=await recoveryHarness({admin:false});assert.equal((await blocked.h.billing(blocked.request())).status,403);assert.equal(blocked.calls.length,0);assert.equal(blocked.lookups.length,0);
 const denied=await recoveryHarness({providerError:Object.assign(Error('sensitive provider error'),{status:401})});
 let value=await (await denied.h.billing(denied.request())).json();assert.equal(value.active,false);assert.equal(value.sync,'provider_access_denied');assert.match(value.message,/chave e as permissões/);assert.ok(!JSON.stringify(value).includes('sensitive'));
 await denied.h.billing(denied.request());assert.equal(denied.calls.length,1,'backoff avoids repeat calls on double taps');
 denied.advance(60001);await denied.h.billing(denied.request());assert.equal(denied.calls.length,2,'a later refresh can retry');
 const missing=await recoveryHarness({listOverride:{data:[],hasMore:false}});value=await (await missing.h.billing(missing.request())).json();assert.equal(value.sync,'subscription_not_linked');assert.equal(missing.applied.length,0);
});

test('recovery locates the exact subscription when the payment checkout query returns no charges',async()=>{
 const T=await recoveryHarness({bySubscription:true,subscriptionPatch:{checkoutSession:checkout},subscriptionPages:[{data:[{id:'sub_other',checkoutSession:'not-this-checkout',customer:'private-other-payer'}],hasMore:true},{data:[{id:'sub_abc',checkoutSession:checkout}],hasMore:false}]});
 const response=await T.h.billing(T.request({subscriptionId:'sub_other'})),value=await response.json();
 assert.equal(value.active,true);assert.equal(value.sync,'recovered');assert.equal(T.applied.length,1);assert.equal(T.applied[0][4],'sub_abc');assert.equal(T.calls.length,6);
 const queries=T.calls.filter(c=>c.path.startsWith('/payments?')).map(c=>new URL('https://server'+c.path).searchParams);
 assert.equal(queries[0].get('checkoutSession'),checkout);assert.equal(queries[1].get('subscription'),'sub_abc');assert.equal(queries[1].has('checkoutSession'),false);
 assert.equal(new URL('https://server'+T.calls[2].path).searchParams.get('offset'),'1');
 assert.ok(T.calls.every(c=>c.method==='GET'));assert.ok(!JSON.stringify(value).includes('private-other-payer'));
});

test('subscription fallback refuses ambiguous or unproven links, changed terms and truncated scans',async()=>{
 const exact={id:'sub_abc',checkoutSession:checkout};
 const cases=[
  {subscriptionPages:[{data:[exact,{id:'sub_other',checkoutSession:checkout}],hasMore:false}]},
  {subscriptionPatch:{checkoutSession:'changed'},subscriptionPages:[{data:[exact],hasMore:false}]},
  {subscriptionPatch:{checkoutSession:checkout,value:1},subscriptionPages:[{data:[exact],hasMore:false}]},
  {subscriptionPatch:{checkoutSession:checkout},paymentPatch:{subscription:'sub_other'},subscriptionPages:[{data:[exact],hasMore:false}]},
  {subscriptionPatch:{checkoutSession:checkout},subscriptionPages:[{data:[exact],hasMore:true},{data:[{id:'sub_x'}],hasMore:true},{data:[{id:'sub_y'}],hasMore:true}]}
 ];
 for(const options of cases){const T=await recoveryHarness({bySubscription:true,...options}),value=await (await T.h.billing(T.request())).json();assert.equal(value.active,false);assert.equal(T.applied.length,0);assert.ok(['payment_verification_failed','subscription_lookup_limit'].includes(value.sync));}
 const unrelated=await recoveryHarness({bySubscription:true,subscriptionPages:[{data:[{id:'sub_other',customer:'ALUNO TESTE',value:11.99}],hasMore:false}]});
 const value=await (await unrelated.h.billing(unrelated.request())).json();assert.equal(value.sync,'subscription_not_linked');assert.equal(unrelated.applied.length,0,'matching name and price are not ownership proof');
});

test('a verified subscription with no current charges is bound without granting energy',async()=>{
 const T=await recoveryHarness({bySubscription:true,listOverride:{data:[],hasMore:false},subscriptionPatch:{checkoutSession:checkout},subscriptionPages:[{data:[{id:'sub_abc',checkoutSession:checkout}],hasMore:false}]});
 const value=await (await T.h.billing(T.request())).json();assert.equal(value.active,false);assert.equal(value.sync,'subscription_payment_waiting');assert.equal(T.applied.length,1);assert.equal(T.applied[0][5],null);assert.equal(T.applied[0][4],'sub_abc');
 T.advance(60001);await T.h.billing(T.request());assert.equal(T.calls.filter(c=>c.path.startsWith('/subscriptions?')).length,1,'subsequent refreshes use the bound subscription');
});

test('payment webhook can bind its first payment when checkoutSession is only on the payment',async()=>{
 const {createHandlers}=await import('./backend/dojo-billing/handler.mjs'),applied=[],lookups=[];
 const o={id,checkout_id:checkout,price_cents:1199},s={id:'sub_abc',customer:'cus_abc',cycle:'MONTHLY',value:11.99};
 const p={id:'pay_abc',customer:'cus_abc',subscription:s.id,checkoutSession:checkout,billingType:'CREDIT_CARD',value:11.99,status:'CONFIRMED',dueDate:'2026-11-11'};
 const h=createHandlers({store:{lookup:async(env,cid,sid)=>{lookups.push([env,cid,sid]);return cid===checkout?o:null;},paymentRecord:async()=>null,apply:async(...args)=>applied.push(args)},provider:async path=>path.startsWith('/payments/')?p:s,mode:'sandbox',site:'https://sandojokarate.com.br/',webhookToken:'a'.repeat(40)});
 const response=await h.webhook(new Request('https://server/webhook',{method:'POST',headers:{'asaas-access-token':'a'.repeat(40)},body:JSON.stringify({id:'evt-checkout-on-payment',event:'PAYMENT_CONFIRMED',payment:{id:p.id}})}));
 assert.equal(response.status,200);assert.deepEqual(lookups,[['sandbox',checkout,s.id]]);assert.equal(applied[0][5].revoked,false);
});

test('recorded payment refresh suspends refunded access without creating or extending periods',async()=>{
 const C=await core(),o={id,subscription_id:'sub_abc',checkout_id:checkout,price_cents:1199},record={order_id:id,payment_id:'pay_abc',amount_cents:1199,period_start:'2026-11-11T03:00:00Z',period_end:'2026-12-11T03:00:00Z'};
 const p={id:'pay_abc',subscription:'sub_abc',value:11.99,billingType:'CREDIT_CARD',status:'REFUNDED',dueDate:'2099-01-01'};
 const snapshot=C.recordedSnapshot(p,o,record);assert.equal(snapshot.revoked,true);assert.equal(snapshot.end,record.period_end);assert.equal(snapshot.start,record.period_start);
 for(const patch of [{id:'pay_other'},{subscription:'sub_other'},{value:1},{billingType:'PIX'},{checkoutSession:'another'}])assert.throws(()=>C.recordedSnapshot({...p,...patch},o,record));
 assert.throws(()=>C.recordedSnapshot(p,o,{...record,order_id:'other'}));assert.throws(()=>C.recordedSnapshot(p,o,null));
});

test('active Sandbox refresh revokes a missing refund notification and fails closed on provider errors',async()=>{
 const T=await recoveryHarness({active:true,paymentPatch:{status:'REFUNDED'}}),value=await (await T.h.billing(T.request())).json();
 assert.equal(value.active,false);assert.equal(value.sync,'benefit_suspended');assert.equal(T.calls.length,1);assert.equal(T.calls[0].path,'/payments/pay_abc');assert.equal(T.calls[0].method,'GET');assert.equal(T.applied[0][5].revoked,true);
 const paid=await recoveryHarness({active:true}),stillPaid=await (await paid.h.billing(paid.request())).json();assert.equal(stillPaid.active,true);assert.equal(stillPaid.sync,'rechecked');
 const failed=await recoveryHarness({active:true,providerError:Error('private response')}),unverified=await (await failed.h.billing(failed.request())).json();assert.equal(unverified.active,false);assert.equal(unverified.verificationFailed,true);assert.equal(failed.applied.length,0);assert.ok(!JSON.stringify(unverified).includes('private response'));
});

test('production background status uses the ledger and explicit refresh rechecks only the signed-in account',async()=>{
 const T=await recoveryHarness({mode:'production',admin:false,active:true,paymentPatch:{status:'REFUNDED'}});
 let value=await (await T.h.billing(T.request())).json();assert.equal(value.active,true);assert.equal(T.calls.length,0);
 value=await (await T.h.billing(T.request({reconcile:true,userId:'attacker',paymentId:'pay_other'}))).json();assert.equal(value.active,false);assert.equal(T.calls[0].path,'/payments/pay_abc');
});

test('manual subscription refresh sends reconciliation intent while background refresh does not',async()=>{
 const bodies=[],A={user:{id:'owner'},canStudy:()=>true,ready:Promise.resolve(),client:{functions:{invoke:async(name,{body})=>{assert.equal(name,'dojo-billing');bodies.push(body);return {data:{mode:'sandbox',active:false,serverNow:new Date().toISOString()}};}}}};
 const context=vm.createContext({window:{SAN_DOJO_CONFIG:{paymentsEnabled:true},addEventListener(){},dispatchEvent(){}},DojoAccounts:A,DojoGame:{setPremiumProvider(){}},performance:{now:()=>1000},Event:class{},document:{addEventListener(){},visibilityState:'visible'},setInterval(){},URL});
 vm.runInContext(fs.readFileSync('./dist/subscription.js','utf8')+';this.P=DojoPayments;',context);
 await context.P.refresh();assert.equal(bodies.at(-1).reconcile,false);await context.P.refresh(true);assert.equal(bodies.at(-1).reconcile,true);
});
