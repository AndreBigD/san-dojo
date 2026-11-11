const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
let PGlite;try{({PGlite}=require('@electric-sql/pglite'));}catch{({PGlite}=require('../auth-build/node_modules/@electric-sql/pglite'));}
test('verified recurring webhooks activate the current month once, keep a future payment separate and survive an older refund',async()=>{
 const {createHandlers}=await import('./backend/dojo-billing/handler.mjs'),{dateKey,paymentPeriod}=await import('./backend/dojo-billing/core.mjs');
 const db=new PGlite();try{
  await db.exec('create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key);create table public.dojo_profiles(id uuid primary key,active boolean);create table public.dojo_admins(user_id uuid primary key);create table public.dojo_guardians(user_id uuid,status text,consent_version text);create table public.dojo_privacy_requests(user_id uuid,status text);');
  await db.exec(fs.readFileSync('./backend/billing.sql','utf8'));
  const user='11111111-1111-4111-8111-111111111111',checkout='33333333-3333-4333-8333-333333333333',secret='sandbox-test-token-'.repeat(3);
  await db.query('insert into auth.users values($1)',[user]);await db.query('insert into public.dojo_profiles values($1,true)',[user]);await db.query('insert into public.dojo_admins values($1)',[user]);
  const order=(await db.query("select public.dojo_billing_reserve($1,'sandbox',1199,'2026-11-11.plus.1') as r",[user])).rows[0].r.order;
  await db.query("update public.dojo_billing_orders set checkout_id=$1,state='pending' where id=$2",[checkout,order.id]);
  const current=dateKey().slice(0,7)+'-01',anchor=new Date(current+'T12:00:00Z');
  const month=offset=>new Date(Date.UTC(anchor.getUTCFullYear(),anchor.getUTCMonth()+offset,1,12)).toISOString().slice(0,10);
  const subscription={id:'sub_monthly',customer:'cus_monthly',checkoutSession:checkout,cycle:'MONTHLY',value:11.99};
  const payments=new Map([-1,0,1].map(offset=>['pay_month_'+(offset+1),{id:'pay_month_'+(offset+1),customer:subscription.customer,subscription:subscription.id,checkoutSession:checkout,billingType:'CREDIT_CARD',value:11.99,status:'CONFIRMED',dueDate:month(offset)}]));
  const store={
   lookup:async(env,cid,sid)=>(await db.query('select * from public.dojo_billing_orders where environment=$1 and (checkout_id=$2 or subscription_id=$3)',[env,cid,sid])).rows[0],
   paymentRecord:async(o,id)=>(await db.query('select * from public.dojo_billing_payments where environment=$1 and order_id=$2 and payment_id=$3',[o.environment,o.id,id])).rows[0],
   apply:async(o,env,event,kind,sub,snapshot,observed)=>db.query('select public.dojo_billing_apply($1,$2,$3,$4,$5,$6::jsonb,$7::timestamptz)',[o.id,env,event,kind,sub,snapshot?JSON.stringify(snapshot):null,observed])
  };
  const calls=[];const h=createHandlers({store,mode:'sandbox',site:'https://sandojokarate.com.br/',webhookToken:secret,provider:async(path,method='GET')=>{
   assert.equal(method,'GET');calls.push(path);if(path==='/subscriptions/sub_monthly')return subscription;
   const payment=payments.get(path.replace('/payments/',''));assert.ok(payment,'only test payment resources may be fetched');return {...payment};
  }});
  const send=async(id,event,kind='PAYMENT_CONFIRMED')=>{const response=await h.webhook(new Request('https://server/webhook',{method:'POST',headers:{'asaas-access-token':secret},body:JSON.stringify({id:event,event:kind,payment:{id}})}));assert.equal(response.status,200);};
  const status=async(env='sandbox')=>(await db.query('select public.dojo_billing_status($1,$2) as r',[user,env])).rows[0].r;
  await send('pay_month_0','old-month');assert.equal((await status()).active,false,'an expired paid month does not activate today');
  await send('pay_month_1','renewal-current');let state=await status();assert.equal(state.active,true);assert.equal(new Date(state.periodEnd).toISOString(),paymentPeriod(current).end);
  await send('pay_month_1','renewal-current');await send('pay_month_1','renewal-current-retry');state=await status();assert.equal(state.payments.length,2);assert.equal(new Date(state.periodEnd).toISOString(),paymentPeriod(current).end,'duplicate events do not add an extra month');
  await send('pay_month_2','renewal-future');state=await status();assert.equal(state.payments.length,3);assert.equal(new Date(state.periodEnd).toISOString(),paymentPeriod(current).end,'a prepaid future month is stored without extending the current period');
  payments.get('pay_month_0').status='REFUNDED';await send('pay_month_0','refund-old-month','PAYMENT_REFUNDED');state=await status();assert.equal(state.active,true,'refund of an older month does not revoke a different paid current month');assert.equal(new Date(state.periodEnd).toISOString(),paymentPeriod(current).end);
  assert.equal((await status('production')).active,false);assert.ok(calls.length>0);
  assert.equal((await db.query("select count(*)::int as n from public.dojo_billing_events where environment='sandbox'")).rows[0].n,5,'replayed event ID is recorded once');
 }finally{await db.close();}
});
test('Postgres protects paid periods, rejects client writes, deduplicates renewals and preserves paid access on cancellation',async()=>{
 const db=new PGlite();try{
  await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key);create table public.dojo_profiles(id uuid primary key,active boolean);create table public.dojo_admins(user_id uuid primary key);create table public.dojo_guardians(user_id uuid,status text,consent_version text);create table public.dojo_privacy_requests(user_id uuid,status text);`);
  await db.exec(fs.readFileSync('./backend/billing.sql','utf8'));
  const user='11111111-1111-4111-8111-111111111111',user2='22222222-2222-4222-8222-222222222222';
  await db.query('insert into auth.users values($1),($2)',[user,user2]);await db.query('insert into public.dojo_profiles values($1,true),($2,true)',[user,user2]);await db.query('insert into public.dojo_guardians values($1,\'authorized\',\'2026-10-29.1\')',[user]);
  const reserve=async u=>(await db.query('select public.dojo_billing_reserve($1,\'sandbox\',1199,\'2026-11-11.plus.1\') as r',[u])).rows[0].r;
  await assert.rejects(reserve(user2));const first=await reserve(user),second=await reserve(user);assert.equal(first.new,true);assert.equal(second.new,false);assert.equal(first.order.id,second.order.id);
  const order=first.order.id;
  await db.query('update public.dojo_billing_orders set checkout_id=$1,state=\'pending\' where id=$2',['33333333-3333-4333-8333-333333333333',order]);
  const apply=async(event,kind,sub,snapshot,observed=new Date().toISOString())=>db.query('select public.dojo_billing_apply($1,\'sandbox\',$2,$3,$4,$5::jsonb,$6::timestamptz)',[order,event,kind,sub,snapshot?JSON.stringify(snapshot):null,observed]);
  const status=async mode=>(await db.query('select public.dojo_billing_status($1,$2) as r',[user,mode||'sandbox'])).rows[0].r;
  await apply('checkout-paid','CHECKOUT_PAID',null,null);assert.equal((await status()).active,false);
  await apply('sub-created','SUBSCRIPTION_CREATED','sub_test',null);assert.equal((await status()).active,false);
  const snapshot={payment:'pay_test',subscription:'sub_test',amount:1199,status:'CONFIRMED',revoked:false,start:new Date(Date.now()-86400000).toISOString(),end:new Date(Date.now()+20*86400000).toISOString()};
  await apply('paid','PAYMENT_CONFIRMED','sub_test',snapshot);await apply('paid','PAYMENT_CONFIRMED','sub_test',snapshot);assert.equal((await status()).active,true);assert.equal((await status()).payments.length,1);assert.equal((await status('production')).active,false);
  await apply('cancelled','CANCELLED_BY_OWNER','sub_test',null);assert.equal((await status()).active,true);assert.equal((await status()).order.renewalCancelled,true);await assert.rejects(reserve(user));
  const newest=new Date(Date.now()+1000).toISOString(),old=new Date(Date.now()-1000).toISOString();
  await apply('refunded','PAYMENT_REFUNDED','sub_test',{...snapshot,status:'REFUNDED',revoked:true},newest);assert.equal((await status()).active,false);
  await apply('delayed-paid','PAYMENT_CONFIRMED','sub_test',snapshot,old);assert.equal((await status()).active,false,'older snapshots cannot restore refunded periods');
  const future={...snapshot,payment:'pay_renewal',start:new Date(Date.now()+20*86400000).toISOString(),end:new Date(Date.now()+50*86400000).toISOString()};
  await apply('renewal-future','PAYMENT_RECEIVED','sub_test',future);assert.equal((await status()).active,false,'a future renewal cannot fill an unpaid current period');assert.equal((await status()).payments.length,2);
  await assert.rejects(apply('bad-price','PAYMENT_CONFIRMED','sub_test',{...snapshot,amount:1}));
  await db.exec('set role authenticated');
  await assert.rejects(db.query('select public.dojo_billing_status($1,\'sandbox\')',[user]));
  await assert.rejects(db.exec('update public.dojo_billing_payments set revoked=false'));
  await assert.rejects(db.exec('select * from public.dojo_billing_orders'));
  await db.exec('reset role');
 }finally{await db.close();}
});

test('a subscription-only checkout link with a lost webhook is recovered through authenticated status and saved once in Postgres',async()=>{
 const {createHandlers}=await import('./backend/dojo-billing/handler.mjs'),{dateKey}=await import('./backend/dojo-billing/core.mjs');
 const db=new PGlite();try{
  await db.exec('create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key);create table public.dojo_profiles(id uuid primary key,active boolean);create table public.dojo_admins(user_id uuid primary key);create table public.dojo_guardians(user_id uuid,status text,consent_version text);create table public.dojo_privacy_requests(user_id uuid,status text);');
  await db.exec(fs.readFileSync('./backend/billing.sql','utf8'));
  const user='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222',checkout='33333333-3333-4333-8333-333333333333';
  await db.query('insert into auth.users values($1),($2)',[user,other]);await db.query('insert into public.dojo_profiles values($1,true),($2,true)',[user,other]);await db.query('insert into public.dojo_admins values($1)',[user]);
  const reservation=(await db.query("select public.dojo_billing_reserve($1,'sandbox',1199,'2026-11-11.plus.1') as r",[user])).rows[0].r;
  const order=reservation.order.id;await db.query("update public.dojo_billing_orders set checkout_id=$1,state='pending' where id=$2",[checkout,order]);
  const store={
   access:async()=>({admin:true}),
   status:async(id,mode)=>(await db.query('select public.dojo_billing_status($1,$2) as r',[id,mode])).rows[0].r,
   currentPayments:async(id,mode,at)=>(await db.query("select p.*,to_jsonb(o) as owner from public.dojo_billing_payments p join public.dojo_billing_orders o on o.id=p.order_id where o.user_id=$1 and p.environment=$2 and not p.revoked and p.status in ('CONFIRMED','RECEIVED') and p.period_start<=$3::timestamptz and p.period_end>$3::timestamptz limit 11",[id,mode,at])).rows.map(row=>({record:row,order:row.owner})),
   paymentRecord:async(o,pid)=>(await db.query('select * from public.dojo_billing_payments where order_id=$1 and environment=$2 and payment_id=$3',[o.id,o.environment,pid])).rows[0],
   ownOrder:async(id,mode,oid)=>(await db.query('select * from public.dojo_billing_orders where user_id=$1 and environment=$2 and id=$3',[id,mode,oid])).rows[0],
   lookup:async(mode,cid,sid)=>(await db.query('select * from public.dojo_billing_orders where environment=$1 and (checkout_id=$2 or subscription_id=$3)',[mode,cid,sid])).rows[0],
   apply:async(o,mode,event,kind,sub,snapshot,observed)=>db.query('select public.dojo_billing_apply($1,$2,$3,$4,$5,$6::jsonb,$7::timestamptz)',[o.id,mode,event,kind,sub,snapshot?JSON.stringify(snapshot):null,observed])
  };
  let paymentStatus='CONFIRMED',deletedSubscription=false;const calls=[];
  const provider=async(path,method='GET')=>{
   calls.push({path,method});
   if(path.startsWith('/payments?')){const q=new URL('https://api.test'+path).searchParams;assert.ok(q.get('checkoutSession')===checkout||q.get('subscription')==='sub_recovery');return {data:q.has('subscription')?[{id:'pay_recovery'}]:[],hasMore:false};}
   if(path.startsWith('/subscriptions?'))return {data:[{id:'sub_recovery',checkoutSession:checkout}],hasMore:false};
   if(path==='/payments/pay_recovery')return {id:'pay_recovery',subscription:'sub_recovery',customer:'cus_recovery',billingType:'CREDIT_CARD',value:11.99,status:paymentStatus,dueDate:dateKey()};
   if(path==='/subscriptions/sub_recovery'){if(deletedSubscription)throw Object.assign(Error('Removed subscription unavailable'),{status:404});return {id:'sub_recovery',customer:'cus_recovery',checkoutSession:checkout,value:11.99,cycle:'MONTHLY'};}
   throw Error('Unexpected provider request');
  };
  const options={store,provider,getUser:async header=>header==='Bearer owner'?{id:user}:header==='Bearer other'?{id:other}:null,mode:'sandbox',site:'https://sandojokarate.com.br/',webhookToken:'a'.repeat(40)};
  const request=(token='owner')=>new Request('https://server/dojo-billing',{method:'POST',headers:{origin:'https://sandojokarate.com.br',authorization:'Bearer '+token},body:JSON.stringify({action:'status',orderId:order})});
  const h=createHandlers(options);
  assert.equal((await (await h.billing(request('other'))).json()).active,false);assert.equal(calls.length,0,'another signed-in account cannot recover this checkout');
  const first=await (await h.billing(request())).json();assert.equal(first.active,true);assert.equal(first.payments.length,1);assert.equal(first.sync,'recovered');
  const originalEnd=first.periodEnd;
  await h.billing(request());assert.equal(calls.length,6,'Sandbox rechecks the stored active payment directly');
  // Simulate a lost ledger status update: another server instance rechecks the same payment, with no extra period.
  await db.query("update public.dojo_billing_payments set revoked=true,status='PENDING'");
  const second=await (await createHandlers(options).billing(request())).json();assert.equal(second.active,true);assert.equal(second.periodEnd,originalEnd);assert.equal(second.payments.length,1);
  assert.ok(calls.every(c=>c.method==='GET'),'reconciliation never creates or charges a subscription');
  await store.apply({id:order},'sandbox','cancel-before-refund','CANCELLED_BY_OWNER','sub_recovery',null,new Date().toISOString());deletedSubscription=true;
  const stillActive=await (await createHandlers(options).billing(request())).json();assert.equal(stillActive.active,true,'cancellation alone preserves the paid period even if subscription GET returns 404');assert.equal(stillActive.order.renewalCancelled,true);
  paymentStatus='REFUNDED';
  const refreshed=await (await createHandlers(options).billing(request())).json();assert.equal(refreshed.active,false,'manual refresh recovers a lost refund webhook for an already-active account');assert.equal(refreshed.payments[0].revoked,true);assert.equal(refreshed.payments.length,1);
  const event=await h.webhook(new Request('https://server/webhook',{method:'POST',headers:{'asaas-access-token':'a'.repeat(40)},body:JSON.stringify({id:'refund-recovery',event:'PAYMENT_REFUNDED',payment:{id:'pay_recovery'}})}));assert.equal(event.status,200);
  assert.equal((await store.status(user,'sandbox')).active,false);
  assert.equal((await store.status(user,'production')).active,false);
  assert.equal((await db.query('select count(*)::int as n from public.dojo_billing_orders')).rows[0].n,1);
 }finally{await db.close();}
});
