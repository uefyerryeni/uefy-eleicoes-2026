/* Cálculos municipais; não inferem transferência individual de votos. */
(function(root){'use strict';
const names={'13':'Cadu de Lula','44':'Allyson Bezerra','22':'Álvaro Dias'},colors={'13':'#d62828','44':'#1976d2','22':'#2e7d32'};
const alias=n=>String(n||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const key=n=>({acu:'assu',ares:'arez',januariocicco:'boasaude'})[alias(n)]||alias(n);
const finite=n=>typeof n==='number'&&Number.isFinite(n);
const unique=(items,label)=>{const m=new Map();for(const r of items){if(!/^\d{5}$/.test(String(r.code))||m.has(String(r.code)))throw Error(label+': código municipal inválido ou duplicado');m.set(String(r.code),r)}return m};
function validLeader(r){
 if(!r||r.status!=='ok'||r.progress!==100||!Array.isArray(r.top3)||r.top3.length<2)return false;
 if(new Set(r.top3.map(c=>String(c.number))).size!==r.top3.length)return false;
 if(!r.top3.every((c,i)=>finite(c.votes)&&c.votes>=0&&Number.isInteger(c.votes)&&finite(c.pct)&&c.pct>=0&&c.pct<=100&&(!i||r.top3[i-1].votes>=c.votes)))return false;
 return String(r.top3[0].number)===String(r.candidate_number)&&r.top3[0].votes===r.votes;
}
function validParticipation(r){
 if(!r)return false;
 return ['electorate','turnout','abstention','total_votes','valid','blank','null'].every(k=>finite(r[k])&&r[k]>=0&&Number.isInteger(r[k]))&&r.electorate>0&&r.total_votes>0&&r.valid>0&&r.turnout+r.abstention===r.electorate&&r.valid+r.blank+r.null===r.total_votes;
}
function leader(r){return r.top3[0].votes===r.top3[1].votes?'tie':String(r.candidate_number)}
function build(first,second,analysis,participation,geo){
 if(!first.publication_ready||first.municipalities_read!==167||(first.errors||[]).length)throw Error('Primeiro turno sem base completa');
 if(analysis.status!=='ok'||analysis.municipalities_read!==167||(analysis.errors||[]).length)throw Error('Indicadores do primeiro turno incompletos');
 const a=unique(Object.entries(first.leaders||{}).map(([name,r])=>({...r,name})),'1º turno'),p=unique(analysis.cross?.municipalities||[],'Indicadores');
 if(a.size!==167||p.size!==167)throw Error('Esperados 167 municípios no primeiro turno');
 if(!Array.isArray(geo.features)||geo.features.length!==167||new Set(geo.features.map(f=>key(f.properties.nome))).size!==167)throw Error('Malha municipal inválida');
 const geometry=new Map(geo.features.map(f=>[key(f.properties.nome),f]));
 let b=new Map(),p2=new Map(),ready=false,secondError='Segundo turno incompleto ou indisponível';
 try{
  if(second.round!==2||String(second.election_id)!=='6260'||!second.publication_ready||second.municipalities_read!==167||(second.errors||[]).length)throw Error(secondError);
  if(participation.round!==2||String(participation.election_ids?.gov)!=='6260'||String(participation.election_ids?.pres)!=='6258'||!participation.publication_ready||participation.municipalities_read!==167||(participation.errors||[]).length)throw Error(secondError);
  b=unique(Object.values(second.leaders||{}),'2º turno');p2=unique(participation.municipalities||[],'Indicadores do 2º turno');
  if(b.size!==167||p2.size!==167)throw Error(secondError);
  for(const code of a.keys()){
   const next=b.get(code),ind=p2.get(code);
   if(!validLeader(next)||!validParticipation(ind?.gov)||!validParticipation(ind?.pres)||!next.top3.every(c=>['13','44'].includes(String(c.number))))throw Error(secondError);
  }
  if(!validParticipation(participation.state?.gov)||!validParticipation(participation.state?.pres))throw Error(secondError);
  ready=true;secondError='';
 }catch(e){b=new Map();p2=new Map();secondError=e.message}
 const rows=[];
 for(const [code,r] of a){
  const ind=p.get(code)?.participation;
  if(!validLeader(r)||!validParticipation(ind?.governor)||!validParticipation(ind?.president))throw Error('Primeiro turno inválido em '+r.name);
  const feature=geometry.get(key(r.name));if(!feature)throw Error('Município sem geometria: '+r.name);
  const next=ready?b.get(code):null,from=leader(r),to=next?leader(next):null;
  rows.push({code,name:r.name,first:r,second:next,p1:ind,p2:ready?p2.get(code):null,from,to,status:!next?'pending':from==='tie'||to==='tie'?'tie':from===to?'same':'changed',feature});
 }
 rows.sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'));
 return {rows,ready,secondError,first,second,analysis,participation};
}
const metrics={
 leadership:{label:'Candidatura mais votada',unit:'category',note:'Primeira posição municipal; empates são identificados separadamente.'},
 candidate_pct:{label:'Votação da candidatura',unit:'pct',candidate:true,note:'Percentual sobre votos válidos para Governador em cada turno. Variação em pontos percentuais.'},
 candidate_votes:{label:'Votos da candidatura',unit:'count',candidate:true,note:'Votos absolutos da mesma candidatura em cada turno.'},
 margin:{label:'Vantagem do primeiro colocado',unit:'pp',note:'Diferença entre primeiro e segundo colocados de cada turno. Os candidatos podem mudar.'},
 turnout_pct:{label:'Comparecimento',unit:'pct',field:'turnout',base:'electorate'},
 abstention_pct:{label:'Abstenção',unit:'pct',field:'abstention',base:'electorate'},
 electorate:{label:'Eleitorado',unit:'count',field:'electorate'},
 turnout:{label:'Comparecimento em eleitores',unit:'count',field:'turnout'},
 abstention:{label:'Ausências',unit:'count',field:'abstention'}
};
for(const [office,label] of [['gov','Governador'],['pres','Presidente']])for(const [field,title] of [['blank','Brancos'],['null','Nulos'],['valid','Válidos'],['total_votes','Total de votos']]){
 metrics[office+'_'+field]={label:title+' · '+label,unit:'count',field,office};
 if(field!=='total_votes')metrics[office+'_'+field+'_pct']={label:title+' · '+label+' (%)',unit:'pct',field,office,base:'total_votes'};
}
const candidate=(r,n)=>r?.top3?.find(c=>String(c.number)===n);
function value(r,id,round,n='13'){
 const m=metrics[id],l=round===1?r.first:r.second;
 if(!l)return null;
 if(id==='leadership')return round===1?r.from:r.to;
 if(id==='margin')return l.top3[0].pct-l.top3[1].pct;
 if(m.candidate){const c=candidate(l,n);if(!c)return null;return id==='candidate_votes'?c.votes:c.pct}
 const p=round===1?r.p1[m.office==='pres'?'president':'governor']:r.p2[m.office==='pres'?'pres':'gov'];
 return m.base?p[m.field]/p[m.base]*100:p[m.field];
}
function stateValue(model,id,round,n='13'){
 if(round===2&&!model.ready)return null;
 if(id==='leadership')return null;
 const m=metrics[id],office=m.office||'gov';
 const p=round===1?model.analysis.participation.state_2026[office]:model.participation.state[office];
 if(m.candidate){if(round===2&&n==='22')return null;const votes=model.rows.reduce((s,r)=>s+(candidate(round===1?r.first:r.second,n)?.votes||0),0);return id==='candidate_votes'?votes:votes/p.valid*100}
 if(id==='margin'){
  const sums=new Map();for(const r of model.rows)for(const c of (round===1?r.first:r.second).top3)sums.set(String(c.number),(sums.get(String(c.number))||0)+c.votes);
  const sorted=[...sums.values()].sort((a,b)=>b-a);return (sorted[0]-sorted[1])/p.valid*100;
 }
 return m.base?p[m.field]/p[m.base]*100:p[m.field];
}
const format=(n,unit='count',sign=false)=>n===null||n===undefined?'—':(sign&&n>0?'+':'')+Number(n).toLocaleString('pt-BR',{minimumFractionDigits:unit==='count'?0:2,maximumFractionDigits:unit==='count'?0:2})+(unit==='pct'?'%':unit==='pp'?' p.p.':'');
function displayed(r,id,view,n){if(id==='leadership')return view==='delta'?r.status:view==='first'?r.from:r.to;const a=value(r,id,1,n),b=value(r,id,2,n);return view==='first'?a:view==='second'?b:a===null||b===null?null:b-a}
function filtered(model,{search='',group='all',metric='leadership',view='delta',candidate='13',sort='name'}={}){
 const rows=model.rows.filter(r=>key(r.name).includes(key(search))&&(group==='all'||r.status===group||r.from+'-'+r.to===group));
 return rows.sort((a,b)=>{const x=displayed(a,metric,view,candidate),y=displayed(b,metric,view,candidate);return sort==='name'||metrics[metric].unit==='category'?a.name.localeCompare(b.name,'pt-BR'):x===null?y===null?0:1:y===null?-1:(sort==='asc'?x-y:y-x)||a.name.localeCompare(b.name,'pt-BR')});
}
const api={names,colors,key,metrics,build,value,stateValue,format,displayed,filtered};
if(typeof module!=='undefined')module.exports=api;root.ElectionStats=api;
})(typeof window!=='undefined'?window:globalThis);
