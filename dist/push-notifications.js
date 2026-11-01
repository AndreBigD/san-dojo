const DojoPush=(()=>{
 let registration=null,subscription=null,publicKey='',enabled=false,minute=1080,ready=false,loading=false,error='';
 const ownerKey='san-dojo-push-owner';
 const isIOS=()=>/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
 const installed=()=>window.matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
 const supported=()=>location.protocol==='https:'&&'serviceWorker'in navigator&&'PushManager'in window&&'Notification'in window;
 function markup(){return `<div class="info-panel" id="push-settings"><div class="eyebrow">LEMBRETE OPCIONAL DO SAN DOJO</div><h2>Um convite para praticar</h2><p>Até um aviso por dia neste aparelho, no horário escolhido, se ainda não houver atividade concluída. Quem já praticou não recebe o lembrete daquele dia.</p><p class="week-note">Configure com um responsável adulto. O aviso pode aparecer na tela bloqueada; usamos uma mensagem geral, sem nome do aluno, nota ou faixa. O envio depende de internet e das permissões do celular.</p>${isIOS()&&!installed()?'<div class="push-install"><b>Primeiro, adicione ao iPhone</b><p>Abra no Safari → Compartilhar → Adicionar à Tela de Início. Depois, abra o San Dojo pelo ícone, entre na conta e volte a esta tela para ativar. Use iOS 16.4 ou posterior.</p></div>':!supported()?'<p class="push-status">Este navegador não oferece notificações web. No iPhone, abra o app adicionado à Tela de Início. Em outros aparelhos, experimente um navegador atualizado.</p>':''}<form id="push-form" class="push-form"><label>Horário do lembrete · Brasília<input type="time" name="time" step="900" required value="${timeString(minute)}"></label><label class="push-consent"><input type="checkbox" name="consent" required><span>Sou responsável adulto e quero receber os lembretes opcionais do San Dojo neste aparelho. Posso desativá-los aqui quando quiser.</span></label><div class="push-actions"><button class="primary" type="submit" ${!ready||!supported()||isIOS()&&!installed()?'disabled':''}>${enabled?'Salvar horário':'Ativar notificações'}</button><button class="outline" type="button" data-push-test ${enabled?'':'disabled'}>Testar aviso neste aparelho</button><button class="text-button" type="button" data-push-retry>Conferir conexão</button></div><p class="push-status ${error?'error':''}" id="push-status" role="status">${error||(!supported()?'':loading?'Conectando lembretes…':enabled?'Lembretes ativos neste aparelho.':'Lembretes desativados neste aparelho.')}</p><div class="push-actions"><button class="text-button" type="button" data-push-off ${enabled?'':'disabled'}>Desativar neste aparelho</button><button class="text-button" type="button" data-push-off-all>Desativar em todos os aparelhos</button></div><p class="week-note">O calendário acompanha a conta. A autorização de notificações é separada para cada aparelho. <a href="privacidade.html#lembretes">Como usamos os dados dos lembretes</a></p></form></div>`;}
 function timeString(n){return String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0');}
 function message(text,bad=false){const el=document.getElementById('push-status');if(el){el.textContent=text;el.classList.toggle('error',bad);}}
 function update(){const panel=document.getElementById('push-settings');if(panel){panel.outerHTML=markup();}}
 const check=r=>{if(r.error){
  const provider=/^Serviço de notificações não reconhecido \(([a-z0-9.-]{1,120})\)$/.exec(r.error.message||'');
  if(provider)throw new Error('Este serviço de notificações ainda não é compatível: '+provider[1]+'. Informe esse nome ao suporte do San Dojo.');
  throw new Error('Não foi possível salvar os lembretes. Confira sua conexão e tente novamente.');
 }return r.data;};
 async function functionResult(r){
  if(!r.error)return r.data;
  const status=r.error.context?.status;
  if(status===401)throw new Error('Sua sessão expirou. Entre novamente na conta e confira os lembretes.');
  if(status===403)throw new Error('Os lembretes precisam de uma conta com acesso liberado.');
  if(status===429)throw new Error('Aguarde um minuto entre os testes. Depois, toque em “Testar aviso neste aparelho”.');
  if(status===502)throw new Error('O aparelho está cadastrado, mas o aviso não foi entregue. Aguarde um minuto e teste novamente.');
  throw new Error('Não foi possível conectar ao serviço de avisos. Use “Conferir conexão” para tentar novamente.');
 }
 async function mount(force=false){if(!document.getElementById('push-settings')||!DojoAccounts.user||!DojoAccounts.canStudy()||!supported()||isIOS()&&!installed()||loading||ready&&!force)return;
  loading=true;error='';update();
  try{
   registration=await navigator.serviceWorker.register('/dojo-sw.js',{scope:'/'});
   await navigator.serviceWorker.ready;
   const cfg=await functionResult(await DojoAccounts.client.functions.invoke('dojo-push',{body:{action:'config'}}));
   if(!cfg?.publicKey)throw new Error('Os lembretes ainda não foram configurados.');publicKey=cfg.publicKey;
   subscription=await registration.pushManager.getSubscription();
   let priorOwner='';try{priorOwner=localStorage.getItem(ownerKey)||'';}catch{}
   if(subscription&&priorOwner&&priorOwner!==DojoAccounts.user.id){await subscription.unsubscribe();subscription=null;}
   const status=subscription?check(await DojoAccounts.client.rpc('dojo_push_status',{p_endpoint:subscription.endpoint})):{};
   enabled=Boolean(status.enabled)&&Notification.permission==='granted';if(status.enabled)minute=status.minute;
   if(status.enabled&&!enabled)check(await DojoAccounts.client.rpc('dojo_push_disable',{p_endpoint:subscription.endpoint}));ready=true;
  }catch(e){error=e.message||'Não foi possível conectar os lembretes. Use “Conferir conexão” para tentar novamente.';ready=false;}
  loading=false;update();
 }
 function decode(s){return Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-s.length%4)%4)),c=>c.charCodeAt(0));}
 async function pause(all=false){if(!DojoAccounts.user)return;
  const reg=registration||await navigator.serviceWorker?.getRegistration('/');
  const sub=subscription||await reg?.pushManager.getSubscription();
  if(all||sub)check(await DojoAccounts.client.rpc('dojo_push_disable',{p_endpoint:all?null:sub.endpoint}));
  if(sub)await sub.unsubscribe();
  if(reg)for(const n of await reg.getNotifications())n.close();
  subscription=null;enabled=false;try{localStorage.removeItem(ownerKey);}catch{}
 }
 async function practiced(){try{const reg=registration||await navigator.serviceWorker?.getRegistration('/');if(reg)for(const n of await reg.getNotifications({tag:'san-dojo-daily'}))n.close();}catch{}}
 document.addEventListener('submit',async e=>{if(e.target.id!=='push-form')return;e.preventDefault();
  if(!ready||!DojoAccounts.canStudy())return;
  const form=e.target,data=new FormData(form),match=/^(\d{2}):(\d{2})$/.exec(String(data.get('time')));if(!match||data.get('consent')!=='on')return;
  const next=Number(match[1])*60+Number(match[2]);if(next<0||next>1425||next%15){message('Escolha um horário em intervalos de 15 minutos.',true);return;}
  // A solicitação ocorre diretamente no toque do responsável, antes de qualquer espera.
  const permission=Notification.permission==='default'?Notification.requestPermission():Promise.resolve(Notification.permission);
  form.querySelectorAll('button').forEach(b=>b.disabled=true);
  try{if(await permission!=='granted')throw new Error('Permissão não concedida. Para ativar, permita as notificações do San Dojo nas configurações do celular.');
   subscription=await registration.pushManager.getSubscription()||await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:decode(publicKey)});
   const payload=subscription.toJSON();check(await DojoAccounts.client.rpc('dojo_push_subscribe',{p_endpoint:payload.endpoint,p_p256dh:payload.keys.p256dh,p_auth:payload.keys.auth,p_minute:next,p_confirm:true}));
   minute=next;enabled=true;try{localStorage.setItem(ownerKey,DojoAccounts.user.id);}catch{}error='';update();message('Pronto! Lembrete ativo às '+timeString(minute)+' de Brasília, quando faltar praticar.');
  }catch(e){update();message(e.message||'Não foi possível ativar. Tente novamente.',true);}
 });
 document.addEventListener('click',async e=>{const b=e.target.closest('[data-push-off],[data-push-off-all],[data-push-test],[data-push-retry]');if(!b||!DojoAccounts.user)return;b.disabled=true;
  try{if(b.hasAttribute('data-push-retry')){ready=false;await mount(true);return;}
   if(b.hasAttribute('data-push-test')){if(!enabled||!subscription)return;const result=await functionResult(await DojoAccounts.client.functions.invoke('dojo-push',{body:{action:'test',endpoint:subscription.endpoint}}));if(!result.sent)throw new Error('Não foi possível enviar o teste. Confira a permissão do aparelho.');message('Teste enviado pelo San Dojo. Confira as notificações do seu aparelho.');}
   else{await pause(b.hasAttribute('data-push-off-all'));update();message('Lembretes desativados.');}
  }catch(e){message(e.message||'Não foi possível concluir. Tente novamente.',true);}finally{b.disabled=false;}
 });
 return {markup,mount,pause,practiced};
})();

window.DojoPush=DojoPush;
