import {PLAN,billingMode,eligible,checkoutPayload,checkoutURL,paymentSnapshot,subscriptionMatches,dateKey,tokenMatches} from './core.mjs';
const fail=(status,message)=>Object.assign(new Error(message),{status});
export function createHandlers({store,getUser,provider,mode:rawMode,site,webhookToken,imageBase64,salesEnabled=false,apiKeyConfigured=false,now=()=>new Date(),report=()=>{}}){
 const mode=billingMode(rawMode),origin=new URL(site).origin;
 // Best-effort per-instance backoff only. Entitlements and idempotency remain in Postgres.
 const recovering=new Map();
 const json=(data,status=200,cors=false)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store',...(cors?{'Access-Control-Allow-Origin':origin,'Vary':'Origin','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS'}:{})}});
 async function body(req){const raw=await req.text();if(raw.length>65536)throw fail(413,'Pedido muito grande.');try{return JSON.parse(raw);}catch{throw fail(400,'Pedido inválido.');}}
 async function linkedSubscription(o){
  // Payment checkout filters need not discover a checkout link carried by the subscription itself.
  // Bounded recovery only: exact checkout ID, never payer name, amount or a browser-supplied subscription.
  const matches=new Map();let offset=0;
  for(let page=0;page<3;page++){
   const list=await provider('/subscriptions?'+new URLSearchParams({limit:'100',offset:String(offset),includeDeleted:'true'}));
   if(!Array.isArray(list.data)||typeof list.hasMore!=='boolean'||list.data.length>100||list.hasMore&&list.data.length===0)throw Error('Invalid subscription list');
   for(const row of list.data)if(row.checkoutSession===o.checkout_id){
    if(!/^sub_[A-Za-z0-9_]+$/.test(row.id||''))throw Error('Invalid listed subscription');
    matches.set(row.id,row);
   }
   if(matches.size>1)throw Error('Ambiguous checkout subscriptions');
   if(!list.hasMore){
    if(!matches.size)return null;
    const id=matches.keys().next().value,subscription=await provider('/subscriptions/'+id);
    if(subscription.id!==id)throw Error('Invalid subscription resource');
    subscriptionMatches(subscription,o);return subscription;
   }
   offset+=list.data.length;
  }
  throw Object.assign(Error('Subscription recovery limit reached'),{syncCode:'subscription_lookup_limit'});
 }
 async function recover(o){
  if(!o.checkout_id&&!o.subscription_id)return {sync:'creating',message:'A contratação ainda está sendo preparada. Não contrate novamente.'};
  const observed=now(),query=new URLSearchParams({limit:'10',offset:'0','dueDate[ge]':dateKey(new Date(observed.getTime()-32*86400000)),'dueDate[le]':dateKey(observed)});
  if(o.subscription_id){if(!/^sub_[A-Za-z0-9_]+$/.test(o.subscription_id))throw Error('Invalid stored subscription');query.set('subscription',o.subscription_id);}
  else{checkoutURL(o.checkout_id,mode);query.set('checkoutSession',o.checkout_id);}
  let list=await provider('/payments?'+query),linked=null;
  if(!Array.isArray(list.data)||list.hasMore!==false||list.data.length>10)throw Error('Incomplete payment list');
  const subscriptions=new Map();
  if(!list.data.length&&!o.subscription_id){
   linked=await linkedSubscription(o);
   if(!linked)return {sync:'subscription_not_linked',message:'A consulta não encontrou uma assinatura vinculada a esta contratação. André precisa conferir o vínculo no Asaas; não contrate novamente.'};
   // The full subscription has independently proved ownership before changing the payment search.
   o={...o,subscription_id:linked.id};subscriptions.set(linked.id,Promise.resolve(linked));
   query.delete('checkoutSession');query.set('subscription',linked.id);
   list=await provider('/payments?'+query);
   if(!Array.isArray(list.data)||list.hasMore!==false||list.data.length>10)throw Error('Incomplete subscription payment list');
  }
  // Fetch fresh complete resources, not prices or confirmation supplied by a callback or the browser.
  const checked=await Promise.all(list.data.map(async row=>{
   if(!/^pay_[A-Za-z0-9_]+$/.test(row.id||''))throw Error('Invalid listed payment');
   const payment=await provider('/payments/'+row.id);
   if(payment.id!==row.id||!/^sub_[A-Za-z0-9_]+$/.test(payment.subscription||''))throw Error('Invalid payment resource');
   if(!subscriptions.has(payment.subscription))subscriptions.set(payment.subscription,provider('/subscriptions/'+payment.subscription));
   const subscription=await subscriptions.get(payment.subscription);
   const evidence=o.subscription_id?null:{checkout:o.checkout_id,payment:row.id};
   return {subscription,snapshot:paymentSnapshot(payment,subscription,o,evidence)};
  }));
  if(new Set(checked.map(x=>x.subscription.id)).size>1)throw Error('Conflicting subscriptions');
  for(const {subscription,snapshot} of checked){
   await store.apply(o,mode,'reconcile:'+crypto.randomUUID(),'PAYMENT_RECONCILED',subscription.id,snapshot,observed.toISOString());
   if(subscription.deleted||subscription.status==='INACTIVE')await store.apply(o,mode,'reconcile:'+crypto.randomUUID(),'SUBSCRIPTION_INACTIVATED',subscription.id,null,observed.toISOString());
  }
  if(linked&&!checked.length){
   await store.apply(o,mode,'reconcile:'+crypto.randomUUID(),linked.deleted||linked.status==='INACTIVE'?'SUBSCRIPTION_INACTIVATED':'SUBSCRIPTION_RECONCILED',linked.id,null,observed.toISOString());
   return {sync:'subscription_payment_waiting',message:'A assinatura foi localizada e vinculada ao San Dojo. Ainda não foi encontrada uma cobrança do período atual; não contrate novamente.'};
  }
  return checked.length?{sync:'checked',message:'A cobrança foi localizada no Asaas, mas ainda não há período pago confirmado. Não contrate novamente.'}:{sync:'waiting',message:'O Asaas ainda não disponibilizou uma cobrança desta contratação. Aguarde um minuto e atualize a situação; não contrate novamente.'};
 }
 async function recoverOnce(o){
  const key=mode+':'+o.id,t=now().getTime(),prior=recovering.get(key);
  if(prior&&t-prior.at<60000)return prior.promise;
  if(recovering.size>=1000)recovering.delete(recovering.keys().next().value);
  const promise=recover(o).catch(error=>{
   const denied=[401,403].includes(error.status),code=denied?'provider_access_denied':error.status?'provider_unavailable':error.syncCode==='subscription_lookup_limit'?'subscription_lookup_limit':'payment_verification_failed';report(code);
   return {sync:code,message:denied?'O Asaas recusou a consulta do pagamento. André precisa conferir a chave e as permissões da integração; não contrate novamente.':code==='subscription_lookup_limit'?'A recuperação atingiu o limite de consulta. André precisa conferir o vínculo da assinatura no Asaas; não contrate novamente.':'Não foi possível conferir a cobrança no Asaas agora. Tente atualizar a situação em um minuto. Se persistir, fale com André; não contrate novamente.'};
  });
  recovering.set(key,{at:t,promise});return promise;
 }
 async function billing(req){
  // Public health reports configuration presence only; never reads users, payments or provider data.
  if(req.method==='GET'&&new URL(req.url).pathname.endsWith('/health'))return json({service:'san-dojo-billing',version:'2026-11-11.4',environment:mode,modeConfigured:mode!=='disabled',modeNeedsFormatting:mode==='disabled'&&String(rawMode||'').trim().toLowerCase()==='sandbox',checkoutEnabled:salesEnabled,apiKeyConfigured,webhookTokenConfigured:typeof webhookToken==='string'&&webhookToken.length>=32});
  if(req.headers.get('origin')!==origin)return json({error:'Origem não autorizada.'},403);
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers:{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin'}});
  if(req.method!=='POST')return json({error:'Método não permitido.'},405,true);
  try{
   const user=await getUser(req.headers.get('authorization'));if(!user)throw fail(401,'Entre na sua conta.');
   const access=await store.access(user.id);
   const input=await body(req);
   if(mode==='disabled')return json({mode,plan:PLAN,active:false,available:false,serverNow:now().toISOString()},200,true);
   if(mode==='sandbox'&&!access.admin)throw fail(403,'Os testes de assinatura estão disponíveis apenas ao administrador.');
   if(input.action==='status'){
    let status=await store.status(user.id,mode),sync={};
    if(!status.active&&status.order){
     const o=await store.ownOrder(user.id,mode,status.order.id);
     if(o){sync=await recoverOnce(o);status=await store.status(user.id,mode);if(status.active)sync={sync:'recovered',message:'Confirmação recuperada. Sua energia ilimitada já está ativa.'};}
    }
    return json({...status,...sync,mode,plan:PLAN,available:salesEnabled},200,true);
   }
   if(input.action==='checkout'){
    if(!salesEnabled)throw fail(409,'Novas assinaturas ainda não estão disponíveis.');
    if(!eligible(access.profile,access.guardian,access.erasure,access.admin))throw fail(403,'Regularize a autorização do responsável na sua conta.');
    if(input.confirm!==true||input.terms!==PLAN.terms||input.priceCents!==PLAN.priceCents)throw fail(400,'Confira o preço e confirme a assinatura mensal.');
    const reservation=await store.reserve(user.id,mode,PLAN.priceCents,PLAN.terms),o=reservation.order;
    if(!reservation.new){
     if(o.state==='pending'&&o.checkout_id)return json({url:checkoutURL(o.checkout_id,mode),mode},200,true);
     throw fail(409,'Você já tem uma assinatura ou uma contratação em processamento. Atualize a situação antes de tentar novamente.');
    }
    // If the provider times out, leave the reservation locked: never create a second recurring charge automatically.
    const checkout=await provider('/checkouts','POST',checkoutPayload(o,site,imageBase64,now()));
    const url=checkoutURL(checkout.id,mode);
    await store.completeCheckout(o.id,checkout.id);
    return json({url,mode},200,true);
   }
   if(input.action==='cancel'){
    if(input.confirm!==true)throw fail(400,'Confirme o cancelamento.');
    const o=await store.ownOrder(user.id,mode,input.orderId);
    if(!o)throw fail(404,'Assinatura não encontrada.');
    if(o.renewal_cancelled)return json({cancelled:true},200,true);
    if(o.subscription_id){
     try{await provider('/subscriptions/'+o.subscription_id,'DELETE');}catch(error){if(error.status!==404)throw error;}
    }else if(o.checkout_id){
     const cancelled=await provider('/checkouts/'+o.checkout_id+'/cancel','POST',{});
     if(!['CANCELED','EXPIRED'].includes(cancelled.status))throw fail(409,'A contratação está sendo concluída. Atualize a situação e tente novamente.');
    }else throw fail(409,'A contratação ainda está em processamento. Fale com André para conferir antes de cancelar.');
    await store.apply(o,mode,'cancel:'+o.id,'CANCELLED_BY_OWNER',o.subscription_id,null,now().toISOString());
    return json({cancelled:true},200,true);
   }
   throw fail(400,'Operação inválida.');
  }catch(error){return json({error:error.status&&error.status<500?error.message:'Não foi possível concluir agora. Atualize a situação antes de tentar novamente.'},error.status&&error.status<500?error.status:503,true);}
 }
 async function webhook(req){
  if(req.method!=='POST')return json({error:'Method not allowed'},405);
  if(mode==='disabled'||!await tokenMatches(req.headers.get('asaas-access-token'),webhookToken))return json({error:'Unauthorized'},401);
  try{
   const event=await body(req);if(typeof event.id!=='string'||event.id.length>200||typeof event.event!=='string')throw fail(400,'Invalid event');
   const observed=now().toISOString();let o,sub=null,snapshot=null,kind=event.event;
   if(kind.startsWith('PAYMENT_')){
    const id=event.payment?.id;if(!/^pay_[A-Za-z0-9_]+$/.test(id||''))throw fail(400,'Invalid payment');
    const payment=await provider('/payments/'+id);
    if(!/^sub_[A-Za-z0-9_]+$/.test(payment.subscription||''))return json({received:true});
    const subscription=await provider('/subscriptions/'+payment.subscription);
    o=await store.lookup(mode,payment.checkoutSession||subscription.checkoutSession,subscription.id);if(!o)return json({received:true});
    snapshot=paymentSnapshot(payment,subscription,o);sub=subscription.id;
   }else if(kind.startsWith('SUBSCRIPTION_')){
    const id=event.subscription?.id;if(!/^sub_[A-Za-z0-9_]+$/.test(id||''))throw fail(400,'Invalid subscription');
    o=await store.lookup(mode,null,id);
    if(kind!=='SUBSCRIPTION_DELETED'){
     const subscription=await provider('/subscriptions/'+id);
     o??=await store.lookup(mode,subscription.checkoutSession,id);
     if(o)subscriptionMatches(subscription,o);
     if(subscription.deleted||subscription.status==='INACTIVE')kind='SUBSCRIPTION_INACTIVATED';
    }
    if(!o)return json({received:true});sub=id;
   }else if(['CHECKOUT_PAID','CHECKOUT_CANCELED','CHECKOUT_EXPIRED'].includes(kind)){
    o=await store.lookup(mode,event.checkout?.id,null);if(!o)return json({received:true});
    // Checkout completion alone grants no energy. Only verified monthly payments grant a period.
   }else return json({received:true});
   await store.apply(o,mode,event.id,kind,sub,snapshot,observed);
   return json({received:true});
  }catch(error){return json({error:'Event not processed; retry required'},error.status===400?400:503);}
 }
 return {billing,webhook};
}
