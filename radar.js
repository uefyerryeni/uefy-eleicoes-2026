const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const DATA_URL='data/radar-rn.json';
const CANDIDATE_URL='data/candidatos-ufs-c.json';
const MAP_URL='assets/maps/rn-municipios.geojson';
const LOGO_URL='https://uefyerryeni.github.io/uefyerryeni-logo.png';
const OFFICE_LABELS={sen:'Senador',depf:'Deputado federal',depe:'Deputado estadual'};
const OFFICE_CARGO={sen:5,depf:6,depe:7};
const TYPE_LABELS={territorial_coverage:'Presença municipal',capital_share:'Natal x interior',top_municipalities:'Concentração territorial',municipal_leads:'Primeiro lugar nos municípios'};
const LAB_STEPS=[8,22,41,63,81,95,100];
const COLOR_PALETTE=['#d62828','#1976d2','#2e7d32','#7b2cbf','#ef6c00','#00897b','#c2185b','#6d4c41','#455a64','#5c6bc0','#ad1457','#558b2f','#00838f','#6a1b9a','#f57c00','#3949ab'];

let radar={status:'loading',findings:[],offices:{},municipal_maps:{}};
let candidateRegistry=[],rnMap=null,radarMode='official',labStep=0,publicationTextMode='full';
let selectedMunicipality='Natal',publicationView='map';

