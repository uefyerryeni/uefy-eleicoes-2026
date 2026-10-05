const $=s=>document.querySelector(s);
const LOGO_URL='https://uefyerryeni.github.io/uefyerryeni-logo.png';
let DATA=null,FC=null,pairFilter='',metric='abstention_pct',rankingDirection='desc';
let logo=null;window.__analysisReady=false;window.__analysisError=null;

function fmtNum(v){return Number(v||0).toLocaleString('pt-BR')}
function fmtPct(v,d=2){return Number(v||0).toLocaleString('pt-BR',{minimumFractionDigits:d,maximumFractionDigits:d})+'%'}
function esc(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#039;'}[m]))}
function norm(s){return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'')}
const MUNICIPALITY_ALIASES={acu:'assu',ares:'arez',januariocicco:'boasaude'};
function municipalityKey(name){const n=norm(name);return MUNICIPALITY_ALIASES[n]||n}
function pairKey(p,g){return String(p?.number||'')+'|'+String(g?.number||'')}
function pairLabel(x){return (x?.president?.name||'—')+' × '+(x?.governor?.name||'—')}
function personText(x){return x?(x.name+(x.party?' ('+x.party+')':'')):'—'}
function personHtml(x){return x?esc(x.name)+(x.party?' <small>'+esc(x.party)+'</small>'):'—'}
function nowStamp(){return new Date().toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'})}

function coordsOfGeometry(g,out=[]){if(!g)return out;if(g.type==='Polygon')g.coordinates.forEach(r=>r.forEach(p=>out.push(p)));else if(g.type==='MultiPolygon')g.coordinates.forEach(poly=>poly.forEach(r=>r.forEach(p=>out.push(p))));return out}
function boundsOf(collection){const pts=[];collection.features.forEach(f=>coordsOfGeometry(f.geometry,pts));let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;pts.forEach(([x,y])=>{minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y)});return{minX,minY,maxX,maxY}}
function projector(collection,w,h,pad=12){const b=boundsOf(collection),sx=(w-pad*2)/(b.maxX-b.minX),sy=(h-pad*2)/(b.maxY-b.minY),s=Math.min(sx,sy),ox=(w-(b.maxX-b.minX)*s)/2,oy=(h-(b.maxY-b.minY)*s)/2;return([x,y])=>[ox+(x-b.minX)*s,h-(oy+(y-b.minY)*s)]}
function ringPath(ring,proj){return ring.map((p,i)=>{const[x,y]=proj(p);return(i?'L':'M')+x.toFixed(2)+' '+y.toFixed(2)}).join(' ')+' Z'}
function geometryPath(g,proj){if(g.type==='Polygon')return g.coordinates.map(r=>ringPath(r,proj)).join(' ');if(g.type==='MultiPolygon')return g.coordinates.flatMap(poly=>poly.map(r=>ringPath(r,proj))).join(' ');return''}
function featureName(f){return f?.properties?.nome||f?.properties?.name||''}
function rowForFeature(f){const key=municipalityKey(featureName(f));return (DATA.cross?.municipalities||[]).find(r=>municipalityKey(r.name)===key)}
function pairRows(){return DATA.cross?.pairs||[]}
function selectedPair(){return pairRows().find(x=>pairKey(x.president,x.governor)===pairFilter)||null}
const PAIR_COLORS=['#d62828','#1976d2','#2e7d32','#ef8f00','#7b61a8','#00897b','#a33d5b','#5c6f7b'];
function pairColor(x){const rows=pairRows(),idx=Math.max(0,rows.findIndex(p=>pairKey(p.president,p.governor)===pairKey(x?.president,x?.governor)));return PAIR_COLORS[idx%PAIR_COLORS.length]}

