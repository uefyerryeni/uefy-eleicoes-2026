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
 return {rows,city,settings:{...s},ready:model.ready,count,label,title,subhead,body:body+search,compare:compare+search,counts,changed,same,source};
}
function makePost(brief,{style='summary',page=0,pageCount=1,pageRows=[],template='map'}={}){
 let main=style==='compare'?brief.compare:brief.body;
 const part=pageCount>1?' Lista de municípios: parte '+(page+1)+'/'+pageCount+'.':' Lista de municípios na imagem.';
 if(style==='names')main=brief.body+part;else if(pageCount>1)main+=' '+(template==='ranking'?'Ranking':template==='compare'?'Comparação':'Quadro')+': parte '+(page+1)+'/'+pageCount+'.';
 let text=main+' '+source;
 if(!analyzeText(text).valid){text=brief.body.replace(/ No recorte da busca .*$/,'')+(style==='names'?part:'')+' '+source}
 return text;
}
// Cada cidade é selecionada dentro do recorte atual, nunca pela população.
function editorial(b,{limit=5,style='summary',page=0,pageCount=1,pageRows=[],template='map'}={}){
 const s=b.settings,lead=s.metric==='leadership',delta=lead&&b.ready&&s.view==='delta',group=s.group||'all';
 const electorate=r=>E.value(r,'electorate',1,s.candidate);
 let cohort=b.city?[b.city]:delta&&group==='all'?b.rows.filter(r=>r.status==='changed'):b.rows;
 let criterion=lead?'Ordem: maior eleitorado para governador no 1º turno.':'Ordem: '+(s.sort==='asc'?'menor':'maior')+' valor do indicador no recorte temporal escolhido.';
 let ranked=lead?[...cohort].sort((a,c)=>(electorate(c)||0)-(electorate(a)||0)||a.name.localeCompare(c.name,'pt-BR')):cohort.filter(r=>Number.isFinite(E.displayed(r,s.metric,s.view,s.candidate))).sort((a,c)=>(s.sort==='asc'?1:-1)*(E.displayed(a,s.metric,s.view,s.candidate)-E.displayed(c,s.metric,s.view,s.candidate))||a.name.localeCompare(c.name,'pt-BR'));
 const selected=ranked.slice(0,limit===10?10:5),counts=b.counts;
 let intro=b.body;
 if(delta&&!b.city){
  if(group==='all')intro='Governador do RN: '+b.changed+' municípios mudaram de liderança; '+b.same+' mantiveram.';
  else if(group==='changed')intro='Governador do RN: '+b.count+' municípios mudaram de liderança entre os turnos.';
  else if(group==='same')intro='Governador do RN: '+b.count+' municípios mantiveram a liderança ('+counts['13-13']+' Cadu; '+counts['44-44']+' Allyson).';
  else if(routes.includes(group)){
   const [a,c]=group.split('-');
   intro=b.count?(a===c?'Governador do RN: '+short[a]+' liderou nos dois turnos em '+b.count+' municípios.':'Governador do RN: '+b.count+' municípios, de '+short[a]+' no 1º para '+short[c]+' no 2º turno.'):b.body;
  }else if(group.startsWith('from-')){
   const a=group.slice(5);intro='Governador do RN: '+short[a]+' liderava em '+b.count+' municípios no 1º. No 2º: '+b.rows.filter(r=>r.to==='13').length+' com Cadu e '+b.rows.filter(r=>r.to==='44').length+' com Allyson.';
  }else if(group.startsWith('to-')){
   const c=group.slice(3);intro='Governador do RN: '+short[c]+' liderou '+b.count+' municípios no 2º. No 1º: '+b.rows.filter(r=>r.from==='13').length+' com Cadu, '+b.rows.filter(r=>r.from==='44').length+' Allyson e '+b.rows.filter(r=>r.from==='22').length+' Álvaro.';
  }
 }
 if(style==='compare')intro=b.compare;
 if(s.search&&!intro.includes('recorte da busca'))intro+=' Busca: “'+s.search.slice(0,45)+'”.';
 const route=r=>delta?(short[r.from]||'Empate')+' → '+(short[r.to]||'Empate'):(short[s.view==='second'?r.to:r.from]||'Empate');
 const value=r=>E.format(E.displayed(r,s.metric,s.view,s.candidate),s.view==='delta'&&E.metrics[s.metric].unit==='pct'?'pp':E.metrics[s.metric].unit,s.view==='delta');
 const cityName=r=>r.name.toLocaleLowerCase('pt-BR').replace(/(^|[\s-])\p{L}/gu,x=>x.toLocaleUpperCase('pt-BR')).replace(/\b(De|Da|Do|Das|Dos|E)\b/g,x=>x.toLowerCase());
 const rowText=(r,i,full=false)=>{
  if(lead)return (i+1)+'. '+cityName(r)+' — '+route(r)+(full?' · '+E.format(electorate(r),'count')+' eleitores (1º turno)':'');
  const a=E.value(r,s.metric,1,s.candidate),c=E.value(r,s.metric,2,s.candidate);
  return (i+1)+'. '+cityName(r)+' — '+(full?'1º: '+E.format(a,E.metrics[s.metric].unit)+'; 2º: '+E.format(c,E.metrics[s.metric].unit)+'; valor no recorte: ':'')+value(r);
 };
 const cohortLabel=delta&&group==='all'?'municípios que mudaram de liderança':'municípios deste recorte';
 const rankingLabel=lead?'Maiores eleitorados (1º turno) entre os '+cohortLabel+':':(s.view==='delta'?'Variação municipal (2º − 1º turno)':'Valores municipais no '+(s.view==='first'?'1º':'2º')+' turno')+':';
 const breakdown=delta&&!b.city?routes.filter(k=>counts[k]>0).map(k=>{const [a,c]=k.split('-');return short[a]+' → '+short[c]+': '+counts[k]+' municípios.'}).join(' '):'';
 const report=[b.body,breakdown,selected.length?rankingLabel+'\n'+selected.map((r,i)=>rowText(r,i,true)).join('\n'):'Nenhum município com dado disponível neste recorte.',criterion,delta?'A seta indica o candidato mais votado no 1º e no 2º turno; não representa transferência individual de votos.':'',source].filter(Boolean).join('\n\n');
 // As partes de texto são independentes das partes de imagem.
 const imagePart=pageCount>1?' Imagem: parte '+(page+1)+'/'+pageCount+'.':'';
 const namesMode=style==='names';
 const examples=b.city?[]:namesMode?pageRows.filter(r=>r&&r.code):selected;
 const compactCriterion=lead?'Maiores eleitorados (1º):':'Municípios · '+(s.view==='delta'?'variação 2º − 1º':s.view==='first'?'1º turno':'2º turno')+':';
 const cohortContext=delta?(routes.includes(group)?short[group.split('-')[0]]+' (1º) → '+short[group.split('-')[1]]+' (2º)':group.startsWith('from-')?short[group.slice(5)]+' no 1º → liderança no 2º':group.startsWith('to-')?'Lideranças de '+short[group.slice(3)]+' no 2º':group==='same'?'Mantiveram a liderança (1º → 2º)':'Mudaram de liderança (1º → 2º)'):'Liderança no '+(s.view==='second'?'2º':'1º')+' turno';
 const context=lead?'RN · governador · '+cohortContext+'.':'RN · '+E.metrics[s.metric].label+(E.metrics[s.metric].candidate?' · '+short[s.candidate]:'')+'.';
 const entries=examples.map((r,i)=>rowText(r,namesMode?b.rows.indexOf(r):i));
 const firstHeader=(namesMode?b.body+' Lista de municípios: parte '+(page+1)+'/'+pageCount+'.':intro+imagePart);
 const exampleHeader=namesMode?'Municípios desta imagem:':compactCriterion+(delta&&group==='all'?' mudaram de liderança':'');
 const tail=' '+source;
 const fits=t=>analyzeText(t+tail+' [99/99]').valid;
 let segments=[],current=firstHeader,header=context+imagePart+'\n'+exampleHeader;
 // Longas comparações são divididas por frases; nenhum nome é cortado.
 if(!fits(current)){
  const sentences=current.match(/[^.!?]+[.!?]*/g)||[current];current='';
  for(const sentence of sentences){
   if(!fits((current?current+' ':'')+sentence.trim())&&current){segments.push(current);current=''}
   if(!fits(sentence.trim()))throw new Error('Resumo excede o limite editorial do X.');
   current+=(current?' ':'')+sentence.trim();
  }
 }
 if(entries.length){
  if(fits(current+'\n'+exampleHeader+'\n'+entries[0]))current+='\n'+exampleHeader;
  else{segments.push(current);current=header}
  for(const entry of entries){
   if(!fits(current+'\n'+entry)){segments.push(current);current=header}
   if(!fits(current+'\n'+entry))throw new Error('Nome de município excede o espaço do texto.');
   current+='\n'+entry;
  }
 }
 if(current)segments.push(current);
 const posts=segments.map((t,i)=>t+(segments.length>1?' ['+(i+1)+'/'+segments.length+']':'')+tail);
 return {posts,report,selected,criterion,cohortCount:cohort.length};
}

