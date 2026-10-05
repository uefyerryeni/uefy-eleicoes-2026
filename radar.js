const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const DATA_URL='data/radar-rn.json';
const CANDIDATE_URL='data/candidatos-ufs-c.json';
const MAP_URL='assets/maps/rn-municipios.geojson';
const LOGO_URL='https://uefyerryeni.github.io/uefyerryeni-logo.png';
const OFFICE_LABELS={sen:'Senador',depf:'Deputado federal',depe:'Deputado estadual'};
const OFFICE_CARGO={sen:5,depf:6,depe:7};
const TYPE_LABELS={territorial_coverage:'Presença municipal',capital_share:'Natal x interior',top_municipalities:'Concentração territorial',municipal_leads:'Primeiro lugar nos municípios'};
const COLOR_PALETTE=['#d62828','#1976d2','#2e7d32','#7b2cbf','#ef6c00','#00897b','#c2185b','#6d4c41','#455a64','#5c6bc0','#ad1457','#558b2f','#00838f','#6a1b9a','#f57c00','#3949ab'];
const SENATE_COLORS_BY_NUMBER={
  '123':'#f28c00', // Rafael Motta · laranja âmbar
  '131':'#d62828', // Samanda de Lula · vermelho
  '161':'#7b2cbf', // Luciana Mandu · roxo
  '166':'#c2185b', // Rosália Fernandes · magenta
  '200':'#17375e', // Styvenson Valentim · azul-marinho
  '222':'#2e7d32', // Coronel Hélio · verde
  '360':'#8d6e63', // Gari Wendell Batista · marrom
  '369':'#5c6bc0', // Clóvis Costa · índigo
  '444':'#1976d2', // Tércio Tinôco · azul
  '500':'#6a1b9a', // Sandro Pimentel · violeta
  '501':'#ad1457', // Sonia Godeiro · vinho
  '555':'#00897b', // Zenaide Maia · verde-petróleo
  '800':'#455a64'  // Professor Guilherme · grafite
};

let radar={status:'loading',findings:[],offices:{},municipal_maps:{}};
let candidateRegistry=[],rnMap=null,radarMode='official',publicationTextMode='full',radarLoading=false,radarAutoTimer=null;
let selectedMunicipality='Natal',publicationView='map',senateCandidateFilter='';

