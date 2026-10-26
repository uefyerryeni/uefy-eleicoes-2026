const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),E=require('../estatistica-core'),P=require('../publicacao-core');
const read=f=>JSON.parse(fs.readFileSync(path.join(__dirname,'..',f),'utf8'));
const model=()=>E.build(...['data/rn-governador-mapa.json','data/rn-governador-mapa-2t.json','data/rn-analises.json','data/entre-turnos-2t.json','assets/maps/rn-municipios.geojson'].map(read));
const options=group=>({metric:'leadership',view:'delta',candidate:'13',group,search:''});
test('pautas de permanências e trocas têm contagens específicas e texto publicável',()=>{
 const m=model();for(const group of ['all','same','changed','from-22','from-44','from-13','to-13','to-44',...P.routes]){
  const b=P.brief(m,options(group));for(const style of ['summary','compare','names']){const t=P.makePost(b,{style,page:3,pageCount:9});assert.ok(P.analyzeText(t).valid,group+' '+t);assert.ok(t.includes('Fonte: TSE, 2026.'));assert.ok(!/transferiram|eleitores mudaram|migraram os votos/i.test(t))}
 }
 const same=P.brief(m,options('same'));assert.equal(same.count,107);assert.match(same.body,/73 com Cadu e 34 com Allyson/);assert.doesNotMatch(same.body,/0 .*mudaram/);
 const route=P.brief(m,options('44-13'));assert.equal(route.count,31);assert.match(route.body,/Allyson Bezerra foi o mais votado no 1º turno e Cadu de Lula no 2º/);
});
test('origem e destino incluem todos os municípios corretos, sem confundir votos individuais',()=>{
 const m=model(),origin=P.brief(m,options('from-22'));assert.equal(origin.rows.length,29);assert.ok(origin.rows.every(r=>r.from==='22'));assert.match(origin.body,/14 tiveram Cadu e 15 Allyson/);
 const destination=P.brief(m,options('to-13'));assert.equal(destination.rows.length,118);assert.ok(destination.rows.every(r=>r.to==='13'));
});
test('transição vazia descreve a ausência e permanece publicável',()=>{const b=P.brief(model(),options('13-44'));assert.equal(b.count,0);assert.match(b.body,/nenhum município passou/);assert.ok(P.analyzeText(P.makePost(b)).valid)});
test('listas paginadas incluem cada cidade uma vez em todos os formatos',()=>{
 const rows=P.brief(model(),options('same')).rows;
 for(const size of ['1600x900','1200x1200','1080x1350']){const pages=P.pages(rows,size),all=pages.flat();assert.equal(all.length,107);assert.equal(new Set(all.map(r=>r.code)).size,107);assert.equal(all.at(-1).code,rows.at(-1).code)}
 assert.deepEqual(P.pages([],'1200x1200'),[[]]);
});
test('contagem do X considera emoji composto, URLs e normalização Unicode',()=>{assert.equal(P.analyzeText('👨‍👩‍👧‍👦').length,2);assert.equal(P.analyzeText('cafe\u0301').length,4);assert.equal(P.analyzeText('https://example.com/um-endereco-muito-longo').length,23);assert.equal(P.analyzeText('a'.repeat(281)).valid,false)});
test('primeiro turno isolado e candidatura ausente não viram comparação inventada',()=>{
 const m=model();m.ready=false;const b=P.brief(m,{...options('all'),view:'first'});assert.match(b.body,/1º turno/);assert.doesNotMatch(b.body,/60 .*mudaram/);
 const c=P.brief(model(),{...options('all'),metric:'candidate_votes',candidate:'22'});assert.match(c.body,/Sem comparação disponível/);assert.doesNotMatch(c.body,/0 no 2º/);
});

test('artes dividem listas e rankings sem perder cidades e usam duas partes para os turnos',()=>{
 const m=model(),s=options('same'),rows=E.filtered(m,s);
 assert.equal(P.pages(rows,'1200x1200').length,27);assert.equal(P.pageCapacity('1200x1200'),4);
 assert.equal(P.artPages(rows,{size:'1200x1200',template:'compare',s}).length,2);
 const ranking=P.artPages(m.rows,{size:'1600x900',template:'ranking',s:{...s,metric:'turnout_pct',sort:'desc'}});
 assert.equal(ranking.length,4);assert.equal(ranking.flat().length,8);
 const routeParts=P.artPages(m.rows,{size:'1600x900',template:'routes',s});assert.equal(routeParts.length,3);assert.deepEqual(routeParts.flat(),P.routes);
});