function pageCapacity(size,template='list'){
 const wide=size==='1600x900',square=size==='1200x1200';
 return template==='routes'?(wide?2:6):template==='ranking'?(wide?2:square?4:5):wide?2:square?4:6;
}
function chunks(rows,count){return rows.length?Array.from({length:Math.ceil(rows.length/count)},(_,i)=>rows.slice(i*count,(i+1)*count)):[[]]}
function pages(rows,size){return chunks(rows,pageCapacity(size))}
function artPages(rows,{template,size,s}){
 if(template==='compare')return [rows,rows];
 if(template==='routes')return chunks(routes,pageCapacity(size,'routes'));
 if(template==='ranking'){
  const ranked=rows.filter(r=>Number.isFinite(E.displayed(r,s.metric,s.view,s.candidate))).sort((a,b)=>s.sort==='asc'?E.displayed(a,s.metric,s.view,s.candidate)-E.displayed(b,s.metric,s.view,s.candidate):E.displayed(b,s.metric,s.view,s.candidate)-E.displayed(a,s.metric,s.view,s.candidate)).slice(0,8);
  return chunks(ranked,pageCapacity(size,'ranking'));
 }
 return template==='list'?pages(rows,size):[rows];
}
const api={brief,makePost,editorial,pages,analyzeText,routes,short,pageCapacity,artPages};
if(typeof module!=='undefined')module.exports=api;root.ElectionPublications=api;
})(typeof window!=='undefined'?window:globalThis);