const pct=v=>Number(v||0).toLocaleString('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:2})+'%';
const int=v=>Number(v||0).toLocaleString('pt-BR');
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const MUNICIPALITY_ALIASES={acu:'assu',ares:'arez',januariocicco:'boasaude'};
const municipalityKey=name=>MUNICIPALITY_ALIASES[norm(name)]||norm(name);
function flash(btn,text){if(!btn)return;const old=btn.textContent;btn.textContent=text;setTimeout(()=>btn.textContent=old,1800)}
function setStatus(msg,error=false){const el=$('#radarStatus');if(!el)return;el.hidden=!msg;el.textContent=msg||'';el.classList.toggle('error',error)}
function activeOffice(){return $('#officeFilter')?.value||'sen'}
function officeLabel(){return OFFICE_LABELS[activeOffice()]||'Legislativo'}
function publicationSource(){return 'Fonte: Tribunal Superior Eleitoral'}
function registryForOffice(office=activeOffice()){return candidateRegistry.filter(x=>Number(x.cargo)===OFFICE_CARGO[office]).sort((a,b)=>String(a.nome).localeCompare(String(b.nome),'pt-BR'))}
function candidateMeta(number,name=''){
  const row=registryForOffice().find(x=>String(x.numero)===String(number))||candidateRegistry.find(x=>String(x.nome)===String(name));
  return {party:row?.partido||'',number:row?.numero||String(number||''),name:row?.nome||name};
}
function candidateLabel(row){
  const meta=candidateMeta(row?.number,row?.name);
  const base=(row?.name||meta.name||'Candidatura')+(row?.party||meta.party?' ('+(row?.party||meta.party)+')':'');
  const d=String(row?.vote_destination||'').trim();return base+(d&&!/^válido$/i.test(d)?' · '+d:'');
}
function candidateColor(number,name=''){
  const num=String(number||'').replace(/\D/g,'');
  if(activeOffice()==='sen'&&SENATE_COLORS_BY_NUMBER[num])return SENATE_COLORS_BY_NUMBER[num];
  const key=String(number||name||'0');
  let h=0;for(const ch of key)h=(h*31+ch.charCodeAt(0))>>>0;
  return COLOR_PALETTE[h%COLOR_PALETTE.length];
}
function officeMapData(){
  return radar?.municipal_maps?.[activeOffice()]||{leaders:{},results:{},summary:[],municipalities_read:0};
}
function municipalityNames(){
  if(!rnMap?.features)return [];
  return rnMap.features.map(f=>f.properties?.nome).filter(Boolean).sort((a,b)=>a.localeCompare(b,'pt-BR'));
}
function municipalityResult(name=selectedMunicipality){
  const results=officeMapData().results||{},target=municipalityKey(name);
  const hit=Object.entries(results).find(([key])=>municipalityKey(key)===target);
  return hit?hit[1]:[];
}
function municipalityRankedCandidate(name=selectedMunicipality,rank=1){
  const rows=municipalityResult(name);
  return rows[Math.max(0,Number(rank||1)-1)]||null;
}
function municipalityLeader(name=selectedMunicipality){
  return municipalityRankedCandidate(name,1);
}
function effectiveMapRank(){return 1}
function senateCandidateKey(row){return String(row?.number||row?.name||'')}
function rawMapCandidate(name){return municipalityLeader(name)}
function mapCandidate(name){
  const row=rawMapCandidate(name);
  if(activeOffice()!=='sen')return row;
  if(!row)return null;
  if(senateCandidateFilter&&senateCandidateKey(row)!==senateCandidateFilter)return null;
  return row;
}
function mapSummaryUnfiltered(){
  const counts=new Map();
  for(const name of municipalityNames()){
    const row=rawMapCandidate(name);if(!row)continue;
    const key=String(row.number||row.name);
    if(!counts.has(key))counts.set(key,{number:row.number,name:row.name,party:row.party||candidateMeta(row.number,row.name).party,municipalities:0});
    counts.get(key).municipalities++;
  }
  return [...counts.values()].sort((a,b)=>b.municipalities-a.municipalities||String(a.name).localeCompare(String(b.name),'pt-BR'));
}
function mapSummary(){
  const all=mapSummaryUnfiltered();
  if(activeOffice()!=='sen'||!senateCandidateFilter)return all;
  return all.filter(x=>senateCandidateKey(x)===senateCandidateFilter);
}
function senateWinningMunicipalities(){
  if(activeOffice()!=='sen'||!senateCandidateFilter)return [];
  return municipalityNames().filter(name=>{
    const row=rawMapCandidate(name);
    return row&&senateCandidateKey(row)===senateCandidateFilter;
  });
}
function senateMajorCityHighlights(){
  if(activeOffice()!=='sen'||!senateCandidateFilter)return [];
  const major=['Natal','Mossoró','Parnamirim','São Gonçalo do Amarante','Macaíba','Ceará-Mirim','Extremoz','Caicó','Assú','São José de Mipibu','Currais Novos','Santa Cruz'];
  const wins=new Set(senateWinningMunicipalities().map(municipalityKey));
  return major.filter(name=>wins.has(municipalityKey(name)));
}
function candidateFindingParty(name){
  const row=registryForOffice().find(x=>x.nome===name);return row?.partido||'';
}

function coordsOfGeometry(g,out=[]){
  if(!g)return out;
  if(g.type==='Polygon')g.coordinates.forEach(r=>r.forEach(p=>out.push(p)));
  else if(g.type==='MultiPolygon')g.coordinates.forEach(poly=>poly.forEach(r=>r.forEach(p=>out.push(p))));
  return out;
}
function boundsOf(fc){const pts=[];fc.features.forEach(f=>coordsOfGeometry(f.geometry,pts));let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;pts.forEach(([x,y])=>{minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y)});return{minX,minY,maxX,maxY}}
function projector(fc,w,h,pad=10){const b=boundsOf(fc),sx=(w-pad*2)/(b.maxX-b.minX),sy=(h-pad*2)/(b.maxY-b.minY),s=Math.min(sx,sy),ox=(w-(b.maxX-b.minX)*s)/2,oy=(h-(b.maxY-b.minY)*s)/2;return([x,y])=>[ox+(x-b.minX)*s,h-(oy+(y-b.minY)*s)]}
function geometryPath(g,proj){
  const ring=r=>r.map((p,i)=>{const[x,y]=proj(p);return(i?'L':'M')+x.toFixed(2)+' '+y.toFixed(2)}).join(' ')+' Z';
  if(g.type==='Polygon')return g.coordinates.map(ring).join(' ');
  if(g.type==='MultiPolygon')return g.coordinates.flatMap(poly=>poly.map(ring)).join(' ');
  return '';
}

