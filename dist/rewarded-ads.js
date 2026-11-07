// Ad Placement API: recompensa somente no callback adViewed. Nunca por clique ou temporizador.
// As três opções ficam falsas até a aprovação do AdSense, habilitação H5 e controles aplicáveis.
window.DojoRewarded=(()=>{
 let loading=null,busy=false;
 function available(){const config=window.SAN_DOJO_CONFIG||{},account=typeof DojoAccounts==='undefined'?null:DojoAccounts;return config.adsEnabled===true&&config.rewardedAdsEnabled===true&&config.rewardedAdsConsentReady===true&&location.protocol==='https:'&&Boolean(account?.canStudy())&&!document.getElementById('lesson')?.open;}
 function load(){
  if(!available())return Promise.reject(new Error('Anúncios recompensados indisponíveis'));
  if(loading)return loading;
  loading=new Promise((resolve,reject)=>{
   // Não reutiliza silenciosamente um carregamento de publicidade de outro formato.
   if(document.getElementById('dojo-adsense-loader')){reject(new Error('Recarregue antes de usar o formato recompensado'));return;}
   window.adsbygoogle=window.adsbygoogle||[];
   window.adsbygoogle.requestNonPersonalizedAds=1;
   window.adBreak=window.adBreak||function(options){window.adsbygoogle.push(options);};
   const tag=document.createElement('script');tag.id='dojo-h5-rewarded-loader';tag.async=true;tag.crossOrigin='anonymous';
   tag.src='https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-5063659659808556';
   const deadline=setTimeout(()=>reject(new Error('Serviço indisponível')),15000);
   tag.onload=()=>{clearTimeout(deadline);resolve();};tag.onerror=()=>{clearTimeout(deadline);reject(new Error('Serviço indisponível'));};
   document.head.appendChild(tag);
  }).catch(error=>{loading=null;document.getElementById('dojo-h5-rewarded-loader')?.remove();throw error;});return loading;
 }
 async function watch(grant){
  if(busy||!available())throw new Error('Anúncio indisponível');busy=true;
  try{await load();if(!available())return 0;
   return await new Promise((resolve,reject)=>{
    let settled=false,granted=false,amount=0,offer=null;
    const finish=()=>{if(settled)return;settled=true;clearTimeout(deadline);offer?.remove();resolve(amount);};
    const deadline=setTimeout(finish,30000);
    try{window.adBreak({type:'reward',name:'san-dojo-energy',
     beforeReward(showAd){
      if(settled||!available()){finish();return;}clearTimeout(deadline);
      offer=document.createElement('div');offer.className='learning-callout';
      const text=document.createElement('p');text.textContent='Anúncio recompensado opcional: conclua para receber +5 energias. Fechar antes não concede energia.';
      const yes=document.createElement('button');yes.className='primary';yes.textContent='Assistir agora e ganhar +5';
      const no=document.createElement('button');no.className='outline';no.textContent='Agora não';
      yes.onclick=()=>{if(settled)return;offer.remove();document.getElementById('energy-dialog')?.close();showAd();};
      no.onclick=finish;offer.append(text,yes,no);document.getElementById('energy-content').appendChild(offer);
     },
     beforeAd(){clearTimeout(deadline);window.speechSynthesis?.cancel();document.querySelectorAll('audio').forEach(audio=>audio.pause());},
     adViewed(){if(settled||granted)return;granted=true;if(DojoAccounts.canStudy())amount=grant();},
     adDismissed:finish,adBreakDone:finish});
    }catch(error){clearTimeout(deadline);offer?.remove();reject(error);}
   });
  }finally{busy=false;}
 }
 return {available,watch};
})();