const METRICS={
  'abstention_pct':{label:'Abstenção',title:'Abstenção por município',field:['participation','abstention_pct'],state:['pres','abstention_pct'],noun:'abstenção'},
  'turnout_pct':{label:'Comparecimento',title:'Comparecimento por município',field:['participation','turnout_pct'],state:['pres','turnout_pct'],noun:'comparecimento'},
  'president.blank_pct':{label:'Brancos · Presidente',title:'Votos brancos para Presidente',field:['participation','president','blank_pct'],state:['pres','blank_pct'],noun:'votos brancos para Presidente'},
  'president.null_pct':{label:'Nulos · Presidente',title:'Votos nulos para Presidente',field:['participation','president','null_pct'],state:['pres','null_pct'],noun:'votos nulos para Presidente'},
  'governor.blank_pct':{label:'Brancos · Governador',title:'Votos brancos para Governador',field:['participation','governor','blank_pct'],state:['gov','blank_pct'],noun:'votos brancos para Governador'},
  'governor.null_pct':{label:'Nulos · Governador',title:'Votos nulos para Governador',field:['participation','governor','null_pct'],state:['gov','null_pct'],noun:'votos nulos para Governador'}
};
function getPath(obj,path){return path.reduce((a,k)=>a?.[k],obj)}
function metricValue(row,key=metric){return Number(getPath(row,METRICS[key].field)||0)}
function metricRows(key=metric){return (DATA.cross?.municipalities||[]).filter(r=>metricValue(r,key)>0)}
function extent(values){return [Math.min(...values),Math.max(...values)]}
function lerp(a,b,t){return Math.round(a+(b-a)*t)}
function metricColor(v,min,max){const t=max<=min?0.5:Math.max(0,Math.min(1,(v-min)/(max-min)));const a=[244,221,25],b=[31,35,38];return 'rgb('+lerp(a[0],b[0],t)+','+lerp(a[1],b[1],t)+','+lerp(a[2],b[2],t)+')'}

function loadLogo(){
  try{
    logo=new Image();
    logo.crossOrigin='anonymous';
    logo.onload=()=>{if(DATA&&FC){drawCrossCanvas();drawParticipationCanvas()}};
    logo.onerror=()=>{};
    logo.src=LOGO_URL;
  }catch{logo=null}
}
function bindInterface(){
  applySavedTheme();
  $('#themeToggle')?.addEventListener('click',toggleTheme);
  $('#toTop')?.addEventListener('click',()=>scrollTo({top:0,behavior:'smooth'}));
  addEventListener('scroll',()=>$('#toTop')?.classList.toggle('show',scrollY>500));
  $('#crossSearch')?.addEventListener('input',e=>renderCrossTable(e.target.value));
  $('#pairFilter')?.addEventListener('change',e=>{pairFilter=e.target.value;renderCrossMap();renderPairList();renderCrossPublication()});
  $('#metricSelect')?.addEventListener('change',e=>{metric=e.target.value;renderParticipationMap();renderParticipationRanking();renderParticipationPublication()});
  $('#rankingDirection')?.addEventListener('change',e=>{rankingDirection=e.target.value;renderParticipationRanking();renderParticipationPublication()});
  bindPublishers();
}
async function init(){
  window.__analysisReady=false;
  window.__analysisError=null;
  try{
    const [dr,mr]=await Promise.all([
      fetch('./data/rn-analises.json?ts='+Date.now(),{cache:'no-store'}),
      fetch('./assets/maps/rn-municipios.geojson?ts='+Date.now(),{cache:'no-store'})
    ]);
    if(!dr.ok)throw new Error('Base de análises: HTTP '+dr.status);
    if(!mr.ok)throw new Error('Mapa do RN: HTTP '+mr.status);
    const data=await dr.json();
    const map=await mr.json();
    if(data?.status!=='ok')throw new Error(data?.message||'Base de análises ainda indisponível');
    if(!Array.isArray(map?.features)||map.features.length!==167)throw new Error('GeoJSON do RN incompleto: '+(map?.features?.length||0)+'/167 municípios');
    if(Number(data?.municipalities_read||0)!==167)throw new Error('Base municipal incompleta: '+Number(data?.municipalities_read||0)+'/167 municípios');
    if((data?.errors||[]).length)throw new Error('A base municipal contém '+data.errors.length+' erro(s) de leitura');
    DATA=data;FC=map;
    window.ANALYSIS_DATA=DATA;
    window.ANALYSIS_MAP=FC;
    bindInterface();
    renderAll();
    loadLogo();
    document.body.dataset.analysisReady='true';
    window.__analysisReady=true;
  }catch(e){
    const message=e?.message||String(e);
    window.__analysisError=message;
    document.body.dataset.analysisReady='error';
    const coverage=$('#coverage');
    if(coverage)coverage.textContent='Falha ao carregar a análise: '+message;
    document.querySelectorAll('.analysis-publisher button').forEach(b=>b.disabled=true);
  }
}
function applySavedTheme(){if(localStorage.getItem('uefy-theme')==='dark')document.body.classList.add('dark')}
function toggleTheme(){document.body.classList.toggle('dark');localStorage.setItem('uefy-theme',document.body.classList.contains('dark')?'dark':'light')}

