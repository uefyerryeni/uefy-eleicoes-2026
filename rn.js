const $=s=>document.querySelector(s);
const LOGO_URL='https://uefyerryeni.github.io/uefyerryeni-logo.png';
const OFFICE={gov:{title:'Governador',cargo:'0003'}};
let fc=null,selectedFeature=null,office='gov',mode='official',current={progress:0,candidates:[],generatedAt:null};
const LAB_STEPS=[0,8,22,41,63,81,95,100];let labStep=0;
let leaderMapData={status:'waiting',leaders:{},summary:[],publication_ready:false}, mapPublicationMode=false;
let publicationTextMode='full';
const logo=new Image();logo.crossOrigin='anonymous';logo.src=LOGO_URL;logo.onload=()=>drawCanvas();

function norm(s){return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'')}
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
  mapPublicationMode=false;
  selectedFeature=feature;$('#selectedMun').textContent=feature.properties.nome;markSelection();renderFocusMap();
  loadRemote();
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
  const name=norm(feature?.properties?.nome);
  const entries=Object.entries(leaderMapData?.leaders||{});
  const found=entries.find(([k])=>norm(k)===name);
  return found?found[1]:null;
}
async function buildLabLeaderMap(){
  if(!rnCandidateBase)await loadRnCandidates();
  const registry=(rnCandidateBase?.candidates||[]).filter(x=>x.cargo===3);
  const progress=LAB_STEPS[labStep%LAB_STEPS.length],leaders={},counts={};
  fc.features.forEach((f,i)=>{
    if(!registry.length){leaders[f.properties.nome]={status:'no_votes',progress};return}
    const pick=registry[(i+Math.floor(labStep/2))%Math.min(3,registry.length)];
    const pctv=progress?48+((i*7+labStep*3)%19):0;
    leaders[f.properties.nome]=progress?{code:String(f.properties?.codigo||''),status:'ok',progress,candidate_number:String(pick.numero||''),candidate:pick.nome,votes:Math.round(progress*(400+i*11)),pct:pctv}:{status:'no_votes',progress:0};
    if(progress){const k=String(pick.numero||i);counts[k]=counts[k]||{number:k,name:pick.nome,municipalities:0};counts[k].municipalities++}
  });
  const summary=Object.values(counts).sort((a,b)=>b.municipalities-a.municipalities);
  leaderMapData={status:'ok',generated_at:nowStamp(),source_generated_at:'LAB · '+nowStamp(),municipalities_expected:167,municipalities_read:167,publication_ready:true,final_result:progress===100,leaders,summary,natal:leaders['Natal'],message:'Laboratório UEFY · dados fictícios'};
}
async function loadLeaderMap(){
  if(mode==='lab'){await buildLabLeaderMap();renderLeaderMap();return}
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
    const r=await fetch('data/rn-governador-mapa.json?ts='+Date.now(),{cache:'no-store'});
    if(!r.ok)throw new Error('Mapa '+r.status);
    leaderMapData=await r.json();
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
  const proj=projector(fc,760,560,12);
  svg.innerHTML=fc.features.map((f,i)=>{
    const lead=leaderForFeature(f),ok=lead?.status==='ok',color=ok?candidateColor(lead.candidate,lead.candidate_number):'#d9dee2';
    const tip=ok?f.properties.nome+' — '+lead.candidate+' · '+fmtPct(lead.pct):f.properties.nome+' — aguardando votos';
    return '<path class="rn-leader-mun" data-i="'+i+'" d="'+geometryPath(f.geometry,proj)+'" fill="'+color+'"><title>'+esc(tip)+'</title></path>';
  }).join('');
  svg.querySelectorAll('.rn-leader-mun').forEach(el=>el.addEventListener('click',()=>{
    const f=fc.features[Number(el.dataset.i)],lead=leaderForFeature(f);
    selectMunicipality(f);
    if(lead?.status==='ok')setTimeout(()=>{$('#rnStatus').textContent=f.properties.nome+': '+lead.candidate+' está em 1º no recorte municipal do snapshot do mapa.'},0);
    document.querySelector('.rn-side')?.scrollIntoView({behavior:'smooth',block:'start'});
  }));
  renderElectionOutcome();
  const summary=(leaderMapData.summary||[]);
  const emptyMapMessage=mode==='sim'?'Mapa estadual indisponível no Simulado TSE. Use a consulta municipal abaixo.':mode==='lab'?'Atualize o Laboratório para gerar o cenário fictício.':'Aguardando a apuração oficial.';
  $('#rnLeaderSummary').innerHTML=summary.length?summary.map(x=>'<div class="rn-leader-row"><i style="background:'+candidateColor(x.name,x.number)+'"></i><span><strong>'+esc(x.name)+'</strong><small>'+x.municipalities+' município(s)</small></span></div>').join(''):'<div class="rn-map-empty">'+emptyMapMessage+'</div>';
  $('#rnLeaderLegend').innerHTML=summary.length?summary.map(x=>'<span><i style="background:'+candidateColor(x.name,x.number)+'"></i>'+esc(x.name)+'</span>').join(''):'<span><i style="background:#d9dee2"></i>Aguardando resultado</span>';
  const read=Number(leaderMapData.municipalities_read||0),expected=Number(leaderMapData.municipalities_expected||167);
  $('#rnMapRead').textContent=read+'/'+expected;
  $('#rnMapBase').textContent=leaderMapData.source_generated_at||leaderMapData.message||'Aguardando TSE';
  const natal=leaderMapData.natal;
  if(natal?.status==='ok'){
    $('#rnNatalHighlight').innerHTML='<small>Natal</small><strong>'+esc(natal.candidate)+'</strong><span>'+Number(natal.votes||0).toLocaleString('pt-BR')+' votos · '+fmtPct(natal.pct)+' · '+fmtPct(natal.progress)+' das seções</span>';
  }else{
    const natalTitle=mode==='sim'?'Mapa estadual indisponível no Simulado':mode==='lab'?'Aguardando cenário do Laboratório':'Aguardando apuração oficial';
    const natalText=mode==='sim'?'Consulte Natal na área municipal abaixo.':mode==='lab'?'Atualize para avançar o cenário fictício.':'O destaque da capital aparecerá quando houver votos.';
    $('#rnNatalHighlight').innerHTML='<small>Natal</small><strong>'+natalTitle+'</strong><span>'+natalText+'</span>';
  }
  const btn=$('#rnMapPublish'),note=$('#rnMapPublishNote');
  if(btn)btn.disabled=!leaderMapData.publication_ready;
  if(note)note.textContent=leaderMapData.publication_ready?(leaderMapData.final_result?'Base completa e totalização final.':'Base municipal completa. O card será identificado como resultado parcial.'):(leaderMapData.message||'A publicação será liberada quando a base municipal estiver completa e conferida.');
}
function sourceMeta(){
  if(mode==='lab')return {title:'Laboratório UEFY',badge:'LAB · DADOS FICTÍCIOS',municipal:'Laboratório UEFY',help:'Mapa, município e publicação usam dados fictícios claramente identificados como teste.'};
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
  $('#liveLabel').textContent=mode==='lab'?'LAB fictício':mode==='sim'?'Simulado TSE':'TSE oficial';
  document.body.dataset.rnSource=mode;
}
async function changeSource(next){
  mode=next;
  mapPublicationMode=false;
  if(mode==='lab')labStep=0;
  updateSourceUI();
  await loadLeaderMap();
  await loadRemote();
}
function partyByNumber(number){
  const row=(rnCandidateBase?.candidates||[]).find(x=>Number(x.cargo)===3&&String(x.numero)===String(number||''));
  return row?.partido||'';
}
function labeledCandidate(name,party=''){return name+(party?' ('+party+')':'')}
function mapPostText(){
  const final=leaderMapData.final_result;
  const lines=['ELEIÇÕES 2026 | GOVERNADOR DO RN',final?'RESULTADO FINAL':'MAPA PARCIAL — liderança por município',''];
  (leaderMapData.summary||[]).slice(0,6).forEach(x=>lines.push(labeledCandidate(x.name,partyByNumber(x.number))+' — '+x.municipalities+' município(s)'));
  if(leaderMapData.natal?.status==='ok'){
    lines.push('','Natal: '+labeledCandidate(leaderMapData.natal.candidate,partyByNumber(leaderMapData.natal.candidate_number))+' aparece em 1º neste snapshot.');
  }
  if(publicationTextMode==='full'&&!final){
    lines.push('','O mapa representa o snapshot atual da apuração. As lideranças municipais podem mudar conforme novas seções forem totalizadas.');
    lines.push('Base municipal: '+Number(leaderMapData.municipalities_read||0)+'/'+Number(leaderMapData.municipalities_expected||167)+' municípios lidos.');
  }
  if(publicationTextMode==='full'&&leaderMapData.source_generated_at)lines.push('','Atualização: '+leaderMapData.source_generated_at);
  lines.push('','Fonte: Tribunal Superior Eleitoral');
  return lines.join('\n');
}
function drawLeaderMapCanvas(){
  const c=$('#rnCanvas'),ctx=c.getContext('2d');ctx.clearRect(0,0,1080,1080);ctx.fillStyle='#f4f6f7';ctx.fillRect(0,0,1080,1080);
  ctx.fillStyle='rgba(245,196,0,.13)';ctx.beginPath();ctx.arc(1010,80,330,0,Math.PI*2);ctx.fill();
  if(logo.complete)try{ctx.drawImage(logo,70,54,100,100)}catch{}
  fitCanvasText(ctx,'Central das Eleições UEFY',190,112,520,34,27,'700','#17191c');
  const outcome=leaderMapData?.outcome||{};
  const canvasStatus=outcome.kind==='elected'?'ELEITO':outcome.kind==='second_round'?'2º TURNO CONFIRMADO':leaderMapData.final_result?'RESULTADO FINAL':'MAPA PARCIAL';
  ctx.font='700 18px Inter,Segoe UI,Arial';ctx.fillText(canvasStatus,70,190);
  ctx.font='800 56px Inter,Segoe UI,Arial';ctx.fillText('Governador do RN',70,260);
  ctx.fillStyle='#59626b';ctx.font='600 25px Inter,Segoe UI,Arial';ctx.fillText('Quem lidera em cada município',70,305);
  const proj=projector(fc,650,520,8);ctx.save();ctx.translate(40,350);
  fc.features.forEach(f=>{
    const lead=leaderForFeature(f),fill=lead?.status==='ok'?candidateColor(lead.candidate,lead.candidate_number):'#d9dee2';
    const g=f.geometry,polys=g.type==='Polygon'?[g.coordinates]:g.type==='MultiPolygon'?g.coordinates:[];
    ctx.fillStyle=fill;ctx.strokeStyle='#fff';ctx.lineWidth=1.2;
    polys.forEach(poly=>{ctx.beginPath();poly.forEach(ring=>ring.forEach((p,i)=>{const[a,b]=proj(p);i?ctx.lineTo(a,b):ctx.moveTo(a,b)}));ctx.closePath();ctx.fill('evenodd');ctx.stroke()});
  });ctx.restore();
  let yy=405;const sum=(leaderMapData.summary||[]).slice(0,6);
  sum.forEach(x=>{
    ctx.fillStyle=candidateColor(x.name,x.number);ctx.beginPath();ctx.arc(760,yy-8,9,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#17191c';ctx.font='700 22px Inter,Segoe UI,Arial';ctx.fillText((x.name||'').slice(0,20),785,yy);
    ctx.fillStyle='#59626b';ctx.font='600 17px Inter,Segoe UI,Arial';ctx.fillText(x.municipalities+' município(s)',785,yy+25);yy+=68;
  });
  if(leaderMapData.natal?.status==='ok'){
    ctx.fillStyle='#fff';roundRect(ctx,720,825,300,90,14);ctx.fill();ctx.strokeStyle='#d7dce0';ctx.stroke();
    ctx.fillStyle='#6b737b';ctx.font='700 14px Inter,Segoe UI,Arial';ctx.fillText('NATAL',745,855);
    ctx.fillStyle='#17191c';ctx.font='800 22px Inter,Segoe UI,Arial';ctx.fillText((leaderMapData.natal.candidate||'').slice(0,20),745,886);
  }
  ctx.strokeStyle='#d3d9de';ctx.beginPath();ctx.moveTo(70,965);ctx.lineTo(1010,965);ctx.stroke();
  ctx.fillStyle='#58616a';ctx.font='600 18px Inter,Segoe UI,Arial';ctx.fillText('Fonte: Tribunal Superior Eleitoral · '+(leaderMapData.municipalities_read||0)+'/'+(leaderMapData.municipalities_expected||167)+' municípios lidos',70,1005);
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
  return 'https://resultados.tse.jus.br/oficial/ele2026/6257/config/mun-e006257-cm.json';
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
    const cfg=await fetch(municipalConfigUrl(),{cache:'no-store'});if(!cfg.ok)throw new Error('Config '+cfg.status);
    municipalityConfigCache[key]=extractMunicipalities(await cfg.json());
  }
  const all=municipalityConfigCache[key];
  const target=norm(selectedFeature.properties.nome);
  const found=all.find(m=>m.uf==='rn'&&norm(m.name)===target);
  if(!found)throw new Error('Município não encontrado na configuração do TSE');
  return found.code;
}
function resultUrl(code){
  const election=mode==='sim'?'21272':'6259',el=String(election).padStart(6,'0'),base=mode==='sim'?'https://resultados-sim.tse.jus.br/simulado/simulado2026/ele2026':'https://resultados.tse.jus.br/oficial/ele2026';
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
    totalizationStatus:String(cand.st||'')
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
async function loadLabRemote(){
  if(!rnCandidateBase)await loadRnCandidates();
  const registry=(rnCandidateBase?.candidates||[]).filter(x=>x.cargo===3),progress=LAB_STEPS[labStep%LAB_STEPS.length];
  const rows=registry.map((x,i)=>({name:x.nome,number:x.numero,party:x.partido,status:x.situacao,seq:i+1,votes:progress?Math.round(progress*(520-i*63+((labStep+i)%5)*24)):0}));
  if(progress>=41&&rows.length>1){rows[0].votes=Math.round(rows[0].votes*.91);rows[1].votes=Math.round(rows[1].votes*1.15)}
  const total=rows.reduce((s,x)=>s+x.votes,0);rows.forEach(x=>x.pct=total?x.votes/total*100:0);rows.sort((a,b)=>b.votes-a.votes||a.seq-b.seq);
  current={progress,candidates:rows,generatedAt:nowStamp(),lab:true};
  $('#rnStatus').textContent='LABORATÓRIO UEFY · DADOS FICTÍCIOS · cenário '+(labStep+1)+'/'+LAB_STEPS.length+'. Atualize para avançar.';
  await buildLabLeaderMap();renderLeaderMap();renderCurrent();
}
async function loadRemote(){
  if(mode==='lab'){await loadLabRemote();return}
  current={progress:0,candidates:[],generatedAt:null};
  renderCurrent();
  $('#rnRefresh').disabled=true;$('#rnRefresh').textContent='Carregando…';$('#rnStatus').textContent='Localizando o município na configuração do TSE…';
  try{
    const code=await municipalityCode(),r=await fetch(resultUrl(code),{cache:'no-store'});if(!r.ok)throw new Error('Resultado '+r.status);
    current=parseEA20(await r.json());
    if(mode==='official')current=await reconcileRnResult(current);
    if(mode==='sim'){
      $('#rnStatus').textContent='Dados do Simulado TSE para este município. Não representam a apuração oficial.';
    }else if(current.integrity?.unmatched){
      $('#rnStatus').textContent='Atenção: '+current.integrity.unmatched+' registro(s) do resultado oficial não corresponderam à base de candidaturas.';
    }else{
      $('#rnStatus').textContent='EA20 oficial · '+current.integrity.matched+'/'+current.integrity.total+' candidatura(s) conferida(s) com a base oficial.';
    }
    renderCurrent();
  }catch(e){
    const notPublished=mode==='official'&&String(e?.message||e).includes('404');
    $('#rnStatus').textContent=notPublished?'O arquivo oficial deste município ainda não foi publicado pelo TSE.':'Não foi possível carregar este município agora: '+e.message;
  }
  finally{$('#rnRefresh').disabled=false;$('#rnRefresh').textContent='Atualizar'}
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
    $('#rnProgress').textContent=fmtPct(current.progress);
    $('#rnResults').innerHTML=(current.candidates||[]).map(c=>'<div class="rn-result-line"><span>'+esc(c.name)+'</span><span class="bar"><i style="width:'+Math.min(100,c.pct)+'%;background:'+candidateColor(c.name,c.number)+'"></i></span><b>'+fmtPct(c.pct)+'</b></div>').join('');
  }
  const t=makeText();$('#rnPostText').value=t;$('#rnChars').textContent=t.length+' caracteres';drawCanvas();
}
function makeText(){
  if(mapPublicationMode)return mapPostText();
  const name=selectedFeature?.properties?.nome||'Município';
  const source=mode==='demo'?'Base oficial TSE · sem votos':mode==='lab'?'LABORATÓRIO UEFY · DADOS FICTÍCIOS':mode==='sim'?'Fonte: Simulado TSE':'Fonte: Tribunal Superior Eleitoral';
  const lines=['ELEIÇÕES 2026 | GOVERNADOR DO RN',name+' (RN)'];
  if(mode==='demo'){
    lines.push('',current.candidates.length+' candidatura(s) registradas na base eleitoral.');
    current.candidates.slice(0,4).forEach(c=>lines.push(labeledCandidate(c.name,c.party)+(c.number?' · nº '+c.number:'')));
  }else{
    const final=mode==='lab'?current.progress>=100:!!current.finalTotalization;
    lines.push('',(final?'RESULTADO FINAL':'APURAÇÃO PARCIAL')+' · '+fmtPct(current.progress)+' das seções totalizadas','');
    current.candidates.slice(0,4).forEach(c=>lines.push(labeledCandidate(c.name,c.party)+' — '+fmtPct(c.pct)));
    if(publicationTextMode==='full'&&!final&&mode!=='lab'){
      lines.push('','Os percentuais refletem o resultado deste município no momento da atualização e podem mudar até a conclusão da totalização.');
    }
  }
  if(publicationTextMode==='full'&&current.generatedAt)lines.push('','Atualização: '+current.generatedAt);
  lines.push('',source);
  return lines.join('\n');
}
function drawFeature(ctx,feature,x,y,w,h){
  if(!fc||!feature)return;const proj=projector(fc,w,h,5),g=feature.geometry,polys=g.type==='Polygon'?[g.coordinates]:g.type==='MultiPolygon'?g.coordinates:[];
  ctx.save();ctx.translate(x,y);ctx.fillStyle='#17191c';ctx.strokeStyle='#fff';ctx.lineWidth=2;polys.forEach(poly=>{ctx.beginPath();poly.forEach(ring=>ring.forEach((p,i)=>{const[a,b]=proj(p);i?ctx.lineTo(a,b):ctx.moveTo(a,b)}));ctx.closePath();ctx.fill('evenodd');ctx.stroke()});ctx.restore();
}
function drawRN(ctx,x,y,w,h){
  if(!fc)return;const proj=projector(fc,w,h,5);ctx.save();ctx.translate(x,y);fc.features.forEach(f=>{const active=f===selectedFeature,g=f.geometry,polys=g.type==='Polygon'?[g.coordinates]:g.type==='MultiPolygon'?g.coordinates:[];ctx.fillStyle=active?'#17191c':'#f5c400';ctx.strokeStyle='#fff';ctx.lineWidth=1.1;polys.forEach(poly=>{ctx.beginPath();poly.forEach(ring=>ring.forEach((p,i)=>{const[a,b]=proj(p);i?ctx.lineTo(a,b):ctx.moveTo(a,b)}));ctx.closePath();ctx.fill('evenodd');ctx.stroke()})});ctx.restore()}
