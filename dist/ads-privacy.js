// Nunca carregue publicidade em uma URL que ainda contém o retorno de autenticação.
window.DojoAds=(()=>{
 const source='https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-5063659659808556';
 function load(){
  // Telas de conta, atividades e administração não são espaços de publicidade.
  if(document.getElementById('lesson')||document.querySelector('[data-private-dojo]'))return false;
  if(window.SAN_DOJO_CONFIG?.adsEnabled!==true||!window.DojoAccounts?.canStudy())return false;
  const url=new URL(location.href);
  if(url.protocol!=='https:'||url.hostname==='localhost'||url.hostname==='127.0.0.1')return false;
  if(['code','access_token','refresh_token','id_token','error'].some(key=>url.searchParams.has(key))||/(?:^#|[&?])(access_token|refresh_token|id_token|code)=/.test(url.hash))return false;
  if(document.getElementById('dojo-adsense-loader'))return true;
  const script=document.createElement('script');script.async=true;script.src=source;script.crossOrigin='anonymous';script.id='dojo-adsense-loader';document.head.appendChild(script);return true;
 }
 load();return {load};
})();