function renderAll(){
  $('#sourceStamp').textContent=DATA.source_generated_at||new Date(DATA.generated_at).toLocaleString('pt-BR');
  $('#coverage').textContent=(DATA.municipalities_read||0)+'/'+(DATA.municipalities_expected||167)+' municípios lidos · sem lacunas na base municipal';
  $('#methodCross').textContent=DATA.methodology?.cross_note||'';
  $('#methodParticipation').textContent=DATA.methodology?.participation_note||'';
  $('#methodSource').textContent=DATA.methodology?.source||'Tribunal Superior Eleitoral';
  renderCross();renderParticipation();
}
function renderCross(){
  const rows=DATA.cross?.municipalities||[],pairs=pairRows();
  const pres=new Set(rows.map(x=>x.president?.name).filter(Boolean)),gov=new Set(rows.map(x=>x.governor?.name).filter(Boolean));
  $('#crossKpis').innerHTML=[
    ['Municípios cruzados',fmtNum(rows.length),'de '+(DATA.municipalities_expected||167)],
    ['Combinações territoriais',fmtNum(pairs.length),'padrões diferentes'],
    ['Líderes presidenciais',fmtNum(pres.size),'em ao menos um município'],
    ['Líderes para governo',fmtNum(gov.size),'em ao menos um município']
  ].map(x=>'<article class="analysis-kpi"><span>'+x[0]+'</span><strong>'+x[1]+'</strong><small>'+x[2]+'</small></article>').join('');
  $('#pairFilter').innerHTML='<option value="">Todas as combinações</option>'+pairs.map(x=>'<option value="'+pairKey(x.president,x.governor)+'">'+esc(pairLabel(x))+' · '+x.municipalities+'</option>').join('');
  renderCrossMap();renderPairList();renderCrossTable('');renderCrossPublication();
}
function renderPairList(){
  $('#pairList').innerHTML=pairRows().map((x,i)=>{
    const key=pairKey(x.president,x.governor),active=key===pairFilter;
    return '<button class="pair-row'+(active?' active':'')+'" data-pair="'+key+'" type="button"><i style="background:'+pairColor(x)+'"></i><span><strong>'+personHtml(x.president)+' <b>×</b> '+personHtml(x.governor)+'</strong><em>'+x.municipalities+' município(s)</em><small>'+x.names.slice(0,7).map(esc).join(', ')+(x.names.length>7?'…':'')+'</small></span><b>Ver</b></button>';
  }).join('');
  $('#pairList').querySelectorAll('[data-pair]').forEach(btn=>btn.addEventListener('click',()=>{pairFilter=btn.dataset.pair;$('#pairFilter').value=pairFilter;renderCrossMap();renderPairList();renderCrossPublication();$('#crossMap').scrollIntoView({behavior:'smooth',block:'center'})}));
}
function renderCrossMap(){
  const svg=$('#crossMap'),proj=projector(FC,760,560,12),sel=selectedPair();
  svg.innerHTML=FC.features.map(f=>{
    const row=rowForFeature(f),key=row?pairKey(row.president,row.governor):'',pair=pairRows().find(p=>pairKey(p.president,p.governor)===key);
    const active=!pairFilter||key===pairFilter,fill=!row?'#d9dee2':active?pairColor(pair):'#e4e7e9';
    const tip=row?row.name+' — '+personText(row.president)+' × '+personText(row.governor):featureName(f)+' — sem dados';
    return '<path class="analysis-mun'+(active?'':' muted')+'" d="'+geometryPath(f.geometry,proj)+'" fill="'+fill+'"><title>'+esc(tip)+'</title></path>';
  }).join('');
  $('#crossLegend').innerHTML=pairRows().map(x=>'<button type="button" data-pair="'+pairKey(x.president,x.governor)+'" class="'+(pairKey(x.president,x.governor)===pairFilter?'active':'')+'"><i style="background:'+pairColor(x)+'"></i><span>'+esc(pairLabel(x))+'</span><b>'+x.municipalities+'</b></button>').join('');
  $('#crossLegend').querySelectorAll('[data-pair]').forEach(btn=>btn.addEventListener('click',()=>{const key=btn.dataset.pair;pairFilter=pairFilter===key?'':key;$('#pairFilter').value=pairFilter;renderCrossMap();renderPairList();renderCrossPublication()}));
  $('#crossMapCaption').textContent=sel?pairLabel(sel)+' aparece em '+sel.municipalities+' município(s).':'O mapa reúne '+pairRows().length+' combinações de liderança encontradas nos '+(DATA.municipalities_read||167)+' municípios.';
}
function renderCrossTable(q=''){
  const n=norm(q),rows=(DATA.cross?.municipalities||[]).filter(x=>norm(x.name).includes(n));
  $('#crossTable').innerHTML=rows.map(x=>'<tr><th>'+esc(x.name)+'</th><td>'+personHtml(x.president)+'<span>'+fmtPct(x.president?.pct||0)+'</span></td><td>'+personHtml(x.governor)+'<span>'+fmtPct(x.governor?.pct||0)+'</span></td></tr>').join('');
}

