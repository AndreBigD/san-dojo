export const PLAN = Object.freeze({id:'plus-monthly',name:'San Dojo Plus',priceCents:1199,cycle:'MONTHLY',terms:'2026-11-11.plus.1'});
export const ENVIRONMENTS = Object.freeze({sandbox:'https://api-sandbox.asaas.com/v3',production:'https://api.asaas.com/v3'});
export function billingMode(value){return Object.hasOwn(ENVIRONMENTS,value)?value:'disabled';}
export function cents(value){const n=Number(value);if(!Number.isFinite(n)||n<0||Math.abs(n*100-Math.round(n*100))>0.00001)throw Error('Invalid amount');return Math.round(n*100);}
export function eligible(profile,guardian,erasure,admin){return Boolean(profile?.active&&!['pending','processing'].includes(erasure?.status)&&(admin||(['approved','authorized'].includes(guardian?.status)&&guardian?.consent_version==='2026-10-29.1')));}
export function dateKey(now=new Date()){return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);}
export function paymentPeriod(due){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(due))throw Error('Invalid due date');
 const start=new Date(due+'T03:00:00Z');if(start.toISOString().slice(0,10)!==due)throw Error('Invalid due date');
 const y=start.getUTCFullYear(),m=start.getUTCMonth()+1,d=start.getUTCDate();
 const end=new Date(Date.UTC(y,m,Math.min(d,new Date(Date.UTC(y,m+1,0)).getUTCDate()),3));
 return {start:start.toISOString(),end:end.toISOString()};
}
export function checkoutPayload(order,site,imageBase64,now=new Date()){
 const origin=new URL(site);if(origin.protocol!=='https:'||origin.pathname!=='/'||origin.search||origin.hash)throw Error('Invalid site URL');
 if(order.price_cents!==PLAN.priceCents)throw Error('Invalid plan price');
 const back=origin.origin+'/#subscription';
 return {billingTypes:['CREDIT_CARD'],chargeTypes:['RECURRENT'],minutesToExpire:60,externalReference:order.id,
  callback:{successUrl:back,cancelUrl:back,expiredUrl:back},
  items:[{name:PLAN.name,description:'Energia ilimitada no San Dojo, por conta de aluno.',quantity:1,value:order.price_cents/100,imageBase64}],
  subscription:{cycle:PLAN.cycle,nextDueDate:dateKey(now)}};
}
export function checkoutURL(id,mode){if(!/^[a-f0-9-]{36}$/i.test(id)||!ENVIRONMENTS[mode])throw Error('Invalid checkout');return (mode==='sandbox'?'https://sandbox.asaas.com':'https://asaas.com')+'/checkoutSession/show?id='+encodeURIComponent(id);}
export function paymentSnapshot(payment,subscription,order){
 if(!/^pay_[A-Za-z0-9_]+$/.test(payment.id)||!/^sub_[A-Za-z0-9_]+$/.test(subscription.id))throw Error('Invalid resource');
 if(payment.subscription!==subscription.id||payment.customer!==subscription.customer||subscription.checkoutSession!==order.checkout_id||payment.checkoutSession&&payment.checkoutSession!==order.checkout_id)throw Error('Unrelated payment');
 if(subscription.cycle!=='MONTHLY'||cents(subscription.value)!==order.price_cents||cents(payment.value)!==order.price_cents||payment.billingType!=='CREDIT_CARD')throw Error('Unexpected payment terms');
 const period=paymentPeriod(payment.dueDate),revoked=payment.deleted===true||!['CONFIRMED','RECEIVED'].includes(payment.status)||(payment.refunds||[]).some(r=>r.status==='DONE'&&Number(r.value)>0)||Boolean(payment.chargeback&&payment.chargeback.status!=='DONE');
 return {payment:payment.id,subscription:subscription.id,amount:order.price_cents,status:String(payment.status),revoked,start:period.start,end:period.end};
}
export async function tokenMatches(actual,expected){
 if(!actual||!expected||expected.length<32)return false;
 const hash=async s=>new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)));
 const [a,b]=await Promise.all([hash(actual),hash(expected)]);let diff=0;for(let i=0;i<a.length;i++)diff|=a[i]^b[i];return diff===0;
}
export function asaasClient({mode,key,fetcher=fetch}){
 const base=ENVIRONMENTS[mode];if(!base||!key)throw Error('Asaas not configured');
 return async function request(path,method='GET',body){
  if(!/^\/(checkouts|subscriptions|payments)(\/[A-Za-z0-9_-]+)*(\?[^\s]*)?$/.test(path))throw Error('Invalid API path');
  const response=await fetcher(base+path,{method,headers:{'Content-Type':'application/json',access_token:key,'User-Agent':'SanDojo/1.0'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(10000)});
  if(!response.ok){const error=new Error('Asaas request failed');error.status=response.status;throw error;}
  return response.json();
 };
}