async function loadRadar({silent=false}={}){
  if(radarLoading)return;radarLoading=true;
  const previous=radar;
  if(!silent)setStatus('Carregando a leitura oficial do Radar Legislativo…');
  try{
    const [radarRes,candRes,mapRes]=await Promise.all([
      fetch(DATA_URL+'?ts='+Date.now(),{cache:'no-store'}),
      fetch(CANDIDATE_URL+'?ts='+Date.now(),{cache:'no-store'}),
      fetch(MAP_URL,{cache:'no-store'})
    ]);
    if(!radarRes.ok||!mapRes.ok)throw new Error('Base indisponível');
    radar=await radarRes.json();rnMap=await mapRes.json();
    if(candRes.ok){const base=await candRes.json();candidateRegistry=Array.isArray(base?.rn?.candidates)?base.rn.candidates:[]}else candidateRegistry=[];
    renderAll();
  }catch(e){
    if(previous?.status==='ok')radar=previous;
    setStatus(previous?.status==='ok'?'Nova leitura indisponível. Mantendo o último snapshot oficial válido ('+(previous.source_generated_at||previous.generated_at||'horário anterior')+').':'Não foi possível carregar o Radar Legislativo agora. Tente atualizar a página.',true);
    renderAll();
  }finally{radarLoading=false}
}
function renderAll(){
  $('#radarOfficeTitle').textContent=officeLabel();
  $('#radarSummaryOffice').textContent=officeLabel();
  $('#radarMunicipalOffice').textContent=officeLabel();
  const senate=activeOffice()==='sen';
  $('#senateCandidateFilterWrap').hidden=!senate;
  if(senate){
    const select=$('#senateCandidateFilter'),winners=mapSummaryUnfiltered();
    if(select){
      const validKeys=winners.map(senateCandidateKey);
      if(senateCandidateFilter&&!validKeys.includes(senateCandidateFilter))senateCandidateFilter='';
      select.innerHTML='<option value="">Todos os vencedores municipais</option>'+winners.map(x=>'<option value="'+esc(senateCandidateKey(x))+'">'+esc(candidateLabel(x))+' — '+x.municipalities+' município(s)</option>').join('');
      select.value=senateCandidateFilter;
    }
    const selected=winners.find(x=>senateCandidateKey(x)===senateCandidateFilter);
    $('#radarMapTitle').textContent=selected
      ?'Municípios vencidos por '+selected.name
      :'Quem venceu em cada município para o Senado';
    $('#radarMapExplanation').textContent=selected
      ?'O mapa destaca apenas os municípios em que '+selected.name+' ficou em 1º lugar na votação para o Senado.'
      :'Cada município recebe a cor da candidatura que ficou em 1º lugar naquele município. Selecione uma candidatura para mostrar somente as cidades em que ela venceu.';
    const status=$('#senateCandidateFilterStatus');
    if(status)status.textContent=selected
      ?selected.name+' venceu '+selected.municipalities+' município(s) nesta leitura.'
      :'Cada município recebe a cor de quem ficou em 1º lugar nele.';
    $('#radarSummaryTitle').textContent=selected?'Cidades vencidas':'Municípios vencidos';
  }else{
    senateCandidateFilter='';
    $('#radarMapTitle').textContent='Quem teve a maior votação nominal para '+officeLabel()+' em cada município';
    $('#radarMapExplanation').textContent='O mapa mostra quem teve a maior votação nominal neste cargo em cada município. Para deputados, isso não indica candidatura eleita, pois a distribuição das vagas segue o sistema proporcional.';
    $('#radarSummaryTitle').textContent='Municípios liderados';
  }
  $('#radarElectoralNote').textContent=senate
    ?'Senado: “venceu o município” significa ter ficado em 1º lugar na votação local. Os dois senadores eleitos são definidos pela votação total no estado.'
    :'Deputados: o mapa municipal mostra votação nominal local. A eleição depende do sistema proporcional e da distribuição de vagas entre partidos e federações.';
  $('#radarSourceBadge').textContent='OFICIAL TSE';
  $('#radarSourceBadge').dataset.mode=radarMode;
  $('#sourceGenerated').textContent=radar.source_generated_at||radar.generated_at||'Aguardando resultados';
  const prog=radar?.offices?.[activeOffice()]?.progress??radar.progress??0;
  $('#sourceMeta').textContent=(radar.source_name||'Tribunal Superior Eleitoral')+' · '+pct(prog)+' das seções';
  $('#radarLive').textContent=radar.status==='ok'?'TSE oficial':'Aguardando apuração';
  populateMunicipalities();
  renderMap();
  renderMunicipality();
  buildAnalysisFilters();
  renderFindings();
  updatePublication();
  const m=officeMapData();
  if(!m.municipalities_read)setStatus('Aguardando a primeira leitura municipal do Radar Legislativo. O mapa será preenchido automaticamente quando houver votos oficiais.',false);
  else setStatus('');
}

function populateMunicipalities(){
  const sel=$('#radarMunicipality'),names=municipalityNames();if(!sel)return;
  if(!names.includes(selectedMunicipality))selectedMunicipality=names.find(x=>norm(x)==='natal')||names[0]||'Natal';
  sel.innerHTML=names.map(n=>'<option value="'+esc(n)+'">'+esc(n)+'</option>').join('');sel.value=selectedMunicipality;
}

