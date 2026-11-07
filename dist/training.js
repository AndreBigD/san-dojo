(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./curriculum.js'),require('./progression.js'),require('./kihon-catalog.js'));else root.DojoTraining=factory(root.DojoCourse,root.DojoGame,root.DojoKihon);})(typeof globalThis!=='undefined'?globalThis:this,function(C,G,K){
const COMMANDS=[['Yoi','Hajime','Yame'],['Zenkutsu dachi','Gedan barai'],['Kiba dachi','Seiken chudan tsuki'],['Sanchin dachi','Jodan uke'],['Zenkutsu dachi','Oi tsuki'],['Zenkutsu dachi','Gyaku tsuki'],['Yoi','Zenkutsu dachi','Mae geri','Yame'],['Yoi','Kiba dachi','Jodan uke','Yame'],['Zenkutsu dachi','Gedan barai','Oi tsuki'],['Sanchin dachi','Jodan uke','Seiken chudan tsuki'],['Yoi','Zenkutsu dachi','Gyaku tsuki','Yame'],['Yoi','Zenkutsu dachi','Gedan barai','Oi tsuki','Yame'],['Yoi','Zenkutsu dachi','Jodan uke','Gyaku tsuki','Yame']];
const thresholds=[75,75,80,80,80,85,85,85,90,90,90,95,95];
const complexity=['Nomes e comandos básicos','Base e defesa em conjunto','Altura média e base lateral','Comparar altura e posição','Soco do mesmo lado da base','Soco do lado oposto à base','Preparar, deslocar e parar','Escuta com quatro componentes','Conectar defesa e soco','Diferenciar duas técnicas na mesma sequência','Memória de quatro comandos sem alternativas','Reconstituir cinco componentes','Integração de base, defesa, lado e controle'];
function add(q){C.QUESTIONS[q.id]=q;return q.id;}
const extraK=[],extraI=[];
const input=(id,prompt,answers,why,extra={})=>add({id,type:'input',prompt,answers,why,...extra});
const choice=(id,prompt,options,answer,why,extra={})=>add({id,type:'choice',prompt,options,answer,why,...extra});
const order=(id,prompt,items,why,extra={})=>add({id,type:'order',prompt,items,why,...extra});
for(let r=0;r<13;r++){
 const items=COMMANDS[r],audio=`Comandos da faixa ${String(r+1).padStart(2,'0')}`,answer=items.join(' → '),prefix=`tr-${r}-`;
 extraK.push(input(prefix+'nome','Ouça e escreva todos os termos que você ouviu, na ordem.',[items.join(' ')],`A sequência de vocabulário foi: ${answer}.`,{audio}));
 extraK.push(choice(prefix+'altura',r%2?'Qual alternativa diferencia corretamente jodan uke e gedan barai?':'Qual alternativa diferencia corretamente oi tsuki e gyaku tsuki?',r%2?['Defesa alta e defesa baixa','As duas são bases','Defesa baixa e defesa alta']:['Mesmo lado e lado oposto à perna da frente','Os dois são chutes','Lado oposto e mesmo lado da perna da frente'],0,r%2?'Jodan uke é uma defesa alta; gedan barai, baixa.':'Oi tsuki usa o mesmo lado da perna da frente; gyaku tsuki usa o lado oposto.'));
 extraI.push(order(prefix+'ordem','Ouça e reconstrua a sequência de comandos de memória.',items,`Você ouviu: ${answer}. É um exercício de memória; o sensei orienta sua execução.`,{audio}));
 extraI.push(input(prefix+'segundo','Ouça a sequência. Escreva apenas o segundo termo.',[items[1]],`O segundo termo da sequência foi ${items[1]}.`,{audio}));
}
extraK.push(input('tk-contraste','Escreva, nesta ordem, os nomes dos níveis baixo, médio e alto.',['gedan chudan jodan'],'Gedan, chudan, jodan: baixo, médio, alto.'));
extraK.push(input('tk-dupla','Escreva o nome da base do cavaleiro e depois o da defesa alta.',['kiba dachi jodan uke'],'A dupla é kiba dachi e jodan uke.'));
extraK.push(input('tk-inverso','A perna direita está à frente. O soco é com o braço esquerdo. Escreva o nome desse soco.',['gyaku tsuki','gyaku zuki'],'O braço está do lado oposto à perna da frente: gyaku tsuki.'));
extraK.push(input('tk-mesmo','A perna esquerda está à frente. O soco é com o braço esquerdo. Escreva o nome desse soco.',['oi tsuki','oi zuki'],'Braço e perna da frente estão do mesmo lado: oi tsuki.'));
extraK.push(choice('tk-correcao','O colega diz “chudan significa alto e jodan significa médio”. Qual correção é adequada?',['Chudan é médio e jodan é alto','Os dois são baixos','Não existe diferença'],0,'Chudan indica médio e jodan, alto.'));
extraK.push(choice('tk-controle','Qual observação técnica exige uma pessoa acompanhando a prática?',['Confirmar base, trajetória e retorno da técnica','Ler o nome na tela','Contar os XP'],0,'A execução corporal precisa de observação e retorno do sensei.'));
extraI.push(input('ti-trinca','Escreva os comandos para preparar, começar e parar, nessa ordem.',['yoi hajime yame'],'Yoi, hajime, yame.'));
extraI.push(input('ti-contraste','Escreva o nome do soco do mesmo lado da perna da frente e depois o do lado oposto.',['oi tsuki gyaku tsuki','oi zuki gyaku zuki'],'Oi tsuki e gyaku tsuki, nessa ordem.'));
extraI.push(choice('ti-esquerda','A perna esquerda está à frente e o soco é com o braço direito. Qual é a relação?',['Soco do lado oposto: gyaku tsuki','Soco do mesmo lado: oi tsuki','Não depende da base'],0,'Braço direito e perna esquerda são lados opostos: gyaku tsuki.'));
extraI.push(choice('ti-reconhecer','O aluno mantém o nome da técnica, mas perde a base ao se deslocar. O que revisar com o sensei?',['A ligação entre base, deslocamento e técnica','Só a pronúncia','Somente o placar'],0,'Ido geiko pede a coordenação entre os aspectos da combinação.'));
extraI.push(choice('ti-mudar','O comando mudou e você ficou em dúvida no meio do treino. Qual resposta ajuda a aprender?',['Pedir a orientação e retomar com controle','Inventar a continuação','Acelerar para acompanhar'],0,'Entender o comando vem antes de aumentar o ritmo.'));
extraI.push(choice('ti-refinar','Qual detalhe a revisão avançada deve priorizar?',['Clareza dos comandos, base e continuidade com controle','Apenas fazer mais repetições rápidas','Comparar faixas com os colegas'],0,'A revisão avançada integra memória e execução observada, sem depender só de quantidade.'));
const coreK=['k1','k2','k3','k4','k5','k6','k7','k8','k9','k10','k11','k12','k13','b8','b9','r1','r2','r4','r11','r12'];
const coreI=['i1','i2','i3','i4','i5','i6','i7','i8','i9','i10','i11','i12','i13','r2','r3','r10','b6','k9'];
function select(pool,n,start=0){const unique=[...new Set(pool)],out=[];for(let i=0;i<unique.length&&out.length<n;i++)out.push(unique[(i+start)%unique.length]);return out;}
const categoryQuestions=[];
for(let i=0;i<11;i++)for(const group of K.groups){const term=group.terms[i];if(!term)continue;categoryQuestions.push(choice(`kg-${term.id}`,`Ouça a técnica. Em qual categoria deste catálogo ela está?`,K.groups.map(g=>g.name),K.groups.indexOf(group),`${term.name} está em ${group.name}: ${group.desc.toLowerCase()}.`,{audio:term.name}));}
// A dificuldade muda o trabalho exigido, não apenas a quantidade ou a nota.
// As descrições vêm do catálogo revisado do dojo; estas combinações são de estudo.
const DEMANDS=[
 {terms:1,sequence:2,rounds:1,choices:true,label:'Reconhecer uma técnica e duas palavras ouvidas'},
 {terms:1,sequence:3,rounds:2,choices:true,label:'Distinguir nomes próximos e acompanhar duas mudanças de lado'},
 {terms:1,sequence:4,rounds:2,choices:false,label:'Escrever o nome completo sem alternativas'},
 {terms:2,sequence:4,rounds:3,choices:false,label:'Recuperar duas técnicas e três relações de lado'},
 {terms:2,sequence:5,rounds:3,choices:false,label:'Separar técnicas parecidas e filtrar cinco comandos'},
 {terms:3,sequence:5,rounds:4,choices:false,label:'Relacionar três descrições e acompanhar quatro transições'},
 {terms:3,sequence:6,rounds:4,choices:false,label:'Memorizar seis termos e corrigir relações de lado'},
 {terms:4,sequence:6,rounds:5,choices:false,label:'Cruzar quatro técnicas, categorias e cinco transições'},
 {terms:4,sequence:7,rounds:5,choices:false,label:'Filtrar e reorganizar sete comandos sem alternativas'},
 {terms:5,sequence:7,rounds:6,choices:false,label:'Reconstruir cinco nomes e seis transições com correção'},
 {terms:5,sequence:8,rounds:6,choices:false,label:'Recuperar oito comandos e aplicar duas regras de seleção'},
 {terms:6,sequence:8,rounds:7,choices:false,label:'Integrar seis técnicas e corrigir sete relações de lado'},
 {terms:6,sequence:9,rounds:8,choices:false,label:'Memória de nove termos, seis técnicas e oito transições'}
];
function advancedQuestions(rank,type,stage){
 const d=DEMANDS[rank],ids=[],prefix=`v2-${type}-${rank}-${stage}-`,isK=type==='kihon';
 const emit=(key,prompt,answer,why,extra={})=>{ids.push(input(prefix+key,prompt,[answer],why,extra));};
 const terms=Array.from({length:d.terms},(_,j)=>K.terms[(rank*3+stage*5+j*7)%K.terms.length]);
 for(let v=0;v<4;v++){
  const group=K.groups[(rank+stage+v)%4],start=(rank+stage+v)%group.terms.length;
  const set=Array.from({length:Math.min(d.terms,group.terms.length)},(_,j)=>group.terms[(start+j)%group.terms.length]);
  const prompt=set.map((t,i)=>`${i+1}) ${t.meaning}`).join('; '),names=set.map(t=>t.name);
  if(d.choices&&stage===0){const correct=names[0],near=group.terms.filter(t=>t.name!==correct).slice(start%2,start%2+3).map(t=>t.name);ids.push(choice(prefix+'nome-'+v,`Qual nome corresponde a: ${set[0].meaning.toLowerCase()}?`,[correct,...near],0,`${correct}: ${set[0].meaning}.`));}
  else emit('nome-'+v,`Sem alternativas, escreva os nomes completos, nesta ordem: ${prompt}.`,names.join(' '),`Na ordem: ${names.join(' → ')}.`);
 }
 const sequence=Array.from({length:d.sequence},(_,j)=>K.terms[(rank*2+stage*3+j*5+(isK?0:9))%K.terms.length].name);
 emit('ouvir','Ouça a sequência de estudo e escreva todos os nomes completos na mesma ordem.',sequence.join(' '),`Sequência: ${sequence.join(' → ')}.`,{audioSequence:sequence});
 const positions=rank<4?[0,sequence.length-1]:rank<8?[1,sequence.length-2,0]:[sequence.length-1,1,sequence.length-2,0];
 emit('posicoes',`Ouça e escreva somente os termos nas posições ${positions.map(i=>i+1).join(', ')}, nessa ordem.`,positions.map(i=>sequence[i]).join(' '),`Nas posições pedidas: ${positions.map(i=>sequence[i]).join(' → ')}.`,{audioSequence:sequence});
 if(isK){
  const named=terms.map(t=>t.name),families=terms.map(t=>K.groups.find(g=>g.id===t.group).name);
  if(d.choices&&stage<2)ids.push(choice(prefix+'grupo',`Em qual grupo está ${named[0]}?`,K.groups.map(g=>g.name),K.groups.findIndex(g=>g.id===terms[0].group),`${named[0]} está em ${families[0]}.`));
  else emit('grupo',`Classifique na ordem, escrevendo os grupos (Te waza, Ashi waza, Shuto waza ou Uke waza): ${named.join(' → ')}.`,families.join(' '),`Grupos: ${families.join(' → ')}.`);
  const filter=rank>=8?sequence.filter(name=>K.terms.find(t=>t.name===name).group==='ashi'):sequence.filter((_,i)=>i%2===0);
  emit('filtrar',rank>=8?'Ouça e escreva somente as técnicas de Ashi waza, na ordem em que aparecerem.':'Ouça e escreva somente a primeira, terceira, quinta e demais posições ímpares que existirem.',filter.join(' '),`Seleção: ${filter.join(' → ')}.`,{audioSequence:sequence});
  const contrasts=[['Chudan soto uke','Chudan uchi uke'],['Hiji yoko uchi','Hiji ago uchi','Hiji oroshi uchi'],['Shuto sakotsu uchioroshi','Shuto sakotsu uchikomi'],['Uchi mawashi','Soto mawashi']];
  const contrast=contrasts[(rank+stage)%contrasts.length],descriptions=contrast.map(n=>K.terms.find(t=>t.name===n).meaning);
  emit('diferenciar',`Diferencie os nomes completos pelas descrições, na ordem: ${descriptions.join('; ')}.`,contrast.join(' '),`Diferença: ${contrast.map((n,i)=>n+' = '+descriptions[i]).join('; ')}.`);
 }else{
  for(let variant=0;variant<3;variant++){
   const rounds=Array.from({length:d.rounds},(_,j)=>{const front=(j+rank+variant)%2?'direita':'esquerda',same=(j*3+rank+stage+variant)%3===0;return {front,arm:same?front:front==='direita'?'esquerdo':'direito',name:same?'Oi tsuki':'Gyaku tsuki'};});
   // Corrige a flexão do lado para que o enunciado seja inequívoco.
   const text=rounds.map((x,j)=>`${j+1}) perna ${x.front} à frente; braço ${x.arm.replace('direita','direito').replace('esquerda','esquerdo')} executa o soco`).join('; ');
   emit('lados-'+variant,`Cada rodada é independente. ${text}. Escreva apenas os nomes dos socos, na ordem de cada rodada.`,rounds.map(x=>x.name).join(' '),`Relações corretas: ${rounds.map(x=>x.name).join(' → ')}. Compare braço e perna da frente em cada rodada.`);
  }
  if(rank>=3){
   let front=rank%2?'direita':'esquerda';const initial=front,steps=[];
   for(let j=0;j<d.rounds;j++){const change=(j+stage)%3!==0;if(change)front=front==='direita'?'esquerda':'direita';const arm=(j+rank+stage)%2?'direita':'esquerda';steps.push({change,arm,name:arm===front?'Oi tsuki':'Gyaku tsuki'});}
   emit('transicoes',`Comece com a perna ${initial} à frente. Acompanhe as mudanças na ordem: ${steps.map((x,j)=>`${j+1}) ${x.change?'troca a perna da frente':'mantém a perna da frente'}; soca com o braço ${x.arm==='direita'?'direito':'esquerdo'}`).join('; ')}. Escreva o nome de cada soco considerando a base DEPOIS da mudança.`,steps.map(x=>x.name).join(' '),`Após atualizar a perna da frente em cada etapa: ${steps.map(x=>x.name).join(' → ')}. O nome depende da relação naquele momento.`);
  }
  if(rank>=6){
   const diagnoses=Array.from({length:d.rounds},(_,j)=>{const same=(j+rank+stage)%2===0;return {same,correct:same?'Oi tsuki':'Gyaku tsuki',said:same?'Gyaku tsuki':'Oi tsuki'};});
   emit('corrigir',`Um colega trocou todos os nomes. Corrija cada registro, escrevendo somente os nomes corretos na ordem: ${diagnoses.map((x,j)=>`${j+1}) braço do ${x.same?'mesmo lado':'lado oposto'} da perna da frente, chamado de ${x.said}`).join('; ')}.`,diagnoses.map(x=>x.correct).join(' '),`Correções: ${diagnoses.map(x=>x.correct).join(' → ')}. Mesmo lado é oi tsuki; lado oposto é gyaku tsuki.`);
  }
 }
 const bases=['Zenkutsu dachi','Kiba dachi','Sanchin dachi','Fudo dachi'],baseMeanings=['base avançada','base do cavaleiro','base compacta dos três combates','posição firme de prontidão'];
 const combined=Array.from({length:Math.min(d.terms,4)},(_,j)=>{const i=(rank+stage+j)%4,t=K.terms[(rank*3+stage+j*7)%K.terms.length];return {prompt:`${baseMeanings[i]} + ${t.meaning.toLowerCase()}`,answer:bases[i]+' '+t.name};});
 emit('integrar',`Traduza cada par para os nomes japoneses completos, mantendo base antes da técnica e a ordem dos pares: ${combined.map((x,i)=>(i+1)+') '+x.prompt).join('; ')}.`,combined.map(x=>x.answer).join(' '),`Pares: ${combined.map(x=>x.answer).join(' → ')}. Exercício de vocabulário, não prescrição de execução.`);
 if(rank>=6){
  const reversed=[...sequence].reverse();
  emit('inverter','Ouça e reconstrua os nomes do último para o primeiro, sem alternativas.',reversed.join(' '),`Ordem inversa: ${reversed.join(' → ')}.`,{audioSequence:sequence});
 }
 if(rank>=10){
  const selected=sequence.map(name=>K.terms.find(t=>t.name===name)).filter(t=>t.group==='ashi'||t.group==='uke').reverse();
  emit('dupla-regra','Ouça: mantenha apenas Ashi waza e Uke waza. Depois escreva os nomes selecionados do último para o primeiro.',selected.map(t=>t.name).join(' '),`Após filtrar e inverter: ${selected.map(t=>t.name).join(' → ')}.`,{audioSequence:sequence});
 }
 return ids;
}
const MODULES=[];
for(let r=0;r<13;r++)for(const type of ['kihon','ido']){
 const own=type==='kihon'?extraK.slice(r*2,r*2+2):extraI.slice(r*2,r*2+2),core=type==='kihon'?coreK:coreI,extra=type==='kihon'?extraK:extraI;
 const prior=extra.slice(0,Math.min(extra.length,(r+1)*2));
 const hard=type==='kihon'?['tk-contraste','tk-dupla','tk-inverso','tk-mesmo','tk-correcao','tk-controle']:['ti-trinca','ti-contraste','ti-esquerda','ti-reconhecer','ti-mudar','ti-refinar'];
 const n=4+Math.floor(r/2),id=`treino-${type}-${r}`,name=type==='kihon'?'Kihon':'Ido geiko';
 const categories=type==='kihon'?categoryQuestions.slice(0,Math.min(K.terms.length,(r+1)*4)):[];
 const pools=r<4?[[...own,...core,...categories],[...own,...categories,...prior,...core],[...own,...categories,...core,...prior]]:r<8?[[...own,...categories.slice(-4),...hard,...core],[...own,...hard,...prior,...categories,...core],[...own,...prior.slice(-6),...categories,...hard,...core]]:[[...own,...hard,...categories.slice(-4),...prior.slice(-8)],[...own,...prior.slice(-8),...hard,...categories],[...own,...hard,...categories,...prior.slice(-10)]];
 const demand=DEMANDS[r],phaseIds=[0,1,2].map(stage=>advancedQuestions(r,type,stage));
 MODULES.push({id,kind:'training',type,belt:r,level:r+1,title:`${name} · ${G.BELTS[r].name}`,subtitle:demand.label,icon:type==='kihon'?'拳':'➜',pass:thresholds[r],requiresSensei:false,video:'JNHnvgQyuW8',diagram:type==='kihon'?'levels':'ido',words:COMMANDS[r],notes:[`Exigência desta faixa: ${demand.label.toLowerCase()}.`,`${demand.terms} técnica(s) por bloco de escrita · ${demand.sequence} termos na memória auditiva · ${type==='ido'?demand.rounds+' rodada(s) de relação entre os lados':'classificação e contraste entre técnicas próximas'}.`,`As três fases usam questões diferentes. Você pode ouvir novamente; a primeira resposta conta para a nota.`,type==='kihon'?'As descrições usam o catálogo do San Dojo. Compare nomes próximos, recupere a escrita e conecte base e técnica.':'Analise cada transição pela perna que está à frente naquele momento, sem supor que o soco mantém o mesmo nome após uma mudança de lado.','Estas sequências são exercícios de estudo, não katas nem programa oficial de graduação. A execução física e a graduação real continuam com o sensei.'],phases:phaseIds.map((ids,i)=>({id:`${id}-${i+1}`,title:[type==='kihon'?'Precisão dos fundamentos':'Lados e transições','Escuta e memória',`Desafio ${name}`][i],desc:[`Recupere ${demand.terms} técnica(s) por bloco; diferencie nomes próximos.`,`Reconstrua até ${demand.sequence} termos e selecione as posições pedidas.`,`Integre os conhecimentos sem reduzir a exigência: meta de ${thresholds[r]}%.`][i],exam:i===2,questionIds:ids}))});
}
C.EXTRA_MODULES.push(...MODULES);
function modulesForBelt(rank){return MODULES.filter(m=>m.belt===rank);}
function ready(progress,rank){return modulesForBelt(rank).every(m=>C.moduleQuizPassed(progress,m.id));}
function approve(progress,game,rank,note='',now=Date.now()){if(rank>game.belt||!ready(progress,rank))throw new Error('Conclua as fases de Kihon e Ido geiko desta faixa primeiro.');progress.approvals['grade-'+rank]={at:now,note:String(note).slice(0,300)};game.mastery??={};game.mastery[rank]=true;}
function syncMastery(progress,game){game.mastery=Object.fromEntries(Array.from({length:13},(_,rank)=>[rank,ready(progress,rank)]));game.requireMastery=true;return game.mastery;}
return {MODULES,COMMANDS,DEMANDS,thresholds,complexity,modulesForBelt,ready,approve,syncMastery};
});
