const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const LOGO_URL='https://uefyerryeni.github.io/uefyerryeni-logo.png';
const MODES=['demo','sim','official'], MODE_LABELS={demo:'demonstração',sim:'simulado TSE',official:'oficial TSE'};
const REGION_STATES={
  reg_norte:['ac','ap','am','pa','ro','rr','to'],
  reg_nordeste:['al','ba','ce','ma','pb','pe','pi','rn','se'],
  reg_centrooeste:['df','go','mt','ms'],
  reg_sudeste:['es','mg','rj','sp'],
  reg_sul:['pr','rs','sc']
};
const STATES=[['ac','Acre'],['al','Alagoas'],['ap','Amapá'],['am','Amazonas'],['ba','Bahia'],['ce','Ceará'],['df','Distrito Federal'],['es','Espírito Santo'],['go','Goiás'],['ma','Maranhão'],['mt','Mato Grosso'],['ms','Mato Grosso do Sul'],['mg','Minas Gerais'],['pa','Pará'],['pb','Paraíba'],['pr','Paraná'],['pe','Pernambuco'],['pi','Piauí'],['rj','Rio de Janeiro'],['rn','Rio Grande do Norte'],['rs','Rio Grande do Sul'],['ro','Rondônia'],['rr','Roraima'],['sc','Santa Catarina'],['sp','São Paulo'],['se','Sergipe'],['to','Tocantins']].map(([code,label])=>({value:'uf_'+code,label,code}));
const REGIONS=[{value:'br',label:'Brasil'},{value:'reg_norte',label:'Região Norte'},{value:'reg_nordeste',label:'Região Nordeste'},{value:'reg_centrooeste',label:'Região Centro-Oeste'},{value:'reg_sudeste',label:'Região Sudeste'},{value:'reg_sul',label:'Região Sul'}];
const officeMeta={
  pres:{title:'Presidência',defaultScope:'br',scopes:[...REGIONS,...STATES],cargo:'0001',election:'federal'},
  gov:{title:'Governador',defaultScope:'uf_rn',scopes:[...STATES],cargo:'0003',election:'state'},
  sen:{title:'Senado',defaultScope:'uf_rn',scopes:[STATES.find(s=>s.code==='rn')],cargo:'0005',election:'state'},
  depf:{title:'Deputado federal',defaultScope:'uf_rn',scopes:[STATES.find(s=>s.code==='rn')],cargo:'0006',election:'state'},
  depe:{title:'Deputado estadual',defaultScope:'uf_rn',scopes:[STATES.find(s=>s.code==='rn')],cargo:'0007',election:'state'}
};
const DEMO_BASE={pres:[],gov:[],sen:[],depf:[],depe:[]};
const DEMO_PROGRESS=[0,6.4,22.7,51.3,82.6,100];
let mode='demo',demoStep=0,selectedOffice='pres',selectedScope='br',maps={br:null,rn:null};
let state={pres:{progress:0,candidates:[]},gov:{progress:0,candidates:[]},sen:{progress:0,candidates:[]},depf:{progress:0,candidates:[]},depe:{progress:0,candidates:[]}};

