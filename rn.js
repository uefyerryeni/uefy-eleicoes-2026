const $=s=>document.querySelector(s);
const LOGO_URL='https://uefyerryeni.github.io/uefyerryeni-logo.png';
const OFFICE={gov:{title:'Governador',cargo:'0003'}};
let fc=null,selectedFeature=null,office='gov',mode='official',current={progress:0,candidates:[],generatedAt:null};
const AUTO_REFRESH_MS=60000;let rnAutoTimer=null,rnLoading=false;
let leaderMapData={status:'waiting',leaders:{},summary:[],publication_ready:false}, mapPublicationMode=false;
let leaderFilter='';
let publicationTextMode='full';
const logo=new Image();logo.crossOrigin='anonymous';logo.src=LOGO_URL;logo.onload=()=>drawCanvas();

function norm(s){return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'')}
const MUNICIPALITY_ALIASES={acu:'assu',ares:'arez',januariocicco:'boasaude'};
function municipalityKey(name){const n=norm(name);return MUNICIPALITY_ALIASES[n]||n}
function esc(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}
function fmtPct(v){return Number(v||0).toLocaleString('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:2})+'%'}
function nowStamp(){return new Date().toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'})}
function coordsOfGeometry(g,out=[]){if(!g)return out;if(g.type==='Polygon')g.coordinates.forEach(r=>r.forEach(p=>out.push(p)));else if(g.type==='MultiPolygon')g.coordinates.forEach(poly=>poly.forEach(r=>r.forEach(p=>out.push(p))));return out}
function boundsOf(collection){const pts=[];collection.features.forEach(f=>coordsOfGeometry(f.geometry,pts));let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;pts.forEach(([x,y])=>{minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y)});return{minX,minY,maxX,maxY}}
function projector(collection,w,h,pad=12){const b=boundsOf(collection),sx=(w-pad*2)/(b.maxX-b.minX),sy=(h-pad*2)/(b.maxY-b.minY),s=Math.min(sx,sy),ox=(w-(b.maxX-b.minX)*s)/2,oy=(h-(b.maxY-b.minY)*s)/2;return([x,y])=>[ox+(x-b.minX)*s,h-(oy+(y-b.minY)*s)]}
function ringPath(ring,proj){return ring.map((p,i)=>{const[x,y]=proj(p);return(i?'L':'M')+x.toFixed(2)+' '+y.toFixed(2)}).join(' ')+' Z'}
function geometryPath(g,proj){if(g.type==='Polygon')return g.coordinates.map(r=>ringPath(r,proj)).join(' ');if(g.type==='MultiPolygon')return g.coordinates.flatMap(poly=>poly.map(r=>ringPath(r,proj))).join(' ');return''}

async function init(){
  fc=await fetch('assets/maps/rn-municipios.geojson').then(r=>r.json());
  renderMap();renderList('');
  await loadLeaderMap();
  selectedFeature=fc.features.find(f=>norm(f.properties?.nome)==='natal')||fc.features[0];
  selectMunicipality(selectedFeature);
}
function renderMap(){
  const svg=$('#rnLargeMap'),proj=projector(fc,760,560,12);
  svg.innerHTML=fc.features.map((f,i)=>'<path class="rn-mun" data-i="'+i+'" d="'+geometryPath(f.geometry,proj)+'"><title>'+f.properties.nome+'</title></path>').join('');
  svg.querySelectorAll('.rn-mun').forEach(el=>el.addEventListener('click',()=>selectMunicipality(fc.features[Number(el.dataset.i)])));
}
function renderList(filter){
  const q=norm(filter),features=[...fc.features].sort((a,b)=>a.properties.nome.localeCompare(b.properties.nome,'pt-BR')).filter(f=>norm(f.properties.nome).includes(q));
  $('#munList').innerHTML=features.map(f=>'<button class="rn-item" data-name="'+f.properties.nome.replace(/"/g,'&quot;')+'"><strong>'+f.properties.nome+'</strong><span>→</span></button>').join('');
  $('#munList').querySelectorAll('.rn-item').forEach(b=>b.onclick=()=>selectMunicipality(fc.features.find(f=>f.properties.nome===b.dataset.name)));
  markSelection();
}
function renderFocusMap(){
  if(!selectedFeature)return;
  const svg=$('#munFocusMap');
  if(!svg)return;
  const one={type:'FeatureCollection',features:[selectedFeature]},proj=projector(one,320,220,18);
  svg.innerHTML='<path class="mun-focus-shape" d="'+geometryPath(selectedFeature.geometry,proj)+'"></path>';
}
function markSelection(){
  if(!selectedFeature)return;
  const name=selectedFeature.properties.nome;
  $('#rnLargeMap').querySelectorAll('.rn-mun').forEach((el,i)=>el.classList.toggle('active',fc.features[i]===selectedFeature));
  $('#munList').querySelectorAll('.rn-item').forEach(el=>el.classList.toggle('active',el.dataset.name===name));
}
function selectMunicipality(feature){
  const previousName=selectedFeature?.properties?.nome||'';
  const changingMunicipality=norm(previousName)!==norm(feature?.properties?.nome);
  mapPublicationMode=false;
  selectedFeature=feature;
  if(changingMunicipality)current={progress:0,candidates:[],generatedAt:null,municipality:feature.properties.nome,integrity:null};
  $('#selectedMun').textContent=feature.properties.nome;
  const compareLink=$('#rnCompareCity');
  if(compareLink)compareLink.href='entre-turnos.html?municipio='+encodeURIComponent(feature.properties.nome)+'#mudancas';
  markSelection();renderFocusMap();
  const pub=$('#publicacao');if(pub){pub.classList.add('loading-municipality');$('#rnResultTitle').textContent='Carregando '+feature.properties.nome+'…';$('#rnResults').innerHTML='';$('#rnProgress').textContent='—';}
  if(mode==='official'&&!inSecondRoundPollingWindow()){current={progress:0,candidates:[],generatedAt:null,municipality:feature.properties.nome,integrity:null};renderCurrent();$('#rnStatus').textContent='Pronto para a apuração. A consulta oficial do 2º turno começa às 17h de 25/10, horário de Brasília.'}else loadRemote();
  if(changingMunicipality)window.dispatchEvent(new CustomEvent('uefy:municipality-changed',{detail:{name:feature.properties.nome}}));
}

const GOVERNOR_COLORS_BY_NUMBER={
  '13':'#d62828', // Cadu de Lula · vermelho
  '16':'#7b2cbf', // Dário Barbosa · roxo
  '22':'#2e7d32', // Álvaro Dias · verde
  '27':'#ef6c00', // Godeiro Linharess · laranja
  '29':'#00897b', // Henrique Lyra · verde-água
  '36':'#c2185b', // Rodrigo de Bolsonaro · magenta
  '44':'#1976d2', // Allyson · azul
  '50':'#6d4c41', // Professor Roberio Paulino · marrom
  '80':'#455a64'  // Arinalda do MLB · grafite
};
const GOVERNOR_COLORS_BY_NAME={
  'cadu de lula':'#d62828',
  'dario barbosa':'#7b2cbf',
  'alvaro dias':'#2e7d32',
  'godeiro linharess':'#ef6c00',
  'henrique lyra':'#00897b',
  'rodrigo de bolsonaro':'#c2185b',
  'allyson':'#1976d2',
  'professor roberio paulino':'#6d4c41',
  'arinalda do mlb':'#455a64'
};
function candidateColor(name,number=''){
  const byNumber=GOVERNOR_COLORS_BY_NUMBER[String(number||'').replace(/\D/g,'')];
  if(byNumber)return byNumber;
  const n=norm(name);
  if(GOVERNOR_COLORS_BY_NAME[n])return GOVERNOR_COLORS_BY_NAME[n];
  // Fallback determinístico para eventual nova candidatura:
  // o mesmo número/nome sempre recebe exatamente a mesma cor.
  const seed=String(number||name||'0').split('').reduce((a,ch)=>a+ch.charCodeAt(0),0);
  const hue=(seed*137.508)%360;
  return 'hsl('+hue.toFixed(1)+' 58% 42%)';
}
function leaderForFeature(feature){
  const name=municipalityKey(feature?.properties?.nome);
  const entries=Object.entries(leaderMapData?.leaders||{});
  const found=entries.find(([k])=>municipalityKey(k)===name);
  return found?found[1]:null;
}
function leaderFilterValue(candidate,number){
  const n=String(number||'').replace(/\D/g,'');
  return n?'n:'+n:'c:'+norm(candidate);
}
function leaderMatchesFilter(lead){
  if(!leaderFilter)return true;
  return lead?.status==='ok'&&leaderFilterValue(lead.candidate,lead.candidate_number)===leaderFilter;
}
function selectedLeaderSummary(){
  if(!leaderFilter)return null;
  return (leaderMapData.summary||[]).find(x=>leaderFilterValue(x.name,x.number)===leaderFilter)||null;
}
const RN_MAJOR_CITIES_2026=[
  {name:'Natal',population:783196},
  {name:'Mossoró',population:279100},
  {name:'Parnamirim',population:273952},
  {name:'São Gonçalo do Amarante',population:125691},
  {name:'Macaíba',population:87634},
  {name:'Ceará-Mirim',population:83662},
  {name:'Extremoz',population:70452},
  {name:'Caicó',population:63338},
  {name:'Assú',population:59278},
  {name:'São José de Mipibu',population:50386},
  {name:'Currais Novos',population:42915},
  {name:'Santa Cruz',population:39198},
  {name:'Apodi',population:37574},
  {name:'Nova Cruz',population:35514},
  {name:'João Câmara',population:34925},
  {name:'Nísia Floresta',population:34674},
  {name:'Touros',population:34412},
  {name:'Pau dos Ferros',population:32259},
  {name:'Canguaretama',population:30773},
  {name:'Goianinha',population:28616}
];
function majorCityHighlights(){
  if(!leaderFilter)return [];
  return RN_MAJOR_CITIES_2026.filter(city=>{
    const entry=Object.entries(leaderMapData?.leaders||{}).find(([k])=>municipalityKey(k)===municipalityKey(city.name));
    const lead=entry?.[1];
    return lead?.status==='ok'&&leaderFilterValue(lead.candidate,lead.candidate_number)===leaderFilter;
  });
}
async function loadLeaderMap(){
  if(mode==='sim'){
    leaderMapData={
      status:'sim_unavailable',leaders:{},summary:[],publication_ready:false,final_result:false,
      municipalities_expected:167,municipalities_read:0,
      source_generated_at:'Simulado TSE',
      message:'O mapa estadual de lideranças não está disponível no Simulado TSE. A consulta municipal abaixo usa normalmente os dados do simulado.'
    };
    renderLeaderMap();return;
  }
  try{
    const r=await fetch('data/rn-governador-mapa-2t.json?ts='+Date.now(),{cache:'no-store'});
    if(!r.ok)throw new Error('Mapa '+r.status);
    leaderMapData=await r.json();
    if(leaderMapData.round!==2||String(leaderMapData.election_id)!=='6260')throw new Error('Snapshot de turno incompatível');
  }catch(e){
    leaderMapData={status:'error',leaders:{},summary:[],publication_ready:false,message:'Não foi possível carregar o mapa estadual agora.'};
  }
  renderLeaderMap();
}
function renderElectionOutcome(){
  const box=$('#rnElectionOutcome');if(!box)return;
  const o=leaderMapData?.outcome||{},rows=o.candidates||[];
  if(mode!=='official'||!rows.length||!['elected','second_round'].includes(o.kind)){box.hidden=true;box.innerHTML='';return}
  box.hidden=false;
  if(o.kind==='second_round'){
    box.innerHTML='<span>2º TURNO CONFIRMADO</span><strong>'+rows.map(x=>esc(x.name)+(x.party?' ('+esc(x.party)+')':'')).join(' × ')+'</strong><small>Situação oficial informada pelo TSE.</small>';
  }else{
    const first=rows[0];
    box.innerHTML='<span>ELEITO</span><strong>'+esc(first.name)+(first.party?' ('+esc(first.party)+')':'')+'</strong><small>'+fmtPct(first.pct)+' · situação oficial informada pelo TSE.</small>';
  }
}
function renderLeaderMap(){
  const svg=$('#rnLeaderMap');if(!svg||!fc)return;
  const summary=(leaderMapData.summary||[]);
  const filter=$('#rnLeaderFilter');
  if(filter){
    const options=['<option value="">Todos os candidatos</option>'].concat(summary.map(x=>'<option value="'+esc(leaderFilterValue(x.name,x.number))+'">'+esc(x.name)+' — '+x.municipalities+' município(s)</option>'));
    filter.innerHTML=options.join('');
    const values=[...filter.options].map(o=>o.value);
    if(leaderFilter&&!values.includes(leaderFilter))leaderFilter='';
    filter.value=leaderFilter;
    if(!filter.dataset.bound){
      filter.addEventListener('change',()=>{
        leaderFilter=filter.value;
        mapPublicationMode=false;
        renderLeaderMap();
      });
      filter.dataset.bound='1';
    }
  }
  const selectedSummary=selectedLeaderSummary();
  const filterStatus=$('#rnLeaderFilterStatus');
  if(filterStatus){
    filterStatus.textContent=selectedSummary
      ? selectedSummary.name+': '+selectedSummary.municipalities+' município(s) destacados no mapa.'
      : 'Exibindo todos os municípios com liderança registrada.';
  }

  const proj=projector(fc,760,560,12);
  svg.innerHTML=fc.features.map((f,i)=>{
    const lead=leaderForFeature(f),ok=lead?.status==='ok',matches=ok&&leaderMatchesFilter(lead);
    const color=!ok?'#d9dee2':(leaderFilter&&!matches?'#e8e4da':candidateColor(lead.candidate,lead.candidate_number));
    const filtered=leaderFilter&&!matches?' filtered-out':'';
    const tip=ok?f.properties.nome+' — '+lead.candidate+' · '+fmtPct(lead.pct):f.properties.nome+' — aguardando votos';
    return '<path class="rn-leader-mun'+filtered+'" data-i="'+i+'" d="'+geometryPath(f.geometry,proj)+'" fill="'+color+'"><title>'+esc(tip)+'</title></path>';
  }).join('');
  svg.querySelectorAll('.rn-leader-mun').forEach(el=>el.addEventListener('click',()=>{
    const f=fc.features[Number(el.dataset.i)],lead=leaderForFeature(f);
    selectMunicipality(f);
    if(lead?.status==='ok')setTimeout(()=>{$('#rnStatus').textContent=f.properties.nome+': '+lead.candidate+' está em 1º no recorte municipal do snapshot do mapa.'},0);
    document.querySelector('.rn-side')?.scrollIntoView({behavior:'smooth',block:'start'});
  }));
  renderElectionOutcome();
  const emptyMapMessage=mode==='sim'?'Mapa estadual indisponível no Simulado TSE. Use a consulta municipal abaixo.':'Aguardando a apuração oficial.';
  $('#rnLeaderSummary').innerHTML=summary.length?summary.map(x=>'<div class="rn-leader-row'+(leaderFilterValue(x.name,x.number)===leaderFilter?' active':'')+'"><i style="background:'+candidateColor(x.name,x.number)+'"></i><span><strong>'+esc(x.name)+'</strong><small>'+x.municipalities+' município(s)</small></span></div>').join(''):'<div class="rn-map-empty">'+emptyMapMessage+'</div>';
  $('#rnLeaderLegend').innerHTML=summary.length?summary.map(x=>'<span'+(leaderFilterValue(x.name,x.number)===leaderFilter?' class="active"':'')+'><i style="background:'+candidateColor(x.name,x.number)+'"></i>'+esc(x.name)+'</span>').join(''):'<span><i style="background:#d9dee2"></i>Aguardando resultado</span>';
  const read=Number(leaderMapData.municipalities_read||0),expected=Number(leaderMapData.municipalities_expected||167);
  $('#rnMapRead').textContent=read+'/'+expected;
  $('#rnMapBase').textContent=leaderMapData.source_generated_at||leaderMapData.message||'Aguardando TSE';
  const natal=leaderMapData.natal;
  if(natal?.status==='ok'){
    $('#rnNatalHighlight').innerHTML='<small>Natal</small><strong>'+esc(natal.candidate)+'</strong><span>'+fmtPct(natal.pct)+' · liderança no snapshot municipal</span>';
  }else{
    const natalText=mode==='sim'?'Consulte Natal na área municipal abaixo.':'O destaque da capital aparecerá quando houver votos.';
    $('#rnNatalHighlight').innerHTML='<small>Natal</small><strong>Aguardando apuração oficial</strong><span>'+natalText+'</span>';
  }
  const btn=$('#rnMapPublish'),note=$('#rnMapPublishNote');
  if(btn)btn.disabled=mode!=='official'||!leaderMapData.publication_ready||leaderMapData.round!==2||String(leaderMapData.election_id)!=='6260'||Number(leaderMapData.municipalities_read)!==167;
  if(note)note.textContent=leaderMapData.publication_ready?(leaderMapData.final_result?'Base completa e totalização final.':'Base municipal completa. O card será identificado como resultado parcial.'):(leaderMapData.message||'A publicação será liberada quando a base municipal estiver completa e conferida.');
}

function sourceMeta(){
  if(mode==='sim')return {title:'Simulado TSE',badge:'SIMULADO TSE',municipal:'Simulado TSE',help:'A consulta municipal usa o ambiente de teste do TSE. O mapa estadual fica desativado para não misturar fontes.'};
  return {title:'Oficial TSE',badge:'OFICIAL TSE',municipal:'Oficial TSE',help:'Mapa, município e publicação usam os resultados oficiais do TSE.'};
}
function updateSourceUI(){
  const s=sourceMeta();
  const title=$('#rnSourceTitle'),help=$('#rnSourceHelp'),badge=$('#rnSourceBadge'),mun=$('#rnMunicipalSource');
  if(title)title.textContent=s.title;
  if(help)help.textContent=s.help;
  if(badge){badge.textContent=s.badge;badge.dataset.mode=mode}
  if(mun)mun.textContent=s.municipal;
  $('#liveLabel').textContent=mode==='sim'?'Simulado TSE':'TSE oficial';
  document.body.dataset.rnSource=mode;
}
async function changeSource(next){
  mode=next;
  mapPublicationMode=false;
  updateSourceUI();
  await loadLeaderMap();
  await loadRemote();
}
function partyByNumber(number){
  const row=(rnCandidateBase?.candidates||[]).find(x=>Number(x.cargo)===3&&String(x.numero)===String(number||''));
  return row?.partido||'';
}
function labeledCandidate(name,party=''){return name+(party?' ('+party+')':'')}
function publicationCandidate(candidate){return labeledCandidate(candidate?.name||'Candidatura',candidate?.party||'')}
function mapPostText(){
  const final=leaderMapData.final_result,outcome=leaderMapData?.outcome||{},filtered=selectedLeaderSummary();
  const status=outcome.kind==='elected'?'ELEITO':outcome.kind==='second_round'?'2º TURNO CONFIRMADO':final?'RESULTADO FINAL':'MAPA PARCIAL';

  if(filtered){
    const candidate=labeledCandidate(filtered.name,partyByNumber(filtered.number));
    const highlights=majorCityHighlights();
    const lines=['ELEIÇÕES 2026 | 2º TURNO | GOVERNADOR DO RN',status+' — FILTRO POR CANDIDATURA','',candidate+' lidera em '+filtered.municipalities+' município(s) neste recorte.'];
    if(highlights.length){
      const top=highlights.slice(0,5).map(x=>x.name);
      lines.push('','Destaques entre os municípios mais populosos do RN: '+top.join(', ')+'.');
    }
    if(!final)lines.push('','O mapa representa o snapshot atual da apuração e pode mudar conforme novas seções forem totalizadas.');
    lines.push('Base municipal: '+Number(leaderMapData.municipalities_read||0)+'/'+Number(leaderMapData.municipalities_expected||167)+' municípios lidos.');
    if(leaderMapData.source_generated_at)lines.push('','Atualização: '+leaderMapData.source_generated_at);
    lines.push('','Fontes: Tribunal Superior Eleitoral · população: IBGE, estimativas 2026');
    return lines.join('\n');
  }

  if(publicationTextMode==='compact'){
    const lines=['ELEIÇÕES 2026 | 2º TURNO | GOVERNADOR DO RN',status];
    if(outcome.kind==='elected'&&outcome.candidates?.length){
      const w=outcome.candidates[0];lines.push('',labeledCandidate(w.name,w.party)+' — '+fmtPct(w.pct));
    }else if(outcome.kind==='second_round'&&outcome.candidates?.length){
      outcome.candidates.slice(0,2).forEach(x=>lines.push(labeledCandidate(x.name,x.party)+' — '+fmtPct(x.pct)));
    }else{
      (leaderMapData.summary||[]).slice(0,3).forEach(x=>lines.push(labeledCandidate(x.name,partyByNumber(x.number))+' — '+x.municipalities+' município(s)'));
    }
    lines.push('','Fonte: Tribunal Superior Eleitoral');
    return lines.join('\n');
  }

  const lines=['ELEIÇÕES 2026 | 2º TURNO | GOVERNADOR DO RN',status+(status==='MAPA PARCIAL'||status==='RESULTADO FINAL'?' — liderança por município':'') ,''];
  if(outcome.kind==='elected'&&outcome.candidates?.length){
    const w=outcome.candidates[0];lines.push(labeledCandidate(w.name,w.party)+' — '+fmtPct(w.pct),'');
  }else if(outcome.kind==='second_round'&&outcome.candidates?.length){
    outcome.candidates.forEach(x=>lines.push(labeledCandidate(x.name,x.party)+' — '+fmtPct(x.pct)));lines.push('');
  }
  (leaderMapData.summary||[]).slice(0,6).forEach(x=>lines.push(labeledCandidate(x.name,partyByNumber(x.number))+' — '+x.municipalities+' município(s)'));
  if(leaderMapData.natal?.status==='ok')lines.push('','Natal: '+labeledCandidate(leaderMapData.natal.candidate,partyByNumber(leaderMapData.natal.candidate_number))+' aparece em 1º neste snapshot.');
  if(!final){
    lines.push('','O mapa representa o snapshot atual da apuração. As lideranças municipais podem mudar conforme novas seções forem totalizadas.');
    lines.push('Base municipal: '+Number(leaderMapData.municipalities_read||0)+'/'+Number(leaderMapData.municipalities_expected||167)+' municípios lidos.');
  }
  if(leaderMapData.source_generated_at)lines.push('','Atualização: '+leaderMapData.source_generated_at);
  lines.push('','Fonte: Tribunal Superior Eleitoral');
  return lines.join('\n');
}
function drawLeaderMapCanvas(){
  const c=$('#rnCanvas'),ctx=c.getContext('2d');
  ctx.textAlign='left';ctx.textBaseline='alphabetic';ctx.globalAlpha=1;
  ctx.clearRect(0,0,1080,1080);ctx.fillStyle='#f7f6ef';ctx.fillRect(0,0,1080,1080);
  ctx.fillStyle='#151a18';ctx.fillRect(0,0,1080,155);
  ctx.fillStyle='#f4dd19';ctx.fillRect(0,0,1080,13);
  fitCanvasText(ctx,'UEFY',60,112,305,96,78,'900','#f4dd19');
  ctx.fillStyle='#f4dd19';ctx.fillRect(358,37,4,91);
  fitCanvasText(ctx,'CENTRAL DAS ELEIÇÕES',390,82,620,34,28,'900','#f7f6ef');
  fitCanvasText(ctx,'2026  /  SEGUNDO TURNO',390,121,620,27,21,'700','#f4dd19');
  const outcome=leaderMapData?.outcome||{};
  const canvasStatus=outcome.kind==='elected'?'ELEITO':outcome.kind==='second_round'?'2º TURNO CONFIRMADO':leaderMapData.final_result?'RESULTADO FINAL':'MAPA PARCIAL';
  ctx.fillStyle='#151a18';ctx.fillRect(70,165,435,43);
  fitCanvasText(ctx,canvasStatus,87,194,402,24,17,'900','#f4dd19');
  fitCanvasText(ctx,'GOVERNO DO RN',70,271,900,63,48,'900','#151a18');
  const filteredSummary=selectedLeaderSummary();
  ctx.fillStyle='#59626b';ctx.font='600 25px DM Sans,Segoe UI,Arial';ctx.fillText(filteredSummary?'Municípios onde '+filteredSummary.name+' lidera':'Quem lidera em cada município',70,305);
  const proj=projector(fc,650,520,8);ctx.save();ctx.translate(40,350);
  fc.features.forEach(f=>{
    const lead=leaderForFeature(f),matches=lead?.status==='ok'&&leaderMatchesFilter(lead),fill=lead?.status!=='ok'?'#d9dee2':(leaderFilter&&!matches?'#e8e4da':candidateColor(lead.candidate,lead.candidate_number));
    const g=f.geometry,polys=g.type==='Polygon'?[g.coordinates]:g.type==='MultiPolygon'?g.coordinates:[];
    ctx.fillStyle=fill;ctx.strokeStyle='#fff';ctx.lineWidth=1.2;
    polys.forEach(poly=>{ctx.beginPath();poly.forEach(ring=>ring.forEach((p,i)=>{const[a,b]=proj(p);i?ctx.lineTo(a,b):ctx.moveTo(a,b)}));ctx.closePath();ctx.fill('evenodd');ctx.stroke()});
  });ctx.restore();
  let yy=405;const sum=(filteredSummary?[filteredSummary]:(leaderMapData.summary||[])).slice(0,6);
  sum.forEach(x=>{
    ctx.fillStyle=candidateColor(x.name,x.number);ctx.beginPath();ctx.arc(760,yy-8,9,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#17191c';ctx.font='700 22px DM Sans,Segoe UI,Arial';ctx.fillText((x.name||'').slice(0,20),785,yy);
    ctx.fillStyle='#59626b';ctx.font='600 17px DM Sans,Segoe UI,Arial';ctx.fillText(x.municipalities+' município(s)',785,yy+25);yy+=68;
  });
  if(leaderMapData.natal?.status==='ok'){
    ctx.fillStyle='#fff';roundRect(ctx,720,825,300,90,14);ctx.fill();ctx.strokeStyle='#d7dce0';ctx.stroke();
    ctx.fillStyle='#6b737b';ctx.font='700 14px DM Sans,Segoe UI,Arial';ctx.fillText('NATAL',745,855);
    ctx.fillStyle='#17191c';ctx.font='800 22px DM Sans,Segoe UI,Arial';ctx.fillText((leaderMapData.natal.candidate||'').slice(0,20),745,886);
  }
  ctx.strokeStyle='#d3d9de';ctx.beginPath();ctx.moveTo(70,965);ctx.lineTo(1010,965);ctx.stroke();
  ctx.fillStyle='#58616a';ctx.font='600 18px DM Sans,Segoe UI,Arial';ctx.fillText('Fonte: Tribunal Superior Eleitoral · '+(leaderMapData.municipalities_read||0)+'/'+(leaderMapData.municipalities_expected||167)+' municípios lidos',70,1005);
  ctx.textAlign='right';ctx.fillText(leaderMapData.source_generated_at||nowStamp(),1010,1035);ctx.textAlign='left';
}

let rnCandidateBase=null;
async function loadRnCandidates(){
  try{
    if(!rnCandidateBase){
      const r=await fetch('data/candidatos-ufs-c.json',{cache:'no-store'});
      if(!r.ok)throw new Error('Base RN '+r.status);
      const data=await r.json();rnCandidateBase=data.rn;
    }
    const cargo=Number(OFFICE[office].cargo);
    const rows=(rnCandidateBase?.candidates||[]).filter(x=>x.cargo===cargo);
    current={progress:0,candidates:rows.map((x,i)=>({name:x.nome,number:x.numero,party:x.partido,status:x.situacao,pct:0,votes:0,seq:i+1})),generatedAt:rnCandidateBase?.generated||nowStamp()};
    $('#rnStatus').textContent='Candidaturas do RN carregadas da base eleitoral · sem votos.';
    renderCurrent();
  }catch(e){
    current={progress:0,candidates:[],generatedAt:nowStamp()};
    $('#rnStatus').textContent='Não foi possível carregar as candidaturas do RN. Nenhum dado alternativo será usado como substituição.';
    renderCurrent();
  }
}
function applyDemo(){return loadRnCandidates();}
function municipalConfigUrl(){
  if(mode==='sim')return 'https://resultados-sim.tse.jus.br/simulado/simulado2026/ele2026/21270/config/mun-e021270-cm.json';
  return 'https://resultados.tse.jus.br/oficial/ele2026/6258/config/mun-e006258-cm.json';
}
function extractMunicipalities(data){
  const out=[];
  const walk=(node,uf=null)=>{
    if(Array.isArray(node)){node.forEach(x=>walk(x,uf));return}
    if(!node||typeof node!=='object')return;
    const stateCode=(Array.isArray(node.mu)&&/^[a-z]{2}$/i.test(String(node.cd||'')))?node.cd:'';
    const localUf=String(node.sg||node.uf||node.cdabr||node.abr||stateCode||uf||'').toLowerCase();
    if(Array.isArray(node.mu)){
      node.mu.forEach(m=>{
        const code=String(m.cd||m.c||m.cdmun||m.mun||m.codigo||'').padStart(5,'0');
        const name=m.nm||m.nmu||m.nome||m.ds||m.descricao||'';
        if(code&&name)out.push({uf:localUf,code,name});
      });
    }
    Object.values(node).forEach(v=>{if(v!==node.mu)walk(v,localUf)});
  };
  walk(data,null);return out;
}
let municipalityConfigCache={};
async function municipalityCode(){
  const key=mode==='sim'?'sim':'official';
  if(!municipalityConfigCache[key]){
    let cfg=await fetch(municipalConfigUrl(),{cache:'no-store'});
    // Apenas os códigos municipais podem recorrer à configuração do primeiro turno.
    // Os votos são sempre exclusivos da eleição 6260.
    if(!cfg.ok&&mode==='official')cfg=await fetch('https://resultados.tse.jus.br/oficial/ele2026/6257/config/mun-e006257-cm.json',{cache:'no-store'});
    if(!cfg.ok)throw new Error('Config '+cfg.status);
    municipalityConfigCache[key]=extractMunicipalities(await cfg.json());
  }
  const all=municipalityConfigCache[key];
  const target=municipalityKey(selectedFeature.properties.nome);
  const found=all.find(m=>m.uf==='rn'&&municipalityKey(m.name)===target);
  if(!found)throw new Error('Município não encontrado na configuração do TSE');
  return found.code;
}
function resultUrl(code){
  const election=mode==='sim'?'21272':'6260',el=String(election).padStart(6,'0'),base=mode==='sim'?'https://resultados-sim.tse.jus.br/simulado/simulado2026/ele2026':'https://resultados.tse.jus.br/oficial/ele2026';
  return base+'/'+election+'/dados/rn/rn'+code+'-c'+OFFICE[office].cargo+'-e'+el+'-u.json';
}
function parseEA20(data){
  const out=[];(data.carg||[]).forEach(c=>(c.agr||[]).forEach(a=>(a.par||[]).forEach(p=>(p.cand||[]).forEach(cand=>out.push({
    id:String(cand.n||cand.nsqcand||''),
    number:String(cand.n||''),
    name:cand.nmu||cand.nm||(cand.n?'Número '+cand.n:'Nome não informado'),
    party:String(p.sg||''),
    pct:Number(String(cand.pvap??0).replace(',','.'))||0,
    votes:Number(cand.vap||0),
    seq:Number(cand.seq||999999),
    elected:String(cand.e||'').toLowerCase(),
    totalizationStatus:String(cand.st||''),
    voteDestination:String(cand.dvt||'')
  })))));
  const progress=data.s&&data.s.pst!=null?Number(String(data.s.pst).replace(',','.')):(data.s&&data.s.ts?Number(data.s.st||0)/Number(data.s.ts)*100:0);
  return {
    progress:isFinite(progress)?progress:0,
    candidates:out.sort((a,b)=>b.pct-a.pct||a.seq-b.seq),
    generatedAt:[data.dg,data.hg].filter(Boolean).join(' · ')||nowStamp(),
    finalTotalization:String(data.tf||'').toLowerCase()==='s',
    mathematicallyDefined:String(data.md||'').toLowerCase(),
    tallyPhase:String(data.and||'').toLowerCase()
  };
}
async function reconcileRnResult(result){
  try{
    if(!rnCandidateBase){
      const r=await fetch('data/candidatos-ufs-c.json',{cache:'no-store'});
      if(!r.ok)throw new Error('Base RN '+r.status);
      const data=await r.json();rnCandidateBase=data.rn;
    }
    const registry=(rnCandidateBase?.candidates||[]).filter(x=>x.cargo===3);
    const byNumber=new Map(registry.map(x=>[String(x.numero),x]));
    let matched=0;
    result.candidates=result.candidates.map(c=>{
      const reg=byNumber.get(String(c.number||c.id||''));
      if(!reg)return {...c,matched:false};
      matched++;
      return {...c,id:String(reg.seq||c.id),number:reg.numero,name:reg.nome,party:reg.partido,status:reg.situacao,matched:true};
    });
    result.integrity={matched,total:result.candidates.length,unmatched:result.candidates.length-matched};
  }catch(e){
    result.integrity={matched:0,total:result.candidates.length,unmatched:result.candidates.length,error:true};
  }
  return result;
}
async function loadRemote(){
  if(rnLoading)return;rnLoading=true;
  const previous=current;
  $('#rnRefresh').disabled=true;$('#rnRefresh').textContent='Carregando…';$('#rnStatus').textContent='Localizando o município na configuração do TSE…';
  try{
    const code=await municipalityCode(),r=await fetch(resultUrl(code),{cache:'no-store'});if(!r.ok)throw new Error('Resultado '+r.status);
    current=parseEA20(await r.json());
    current.municipality=selectedFeature?.properties?.nome||'';
    if(mode==='official')current=await reconcileRnResult(current);
    if(mode==='sim'){
      $('#rnStatus').textContent='Dados do Simulado TSE para este município. Não representam a apuração oficial.';
    }else if(current.integrity?.unmatched){
      $('#rnStatus').textContent='VERIFICAÇÃO NECESSÁRIA · '+current.integrity.unmatched+' registro(s) não corresponderam à base oficial de candidaturas.';
    }else{
      $('#rnStatus').textContent='EA20 oficial · '+current.integrity.matched+'/'+current.integrity.total+' candidatura(s) conferida(s) com a base oficial.';
    }
    renderCurrent();
  }catch(e){
    const notPublished=mode==='official'&&String(e?.message||e).includes('404');
    const sameMunicipality=norm(previous?.municipality)===norm(selectedFeature?.properties?.nome);
    const canKeepPrevious=sameMunicipality&&previous?.candidates?.length;
    if(canKeepPrevious)current=previous;
    else current={progress:0,candidates:[],generatedAt:null,municipality:selectedFeature?.properties?.nome||'',integrity:null};
    $('#rnStatus').textContent=canKeepPrevious?'Nova consulta indisponível. Mantendo o último resultado válido deste mesmo município ('+(previous.generatedAt||'horário anterior')+').':(notPublished?'O arquivo oficial deste município ainda não foi publicado pelo TSE.':'Não foi possível carregar este município agora: '+e.message);
    renderCurrent();
  }
  finally{rnLoading=false;$('#rnRefresh').disabled=false;$('#rnRefresh').textContent='Atualizar';$('#publicacao')?.classList.remove('loading-municipality')}
}
function rnPublicationIsSafe(){
  if(mode!=='official'||!inSecondRoundPollingWindow())return false;
  if(mapPublicationMode)return !!leaderMapData?.publication_ready&&leaderMapData.round===2&&
    String(leaderMapData.election_id)==='6260'&&Number(leaderMapData.municipalities_read)===167&&
    !(leaderMapData.errors||[]).length;
  const selected=selectedFeature?.properties?.nome||'';
  if(norm(current?.municipality)!==norm(selected)||!(current?.candidates||[]).length||
    !(Number(current?.progress)>0))return false;
  const integrity=current?.integrity;
  if(!integrity||integrity.error||Number(integrity.unmatched)!==0||
    Number(integrity.total)!==current.candidates.length||
    Number(integrity.matched)!==current.candidates.length)return false;
  return true;
}
function updateRnPublicationSafety(){
  const safe=rnPublicationIsSafe();
  ['#rnCopyText','#rnCopyImage','#rnOpenX','#rnDownload','#rnShareBundle'].forEach(sel=>{const el=$(sel);if(el)el.disabled=!safe});
   if(!safe&&$('#rnXManual'))$('#rnXManual').hidden=true;
}
function renderCurrent(){
  const title=$('#rnResultTitle');
  if(mode==='demo'){
    if(title)title.textContent='Candidaturas a Governador do RN';
    $('#rnProgress').textContent=String(current.candidates?.length||0);
    $('#rnResults').innerHTML=(current.candidates||[]).map(c=>{
      const meta=[c.number,c.party].filter(Boolean).map(esc).join(' · ');
      const status=c.status?'<span class="status-chip">'+esc(c.status)+'</span>':'';
      return '<div class="rn-result-line registry"><span>'+esc(c.name)+(meta?'<small>'+meta+'</small>':'')+'</span>'+status+'</div>';
    }).join('');
  }else{
    if(title)title.textContent='Resultado do município';
    $('#rnProgress').textContent=(current.candidates||[]).length?fmtPct(current.progress):'—';
    $('#rnResults').innerHTML=(current.candidates||[]).length?(current.candidates||[]).map(c=>'<div class="rn-result-line"><span>'+esc(c.name)+'</span><span class="bar"><i style="width:'+Math.min(100,c.pct)+'%;background:'+candidateColor(c.name,c.number)+'"></i></span><b>'+fmtPct(c.pct)+'</b></div>').join(''):'<div class="turno2-empty">Aguardando os resultados oficiais do segundo turno.</div>';
  }
  const t=makeText();$('#rnPostText').value=t;$('#rnChars').textContent=t.length+' caracteres';drawCanvas();updateRnPublicationSafety();
}
function makeText(){
  if(mapPublicationMode)return mapPostText();
  const name=selectedFeature?.properties?.nome||'Município';
  const source=mode==='demo'?'Base oficial TSE · sem votos':mode==='sim'?'Fonte: Simulado TSE':'Fonte: Tribunal Superior Eleitoral';
  const final=!!current.finalTotalization;

  if(publicationTextMode==='compact'){
    const lines=['ELEIÇÕES 2026 | 2º TURNO | GOVERNADOR DO RN',name+' (RN)'];
    if(mode==='demo'){
      lines.push('',current.candidates.length+' candidatura(s) registradas.');
    }else{
      lines.push('',(final?'RESULTADO FINAL':'PARCIAL')+' · '+fmtPct(current.progress));
      current.candidates.slice(0,2).forEach(x=>lines.push(publicationCandidate(x)+' — '+fmtPct(x.pct)));
    }
    lines.push('',source);
    return lines.join('\n');
  }

  const lines=['ELEIÇÕES 2026 | 2º TURNO | GOVERNADOR DO RN',name+' (RN)'];
  if(mode==='demo'){
    lines.push('',current.candidates.length+' candidatura(s) registradas na base eleitoral.');
    current.candidates.slice(0,6).forEach(x=>lines.push(publicationCandidate(x)+(x.number?' · nº '+x.number:'')));
    lines.push('','Cadastro eleitoral disponível para o município selecionado.');
  }else{
    lines.push('',(final?'RESULTADO FINAL':'APURAÇÃO PARCIAL')+' · '+fmtPct(current.progress)+' das seções totalizadas','');
    current.candidates.slice(0,5).forEach(x=>lines.push(publicationCandidate(x)+' — '+fmtPct(x.pct)+(x.votes?' · '+Number(x.votes).toLocaleString('pt-BR')+' votos':'')));
    const leader=current.candidates[0],runner=current.candidates[1];
    if(leader&&runner){
      const gap=Math.max(0,Number(leader.pct||0)-Number(runner.pct||0));
      lines.push('','Em '+name+', '+publicationCandidate(leader)+' aparece em 1º lugar, com diferença de '+fmtPct(gap)+' para '+publicationCandidate(runner)+'.');
    }
    if(!final)lines.push('','O resultado municipal ainda é parcial e pode mudar até o encerramento oficial da totalização.');
  }
  if(current.generatedAt)lines.push('','Atualização: '+current.generatedAt);
  lines.push('',source);
  return lines.join('\n');
}
function drawFeature(ctx,feature,x,y,w,h){
  if(!fc||!feature)return;const proj=projector(fc,w,h,5),g=feature.geometry,polys=g.type==='Polygon'?[g.coordinates]:g.type==='MultiPolygon'?g.coordinates:[];
  ctx.save();ctx.translate(x,y);ctx.fillStyle='#17191c';ctx.strokeStyle='#fff';ctx.lineWidth=2;polys.forEach(poly=>{ctx.beginPath();poly.forEach(ring=>ring.forEach((p,i)=>{const[a,b]=proj(p);i?ctx.lineTo(a,b):ctx.moveTo(a,b)}));ctx.closePath();ctx.fill('evenodd');ctx.stroke()});ctx.restore();
}
function drawRN(ctx,x,y,w,h){
  if(!fc)return;const proj=projector(fc,w,h,5);ctx.save();ctx.translate(x,y);fc.features.forEach(f=>{const active=f===selectedFeature,g=f.geometry,polys=g.type==='Polygon'?[g.coordinates]:g.type==='MultiPolygon'?g.coordinates:[];ctx.fillStyle=active?'#17191c':'#f4dd19';ctx.strokeStyle='#fff';ctx.lineWidth=1.1;polys.forEach(poly=>{ctx.beginPath();poly.forEach(ring=>ring.forEach((p,i)=>{const[a,b]=proj(p);i?ctx.lineTo(a,b):ctx.moveTo(a,b)}));ctx.closePath();ctx.fill('evenodd');ctx.stroke()})});ctx.restore()}
function roundRect(ctx,x,y,w,h,r){r=Math.min(r,w/2,h/2);ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath()}
function fitCanvasText(ctx,text,x,y,maxWidth,startSize,minSize,weight='700',color='#17191c'){
  let size=startSize;
  while(size>minSize){
    ctx.font=weight+' '+size+'px DM Sans,Segoe UI,Arial';
    if(ctx.measureText(text).width<=maxWidth)break;
    size-=1;
  }
  ctx.fillStyle=color;ctx.font=weight+' '+size+'px DM Sans,Segoe UI,Arial';ctx.fillText(text,x,y);
}
function drawFocusedMunicipality(ctx,feature,x,y,w,h){
  if(!feature)return;
  const one={type:'FeatureCollection',features:[feature]},proj=projector(one,w,h,10),g=feature.geometry,polys=g.type==='Polygon'?[g.coordinates]:g.type==='MultiPolygon'?g.coordinates:[];
  ctx.save();ctx.translate(x,y);ctx.fillStyle='#f4dd19';ctx.strokeStyle='#17191c';ctx.lineWidth=3;
  polys.forEach(poly=>{ctx.beginPath();poly.forEach(ring=>ring.forEach((p,i)=>{const[a,b]=proj(p);i?ctx.lineTo(a,b):ctx.moveTo(a,b)}));ctx.closePath();ctx.fill('evenodd');ctx.stroke()});ctx.restore();
}
function drawCanvas(){
  if(mapPublicationMode){drawLeaderMapCanvas();return}
  if(!selectedFeature)return;
  const c=$('#rnCanvas'),ctx=c.getContext('2d'),name=selectedFeature.properties.nome;
  const INK='#151a18',CREAM='#f7f6ef',YELLOW='#f4dd19',MUTED='#515b56';
  const waiting=mode==='demo', simulated=mode==='sim',final=!!current.finalTotalization;
  const pctValue=Math.min(100,Math.max(0,Number(current.progress)||0));
  ctx.textAlign='left';ctx.textBaseline='alphabetic';ctx.globalAlpha=1;
  ctx.clearRect(0,0,1080,1080);ctx.fillStyle=CREAM;ctx.fillRect(0,0,1080,1080);

  // Cabeçalho de identidade: mesma linguagem editorial da peça animada.
  ctx.fillStyle=INK;ctx.fillRect(0,0,1080,155);
  ctx.fillStyle=YELLOW;ctx.fillRect(0,0,1080,13);
  fitCanvasText(ctx,'UEFY',60,112,305,96,78,'900',YELLOW);
  ctx.fillStyle=YELLOW;ctx.fillRect(358,37,4,91);
  fitCanvasText(ctx,'CENTRAL DAS ELEIÇÕES',390,82,620,34,28,'900',CREAM);
  fitCanvasText(ctx,'2026  /  SEGUNDO TURNO',390,121,620,27,21,'700',YELLOW);

  // Manchete e município, sem competir com os percentuais.
  fitCanvasText(ctx,'GOVERNO DO RN',60,247,710,73,52,'900',INK);
  fitCanvasText(ctx,String(name).toLocaleUpperCase('pt-BR')+'  /  RN',60,309,690,43,28,'800',MUTED);
  drawFocusedMunicipality(ctx,selectedFeature,770,184,235,150);
  const status=waiting?'CADASTRO / SEM APURAÇÃO':simulated?'SIMULADO / NÃO OFICIAL':final?'RESULTADO FINAL / TSE':'APURAÇÃO PARCIAL / TSE';
  ctx.fillStyle=INK;ctx.fillRect(60,340,960,42);
  fitCanvasText(ctx,status,80,369,910,23,18,'900',YELLOW);

  // Faixa de apuração, separada da votação dos candidatos.
  ctx.fillStyle=YELLOW;ctx.fillRect(60,403,960,104);
  fitCanvasText(ctx,waiting?'CANDIDATURAS REGISTRADAS':'SEÇÕES TOTALIZADAS',83,438,520,25,20,'900',INK);
  if(waiting){
    fitCanvasText(ctx,String((current.candidates||[]).length),84,489,400,51,40,'900',INK);
    fitCanvasText(ctx,'SEM VOTOS',680,473,285,30,24,'900',INK);
  }else{
    fitCanvasText(ctx,fmtPct(pctValue),83,489,400,61,46,'900',INK);
    ctx.fillStyle='rgba(21,26,24,.18)';ctx.fillRect(520,460,450,15);
    ctx.fillStyle=INK;ctx.fillRect(520,460,450*pctValue/100,15);
  }

  // Duelo central. Números grandes, nomes claros e barras por candidatura.
  const rows=(current.candidates||[]).slice(0,2);
  if(!rows.length){
    ctx.fillStyle='#fff';ctx.fillRect(60,530,960,365);
    ctx.strokeStyle='#c7ccc4';ctx.lineWidth=2;ctx.strokeRect(60,530,960,365);
    fitCanvasText(ctx,'AGUARDANDO RESULTADOS DO TSE',95,660,885,47,30,'900',INK);
    fitCanvasText(ctx,'Nenhum voto divulgado para este município.',95,719,870,27,21,'600',MUTED);
  }else{
    rows.forEach((cand,i)=>{
      const y=530+i*192,color=candidateColor(cand.name,cand.number),value=Math.max(0,Math.min(100,Number(cand.pct)||0));
      ctx.fillStyle='#fff';ctx.fillRect(60,y,960,176);
      ctx.strokeStyle='#c4cbc4';ctx.lineWidth=2;ctx.strokeRect(60,y,960,176);
      ctx.fillStyle=color;ctx.fillRect(60,y,16,176);
      fitCanvasText(ctx,String(cand.name||'').toLocaleUpperCase('pt-BR'),105,y+63,600,43,30,'900',INK);
      const info=[cand.number?'Nº '+cand.number:'',cand.party||''].filter(Boolean).join('  /  ');
      fitCanvasText(ctx,info,107,y+102,585,23,17,'700',MUTED);
      if(waiting){
        fitCanvasText(ctx,'—',904,y+88,70,71,58,'900',INK);
        fitCanvasText(ctx,'SEM RESULTADO',108,y+147,650,24,19,'800',MUTED);
      }else{
        ctx.textAlign='right';
        fitCanvasText(ctx,fmtPct(value),975,y+97,270,74,54,'900',INK);
        ctx.textAlign='left';
        fitCanvasText(ctx,(Number(cand.votes)||0).toLocaleString('pt-BR')+' VOTOS',107,y+136,700,23,18,'800',MUTED);
        ctx.fillStyle='#e0e5df';ctx.fillRect(107,y+151,868,12);
        ctx.fillStyle=color;ctx.fillRect(107,y+151,868*value/100,12);
      }
    });
  }

  // Rodapé compacto: procedência e carimbo de leitura.
  ctx.fillStyle=INK;ctx.fillRect(60,943,960,3);
  fitCanvasText(ctx,waiting?'CADASTRO OFICIAL DO TSE':simulated?'FONTE: SIMULADO TSE':'FONTE: TRIBUNAL SUPERIOR ELEITORAL',60,989,945,25,19,'900',INK);
  fitCanvasText(ctx,(waiting?'SEM APURAÇÃO  /  ':final?'RESULTADO FINAL  /  ':'DADOS PARCIAIS  /  ')+
    String(current.generatedAt||'HORÁRIO DA FONTE INDISPONÍVEL'),60,1029,950,23,17,'700',MUTED);
}
function flashRN(btn,t){if(!btn)return;const old=btn.textContent;btn.textContent=t;setTimeout(()=>btn.textContent=old,1800)}
async function rnCanvasBlob(){
  return await new Promise((resolve,reject)=>$('#rnCanvas').toBlob(b=>b?resolve(b):reject(new Error('Não foi possível gerar a imagem.')),'image/png'));
}
async function rnShareJpegBlob(){
  const canvas=$('#rnCanvas'),flat=document.createElement('canvas');
  flat.width=canvas.width;flat.height=canvas.height;
  const ctx=flat.getContext('2d',{alpha:false});
  ctx.fillStyle='#f4f6f7';ctx.fillRect(0,0,flat.width,flat.height);
  ctx.drawImage(canvas,0,0);
  return await new Promise((resolve,reject)=>flat.toBlob(b=>b?resolve(b):reject(new Error('Não foi possível preparar a imagem para compartilhamento.')),'image/jpeg',0.96));
}
async function copyRnImage(){
  if(!window.isSecureContext||!navigator.clipboard||!window.ClipboardItem)throw new Error('Área de transferência de imagens indisponível.');
  const blob=await rnCanvasBlob();
  await navigator.clipboard.write([new ClipboardItem({'image/png':blob})]);
  return blob;
}
async function openRnXIntent(text,preopened=null){
  const encoded=encodeURIComponent(text);
  const useIntent=encoded.length<=6000;
  const url=useIntent?'https://twitter.com/intent/tweet?text='+encoded:'https://x.com/compose/post';
  if(!useIntent){
    try{await navigator.clipboard.writeText(text)}catch{}
  }
  if(preopened){preopened.opener=null;preopened.location.href=url}else window.open(url,'_blank','noopener,noreferrer');
  return useIntent;
}
function rnShareStatus(message,bad){
   UEFYShare.notice('#rnShareStatus',message,bad);
 }
 function rnShareFallback(text){
   const link=$('#rnXManual');
   const encoded=encodeURIComponent(text);
   link.href=encoded.length<6000?'https://twitter.com/intent/tweet?text='+encoded:'https://x.com/compose/post';
   link.hidden=false;
   rnShareStatus('O Brave não enviou imagem e legenda juntas ao aplicativo. Use “Baixar imagem”, “Copiar texto” e, depois, “Abrir o X com o texto”. Confira tudo antes de publicar.',true);
 }
 function shareRNImageAndText(openX=false,preopened=null){
   const btn=openX?$('#rnOpenX'):$('#rnShareBundle');
   if(!rnPublicationIsSafe()){
     if(preopened)preopened.close();flashRN(btn,'Verificação necessária');
     rnShareStatus('Publicação bloqueada até os resultados oficiais do TSE serem conferidos.',true);
     return Promise.resolve();
   }
   const text=$('#rnPostText').value;
   const canvas=$('#rnCanvas');
   const name=selectedFeature?.properties?.nome||'rn';
   const desktop=window.matchMedia?.('(pointer:fine)').matches&&window.innerWidth>820;
   $('#rnXManual').hidden=true;
   // No Brave/Android e no compartilhamento geral a chamada é feita durante
   // o clique. Nenhum await/toBlob antecede navigator.share.
   if(!openX||!desktop){
     const task=UEFYShare.send({canvas,text,
       filename:'uefy-eleicoes-rn-'+norm(name)+'.jpg',
       title:'Central das Eleições UEFY | RN'});
     return task.then(out=>{
       if(preopened)preopened.close();
       if(out.status==='shared')rnShareStatus('Arquivo enviado ao menu do celular. Confira se a imagem e a legenda chegaram ao X; se só a imagem apareceu, toque em “Copiar texto” e cole no post.',false);
       else if(out.status==='cancelled')rnShareStatus('Compartilhamento cancelado. A imagem e o texto seguem disponíveis aqui.',false);
       else rnShareFallback(text);
     });
   }
   // Desktop: mantém a abertura com texto e a cópia da imagem quando disponível.
   return (async()=>{
     try{
       if(window.isSecureContext&&navigator.clipboard&&window.ClipboardItem){
         const blob=await rnCanvasBlob();
         await navigator.clipboard.write([new ClipboardItem({'image/png':blob})]);
       }
     }catch{}
     const prefilled=await openRnXIntent(text,preopened);
     rnShareStatus(prefilled?'O X abriu com texto; cole a imagem com Ctrl+V. Caso não funcione, baixe a imagem e anexe pelo editor.':'O X foi aberto. Copie o texto e anexe a imagem manualmente.',false);
   })();
 }
 $('#rnMapPublish')?.addEventListener('click',()=>{
  if(mode!=='official'||!leaderMapData.publication_ready||leaderMapData.round!==2)return;
  mapPublicationMode=true;
  $('#rnPostText').value=mapPostText();
  $('#rnChars').textContent=$('#rnPostText').value.length+' caracteres';
  drawCanvas();
  $('#rnResultTitle').textContent='Mapa de liderança municipal';
  $('#rnProgress').textContent=leaderMapData.final_result?'Final':'Parcial';
  $('#rnStatus').textContent=leaderMapData.final_result?'Mapa final com base municipal completa.':'Mapa parcial com base municipal completa no snapshot; as lideranças podem mudar até 100% da totalização.';
  updateRnPublicationSafety();
  document.querySelector('#publicacao')?.scrollIntoView({behavior:'smooth',block:'start'});
});
$('#munSearch').oninput=e=>{renderList(e.target.value);const d=$('.rn-municipality-list');if(d&&e.target.value.trim())d.open=true;};

$('#rnMode').value=mode;
updateSourceUI();
$('#rnMode').onchange=e=>changeSource(e.target.value);
$('#rnRefresh').onclick=async()=>{updateSourceUI();await loadLeaderMap();await loadRemote()};
function syncRnTextModeButtons(){
  document.querySelectorAll('.text-mode-switch [data-text-mode]').forEach(b=>b.classList.toggle('active',b.dataset.textMode===publicationTextMode));
}
document.querySelectorAll('.text-mode-switch [data-text-mode]').forEach(b=>b.onclick=()=>{
  publicationTextMode=b.dataset.textMode;
  syncRnTextModeButtons();
  const t=makeText();$('#rnPostText').value=t;$('#rnChars').textContent=t.length+' caracteres';
});
syncRnTextModeButtons();

$('#rnPostText').oninput=e=>$('#rnChars').textContent=e.target.value.length+' caracteres';
$('#rnCopyText').onclick=async()=>{
   if(!rnPublicationIsSafe())return flashRN($('#rnCopyText'),'Verificação necessária');
   const ok=await UEFYShare.copyText($('#rnPostText').value,$('#rnPostText'));
   flashRN($('#rnCopyText'),ok?'Texto copiado!':'Selecione e copie');
   rnShareStatus(ok?'Texto copiado. Cole no editor do X após anexar a imagem.':'O Brave não liberou a cópia automática. O texto foi selecionado; use Copiar no menu do celular.',!ok);
 };
$('#rnCopyImage').onclick=async()=>{if(!rnPublicationIsSafe())return flashRN($('#rnCopyImage'),'Verificação necessária');try{await copyRnImage();flashRN($('#rnCopyImage'),'Imagem copiada!')}catch{flashRN($('#rnCopyImage'),'Cópia bloqueada')}};
$('#rnDownload').onclick=()=>{if(!rnPublicationIsSafe())return flashRN($('#rnDownload'),'Verificação necessária');const a=document.createElement('a');a.download='uefy-eleicoes-rn-'+norm(selectedFeature.properties.nome)+'.png';a.href=$('#rnCanvas').toDataURL('image/png');a.click()};
$('#rnOpenX').onclick=()=>{const desktop=window.matchMedia?.('(pointer:fine)').matches&&window.innerWidth>820;const w=desktop?window.open('about:blank','_blank'):null;shareRNImageAndText(true,w)};
$('#rnShareBundle').onclick=()=>shareRNImageAndText(false);
const theme=$('#themeToggle');
if(localStorage.getItem('uefy-eleicoes-theme')==='dark')document.body.classList.add('dark');
function syncTheme(){
  const dark=document.body.classList.contains('dark');
  theme.textContent=dark?'☀':'◐';
  theme.setAttribute('aria-pressed',String(dark));
  theme.setAttribute('title',dark?'Usar tema claro':'Usar tema escuro');
}
syncTheme();
theme.onclick=()=>{document.body.classList.toggle('dark');localStorage.setItem('uefy-eleicoes-theme',document.body.classList.contains('dark')?'dark':'light');syncTheme()};
function inSecondRoundPollingWindow(){const p=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23'}).formatToParts(new Date());const get=t=>p.find(x=>x.type===t)?.value||'';const day=get('year')+'-'+get('month')+'-'+get('day'),hour=Number(get('hour'));return day>'2026-10-25'||(day==='2026-10-25'&&hour>=17)}
rnAutoTimer=setInterval(()=>{if(mode==='official'&&!document.hidden&&!current?.finalTotalization&&inSecondRoundPollingWindow()){loadLeaderMap();loadRemote()}},AUTO_REFRESH_MS);
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&mode==='official'&&inSecondRoundPollingWindow()){loadLeaderMap();loadRemote()}});
init().catch(e=>{$('#rnStatus').textContent='Erro ao carregar o mapa: '+e.message});

const topBtn=$('#toTop');window.addEventListener('scroll',()=>topBtn?.classList.toggle('show',scrollY>420),{passive:true});if(topBtn)topBtn.onclick=()=>scrollTo({top:0,behavior:'smooth'});
document.querySelectorAll('.mobile-menu a').forEach(a=>a.addEventListener('click',()=>a.closest('details')?.removeAttribute('open')));

/* Favoritos e atualização operacional RN */
const UEFY_FAV_KEY='uefy-eleicoes-favorites-v1';
function getFavs(){try{return JSON.parse(localStorage.getItem(UEFY_FAV_KEY)||'[]')}catch{return[]}}
function saveFavs(v){localStorage.setItem(UEFY_FAV_KEY,JSON.stringify(v));renderFavStrip();syncFavButton()}
function currentFav(){return {type:'rn',office,municipality:selectedFeature?.properties?.nome||'Natal',label:(selectedFeature?.properties?.nome||'Natal')+' · '+OFFICE[office].title}}
function favId(f){return [f.type,f.office,f.scope,f.municipality].filter(Boolean).join('|')}
function syncFavButton(){const b=document.querySelector('#favoriteCurrent');if(!b||!selectedFeature)return;const on=getFavs().some(f=>favId(f)===favId(currentFav()));b.classList.toggle('on',on);b.textContent=on?'★ Favorito':'☆ Favoritar'}
function renderFavStrip(){const box=document.querySelector('#liveStripItems');if(!box)return;const favs=getFavs();if(!favs.length){box.innerHTML='<span class="strip-empty">Marque municípios para acompanhar aqui.</span>';return}box.innerHTML=favs.map(f=>'<button class="strip-chip"><b>'+f.label+'</b><span>toque para abrir · <em>↻</em></span></button>').join('');box.querySelectorAll('.strip-chip').forEach((b,i)=>b.onclick=()=>{const f=favs[i];if(f.type!=='rn'){location.href='index.html'}else{const ft=fc?.features.find(x=>norm(x.properties.nome)===norm(f.municipality));if(ft){office=f.office;selectMunicipality(ft);scrollTo({top:document.querySelector('.rn-side').offsetTop-115,behavior:'smooth'})}}})}
document.querySelector('#favoriteCurrent')?.addEventListener('click',()=>{if(!selectedFeature)return;const f=currentFav(),a=getFavs(),id=favId(f),i=a.findIndex(x=>favId(x)===id);if(i>=0)a.splice(i,1);else a.unshift(f);saveFavs(a.slice(0,12))});
document.querySelector('#refreshAll')?.addEventListener('click',async e=>{const b=e.currentTarget;b.classList.add('loading');b.disabled=true;try{updateSourceUI();await loadLeaderMap();await loadRemote();renderFavStrip()}finally{setTimeout(()=>{b.classList.remove('loading');b.disabled=false},450)}});
renderFavStrip();
const _uefyInitFav=setInterval(()=>{if(fc&&selectedFeature){clearInterval(_uefyInitFav);const q=new URLSearchParams(location.search),m=q.get('fav');if(m){const ft=fc.features.find(x=>norm(x.properties.nome)===norm(m));if(ft)selectMunicipality(ft)}syncFavButton();renderFavStrip()}},100);