function renderParticipation(){
  const p=DATA.participation?.state_2026?.pres||{},g=DATA.participation?.state_2026?.gov||{};
  $('#participationKpis').innerHTML=[
    ['Comparecimento',fmtPct(p.turnout_pct),fmtNum(p.turnout)+' eleitores'],
    ['Abstenção',fmtPct(p.abstention_pct),fmtNum(p.abstention)+' eleitores'],
    ['Brancos · Presidente',fmtPct(p.blank_pct),fmtNum(p.blank)+' votos'],
    ['Nulos · Presidente',fmtPct(p.null_pct),fmtNum(p.null)+' votos'],
    ['Brancos · Governador',fmtPct(g.blank_pct),fmtNum(g.blank)+' votos'],
    ['Nulos · Governador',fmtPct(g.null_pct),fmtNum(g.null)+' votos']
  ].map(x=>'<article class="analysis-kpi"><span>'+x[0]+'</span><strong>'+x[1]+'</strong><small>'+x[2]+'</small></article>').join('');
  renderParticipationMap();renderParticipationRanking();renderHistory();renderParticipationPublication();
}
function renderParticipationMap(){
  const rows=metricRows(),values=rows.map(r=>metricValue(r)),[min,max]=extent(values),proj=projector(FC,760,560,12),meta=METRICS[metric];
  $('#participationMapTitle').textContent=meta.title;
  $('#participationMap').innerHTML=FC.features.map(f=>{
    const row=rowForFeature(f),v=row?metricValue(row):0,fill=v>0?metricColor(v,min,max):'#d9dee2';
    return '<path class="analysis-mun" d="'+geometryPath(f.geometry,proj)+'" fill="'+fill+'"><title>'+esc(featureName(f))+' — '+(v?fmtPct(v):'sem dado')+'</title></path>';
  }).join('');
  const steps=5;let scale='';for(let i=0;i<steps;i++){const v=min+(max-min)*(i/(steps-1));scale+='<span><i style="background:'+metricColor(v,min,max)+'"></i>'+fmtPct(v,1)+'</span>'}
  $('#participationScale').innerHTML=scale;
  const state=getPath(DATA.participation?.state_2026||{},meta.state);
  $('#participationCaption').textContent='No estado, '+meta.label.toLowerCase()+': '+fmtPct(state||0)+'. Entre os municípios, o indicador varia de '+fmtPct(min)+' a '+fmtPct(max)+'.';
}
function sortedMetricRows(){
  return metricRows().slice().sort((a,b)=>rankingDirection==='asc'?metricValue(a)-metricValue(b):metricValue(b)-metricValue(a));
}
function renderParticipationRanking(){
  const rows=sortedMetricRows().slice(0,10),meta=METRICS[metric];
  $('#rankingTitle').textContent=(rankingDirection==='asc'?'Menores':'Maiores')+' percentuais de '+meta.label.toLowerCase();
  $('#rankingList').innerHTML=rows.map((x,i)=>'<div class="ranking-row"><b>'+(i+1)+'</b><span><strong>'+esc(x.name)+'</strong><small>'+meta.label+'</small></span><em>'+fmtPct(metricValue(x))+'</em></div>').join('');
}
function renderHistory(){
  const p22=DATA.participation?.state_2022?.pres||{},g22=DATA.participation?.state_2022?.gov||{};
  if(p22.error||g22.error){
    $('#historyCompare').innerHTML='<div class="analysis-history-note"><strong>2022 ainda não integrado</strong><p>A Central não converte ausência de histórico em zero. O comparativo será liberado quando a base oficial de 2022 for importada e conferida.</p></div>';
    return;
  }
  $('#historyCompare').innerHTML='<div class="analysis-history-note"><strong>Histórico disponível</strong><p>A base de 2022 foi carregada. O comparador completo será ativado nesta área.</p></div>';
}

