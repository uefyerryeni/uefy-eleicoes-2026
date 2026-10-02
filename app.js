const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const LOGO_URL='https://uefyerryeni.github.io/uefyerryeni-logo.png';
const MODE_LABELS={sim:'simulado TSE',official:'oficial TSE',lab:'Laboratório UEFY'};
const LAB_STEPS=[0,8,22,41,63,81,95,100];
let labStep=0;
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
let mode='official',selectedOffice='pres',selectedScope='br',maps={br:null,rn:null};
let state={pres:{progress:0,candidates:[]},gov:{progress:0,candidates:[]},sen:{progress:0,candidates:[]},depf:{progress:0,candidates:[]},depe:{progress:0,candidates:[]}};
let publicationTextMode='full';

function fmtPct(v){return Number(v||0).toLocaleString('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:2})+'%'}
function nowStamp(){return new Date().toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'})}
function esc(s){return String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}
function scopeLabel(v=selectedScope){return (officeMeta[selectedOffice].scopes.find(s=>s.value===v)||{}).label||'Brasil'}
function scopeCode(v=selectedScope){return v.startsWith('uf_')?v.slice(3):null}
function featureCollectionForScope(){
  if(!maps.br)return null;
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
    number:String(cand.n||''),
    name:cand.nmu||cand.nm||(cand.n?'Número '+cand.n:'Nome não informado'),
    pct:Number(String(cand.pvap??0).replace(',','.'))||0,
    votes:Number(cand.vap||0),
    seq:Number(cand.seq||999999)
  })))));
  return out.sort((a,b)=>a.seq-b.seq);
}
function parseEA20(data){
  const progress=data.s&&data.s.pst!=null?Number(String(data.s.pst).replace(',','.')):(data.s&&data.s.ts?Number(data.s.st||0)/Number(data.s.ts)*100:0);
  const candidates=flattenCandidates(data).sort((a,b)=>b.votes-a.votes||a.seq-b.seq);return {progress:isFinite(progress)?progress:0,candidates,generatedAt:[data.dg,data.hg].filter(Boolean).join(' · ')||nowStamp(),sectionsTotal:Number(data.s?.ts||0),sectionsDone:Number(data.s?.st||0)};
}
function endpointFor(office,uf,env=mode){
  const meta=officeMeta[office],base=env==='sim'?'https://resultados-sim.tse.jus.br/simulado/simulado2026/ele2026':'https://resultados.tse.jus.br/oficial/ele2026';
  const election=meta.election==='federal'?(env==='sim'?'21270':'6257'):(env==='sim'?'21272':'6259');
  const el=String(election).padStart(6,'0');
  return base+'/'+election+'/dados/'+uf+'/'+uf+'-c'+meta.cargo+'-e'+el+'-u.json';
}
function aggregateResults(parts){
  const byId=new Map();let st=0,ts=0,latest='';
  parts.forEach(p=>{st+=p.sectionsDone||0;ts+=p.sectionsTotal||0;latest=p.generatedAt||latest;p.candidates.forEach(c=>{const key=c.id||c.name;if(!byId.has(key))byId.set(key,{id:key,number:c.number||key,name:c.name,votes:0,seq:c.seq});const x=byId.get(key);x.votes+=c.votes||0;x.seq=Math.min(x.seq,c.seq)})});
  const arr=[...byId.values()],total=arr.reduce((s,c)=>s+c.votes,0);arr.forEach(c=>c.pct=total?c.votes/total*100:0);arr.sort((a,b)=>b.votes-a.votes||a.seq-b.seq);
  return {progress:ts?st/ts*100:0,candidates:arr,generatedAt:latest||nowStamp(),sectionsDone:st,sectionsTotal:ts};
}
function applyDemo(){return loadTestCandidates();}
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
  const setRows=(office,rows,stamp)=>{state[office]={progress:0,generatedAt:stamp||nowStamp(),candidates:(rows||[]).map((x,i)=>({
    id:String(x.seq||x.numero||i),name:x.nome,number:x.numero,party:x.partido,status:x.situacao,pct:0,votes:0,seq:i+1
  }))}};
  try{
    if(!candidateBase){
      const r=await fetch('data/candidatos-2026.json',{cache:'no-store'});
      if(!r.ok)throw new Error('base presidencial '+r.status);
      candidateBase=await r.json();
    }
    if(!Array.isArray(candidateBase.pres)||!candidateBase.pres.length)throw new Error('base presidencial vazia');
    setRows('pres',candidateBase.pres,candidateBase.generatedBR||candidateBase.generated);
  }catch(e){
    setRows('pres',[],nowStamp());
    if(selectedOffice==='pres'){
      $('#statusTitle').textContent='Base presidencial indisponível';
      $('#statusText').textContent='A base oficial de candidaturas à Presidência não pôde ser carregada.';
      renderAll();return;
    }
  }

  try{
    const rn=await getUfCandidates('rn');
    const cargoMap={gov:3,sen:5,depf:6,depe:7};
    Object.entries(cargoMap).forEach(([office,cargo])=>setRows(office,(rn?.candidates||[]).filter(x=>x.cargo===cargo),rn?.generated));
  }catch(e){
    ['gov','sen','depf','depe'].forEach(k=>{if(!state[k].candidates?.length)setRows(k,[],nowStamp())});
  }

  if(selectedOffice!=='pres'){
    try{
      const uf=scopeCode();
      const ufData=await getUfCandidates(uf);
      if(!ufData)throw new Error('UF sem base');
      const cargo=Number(officeMeta[selectedOffice].cargo);
      const rows=(ufData.candidates||[]).filter(x=>x.cargo===cargo);
      if(!rows.length)throw new Error('cargo sem candidaturas');
      setRows(selectedOffice,rows,ufData.generated);
      $('#statusTitle').textContent='Candidaturas oficiais carregadas';
      $('#statusText').textContent=rows.length+' candidatura(s) · '+scopeLabel()+' · base TSE · sem votos';
    }catch(e){
      setRows(selectedOffice,[],nowStamp());
      $('#statusTitle').textContent='Candidaturas indisponíveis';
      $('#statusText').textContent='Não foi possível carregar este cargo e recorte. Nenhuma outra UF foi usada como substituição.';
    }
  }else{
    const n=state.pres.candidates.length;
    $('#statusTitle').textContent='Candidaturas oficiais carregadas';
    $('#statusText').textContent=n+' candidatura(s) à Presidência · base TSE · sem votos';
  }
  renderAll();
}
async function ensurePresidentBase(){
  if(candidateBase&&Array.isArray(candidateBase.pres)&&candidateBase.pres.length)return candidateBase;
  const r=await fetch('data/candidatos-2026.json',{cache:'no-store'});
  if(!r.ok)throw new Error('base presidencial '+r.status);
  candidateBase=await r.json();
  return candidateBase;
}
async function registryForResult(office){
  if(office==='pres')return (await ensurePresidentBase()).pres||[];
  const uf=scopeCode()||'rn',data=await getUfCandidates(uf);
  const cargo=Number(officeMeta[office].cargo);
  return (data?.candidates||[]).filter(x=>x.cargo===cargo);
}
async function reconcileResult(result,office){
  try{
    const registry=await registryForResult(office);
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
async function loadLab(){
  const registry=await registryForResult(selectedOffice);
  const progress=LAB_STEPS[labStep%LAB_STEPS.length];
  const seed=(selectedOffice.charCodeAt(0)+(scopeLabel().length*7)+labStep*13);
  const rows=(registry||[]).slice(0,Math.max(4,registry.length)).map((x,i)=>{
    const base=Math.max(4,42-i*8);
    const swing=((seed+i*17)%13)-6;
    return {id:String(x.seq||x.numero||i),number:String(x.numero||''),name:x.nome||('Candidato '+(i+1)),party:x.partido||'',status:x.situacao||'',votes:progress?Math.max(0,Math.round((base+swing)*progress*137)):0,seq:i+1};
  });
  if(progress>=41&&rows.length>1){rows[0].votes=Math.round(rows[0].votes*.92);rows[1].votes=Math.round(rows[1].votes*1.13)}
  const total=rows.reduce((s,x)=>s+x.votes,0);rows.forEach(x=>x.pct=total?x.votes/total*100:0);rows.sort((x,y)=>y.votes-x.votes||x.seq-y.seq);
  state[selectedOffice]={progress,candidates:rows,generatedAt:nowStamp(),lab:true};
  $('#statusTitle').textContent='Laboratório UEFY · dados fictícios';
  $('#statusText').textContent='Cenário '+(labStep+1)+'/'+LAB_STEPS.length+' · '+fmtPct(progress)+' das seções simuladas. Atualize para avançar a apuração.';
  renderAll();
}
async function loadRemote(){
  if(mode==='lab'){try{await loadLab()}catch(e){$('#statusTitle').textContent='Laboratório indisponível';$('#statusText').textContent='Não foi possível montar o cenário fictício: '+e.message}return}
  state[selectedOffice]={progress:0,candidates:[],generatedAt:null};
  renderAll();
  $('#statusTitle').textContent='Consultando o TSE…';
  $('#statusText').textContent='Carregando '+MODE_LABELS[mode]+' para '+scopeLabel()+'.';
  $('#refreshBtn').textContent='Carregando…';$('#refreshBtn').disabled=true;
  try{
    let result;
    if(selectedOffice==='pres' && selectedScope.startsWith('reg_')){
      const ufs=REGION_STATES[selectedScope],parts=await Promise.all(ufs.map(uf=>fetch(endpointFor('pres',uf)).then(r=>{if(!r.ok)throw new Error(r.status);return r.json()}).then(parseEA20)));result=aggregateResults(parts);
    }else{
      const uf=selectedOffice==='pres'?(selectedScope==='br'?'br':scopeCode()):scopeCode();
      const r=await fetch(endpointFor(selectedOffice,uf),{cache:'no-store'});if(!r.ok)throw new Error(r.status);result=parseEA20(await r.json());
    }
    if(mode==='official')result=await reconcileResult(result,selectedOffice);
    state[selectedOffice]=result;
    if(mode==='sim'){
      $('#statusTitle').textContent='Simulado TSE carregado';
      $('#statusText').textContent='Dados do Simulado TSE. Não representam a apuração oficial.';
    }else{
      $('#statusTitle').textContent='Resultados oficiais carregados';
      if(result.integrity?.unmatched){
        $('#statusText').textContent='Atenção: '+result.integrity.unmatched+' registro(s) do resultado oficial não corresponderam à base de candidaturas.';
      }else{
        $('#statusText').textContent='EA20 oficial · '+result.integrity.matched+'/'+result.integrity.total+' candidatura(s) conferida(s) com a base oficial.';
      }
    }
    renderAll();
  }catch(e){
    const notPublished=mode==='official'&&String(e?.message||e).includes('404');
    $('#statusTitle').textContent=notPublished?'Resultado oficial ainda não disponível':'Fonte indisponível';
    $('#statusText').textContent=notPublished?'O resultado oficial deste recorte ainda não está disponível no TSE. Use o Simulado TSE apenas para testar a ferramenta.':'Não foi possível carregar este recorte agora. Tente atualizar; para testar a ferramenta, selecione Simulado TSE.';
  }
  finally{$('#refreshBtn').textContent='Atualizar dados';$('#refreshBtn').disabled=false}
}
function renderRows(k){
  const box=$('#'+k+'Rows'),small=$('#'+k+'Small'),more=$('#'+k+'More');
  if(!box)return;
  const all=state[k]?.candidates||[];
  const limit=mode==='demo'?(k==='depf'||k==='depe'?16:20):8;
  const items=all.slice(0,limit);
  if(mode==='demo'){
    box.innerHTML=items.length?items.map(c=>{
      const meta=[c.number,c.party].filter(Boolean).map(esc).join(' · ');
      const status=c.status?'<span class="status-chip">'+esc(c.status)+'</span>':'';
      return '<div class="candidate-row registry"><span class="name" title="'+esc(c.name)+'">'+esc(c.name)+(meta?' <small>'+meta+'</small>':'')+'</span>'+status+'</div>';
    }).join(''):'<div class="empty-state">Nenhuma candidatura disponível para este recorte.</div>';
  }else{
    box.innerHTML=items.length?items.map(c=>{
      const meta=[c.number,c.party].filter(Boolean).map(esc).join(' · ');
      return '<div class="candidate-row"><span class="name" title="'+esc(c.name)+'">'+esc(c.name)+(meta?' <small>'+meta+'</small>':'')+'</span><span class="bar"><i style="width:'+Math.min(100,c.pct||0)+'%"></i></span><span class="pct">'+fmtPct(c.pct)+'</span></div>';
    }).join(''):'<div class="empty-state">Nenhum resultado disponível para este recorte.</div>';
  }
  if(small)small.textContent=mode==='demo'?(all.length+' candidatura(s) na base oficial'):fmtPct(state[k]?.progress)+' das seções totalizadas';
  if(more)more.textContent=all.length>items.length?'Mostrando '+items.length+' de '+all.length:(mode==='demo'?'Ordem por número de candidatura':'Ordem por votação');
}
function renderAll(){
  ['pres','gov','sen','depf','depe'].forEach(renderRows);
  const current=Number(state[selectedOffice]?.progress||0);
  const count=state[selectedOffice]?.candidates?.length||0;
  const setText=(id,value)=>{const el=$(id);if(el)el.textContent=value};
  const setWidth=(id,value)=>{const el=$(id);if(el)el.style.width=value};
  if(mode==='demo'){
    setText('#scopeMetricLabel','Candidaturas na base');
    setText('#scopeProgressText',String(count));
    setWidth('#scopeProgressBar',count?'100%':'0%');
  }else{
    setText('#scopeMetricLabel','Seções totalizadas');
    setText('#scopeProgressText',fmtPct(current));
    setWidth('#scopeProgressBar',Math.min(100,current)+'%');
  }
  setText('#rnProgressText',fmtPct(current));setWidth('#rnProgressBar',Math.min(100,current)+'%');
  updateScopeMap();
  setText('#updatedAt',state[selectedOffice]?.generatedAt||'—');
  setText('#sourceHint','Resultados · '+MODE_LABELS[mode]);
  setText('#liveLabel',mode==='lab'?'LAB fictício':mode==='sim'?'Simulado TSE':'TSE oficial');
  const modeSelect=$('#modeSelect');if(modeSelect)modeSelect.value=mode;
  updateCardVisibility();
  regenerate();
}
function populateScopeSelect(){const scopes=officeMeta[selectedOffice].scopes,sel=$('#scopeSelect');sel.innerHTML=scopes.map(s=>'<option value="'+s.value+'">'+s.label+'</option>').join('');if(!scopes.some(s=>s.value===selectedScope))selectedScope=officeMeta[selectedOffice].defaultScope;sel.value=selectedScope}
function updateCardVisibility(){
  $$('.result-card').forEach(el=>{el.hidden=el.dataset.office!==selectedOffice});
  const rnCard=$('.rn-map-card');
  if(rnCard)rnCard.hidden=true;
  const row=$('.map-row');if(row)row.classList.add('single');
}
function selectOffice(k){
  selectedOffice=k;$('#officeSelect').value=k;selectedScope=officeMeta[k].defaultScope;
  populateScopeSelect();updateCardVisibility();
  $$('.result-card').forEach(el=>el.classList.toggle('selected',el.dataset.office===k));
  $$('[data-pick]').forEach(b=>b.classList.toggle('active',b.dataset.pick===k));
  updateScopeMap();
  loadRemote();
}
function candidateLabel(c){
  return c.name+(c.party?' ('+c.party+')':'');
}
function makePostText(){
  const d=state[selectedOffice],m=officeMeta[selectedOffice],time=(d.generatedAt||'').split('·').pop().trim().slice(0,5);
  const source=mode==='demo'?'Base oficial TSE · sem votos':mode==='lab'?'LABORATÓRIO UEFY · DADOS FICTÍCIOS':mode==='sim'?'Fonte: Simulado TSE':'Fonte: Tribunal Superior Eleitoral';
  const lines=['ELEIÇÕES 2026 | '+m.title.toUpperCase(),scopeLabel()];
  if(mode==='demo'){
    lines.push('',d.candidates.length+' candidatura(s) registradas na base eleitoral.');
    d.candidates.slice(0,4).forEach(c=>lines.push(candidateLabel(c)+(c.number?' · nº '+c.number:'')));
  }else{
    const final=d.progress>=100;
    lines.push('',(final?'RESULTADO FINAL':'APURAÇÃO PARCIAL')+' · '+fmtPct(d.progress)+' das seções totalizadas','');
    d.candidates.slice(0,4).forEach(c=>lines.push(candidateLabel(c)+' — '+fmtPct(c.pct)));
    if(publicationTextMode==='full'&&!final&&mode!=='lab'){
      lines.push('','Os percentuais refletem o recorte selecionado neste momento e podem mudar até a conclusão da totalização.');
    }
  }
  if(publicationTextMode==='full'&&d.generatedAt)lines.push('','Atualização: '+d.generatedAt);
  lines.push('',source);
  return lines.join('\n');
}
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
  const c=$('#shareCanvas'),ctx=c.getContext('2d'),d=state[selectedOffice],m=officeMeta[selectedOffice];
  ctx.clearRect(0,0,1080,1080);
  ctx.fillStyle='#f4f6f7';ctx.fillRect(0,0,1080,1080);
  ctx.fillStyle='rgba(245,196,0,.13)';ctx.beginPath();ctx.arc(1010,80,330,0,Math.PI*2);ctx.fill();
  if(logoImg.complete)try{ctx.drawImage(logoImg,70,54,100,100)}catch{}
  fitCanvasText(ctx,'Central das Eleições UEFY',190,112,430,34,27,'700','#17191c');
  ctx.font='600 18px Inter,Segoe UI,Arial';
  ctx.fillText(mode==='lab'?'LAB · DADOS FICTÍCIOS':mode==='sim'?'SIMULADO TSE':d.progress>=100?'RESULTADO FINAL · TSE':'PARCIAL · TSE',650,105);

  const fc=featureCollectionForScope();
  if(fc&&fc.features?.length){
    drawGeoJSON(ctx,fc,575,125,445,330);
  }

  ctx.fillStyle='#17191c';ctx.font='700 78px Inter,Segoe UI,Arial';ctx.fillText('Eleições 2026',70,235);
  fitCanvasText(ctx,m.title,70,300,455,45,32,'700','#17191c');
  fitCanvasText(ctx,scopeLabel(),70,344,455,32,23,'600','#4d555d');

  if(mode==='demo'){
    ctx.fillStyle='#58616a';ctx.font='600 24px Inter,Segoe UI,Arial';ctx.fillText('Candidaturas na base oficial',70,470);
    ctx.fillStyle='#17191c';ctx.font='800 60px Inter,Segoe UI,Arial';ctx.fillText(String(d.candidates.length),70,535);
    let yy=625;
    d.candidates.slice(0,4).forEach(cand=>{
      ctx.fillStyle='#25292e';ctx.font='700 29px Inter,Segoe UI,Arial';
      ctx.fillText(cand.name.length>27?cand.name.slice(0,26)+'…':cand.name,70,yy);
      const meta=[cand.number,cand.party].filter(Boolean).join(' · ');
      ctx.fillStyle='#667079';ctx.font='600 20px Inter,Segoe UI,Arial';ctx.fillText(meta,70,yy+31);
      yy+=82;
    });
  }else{
    ctx.fillStyle='#58616a';ctx.font='600 24px Inter,Segoe UI,Arial';ctx.fillText('Seções totalizadas',70,470);
    ctx.fillStyle='#17191c';ctx.font='800 60px Inter,Segoe UI,Arial';ctx.fillText(fmtPct(d.progress),70,535);
    ctx.fillStyle='#e0e5e9';roundRect(ctx,285,492,690,22,11);ctx.fill();
    ctx.fillStyle='#f5c400';roundRect(ctx,285,492,690*Math.min(100,d.progress)/100,22,11);ctx.fill();
    let yy=620;
    d.candidates.slice(0,4).forEach((cand,i)=>{
      ctx.fillStyle='#25292e';ctx.font='700 29px Inter,Segoe UI,Arial';
      ctx.fillText(cand.name.length>27?cand.name.slice(0,26)+'…':cand.name,70,yy);
      ctx.fillStyle='#e3e7ea';roundRect(ctx,70,yy+23,700,21,11);ctx.fill();
      ctx.fillStyle=i===0?'#f5c400':'#a8b2bc';roundRect(ctx,70,yy+23,700*Math.min(100,cand.pct)/100,21,11);ctx.fill();
      ctx.fillStyle='#17191c';ctx.font='800 33px Inter,Segoe UI,Arial';ctx.textAlign='right';ctx.fillText(fmtPct(cand.pct),980,yy+6);ctx.textAlign='left';
      yy+=82;
    });
  }

  ctx.strokeStyle='#d3d9de';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(70,965);ctx.lineTo(1010,965);ctx.stroke();
  ctx.fillStyle='#58616a';ctx.font='600 20px Inter,Segoe UI,Arial';
  ctx.fillText(mode==='lab'?'LABORATÓRIO UEFY · NÃO É RESULTADO ELEITORAL':mode==='demo'?'Base de candidaturas: Tribunal Superior Eleitoral':'Fonte: Tribunal Superior Eleitoral',70,1008);
  ctx.textAlign='right';ctx.fillText(d.generatedAt||nowStamp(),1010,1008);ctx.textAlign='left';
}
function regenerate(){const t=makePostText();$('#postText').value=t;$('#charCount').textContent=t.length+' caracteres';drawCanvas()}
function flash(btn,t){if(!btn)return;const old=btn.textContent;btn.textContent=t;setTimeout(()=>btn.textContent=old,1800)}
async function canvasPngBlob(canvas){
  const blob=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('Não foi possível gerar a imagem.')),'image/png'));
  return blob;
}
async function canvasShareJpegBlob(canvas){
  const flat=document.createElement('canvas');
  flat.width=canvas.width;flat.height=canvas.height;
  const ctx=flat.getContext('2d',{alpha:false});
  ctx.fillStyle='#f4f6f7';ctx.fillRect(0,0,flat.width,flat.height);
  ctx.drawImage(canvas,0,0);
  return await new Promise((resolve,reject)=>flat.toBlob(b=>b?resolve(b):reject(new Error('Não foi possível preparar a imagem para compartilhamento.')),'image/jpeg',0.96));
}
async function copyCanvasImage(canvas){
  if(!window.isSecureContext||!navigator.clipboard||!window.ClipboardItem)throw new Error('Área de transferência de imagens indisponível.');
  const blob=await canvasPngBlob(canvas);
  await navigator.clipboard.write([new ClipboardItem({'image/png':blob})]);
  return blob;
}
async function openXIntent(text,preopened=null){
  const encoded=encodeURIComponent(text);
  const useIntent=encoded.length<=6000;
  const url=useIntent?'https://twitter.com/intent/tweet?text='+encoded:'https://x.com/compose/post';
  if(!useIntent){
    try{await navigator.clipboard.writeText(text)}catch{}
  }
  if(preopened){preopened.opener=null;preopened.location.href=url}else window.open(url,'_blank','noopener,noreferrer');
  return useIntent;
}
async function shareImageAndText(openX=false,preopened=null){
  const canvas=$('#shareCanvas'),text=$('#postText').value;
  let blob;
  try{blob=await canvasPngBlob(canvas)}catch{if(preopened)preopened.close();flash(openX?$('#openX'):$('#shareBundle'),'Falha ao gerar imagem');return}
  const desktop=window.matchMedia?.('(pointer:fine)').matches&&window.innerWidth>820;
  let shareBlob=blob;
  if(!desktop){
    try{shareBlob=await canvasShareJpegBlob(canvas)}catch{}
  }
  const file=new File([shareBlob],`uefy-eleicoes-2026-${selectedOffice}.${shareBlob.type==='image/jpeg'?'jpg':'png'}`,{type:shareBlob.type||'image/png'});

  if(openX&&desktop){
    let copied=false;
    try{
      if(window.isSecureContext&&navigator.clipboard&&window.ClipboardItem){
        await navigator.clipboard.write([new ClipboardItem({'image/png':blob})]);
        copied=true;
      }
    }catch{}
    const prefilled=await openXIntent(text,preopened);
    flash($('#openX'),prefilled?(copied?'Imagem copiada · cole com Ctrl+V':'X aberto · use “Copiar imagem”'):'Texto copiado · cole no X');
    return;
  }

  if(!openX){
    try{
      if(navigator.share&&navigator.canShare&&navigator.canShare({files:[file]})){
        await navigator.share({title:'UEFY Eleições',text,files:[file]});
        if(preopened)preopened.close();
        return;
      }
    }catch(err){if(err?.name==='AbortError'){if(preopened)preopened.close();return}}
    try{
      await copyCanvasImage(canvas);
      flash($('#shareBundle'),'Imagem copiada · texto acima');
    }catch{
      flash($('#shareBundle'),'Use Copiar texto / Copiar imagem');
    }
    if(preopened)preopened.close();
    return;
  }

  const prefilled=await openXIntent(text,preopened);
  flash($('#openX'),prefilled?'X aberto com o texto':'Texto copiado · cole no X');
}$('#officeSelect').onchange=e=>selectOffice(e.target.value);$('#scopeSelect').onchange=e=>{selectedScope=e.target.value;updateScopeMap();updateCardVisibility();loadRemote()};$$('[data-pick]').forEach(b=>b.onclick=()=>selectOffice(b.dataset.pick));
$('#modeSelect').value=mode;$('#modeSelect').onchange=e=>{mode=e.target.value;if(mode==='lab')labStep=0;loadRemote()};$('#refreshBtn').onclick=()=>{if(mode==='lab')labStep=(labStep+1)%LAB_STEPS.length;loadRemote()};

