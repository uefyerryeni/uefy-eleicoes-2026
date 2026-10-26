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