function roundRect(ctx,x,y,w,h,r){r=Math.min(r,w/2,h/2);ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath()}
function fitCanvasText(ctx,text,x,y,maxWidth,startSize,minSize,weight='700',color='#17191c'){
  let size=startSize;
  while(size>minSize){
    ctx.font=weight+' '+size+'px Inter,Segoe UI,Arial';
    if(ctx.measureText(text).width<=maxWidth)break;
    size-=1;
  }
  ctx.fillStyle=color;ctx.font=weight+' '+size+'px Inter,Segoe UI,Arial';ctx.fillText(text,x,y);
}
function drawFocusedMunicipality(ctx,feature,x,y,w,h){
  if(!feature)return;
  const one={type:'FeatureCollection',features:[feature]},proj=projector(one,w,h,10),g=feature.geometry,polys=g.type==='Polygon'?[g.coordinates]:g.type==='MultiPolygon'?g.coordinates:[];
  ctx.save();ctx.translate(x,y);ctx.fillStyle='#f5c400';ctx.strokeStyle='#17191c';ctx.lineWidth=3;
  polys.forEach(poly=>{ctx.beginPath();poly.forEach(ring=>ring.forEach((p,i)=>{const[a,b]=proj(p);i?ctx.lineTo(a,b):ctx.moveTo(a,b)}));ctx.closePath();ctx.fill('evenodd');ctx.stroke()});ctx.restore();
}
function drawCanvas(){
  if(mapPublicationMode){drawLeaderMapCanvas();return}
  if(!selectedFeature)return;
  const c=$('#rnCanvas'),ctx=c.getContext('2d'),name=selectedFeature.properties.nome;
  ctx.clearRect(0,0,1080,1080);ctx.fillStyle='#f4f6f7';ctx.fillRect(0,0,1080,1080);
  ctx.fillStyle='rgba(245,196,0,.13)';ctx.beginPath();ctx.arc(1010,80,330,0,Math.PI*2);ctx.fill();
  if(logo.complete)try{ctx.drawImage(logo,70,54,100,100)}catch{}
  fitCanvasText(ctx,'Central das Eleições UEFY',190,112,450,34,27,'700','#17191c');
  ctx.font='600 18px Inter,Segoe UI,Arial';ctx.fillText(mode==='lab'?'LAB · DADOS FICTÍCIOS':mode==='sim'?'SIMULADO TSE':current.finalTotalization?'RESULTADO FINAL · TSE':'PARCIAL · TSE',690,105);
  drawFocusedMunicipality(ctx,selectedFeature,555,115,470,350);
  ctx.fillStyle='#17191c';ctx.font='700 76px Inter,Segoe UI,Arial';ctx.fillText('Eleições 2026',70,235);
  fitCanvasText(ctx,OFFICE[office].title,70,300,440,44,32,'700','#17191c');
  fitCanvasText(ctx,name+' · RN',70,344,440,32,23,'600','#4d555d');

  if(mode==='demo'){
    ctx.fillStyle='#58616a';ctx.font='600 24px Inter,Segoe UI,Arial';ctx.fillText('Candidaturas na base oficial',70,470);
    ctx.fillStyle='#17191c';ctx.font='800 60px Inter,Segoe UI,Arial';ctx.fillText(String(current.candidates.length),70,535);
    let yy=625;
    current.candidates.slice(0,4).forEach(cand=>{
      ctx.fillStyle='#25292e';ctx.font='700 29px Inter,Segoe UI,Arial';
      ctx.fillText(cand.name.length>27?cand.name.slice(0,26)+'…':cand.name,70,yy);
      const meta=[cand.number,cand.party].filter(Boolean).join(' · ');
      ctx.fillStyle='#667079';ctx.font='600 20px Inter,Segoe UI,Arial';ctx.fillText(meta,70,yy+31);
      yy+=82;
    });
  }else{
    ctx.fillStyle='#58616a';ctx.font='600 24px Inter,Segoe UI,Arial';ctx.fillText('Seções totalizadas',70,470);
    ctx.fillStyle='#17191c';ctx.font='800 60px Inter,Segoe UI,Arial';ctx.fillText(fmtPct(current.progress),70,535);
    ctx.fillStyle='#e0e5e9';roundRect(ctx,285,492,690,22,11);ctx.fill();
    ctx.fillStyle='#f5c400';roundRect(ctx,285,492,690*Math.min(100,current.progress)/100,22,11);ctx.fill();
    let yy=620;
    current.candidates.slice(0,4).forEach((cand,i)=>{
      ctx.fillStyle='#25292e';ctx.font='700 29px Inter,Segoe UI,Arial';
      ctx.fillText(cand.name.length>27?cand.name.slice(0,26)+'…':cand.name,70,yy);
      ctx.fillStyle='#e3e7ea';roundRect(ctx,70,yy+23,700,21,11);ctx.fill();
      ctx.fillStyle=candidateColor(cand.name,cand.number);roundRect(ctx,70,yy+23,700*Math.min(100,cand.pct)/100,21,11);ctx.fill();
      ctx.fillStyle='#17191c';ctx.font='800 33px Inter,Segoe UI,Arial';ctx.textAlign='right';ctx.fillText(fmtPct(cand.pct),980,yy+6);ctx.textAlign='left';
      yy+=82;
    });
  }

  ctx.strokeStyle='#d3d9de';ctx.beginPath();ctx.moveTo(70,965);ctx.lineTo(1010,965);ctx.stroke();
  ctx.fillStyle='#58616a';ctx.font='600 20px Inter,Segoe UI,Arial';
  ctx.fillText(mode==='lab'?'LABORATÓRIO UEFY · NÃO É RESULTADO ELEITORAL':mode==='demo'?'Base de candidaturas: Tribunal Superior Eleitoral':'Fonte: Tribunal Superior Eleitoral',70,1008);
  ctx.textAlign='right';ctx.fillText(current.generatedAt||nowStamp(),1010,1008);ctx.textAlign='left';
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
async function shareRNImageAndText(openX=false,preopened=null){
  const text=$('#rnPostText').value,name=selectedFeature?.properties?.nome||'rn';
  let blob;
  try{blob=await rnCanvasBlob()}catch{if(preopened)preopened.close();flashRN(openX?$('#rnOpenX'):$('#rnShareBundle'),'Falha ao gerar imagem');return}
  const desktop=window.matchMedia?.('(pointer:fine)').matches&&window.innerWidth>820;
  let shareBlob=blob;
  if(!desktop){
    try{shareBlob=await rnShareJpegBlob()}catch{}
  }
  const file=new File([shareBlob],`uefy-eleicoes-rn-${norm(name)}.${shareBlob.type==='image/jpeg'?'jpg':'png'}`,{type:shareBlob.type||'image/png'});

  if(openX&&desktop){
    let copied=false;
    try{
      if(window.isSecureContext&&navigator.clipboard&&window.ClipboardItem){
        await navigator.clipboard.write([new ClipboardItem({'image/png':blob})]);
        copied=true;
      }
    }catch{}
    const prefilled=await openRnXIntent(text,preopened);
    flashRN($('#rnOpenX'),prefilled?(copied?'Imagem copiada · cole com Ctrl+V':'X aberto · use “Copiar imagem”'):'Texto copiado · cole no X');
    return;
  }

  if(!openX){
    try{
      if(navigator.share&&navigator.canShare&&navigator.canShare({files:[file]})){
        await navigator.share({title:'UEFY Eleições · Rio Grande do Norte',text,files:[file]});
        if(preopened)preopened.close();
        return;
      }
    }catch(err){if(err?.name==='AbortError'){if(preopened)preopened.close();return}}
    try{
      await copyRnImage();
      flashRN($('#rnShareBundle'),'Imagem copiada · texto acima');
    }catch{
      flashRN($('#rnShareBundle'),'Use Copiar texto / Copiar imagem');
    }
    if(preopened)preopened.close();
    return;
  }

  const prefilled=await openRnXIntent(text,preopened);
  flashRN($('#rnOpenX'),prefilled?'X aberto com o texto':'Texto copiado · cole no X');
}
$('#rnMapPublish')?.addEventListener('click',()=>{
  if(!leaderMapData.publication_ready)return;
  mapPublicationMode=true;
  $('#rnPostText').value=mapPostText();
  $('#rnChars').textContent=$('#rnPostText').value.length+' caracteres';
  drawCanvas();
  $('#rnResultTitle').textContent='Mapa de liderança municipal';
  $('#rnProgress').textContent=leaderMapData.final_result?'Final':'Parcial';
  $('#rnStatus').textContent=leaderMapData.final_result?'Mapa final com base municipal completa.':'Mapa parcial com base municipal completa no snapshot; as lideranças podem mudar até 100% da totalização.';
  document.querySelector('#publicacao')?.scrollIntoView({behavior:'smooth',block:'start'});
});
$('#munSearch').oninput=e=>renderList(e.target.value);

$('#rnMode').value=mode;
updateSourceUI();
$('#rnMode').onchange=e=>changeSource(e.target.value);
$('#rnRefresh').onclick=async()=>{if(mode==='lab')labStep=(labStep+1)%LAB_STEPS.length;updateSourceUI();await loadLeaderMap();await loadRemote()};
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
$('#rnCopyText').onclick=async()=>{try{await navigator.clipboard.writeText($('#rnPostText').value);flashRN($('#rnCopyText'),'Texto copiado!')}catch{flashRN($('#rnCopyText'),'Cópia bloqueada')}};
$('#rnCopyImage').onclick=async()=>{try{await copyRnImage();flashRN($('#rnCopyImage'),'Imagem copiada!')}catch{flashRN($('#rnCopyImage'),'Cópia bloqueada')}};
$('#rnDownload').onclick=()=>{const a=document.createElement('a');a.download='uefy-eleicoes-rn-'+norm(selectedFeature.properties.nome)+'.png';a.href=$('#rnCanvas').toDataURL('image/png');a.click()};
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
document.querySelector('#refreshAll')?.addEventListener('click',async e=>{const b=e.currentTarget;b.classList.add('loading');b.disabled=true;try{if(mode==='lab')labStep=(labStep+1)%LAB_STEPS.length;await loadRemote();renderFavStrip()}finally{setTimeout(()=>{b.classList.remove('loading');b.disabled=false},450)}});
renderFavStrip();
const _uefyInitFav=setInterval(()=>{if(fc&&selectedFeature){clearInterval(_uefyInitFav);const q=new URLSearchParams(location.search),m=q.get('fav');if(m){const ft=fc.features.find(x=>norm(x.properties.nome)===norm(m));if(ft)selectMunicipality(ft)}syncFavButton();renderFavStrip()}},100);