function syncTextModeButtons(){
  $$('.text-mode-switch [data-text-mode]').forEach(b=>b.classList.toggle('active',b.dataset.textMode===publicationTextMode));
}
$$('.text-mode-switch [data-text-mode]').forEach(b=>b.onclick=()=>{
  publicationTextMode=b.dataset.textMode;
  syncTextModeButtons();
  regenerate();
});
syncTextModeButtons();

$('#postText').oninput=e=>$('#charCount').textContent=e.target.value.length+' caracteres';
$('#copyText').onclick=async()=>{try{await navigator.clipboard.writeText($('#postText').value);flash($('#copyText'),'Texto copiado!')}catch{flash($('#copyText'),'Cópia bloqueada')}};
$('#copyImage').onclick=async()=>{try{await copyCanvasImage($('#shareCanvas'));flash($('#copyImage'),'Imagem copiada!')}catch{flash($('#copyImage'),'Cópia bloqueada')}};
$('#downloadImage').onclick=()=>{const a=document.createElement('a');a.download='uefy-eleicoes-2026-'+selectedOffice+'.png';a.href=$('#shareCanvas').toDataURL('image/png');a.click()};
$('#openX').onclick=()=>{const desktop=window.matchMedia?.('(pointer:fine)').matches&&window.innerWidth>820;const w=desktop?window.open('about:blank','_blank'):null;shareImageAndText(true,w)};
$('#shareBundle').onclick=()=>shareImageAndText(false);
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
populateScopeSelect();updateCardVisibility();$('#modeSelect').value=mode;loadRemote();loadMaps().catch(()=>{$('#statusText').textContent='Os mapas não puderam ser carregados.'});
document.querySelectorAll('.mobile-menu a').forEach(a=>a.addEventListener('click',()=>a.closest('details')?.removeAttribute('open')));

