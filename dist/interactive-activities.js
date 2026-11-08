(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.DojoActivities=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
const stepSkills=new Set(['descricao','classificacao','integracao','contraste','reconstrucao','composicao','relacao','transicao','aplicacao','transferencia','sintese']);
const clean=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const shuffle=items=>{const out=[...items];for(let i=out.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[out[i],out[j]]=[out[j],out[i]];}return out;};
let current=null;
function hasSteps(q){return q.type==='input'&&stepSkills.has(q.skill)&&Array.isArray(q.context)&&q.context.length>=2;}
function supports(q){return q.type==='match'||hasSteps(q);}
function createPairs(n){return {pairs:Array(n).fill(null),selected:null};}
function selectPair(state,side,id){
 const next={pairs:[...state.pairs],selected:state.selected};
 if(!Number.isInteger(id)||id<0||id>=next.pairs.length)return next;
 if(side==='name'){next.selected=id;return next;}
 if(side!=='meaning'||next.selected===null)return next;
 const owner=next.pairs.indexOf(id);if(owner>=0)next.pairs[owner]=null;
 next.pairs[next.selected]=id;next.selected=null;return next;
}
const pairsComplete=state=>state.pairs.length>0&&state.pairs.every(Number.isInteger)&&new Set(state.pairs).size===state.pairs.length;
const pairsCorrect=state=>pairsComplete(state)&&state.pairs.every((value,index)=>value===index);
const joinSteps=values=>values.map(value=>String(value).trim()).join(' ');
const coach=()=>'<div class="mission-coach"><img src="assets/sensei-pensativo-v1.png" alt="" aria-hidden="true"><div><b>Uma descoberta por vez.</b><span data-mission-status aria-live="polite">Prepare suas respostas. Depois, confira com o sensei.</span></div></div>';
function markup(q){
 if(!supports(q))return '';
 if(q.type==='match')return `<section id="activity-interaction" class="pair-mission" aria-label="Associação de técnicas e significados">${coach()}<p class="mission-instruction">Toque em um nome e depois no significado. Você pode refazer os pares antes de verificar.</p><div class="pair-columns"><div><h3>TÉCNICA</h3>${shuffle(q.pairs.map((pair,i)=>({pair,i}))).map(({pair,i})=>`<button type="button" class="pair-card" data-pair-name="${i}" aria-pressed="false"><span data-pair-badge></span>${clean(pair.name)}</button>`).join('')}</div><div><h3>SIGNIFICADO</h3>${shuffle(q.pairs.map((pair,i)=>({pair,i}))).map(({pair,i})=>`<button type="button" class="pair-card" data-pair-meaning="${i}" aria-pressed="false"><span data-pair-badge></span>${clean(pair.meaning)}</button>`).join('')}</div></div><button type="button" class="text-button" data-pair-reset>Refazer meus pares</button><small class="mission-note">A nota considera sua primeira verificação do conjunto completo.</small></section>`;
 const n=q.context.length,limit=Math.floor((600-(n-1))/n);
 return `<section id="activity-interaction" class="step-mission" aria-label="Desafio em etapas">${coach()}<div class="mission-meter" aria-hidden="true"><span data-mission-fill></span></div><div class="mission-steps" aria-label="Etapas da resposta">${q.context.map((_,i)=>`<button type="button" data-step-jump="${i}" aria-label="Ir para o passo ${i+1}" ${i===0?'aria-current="step"':''}>${i+1}</button>`).join('')}</div><form id="written-form">${q.context.map((line,i)=>`<div class="mission-card" data-step-panel="${i}" ${i?'hidden':''}><span class="eyebrow">PASSO ${i+1} DE ${n}</span><label for="mission-answer-${i}">${clean(line)}</label><input id="mission-answer-${i}" class="mission-input" data-step-answer="${i}" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" maxlength="${limit}" placeholder="Escreva sua resposta em romaji"><div class="mission-controls"><button type="button" class="text-button" data-step-previous ${i===0?'disabled':''}>← Anterior</button><button type="button" class="outline" data-step-next ${i===n-1?'hidden':''}>Próximo passo →</button></div></div>`).join('')}</form><small class="mission-note">Todos os passos serão conferidos juntos. Avançar um cartão não confirma um acerto.</small></section>`;
}
function mount(q,scope,{changed=()=>{},read=()=>{}}={}){
 current=null;if(!scope||!supports(q))return;
 const session={q,scope,changed,locked:false,step:0,values:hasSteps(q)?q.context.map(()=>''):[],matching:q.type==='match'?createPairs(q.pairs.length):null};current=session;
 const all=selector=>[...scope.querySelectorAll(selector)],one=selector=>scope.querySelector(selector);
 function update(){
  if(session.matching){
   const state=session.matching,count=state.pairs.filter(Number.isInteger).length;
   for(const button of all('[data-pair-name],[data-pair-meaning]')){
    const left=button.hasAttribute('data-pair-name'),id=Number(left?button.dataset.pairName:button.dataset.pairMeaning),owner=left?id:state.pairs.indexOf(id),paired=owner>=0&&Number.isInteger(state.pairs[owner]),selected=left?state.selected===id:state.selected!==null&&state.pairs[state.selected]===id;
    button.classList.toggle('paired',paired);button.classList.toggle('pair-selected',selected);button.setAttribute('aria-pressed',String(selected));button.querySelector('[data-pair-badge]').textContent=paired?String(owner+1):'';
    button.setAttribute('aria-label',(left?q.pairs[id].name:q.pairs[id].meaning)+(paired?`, par ${owner+1}`:''));
   }
   one('[data-mission-status]').textContent=`${count} de ${q.pairs.length} pares preparados. ${pairsComplete(state)?'Confira quando estiver pronto.':'Escolha um nome e um significado.'}`;
   changed(pairsComplete(state));return;
  }
  const count=session.values.filter(value=>value.trim()).length;
  one('[data-mission-status]').textContent=`${count} de ${session.values.length} respostas preparadas. ${count===session.values.length?'Você já pode verificar o desafio.':'Siga no seu ritmo.'}`;
  one('[data-mission-fill]').style.width=`${count/session.values.length*100}%`;
  for(const button of all('[data-step-jump]')){const i=Number(button.dataset.stepJump);button.classList.toggle('step-filled',Boolean(session.values[i].trim()));if(i===session.step)button.setAttribute('aria-current','step');else button.removeAttribute('aria-current');}
  for(const panel of all('[data-step-panel]'))panel.hidden=Number(panel.dataset.stepPanel)!==session.step;
  for(const button of all('[data-step-next]'))button.disabled=!session.values[session.step].trim();
  changed(count===session.values.length);
 }
 function move(index){session.step=Math.max(0,Math.min(session.values.length-1,index));update();one(`[data-step-answer="${session.step}"]`)?.focus();}
 scope.addEventListener('click',event=>{
  if(session.locked)return;
  const name=event.target.closest('[data-pair-name]'),meaning=event.target.closest('[data-pair-meaning]'),jump=event.target.closest('[data-step-jump]');
  if(name){session.matching=selectPair(session.matching,'name',Number(name.dataset.pairName));read(q.pairs[Number(name.dataset.pairName)].name);update();}
  else if(meaning){session.matching=selectPair(session.matching,'meaning',Number(meaning.dataset.pairMeaning));update();}
  else if(event.target.closest('[data-pair-reset]')){session.matching=createPairs(q.pairs.length);update();}
  else if(jump)move(Number(jump.dataset.stepJump));
  else if(event.target.closest('[data-step-next]'))move(session.step+1);
  else if(event.target.closest('[data-step-previous]'))move(session.step-1);
 });
 scope.addEventListener('input',event=>{if(session.locked||!event.target.matches('[data-step-answer]'))return;session.values[Number(event.target.dataset.stepAnswer)]=event.target.value;update();});
 scope.addEventListener('keydown',event=>{if(!session.locked&&event.key==='Enter'&&event.target.matches('[data-step-answer]')){event.preventDefault();if(session.values[session.step].trim()&&session.step<session.values.length-1)move(session.step+1);}});
 update();
}
function value(){return current&&!current.matching?joinSteps(current.values):null;}
function correct(){return Boolean(current?.matching&&pairsCorrect(current.matching));}
function complete(){return Boolean(current&&(current.matching?pairsComplete(current.matching):current.values.every(value=>value.trim())));}
function lock(){if(!current)return;current.locked=true;for(const field of current.scope.querySelectorAll('button,input'))field.disabled=true;}
function clear(){current=null;}
return {hasSteps,supports,markup,mount,value,correct,complete,lock,clear,createPairs,selectPair,pairsComplete,pairsCorrect,joinSteps};
});
