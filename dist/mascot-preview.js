(()=>{
 const today='2026-11-09',routines={pronto:[],feliz:3,forte:7,radiante:14,triste:-4,cansado:-8,nocauteado:-15};
 function mood(){const value=routines[document.getElementById('mood-demo').value],days=Array.isArray(value)?value:value>0?Array.from({length:value},(_,i)=>DojoStreaks.shift(today,-i)):[DojoStreaks.shift(today,value)];document.getElementById('mood-art').innerHTML=DojoMascot.portrait(days,today);document.getElementById('mood-status').innerHTML=DojoMascot.status(days,today);}
 function clip(id){DojoMascot.stop();const selected=DojoMascot.clips.find(c=>c.id===id)||DojoMascot.clips[0];document.getElementById('clip-demo').innerHTML=DojoMascot.videoMarkup(selected);DojoMascot.mount(document.getElementById('clip-demo'));document.querySelectorAll('[data-clip]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.clip===id)));}
 document.getElementById('mood-demo').addEventListener('change',mood);document.querySelectorAll('[data-clip]').forEach(b=>b.addEventListener('click',()=>clip(b.dataset.clip)));document.addEventListener('visibilitychange',()=>{if(document.hidden)DojoMascot.stop();});mood();clip('joinha');
})();