/* Favoritos e atualização operacional */
const UEFY_FAV_KEY='uefy-eleicoes-favorites-v1';
function getFavs(){try{return JSON.parse(localStorage.getItem(UEFY_FAV_KEY)||'[]')}catch{return[]}}
function saveFavs(v){localStorage.setItem(UEFY_FAV_KEY,JSON.stringify(v));renderFavStrip();syncFavButton()}
function currentFav(){const meta=officeMeta[selectedOffice]||{};const sc=(meta.scopes||[]).find(x=>x.value===selectedScope);return {type:'general',office:selectedOffice,scope:selectedScope,label:(meta.title||selectedOffice)+' · '+(sc?.label||selectedScope||'Brasil')}}
function favId(f){return [f.type,f.office,f.scope,f.municipality].filter(Boolean).join('|')}
function syncFavButton(){const b=document.querySelector('#favoriteCurrent');if(!b)return;const on=getFavs().some(f=>favId(f)===favId(currentFav()));b.classList.toggle('on',on);b.textContent=on?'★ Favorito':'☆ Favoritar'}
function renderFavStrip(){const box=document.querySelector('#liveStripItems');if(!box)return;const favs=getFavs();if(!favs.length){box.innerHTML='<span class="strip-empty">Marque um resultado com ★ para acompanhar aqui.</span>';return}box.innerHTML=favs.map(f=>'<button class="strip-chip" data-favid="'+favId(f)+'"><b>'+f.label+'</b><span>toque para abrir · <em>↻</em></span></button>').join('');box.querySelectorAll('.strip-chip').forEach((b,i)=>b.onclick=()=>{const f=favs[i];if(f.type==='rn'){location.href='rn.html?fav='+encodeURIComponent(f.municipality)+'&office='+f.office}else{selectOffice(f.office);selectedScope=f.scope;populateScopeSelect();document.querySelector('#scopeSelect').value=f.scope;loadRemote();scrollTo({top:document.querySelector('#apuracao').offsetTop-120,behavior:'smooth'})}})}
document.querySelector('#favoriteCurrent')?.addEventListener('click',()=>{const f=currentFav(),a=getFavs(),id=favId(f),i=a.findIndex(x=>favId(x)===id);if(i>=0)a.splice(i,1);else a.unshift(f);saveFavs(a.slice(0,12))});
document.querySelector('#refreshAll')?.addEventListener('click',async e=>{const b=e.currentTarget;b.classList.add('loading');b.disabled=true;try{if(mode==='lab')labStep=(labStep+1)%LAB_STEPS.length;await loadRemote();renderFavStrip()}finally{setTimeout(()=>{b.classList.remove('loading');b.disabled=false},450)}});
document.querySelector('#officeSelect')?.addEventListener('change',()=>setTimeout(syncFavButton));document.querySelector('#scopeSelect')?.addEventListener('change',()=>setTimeout(syncFavButton));renderFavStrip();syncFavButton();
