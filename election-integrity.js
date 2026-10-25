/* UEFY: valida o envelope EA20 antes de aceitar números como oficiais. */
(function(){
'use strict';
function validate(data,expected){
  const cargo=data?.carg;
  const scope=String(data?.cdabr||'').toLowerCase();
  if(!data||String(data.ele)!==expected.election||String(data.t)!=='2'||data.f!=='o'||
     !Array.isArray(cargo)||cargo.length!==1||Number(cargo[0].cd)!==expected.cargo||
     scope!==String(expected.scope).toLowerCase())
    throw new Error('Identidade EA20 divergente: eleição, turno, cargo ou abrangência. Publicação bloqueada.');
  const progress=Number(String(data.s?.pst??'').replace(',','.'));
  if(data.s?.pst==null||!Number.isFinite(progress)||progress<0||progress>100||!data.dg||!data.hg)
    throw new Error('EA20 sem progresso ou horário válido da fonte.');
  const rows=cargo.flatMap(c=>(c.agr||[]).flatMap(a=>(a.par||[]).flatMap(p=>p.cand||[])));
  if(rows.length!==2||new Set(rows.map(c=>String(c.n))).size!==2||rows.some(c=>
    c.vap==null||!Number.isSafeInteger(Number(c.vap))||Number(c.vap)<0||c.pvap==null||
    !Number.isFinite(Number(String(c.pvap).replace(',','.')))||
    Number(String(c.pvap).replace(',','.'))<0||Number(String(c.pvap).replace(',','.'))>100))
    throw new Error('EA20 com candidaturas ou números inválidos.');
  const total=rows.reduce((sum,c)=>sum+Number(c.vap),0);
  if(total>0&&rows.some(c=>Math.abs(Number(String(c.pvap).replace(',','.'))-100*Number(c.vap)/total)>.02))
    throw new Error('Percentuais do EA20 não conciliam com os votos das candidaturas.');
  return data;
}
function publishable(result,numbers){
  const rows=result?.candidates;
  if(result?.stale||!Array.isArray(rows)||rows.length!==2||
     !numbers.every(n=>rows.some(c=>String(c.number)===n))||
     !Number.isFinite(Number(result.progress))||Number(result.progress)<=0||Number(result.progress)>100)return false;
  return rows.every(c=>Number.isSafeInteger(Number(c.votes))&&Number(c.votes)>=0&&
    Number.isFinite(Number(c.pct))&&Number(c.pct)>=0&&Number(c.pct)<=100&&
    (!c.voteDestination||/^(válido|valido)$/i.test(String(c.voteDestination).trim())))&&
    rows.reduce((sum,c)=>sum+Number(c.votes),0)>0;
}
window.UEFYElection={validate,publishable};
})();
