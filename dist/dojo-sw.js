// Sem cache de páginas, contas, tokens ou materiais privados.
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('push',event=>{
 // Mensagem fixa para não expor dados do aluno na tela bloqueada.
 event.waitUntil(self.registration.showNotification('Seu momento no San Dojo',{
  body:'Que tal concluir uma atividade hoje? Aprenda no seu ritmo.',
  icon:'/assets/san-dojo-logo-transparente.png',badge:'/assets/san-dojo-logo-transparente.png',
  tag:'san-dojo-daily',renotify:false,data:{url:'/#sequence'}
 }));
});
self.addEventListener('notificationclick',event=>{
 event.notification.close();
 event.waitUntil((async()=>{const destination=new URL('/#sequence',self.location.origin).href;const pages=await self.clients.matchAll({type:'window',includeUncontrolled:true});for(const page of pages){if(new URL(page.url).origin===self.location.origin){await page.navigate(destination);return page.focus();}}return self.clients.openWindow(destination);})());
});
