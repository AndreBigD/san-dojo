// Feedback curto, gerado no aparelho; preferências independentes do progresso.
const DojoFeedback=(()=>{
 const key='san-dojo-audio-preferences';let settings={success:true,read:true},context;
 try{settings={...settings,...JSON.parse(localStorage.getItem(key)||'{}')};}catch{}
 const playing=new Set();
 function stop(){for(const oscillator of playing){try{oscillator.stop();}catch{}}playing.clear();}
 function unlock(){if(!settings.success)return;try{const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return;context??=new Audio();if(context.state==='suspended')context.resume().catch(()=>{});}catch{}}
 function success(){if(!settings.success)return;unlock();if(!context)return;try{stop();const start=context.currentTime;[659.25,880,1046.5].forEach((frequency,i)=>{const oscillator=context.createOscillator(),gain=context.createGain(),at=start+i*.085;oscillator.type='sine';oscillator.frequency.value=frequency;gain.gain.setValueAtTime(0,at);gain.gain.linearRampToValueAtTime(.085,at+.012);gain.gain.exponentialRampToValueAtTime(.001,at+.20);oscillator.connect(gain);gain.connect(context.destination);playing.add(oscillator);oscillator.onended=()=>{playing.delete(oscillator);oscillator.disconnect();gain.disconnect();};oscillator.start(at);oscillator.stop(at+.22);});}catch{}}
 function read(text){if(!settings.read||!text)return;stopAudio();stop();const normalize=s=>String(s).trim().normalize('NFKC').toLocaleLowerCase();const value=normalize(text);const entry=Object.entries(JAPANESE_AUDIO).find(([name,item])=>item.voice?.startsWith('ja-')&&(normalize(name)===value||normalize(item.say)===value));if(entry)speak(entry[0]);}
 function sync(){for(const kind of ['success','read']){const button=document.querySelector('[data-feedback-toggle="'+kind+'"]');if(!button)continue;button.setAttribute('aria-pressed',String(Boolean(settings[kind])));button.textContent=(kind==='success'?'♪ Acerto':'◖)) Ler japonês')+(settings[kind]?' ligado':' desligado');}}
 document.addEventListener('click',e=>{const button=e.target.closest('[data-feedback-toggle]');if(!button)return;const kind=button.dataset.feedbackToggle;settings[kind]=!settings[kind];if(!settings.success)stop();if(!settings.read)stopAudio();try{localStorage.setItem(key,JSON.stringify(settings));}catch{}sync();});
 sync();return {unlock,success,read,stop};
})();