function fmtPct(v){return Number(v||0).toLocaleString('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:2})+'%'}
function nowStamp(){return new Date().toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'})}
function esc(s){return String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}
function scopeLabel(v=selectedScope){return (officeMeta[selectedOffice].scopes.find(s=>s.value===v)||{}).label||'Brasil'}
function scopeCode(v=selectedScope){return v.startsWith('uf_')?v.slice(3):null}
function featureCollectionForScope(){
  if(!maps.br)return null;
  if(selectedOffice!=='pres' && selectedScope==='uf_rn' && maps.rn)return maps.rn;
  if(selectedScope==='br')return maps.br;
  if(selectedScope.startsWith('reg_')){
    const wanted=new Set((REGION_STATES[selectedScope]||[]).map(x=>x.toUpperCase()));
    return {type:'FeatureCollection',features:maps.br.features.filter(f=>wanted.has(String(f.properties?.sigla||'').toUpperCase()))};
  }
  if(selectedScope.startsWith('uf_')){
    const uf=selectedScope.slice(3).toUpperCase();
    return {type:'FeatureCollection',features:maps.br.features.filter(f=>String(f.properties?.sigla||'').toUpperCase()===uf)};
  }
  return maps.br;
}
function scopeMapSubtitle(){
  if(selectedScope==='br')return 'Unidades da Federação';
  if(selectedScope.startsWith('reg_'))return 'Estados da região';
  if(selectedOffice!=='pres' && selectedScope==='uf_rn')return 'Municípios do RN';
  return 'Recorte estadual';
}
function updateScopeMap(){
  const fc=featureCollectionForScope();
  const svg=$('#scopeMap');
  if(svg&&fc&&fc.features?.length)renderGeoJSON(svg,fc);
  const title=$('#scopeMapTitle'),sub=$('#scopeMapSubtitle');
  if(title)title.textContent=scopeLabel();
  if(sub)sub.textContent=scopeMapSubtitle();
}

async function loadMaps(){
  const [br,rn]=await Promise.all([fetch('assets/maps/br-estados.geojson').then(r=>r.json()),fetch('assets/maps/rn-municipios.geojson').then(r=>r.json())]);
  maps={br,rn};updateScopeMap();renderGeoJSON($('#rnMap'),rn);drawCanvas();
}
function coordsOfGeometry(g,out=[]){if(!g)return out;if(g.type==='Polygon')g.coordinates.forEach(r=>r.forEach(p=>out.push(p)));else if(g.type==='MultiPolygon')g.coordinates.forEach(poly=>poly.forEach(r=>r.forEach(p=>out.push(p))));return out}
function boundsOf(fc){const pts=[];fc.features.forEach(f=>coordsOfGeometry(f.geometry,pts));let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;pts.forEach(([x,y])=>{minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y)});return{minX,minY,maxX,maxY}}
function projector(fc,w,h,pad=12){const b=boundsOf(fc),sx=(w-pad*2)/(b.maxX-b.minX),sy=(h-pad*2)/(b.maxY-b.minY),s=Math.min(sx,sy),ox=(w-(b.maxX-b.minX)*s)/2,oy=(h-(b.maxY-b.minY)*s)/2;return([x,y])=>[ox+(x-b.minX)*s,h-(oy+(y-b.minY)*s)]}
function ringPath(ring,proj){return ring.map((p,i)=>{const[x,y]=proj(p);return(i?'L':'M')+x.toFixed(2)+' '+y.toFixed(2)}).join(' ')+' Z'}
function geometryPath(g,proj){if(g.type==='Polygon')return g.coordinates.map(r=>ringPath(r,proj)).join(' ');if(g.type==='MultiPolygon')return g.coordinates.flatMap(poly=>poly.map(r=>ringPath(r,proj))).join(' ');return''}
function renderGeoJSON(svg,fc){const proj=projector(fc,420,300,10);svg.innerHTML=fc.features.map(f=>'<path class="map-feature" d="'+geometryPath(f.geometry,proj)+'"></path>').join('')}
function drawGeoJSON(ctx,fc,x,y,w,h){if(!fc)return;const proj=projector(fc,w,h,5);ctx.save();ctx.translate(x,y);ctx.fillStyle='#f5c400';ctx.strokeStyle='#fff';ctx.lineWidth=1.4;fc.features.forEach(f=>{const g=f.geometry,polys=g.type==='Polygon'?[g.coordinates]:g.type==='MultiPolygon'?g.coordinates:[];polys.forEach(poly=>{ctx.beginPath();poly.forEach(ring=>ring.forEach((p,i)=>{const[px,py]=proj(p);i?ctx.lineTo(px,py):ctx.moveTo(px,py)}));ctx.closePath();ctx.fill('evenodd');ctx.stroke()})});ctx.restore()}

function flattenCandidates(data){
  const out=[];(data.carg||[]).forEach(c=>(c.agr||[]).forEach(a=>(a.par||[]).forEach(p=>(p.cand||[]).forEach(cand=>out.push({
    id:String(cand.n||cand.nsqcand||cand.nm||cand.nmu||''),
    name:cand.nmu||cand.nm||('Candidato '+(cand.n||'')),
    pct:Number(String(cand.pvap??0).replace(',','.'))||0,
    votes:Number(cand.vap||0),
    seq:Number(cand.seq||999999)
  })))));
  return out.sort((a,b)=>a.seq-b.seq);
}
function parseEA20(data){
  const progress=data.s&&data.s.pst!=null?Number(String(data.s.pst).replace(',','.')):(data.s&&data.s.ts?Number(data.s.st||0)/Number(data.s.ts)*100:0);
  return {progress:isFinite(progress)?progress:0,candidates:flattenCandidates(data),generatedAt:[data.dg,data.hg].filter(Boolean).join(' · ')||nowStamp(),sectionsTotal:Number(data.s?.ts||0),sectionsDone:Number(data.s?.st||0)};
}
function endpointFor(office,uf,env=mode){
  const meta=officeMeta[office],base=env==='sim'?'https://resultados-sim.tse.jus.br/simulado/simulado2026/ele2026':'https://resultados.tse.jus.br/oficial/ele2026';
  const election=meta.election==='federal'?(env==='sim'?'21270':'6257'):(env==='sim'?'21272':'6259');
  const el=String(election).padStart(6,'0');
  return base+'/'+election+'/dados/'+uf+'/'+uf+'-c'+meta.cargo+'-e'+el+'-u.json';
}
function aggregateResults(parts){
  const byId=new Map();let st=0,ts=0,latest='';
  parts.forEach(p=>{st+=p.sectionsDone||0;ts+=p.sectionsTotal||0;latest=p.generatedAt||latest;p.candidates.forEach(c=>{const key=c.id||c.name;if(!byId.has(key))byId.set(key,{id:key,name:c.name,votes:0,seq:c.seq});const x=byId.get(key);x.votes+=c.votes||0;x.seq=Math.min(x.seq,c.seq)})});
  const arr=[...byId.values()],total=arr.reduce((s,c)=>s+c.votes,0);arr.forEach(c=>c.pct=total?c.votes/total*100:0);arr.sort((a,b)=>b.votes-a.votes||a.seq-b.seq);
  return {progress:ts?st/ts*100:0,candidates:arr,generatedAt:latest||nowStamp(),sectionsDone:st,sectionsTotal:ts};
}
function applyDemo(){
  // O modo de teste usa exclusivamente candidaturas oficiais do TSE.
  // Os controles alteram apenas o estágio visual; nunca recriam candidatos fictícios.
  const p=DEMO_PROGRESS[demoStep];
  if(candidateBase){
    Object.keys(state).forEach(k=>{state[k].progress=0});
    renderAll();
  }else{
    loadTestCandidates();
  }
}
let candidateBase=null,ufCandidateCache={};
const UF_SHARD={ac:'a',al:'a',am:'a',ap:'a',ba:'a',ce:'a',df:'a',es:'a',go:'a',ma:'b',mg:'b',ms:'b',mt:'b',pa:'b',pb:'b',pe:'b',pi:'b',pr:'b',rj:'d',rn:'c',ro:'c',rr:'c',rs:'c',sc:'c',se:'c',sp:'d',to:'c'};
async function getUfCandidates(uf){
  uf=String(uf||'').toLowerCase();
  if(!UF_SHARD[uf])return null;
  if(ufCandidateCache[uf])return ufCandidateCache[uf];
  const r=await fetch('data/candidatos-ufs-'+UF_SHARD[uf]+'.json',{cache:'no-store'});
  if(!r.ok)throw new Error('base UF '+r.status);
  const shard=await r.json();
  Object.assign(ufCandidateCache,shard);
  return ufCandidateCache[uf]||null;
}
async function loadTestCandidates(){
  try{
    if(!candidateBase){
      const r=await fetch('data/candidatos-2026.json',{cache:'no-store'});
      if(!r.ok)throw new Error('base '+r.status);
      candidateBase=await r.json();
    }
    const setRows=(office,rows,stamp)=>{state[office]={progress:0,generatedAt:stamp||nowStamp(),candidates:(rows||[]).map((x,i)=>({id:String(x.seq||x.numero),name:x.nome,number:x.numero,party:x.partido,status:x.situacao,pct:0,votes:0,seq:i+1}))}};
    setRows('pres',candidateBase.pres||[],candidateBase.generatedBR||candidateBase.generated);
    const rn=await getUfCandidates('rn');
    const cargoMap={gov:3,sen:5,depf:6,depe:7};
    Object.entries(cargoMap).forEach(([office,cargo])=>setRows(office,(rn?.candidates||[]).filter(x=>x.cargo===cargo),rn?.generated));
    if(selectedOffice!=='pres'){
      const uf=scopeCode();
      const ufData=await getUfCandidates(uf);
      if(!ufData){
        setRows(selectedOffice,[],nowStamp());
        $('#statusTitle').textContent='Candidaturas indisponíveis';
        $('#statusText').textContent='A base desta UF ainda não foi processada. Nenhum dado de outra UF será exibido.';
      }else{
        const cargo=Number(officeMeta[selectedOffice].cargo);
        setRows(selectedOffice,ufData.candidates.filter(x=>x.cargo===cargo),ufData.generated);
        $('#statusTitle').textContent='Candidaturas carregadas';
        $('#statusText').textContent='Base TSE · '+scopeLabel()+' · sem votos';
      }
    }
    renderAll();
  }catch(e){
    state[selectedOffice]={progress:0,candidates:[],generatedAt:nowStamp()};
    $('#statusTitle').textContent='Base indisponível';
    $('#statusText').textContent='Não foi possível carregar candidaturas deste recorte. Nenhuma outra UF foi usada como substituição.';
    renderAll();
  }
}
async function loadRemote(){
  $('#refreshBtn').textContent='Carregando…';$('#refreshBtn').disabled=true;
  try{
    let result;
    if(selectedOffice==='pres' && selectedScope.startsWith('reg_')){
      const ufs=REGION_STATES[selectedScope],parts=await Promise.all(ufs.map(uf=>fetch(endpointFor('pres',uf)).then(r=>{if(!r.ok)throw new Error(r.status);return r.json()}).then(parseEA20)));result=aggregateResults(parts);
    }else{
      const uf=selectedOffice==='pres'?(selectedScope==='br'?'br':scopeCode()):scopeCode();
      const r=await fetch(endpointFor(selectedOffice,uf),{cache:'no-store'});if(!r.ok)throw new Error(r.status);result=parseEA20(await r.json());
    }
    state[selectedOffice]=result;$('#statusTitle').textContent='Dados carregados';$('#statusText').textContent='Arquivo recebido do ambiente '+MODE_LABELS[mode]+'.';renderAll();
  }catch(e){$('#statusTitle').textContent='Fonte indisponível';$('#statusText').textContent='Não foi possível carregar este recorte agora. O modo demonstração continua disponível.'}
  finally{$('#refreshBtn').textContent='Atualizar dados';$('#refreshBtn').disabled=false}
}
function renderRows(k){
  const all=state[k].candidates||[], items=mode==='demo'?all:all.slice(0,4), box=$('#'+k+'Rows');
  box.innerHTML=items.length?items.map(c=>'<div class="candidate-row"><span class="name" title="'+esc(c.name)+'">'+esc(c.name)+(mode==='demo'&&c.number?' <small>· '+esc(String(c.number))+' '+esc(c.party||'')+'</small>':'')+'</span><span class="bar"><i style="width:'+Math.min(100,c.pct)+'%"></i></span><span class="pct">'+fmtPct(c.pct)+'</span></div>').join(''):'<div class="more">Aguardando dados.</div>';
  $('#'+k+'Small').textContent=mode==='demo'?(all.length+' candidatura(s) na base TSE'):fmtPct(state[k].progress)+' das seções totalizadas';
  $('#'+k+'More').textContent=mode==='demo'?'Lista completa para conferência':(all.length>4?'+ '+(all.length-4)+' candidato(s) no arquivo':'Ordem conforme a fonte de dados');
}
function renderAll(){['pres','gov','sen','depf','depe'].forEach(renderRows);const current=state[selectedOffice].progress,rn=Math.max(state.gov.progress,state.sen.progress,state.depf.progress,state.depe.progress);$('#scopeProgressText').textContent=fmtPct(current);$('#scopeProgressBar').style.width=Math.min(100,current)+'%';$('#rnProgressText').textContent=fmtPct(rn);$('#rnProgressBar').style.width=Math.min(100,rn)+'%';updateScopeMap();$('#updatedAt').textContent=state[selectedOffice].generatedAt||'—';$('#sourceHint').textContent=mode==='demo'?'Candidaturas TSE · teste sem votos':'Dados do '+MODE_LABELS[mode];$('#liveLabel').textContent=mode==='demo'?'Demonstração':mode==='sim'?'Simulado TSE':'TSE';$('#modeBtn').textContent='Modo: '+MODE_LABELS[mode];$('#demoControls').classList.toggle('show',mode==='demo');$('#demoStepLabel').textContent='Etapa '+(demoStep+1)+' de '+DEMO_PROGRESS.length;regenerate()}
function populateScopeSelect(){const scopes=officeMeta[selectedOffice].scopes,sel=$('#scopeSelect');sel.innerHTML=scopes.map(s=>'<option value="'+s.value+'">'+s.label+'</option>').join('');if(!scopes.some(s=>s.value===selectedScope))selectedScope=officeMeta[selectedOffice].defaultScope;sel.value=selectedScope}
function selectOffice(k){selectedOffice=k;$('#officeSelect').value=k;selectedScope=officeMeta[k].defaultScope;populateScopeSelect();if(mode==='demo')setTimeout(loadTestCandidates,0);$('.result-card').forEach(el=>el.classList.toggle('selected',el.dataset.office===k));$('[data-pick]').forEach(b=>b.classList.toggle('active',b.dataset.pick===k));updateScopeMap();regenerate()}
function makePostText(){const d=state[selectedOffice],m=officeMeta[selectedOffice],time=(d.generatedAt||'').split('·').pop().trim().slice(0,5),lines=['ELEIÇÕES 2026'+(time?' | '+time:''),m.title+' · '+scopeLabel(),fmtPct(d.progress)+' das seções totalizadas',''];d.candidates.slice(0,4).forEach(c=>lines.push(c.name+' — '+fmtPct(c.pct)));lines.push('','Fonte: TSE');return lines.join('\n')}
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
const logoImg=new Image();logoImg.crossOrigin='anonymous';logoImg.src=LOGO_URL;logoImg.onload=()=>drawCanvas();
function drawCanvas(){
  const c=$('#shareCanvas'),ctx=c.getContext('2d'),d=state[selectedOffice],m=officeMeta[selectedOffice];ctx.clearRect(0,0,1080,1080);ctx.fillStyle='#f4f6f7';ctx.fillRect(0,0,1080,1080);ctx.fillStyle='rgba(245,196,0,.13)';ctx.beginPath();ctx.arc(1010,80,330,0,Math.PI*2);ctx.fill();
  if(logoImg.complete)ctx.drawImage(logoImg,70,54,100,100);
  ctx.fillStyle='#17191c';ctx.font='700 40px Inter,Segoe UI,Arial';ctx.fillText('UEFY Eleições',190,112);ctx.fillStyle='#17191c';ctx.font='600 18px Inter,Segoe UI,Arial';ctx.fillText(mode==='demo'?'CANDIDATURAS TSE · SEM VOTOS':'DADOS OFICIAIS DO TSE',650,105);
  const fc=featureCollectionForScope();
  if(fc&&fc.features?.length){
    const detailed=(selectedOffice!=='pres'&&selectedScope==='uf_rn');
    const x=detailed?555:575,y=detailed?120:125,w=detailed?475:445,h=detailed?350:330;
    drawGeoJSON(ctx,fc,x,y,w,h);
  }
  ctx.fillStyle='#17191c';ctx.font='700 78px Inter,Segoe UI,Arial';ctx.fillText('Eleições 2026',70,235);
  fitCanvasText(ctx,m.title,70,300,455,45,32,'700','#17191c');
  fitCanvasText(ctx,scopeLabel(),70,344,455,32,23,'600','#4d555d');

  ctx.fillStyle='#58616a';ctx.font='600 24px Inter,Segoe UI,Arial';ctx.fillText('Seções totalizadas',70,470);
  ctx.fillStyle='#17191c';ctx.font='800 60px Inter,Segoe UI,Arial';ctx.fillText(fmtPct(d.progress),70,535);
  ctx.fillStyle='#e0e5e9';roundRect(ctx,285,492,690,22,11);ctx.fill();
  ctx.fillStyle='#f5c400';roundRect(ctx,285,492,690*Math.min(100,d.progress)/100,22,11);ctx.fill();

  let yy=620;d.candidates.slice(0,4).forEach((cand,i)=>{
    ctx.fillStyle='#25292e';ctx.font='700 29px Inter,Segoe UI,Arial';
    ctx.fillText(cand.name.length>27?cand.name.slice(0,26)+'…':cand.name,70,yy);
    ctx.fillStyle='#e3e7ea';roundRect(ctx,70,yy+23,700,21,11);ctx.fill();
    ctx.fillStyle=i===0?'#f5c400':'#a8b2bc';roundRect(ctx,70,yy+23,700*Math.min(100,cand.pct)/100,21,11);ctx.fill();
    ctx.fillStyle='#17191c';ctx.font='800 33px Inter,Segoe UI,Arial';ctx.textAlign='right';ctx.fillText(fmtPct(cand.pct),980,yy+6);ctx.textAlign='left';
    yy+=82;
  });
  ctx.strokeStyle='#d3d9de';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(70,965);ctx.lineTo(1010,965);ctx.stroke();ctx.fillStyle='#58616a';ctx.font='600 20px Inter,Segoe UI,Arial';ctx.fillText(mode==='demo'?'Candidaturas: TSE · votos ainda não disponíveis':'Fonte: Tribunal Superior Eleitoral',70,1008);ctx.textAlign='right';ctx.fillText(d.generatedAt||nowStamp(),1010,1008);ctx.textAlign='left';
}
function regenerate(){const t=makePostText();$('#postText').value=t;$('#charCount').textContent=t.length+'/280';drawCanvas()}
function flash(btn,t){const old=btn.textContent;btn.textContent=t;setTimeout(()=>btn.textContent=old,1200)}
async function shareImageAndText(){
  const canvas=$('#shareCanvas'),text=$('#postText').value;
  const blob=await new Promise(r=>canvas.toBlob(r,'image/png'));
  if(!blob)return;
  const file=new File([blob],`uefy-eleicoes-2026-${selectedOffice}.png`,{type:'image/png'});
  try{
    if(navigator.share && navigator.canShare && navigator.canShare({files:[file]})){
      await navigator.share({title:'UEFY Eleições',text,files:[file]});
      return;
    }
  }catch(err){
    if(err?.name==='AbortError')return;
  }
  const a=document.createElement('a');
  a.download=file.name;a.href=URL.createObjectURL(blob);a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),2000);
  window.open('https://twitter.com/intent/tweet?text='+encodeURIComponent(text),'_blank','noopener,noreferrer');
}
$('#officeSelect').onchange=e=>selectOffice(e.target.value);$('#scopeSelect').onchange=e=>{selectedScope=e.target.value;updateScopeMap();if(mode==='demo'){applyDemo();setTimeout(loadTestCandidates,0)}else regenerate()};$$('[data-pick]').forEach(b=>b.onclick=()=>selectOffice(b.dataset.pick));
$('#modeBtn').onclick=()=>{mode=MODES[(MODES.indexOf(mode)+1)%MODES.length];mode==='demo'?loadTestCandidates():(renderAll(),loadRemote())};$('#refreshBtn').onclick=()=>mode==='demo'?loadTestCandidates():loadRemote();
$('#demoNext').onclick=()=>{demoStep=Math.min(DEMO_PROGRESS.length-1,demoStep+1);loadTestCandidates()};$('#demoBack').onclick=()=>{demoStep=Math.max(0,demoStep-1);loadTestCandidates()};$('#demoReset').onclick=()=>{demoStep=0;loadTestCandidates()};
$('#postText').oninput=e=>$('#charCount').textContent=e.target.value.length+'/280';$('#copyText').onclick=async()=>{await navigator.clipboard.writeText($('#postText').value);flash($('#copyText'),'Copiado!')};$('#copyImage').onclick=async()=>{try{const b=await new Promise(r=>$('#shareCanvas').toBlob(r,'image/png'));await navigator.clipboard.write([new ClipboardItem({'image/png':b})]);flash($('#copyImage'),'Imagem copiada!')}catch{alert('Use “Baixar imagem” neste navegador.')}};$('#downloadImage').onclick=()=>{const a=document.createElement('a');a.download='uefy-eleicoes-2026-'+selectedOffice+'.png';a.href=$('#shareCanvas').toDataURL('image/png');a.click()};$('#openX').onclick=()=>window.open('https://twitter.com/intent/tweet?text='+encodeURIComponent($('#postText').value),'_blank','noopener,noreferrer');$('#shareBundle').onclick=shareImageAndText;
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
const topBtn=$('#toTop');window.addEventListener('scroll',()=>topBtn.classList.toggle('show',scrollY>420),{passive:true});topBtn.onclick=()=>scrollTo({top:0,behavior:'smooth'});
populateScopeSelect();applyDemo();setTimeout(loadTestCandidates,0);loadMaps().catch(()=>{$('#statusText').textContent='Os mapas não puderam ser carregados.'});
document.querySelectorAll('.mobile-menu a').forEach(a=>a.addEventListener('click',()=>a.closest('details')?.removeAttribute('open')));

