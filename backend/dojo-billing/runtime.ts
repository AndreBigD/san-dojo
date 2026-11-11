import {createClient} from 'npm:@supabase/supabase-js@2.118.0';
import {createHandlers} from './handler.mjs';
import {asaasClient,billingMode} from './core.mjs';
import {PLAN_IMAGE_BASE64} from './plan-image.ts';

const env=(name:string)=>Deno.env.get(name)||'';
const db=createClient(env('SUPABASE_URL'),env('SUPABASE_SERVICE_ROLE_KEY'),{auth:{persistSession:false,autoRefreshToken:false}});
const mode=billingMode(env('ASAAS_MODE'));
const unwrap=(r:any)=>{if(r.error)throw new Error('Database operation failed');return r.data;};
const store={
 async access(id:string){const [p,g,e,a]=await Promise.all([
  db.from('dojo_profiles').select('active').eq('id',id).maybeSingle(),
  db.from('dojo_guardians').select('status,consent_version').eq('user_id',id).maybeSingle(),
  db.from('dojo_privacy_requests').select('status').eq('user_id',id).maybeSingle(),
  db.from('dojo_admins').select('user_id').eq('user_id',id).maybeSingle()]);return {profile:unwrap(p),guardian:unwrap(g),erasure:unwrap(e),admin:Boolean(unwrap(a))};},
 async reserve(id:string,environment:string,price:number,terms:string){return unwrap(await db.rpc('dojo_billing_reserve',{p_user:id,p_environment:environment,p_price:price,p_terms:terms}));},
 async status(id:string,environment:string){return unwrap(await db.rpc('dojo_billing_status',{p_user:id,p_environment:environment}));},
 async currentPayments(id:string,environment:string,at:string){const rows=unwrap(await db.from('dojo_billing_payments').select('payment_id,order_id,amount_cents,period_start,period_end,dojo_billing_orders!inner(*)').eq('environment',environment).eq('dojo_billing_orders.environment',environment).eq('dojo_billing_orders.user_id',id).eq('revoked',false).in('status',['CONFIRMED','RECEIVED']).lte('period_start',at).gt('period_end',at).limit(11));return rows.map((row:any)=>({order:row.dojo_billing_orders,record:row}));},
 async paymentRecord(o:any,id:string){return unwrap(await db.from('dojo_billing_payments').select('payment_id,order_id,amount_cents,period_start,period_end').eq('environment',o.environment).eq('order_id',o.id).eq('payment_id',id).maybeSingle());},
 async completeCheckout(id:string,checkout:string){const rows=unwrap(await db.from('dojo_billing_orders').update({checkout_id:checkout,state:'pending'}).eq('id',id).eq('state','creating').select('id'));if(rows.length!==1)throw Error('Reservation changed');},
 async ownOrder(user:string,environment:string,id:string){if(!/^[a-f0-9-]{36}$/i.test(id||''))return null;return unwrap(await db.from('dojo_billing_orders').select('*').eq('id',id).eq('user_id',user).eq('environment',environment).maybeSingle());},
 async lookup(environment:string,checkout:string|null,subscription:string|null){
  if(checkout&&/^[a-f0-9-]{36}$/i.test(checkout)){const o=unwrap(await db.from('dojo_billing_orders').select('*').eq('environment',environment).eq('checkout_id',checkout).maybeSingle());if(o)return o;}
  if(subscription&&/^sub_[A-Za-z0-9_]+$/.test(subscription))return unwrap(await db.from('dojo_billing_orders').select('*').eq('environment',environment).eq('subscription_id',subscription).maybeSingle());
  return null;
 },
 async apply(o:any,environment:string,event:string,kind:string,subscription:string|null,snapshot:any,observed:string){unwrap(await db.rpc('dojo_billing_apply',{p_order:o.id,p_environment:environment,p_event:event,p_kind:kind,p_subscription:subscription,p_snapshot:snapshot,p_observed:observed}));}
};
// Provider credentials are read only by this server. No API key or payment data is sent to the browser.
const provider=(...args:Parameters<ReturnType<typeof asaasClient>>)=>asaasClient({mode,key:env('ASAAS_API_KEY')})(...args);
export const handlers=createHandlers({store,mode:env('ASAAS_MODE'),provider,apiKeyConfigured:Boolean(env('ASAAS_API_KEY').trim()),salesEnabled:env('ASAAS_CHECKOUT_ENABLED')==='true',site:env('SAN_DOJO_SITE_URL')||'https://sandojokarate.com.br/',webhookToken:env('ASAAS_WEBHOOK_TOKEN'),getWebhookToken:()=>env('ASAAS_WEBHOOK_TOKEN'),imageBase64:PLAN_IMAGE_BASE64,report:(code:string)=>console.error('San Dojo billing sync: '+code),
 getUser:async(header:string|null)=>{const token=header?.match(/^Bearer (.+)$/i)?.[1];if(!token)return null;const r=await db.auth.getUser(token);return r.error?null:r.data.user;}});
