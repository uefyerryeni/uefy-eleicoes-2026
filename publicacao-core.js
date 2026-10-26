/* Pautas editoriais municipais. A mudança é da liderança, não do voto individual. */
(function(root){'use strict';
const E=typeof module!=='undefined'?require('./estatistica-core'):root.ElectionStats;
const T=typeof module!=='undefined'?require('./vendor/twitter-text-3.1.0.min'):root.twttr.txt;
const short={'13':'Cadu','44':'Allyson','22':'Álvaro'};
const routes=['13-13','44-44','13-44','44-13','22-13','22-44'];
const source='Fonte: TSE, 2026.';
function analyzeText(text){const p=T.parseTweet(String(text).normalize('NFC'));return {length:p.weightedLength,valid:p.valid}}
function brief(model,s,options={}){
 const rows=options.rows||E.filtered(model,s),city=options.city||null,n=rows.length,group=s.group||'all';
 const counts=Object.fromEntries(routes.map(k=>[k,rows.filter(r=>r.from+'-'+r.to===k).length]));
 const changed=rows.filter(r=>r.status==='changed').length,same=rows.filter(r=>r.status==='same').length;
 const search=s.search?' No recorte da busca “'+s.search.slice(0,45)+'”.':'';
 let title='O que mudou na liderança municipal',subhead='Governador do RN · 1º e 2º turnos',body='',compare='',count=changed,label='municípios mudaram de liderança';
 if(city&&s.metric==='leadership'){
  title=city.name+': a liderança nos dois turnos';count=city.status==='same'?'Manteve':city.status==='changed'?'Mudou':city.status==='tie'?'Empate':'1º turno';label='primeira posição neste município';
  body=city.name+': no 1º turno, '+(city.from==='tie'?'houve empate':E.names[city.from]+' foi o mais votado')+'. '+(city.second?'No 2º, '+(city.to==='tie'?'houve empate':E.names[city.to]+' liderou')+'.':'O 2º turno está indisponível.');
  compare=body;
 }else if(s.metric!=='leadership'){
  const m=E.metrics[s.metric],loc=city?city.name:'RN (total estadual)',a=city?E.value(city,s.metric,1,s.candidate):E.stateValue(model,s.metric,1,s.candidate),b=city?E.value(city,s.metric,2,s.candidate):E.stateValue(model,s.metric,2,s.candidate);
  const topic=m.label+(m.candidate?' · '+E.names[s.candidate]:'');
  title=topic;subhead=(city?city.name:'Rio Grande do Norte')+' · '+(s.view==='first'?'1º turno':s.view==='second'?'2º turno':'Comparação dos turnos');
  count=E.format(s.view==='first'?a:s.view==='second'?b:a===null||b===null?null:b-a,s.view==='delta'&&m.unit==='pct'?'pp':m.unit,s.view==='delta');label=topic;
  if(s.view==='first'||b===null)body=loc+': '+topic+', '+E.format(a,m.unit)+' no 1º turno.'+(b===null?' Sem comparação disponível.':'');
  else if(s.view==='second')body=loc+': '+topic+', '+E.format(b,m.unit)+' no 2º turno.';
  else body=loc+': '+topic+' passou de '+E.format(a,m.unit)+' no 1º turno para '+E.format(b,m.unit)+' no 2º. Variação de '+E.format(a===null||b===null?null:b-a,m.unit==='pct'?'pp':m.unit,true)+'.';
  compare=body;
 }else if(!model.ready||s.view!=='delta'){
  const round=s.view==='second'?'2º':'1º';count=n;label='municípios neste recorte';title='Quem liderou no '+round+' turno';body='Governador do RN: veja na imagem o candidato mais votado em cada um dos '+n+' municípios deste recorte no '+round+' turno.';compare=body;
 }else if(routes.includes(group)){
  const [a,b]=group.split('-');count=n;
  if(a===b){title=short[a]+' manteve a liderança em '+n+' municípios';label='municípios com a mesma liderança';body='Governador do RN: '+E.names[a]+' foi o mais votado nos dois turnos em '+n+' municípios.';compare='Em '+n+' municípios do RN, a liderança para governador permaneceu com '+E.names[a]+' do 1º para o 2º turno.'}
  else{title=short[a]+' → '+short[b]+': '+n+' municípios';label='municípios com esta mudança';body=n?'Governador do RN: em '+n+' municípios, '+E.names[a]+' foi o mais votado no 1º turno e '+E.names[b]+' no 2º.':'Governador do RN: nenhum município passou da liderança de '+E.names[a]+' no 1º turno para '+E.names[b]+' no 2º.';compare=body+(n?' Mudança de liderança municipal.':'')}
 }else if(group.startsWith('from-')){
  const a=group.slice(5),c13=rows.filter(r=>r.to==='13').length,c44=rows.filter(r=>r.to==='44').length;count=n;label='municípios liderados por '+short[a]+' no 1º turno';title='Onde '+short[a]+' liderava no primeiro turno';
  body='Governador do RN: dos '+n+' municípios onde '+E.names[a]+' liderou no 1º turno, '+c13+' tiveram Cadu e '+c44+' Allyson em 1º lugar no 2º.';compare=body;
 }else if(group.startsWith('to-')){
  const b=group.slice(3);count=n;label='municípios liderados por '+short[b]+' no 2º turno';title='A origem das lideranças de '+short[b];
  body='Governador do RN: '+E.names[b]+' liderou em '+n+' municípios no 2º turno. No 1º, '+rows.filter(r=>r.from==='13').length+' eram liderados por Cadu, '+rows.filter(r=>r.from==='44').length+' por Allyson e '+rows.filter(r=>r.from==='22').length+' por Álvaro.';compare=body;
 }else if(group==='same'){
  count=n;label='municípios mantiveram a liderança';title=n+' municípios mantiveram a liderança';
  body='Governador do RN: '+n+' municípios mantiveram o mesmo candidato em 1º lugar nos dois turnos: '+counts['13-13']+' com Cadu e '+counts['44-44']+' com Allyson.';compare='A liderança se repetiu em '+n+' municípios do RN: Cadu foi o mais votado nos dois turnos em '+counts['13-13']+' cidades; Allyson, em '+counts['44-44']+'.';
 }else if(group==='changed'){
  count=n;label='municípios mudaram de liderança';title=n+' municípios mudaram de liderança';
  body='Governador do RN: '+n+' municípios mudaram de candidato mais votado entre os turnos.';
  compare='Governador do RN: '+n+' municípios mudaram de liderança. '+counts['44-13']+' passaram de Allyson para Cadu; '+counts['22-13']+' de Álvaro para Cadu; '+counts['22-44']+' de Álvaro para Allyson; '+counts['13-44']+' de Cadu para Allyson.';
 }else if(group==='tie'){
  count=n;label='municípios com empate';title='Empates na liderança municipal';body='Governador do RN: '+n+' municípios tiveram empate na primeira posição em pelo menos um dos turnos.';compare=body;
 }else{
  body='Governador do RN: '+changed+' dos '+n+' municípios mudaram de candidato mais votado entre os turnos; '+same+' mantiveram a liderança.';
  compare='Governador do RN: das '+changed+' mudanças de liderança, '+counts['44-13']+' foram de Allyson para Cadu, '+counts['22-13']+' de Álvaro para Cadu, '+counts['22-44']+' de Álvaro para Allyson e '+counts['13-44']+' de Cadu para Allyson.';
 }
 return {rows,count,label,title,subhead,body:body+search,compare:compare+search,counts,changed,same,source};
}
function makePost(brief,{style='summary',page=0,pageCount=1,pageRows=[]}={}){
 let main=style==='compare'?brief.compare:brief.body;
 const part=pageCount>1?' Lista de municípios: parte '+(page+1)+'/'+pageCount+'.':' Lista de municípios na imagem.';
 if(style==='names')main=brief.body+part;
 let text=main+' '+source;
 if(!analyzeText(text).valid){text=brief.body.replace(/ No recorte da busca .*$/,'')+(style==='names'?part:'')+' '+source}
 return text;
}
function pages(rows,size){const count=size==='1600x900'?16:size==='1200x1200'?12:16;return rows.length?Array.from({length:Math.ceil(rows.length/count)},(_,i)=>rows.slice(i*count,(i+1)*count)):[[]]}
const api={brief,makePost,pages,analyzeText,routes,short};
if(typeof module!=='undefined')module.exports=api;root.ElectionPublications=api;
})(typeof window!=='undefined'?window:globalThis);