/* Favoritos e atualização operacional */
const UEFY_FAV_KEY='uefy-eleicoes-favorites-v1';
function getFavs(){try{return JSON.parse(localStorage.getItem(UEFY_FAV_KEY)||'[]')}catch{return[]}}
function saveFavs(v){localStorage.setItem(UEFY_FAV_KEY,JSON.stringify(v));renderFavStrip();syncFavButton()}
function currentFav(){const meta=officeMeta[selectedOffice]||{};const sc=(meta.scopes||[]).find(x=>x.value===selectedScope);return {type:'general',office:selectedOffice,scope:selectedScope,label:(meta.title||selectedOffice)+' · '+(sc?.label||selectedScope||'Brasil')}}
function favId(f){return [f.type,f.office,f.scope,f.municipality].filter(Boolean).join('|')}
function syncFavButton(){const b=document.querySelector('#favoriteCurrent');if(!b)return;const on=getFavs().some(f=>favId(f)===favId(currentFav()));b.classList.toggle('on',on);b.textContent=on?'★ Favorito':'☆ Favoritar'}
function renderFavStrip(){const box=document.querySelector('#liveStripItems');if(!box)return;const favs=getFavs();if(!favs.length){box.innerHTML='<span class="strip-empty">Marque um resultado com ★ para acompanhar aqui.</span>';return}box.innerHTML=favs.map(f=>'<button class="strip-chip" data-favid="'+favId(f)+'"><b>'+f.label+'</b><span>toque para abrir · <em>↻</em></span></button>').join('');box.querySelectorAll('.strip-chip').forEach((b,i)=>b.onclick=()=>{const f=favs[i];if(f.type==='rn'){location.href='rn.html?fav='+encodeURIComponent(f.municipality)+'&office='+f.office}else{selectOffice(f.office);selectedScope=f.scope;populateScopeSelect();document.querySelector('#scopeSelect').value=f.scope;mode==='demo'?applyDemo():loadRemote();scrollTo({top:document.querySelector('#apuracao').offsetTop-120,behavior:'smooth'})}})}
document.querySelector('#favoriteCurrent')?.addEventListener('click',()=>{const f=currentFav(),a=getFavs(),id=favId(f),i=a.findIndex(x=>favId(x)===id);if(i>=0)a.splice(i,1);else a.unshift(f);saveFavs(a.slice(0,12))});
document.querySelector('#refreshAll')?.addEventListener('click',async e=>{const b=e.currentTarget;b.classList.add('loading');b.disabled=true;try{if(mode==='demo')applyDemo();else await loadRemote();renderFavStrip()}finally{setTimeout(()=>{b.classList.remove('loading');b.disabled=false},450)}});
document.querySelector('#officeSelect')?.addEventListener('change',()=>setTimeout(syncFavButton));document.querySelector('#scopeSelect')?.addEventListener('change',()=>setTimeout(syncFavButton));renderFavStrip();syncFavButton();
