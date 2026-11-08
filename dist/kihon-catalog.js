(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.DojoKihon=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
const groups=[
 {id:'te',name:'Te waza',jp:'手技',say:'てわざ',desc:'Técnicas de mãos e braços',terms:[
 ['Seiken chudan tsuki','せいけんちゅうだんづき','Soco com o punho na altura média'],['Seiken jodan tsuki','せいけんじょうだんづき','Soco com o punho na altura alta'],['Uraken ganmen uchi','うらけんがんめんうち','Técnica de uraken à frente, na altura alta'],['Uraken sayu uchi','うらけんさゆううち','Técnica de uraken para os lados'],['Uraken hizo uchi','うらけんひぞううち','Técnica de uraken na região lateral do tronco'],['Uraken mawashi uchi','うらけんまわしうち','Técnica circular de uraken'],['Seiken ago uchi','せいけんあごうち','Técnica curta de punho na altura alta'],['Shita tsuki','したづき','Soco ascendente'],['Hiji yoko uchi','ひじよこうち','Técnica lateral com o cotovelo'],['Hiji ago uchi','ひじあごうち','Técnica com o cotovelo na altura do queixo'],['Hiji oroshi uchi','ひじおろしうち','Técnica descendente com o cotovelo']
 ]},
 {id:'ashi',name:'Ashi waza',jp:'足技',say:'あしわざ',desc:'Técnicas de pernas e pés',terms:[
 ['Mae keage','まえけあげ','Elevação frontal da perna'],['Uchi mawashi','うちまわし','Movimento circular da perna de dentro para fora'],['Soto mawashi','そとまわし','Movimento circular da perna de fora para dentro'],['Hiza geri','ひざげり','Técnica com o joelho'],['Kinteki geri','きんてきげり','Chute à região baixa central (kinteki)'],['Mae geri','まえげり','Chute frontal'],['Yoko keage','よこけあげ','Elevação lateral da perna'],['Yoko geri','よこげり','Chute lateral'],['Kansetsu geri','かんせつげり','Nome de uma técnica de chute de articulação'],['Ushiro geri','うしろげり','Chute para trás'],['Mawashi geri','まわしげり','Chute circular']
 ]},
 {id:'shuto',name:'Shuto waza',jp:'手刀技',say:'しゅとうわざ',desc:'Técnicas com a borda da mão',terms:[
 ['Shuto ganmen uchi','しゅとうがんめんうち','Técnica de shuto na altura alta'],['Shuto sakotsu uchioroshi','しゅとうさこつうちおろし','Técnica descendente de shuto'],['Shuto sakotsu uchikomi','しゅとうさこつうちこみ','Técnica de entrada de shuto'],['Shuto uchi uchi','しゅとううちうち','Técnica de shuto para dentro'],['Shuto hizo uchi','しゅとうひぞううち','Técnica de shuto na região lateral do tronco']
 ]},
 {id:'uke',name:'Uke waza',jp:'受け技',say:'うけわざ',desc:'Técnicas de defesa',terms:[
 ['Jodan uke','じょうだんうけ','Defesa alta'],['Chudan soto uke','ちゅうだんそとうけ','Defesa média de fora para dentro'],['Chudan uchi uke','ちゅうだんうちうけ','Defesa média de dentro para fora'],['Gedan barai','げだんばらい','Defesa baixa'],['Chudan uchi uke gedan barai','ちゅうだんうちうけげだんばらい','Combinação de defesa média e defesa baixa']
 ]}
];
groups.forEach(g=>g.terms=g.terms.map(([name,say,meaning],i)=>({name,say,meaning,group:g.id,id:`kihon-${g.id}-${i+1}`})));
return {groups,terms:groups.flatMap(g=>g.terms),source:'https://ikka.ch/pr%C3%BCfungsprogramm'};
});
