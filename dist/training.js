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
const MODULES=[];
for(let r=0;r<13;r++)for(const type of ['kihon','ido']){
 const own=type==='kihon'?extraK.slice(r*2,r*2+2):extraI.slice(r*2,r*2+2),core=type==='kihon'?coreK:coreI,extra=type==='kihon'?extraK:extraI;
 const prior=extra.slice(0,Math.min(extra.length,(r+1)*2));
 const hard=type==='kihon'?['tk-contraste','tk-dupla','tk-inverso','tk-mesmo','tk-correcao','tk-controle']:['ti-trinca','ti-contraste','ti-esquerda','ti-reconhecer','ti-mudar','ti-refinar'];
 const n=4+Math.floor(r/2),id=`treino-${type}-${r}`,name=type==='kihon'?'Kihon':'Ido geiko';
 const categories=type==='kihon'?categoryQuestions.slice(0,Math.min(K.terms.length,(r+1)*4)):[];
 const pools=r<4?[[...own,...core,...categories],[...own,...categories,...prior,...core],[...own,...categories,...core,...prior]]:r<8?[[...own,...categories.slice(-4),...hard,...core],[...own,...hard,...prior,...categories,...core],[...own,...prior.slice(-6),...categories,...hard,...core]]:[[...own,...hard,...categories.slice(-4),...prior.slice(-8)],[...own,...prior.slice(-8),...hard,...categories],[...own,...hard,...categories,...prior.slice(-10)]];
 MODULES.push({id,kind:'training',type,belt:r,level:r+1,title:`${name} · ${G.BELTS[r].name}`,subtitle:complexity[r],icon:type==='kihon'?'拳':'➜',pass:thresholds[r],requiresSensei:false,video:type==='kihon'?'JNHnvgQyuW8':'JNHnvgQyuW8',diagram:type==='kihon'?'levels':'ido',words:COMMANDS[r],notes:[`Foco desta faixa: ${complexity[r].toLowerCase()}.`,`Sequência de vocabulário para estudo: ${COMMANDS[r].join(' → ')}. Ouça e reconstrua os termos. Ela não define um kata nem um programa oficial por graduação.`,type==='kihon'?'No treino de kihon, o sensei escolhe os fundamentos e observa base, controle, trajetória e retorno.':'No ido geiko, o sensei adapta deslocamentos, ritmo, base e técnica e observa as transições.','Esta trilha acompanha a graduação ilustrativa do app. A graduação real e os requisitos físicos seguem o San Dojo.'],phases:pools.map((pool,i)=>({id:`${id}-${i+1}`,title:[type==='kihon'?'Precisão dos fundamentos':'Entender os comandos','Escuta e memória',`Desafio ${name}`][i],desc:[`Identifique os detalhes desta faixa.`,`Recupere os termos com menos pistas.`,`Integre o estudo com a meta de ${thresholds[r]}%.`][i],exam:i===2,questionIds:select(pool,n+(i===2?1:0),i===0?0:2)}))});
}
C.EXTRA_MODULES.push(...MODULES);
function modulesForBelt(rank){return MODULES.filter(m=>m.belt===rank);}
function ready(progress,rank){return modulesForBelt(rank).every(m=>C.moduleQuizPassed(progress,m.id));}
function approve(progress,game,rank,note='',now=Date.now()){if(rank>game.belt||!ready(progress,rank))throw new Error('Conclua as fases de Kihon e Ido geiko desta faixa primeiro.');progress.approvals['grade-'+rank]={at:now,note:String(note).slice(0,300)};game.mastery??={};game.mastery[rank]=true;}
return {MODULES,COMMANDS,thresholds,complexity,modulesForBelt,ready,approve};
});
