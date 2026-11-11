import {PLAN,billingMode,eligible,checkoutPayload,checkoutURL,paymentSnapshot,tokenMatches} from './core.mjs';
const fail=(status,message)=>Object.assign(new Error(message),{status});
export function createHandlers({store,getUser,provider,mode:rawMode,site,webhookToken,imageBase64,salesEnabled=false,apiKeyConfigured=false,now=()=>new Date()}){
 const mode=billingMode(rawMode),origin=new URL(site).origin;
 const json=(data,status=200,cors=false)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store',...(cors?{'Access-Control-Allow-Origin':origin,'Vary':'Origin','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS'}:{})}});
 async function body(req){const raw=await req.text();if(raw.length>65536)throw fail(413,'Pedido muito grande.');try{return JSON.parse(raw);}catch{throw fail(400,'Pedido inválido.');}}
 async function billing(req){
  // Public health reports configuration presence only; never reads users, payments or provider data.
  if(req.method==='GET'&&new URL(req.url).pathname.endsWith('/health'))return json({service:'san-dojo-billing',version:'2026-11-11.2',environment:mode,modeConfigured:mode!=='disabled',modeNeedsFormatting:mode==='disabled'&&String(rawMode||'').trim().toLowerCase()==='sandbox',checkoutEnabled:salesEnabled,apiKeyConfigured,webhookTokenConfigured:typeof webhookToken==='string'&&webhookToken.length>=32});
  if(req.headers.get('origin')!==origin)return json({error:'Origem não autorizada.'},403);
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers:{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin'}});
  if(req.method!=='POST')return json({error:'Método não permitido.'},405,true);
  try{
   const user=await getUser(req.headers.get('authorization'));if(!user)throw fail(401,'Entre na sua conta.');
   const access=await store.access(user.id);
   const input=await body(req);
   if(mode==='disabled')return json({mode,plan:PLAN,active:false,available:false,serverNow:now().toISOString()},200,true);
   if(mode==='sandbox'&&!access.admin)throw fail(403,'Os testes de assinatura estão disponíveis apenas ao administrador.');
   if(input.action==='status')return json({...await store.status(user.id,mode),mode,plan:PLAN,available:salesEnabled},200,true);
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
    o=await store.lookup(mode,subscription.checkoutSession,subscription.id);if(!o)return json({received:true});
    snapshot=paymentSnapshot(payment,subscription,o);sub=subscription.id;
   }else if(kind.startsWith('SUBSCRIPTION_')){
    const id=event.subscription?.id;if(!/^sub_[A-Za-z0-9_]+$/.test(id||''))throw fail(400,'Invalid subscription');
    o=await store.lookup(mode,null,id);
    if(kind!=='SUBSCRIPTION_DELETED'){
     const subscription=await provider('/subscriptions/'+id);
     o??=await store.lookup(mode,subscription.checkoutSession,id);
     if(o&&(subscription.checkoutSession!==o.checkout_id||subscription.cycle!=='MONTHLY'||Math.round(subscription.value*100)!==o.price_cents))throw fail(400,'Invalid subscription terms');
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