function renderMap(){
  const svg=$('#radarLegMap');if(!svg||!rnMap)return;
  const proj=projector(rnMap,650,520,8),m=officeMapData(),summary=mapSummary(),allSummary=mapSummaryUnfiltered();
  svg.innerHTML=rnMap.features.map(f=>{
    const name=f.properties?.nome||'',raw=rawMapCandidate(name),lead=mapCandidate(name),fill=lead?candidateColor(lead.number,lead.name):(activeOffice()==='sen'&&raw?'#e5e1d8':'#d9dee2'),active=name===selectedMunicipality;
    const tip=raw?name+' · vencedor municipal: '+raw.name+' · '+pct(raw.pct):name+' · aguardando votos';
    return '<path class="radar-map-feature'+(active?' selected':'')+(activeOffice()==='sen'&&raw&&!lead?' filtered-out':'')+'" data-mun="'+esc(name)+'" d="'+geometryPath(f.geometry,proj)+'" fill="'+fill+'"><title>'+esc(tip)+'</title></path>';
  }).join('');
  $$('.radar-map-feature').forEach(el=>el.addEventListener('click',()=>selectMunicipality(el.dataset.mun,true)));

  $('#radarLeaderSummary').innerHTML=summary.length?summary.slice(0,10).map(x=>'<div class="rn-leader-row"><i style="background:'+candidateColor(x.number,x.name)+'"></i><span><strong>'+esc(candidateLabel(x))+'</strong><small>'+x.municipalities+' município(s) vencido(s)</small></span></div>').join(''):'<div class="rn-map-empty">Nenhum município encontrado para o filtro atual.</div>';

  const cities=$('#radarWinnerCities');
  if(cities){
    if(activeOffice()==='sen'&&senateCandidateFilter){
      const wins=senateWinningMunicipalities();
      cities.innerHTML='<strong>Destaques</strong><p>'+esc(wins.slice(0,18).join(', ')+(wins.length>18?' e outros.':'.'))+'</p>';
    }else{
      cities.innerHTML='';
    }
  }

  const rawLead=rawMapCandidate();
  const lead=mapCandidate();
  const selectedText=lead
    ?esc(candidateLabel(lead))+' venceu o município com '+pct(lead.pct)
    :rawLead
      ?esc(candidateLabel(rawLead))+' venceu o município, mas está fora do filtro selecionado.'
      :'Aguardando votos para este cargo.';
  $('#radarSelectedHighlight').innerHTML='<small>Município selecionado</small><strong>'+esc(selectedMunicipality)+'</strong><span>'+selectedText+'</span>';
  $('#radarMapCoverage').textContent=Number(m.municipalities_read||0)+'/167 municípios lidos';
  const prog=radar?.offices?.[activeOffice()]?.progress??radar.progress??0;
  $('#radarMapProgress').textContent=prog?pct(prog)+' das seções totalizadas':'Aguardando apuração oficial';
  $('#radarMapPublish').disabled=!(activeOffice()==='sen'?allSummary.length:summary.length);
}

function selectMunicipality(name,scroll=false){
  selectedMunicipality=name;const sel=$('#radarMunicipality');if(sel)sel.value=name;
  renderMap();renderMunicipality();
  if(scroll)$('#municipio')?.scrollIntoView({behavior:'smooth',block:'start'});
}

function renderMunicipality(){
  $('#radarMunicipalTitle').textContent=selectedMunicipality;
  const rows=municipalityResult(),leader=rows[0];
  const prog=radar?.offices?.[activeOffice()]?.progress??radar.progress??0;
  $('#radarMunicipalProgress').textContent=prog?pct(prog):'—';
  $('#radarMunicipalResults').innerHTML=rows.length?rows.slice(0,8).map((x,i)=>'<div class="radar-municipal-row"><span class="rank">'+(i+1)+'º</span><span class="name">'+esc(candidateLabel(x))+'<small>'+int(x.votes)+' votos</small></span><span class="bar"><i style="width:'+Math.min(100,x.pct)+'%;background:'+candidateColor(x.number,x.name)+'"></i></span><strong>'+pct(x.pct)+'</strong></div>').join(''):'<div class="rn-map-empty">Ainda não há votos para este município.</div>';
  $('#radarMunicipalPublish').disabled=!leader;
}

