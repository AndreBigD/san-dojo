// Reações visuais do sensei. Não altera nota, XP, energia ou áudio de pronúncia.
const DojoReaction=(()=>{
 const poses={success:'assets/sensei-acerto-v1.png',thinking:'assets/sensei-pensativo-v1.png',celebrate:'assets/sensei-comemorando-v1.png'};
 const clean=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const portrait=(pose='success')=>`<span class="reaction-portrait" aria-hidden="true" data-mascot-pose="${pose}"><img src="${poses[pose]}" alt="" draggable="false" data-dojo-mascot></span>`;
 document.addEventListener?.('error',event=>{const img=event.target;if(img?.matches?.('[data-dojo-mascot]')&&!img.dataset.fallback){img.dataset.fallback='true';img.src='assets/sensei-cartoon-limpo.png';}},true);
 const sparkles=()=>'<span class="reaction-sparkles" aria-hidden="true">'+Array.from({length:7},(_,i)=>`<i style="--piece:${i}">✦</i>`).join('')+'</span>';
 function clear(){if(typeof DojoMascot!=='undefined')DojoMascot.stop();const panel=document.getElementById('feedback');panel.replaceChildren();panel.className='';document.getElementById('lesson').removeAttribute('data-reaction');}
 function show(kind,explanation,{first=true,combo=0,index=0}={}){
  const panel=document.getElementById('feedback'),retry=kind==='retry';
  const titles=retry?['Vamos descobrir juntos!','Uma pista para tentar de novo.','Calma, você está aprendendo!']:first?['Osu! Muito bem!','Isso! Mais um passo no dojo!','Boa! Você mandou bem!']:['Boa! Você encontrou o caminho!'];
  const title=titles[index%titles.length];
  panel.className='mascot-feedback '+(retry?'retry':'correct');
  panel.innerHTML=`<div class="reaction-scene">${portrait(retry?'thinking':first&&combo>=3?'celebrate':'success')}${retry?'':sparkles()}<span class="reaction-mark" aria-hidden="true">${retry?'↻':'✓'}</span></div><div class="reaction-message"><span class="reaction-kicker">SEU SENSEI ESTÁ COM VOCÊ</span><h3>${title}</h3><p>${clean(explanation)}</p>${retry?'<small>Use a pista e tente novamente. Esta questão já conta como revisão na nota.</small>':first&&combo>=2?`<span class="reaction-combo">✦ ${combo} acertos de primeira em sequência!</span>`:!first?'<small>Revisar também faz parte de aprender.</small>':''}</div>`;
  document.getElementById('lesson').setAttribute('data-reaction',retry?'retry':'correct');
  // Mantém o retorno e o botão de continuar visíveis, inclusive em telas pequenas.
  panel.scrollIntoView({block:'nearest',behavior:'auto'});
 }
 function finish(passed){if(passed&&typeof DojoMascot!=='undefined')return `<div class="mascot-finish video-finish">${DojoMascot.finish()}<span class="finish-speech">Osu! Um passo de cada vez.</span></div>`;return `<div class="mascot-finish ${passed?'celebrate':'encourage'}">${portrait(passed?'celebrate':'thinking')}${passed?sparkles():''}<span class="finish-speech">${passed?'Osu! Um passo de cada vez.':'Vamos treinar juntos de novo!'}</span></div>`;}
 return {clear,show,finish};
})();
