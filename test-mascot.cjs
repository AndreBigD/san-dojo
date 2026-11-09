const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const M=require('./dist/mascot.js'),S=require('./dist/streaks.js');
const today='2026-11-09',streak=n=>Array.from({length:n},(_,i)=>S.shift(today,-i));
test('mascot uses completed practice days, not XP, and reaches happy, strong and radiant milestones',()=>{
 assert.equal(M.mood([],today).id,'pronto');assert.equal(M.mood(streak(3),today).id,'feliz');assert.equal(M.mood(streak(7),today).id,'forte');assert.equal(M.mood(streak(14),today).id,'radiante');
 assert.equal(M.mood(streak(14).map(d=>S.shift(d,-1)),today).id,'radiante','Yesterday keeps a current streak until midnight');
 const noisy=[...streak(7),...streak(7),'2026-02-30','garbage','2026-11-10'];assert.equal(M.mood(noisy,today).current,7);
});
test('only full missed days affect mood, and a completed return immediately recovers it',()=>{
 for(const [missed,id] of [[0,'pronto'],[2,'pronto'],[3,'triste'],[6,'triste'],[7,'cansado'],[13,'cansado'],[14,'nocauteado']]){
  const history=[S.shift(today,-missed-1)];assert.equal(M.mood(history,today).id,id);assert.equal(M.mood(history,today).missed,missed);
  assert.equal(M.mood([...history,today],today).id,'pronto');
 }
 assert.equal(M.mood(['2026-10-31'],'2026-11-04').id,'triste');assert.equal(M.mood(['2024-02-29'],'2024-03-04').id,'triste');
 assert.throws(()=>M.mood([], '2026-02-30'));
});
test('all five celebrations occur before reuse, persist across reloads, and never repeat consecutively',()=>{
 const store=new Map(),storage={getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v)};const ids=[];
 for(let i=0;i<20;i++){delete require.cache[require.resolve('./dist/mascot.js')];ids.push(require('./dist/mascot.js').next(storage,()=>.5).id);}
 for(let i=0;i<20;i+=5)assert.equal(new Set(ids.slice(i,i+5)).size,5);
 ids.forEach((id,i)=>{if(i)assert.notEqual(id,ids[i-1]);});assert.equal(store.size,1);
 const denied={getItem(){throw Error('denied');},setItem(){throw Error('denied');}};assert.doesNotThrow(()=>M.next(denied));
 storage.setItem('san-dojo-celebration-v1','{"bag":["invalid"]}');const selected=M.next(storage).id;assert.ok(M.clips.some(c=>c.id===selected));
});
test('clips have iPhone inline/muted playback, explicit replay/skip, reduced motion and available distinct media',()=>{
 const crypto=require('node:crypto'),hashes=[];
 for(const c of M.clips){const html=M.videoMarkup(c,{reduce:false});assert.match(html,/autoplay/);assert.match(html,/muted playsinline/);assert.match(html,/data-celebration-skip/);assert.match(html,/data-celebration-replay/);
  const reduced=M.videoMarkup(c,{reduce:true});assert.doesNotMatch(reduced,/autoplay/);assert.match(reduced,/preload="none"/);assert.match(reduced,/<video hidden data-src=/);
  for(const ext of ['mp4','webp'])assert.ok(fs.statSync('./dist/assets/celebrations/'+c.id+'-v1.'+ext).size>1000);
  const bytes=fs.readFileSync('./dist/assets/celebrations/'+c.id+'-v1.mp4');assert.match(bytes.subarray(0,40).toString('ascii'),/ftyp/);hashes.push(crypto.createHash('sha256').update(bytes).digest('hex'));
 }
 assert.equal(new Set(hashes).size,5);for(const mood of Object.values(M.states))assert.ok(fs.existsSync('./dist/'+mood.image));
 assert.doesNotMatch(M.portrait([S.shift(today,-20)],today),/descansando-v1/);assert.match(M.portrait([S.shift(today,-20)],today),/sensei-star-orbit/);
});
test('video controls actually play, stop, replay and recover from errors without blocking the result',async()=>{
 const listeners={},skip={hidden:false,addEventListener:(e,fn)=>listeners.skip=fn},replay={textContent:'Repetir animação',addEventListener:(e,fn)=>listeners.replay=fn},poster={hidden:true},caption={textContent:''};
 let plays=0,pauses=0;const events={},video={hidden:false,dataset:{},src:'clip.mp4',currentTime:0,getAttribute:k=>video[k],addEventListener:(e,fn)=>events[e]=fn,play(){plays++;return Promise.resolve();},pause(){pauses++;}};
 const player={dataset:{},querySelector:s=>s==='video'?video:s==='.celebration-poster'?poster:s==='[data-celebration-skip]'?skip:s==='[data-celebration-replay]'?replay:caption};
 const scope={querySelectorAll:s=>s==='.celebration-player'?[player]:[video]};
 M.mount(scope);assert.equal(plays,1);assert.equal(video.muted,true);M.mount(scope);assert.equal(plays,1);
 listeners.skip();assert.equal(video.hidden,true);assert.equal(poster.hidden,false);listeners.replay();assert.equal(plays,2);assert.equal(video.hidden,false);
 events.ended();assert.equal(skip.hidden,true);events.error();assert.equal(poster.hidden,false);assert.match(caption.textContent,/imagem/);
 M.stop(scope);assert.ok(pauses>=3);
 video.play=()=>Promise.reject(Error('autoplay denied'));listeners.replay();await Promise.resolve();assert.equal(poster.hidden,false);assert.match(caption.textContent,/reproduzir/);
});