function buildAnalysisFilters(){
  const c=$('#candidateFilter'),t=$('#typeFilter');if(!c||!t)return;
  const oldC=c.value,oldT=t.value,regs=registryForOffice();
  c.innerHTML='<option value="all">Todas as candidaturas</option>'+regs.map(x=>'<option value="'+esc(String(x.seq||x.nome))+'">'+esc(x.nome+(x.partido?' ('+x.partido+')':'')+(x.numero?' · '+x.numero:''))+'</option>').join('');
  if([...c.options].some(o=>o.value===oldC))c.value=oldC;
  t.innerHTML='<option value="all">Todas as análises</option>'+Object.entries(TYPE_LABELS).map(([k,v])=>'<option value="'+k+'">'+v+'</option>').join('');
  if([...t.options].some(o=>o.value===oldT))t.value=oldT;
}
function selectedAnalysisCandidate(){
  const v=$('#candidateFilter')?.value;if(!v||v==='all')return null;
  return registryForOffice().find(x=>String(x.seq||x.nome)===v)||null;
}
function filteredFindings(){
  const cand=selectedAnalysisCandidate(),type=$('#typeFilter')?.value||'all';
  return (radar.findings||[]).filter(f=>f.office===activeOffice()&&(!cand||f.candidate===cand.nome)&&(type==='all'||f.type===type));
}
function renderFindings(){
  const grid=$('#findingsGrid');if(!grid)return;
  const items=filteredFindings();$('#findingCount').textContent=items.length+' análise(s) disponível(is)';
  grid.innerHTML=items.length?items.slice(0,40).map(f=>'<article class="finding-card"><div class="finding-meta"><span class="finding-chip">'+esc(TYPE_LABELS[f.type]||f.type)+'</span></div><div class="finding-value">'+esc(f.display_value||'Dado')+'</div><h3>'+esc(f.headline)+'</h3><p>'+esc(f.summary||'')+'</p><details><summary>Ver cálculo</summary><div class="finding-calc">'+esc(f.calculation||'—')+'</div></details></article>').join(''):'<div class="no-findings">As análises aparecerão quando houver dados para este cargo.</div>';
}

function mapPublicationText(){
  const m=officeMapData(),summary=mapSummary(),prog=radar?.offices?.[activeOffice()]?.progress??radar.progress??0;
  const selectedSenate=activeOffice()==='sen'?mapSummaryUnfiltered().find(x=>senateCandidateKey(x)===senateCandidateFilter):null;
  const title=activeOffice()==='sen'
    ?(selectedSenate?'MUNICÍPIOS VENCIDOS POR '+selectedSenate.name.toUpperCase():'QUEM VENCEU EM CADA MUNICÍPIO')
    :'MAPA DE MAIOR VOTAÇÃO NOMINAL POR MUNICÍPIO';
  if(publicationTextMode==='compact'){
    const lines=['ELEIÇÕES 2026 | '+officeLabel().toUpperCase()+' · RN',title];
    summary.slice(0,5).forEach(x=>lines.push(candidateLabel(x)+' — '+x.municipalities+' município(s)'));
    if(selectedSenate){
      const highlights=senateMajorCityHighlights();
      if(highlights.length)lines.push('Destaques: '+highlights.slice(0,5).join(', ')+'.');
    }
    lines.push('',activeOffice()==='sen'?'“Venceu o município” = 1º lugar na votação local; as duas vagas são definidas pela votação estadual.':'Mapa de votação nominal municipal; não representa, por si só, candidaturas eleitas.');
    lines.push(publicationSource());return lines.join('\n');
  }
  const lines=['ELEIÇÕES 2026 | '+officeLabel().toUpperCase()+' · RN',title,''];
  if(selectedSenate){
    lines.push(candidateLabel(selectedSenate)+' venceu '+selectedSenate.municipalities+' município(s) nesta leitura.');
    const highlights=senateMajorCityHighlights();
    if(highlights.length)lines.push('Destaques entre as maiores cidades: '+highlights.slice(0,5).join(', ')+'.');
    const wins=senateWinningMunicipalities();
    if(wins.length)lines.push('Cidades: '+wins.slice(0,20).join(', ')+(wins.length>20?' e outras.':'.'));
  }else{
    summary.slice(0,8).forEach(x=>lines.push(candidateLabel(x)+' — '+x.municipalities+' município(s) vencido(s)'));
  }
  const natal=rawMapCandidate('Natal')||rawMapCandidate('NATAL');if(natal)lines.push('','Natal: '+candidateLabel(natal)+' ficou em 1º lugar com '+pct(natal.pct)+'.');
  lines.push('','Base municipal: '+Number(m.municipalities_read||0)+'/167 municípios lidos.');
  if(activeOffice()==='sen')lines.push('Leitura: “venceu o município” significa ter ficado em 1º lugar na votação local. As duas vagas ao Senado são definidas pela votação total no RN.');
  else lines.push('Leitura: para deputados, a maior votação nominal em um município não equivale a eleição. As vagas são distribuídas pelo sistema proporcional entre partidos e federações.');
  if(prog<100)lines.push('Apuração parcial: as lideranças municipais podem mudar com novas seções.');
  if(radar.source_generated_at||radar.generated_at)lines.push('Atualização: '+(radar.source_generated_at||radar.generated_at));
  lines.push(publicationSource());return lines.join('\n');
}

