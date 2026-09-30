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
const DEMO_BASE={
  pres:[['Candidato 01',48.5],['Candidato 02',43.9],['Candidato 03',5.7],['Candidato 04',1.9]],
  gov:[['Candidato 11',52.1],['Candidato 12',38.4],['Candidato 13',6.2],['Candidato 14',3.3]],
  sen:[['Candidato 21',44.6],['Candidato 22',34.3],['Candidato 23',15.3],['Candidato 24',5.8]],
  depf:[['Candidato 31',29.3],['Candidato 32',24.8],['Candidato 33',18.0],['Candidato 34',12.3]],
  depe:[['Candidato 41',20.7],['Candidato 42',18.9],['Candidato 43',13.8],['Candidato 44',11.0]]
};
const DEMO_PROGRESS=[0,6.4,22.7,51.3,82.6,100];
let mode='demo',demoStep=0,selectedOffice='pres',selectedScope='br',maps={br:null,rn:null};
let state={pres:{progress:0,candidates:[]},gov:{progress:0,candidates:[]},sen:{progress:0,candidates:[]},depf:{progress:0,candidates:[]},depe:{progress:0,candidates:[]}};

function fmtPct(v){return Number(v||0).toLocaleString('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:2})+'%'}
function nowStamp(){return new Date().toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'})}
function esc(s){return String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}
function scopeLabel(v=selectedScope){return (officeMeta[selectedOffice].scopes.find(s=>s.value===v)||{}).label||'Brasil'}
function scopeCode(v=selectedScope){return v.startsWith('uf_')?v.slice(3):null}
function mapKind(){return (selectedOffice!=='pres' && selectedScope==='uf_rn')?'rn':'br'}

async function loadMaps(){
  const [br,rn]=await Promise.all([fetch('assets/maps/br-estados.geojson').then(r=>r.json()),fetch('assets/maps/rn-municipios.geojson').then(r=>r.json())]);
  maps={br,rn};renderGeoJSON($('#brMap'),br);renderGeoJSON($('#rnMap'),rn);drawCanvas();
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
  const p=DEMO_PROGRESS[demoStep];
  Object.keys(state).forEach(k=>{const base=DEMO_BASE[k]||[];const factor=demoStep===0?0:1;state[k]={progress:k==='pres'?p:Math.min(100,p+4),candidates:base.map((x,i)=>({name:x[0],pct:x[1]*factor,seq:i+1,id:String(i+1)})),generatedAt:nowStamp()}});
  renderAll();
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
function renderRows(k){const items=(state[k].candidates||[]).slice(0,4),box=$('#'+k+'Rows');box.innerHTML=items.length?items.map(c=>'<div class="candidate-row"><span class="name" title="'+esc(c.name)+'">'+esc(c.name)+'</span><span class="bar"><i style="width:'+Math.min(100,c.pct)+'%"></i></span><span class="pct">'+fmtPct(c.pct)+'</span></div>').join(''):'<div class="more">Aguardando dados.</div>';$('#'+k+'Small').textContent=fmtPct(state[k].progress)+' das seções totalizadas';$('#'+k+'More').textContent=state[k].candidates.length>4?'+ '+(state[k].candidates.length-4)+' candidato(s) no arquivo':'Ordem conforme a fonte de dados'}
function renderAll(){['pres','gov','sen','depf','depe'].forEach(renderRows);const br=state.pres.progress,rn=Math.max(state.gov.progress,state.sen.progress,state.depf.progress,state.depe.progress);$('#brProgressText').textContent=fmtPct(br);$('#brProgressBar').style.width=Math.min(100,br)+'%';$('#rnProgressText').textContent=fmtPct(rn);$('#rnProgressBar').style.width=Math.min(100,rn)+'%';$('#updatedAt').textContent=state[selectedOffice].generatedAt||'—';$('#sourceHint').textContent=mode==='demo'?'Dados de demonstração':'Dados do '+MODE_LABELS[mode];$('#liveLabel').textContent=mode==='demo'?'Demonstração':mode==='sim'?'Simulado TSE':'TSE';$('#modeBtn').textContent='Modo: '+MODE_LABELS[mode];$('#demoControls').classList.toggle('show',mode==='demo');$('#demoStepLabel').textContent='Etapa '+(demoStep+1)+' de '+DEMO_PROGRESS.length;regenerate()}
function populateScopeSelect(){const scopes=officeMeta[selectedOffice].scopes,sel=$('#scopeSelect');sel.innerHTML=scopes.map(s=>'<option value="'+s.value+'">'+s.label+'</option>').join('');if(!scopes.some(s=>s.value===selectedScope))selectedScope=officeMeta[selectedOffice].defaultScope;sel.value=selectedScope}
function selectOffice(k){selectedOffice=k;$('#officeSelect').value=k;selectedScope=officeMeta[k].defaultScope;populateScopeSelect();$$('.result-card').forEach(el=>el.classList.toggle('selected',el.dataset.office===k));$$('[data-pick]').forEach(b=>b.classList.toggle('active',b.dataset.pick===k));regenerate()}
function makePostText(){const d=state[selectedOffice],m=officeMeta[selectedOffice],time=(d.generatedAt||'').split('·').pop().trim().slice(0,5),lines=['ELEIÇÕES 2026'+(time?' | '+time:''),m.title+' · '+scopeLabel(),fmtPct(d.progress)+' das seções totalizadas',''];d.candidates.slice(0,4).forEach(c=>lines.push(c.name+' — '+fmtPct(c.pct)));lines.push('','Fonte: TSE');return lines.join('\n')}
function roundRect(ctx,x,y,w,h,r){r=Math.min(r,w/2,h/2);ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath()}
const logoImg=new Image();logoImg.crossOrigin='anonymous';logoImg.src=LOGO_URL;logoImg.onload=()=>drawCanvas();
function drawCanvas(){
  const c=$('#shareCanvas'),ctx=c.getContext('2d'),d=state[selectedOffice],m=officeMeta[selectedOffice];ctx.clearRect(0,0,1080,1080);ctx.fillStyle='#f4f6f7';ctx.fillRect(0,0,1080,1080);ctx.fillStyle='rgba(245,196,0,.13)';ctx.beginPath();ctx.arc(1010,80,330,0,Math.PI*2);ctx.fill();
  if(logoImg.complete)ctx.drawImage(logoImg,70,54,100,100);
  ctx.fillStyle='#17191c';ctx.font='700 40px Inter,Segoe UI,Arial';ctx.fillText('UEFY Eleições',190,112);ctx.fillStyle='#17191c';ctx.font='600 18px Inter,Segoe UI,Arial';ctx.fillText(mode==='demo'?'DEMONSTRAÇÃO':'DADOS OFICIAIS DO TSE',760,105);
  ctx.fillStyle='#17191c';ctx.font='700 78px Inter,Segoe UI,Arial';ctx.fillText('Eleições 2026',70,245);ctx.font='600 44px Inter,Segoe UI,Arial';ctx.fillText(m.title+' · '+scopeLabel(),70,310);
  const kind=mapKind(),fc=kind==='rn'?maps.rn:maps.br;if(fc){const x=kind==='rn'?610:680,y=kind==='rn'?145:180,w=kind==='rn'?390:315,h=kind==='rn'?310:250;drawGeoJSON(ctx,fc,x,y,w,h)}
  ctx.fillStyle='#58616a';ctx.font='600 27px Inter,Segoe UI,Arial';ctx.fillText('Seções totalizadas',70,390);ctx.fillStyle='#17191c';ctx.font='800 62px Inter,Segoe UI,Arial';ctx.fillText(fmtPct(d.progress),70,458);ctx.fillStyle='#e0e5e9';roundRect(ctx,280,410,330,20,10);ctx.fill();ctx.fillStyle='#f5c400';roundRect(ctx,280,410,330*Math.min(100,d.progress)/100,20,10);ctx.fill();
  let yy=555;d.candidates.slice(0,4).forEach((cand,i)=>{ctx.fillStyle='#25292e';ctx.font='700 31px Inter,Segoe UI,Arial';ctx.fillText(cand.name.length>24?cand.name.slice(0,23)+'…':cand.name,70,yy);ctx.fillStyle='#e3e7ea';roundRect(ctx,70,yy+26,675,23,12);ctx.fill();ctx.fillStyle=i===0?'#f5c400':'#a8b2bc';roundRect(ctx,70,yy+26,675*Math.min(100,cand.pct)/100,23,12);ctx.fill();ctx.fillStyle='#17191c';ctx.font='800 35px Inter,Segoe UI,Arial';ctx.textAlign='right';ctx.fillText(fmtPct(cand.pct),980,yy+8);ctx.textAlign='left';yy+=102});
  ctx.strokeStyle='#d3d9de';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(70,965);ctx.lineTo(1010,965);ctx.stroke();ctx.fillStyle='#58616a';ctx.font='600 20px Inter,Segoe UI,Arial';ctx.fillText(mode==='demo'?'Dados fictícios para demonstração':'Fonte: Tribunal Superior Eleitoral',70,1008);ctx.textAlign='right';ctx.fillText(d.generatedAt||nowStamp(),1010,1008);ctx.textAlign='left';
}
function regenerate(){const t=makePostText();$('#postText').value=t;$('#charCount').textContent=t.length+'/280';drawCanvas()}
function flash(btn,t){const old=btn.textContent;btn.textContent=t;setTimeout(()=>btn.textContent=old,1200)}
$('#officeSelect').onchange=e=>selectOffice(e.target.value);$('#scopeSelect').onchange=e=>{selectedScope=e.target.value;if(mode==='demo')applyDemo();else regenerate()};$$('[data-pick]').forEach(b=>b.onclick=()=>selectOffice(b.dataset.pick));
$('#modeBtn').onclick=()=>{mode=MODES[(MODES.indexOf(mode)+1)%MODES.length];mode==='demo'?applyDemo():(renderAll(),loadRemote())};$('#refreshBtn').onclick=()=>mode==='demo'?applyDemo():loadRemote();
$('#demoNext').onclick=()=>{demoStep=Math.min(DEMO_PROGRESS.length-1,demoStep+1);applyDemo()};$('#demoBack').onclick=()=>{demoStep=Math.max(0,demoStep-1);applyDemo()};$('#demoReset').onclick=()=>{demoStep=0;applyDemo()};
$('#postText').oninput=e=>$('#charCount').textContent=e.target.value.length+'/280';$('#copyText').onclick=async()=>{await navigator.clipboard.writeText($('#postText').value);flash($('#copyText'),'Copiado!')};$('#copyImage').onclick=async()=>{try{const b=await new Promise(r=>$('#shareCanvas').toBlob(r,'image/png'));await navigator.clipboard.write([new ClipboardItem({'image/png':b})]);flash($('#copyImage'),'Imagem copiada!')}catch{alert('Use “Baixar imagem” neste navegador.')}};$('#downloadImage').onclick=()=>{const a=document.createElement('a');a.download='uefy-eleicoes-2026-'+selectedOffice+'.png';a.href=$('#shareCanvas').toDataURL('image/png');a.click()};$('#openX').onclick=()=>window.open('https://twitter.com/intent/tweet?text='+encodeURIComponent($('#postText').value),'_blank','noopener,noreferrer');
const theme=$('#themeToggle');if(localStorage.getItem('uefy-eleicoes-theme')==='dark')document.body.classList.add('dark');theme.onclick=()=>{document.body.classList.toggle('dark');localStorage.setItem('uefy-eleicoes-theme',document.body.classList.contains('dark')?'dark':'light')};
const topBtn=$('#toTop');window.addEventListener('scroll',()=>topBtn.classList.toggle('show',scrollY>420),{passive:true});topBtn.onclick=()=>scrollTo({top:0,behavior:'smooth'});
populateScopeSelect();applyDemo();loadMaps().catch(()=>{$('#statusText').textContent='Os mapas não puderam ser carregados.'});