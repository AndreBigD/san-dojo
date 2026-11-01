const KATA_CATALOG=[
 ['taikyoku-1','Taikyoku sono ichi','たいきょく そのいち','Taikyoku','Taikyoku 1'],
 ['taikyoku-2','Taikyoku sono ni','たいきょく そのに','Taikyoku','Taikyoku 2'],
 ['taikyoku-3','Taikyoku sono san','たいきょく そのさん','Taikyoku','Taikyoku 3'],
 ['sokugi-1','Sokugi Taikyoku sono ichi','そくぎ たいきょく そのいち','Sokugi Taikyoku','Sakugi Taikyoku 1'],
 ['sokugi-2','Sokugi Taikyoku sono ni','そくぎ たいきょく そのに','Sokugi Taikyoku','Sakugi Taikyoku 2'],
 ['sokugi-3','Sokugi Taikyoku sono san','そくぎ たいきょく そのさん','Sokugi Taikyoku','Sakugi Taikyoku 3'],
 ['pinan-1','Pinan sono ichi','ぴんあん そのいち','Pinan','Pinan 1'],
 ['pinan-2','Pinan sono ni','ぴんあん そのに','Pinan','Pinan 2'],
 ['pinan-3','Pinan sono san','ぴんあん そのさん','Pinan','Pinan 3'],
 ['pinan-4','Pinan sono yon','ぴんあん そのよん','Pinan','Pinan 4'],
 ['pinan-5','Pinan sono go','ぴんあん そのご','Pinan','Pinan 5'],
 ['sanchin','Sanchin','さんちん','Respiratórios',''],
 ['tensho','Tensho','てんしょう','Respiratórios','Tenshō'],
 ['gekisai-dai','Gekisai Dai','げきさい だい','Intermediários',''],
 ['yantsu','Yantsu','やんつー','Intermediários',''],
 ['tsuki-no-kata','Tsuki no kata','つき の かた','Intermediários','Tsuki-no-kata'],
 ['saiha','Saiha','さいは','Avançados','Saifa'],
 ['kanku','Kanku','かんくう','Avançados','Kankū'],
 ['gekisai-sho','Gekisai Sho','げきさい しょう','Avançados','Gekisai Shō'],
 ['seienchin','Seienchin','せいえんちん','Avançados','Seiyunchin'],
 ['sushiho','Sushiho','すーしーほー','Avançados','Shushi Ho · Sushihō'],
 ['garyu','Garyu','がりゅう','Avançados','Garyū'],
 ['seipai','Seipai','せいぱい','Avançados','']
].map(([id,name,jp,family,alias])=>({id:'kata-'+id,name,jp,family,alias}));
const KATA_SOURCE='https://www.shinkyokushinkai-france.com/document-download/25871.pdf';
function kataById(id){return KATA_CATALOG.find(k=>k.id===id);}
function kihonMediaGroups(){return DojoKihon.groups.map(g=>({id:'catalogo-kihon-'+g.id,level:'拳',title:'Kihon · '+g.name,phases:[{id:'kihon-parte-'+g.id,title:'Categoria inteira · '+g.name},...g.terms.map(t=>({id:t.id,title:t.name}))]}));}
function kihonMaterialById(id){for(const g of DojoKihon.groups){if(id==='kihon-parte-'+g.id)return {id,name:g.name,say:g.say,meaning:g.desc,group:g,whole:true};const term=g.terms.find(t=>t.id===id);if(term)return {...term,group:g,whole:false};}return null;}
function mediaGroups(){return [...C.COURSE,...C.EXTRA_MODULES,...kihonMediaGroups(),{id:'katas',level:'★',title:'Catálogo de katas',phases:KATA_CATALOG.map(k=>({id:k.id,title:k.name}))}];}
function mediaGroupById(id){return mediaGroups().find(m=>m.id===id);}
function mediaTarget(id){const phase=C.phaseById(id);if(phase)return phase;const kihon=kihonMaterialById(id);if(kihon)return {module:{id:'catalogo-kihon-'+kihon.group.id,title:'Kihon · '+kihon.group.name,video:null,diagram:null},phase:{id,title:kihon.name},kihon};const kata=kataById(id);return kata?{module:{id:'katas',title:'Catálogo de katas',video:id==='kata-taikyoku-1'?'18Z_BcXfcf0':null,diagram:'kata'},phase:{id,title:kata.name},kata}:null;}
let kataFamily='Todas',kataSearch='';
function kataCard(k,i){return `<article class="kata-card" data-kata-family="${esc(k.family)}" data-kata-search="${esc(C.normalize(k.name+' '+k.alias+' '+k.family))}"><span class="difficulty-label">${k.family.toUpperCase()}</span><span class="kata-number">${String(i+1).padStart(2,'0')}</span><h3>${k.name}</h3><p class="kata-reading" lang="ja">${k.jp}</p>${k.alias?`<small>Também encontrado como: ${k.alias}</small>`:'<small>Nome do catálogo Shinkyokushin</small>'}${audioButtons(k.name)}<button class="text-button" data-kata="${k.id}">Ver material deste kata →</button></article>`;}
function kataCatalog(){return `<section class="animate-in"><div class="eyebrow">CATÁLOGO SHINKYOKUSHIN</div><h1>Os nomes dos katas</h1><p class="intro">23 nomes, organizados por família, com leitura em japonês e áudio.</p><div class="learning-callout"><b>Um catálogo para conhecer e revisar.</b><p>O ensino da execução e a sequência por graduação seguem o San Dojo. A lista de referência inclui Gekisai Dai e Gekisai Sho separadamente. Alguns katas também podem ser treinados em versão Ura, conforme o dojo.</p></div><div class="kata-filters"><label>Buscar nome<input id="kata-search" type="search" value="${esc(kataSearch)}" placeholder="Ex.: Pinan, Gekisai, Sushiho"></label><label>Família<select id="kata-family">${['Todas',...new Set(KATA_CATALOG.map(k=>k.family))].map(f=>`<option ${f===kataFamily?'selected':''}>${f}</option>`).join('')}</select></label></div><div class="kata-grid">${KATA_CATALOG.map(kataCard).join('')}</div><p id="kata-empty" hidden>Nenhum kata encontrado. Tente outro nome ou família.</p><div class="info-panel kata-source"><h2>Referência dos nomes</h2><p>Catálogo baseado na relação de 23 katas da Shinkyokushinkai France. Há grafias alternativas entre materiais: a fonte usa “Sakugi” e “Shushi Ho”; aqui eles aparecem como Sokugi Taikyoku e Sushiho, com as variantes indicadas.</p><a href="${KATA_SOURCE}" target="_blank" rel="noopener">Consultar a lista de referência ↗</a><p class="week-note">Conhecer o nome de um kata não significa estar preparado para executá-lo. A prática e a versão técnica são orientadas pelo sensei.</p></div></section>`;}
let currentKata='kata-taikyoku-1';
function kataPage(){const k=kataById(currentKata)||KATA_CATALOG[0];return `<section class="animate-in"><button class="back-link" data-view="katas">← Voltar ao catálogo</button><div class="eyebrow">${k.family} · NOME E PRONÚNCIA</div><h1>${k.name}</h1><p class="kata-large-reading" lang="ja">${k.jp}</p>${audioButtons(k.name)}${k.alias?`<p class="week-note">Grafia alternativa: ${k.alias}.</p>`:''}<div class="module-layout"><div class="info-panel"><h2>Aprender com o sensei</h2><p>Ouça o nome, repita e procure reconhecê-lo durante a aula. A execução deste kata deve seguir a demonstração e as correções do seu sensei.</p><p>Você pode vincular seu próprio vídeo e uma imagem especificamente a este kata na Biblioteca do sensei.</p>${DojoAccounts.canManage()?`<button class="primary" data-add-kata-media="${k.id}">Adicionar meu material <span>→</span></button>`:!DojoAccounts.user?'<button class="outline" data-view="account">Entrar na área do sensei →</button>':''}</div><div class="module-material">${mediaMarkup(k.id)}${!state.media[k.id]?.youtubeId&&!state.media[k.id]?.videoKey&&k.id!=='kata-taikyoku-1'?'<p class="week-note">Aguardando um vídeo do San Dojo para este kata. Os esquemas são gerais e não representam sua sequência completa.</p>':''}</div></div></section>`;}
function filterKatas(){const query=C.normalize(kataSearch);let visible=0;document.querySelectorAll('.kata-card').forEach(el=>{const show=(kataFamily==='Todas'||el.dataset.kataFamily===kataFamily)&&(!query||el.dataset.kataSearch.includes(query));el.hidden=!show;if(show)visible++;});const empty=$('#kata-empty');if(empty)empty.hidden=visible>0;}