function municipalPublicationText(){
  const rows=municipalityResult(),prog=radar?.offices?.[activeOffice()]?.progress??radar.progress??0;
  if(publicationTextMode==='compact'){
    const lines=['ELEIÇÕES 2026 | '+officeLabel().toUpperCase(),selectedMunicipality+' (RN)',prog>=100?'RESULTADO FINAL':'PARCIAL · '+pct(prog)];
    rows.slice(0,2).forEach(x=>lines.push(candidateLabel(x)+' — '+pct(x.pct)));
    lines.push('',publicationSource());return lines.join('\n');
  }
  const lines=['ELEIÇÕES 2026 | '+officeLabel().toUpperCase(),selectedMunicipality+' (RN)',prog>=100?'RESULTADO FINAL':'APURAÇÃO PARCIAL · '+pct(prog)+' das seções',''];
  rows.slice(0,5).forEach(x=>lines.push(candidateLabel(x)+' — '+pct(x.pct)+' · '+int(x.votes)+' votos'));
  if(rows[0]&&rows[1])lines.push('','No município, '+candidateLabel(rows[0])+' aparece em 1º, com diferença de '+pct(rows[0].pct-rows[1].pct)+' para '+candidateLabel(rows[1])+'.');
  if(activeOffice()==='sen')lines.push('No Senado, este recorte municipal não define os eleitos: as duas vagas são preenchidas pelos dois candidatos mais votados no estado.');
  else lines.push('Para deputados, a posição neste município não determina eleição; as vagas são distribuídas pelo sistema proporcional.');
  if(prog<100)lines.push('O resultado pode mudar até o encerramento da totalização.');
  if(radar.source_generated_at||radar.generated_at)lines.push('Atualização: '+(radar.source_generated_at||radar.generated_at));
  lines.push(publicationSource());return lines.join('\n');
}
function currentPublicationText(){return publicationView==='municipality'?municipalPublicationText():mapPublicationText()}

function roundRect(ctx,x,y,w,h,r){r=Math.min(r,w/2,h/2);ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath()}
function fitText(ctx,text,x,y,max,start,min,weight='700',color='#17191c'){let s=start;while(s>min){ctx.font=weight+' '+s+'px Inter,Segoe UI,Arial';if(ctx.measureText(text).width<=max)break;s--}ctx.fillStyle=color;ctx.font=weight+' '+s+'px Inter,Segoe UI,Arial';ctx.fillText(text,x,y)}
function drawGeometry(ctx,feature,fc,x,y,w,h,fill,stroke='#fff',line=1.2){const proj=projector(fc,w,h,7),g=feature.geometry,polys=g.type==='Polygon'?[g.coordinates]:g.type==='MultiPolygon'?g.coordinates:[];ctx.save();ctx.translate(x,y);ctx.fillStyle=fill;ctx.strokeStyle=stroke;ctx.lineWidth=line;polys.forEach(poly=>{ctx.beginPath();poly.forEach(r=>r.forEach((p,i)=>{const[a,b]=proj(p);i?ctx.lineTo(a,b):ctx.moveTo(a,b)}));ctx.closePath();ctx.fill('evenodd');ctx.stroke()});ctx.restore()}
const logo=new Image();logo.crossOrigin='anonymous';logo.src=LOGO_URL;logo.onload=()=>drawCanvas();
function drawCanvas(){
  const c=$('#radarCanvas');if(!c)return;const ctx=c.getContext('2d');
  ctx.clearRect(0,0,1080,1080);ctx.fillStyle='#f4f6f7';ctx.fillRect(0,0,1080,1080);ctx.fillStyle='rgba(245,196,0,.14)';ctx.beginPath();ctx.arc(1010,70,330,0,Math.PI*2);ctx.fill();
  if(logo.complete)try{ctx.drawImage(logo,70,54,95,95)}catch{}
  fitText(ctx,'Central das Eleições UEFY',185,112,500,34,26,'700');
  ctx.fillStyle='#59626b';ctx.font='700 18px Inter,Segoe UI,Arial';ctx.fillText('RADAR LEGISLATIVO · RN',70,190);
  fitText(ctx,officeLabel(),70,255,450,55,36,'800');
  if(publicationView==='map')drawMapCanvas(ctx);else drawMunicipalityCanvas(ctx);
  ctx.strokeStyle='#d3d9de';ctx.beginPath();ctx.moveTo(70,965);ctx.lineTo(1010,965);ctx.stroke();ctx.fillStyle='#58616a';ctx.font='600 18px Inter,Segoe UI,Arial';ctx.fillText('Fonte: Tribunal Superior Eleitoral',70,1005);ctx.textAlign='right';ctx.fillText(radar.source_generated_at||radar.generated_at||'',1010,1035);ctx.textAlign='left';
}
function drawMapCanvas(ctx){
  const summary=mapSummary();
  ctx.fillStyle='#59626b';ctx.font='600 24px Inter,Segoe UI,Arial';
  const selectedSenate=activeOffice()==='sen'?mapSummaryUnfiltered().find(x=>senateCandidateKey(x)===senateCandidateFilter):null;
  ctx.fillText(activeOffice()==='sen'?(selectedSenate?('Municípios vencidos por '+selectedSenate.name):'Quem venceu em cada município'):'Maior votação nominal por município',70,300);
  if(rnMap){const proj=projector(rnMap,630,500,8);ctx.save();ctx.translate(40,345);rnMap.features.forEach(f=>{const name=f.properties?.nome||'',raw=rawMapCandidate(name),lead=mapCandidate(name),fill=lead?candidateColor(lead.number,lead.name):(activeOffice()==='sen'&&raw?'#e5e1d8':'#d9dee2'),g=f.geometry,polys=g.type==='Polygon'?[g.coordinates]:g.type==='MultiPolygon'?g.coordinates:[];ctx.fillStyle=fill;ctx.strokeStyle='#fff';ctx.lineWidth=1.1;polys.forEach(poly=>{ctx.beginPath();poly.forEach(r=>r.forEach((p,i)=>{const[a,b]=proj(p);i?ctx.lineTo(a,b):ctx.moveTo(a,b)}));ctx.closePath();ctx.fill('evenodd');ctx.stroke()})});ctx.restore()}
  let y=385;summary.slice(0,7).forEach(x=>{ctx.fillStyle=candidateColor(x.number,x.name);ctx.beginPath();ctx.arc(760,y-7,9,0,Math.PI*2);ctx.fill();fitText(ctx,candidateLabel(x),785,y,220,20,14,'700');ctx.fillStyle='#59626b';ctx.font='600 16px Inter,Segoe UI,Arial';ctx.fillText(x.municipalities+' município(s)',785,y+24);y+=66});
}

