const DojoPayments=(()=>{
 let status={active:false,available:false},verifiedAt=0,serverAt=0,owner=null,busy=false,lastMount=-Infinity;
 const enabled=()=>window.SAN_DOJO_CONFIG?.paymentsEnabled===true;
 const reset=()=>{status={active:false,available:false};verifiedAt=0;serverAt=0;owner=null;};
 function active(){if(!enabled()||!DojoAccounts.user||owner!==DojoAccounts.user.id||!DojoAccounts.canStudy()||status.active!==true)return false;const elapsed=performance.now()-verifiedAt;return elapsed>=0&&elapsed<300000&&serverAt+elapsed<Date.parse(status.periodEnd);}
 async function request(body){
  if(!enabled()||!DojoAccounts.client||!DojoAccounts.user)throw Error('As assinaturas ainda estão em preparação.');
  const {data,error}=await DojoAccounts.client.functions.invoke('dojo-billing',{body});
  if(error||data?.error){let detail=data?.error;try{detail??=(await error?.context?.json())?.error;}catch{}throw Error(detail||'Não foi possível consultar a assinatura. Tente atualizar a situação.');}
  return data;
 }
 async function refresh(){
  const user=DojoAccounts.user?.id;if(!enabled()||!user){reset();return;}
  try{const data=await request({action:'status'});if(DojoAccounts.user?.id!==user)return reset();status=data;owner=user;verifiedAt=performance.now();serverAt=Date.parse(data.serverNow);if(!Number.isFinite(serverAt))reset();}
  catch(error){reset();status.message=error.message;}
  window.dispatchEvent(new Event('dojo-subscription-status'));
 }
 function page(){return DojoSubscriptionUI.markup({...status,active:active()},Boolean(DojoAccounts.user));}
 function mount(){if(performance.now()-lastMount<10000)return;lastMount=performance.now();refresh().then(()=>{if(currentView==='subscription')render('subscription');});}
 function message(text){const el=document.getElementById('subscription-message');if(el)el.textContent=text;}
 async function checkout(form){
  if(busy||!form.elements.confirm.checked)return;busy=true;const b=form.querySelector('button');b.disabled=true;message('Preparando o pagamento…');
  try{const data=await request({action:'checkout',confirm:true,terms:DojoSubscriptionUI.terms,priceCents:1199});const url=new URL(data.url);if(url.protocol!=='https:'||!['asaas.com','sandbox.asaas.com'].includes(url.hostname)||url.pathname!=='/checkoutSession/show')throw Error('Endereço de pagamento inválido.');location.assign(url.href);}
  catch(error){message(error.message);b.disabled=false;}finally{busy=false;}
 }
 async function cancel(){
  if(busy)return;busy=true;message('Cancelando a renovação…');
  try{await request({action:'cancel',confirm:true,orderId:status.order?.id});await refresh();if(currentView==='subscription')render('subscription');message('Cancelamento registrado. O período já pago permanece disponível.');}
  catch(error){message(error.message);}finally{busy=false;}
 }
 DojoGame.setPremiumProvider(active);
 document.addEventListener('submit',event=>{if(event.target.id==='subscription-start'){event.preventDefault();checkout(event.target);}});
 document.addEventListener('click',async event=>{
  if(event.target.closest('[data-subscription-refresh]')){message('Consultando…');await refresh();if(currentView==='subscription')render('subscription');}
  if(event.target.closest('[data-subscription-cancel]')){document.getElementById('subscription-cancel-confirm').innerHTML='<div class="learning-callout"><h3>Cancelar a renovação?</h3><p>As próximas cobranças serão interrompidas. O período pago continua disponível. Cancelar a renovação não solicita reembolso; para isso, fale com André.</p><button class="outline" data-subscription-confirm-cancel>Confirmar cancelamento</button><button class="text-button" data-subscription-back>Voltar</button></div>';}
  if(event.target.closest('[data-subscription-confirm-cancel]'))await cancel();
  if(event.target.closest('[data-subscription-back]'))document.getElementById('subscription-cancel-confirm').replaceChildren();
 });
 window.addEventListener('dojo-subscription-status',()=>{if(typeof appReady!=='undefined'&&appReady)stats();});
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')refresh();});
 setInterval(()=>{if(document.visibilityState==='visible')refresh();},240000);
 DojoAccounts.ready.then(refresh);
 return {active,refresh,page,reset,mount};
})();