test('resumos citam os maiores eleitorados do grupo e identificam origem e destino',()=>{
 const m=model(),b=P.brief(m,options('44-13')),c=P.editorial(b,{limit:5});
 assert.deepEqual(c.selected.map(r=>r.name),['SÃO JOSÉ DE MIPIBU','GOIANINHA','AREIA BRANCA','SANTO ANTÔNIO','GUAMARÉ']);
 assert.match(c.posts.join('\n'),/São José de Mipibu — Allyson → Cadu/);assert.match(c.report,/31 municípios/);assert.match(c.criterion,/eleitorado.*1º turno/);
 for(const r of c.selected)assert.ok(r.from==='44'&&r.to==='13');
 const same=P.editorial(P.brief(m,options('same')),{limit:10});assert.equal(same.selected.length,10);assert.equal(same.selected[0].name,'MOSSORÓ');assert.ok(same.selected.every(r=>r.status==='same'));
 const from=P.editorial(P.brief(m,options('from-22')),{limit:10});assert.equal(from.selected[0].name,'NATAL');assert.match(from.report,/14 municípios/);assert.match(from.posts.join('\n'),/Natal — Álvaro → Allyson/);
 const all=P.editorial(P.brief(m,options('all')),{limit:10});assert.ok(all.selected.every(r=>r.status==='changed'));
});
test('partes para o X preservam 5 ou 10 exemplos, fonte, contexto e limite oficial',()=>{
 const m=model();
 for(const group of ['all','same','changed','from-22','from-44','from-13','to-13','to-44','tie',...P.routes]){
  const b=P.brief(m,options(group));
  for(const limit of [5,10])for(const style of ['summary','compare','names']){
   const c=P.editorial(b,{limit,style,page:1,pageCount:27,pageRows:b.rows.slice(4,8)});
   assert.ok(c.posts.length);
   for(const post of c.posts){assert.ok(P.analyzeText(post).valid,post);assert.match(post,/Fonte: TSE, 2026/);assert.match(post,/RN/)}
   assert.equal(c.selected.length,Math.min(limit,c.cohortCount));
   if(style!=='names')for(let i=0;i<c.selected.length;i++)assert.equal(c.posts.filter(t=>t.split('\n').some(line=>line.startsWith((i+1)+'. '))).length,1);
  }
 }
 const empty=P.editorial(P.brief(m,options('13-44')));assert.equal(empty.selected.length,0);assert.match(empty.posts[0],/nenhum município/);assert.doesNotMatch(empty.posts.join(''),/Maiores eleitorados/);
});
test('outros indicadores selecionam por valor e respeitam busca, sentido e ausência de candidatura',()=>{
 const m=model(),s={...options('all'),metric:'turnout_pct',sort:'desc'};
 for(const view of ['first','second','delta']){
  const b=P.brief(m,{...s,view}),c=P.editorial(b,{limit:10});
  const expected=m.rows.filter(r=>Number.isFinite(E.displayed(r,s.metric,view,s.candidate))).sort((a,b)=>E.displayed(b,s.metric,view,s.candidate)-E.displayed(a,s.metric,view,s.candidate)||a.name.localeCompare(b.name,'pt-BR')).slice(0,10);
  assert.deepEqual(c.selected.map(r=>r.code),expected.map(r=>r.code));assert.ok(c.posts.every(t=>P.analyzeText(t).valid));assert.match(c.report,/valor no recorte/);
 }
 const small=P.editorial(P.brief(m,{...s,sort:'asc'})),big=P.editorial(P.brief(m,s));assert.notEqual(small.selected[0].code,big.selected[0].code);
 const search=P.editorial(P.brief(m,{...options('all'),search:'Natal'}));assert.equal(search.selected.length,1);assert.match(search.posts[0],/Busca: “Natal”/);
 const absent=P.editorial(P.brief(m,{...s,metric:'candidate_votes',candidate:'22'}));assert.equal(absent.selected.length,0);assert.match(absent.posts[0],/Sem comparação disponível/);
});
