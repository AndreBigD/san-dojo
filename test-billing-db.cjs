const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
let PGlite;try{({PGlite}=require('@electric-sql/pglite'));}catch{({PGlite}=require('../auth-build/node_modules/@electric-sql/pglite'));}
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