function drawMunicipalityCanvas(ctx){
  ctx.fillStyle='#59626b';ctx.font='600 24px Inter,Segoe UI,Arial';ctx.fillText(selectedMunicipality+' · resultado municipal',70,300);
  const ft=rnMap?.features?.find(f=>f.properties?.nome===selectedMunicipality);
  if(ft)drawGeometry(ctx,ft,{type:'FeatureCollection',features:[ft]},600,135,390,360,'#f5c400','#17191c',2.5);
  let y=420;municipalityResult().slice(0,6).forEach((x,i)=>{ctx.fillStyle='#25292e';fitText(ctx,(i+1)+'º · '+candidateLabel(x),70,y,650,26,18,'700');ctx.fillStyle='#e3e7ea';roundRect(ctx,70,y+18,650,18,9);ctx.fill();ctx.fillStyle=candidateColor(x.number,x.name);roundRect(ctx,70,y+18,650*Math.min(100,x.pct)/100,18,9);ctx.fill();ctx.fillStyle='#17191c';ctx.font='800 30px Inter,Segoe UI,Arial';ctx.textAlign='right';ctx.fillText(pct(x.pct),980,y+5);ctx.textAlign='left';y+=78});
}
function radarPublicationIsSafe(){
  if(radar?.status!=='ok')return false;
  if(publicationView==='municipality')return municipalityResult().length>0;
  const m=officeMapData();
  return Number(m?.municipalities_read||0)>0&&mapSummary().length>0;
}
function updateRadarPublicationSafety(){
  const safe=radarPublicationIsSafe();
  ['#copyRadarText','#copyRadarImage','#openRadarX','#downloadRadar','#shareRadarBundle'].forEach(sel=>{const el=$(sel);if(el)el.disabled=!safe});
}
function updatePublication(){
  const text=currentPublicationText();$('#radarPostText').value=text;$('#radarChars').textContent=text.length+' caracteres';
  $('#publicationContextTitle').textContent=publicationView==='map'?'Mapa legislativo do RN':selectedMunicipality+' · '+officeLabel();
  $('#publicationContextText').textContent=publicationView==='map'?'Card com a liderança municipal do cargo selecionado.':'Card com o resultado local do município selecionado.';
  drawCanvas();updateRadarPublicationSafety();
}

async function canvasBlob(){return await new Promise((res,rej)=>$('#radarCanvas').toBlob(b=>b?res(b):rej(new Error('blob')),'image/png'))}
async function copyImage(){if(!window.isSecureContext||!navigator.clipboard||!window.ClipboardItem)throw new Error('clipboard');const b=await canvasBlob();await navigator.clipboard.write([new ClipboardItem({'image/png':b})])}
async function shareRadar(){
  if(!radarPublicationIsSafe())throw new Error('unsafe publication');
  const png=await canvasBlob(),file=new File([png],'uefy-radar-legislativo-'+activeOffice()+'.png',{type:'image/png'});
  if(navigator.share&&navigator.canShare&&navigator.canShare({files:[file]})){await navigator.share({title:'Central das Eleições UEFY · Radar Legislativo',text:$('#radarPostText').value,files:[file]});return true}
  await copyImage();return false;
}
async function openX(text,w=null){const encoded=encodeURIComponent(text),useIntent=encoded.length<=6000,u=useIntent?'https://twitter.com/intent/tweet?text='+encoded:'https://x.com/compose/post';if(!useIntent)try{await navigator.clipboard.writeText(text)}catch{}if(w){w.opener=null;w.location.href=u}else window.open(u,'_blank','noopener,noreferrer');return useIntent}

