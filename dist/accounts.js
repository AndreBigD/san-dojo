const DojoAccounts=(()=>{
 const config=window.SAN_DOJO_CONFIG||{},api={configured:false,localPreview:location.protocol==='file:',user:null,isAdmin:false,active:false,materials:{},approvals:[],error:'',syncMessage:'',client:null};
 let saveTimer,pendingProgress,saving=false;
 const safeKey=k=>typeof k==='string'&&!k.startsWith('sb_secret_')&&(k.startsWith('sb_publishable_')||(()=>{try{return JSON.parse(atob(k.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))).role==='anon';}catch{return false;}})());
 api.configured=typeof config.supabaseUrl==='string'&&/^https:\/\/[a-z0-9.-]+$/i.test(config.supabaseUrl)&&safeKey(config.publishableKey);
 const check=r=>{if(r.error)throw new Error(r.error.message||'Serviço indisponível');return r.data;};
 const notify=()=>window.dispatchEvent(new Event('dojo-account-status'));
 api.ready=(async()=>{
  if(!api.configured)return;
  try{
   api.client=SanDojoSupabase.createClient(config.supabaseUrl,config.publishableKey,{auth:{flowType:'pkce',autoRefreshToken:true,persistSession:true,detectSessionInUrl:true}});
   const session=check(await api.client.auth.getSession());
   if(session.session){
    api.user=check(await api.client.auth.getUser()).user;
    const profile=check(await api.client.from('dojo_profiles').select('id,display_name,active').eq('id',api.user.id).single());
    api.profile=profile;api.active=profile.active;
    api.isAdmin=Boolean(check(await api.client.rpc('dojo_is_admin')));
    await api.loadPrivacy();
    if(api.canStudy()){await api.loadMaterials();api.approvals=check(await api.client.from('dojo_approvals').select('target_id,note,approved_at').eq('user_id',api.user.id));}
   }
   api.client.auth.onAuthStateChange(event=>{if(event==='SIGNED_OUT'||event==='SIGNED_IN'&&!api.user)setTimeout(()=>location.reload(),0);});
  }catch{api.error='Não foi possível conectar as contas. Confira a configuração do serviço e as regras do banco.';api.isAdmin=false;api.active=false;}
 })();
 api.canManage=()=>Boolean(api.configured&&api.user&&api.active&&api.isAdmin&&!api.error);
 api.canStudy=()=>api.localPreview||!api.configured||Boolean(api.user&&api.active&&!api.error&&(api.isAdmin||(['approved','authorized'].includes(api.guardian?.status)&&api.guardian?.consent_version==='2026-10-29.1'&&!['pending','processing'].includes(api.erasure?.status))));
 api.loadPrivacy=async()=>{api.guardian=check(await api.client.from('dojo_guardians').select('*').eq('user_id',api.user.id).maybeSingle());api.erasure=check(await api.client.from('dojo_privacy_requests').select('*').eq('user_id',api.user.id).maybeSingle());};
 api.privacyRpc=async(name,args={})=>{check(await api.client.rpc(name,args));};
 api.privacyQueue=async()=>{if(!api.canManage())throw new Error('Acesso exclusivo do administrador.');return {guardians:check(await api.client.from('dojo_guardians').select('*').order('requested_at',{ascending:false})),requests:check(await api.client.from('dojo_privacy_requests').select('*').in('status',['pending','processing']).order('requested_at'))};};
 api.signIn=async provider=>{
  if(!api.configured||!config[provider+'Enabled'])throw new Error('Este acesso ainda precisa ser ativado na configuração do San Dojo.');
  if(location.protocol!=='https:'&&!['localhost','127.0.0.1'].includes(location.hostname))throw new Error('Abra o endereço online do San Dojo para entrar.');
  const redirectTo=location.origin+location.pathname;
  check(await api.client.auth.signInWithOAuth({provider,options:{redirectTo,queryParams:provider==='google'?{prompt:'select_account'}:undefined}}));
 };
 api.signOut=async()=>{try{await window.DojoPush?.pause();}catch{}await api.flush();check(await api.client.auth.signOut());location.reload();};
 api.loadMaterials=async()=>{
  const rows=check(await api.client.from('dojo_materials').select('*'));
  api.materials=Object.fromEntries(rows.map(r=>[r.target_id,{title:r.title,description:r.description,youtubeId:r.youtube_id,videoKey:r.video_path?'cloud:'+r.video_path:null,imageKey:r.image_path?'cloud:'+r.image_path:null,cloud:true}]));return api.materials;
 };
 api.signedUrl=async path=>check(await api.client.storage.from('dojo-exercises').createSignedUrl(path,3600)).signedUrl;
 api.saveMaterial=async(id,fields,video,image)=>{
  if(!api.canManage())throw new Error('Somente sua conta de administrador pode alterar materiais.');
  const old=api.materials[id]||{},paths=[];let videoPath=old.videoKey?.replace(/^cloud:/,''),imagePath=old.imageKey?.replace(/^cloud:/,''),youtubeId=fields.youtubeId||null;
  const upload=async(file,kind)=>{const ext=kind==='image'?({'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[file.type]):file.name.toLowerCase().endsWith('.webm')?'webm':'mp4';const path=`materials/${id}/${crypto.randomUUID()}.${ext}`;check(await api.client.storage.from('dojo-exercises').upload(path,file,{contentType:file.type,upsert:false}));paths.push(path);return path;};
  try{
   if(video){videoPath=await upload(video,'video');youtubeId=null;}else if(youtubeId)videoPath=null;
   if(image)imagePath=await upload(image,'image');
   check(await api.client.from('dojo_materials').upsert({target_id:id,title:fields.title,description:fields.description,youtube_id:youtubeId,video_path:videoPath||null,image_path:imagePath||null,updated_at:new Date().toISOString()}));
  }catch(error){if(paths.length)await api.client.storage.from('dojo-exercises').remove(paths);throw error;}
  const stale=[old.videoKey,old.imageKey].filter(Boolean).map(p=>p.replace(/^cloud:/,'')).filter(p=>p!==videoPath&&p!==imagePath);
  if(stale.length)await api.client.storage.from('dojo-exercises').remove(stale);
  return api.loadMaterials();
 };
 api.removeMaterial=async id=>{if(!api.canManage())throw new Error('Apenas o administrador pode remover materiais.');const old=api.materials[id];check(await api.client.from('dojo_materials').delete().eq('target_id',id));const paths=[old?.videoKey,old?.imageKey].filter(Boolean).map(p=>p.replace(/^cloud:/,''));if(paths.length)await api.client.storage.from('dojo-exercises').remove(paths);return api.loadMaterials();};
 api.loadProgress=async()=>{if(!api.canStudy())return null;const row=check(await api.client.from('dojo_progress').select('data').eq('user_id',api.user.id).maybeSingle());api.progressLoaded=true;return row?.data||null;};
 api.queueProgress=progress=>{if(!api.canStudy()||api.error||!api.progressLoaded)return;const {media,...own}=progress;pendingProgress=JSON.parse(JSON.stringify(own));api.syncMessage='Salvamento pendente';clearTimeout(saveTimer);saveTimer=setTimeout(()=>api.flush(),900);};
 api.flush=async()=>{
  if(!api.canStudy()){pendingProgress=null;clearTimeout(saveTimer);return;}if(saving||!pendingProgress)return;saving=true;clearTimeout(saveTimer);
  try{while(pendingProgress){const snapshot=pendingProgress;pendingProgress=null;const result=await api.client.from('dojo_progress').upsert({user_id:api.user.id,data:snapshot,updated_at:new Date().toISOString()});if(result.error){pendingProgress??=snapshot;throw result.error;}}api.syncMessage='Progresso salvo na sua conta';}
  catch{api.syncMessage='Sem sincronização. Seu progresso continua salvo neste navegador.';}
  finally{saving=false;notify();}
 };
 api.students=async()=>{if(!api.canManage())throw new Error('Acesso exclusivo do administrador.');return check(await api.client.from('dojo_profiles').select('id,display_name,email,active,created_at').order('created_at',{ascending:false}));};
 api.setActive=async(id,value)=>{if(!api.canManage()||id===api.user.id)throw new Error('Acesso não permitido.');check(await api.client.from('dojo_profiles').update({active:Boolean(value)}).eq('id',id));};
 api.studentProgress=async id=>check(await api.client.from('dojo_progress').select('data').eq('user_id',id).maybeSingle());
 api.approve=async(id,target,note)=>{if(!api.canManage())throw new Error('Apenas o sensei pode registrar a prática.');check(await api.client.from('dojo_approvals').upsert({user_id:id,target_id:target,note:String(note||'').slice(0,300),approved_at:new Date().toISOString()}));};
 api.providerEnabled=provider=>Boolean(api.configured&&config[provider+'Enabled']);
 return api;
})();

function accountPage(){const A=DojoAccounts;if(A.user)return `<section class="animate-in"><div class="eyebrow">SUA CONTA SAN DOJO</div><h1>${esc(A.profile?.display_name||'Minha conta')}</h1><p class="intro">${A.isAdmin?'Administrador · somente você gerencia os exercícios.':'Aluno · estudar, praticar e assistir às demonstrações.'}</p>${A.error?`<p role="alert">${esc(A.error)}</p>`:!A.active?'<div class="learning-callout"><b>Acesso pausado pelo sensei.</b><p>Entre em contato com o San Dojo para retomar as atividades.</p></div>':''}<div class="info-panel"><h2>${A.isAdmin?'Seu painel do sensei':'Seu aprendizado acompanha sua conta'}</h2><p id="account-sync-status">${esc(A.syncMessage||'Seu progresso fica separado das outras contas.')}</p><p>Entre com a mesma conta e provedor nos seus aparelhos. Os materiais dos exercícios são compartilhados pelo sensei.</p>${A.canManage()?'<button class="primary" data-view="library">Gerenciar vídeos e imagens →</button><button class="outline" data-show-students>Ver alunos cadastrados →</button>':''}<button class="outline" data-view="subscription">San Dojo Plus · gerenciar assinatura →</button><button class="text-button" data-sign-out>Sair da conta</button></div>${A.canManage()?'<div id="students-panel"></div>':''}</section>`;return `<section class="animate-in account-page"><div class="eyebrow">BEM-VINDO AO SAN DOJO</div><h1>Seu caminho começa aqui</h1><p class="intro">Entre com sua conta Google ou Apple. No primeiro acesso, seu cadastro de aluno é criado automaticamente.</p><div class="info-panel account-card"><img src="assets/san-dojo-logo-transparente.png" alt="San Dojo Karate"><h2>Entrar ou criar minha conta</h2><button class="outline social-login" data-sign-in="google" ${A.providerEnabled('google')?'':'disabled'}><span aria-hidden="true">G</span> Continuar com Google</button><button class="primary social-login" data-sign-in="apple" ${A.providerEnabled('apple')?'':'disabled'}><span aria-hidden="true">●</span> Continuar com Apple</button><p class="week-note">Não pedimos sua senha do Google ou da Apple. Você pode usar sua conta Google tanto no iPhone quanto no Android.</p>${!A.configured?'<div class="learning-callout"><b>Contas ainda não ativadas.</b><p>Esta é a prévia local. O acesso social e as permissões serão ativados após conectar o serviço de contas e publicar o endereço do San Dojo.</p></div>':A.error?`<p role="alert">${esc(A.error)}</p>`:'<p class="week-note">Se um botão estiver indisponível, esse provedor ainda precisa ser ativado pelo San Dojo.</p>'}<p class="week-note">Crianças devem acessar com acompanhamento do responsável.</p><p class="week-note"><a href="privacidade.html">Privacidade, cookies e contato do responsável</a></p><p class="week-note"><a href="sobre.html">Conheça o San Dojo antes de entrar</a> · <a href="termos.html">Termos de uso</a></p><p id="account-action-status" role="status"></p></div></section>`;}
function readOnlyLibrary(){return `<section class="animate-in"><div class="eyebrow">MATERIAIS DO SENSEI</div><h1>Demonstrações para estudar</h1><div class="learning-callout"><b>Vídeos e imagens são gerenciados somente pelo administrador.</b><p>${DojoAccounts.configured?'Sua conta de aluno pode assistir aos materiais.':'Na prévia local, a edição fica bloqueada. Conecte as contas e autorize seu usuário de administrador para gerenciar os materiais.'}</p><button class="outline" data-view="account">${DojoAccounts.user?'Ver minha conta':'Entrar na minha conta'} →</button></div><div class="info-panel">${Object.entries(state.media).filter(([id])=>mediaTarget(id)).map(([id,v])=>`<article class="saved-media"><div><b>${esc(v.title||'Material do sensei')}</b><small>${esc(mediaTarget(id).module.title)} · ${esc(mediaTarget(id).phase.title)}</small></div><button class="outline" data-preview-material="${id}">Ver material →</button></article>`).join('')||'<p>Os materiais do sensei aparecerão aqui quando estiverem disponíveis. Os áudios e as referências iniciais continuam nos módulos.</p>'}</div></section>`;}
async function showStudents(){const panel=$('#students-panel');if(!panel)return;panel.textContent='Carregando alunos…';try{const students=await DojoAccounts.students();panel.innerHTML=`<div class="info-panel"><h2>Alunos cadastrados</h2><p>O cadastro acontece no primeiro acesso com Google ou Apple. Você pode pausar o acesso de um aluno.</p>${students.filter(u=>u.id!==DojoAccounts.user.id).map(u=>`<article class="saved-media"><div><b>${esc(u.display_name)}</b><small>${esc(u.email||'Conta Apple com e-mail protegido')}</small><small>${u.active?'Acesso ativo':'Acesso pausado'}</small></div><button class="text-button" data-student-practice="${u.id}">Ver progresso</button><button class="outline" data-student-active="${u.id}" data-active="${u.active?'false':'true'}">${u.active?'Pausar acesso':'Reativar'}</button></article>`).join('')||'<p>Nenhum aluno cadastrado ainda.</p>'}<div id="student-practice-panel"></div></div>`;}catch{panel.textContent='Não foi possível carregar a lista de alunos.';}}
async function showStudentPractice(id){const panel=$('#student-practice-panel');if(!panel)return;panel.textContent='Carregando progresso…';try{const row=await DojoAccounts.studentProgress(id),p=row?.data,rank=p?.game?.belt??0;panel.innerHTML=`<div class="learning-callout"><h3>Progresso do aluno</h3><p>Faixa ilustrativa: ${esc(G.BELTS[rank]?.name||'Branca')}. O avanço é automático pelas fases aprovadas e pelo XP semanal.</p><p>O app não confirma execução física. A orientação e a graduação real continuam no dojo.</p></div>`;}catch{panel.textContent='Não foi possível consultar este progresso.';}}
document.addEventListener('click',async event=>{
 const e=event.target,login=e.closest('[data-sign-in]');
 if(login){try{await DojoAccounts.signIn(login.dataset.signIn);}catch(error){$('#account-action-status').textContent=error.message;}return;}
 if(e.closest('[data-sign-out]')){try{await DojoAccounts.signOut();}catch{toast('Não foi possível sair. Tente novamente.');}return;}
 if(e.closest('[data-show-students]')){await showStudents();return;}
 const active=e.closest('[data-student-active]');if(active){active.disabled=true;try{await DojoAccounts.setActive(active.dataset.studentActive,active.dataset.active==='true');await showStudents();}catch{toast('Não foi possível alterar o acesso.');active.disabled=false;}return;}
 const practice=e.closest('[data-student-practice]');if(practice){await showStudentPractice(practice.dataset.studentPractice);return;}
 const approve=e.closest('[data-record-practice]');if(approve){if(!$('#student-observed')?.checked){toast('Confirme a observação da prática.');return;}approve.disabled=true;try{await DojoAccounts.approve(approve.dataset.recordPractice,approve.dataset.practiceTarget,$('#student-practice-note').value);toast('Prática registrada na conta do aluno.');}catch{toast('Não foi possível registrar a prática.');approve.disabled=false;}}
});
window.addEventListener('dojo-account-status',()=>{const node=document.getElementById('account-sync-status');if(node)node.textContent=DojoAccounts.syncMessage;});
