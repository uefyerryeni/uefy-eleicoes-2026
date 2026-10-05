const $=s=>document.querySelector(s);
let DATA=null;

function fmtNum(v){return Number(v||0).toLocaleString('pt-BR')}
function fmtPct(v,d=2){return Number(v||0).toLocaleString('pt-BR',{minimumFractionDigits:d,maximumFractionDigits:d})+'%'}
function esc(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}
function person(x){if(!x)return '—';return esc(x.name||'—')+(x.party?' <small>'+esc(x.party)+'</small>':'')}

async function init(){
  const saved=localStorage.getItem('uefy-theme'); if(saved==='dark')document.documentElement.dataset.theme='dark';
  $('#themeToggle')?.addEventListener('click',()=>{const dark=document.documentElement.dataset.theme==='dark';document.documentElement.dataset.theme=dark?'':'dark';localStorage.setItem('uefy-theme',dark?'light':'dark')});
  $('#toTop')?.addEventListener('click',()=>scrollTo({top:0,behavior:'smooth'}));
  addEventListener('scroll',()=>$('#toTop')?.classList.toggle('show',scrollY>500));
  $('#crossSearch')?.addEventListener('input',e=>renderCrossTable(e.target.value));
  $('#rankingSelect')?.addEventListener('change',renderRanking);
  try{
    const r=await fetch('data/rn-analises.json?ts='+Date.now(),{cache:'no-store'}); if(!r.ok)throw new Error('HTTP '+r.status);
    DATA=await r.json(); if(DATA.status!=='ok')throw new Error(DATA.message||'Base ainda indisponível');
    renderAll();
  }catch(e){
    $('#coverage').textContent='Não foi possível carregar a base: '+e.message;
    document.querySelectorAll('.analysis-card').forEach(x=>x.classList.add('analysis-unavailable'));
  }
}

function renderAll(){
  $('#sourceStamp').textContent=DATA.source_generated_at||new Date(DATA.generated_at).toLocaleString('pt-BR');
  $('#coverage').textContent=(DATA.municipalities_read||0)+'/'+(DATA.municipalities_expected||167)+' municípios lidos · TSE oficial';
  renderCross(); renderParticipation();
  $('#methodCross').textContent=DATA.methodology?.cross_note||'';
  $('#methodParticipation').textContent=DATA.methodology?.participation_note||'';
  $('#methodSource').textContent=DATA.methodology?.source||'Tribunal Superior Eleitoral';
}

function renderCross(){
  const rows=DATA.cross?.municipalities||[], pairs=DATA.cross?.pairs||[];
  const pres=new Set(rows.map(x=>x.president?.name).filter(Boolean));
  const gov=new Set(rows.map(x=>x.governor?.name).filter(Boolean));
  $('#crossKpis').innerHTML=[
    ['Municípios cruzados',fmtNum(rows.length),'de '+(DATA.municipalities_expected||167)],
    ['Combinações encontradas',fmtNum(pairs.length),'Presidente × Governador'],
    ['Líderes presidenciais',fmtNum(pres.size),'nomes que ficaram em 1º em ao menos um município'],
    ['Líderes para governo',fmtNum(gov.size),'nomes que ficaram em 1º em ao menos um município']
  ].map(x=>'<article class="analysis-kpi"><span>'+x[0]+'</span><strong>'+x[1]+'</strong><small>'+x[2]+'</small></article>').join('');
  $('#pairList').innerHTML=pairs.map((x,i)=>'<div class="pair-row"><div class="pair-rank">'+(i+1)+'</div><div><strong>'+person(x.president)+' <b>×</b> '+person(x.governor)+'</strong><span>'+x.municipalities+' município(s)</span><small>'+x.names.slice(0,8).map(esc).join(', ')+(x.names.length>8?'…':'')+'</small></div></div>').join('');
  renderCrossTable('');
}

function renderCrossTable(q=''){
  const n=String(q).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const rows=(DATA.cross?.municipalities||[]).filter(x=>x.name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().includes(n));
  $('#crossTable').innerHTML=rows.map(x=>'<tr><th>'+esc(x.name)+'</th><td>'+person(x.president)+'<span>'+fmtPct(x.president?.pct||0)+'</span></td><td>'+person(x.governor)+'<span>'+fmtPct(x.governor?.pct||0)+'</span></td></tr>').join('');
}

function renderParticipation(){
  const p26=DATA.participation?.state_2026?.pres||{}, g26=DATA.participation?.state_2026?.gov||{};
  $('#participationKpis').innerHTML=[
    ['Comparecimento no RN',fmtPct(p26.turnout_pct),fmtNum(p26.turnout)+' eleitores'],
    ['Abstenção no RN',fmtPct(p26.abstention_pct),fmtNum(p26.abstention)+' eleitores'],
    ['Brancos · Presidente',fmtPct(p26.blank_pct),fmtNum(p26.blank)+' votos'],
    ['Nulos · Presidente',fmtPct(p26.null_pct),fmtNum(p26.null)+' votos'],
    ['Brancos · Governador',fmtPct(g26.blank_pct),fmtNum(g26.blank)+' votos'],
    ['Nulos · Governador',fmtPct(g26.null_pct),fmtNum(g26.null)+' votos']
  ].map(x=>'<article class="analysis-kpi"><span>'+x[0]+'</span><strong>'+x[1]+'</strong><small>'+x[2]+'</small></article>').join('');
  renderHistory(); renderRanking();
}

function diff(a,b){const d=Number(a||0)-Number(b||0);return (d>0?'+':'')+d.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})+' p.p.'}
function renderHistory(){
  const p26=DATA.participation?.state_2026?.pres||{}, g26=DATA.participation?.state_2026?.gov||{};
  const p22=DATA.participation?.state_2022?.pres||{}, g22=DATA.participation?.state_2022?.gov||{};
  const rows=[
    ['Comparecimento',p22.turnout_pct,p26.turnout_pct,'pres'],
    ['Abstenção',p22.abstention_pct,p26.abstention_pct,'pres'],
    ['Brancos · Presidente',p22.blank_pct,p26.blank_pct,'pres'],
    ['Nulos · Presidente',p22.null_pct,p26.null_pct,'pres'],
    ['Brancos · Governador',g22.blank_pct,g26.blank_pct,'gov'],
    ['Nulos · Governador',g22.null_pct,g26.null_pct,'gov']
  ];
  $('#historyCompare').innerHTML='<div class="history-head"><span>Indicador</span><b>2022</b><b>2026</b><b>Dif.</b></div>'+rows.map(x=>'<div class="history-row"><strong>'+x[0]+'</strong><span>'+fmtPct(x[1])+'</span><span>'+fmtPct(x[2])+'</span><em>'+diff(x[2],x[1])+'</em></div>').join('');
}

const rankingLabels={
 highest_abstention:'Maior abstenção', lowest_abstention:'Menor abstenção',
 highest_blank_president:'Mais brancos para Presidente', highest_null_president:'Mais nulos para Presidente',
 highest_blank_governor:'Mais brancos para Governador', highest_null_governor:'Mais nulos para Governador'
};
function renderRanking(){
  const key=$('#rankingSelect')?.value||'highest_abstention',rows=DATA.participation?.rankings?.[key]||[];
  $('#rankingList').innerHTML=rows.map((x,i)=>'<div class="ranking-row"><b>'+(i+1)+'</b><span><strong>'+esc(x.name)+'</strong><small>'+rankingLabels[key]+'</small></span><em>'+fmtPct(x.value)+'</em></div>').join('');
}
init();