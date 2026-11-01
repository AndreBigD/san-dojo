import {createClient} from 'npm:@supabase/supabase-js@2.57.4';
import * as webpush from 'jsr:@negrel/webpush@0.5.0';
const origin='https://sandojokarate.netlify.app';
const cors={'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'POST,OPTIONS','Vary':'Origin'};
const url=Deno.env.get('SUPABASE_URL');
const service=createClient(url,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),{auth:{persistSession:false,autoRefreshToken:false}});
const check=r=>{if(r.error)throw new Error('Operação indisponível');return r.data;};
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store'}});
const allowed=e=>{try{const u=new URL(e);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&!u.hash&&/^(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|([a-z0-9-]+\.)*push\.apple\.com|([a-z0-9-]+\.)*notify\.windows\.com)$/.test(u.hostname);}catch{return false;}};
const b64=bytes=>btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
async function getKeys(create=false){let stored=check(await service.rpc('dojo_push_get_keys'));if(!stored&&create){const keys=await webpush.generateVapidKeys({extractable:true});stored=check(await service.rpc('dojo_push_init_keys',{p_keys:await webpush.exportVapidKeys(keys),p_public:await webpush.exportApplicationServerKey(keys)}));}return stored;}
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response(null,{headers:cors});
 if(req.method!=='POST')return json({error:'Método não permitido'},405);
 if(req.headers.get('origin')&&req.headers.get('origin')!==origin)return json({error:'Origem não permitida'},403);
 try{
  if(Number(req.headers.get('content-length')||0)>4096)return json({error:'Pedido inválido'},400);
  const body=await req.json();
  if(body.action==='config'||body.action==='test'){
   const token=(req.headers.get('Authorization')||'').replace(/^Bearer\s+/i,'');
   if(!token)return json({error:'Entre na sua conta'},401);
   const userClient=createClient(url,Deno.env.get('SUPABASE_ANON_KEY'),{auth:{persistSession:false},global:{headers:{Authorization:'Bearer '+token}}});
   const {data,error}=await userClient.auth.getUser(token);
   if(error||!data.user)return json({error:'Entre na sua conta'},401);
   if(check(await userClient.rpc('dojo_is_active'))!==true)return json({error:'Acesso ainda não liberado'},403);
   const stored=await getKeys(true);
   if(body.action==='config')return json({publicKey:stored.public_key});
   if(typeof body.endpoint!=='string'||!allowed(body.endpoint))return json({error:'Aparelho inválido'},400);
   const target=check(await service.rpc('dojo_push_test_target',{p_user:data.user.id,p_endpoint:body.endpoint}));
   if(!target)return json({error:'Ative neste aparelho e aguarde um minuto entre testes.'},429);
   const app=await webpush.ApplicationServer.new({contactInformation:'mailto:personalandrecordeiro@gmail.com',vapidKeys:await webpush.importVapidKeys(stored.keys,{extractable:false})});
   try{
    await app.subscribe({endpoint:target.endpoint,keys:{p256dh:target.p256dh,auth:target.auth_key}}).pushTextMessage(JSON.stringify({title:'Seu momento no San Dojo',body:'Que tal concluir uma atividade hoje? Aprenda no seu ritmo.',url:'/#sequence'}),{ttl:120,urgency:webpush.Urgency.Normal,topic:'san-dojo-test'});
   }catch(error){
    let reason='';try{const detail=await error?.response?.clone().json();if(typeof detail?.reason==='string'&&/^[A-Za-z_-]{1,60}$/.test(detail.reason))reason=detail.reason;}catch{}
    const safeMessage=String(error?.message||'').replace(/https?:\/\/\S+/g,'[URL]').replace(/[A-Za-z0-9_\-+/=]{22,}/g,'[valor]').slice(0,180);
    console.error(JSON.stringify({event:'dojo_push_test_failed',provider:new URL(target.endpoint).hostname,status:error?.response?.status||0,reason,kind:error?.name||'Error',message:safeMessage}));
    return json({error:'O aparelho está cadastrado, mas o teste não foi entregue. Aguarde um minuto e tente novamente.',code:'push_delivery_failed'},502);
   }
   return json({sent:true});
  }
  if(!['send','selftest'].includes(body.action))return json({error:'Ação inválida'},400);
  const secret=req.headers.get('x-dojo-job-secret')||'';
  if(!/^[a-f0-9]{64}$/.test(secret)||check(await service.rpc('dojo_push_job_authorized',{p_secret:secret}))!==true)return json({error:'Não autorizado'},401);
  const stored=await getKeys();if(!stored)return json({sent:0,pendingSetup:true});
  const app=await webpush.ApplicationServer.new({contactInformation:'mailto:personalandrecordeiro@gmail.com',vapidKeys:await webpush.importVapidKeys(stored.keys,{extractable:false})});
  if(body.action==='selftest'){
   try{
    const ua=await crypto.subtle.generateKey({name:'ECDH',namedCurve:'P-256'},true,['deriveBits']);
    const keys={p256dh:b64(new Uint8Array(await crypto.subtle.exportKey('raw',ua.publicKey))),auth:b64(crypto.getRandomValues(new Uint8Array(16)))};
    // data: é uma resposta local, sem destinatário real e sem chamada a provedor.
    await app.subscribe({endpoint:'data:text/plain,dojo-self-test',keys}).pushTextMessage('San Dojo self-test',{ttl:60});
    return json({cryptoSelfTest:true,externalDelivery:false});
   }catch(error){
    console.error(JSON.stringify({event:'dojo_push_selftest_failed',kind:error?.name||'Error',message:String(error?.message||'').replace(/https?:\/\/\S+/g,'[URL]').replace(/[A-Za-z0-9_\-+/=]{22,}/g,'[valor]').slice(0,180)}));
    return json({cryptoSelfTest:false,error:'Falha no teste interno'},500);
   }
  }
  const rows=check(await service.rpc('dojo_push_take_batch'));let sent=0,failed=0,removed=0;
  for(let i=0;i<rows.length;i+=10)await Promise.all(rows.slice(i,i+10).map(async row=>{
   let gone=!allowed(row.endpoint),ok=false;
   try{if(!gone){await app.subscribe({endpoint:row.endpoint,keys:{p256dh:row.p256dh,auth:row.auth_key}}).pushTextMessage(JSON.stringify({title:'Seu momento no San Dojo',body:'Que tal concluir uma atividade hoje? Aprenda no seu ritmo.',url:'/#sequence'}),{ttl:1800,urgency:webpush.Urgency.Normal,topic:'san-dojo-daily'});ok=true;sent++;}}
   catch(error){gone=error?.response?.status===404||error?.response?.status===410;failed++;}
   if(gone)removed++;check(await service.rpc('dojo_push_result',{p_id:row.id,p_gone:gone,p_sent:ok}));
  }));
  return json({claimed:rows.length,sent,failed,removed});
 }catch{return json({error:'Não foi possível concluir. Tente novamente.'},500);}
});
