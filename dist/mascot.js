(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./streaks.js'):root.DojoStreaks);if(typeof module==='object'&&module.exports)module.exports=api;else root.DojoMascot=api;})(typeof globalThis!=='undefined'?globalThis:this,S=>{
 'use strict';
 const base='assets/celebrations/';
 const clips=[{id:'joinha',label:'Dois joinhas para você!'},{id:'vitoria',label:'Salto da vitória!'},{id:'palmas',label:'Uma salva de palmas!'},{id:'toque',label:'Toca aqui, karateca!'},{id:'forte',version:2,label:'Mais forte a cada passo!'}];
 const states={
  pronto:{label:'Pronto para aprender',image:'assets/sensei-cartoon-limpo.png',message:'Seu sensei está com você. Vamos dar um pequeno passo hoje?'},
  feliz:{label:'Sensei feliz',image:'assets/sensei-comemorando-v1.png',message:'Três dias ou mais de constância. Cada pequeno passo faz diferença!'},
  forte:{label:'Sensei forte e feliz',image:base+'forte-v1.webp',message:'Uma semana de constância! Seu sensei comemora essa dedicação.'},
  radiante:{label:'Sensei fortão e radiante',image:base+'radiante-v2.webp',message:'Duas semanas ou mais de constância! Seu sensei comemora essa dedicação com muita força e alegria.'},
  triste:{label:'Sensei com saudade',image:base+'triste-v1.webp',message:'Seu sensei está com saudade. Uma atividade já é um recomeço.'},
  cansado:{label:'Sensei cansado',image:base+'cansado-v1.webp',message:'O dojo ficou quietinho. Volte no seu ritmo: uma atividade já muda o dia.'},
  nocauteado:{label:'Sensei sem energia',image:base+'nocauteado-v1.webp',message:'Seu sensei está recarregando. Que tal acordar o dojo com uma atividade?'}
 };
 function mood(days,today){
  if(!S.valid(today))throw new Error('Data inválida');
  const summary=S.summary(days,today),last=summary.days.at(-1);
  // Yesterday is still an active streak; a day is missed only after it has ended.
  const missed=last?Math.max(0,Math.round((Date.parse(today+'T12:00:00Z')-Date.parse(last+'T12:00:00Z'))/86400000)-1):0;
  const id=!last?'pronto':missed>=14?'nocauteado':missed>=7?'cansado':missed>=3?'triste':summary.current>=14?'radiante':summary.current>=7?'forte':summary.current>=3?'feliz':'pronto';
  return {id,...states[id],current:summary.current,missed,todayDone:summary.todayDone};
 }
 const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function portrait(days,today,className=''){const m=mood(days,today);return `<span class="sensei-mood-art mood-${m.id}" data-mascot-mood="${m.id}">${m.id==='nocauteado'?'<span class="sensei-knockout">':''}<img class="sensei-image ${escape(className)}" src="${m.image}" alt="${m.label}" data-dojo-mascot>${m.id==='nocauteado'?'<span class="sensei-star-orbit" aria-hidden="true"><i>✦</i><i>✦</i><i>✦</i><i>✦</i><i>✦</i></span></span>':''}</span>`;}
 function status(days,today){const m=mood(days,today);return `<div class="sensei-mood-status" data-mascot-status="${m.id}"><b>${m.label}</b><span>${m.message}</span><a href="#sequence">${m.current?m.current+' '+(m.current===1?'dia seguido':'dias seguidos')+' · ':''}Ver minha sequência →</a></div>`;}
 const key='san-dojo-celebration-v1';let memory={bag:[],last:''};
 function next(storage,random=Math.random){
  let saved=memory;try{const parsed=JSON.parse(storage?.getItem(key)||'null');if(parsed&&Array.isArray(parsed.bag)&&parsed.bag.every(id=>clips.some(c=>c.id===id))&&new Set(parsed.bag).size===parsed.bag.length)saved=parsed;}catch{}
  let bag=[...saved.bag];
  if(!bag.length){bag=clips.map(c=>c.id);for(let i=bag.length-1;i>0;i--){const j=Math.min(i,Math.max(0,Math.floor(random()*(i+1))));[bag[i],bag[j]]=[bag[j],bag[i]];}if(bag[0]===saved.last)[bag[0],bag[1]]=[bag[1],bag[0]];}
  const id=bag.shift();memory={bag,last:id};try{storage?.setItem(key,JSON.stringify(memory));}catch{}return clips.find(c=>c.id===id);
 }
 function reduced(){return typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches;}
 function videoMarkup(clip,{reduce=reduced()}={}){const version=clip.version||1,poster=base+clip.id+'-v'+version+'.webp',src=base+clip.id+'-v'+version+'.mp4';return `<div class="celebration-player" data-celebration="${clip.id}"><div class="celebration-stage"><video ${reduce?'hidden data-src="'+src+'"':'src="'+src+'" autoplay'} muted playsinline preload="${reduce?'none':'metadata'}" poster="${poster}" aria-label="${clip.label}"></video><img class="celebration-poster" src="${poster}" alt="${clip.label}" ${reduce?'':'hidden'}></div><span class="celebration-title">${clip.label}</span><div class="celebration-controls"><button type="button" data-celebration-skip ${reduce?'hidden':''}>Pular animação</button><button type="button" data-celebration-replay>${reduce?'Reproduzir animação':'Repetir animação'}</button></div><small class="celebration-caption">${reduce?'Movimentos reduzidos: toque para reproduzir.':'Seu resultado já está disponível abaixo.'}</small></div>`;}
 function stop(scope=typeof document!=='undefined'?document:null){scope?.querySelectorAll?.('.celebration-player video').forEach(v=>v.pause());}
 function mount(scope=typeof document!=='undefined'?document:null){
  scope?.querySelectorAll?.('.celebration-player').forEach(player=>{
   if(player.dataset.mounted)return;player.dataset.mounted='true';const video=player.querySelector('video'),poster=player.querySelector('.celebration-poster'),skip=player.querySelector('[data-celebration-skip]'),replay=player.querySelector('[data-celebration-replay]'),caption=player.querySelector('.celebration-caption');
   const still=()=>{video.pause();video.hidden=true;poster.hidden=false;skip.hidden=true;};
   video.addEventListener('ended',()=>{skip.hidden=true;});
   video.addEventListener('error',()=>{still();caption.textContent='A imagem continua aqui. Toque em repetir para tentar o vídeo novamente.';});
   skip.addEventListener('click',still);
   const play=()=>{if(!video.getAttribute('src'))video.src=video.dataset.src;video.hidden=false;poster.hidden=true;skip.hidden=false;video.muted=true;video.currentTime=0;const promise=video.play();promise?.catch(()=>{still();caption.textContent='Toque em reproduzir para ver a comemoração.';});};
   replay.addEventListener('click',()=>{replay.textContent='Repetir animação';play();});
   if(!video.hidden){if(reduced())still();else play();}
  });
 }
 function finish(){let storage;try{storage=typeof localStorage!=='undefined'?localStorage:undefined;}catch{}return videoMarkup(next(storage));}
 return {clips,states,mood,portrait,status,next,videoMarkup,mount,stop,finish};
});
