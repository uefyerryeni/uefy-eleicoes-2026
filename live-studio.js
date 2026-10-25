/* UEFY LIVE 2026 — estágio de exibição; nunca gera resultados fictícios. */
(function(){
'use strict';
const $=s=>document.querySelector(s), $$=s=>Array.from(document.querySelectorAll(s));
const fmtVotes=n=>Number(n).toLocaleString('pt-BR');
const fmtPct=n=>Number(n).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})+'%';
const fmtSmall=n=>Number(n).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
const endpoints={
 rn:'https://resultados.tse.jus.br/oficial/ele2026/6260/dados/rn/rn-c0003-e006260-u.json',
 br:'https://resultados.tse.jus.br/oficial/ele2026/6258/dados/br/br-c0001-e006258-u.json'
};
const config={
 rn:{title:'O RN decide',place:'RIO GRANDE DO NORTE',subtitle:'GOVERNADOR DO RIO GRANDE DO NORTE',cargo:3,election:'6260',expect:['44','13'],
   waiting:[{number:'44',name:'ALLYSON BEZERRA',party:'UNIÃO BRASIL'},{number:'13',name:'CADU DE LULA',party:'PT'}]},
 br:{title:'O Brasil decide',place:'BRASIL INTEIRO',subtitle:'PRESIDÊNCIA DA REPÚBLICA',cargo:1,election:'6258',expect:['22','13'],
   waiting:[{number:'22',name:'FLÁVIO BOLSONARO',party:'PL'},{number:'13',name:'LULA',party:'PT'}]}
};
const params=new URLSearchParams(location.search);
const capture=params.get('capture')==='1';
let scope=params.get('scope')==='br'?'br':'rn';
let scene=params.get('scene')==='panorama'?'panorama':'placar';
let auto=params.get('auto')!=='0';
let busy=false, intervalAuto=null;
const store={
 rn:{state:'waiting',result:null,registry:null,reason:'Aguardando o horário oficial de divulgação.',checkedAt:null},
 br:{state:'waiting',result:null,registry:null,reason:'Aguardando o horário oficial de divulgação.',checkedAt:null}
};
if(capture)document.body.classList.add('capture-mode');
$('#deskStatus').setAttribute('aria-live','polite');
function timeInBrasilia(){
 return new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).format(new Date());
}
function eligibleNow(){
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23'}).formatToParts(new Date());
 const get=t=>parts.find(x=>x.type===t)?.value||'';
 const date=get('year')+'-'+get('month')+'-'+get('day');
 return date>'2026-10-25'||(date==='2026-10-25'&&Number(get('hour'))>=17);
}
function syncScale(){
 const el=$('#broadcastViewport'),screen=$('#broadcast');
 const scale=capture?Math.min(innerWidth/1920,innerHeight/1080):el.clientWidth/1920;
 const x=capture?(innerWidth-1920*scale)/2:0,y=capture?(innerHeight-1080*scale)/2:0;
 screen.style.transform='translate('+x+'px,'+y+'px) scale('+scale+')';
}
function colorOf(number,key){
 if(number==='13')return '#e95753';
 if(key==='rn'&&number==='44')return '#318ee3';
 if(key==='br'&&number==='22')return '#3ea991';
 return '#f4dd19';
}
// Somente a indicação oficial de definição matemática (md=e), ou uma
// totalização final acompanhada de candidatura declarada eleita, habilita o anúncio.
// Em hipótese alguma estimamos a definição pela diferença entre os votos.
function officialElectedCandidate(data,candidates,final){
 const mathematicallyDefined=String(data.md||'').trim().toLowerCase()==='e';
 if(!mathematicallyDefined&&!final)return null;
 const marked=candidates.filter(c=>c.elected==='s'||/^eleito\b/i.test(c.totalizationStatus.trim()));
 if(marked.length>1)return null;
 const selected=marked.length===1?marked[0]:(mathematicallyDefined?candidates[0]:null);
 if(!selected||Number(selected.votes)<=0||Number(selected.votes)<Number(candidates[0].votes))return null;
 if(mathematicallyDefined&&Number(candidates[0].votes)===Number(candidates[1].votes))return null;
 return {number:selected.number,name:selected.name,party:selected.party,mathematicallyDefined};
}
function render(){
 const c=config[scope],s=store[scope],valid=s.state==='ready'&&!!s.result;
 const result=valid?s.result:null;
 const candidates=result?result.candidates:c.waiting.map(x=>Object.assign({votes:0,pct:0},x));
 const final=result?.finalTotalization===true;
 const elected=valid?result.officialElected:null;
 const defined=!!elected;
 const statusTitle=valid?(final?'Totalização concluída':defined?'Eleição matematicamente definida':'Apuração em andamento'):
   s.state==='blocked'?'Consulta indisponível':eligibleNow()?'Aguardando boletim':'Aguardando o TSE';
 const stateLabel=valid?(final?'RESULTADO FINAL / TSE':defined?'ELEITO DEFINIDO / TSE':'APURAÇÃO PARCIAL / TSE'):
   s.state==='blocked'?'DADOS NÃO CONFIRMADOS':eligibleNow()?'AGUARDANDO RESULTADO VALIDADO':'AGUARDANDO DIVULGAÇÃO OFICIAL';
 $('#broadcast').dataset.state=s.state;
 $('#broadcast').dataset.scene=scene;
 $('#broadcast').dataset.decision=defined?'elected':'none';
 $('#screenLocation').textContent=c.place;
 $('#screenTitle').textContent=c.title;const dot=document.createElement('span');dot.textContent='.';$('#screenTitle').append(dot);
 $('#screenSubtitle').textContent=c.subtitle;
 $('#screenEdition').textContent=valid?(final?'RESULTADO FINAL · TSE':defined?'ELEIÇÃO DEFINIDA · TSE':'DADOS PARCIAIS · TSE'):'BOLETIM OFICIAL · TSE';
 $('#screenResultState').textContent=stateLabel;
 $('#footerState').textContent=stateLabel;
 $('#bulletinTitle').textContent=statusTitle;
 $('#bulletinText').textContent=valid?(
   defined?elected.name+' ('+elected.party+') · eleição definida pelo TSE. A totalização segue em '+fmtPct(result.progress)+' das seções.':
   final?'A totalização foi identificada como concluída pelo boletim oficial.':
   'Os números refletem o último boletim validado e podem mudar.'):
   s.state==='blocked'?'Uma verificação falhou. Os números foram ocultados; novas tentativas seguem automáticas.':
   eligibleNow()?'Consulta ativa. Aguardando um boletim oficial íntegro e com votos.':'A exibição dos votos começa somente após as 17h, horário de Brasília.';
 $('#sourceTime').textContent=valid?result.generatedAt:'—';
 $('#progressValue').textContent=valid?fmtPct(result.progress):'—';
 $('#progressFill').style.width=valid?Math.max(0,Math.min(100,result.progress))+'%':'0%';
 $('#signalNumber').textContent=scope==='rn'?'01 / 02':'02 / 02';
 $('#countType').textContent=valid?'PERCENTUAL DOS VOTOS VÁLIDOS':'VOTOS AINDA NÃO DISPONÍVEIS';
 const list=candidates.slice(0,2);
 list.forEach((item,index)=>{
   $('#number'+index).textContent=item.number;
   $('#name'+index).textContent=item.name;
   $('#party'+index).textContent=item.party;
   $('#pct'+index).textContent=valid?fmtPct(item.pct):'—';
   $('#votes'+index).textContent=valid?fmtVotes(item.votes)+' VOTOS':'AGUARDANDO VOTOS';
   $('#bar'+index).style.width=valid?Math.max(0,Math.min(100,item.pct))+'%':'0%';
   const isElected=defined&&elected.number===item.number;
   $('#candidate'+index).style.setProperty('--candidate-color',colorOf(item.number,scope));
   $('#candidate'+index).dataset.elected=isElected?'true':'false';
   $('#candidate'+index+' .candidate-kicker').textContent=isElected?'ELEITO · CONFIRMADO PELO TSE':'CANDIDATURA '+String(index+1).padStart(2,'0');
 });
 const total=valid?list.reduce((n,x)=>n+x.votes,0):0;
 const gap=valid?Math.abs(list[0].pct-list[1].pct):0;
 $('#overviewHeadline').textContent=valid?(defined?'Eleição definida':final?'O resultado oficial':'A apuração avança'):'O voto em movimento';
 const dot2=document.createElement('span');dot2.textContent='.';$('#overviewHeadline').append(dot2);
 $('#overviewCopy').textContent=valid?(defined?elected.name+' ('+elected.party+') · eleito confirmado pelo TSE. '+fmtPct(result.progress)+' das seções totalizadas.':final?'Totalização concluída segundo o TSE. Veja os resultados detalhados no placar.':'Dados parciais e atualizados a partir da divulgação oficial. A disputa ainda pode mudar.'):
    s.state==='blocked'?'Sem números na tela até a próxima conferência bem-sucedida.':'Acompanhamento do resultado oficial do TSE, sem projeções e sem votos estimados.';
 $('#overviewProgress').textContent=valid?fmtPct(result.progress):'—';
 $('#overviewVotes').textContent=valid?fmtVotes(total):'—';
 $('#overviewVotesHint').textContent=valid?'Votos válidos às duas candidaturas':'Aguardando resultados oficiais';
 $('#overviewGap').textContent=valid?fmtSmall(gap)+' pp':'—';
 $('#footerUpdated').textContent=valid?'BOLETIM: '+result.generatedAt:eligibleNow()?'NOVA CONSULTA A CADA 60 S':'DIVULGAÇÃO A PARTIR DAS 17H';
 const status=store.rn.state==='ready'&&store.br.state==='ready'?'RN e Brasil: boletins oficiais validados.':
   'RN: '+labelState(store.rn)+' · Brasil: '+labelState(store.br)+'.';
 $('#deskStatus').textContent=status;
 $$('[data-scope]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.scope===scope)));
 $$('[data-scene]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.scene===scene)));
 $('#autoToggle').setAttribute('aria-pressed',String(auto));
 $('#autoToggle .auto-state').textContent=auto?'LIGADO':'DESLIGADO';
 syncLinks();syncScale();
}
function labelState(s){return s.state==='ready'?'dados oficiais':s.state==='blocked'?'consulta pendente':'aguardando';}
function syncLinks(){
 const u=new URL('estudio-live.html',location.href);
 u.searchParams.set('capture','1');
 u.searchParams.set('auto',auto?'1':'0');
 u.searchParams.set('scope',scope);u.searchParams.set('scene',scene);
 $('#captureLink').href=u.href;$('#captureUrl').textContent=u.href;
 if(capture){
   const here=new URL(location.href);
   here.searchParams.set('scope',scope);
   here.searchParams.set('scene',scene);
   here.searchParams.set('auto',auto?'1':'0');
   history.replaceState(null,'',here.pathname+here.search);
 }
}
function parseResult(data,key,registry){
 const rows=(data.carg||[]).flatMap(c=>(c.agr||[]).flatMap(a=>(a.par||[]).flatMap(p=>(p.cand||[]).map(cand=>({number:String(cand.n||''),votes:Number(cand.vap),pct:Number(String(cand.pvap).replace(',','.')),voteDestination:String(cand.dvt||''),elected:String(cand.e||'').toLowerCase(),totalizationStatus:String(cand.st||'')})))));
 const byNumber=new Map(registry.map(x=>[String(x.numero),x]));
 const candidates=rows.map(row=>{
   const registered=byNumber.get(row.number);
   if(!registered)throw Error('Identidade da candidatura não coincide com o registro TSE.');
   const editorial=config[key].waiting.find(x=>x.number===row.number);
   return Object.assign({},row,{name:editorial?.name||registered.nome,number:String(registered.numero),party:editorial?.party||registered.partido});
 }).sort((a,b)=>b.votes-a.votes||Number(a.number)-Number(b.number));
 const result={
   progress:Number(String(data.s.pst).replace(',','.')),
   candidates,
   generatedAt:[data.dg,data.hg].filter(Boolean).join(' · '),
   finalTotalization:String(data.tf||'').toLowerCase()==='s'&&Number(String(data.s.pst).replace(',','.'))>=100,
   mathematicallyDefined:String(data.md||'').trim().toLowerCase(),
   stale:false
 };
 if(!window.UEFYElection||!window.UEFYElection.publishable(result,config[key].expect))throw Error('Resultado sem condições de exibição.');
 if(new Set(candidates.map(x=>x.number)).size!==2)throw Error('Número de candidaturas incompatível.');
 result.officialElected=officialElectedCandidate(data,candidates,result.finalTotalization);
 return result;
}
async function registryFor(key){
 const s=store[key];
 if(s.registry)return s.registry;
 const url=key==='rn'?'data/candidatos-ufs-c.json':'data/candidatos-2026.json';
 const r=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(15000)});
 if(!r.ok)throw Error('Base de candidaturas HTTP '+r.status);
 const body=await r.json();
 if(key==='br'&&body.source!=='TSE/AGEL - Candidatos 2026')throw Error('Fonte do cadastro presidencial divergente.');
 const registry=key==='rn'?(body.rn?.candidates||[]).filter(x=>Number(x.cargo)===3):(body.pres||[]);
 const numbers=config[key].expect;
 const matched=numbers.map(n=>registry.find(row=>String(row.numero)===n));
 if(matched.some(x=>!x))throw Error('Registro de candidato ausente do cadastro.');
 if(matched.some(x=>!x.nome||!x.partido))throw Error('Registro de candidato incompleto.');
 if(matched.some((x,i)=>i===0?(key==='rn'?!/UNIÃO/i.test(String(x.partido)) :String(x.partido)!=='PL'):String(x.partido)!=='PT'))throw Error('Partidos divergentes do segundo turno.');
 s.registry=matched;return matched;
}
async function loadScope(key){
 const s=store[key],c=config[key];
 if(!eligibleNow()){s.state='waiting';s.result=null;s.reason='Horário oficial ainda não iniciado.';render();return;}
 try{
   const registry=await registryFor(key);
   const r=await fetch(endpoints[key],{cache:'no-store',signal:AbortSignal.timeout(15000)});
   if(!r.ok)throw Error('EA20 HTTP '+r.status);
   const body=await r.json();
   if(!window.UEFYElection)throw Error('Módulo de integridade indisponível.');
   window.UEFYElection.validate(body,{election:c.election,cargo:c.cargo,scope:key});
   const result=parseResult(body,key,registry);
   s.result=result;s.state='ready';s.reason='Boletim validado.';s.checkedAt=Date.now();
 }catch(err){
   s.result=null;s.reason=String(err?.message||err);
   s.state=s.reason.includes('404')?'waiting':'blocked';
   if(s.reason.includes('404'))s.reason='Boletim oficial ainda não publicado.';
   console.warn('UEFY Live / '+key+': '+s.reason);
 }
 render();
}
async function refreshAll(){
 if(busy)return;busy=true;
 try{await Promise.allSettled([loadScope('rn'),loadScope('br')]);}
 finally{busy=false;render();}
}
function applyScene(nextScope,nextScene){
 scope=nextScope;scene=nextScene;render();
}
const rotation=[['rn','placar'],['br','placar'],['rn','panorama'],['br','panorama']];
function syncAuto(){
 if(intervalAuto){clearInterval(intervalAuto);intervalAuto=null;}
 if(auto){intervalAuto=setInterval(()=>{
   const index=rotation.findIndex(x=>x[0]===scope&&x[1]===scene);
   const next=rotation[(index+1+rotation.length)%rotation.length];
   applyScene(next[0],next[1]);
 },18000);}
 render();
}
$$('[data-scope]').forEach(b=>b.addEventListener('click',()=>{auto=false;syncAuto();applyScene(b.dataset.scope,scene);}));
$$('[data-scene]').forEach(b=>b.addEventListener('click',()=>{auto=false;syncAuto();applyScene(scope,b.dataset.scene);}));
$('#autoToggle').addEventListener('click',()=>{auto=!auto;syncAuto();});
$('#refreshNow').addEventListener('click',()=>refreshAll());
$('#copyUrl').addEventListener('click',async()=>{
 const b=$('#copyUrl');try{await navigator.clipboard.writeText($('#captureUrl').textContent);b.textContent='URL COPIADA ✓';}
 catch(e){b.textContent='SELECIONE A URL';}
 setTimeout(()=>{b.textContent='Copiar URL';},2500);
});
window.addEventListener('resize',syncScale);
if(window.ResizeObserver)new ResizeObserver(syncScale).observe($('#broadcastViewport'));
function clock(){ $('#screenClock').textContent=timeInBrasilia();if(!eligibleNow())render(); }
render();clock();syncAuto();refreshAll();
setInterval(clock,1000);
setInterval(refreshAll,60000);
})();