function crossPostText(){
  const sel=selectedPair(),lines=['ELEIÇÕES 2026 | RIO GRANDE DO NORTE','PRESIDENTE × GOVERNADOR',''];
  if(sel){
    lines.push(personText(sel.president)+' × '+personText(sel.governor),'liderou simultaneamente em '+sel.municipalities+' município(s) do RN.','');
    lines.push('Municípios: '+sel.names.join(', ')+'.');
  }else{
    pairRows().forEach(x=>lines.push(pairLabel(x)+' — '+x.municipalities+' município(s)'));
  }
  lines.push('','O cruzamento é territorial e usa resultados agregados por município. Não indica que os mesmos eleitores fizeram as duas escolhas.','','Fonte: Tribunal Superior Eleitoral');
  return lines.join('\n');
}
function participationPostText(){
  const meta=METRICS[metric],state=getPath(DATA.participation?.state_2026||{},meta.state),top=metricRows().slice().sort((a,b)=>metricValue(b)-metricValue(a)).slice(0,5);
  const lines=['ELEIÇÕES 2026 | RIO GRANDE DO NORTE',meta.label.toUpperCase(),'',
    'No estado: '+fmtPct(state||0)+'.','',
    'Maiores percentuais municipais:'];
  top.forEach((x,i)=>lines.push((i+1)+'. '+x.name+' — '+fmtPct(metricValue(x))));
  lines.push('','O mapa mostra a distribuição municipal do indicador.','','Fonte: Tribunal Superior Eleitoral');
  return lines.join('\n');
}
function renderCrossPublication(){
  const sel=selectedPair();$('#crossPubMode').textContent=sel?pairLabel(sel)+' · '+sel.municipalities+' municípios':'Mapa completo do RN';
  const text=crossPostText();$('#crossPostText').value=text;$('#crossChars').textContent=text.length+' caracteres';drawCrossCanvas();
}
function renderParticipationPublication(){
  const meta=METRICS[metric];$('#participationPubTitle').textContent=meta.label+' no RN';
  const text=participationPostText();$('#participationPostText').value=text;$('#participationChars').textContent=text.length+' caracteres';drawParticipationCanvas();
}
function canvasBase(ctx,kicker,title,subtitle){
  ctx.clearRect(0,0,1080,1080);ctx.fillStyle='#f5f6f4';ctx.fillRect(0,0,1080,1080);
  ctx.fillStyle='rgba(244,221,25,.18)';ctx.beginPath();ctx.arc(1020,55,300,0,Math.PI*2);ctx.fill();
  if(logo&&logo.complete&&logo.naturalWidth)try{ctx.drawImage(logo,64,52,92,92)}catch{}
  ctx.fillStyle='#17191c';ctx.font='700 27px Inter,Segoe UI,Arial';ctx.fillText('Central das Eleições UEFY',180,106);
  ctx.fillStyle='#606970';ctx.font='800 18px Inter,Segoe UI,Arial';ctx.fillText(kicker.toUpperCase(),64,190);
  ctx.fillStyle='#17191c';ctx.font='800 50px Inter,Segoe UI,Arial';fitText(ctx,title,64,255,930,50,35);
  ctx.fillStyle='#606970';ctx.font='600 24px Inter,Segoe UI,Arial';fitText(ctx,subtitle,64,298,930,24,18);
}
function fitText(ctx,text,x,y,maxWidth,start,min){let s=start;while(s>min){ctx.font=ctx.font.replace(/\d+px/,s+'px');if(ctx.measureText(text).width<=maxWidth)break;s--}ctx.fillText(text,x,y)}
function drawMapCanvas(ctx,colorFn,x,y,w,h){
  const proj=projector(FC,w,h,8);ctx.save();ctx.translate(x,y);
  FC.features.forEach(f=>{const g=f.geometry,polys=g.type==='Polygon'?[g.coordinates]:g.type==='MultiPolygon'?g.coordinates:[];ctx.fillStyle=colorFn(f);ctx.strokeStyle='#fff';ctx.lineWidth=1.2;polys.forEach(poly=>{ctx.beginPath();poly.forEach(ring=>ring.forEach((p,i)=>{const[a,b]=proj(p);i?ctx.lineTo(a,b):ctx.moveTo(a,b)}));ctx.closePath();ctx.fill('evenodd');ctx.stroke()})});ctx.restore();
}
function drawCrossCanvas(){
  if(!DATA||!FC)return;const c=$('#crossCanvas'),ctx=c.getContext('2d'),sel=selectedPair();
  canvasBase(ctx,'Análises RN','Presidente × Governador',sel?pairLabel(sel):'Combinações de liderança por município');
  drawMapCanvas(ctx,f=>{const row=rowForFeature(f),key=row?pairKey(row.president,row.governor):'',p=pairRows().find(x=>pairKey(x.president,x.governor)===key);if(!row)return'#d9dee2';if(pairFilter&&key!==pairFilter)return'#e2e5e7';return pairColor(p)},52,340,650,500);
  let yy=390;const list=(sel?[sel]:pairRows()).slice(0,6);list.forEach(x=>{ctx.fillStyle=pairColor(x);ctx.fillRect(750,yy-17,16,16);ctx.fillStyle='#17191c';ctx.font='800 18px Inter,Segoe UI,Arial';fitText(ctx,pairLabel(x),780,yy,255,18,13);ctx.fillStyle='#606970';ctx.font='700 16px Inter,Segoe UI,Arial';ctx.fillText(x.municipalities+' município(s)',780,yy+27);yy+=74});
  ctx.strokeStyle='#d4d9dc';ctx.beginPath();ctx.moveTo(64,965);ctx.lineTo(1016,965);ctx.stroke();ctx.fillStyle='#596168';ctx.font='600 17px Inter,Segoe UI,Arial';ctx.fillText('Fonte: Tribunal Superior Eleitoral · '+(DATA.municipalities_read||167)+' municípios',64,1002);ctx.textAlign='right';ctx.fillText(DATA.source_generated_at||nowStamp(),1016,1032);ctx.textAlign='left';
}
function drawParticipationCanvas(){
  if(!DATA||!FC)return;const c=$('#participationCanvas'),ctx=c.getContext('2d'),meta=METRICS[metric],rows=metricRows(),values=rows.map(r=>metricValue(r)),[min,max]=extent(values),state=getPath(DATA.participation?.state_2026||{},meta.state);
  canvasBase(ctx,'Análises RN',meta.label+' no RN','Distribuição municipal · '+fmtPct(state||0)+' no estado');
  drawMapCanvas(ctx,f=>{const row=rowForFeature(f),v=row?metricValue(row):0;return v?metricColor(v,min,max):'#d9dee2'},52,340,650,500);
  ctx.fillStyle='#17191c';ctx.font='800 20px Inter,Segoe UI,Arial';ctx.fillText('Maiores percentuais',750,385);
  let yy=430;rows.slice().sort((a,b)=>metricValue(b)-metricValue(a)).slice(0,6).forEach((x,i)=>{ctx.fillStyle='#17191c';ctx.font='800 18px Inter,Segoe UI,Arial';ctx.fillText((i+1)+'. '+x.name.slice(0,20),750,yy);ctx.fillStyle='#606970';ctx.font='700 17px Inter,Segoe UI,Arial';ctx.fillText(fmtPct(metricValue(x)),750,yy+25);yy+=67});
  ctx.strokeStyle='#d4d9dc';ctx.beginPath();ctx.moveTo(64,965);ctx.lineTo(1016,965);ctx.stroke();ctx.fillStyle='#596168';ctx.font='600 17px Inter,Segoe UI,Arial';ctx.fillText('Fonte: Tribunal Superior Eleitoral · '+(DATA.municipalities_read||167)+' municípios',64,1002);ctx.textAlign='right';ctx.fillText(DATA.source_generated_at||nowStamp(),1016,1032);ctx.textAlign='left';
}
function bindPublishers(){
  bindPublisher('cross','crossCanvas','crossPostText','cruzamento-presidente-governador-rn');
  bindPublisher('participation','participationCanvas','participationPostText','participacao-eleitoral-rn');
}
function bindPublisher(prefix,canvasId,textId,file){
  $('#'+prefix+'CopyText')?.addEventListener('click',()=>copyText($('#'+textId).value,$('#'+prefix+'CopyText')));
  $('#'+prefix+'CopyImage')?.addEventListener('click',()=>copyCanvas($('#'+canvasId),$('#'+prefix+'CopyImage')));
  $('#'+prefix+'Download')?.addEventListener('click',()=>downloadCanvas($('#'+canvasId),file));
  $('#'+prefix+'OpenX')?.addEventListener('click',async()=>{await copyCanvas($('#'+canvasId),null);const t=$('#'+textId).value;if(t.length<1600)open('https://twitter.com/intent/tweet?text='+encodeURIComponent(t),'_blank','noopener');else{await navigator.clipboard.writeText(t);open('https://x.com/compose/post','_blank','noopener')}});
  $('#'+prefix+'Share')?.addEventListener('click',()=>shareBundle($('#'+canvasId),$('#'+textId).value,file));
}
async function copyText(text,btn){try{await navigator.clipboard.writeText(text);flash(btn,'Copiado')}catch{}}
async function copyCanvas(canvas,btn){try{const blob=await new Promise(r=>canvas.toBlob(r,'image/png'));await navigator.clipboard.write([new ClipboardItem({'image/png':blob})]);flash(btn,'Imagem copiada');return true}catch{return false}}
function downloadCanvas(canvas,name){const a=document.createElement('a');a.href=canvas.toDataURL('image/png');a.download=name+'.png';a.click()}
async function shareBundle(canvas,text,name){const blob=await new Promise(r=>canvas.toBlob(r,'image/png')),file=new File([blob],name+'.png',{type:'image/png'});if(navigator.share&&navigator.canShare?.({files:[file]})){try{await navigator.share({text,files:[file]});return}catch{}}await copyText(text,null);downloadCanvas(canvas,name)}
function flash(btn,label){if(!btn)return;const old=btn.textContent;btn.textContent=label;setTimeout(()=>btn.textContent=old,1300)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
