const G=DojoGame,E=DojoEconomy;let state={xp:0,wallet:E.create(),avatar:DojoAvatar.create(),game:G.create()},demoView='avatar',demoLesson=0,demoToast;
state.wallet.balance=50;state.game.energy.count=15;
const DojoAccounts={canStudy:()=>true};const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function save(){} // A prévia nunca grava na conta nem no armazenamento do navegador.
function toast(text){const box=document.getElementById('preview-notice');box.textContent=text;box.hidden=false;clearTimeout(demoToast);demoToast=setTimeout(()=>box.hidden=true,4500);}
function render(view=demoView){demoView=view;document.getElementById('main').innerHTML=view==='shop'?kcShopPage():view==='account'?`<span class="eyebrow">ESTÁ PRONTO PARA O DOJO</span><h1>Seu karateca</h1>${playerProfileCard()}`:avatarPage();if(view==='avatar')mountAvatarEditor();document.getElementById('demo-coins').textContent=state.wallet.balance;document.querySelectorAll('[data-demo-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.demoView===view)));}
function go(view){render(view==='home'?'shop':view);}
document.addEventListener('click',event=>{const view=event.target.closest('[data-demo-view]');if(view){render(view.dataset.demoView);return;}if(event.target.closest('[data-demo-lesson]')){const r=E.award(state.wallet,{day:G.dayKey(),phase:'demo-'+(++demoLesson),eligible:true});state.xp+=20+r.bonusXP;G.credit(state.game,20+r.bonusXP);render();toast(`Atividade simulada: +${r.coins} KC e +${20+r.bonusXP} XP. Nada foi salvo numa conta.`);return;}const appView=event.target.closest('[data-view]');if(appView)go(appView.dataset.view);});
window.addEventListener('DOMContentLoaded',()=>render());