const pct=v=>Number(v||0).toLocaleString('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:2})+'%';
const int=v=>Number(v||0).toLocaleString('pt-BR');
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
function flash(btn,text){if(!btn)return;const old=btn.textContent;btn.textContent=text;setTimeout(()=>btn.textContent=old,1800)}
function setStatus(msg,error=false){const el=$('#radarStatus');if(!el)return;el.hidden=!msg;el.textContent=msg||'';el.classList.toggle('error',error)}
function activeOffice(){return $('#officeFilter')?.value||'sen'}
function officeLabel(){return OFFICE_LABELS[activeOffice()]||'Legislativo'}
function registryForOffice(office=activeOffice()){return candidateRegistry.filter(x=>Number(x.cargo)===OFFICE_CARGO[office]).sort((a,b)=>String(a.nome).localeCompare(String(b.nome),'pt-BR'))}
function candidateMeta(number,name=''){
  const row=registryForOffice().find(x=>String(x.numero)===String(number))||candidateRegistry.find(x=>String(x.nome)===String(name));
  return {party:row?.partido||'',number:row?.numero||String(number||''),name:row?.nome||name};
}
function candidateLabel(row){
  const meta=candidateMeta(row?.number,row?.name);
  return (row?.name||meta.name||'Candidatura')+(row?.party||meta.party?' ('+(row?.party||meta.party)+')':'');
}
function candidateColor(number,name=''){
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
  return officeMapData().results?.[name]||[];
}
function municipalityLeader(name=selectedMunicipality){
  return officeMapData().leaders?.[name]||null;
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

function buildLabRadar(){
  const progress=LAB_STEPS[labStep%LAB_STEPS.length],maps={},findings=[];
  const names=municipalityNames();
  Object.keys(OFFICE_LABELS).forEach((office,oi)=>{
    const regs=registryForOffice(office),leaders={},results={},counts=new Map();
    names.forEach((mun,mi)=>{
      const ranked=regs.map((c,ci)=>{
        const seed=((mi+3)*97+(ci+5)*43+(labStep+1)*71+(oi+1)*29)%997;
        const votes=progress?Math.max(0,Math.round((1200+seed*9)*(progress/100)*(1/(1+ci*.045)))):0;
        return {id:String(c.seq||c.numero||ci),number:String(c.numero||''),name:c.nome,party:c.partido||'',votes};
      }).filter(x=>x.votes>0).sort((a,b)=>b.votes-a.votes);
      const total=ranked.reduce((s,x)=>s+x.votes,0);ranked.forEach(x=>x.pct=total?x.votes/total*100:0);
      const top=ranked[0];if(!top)return;
      leaders[mun]=top;results[mun]=ranked.slice(0,8);
      const k=top.number||top.name;if(!counts.has(k))counts.set(k,{number:top.number,name:top.name,party:top.party,municipalities:0});counts.get(k).municipalities++;
    });
    const summary=[...counts.values()].sort((a,b)=>b.municipalities-a.municipalities||a.name.localeCompare(b.name,'pt-BR'));
    maps[office]={leaders,results,summary,municipalities_read:names.length};
    const regsForFind=regs;
    regsForFind.forEach((c,i)=>{
      const coverage=Math.min(167,Math.round((progress/100)*167*(.72+((i+oi)%4)*.07)));
      const natal=12+((i*9+labStep*4+oi*5)%47),top3=28+((i*7+labStep*3)%39);
      const leads=summary.find(x=>x.number===String(c.numero))?.municipalities||0;
      findings.push({id:'lab-'+office+'-'+i+'-cov',office,type:'territorial_coverage',candidate:c.nome,display_value:coverage+'/167',headline:c.nome+' registra votos em '+coverage+' municípios no cenário de teste.',summary:'Indicador fictício de presença municipal.',explanation:'Indicador fictício de presença municipal para validar o Radar.',calculation:'Municípios com votos fictícios ÷ 167 municípios do RN.',breakdown:[{label:'Municípios com votos',value:String(coverage)},{label:'Total do RN',value:'167'}]});
      findings.push({id:'lab-'+office+'-'+i+'-nat',office,type:'capital_share',candidate:c.nome,display_value:pct(natal),headline:pct(natal)+' da votação fictícia de '+c.nome+' está em Natal.',summary:'Comparação fictícia entre capital e interior.',explanation:'Comparação fictícia entre capital e interior.',calculation:'Votos fictícios em Natal ÷ votos fictícios totais.',breakdown:[{label:'Natal',value:pct(natal)},{label:'Interior',value:pct(100-natal)}]});
      findings.push({id:'lab-'+office+'-'+i+'-top',office,type:'top_municipalities',candidate:c.nome,display_value:pct(top3),headline:'Os três maiores municípios concentram '+pct(top3)+' da votação fictícia de '+c.nome+'.',summary:'Concentração territorial fictícia.',explanation:'Concentração territorial fictícia.',calculation:'Top 3 ÷ total fictício.',breakdown:[]});
      findings.push({id:'lab-'+office+'-'+i+'-lead',office,type:'municipal_leads',candidate:c.nome,display_value:String(leads),headline:c.nome+' aparece em primeiro em '+leads+' municípios no cenário fictício.',summary:'Contagem simulada de lideranças municipais.',explanation:'Contagem simulada de lideranças municipais.',calculation:'Municípios em que a candidatura ocupa o 1º lugar.',breakdown:[]});
    });
  });
  radar={status:'ok',generated_at:new Date().toLocaleString('pt-BR'),source_generated_at:'LAB · cenário '+(labStep+1)+'/'+LAB_STEPS.length,source_name:'Laboratório UEFY · dados fictícios',progress,scope:'Rio Grande do Norte',municipalities:167,request_errors:0,municipal_maps:maps,findings,offices:Object.fromEntries(Object.keys(OFFICE_LABELS).map(o=>[o,{label:OFFICE_LABELS[o],progress}]))};
}

async function loadRadar(){
  setStatus(radarMode==='lab'?'Montando cenário fictício do Radar Legislativo…':'Carregando a leitura oficial do Radar Legislativo…');
  try{
    const [radarRes,candRes,mapRes]=await Promise.all([
      fetch(DATA_URL+'?ts='+Date.now(),{cache:'no-store'}),
      fetch(CANDIDATE_URL+'?ts='+Date.now(),{cache:'no-store'}),
      fetch(MAP_URL,{cache:'no-store'})
    ]);
    if(!radarRes.ok||!mapRes.ok)throw new Error('Base indisponível');
    radar=await radarRes.json();rnMap=await mapRes.json();
    if(candRes.ok){const base=await candRes.json();candidateRegistry=Array.isArray(base?.rn?.candidates)?base.rn.candidates:[]}else candidateRegistry=[];
    if(radarMode==='lab')buildLabRadar();
    renderAll();
  }catch(e){
    setStatus('Não foi possível carregar o Radar Legislativo agora. Tente atualizar a página.',true);
    radar={status:'error',findings:[],offices:{},municipal_maps:{}};renderAll();
  }
}

function renderAll(){
  $('#radarOfficeTitle').textContent=officeLabel();
  $('#radarSummaryOffice').textContent=officeLabel();
  $('#radarMunicipalOffice').textContent=officeLabel();
  $('#radarMapTitle').textContent='Quem lidera para '+officeLabel()+' em cada município';
  $('#radarSourceBadge').textContent=radarMode==='lab'?'LAB · DADOS FICTÍCIOS':'OFICIAL TSE';
  $('#radarSourceBadge').dataset.mode=radarMode;
  $('#sourceGenerated').textContent=radar.source_generated_at||radar.generated_at||'Aguardando resultados';
  const prog=radar?.offices?.[activeOffice()]?.progress??radar.progress??0;
  $('#sourceMeta').textContent=(radar.source_name||'Tribunal Superior Eleitoral')+' · '+pct(prog)+' das seções';
  $('#radarLive').textContent=radarMode==='lab'?'LAB fictício':(radar.status==='ok'?'TSE oficial':'Aguardando apuração');
  populateMunicipalities();
  renderMap();
  renderMunicipality();
  buildAnalysisFilters();
  renderFindings();
  updatePublication();
  const m=officeMapData();
  if(radarMode==='lab')setStatus('LABORATÓRIO UEFY · DADOS FICTÍCIOS · cenário '+(labStep+1)+'/'+LAB_STEPS.length+'.',false);
  else if(!m.municipalities_read)setStatus('Aguardando a primeira leitura municipal do Radar Legislativo. O mapa será preenchido automaticamente quando houver votos oficiais.',false);
  else setStatus('');
}

function populateMunicipalities(){
  const sel=$('#radarMunicipality'),names=municipalityNames();if(!sel)return;
  if(!names.includes(selectedMunicipality))selectedMunicipality=names.find(x=>norm(x)==='natal')||names[0]||'Natal';
  sel.innerHTML=names.map(n=>'<option value="'+esc(n)+'">'+esc(n)+'</option>').join('');sel.value=selectedMunicipality;
}

function renderMap(){
  const svg=$('#radarLegMap');if(!svg||!rnMap)return;
  const proj=projector(rnMap,650,520,8),m=officeMapData();
  svg.innerHTML=rnMap.features.map(f=>{
    const name=f.properties?.nome||'',lead=m.leaders?.[name],fill=lead?candidateColor(lead.number,lead.name):'#d9dee2',active=name===selectedMunicipality;
    return '<path class="radar-map-feature'+(active?' selected':'')+'" data-mun="'+esc(name)+'" d="'+geometryPath(f.geometry,proj)+'" fill="'+fill+'"><title>'+esc(name+(lead?' · '+lead.name+' · '+pct(lead.pct):' · aguardando votos'))+'</title></path>';
  }).join('');
  $$('.radar-map-feature').forEach(el=>el.addEventListener('click',()=>selectMunicipality(el.dataset.mun,true)));

  const summary=m.summary||[];
  $('#radarLeaderSummary').innerHTML=summary.length?summary.slice(0,10).map(x=>'<div class="rn-leader-row"><i style="background:'+candidateColor(x.number,x.name)+'"></i><span><strong>'+esc(candidateLabel(x))+'</strong><small>'+x.municipalities+' município(s)</small></span></div>').join(''):'<div class="rn-map-empty">Aguardando votos oficiais.</div>';
  const leader=municipalityLeader();
  $('#radarSelectedHighlight').innerHTML='<small>Município selecionado</small><strong>'+esc(selectedMunicipality)+'</strong><span>'+(leader?esc(candidateLabel(leader))+' lidera com '+pct(leader.pct):'Aguardando votos para este cargo.')+'</span>';
  $('#radarMapCoverage').textContent=Number(m.municipalities_read||0)+'/167 municípios lidos';
  const prog=radar?.offices?.[activeOffice()]?.progress??radar.progress??0;
  $('#radarMapProgress').textContent=prog?pct(prog)+' das seções totalizadas':'Aguardando apuração oficial';
  $('#radarMapPublish').disabled=!summary.length;
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
  const m=officeMapData(),summary=m.summary||[],prog=radar?.offices?.[activeOffice()]?.progress??radar.progress??0;
  if(publicationTextMode==='compact'){
    const lines=['ELEIÇÕES 2026 | '+officeLabel().toUpperCase()+' · RN','MAPA DE LIDERANÇA MUNICIPAL'];
    summary.slice(0,3).forEach(x=>lines.push(candidateLabel(x)+' — '+x.municipalities+' município(s)'));
    lines.push('','Fonte: Tribunal Superior Eleitoral');return lines.join('\n');
  }
  const lines=['ELEIÇÕES 2026 | '+officeLabel().toUpperCase()+' · RN','MAPA DE LIDERANÇA MUNICIPAL',''];
  summary.slice(0,8).forEach(x=>lines.push(candidateLabel(x)+' — '+x.municipalities+' município(s)'));
  const natal=m.leaders?.Natal||m.leaders?.NATAL;if(natal)lines.push('','Natal: '+candidateLabel(natal)+' lidera com '+pct(natal.pct)+'.');
  lines.push('','Base municipal: '+Number(m.municipalities_read||0)+'/167 municípios lidos.');
  if(prog<100)lines.push('Apuração parcial: as lideranças podem mudar com novas seções.');
  if(radar.source_generated_at||radar.generated_at)lines.push('Atualização: '+(radar.source_generated_at||radar.generated_at));
  lines.push('Fonte: Tribunal Superior Eleitoral');return lines.join('\n');
}
function municipalPublicationText(){
  const rows=municipalityResult(),prog=radar?.offices?.[activeOffice()]?.progress??radar.progress??0;
  if(publicationTextMode==='compact'){
    const lines=['ELEIÇÕES 2026 | '+officeLabel().toUpperCase(),selectedMunicipality+' (RN)',prog>=100?'RESULTADO FINAL':'PARCIAL · '+pct(prog)];
    rows.slice(0,2).forEach(x=>lines.push(candidateLabel(x)+' — '+pct(x.pct)));
    lines.push('','Fonte: Tribunal Superior Eleitoral');return lines.join('\n');
  }
  const lines=['ELEIÇÕES 2026 | '+officeLabel().toUpperCase(),selectedMunicipality+' (RN)',prog>=100?'RESULTADO FINAL':'APURAÇÃO PARCIAL · '+pct(prog)+' das seções',''];
  rows.slice(0,5).forEach(x=>lines.push(candidateLabel(x)+' — '+pct(x.pct)+' · '+int(x.votes)+' votos'));
  if(rows[0]&&rows[1])lines.push('','No município, '+candidateLabel(rows[0])+' aparece em 1º, com diferença de '+pct(rows[0].pct-rows[1].pct)+' para '+candidateLabel(rows[1])+'.');
  if(prog<100)lines.push('O resultado pode mudar até o encerramento da totalização.');
  if(radar.source_generated_at||radar.generated_at)lines.push('Atualização: '+(radar.source_generated_at||radar.generated_at));
  lines.push('Fonte: Tribunal Superior Eleitoral');return lines.join('\n');
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
  ctx.strokeStyle='#d3d9de';ctx.beginPath();ctx.moveTo(70,965);ctx.lineTo(1010,965);ctx.stroke();ctx.fillStyle='#58616a';ctx.font='600 18px Inter,Segoe UI,Arial';ctx.fillText(radarMode==='lab'?'LABORATÓRIO UEFY · DADOS FICTÍCIOS':'Fonte: Tribunal Superior Eleitoral',70,1005);ctx.textAlign='right';ctx.fillText(radar.source_generated_at||radar.generated_at||'',1010,1035);ctx.textAlign='left';
}
function drawMapCanvas(ctx){
  const m=officeMapData();ctx.fillStyle='#59626b';ctx.font='600 24px Inter,Segoe UI,Arial';ctx.fillText('Quem lidera em cada município',70,300);
  if(rnMap){const proj=projector(rnMap,630,500,8);ctx.save();ctx.translate(40,345);rnMap.features.forEach(f=>{const name=f.properties?.nome||'',lead=m.leaders?.[name],fill=lead?candidateColor(lead.number,lead.name):'#d9dee2',g=f.geometry,polys=g.type==='Polygon'?[g.coordinates]:g.type==='MultiPolygon'?g.coordinates:[];ctx.fillStyle=fill;ctx.strokeStyle='#fff';ctx.lineWidth=1.1;polys.forEach(poly=>{ctx.beginPath();poly.forEach(r=>r.forEach((p,i)=>{const[a,b]=proj(p);i?ctx.lineTo(a,b):ctx.moveTo(a,b)}));ctx.closePath();ctx.fill('evenodd');ctx.stroke()})});ctx.restore()}
  let y=385;(m.summary||[]).slice(0,7).forEach(x=>{ctx.fillStyle=candidateColor(x.number,x.name);ctx.beginPath();ctx.arc(760,y-7,9,0,Math.PI*2);ctx.fill();fitText(ctx,candidateLabel(x),785,y,220,20,14,'700');ctx.fillStyle='#59626b';ctx.font='600 16px Inter,Segoe UI,Arial';ctx.fillText(x.municipalities+' município(s)',785,y+24);y+=66});
}
function drawMunicipalityCanvas(ctx){
  ctx.fillStyle='#59626b';ctx.font='600 24px Inter,Segoe UI,Arial';ctx.fillText(selectedMunicipality+' · resultado municipal',70,300);
  const ft=rnMap?.features?.find(f=>f.properties?.nome===selectedMunicipality);
  if(ft)drawGeometry(ctx,ft,{type:'FeatureCollection',features:[ft]},600,135,390,360,'#f5c400','#17191c',2.5);
  let y=420;municipalityResult().slice(0,6).forEach((x,i)=>{ctx.fillStyle='#25292e';fitText(ctx,(i+1)+'º · '+candidateLabel(x),70,y,650,26,18,'700');ctx.fillStyle='#e3e7ea';roundRect(ctx,70,y+18,650,18,9);ctx.fill();ctx.fillStyle=candidateColor(x.number,x.name);roundRect(ctx,70,y+18,650*Math.min(100,x.pct)/100,18,9);ctx.fill();ctx.fillStyle='#17191c';ctx.font='800 30px Inter,Segoe UI,Arial';ctx.textAlign='right';ctx.fillText(pct(x.pct),980,y+5);ctx.textAlign='left';y+=78});
}
function updatePublication(){
  const text=currentPublicationText();$('#radarPostText').value=text;$('#radarChars').textContent=text.length+' caracteres';
  $('#publicationContextTitle').textContent=publicationView==='map'?'Mapa legislativo do RN':selectedMunicipality+' · '+officeLabel();
  $('#publicationContextText').textContent=publicationView==='map'?'Card com a liderança municipal do cargo selecionado.':'Card com o resultado local do município selecionado.';
  drawCanvas();
}

async function canvasBlob(){return await new Promise((res,rej)=>$('#radarCanvas').toBlob(b=>b?res(b):rej(new Error('blob')),'image/png'))}
async function copyImage(){if(!window.isSecureContext||!navigator.clipboard||!window.ClipboardItem)throw new Error('clipboard');const b=await canvasBlob();await navigator.clipboard.write([new ClipboardItem({'image/png':b})])}
async function shareRadar(){
  const png=await canvasBlob(),file=new File([png],'uefy-radar-legislativo-'+activeOffice()+'.png',{type:'image/png'});
  if(navigator.share&&navigator.canShare&&navigator.canShare({files:[file]})){await navigator.share({title:'Central das Eleições UEFY · Radar Legislativo',text:$('#radarPostText').value,files:[file]});return true}
  await copyImage();return false;
}
async function openX(text,w=null){const encoded=encodeURIComponent(text),useIntent=encoded.length<=6000,u=useIntent?'https://twitter.com/intent/tweet?text='+encoded:'https://x.com/compose/post';if(!useIntent)try{await navigator.clipboard.writeText(text)}catch{}if(w){w.opener=null;w.location.href=u}else window.open(u,'_blank','noopener,noreferrer');return useIntent}

$('#officeFilter').onchange=()=>{publicationView='map';renderAll()};
$('#radarMode').onchange=e=>{radarMode=e.target.value;labStep=0;publicationView='map';loadRadar()};
$('#refreshRadar').onclick=()=>{if(radarMode==='lab')labStep=(labStep+1)%LAB_STEPS.length;loadRadar()};
document.querySelector('#refreshAll')?.addEventListener('click',async e=>{
  const b=e.currentTarget;b.classList.add('loading');b.disabled=true;
  try{if(radarMode==='lab')labStep=(labStep+1)%LAB_STEPS.length;await loadRadar()}
  finally{setTimeout(()=>{b.classList.remove('loading');b.disabled=false},450)}
});
$('#radarMunicipality').onchange=e=>selectMunicipality(e.target.value,false);
$('#radarMapPublish').onclick=()=>{publicationView='map';updatePublication();$('#publicacao')?.scrollIntoView({behavior:'smooth',block:'start'})};
$('#radarMunicipalPublish').onclick=()=>{publicationView='municipality';updatePublication();$('#publicacao')?.scrollIntoView({behavior:'smooth',block:'start'})};
$('#candidateFilter').onchange=renderFindings;$('#typeFilter').onchange=renderFindings;
$$('.text-mode-switch [data-text-mode]').forEach(b=>b.onclick=()=>{publicationTextMode=b.dataset.textMode;$$('.text-mode-switch [data-text-mode]').forEach(x=>x.classList.toggle('active',x===b));updatePublication()});
$('#radarPostText').oninput=e=>$('#radarChars').textContent=e.target.value.length+' caracteres';
$('#copyRadarText').onclick=async()=>{try{await navigator.clipboard.writeText($('#radarPostText').value);flash($('#copyRadarText'),'Texto copiado!')}catch{flash($('#copyRadarText'),'Cópia bloqueada')}};
$('#copyRadarImage').onclick=async()=>{try{await copyImage();flash($('#copyRadarImage'),'Imagem copiada!')}catch{flash($('#copyRadarImage'),'Cópia bloqueada')}};
$('#downloadRadar').onclick=()=>{const a=document.createElement('a');a.download='uefy-radar-'+activeOffice()+'-'+(publicationView==='map'?'rn':norm(selectedMunicipality))+'.png';a.href=$('#radarCanvas').toDataURL('image/png');a.click()};
$('#openRadarX').onclick=async()=>{const desktop=window.matchMedia?.('(pointer:fine)').matches&&innerWidth>820,w=desktop?window.open('about:blank','_blank'):null;let copied=false;if(desktop)try{await copyImage();copied=true}catch{}const prefilled=await openX($('#radarPostText').value,w);flash($('#openRadarX'),prefilled?(copied?'Imagem copiada · cole com Ctrl+V':'X aberto'):'Texto copiado · cole no X')};
$('#shareRadarBundle').onclick=async()=>{try{const native=await shareRadar();if(!native)flash($('#shareRadarBundle'),'Imagem copiada · texto acima')}catch(e){if(e?.name!=='AbortError')flash($('#shareRadarBundle'),'Use Copiar texto / Copiar imagem')}};

const theme=$('#themeToggle');if(localStorage.getItem('uefy-eleicoes-theme')==='dark')document.body.classList.add('dark');function syncTheme(){const d=document.body.classList.contains('dark');theme.textContent=d?'☀':'◐';theme.title=d?'Usar tema claro':'Usar tema escuro'}syncTheme();theme.onclick=()=>{document.body.classList.toggle('dark');localStorage.setItem('uefy-eleicoes-theme',document.body.classList.contains('dark')?'dark':'light');syncTheme();drawCanvas()};
const topBtn=$('#toTop');addEventListener('scroll',()=>topBtn?.classList.toggle('show',scrollY>420),{passive:true});if(topBtn)topBtn.onclick=()=>scrollTo({top:0,behavior:'smooth'});
document.querySelectorAll('.mobile-menu a').forEach(a=>a.addEventListener('click',()=>a.closest('details')?.removeAttribute('open')));
loadRadar();