$('#officeFilter').onchange=()=>{publicationView='map';senateCandidateFilter='';renderAll()};
$('#senateCandidateFilter').onchange=e=>{
  senateCandidateFilter=e.target.value||'';
  publicationView='map';
  renderAll();
};
$('#refreshRadar').onclick=()=>loadRadar();
document.querySelector('#refreshAll')?.addEventListener('click',async e=>{
  const b=e.currentTarget;b.classList.add('loading');b.disabled=true;
  try{await loadRadar()}
  finally{setTimeout(()=>{b.classList.remove('loading');b.disabled=false},450)}
});
$('#radarMunicipality').onchange=e=>selectMunicipality(e.target.value,false);
$('#radarMapPublish').onclick=()=>{publicationView='map';updatePublication();$('#publicacao')?.scrollIntoView({behavior:'smooth',block:'start'})};
$('#radarMunicipalPublish').onclick=()=>{publicationView='municipality';updatePublication();$('#publicacao')?.scrollIntoView({behavior:'smooth',block:'start'})};
$('#candidateFilter').onchange=renderFindings;$('#typeFilter').onchange=renderFindings;
$$('.text-mode-switch [data-text-mode]').forEach(b=>b.onclick=()=>{publicationTextMode=b.dataset.textMode;$$('.text-mode-switch [data-text-mode]').forEach(x=>x.classList.toggle('active',x===b));updatePublication()});
$('#radarPostText').oninput=e=>$('#radarChars').textContent=e.target.value.length+' caracteres';
$('#copyRadarText').onclick=async()=>{if(!radarPublicationIsSafe())return flash($('#copyRadarText'),'Verificação necessária');try{await navigator.clipboard.writeText($('#radarPostText').value);flash($('#copyRadarText'),'Texto copiado!')}catch{flash($('#copyRadarText'),'Cópia bloqueada')}};
$('#copyRadarImage').onclick=async()=>{if(!radarPublicationIsSafe())return flash($('#copyRadarImage'),'Verificação necessária');try{await copyImage();flash($('#copyRadarImage'),'Imagem copiada!')}catch{flash($('#copyRadarImage'),'Cópia bloqueada')}};
$('#downloadRadar').onclick=()=>{if(!radarPublicationIsSafe())return flash($('#downloadRadar'),'Verificação necessária');const a=document.createElement('a');a.download='uefy-radar-'+activeOffice()+'-'+(publicationView==='map'?'rn':norm(selectedMunicipality))+'.png';a.href=$('#radarCanvas').toDataURL('image/png');a.click()};
$('#openRadarX').onclick=async()=>{if(!radarPublicationIsSafe())return flash($('#openRadarX'),'Verificação necessária');const desktop=window.matchMedia?.('(pointer:fine)').matches&&innerWidth>820,w=desktop?window.open('about:blank','_blank'):null;let copied=false;if(desktop)try{await copyImage();copied=true}catch{}const prefilled=await openX($('#radarPostText').value,w);flash($('#openRadarX'),prefilled?(copied?'Imagem copiada · cole com Ctrl+V':'X aberto'):'Texto copiado · cole no X')};
$('#shareRadarBundle').onclick=async()=>{try{const native=await shareRadar();if(!native)flash($('#shareRadarBundle'),'Imagem copiada · texto acima')}catch(e){if(e?.name!=='AbortError')flash($('#shareRadarBundle'),'Use Copiar texto / Copiar imagem')}};

const theme=$('#themeToggle');if(localStorage.getItem('uefy-eleicoes-theme')==='dark')document.body.classList.add('dark');function syncTheme(){const d=document.body.classList.contains('dark');theme.textContent=d?'☀':'◐';theme.title=d?'Usar tema claro':'Usar tema escuro'}syncTheme();theme.onclick=()=>{document.body.classList.toggle('dark');localStorage.setItem('uefy-eleicoes-theme',document.body.classList.contains('dark')?'dark':'light');syncTheme();drawCanvas()};
const topBtn=$('#toTop');addEventListener('scroll',()=>topBtn?.classList.toggle('show',scrollY>420),{passive:true});if(topBtn)topBtn.onclick=()=>scrollTo({top:0,behavior:'smooth'});
document.querySelectorAll('.mobile-menu a').forEach(a=>a.addEventListener('click',()=>a.closest('details')?.removeAttribute('open')));
radarAutoTimer=setInterval(()=>{if(!document.hidden)loadRadar({silent:true})},60000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)loadRadar({silent:true})});
loadRadar();
