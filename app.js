const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const MODES=['demo','sim','official'], MODE_LABELS={demo:'demonstração',sim:'simulado TSE',official:'oficial TSE'};
const ENDPOINTS={sim:{pres:'https://resultados-sim.tse.jus.br/simulado/simulado2026/ele2026/21270/dados/br/br-c0001-e021270-u.json',gov:'https://resultados-sim.tse.jus.br/simulado/simulado2026/ele2026/21272/dados/rn/rn-c0003-e021272-u.json',sen:'https://resultados-sim.tse.jus.br/simulado/simulado2026/ele2026/21272/dados/rn/rn-c0005-e021272-u.json'},official:{pres:'https://resultados.tse.jus.br/oficial/ele2026/6257/dados/br/br-c0001-e006257-u.json',gov:'https://resultados.tse.jus.br/oficial/ele2026/6259/dados/rn/rn-c0003-e006259-u.json',sen:'https://resultados.tse.jus.br/oficial/ele2026/6259/dados/rn/rn-c0005-e006259-u.json'}};
const officeMeta={pres:{title:'Presidência',scope:'Brasil',scopeCode:'br'},gov:{title:'Governo do RN',scope:'Rio Grande do Norte',scopeCode:'rn'},sen:{title:'Senado RN',scope:'Rio Grande do Norte',scopeCode:'rn'}};
const demoStages=[
{p:0,rn:0,pres:[['Candidato 01',0],['Candidato 02',0],['Candidato 03',0],['Candidato 04',0]],gov:[['Candidato 11',0],['Candidato 12',0],['Candidato 13',0],['Candidato 14',0]],sen:[['Candidato 21',0],['Candidato 22',0],['Candidato 23',0],['Candidato 24',0]]},
{p:6.4,rn:8.1,pres:[['Candidato 01',46.8],['Candidato 02',44.1],['Candidato 03',6.5],['Candidato 04',2.6]],gov:[['Candidato 11',49.9],['Candidato 12',39.8],['Candidato 13',7.1],['Candidato 14',3.2]],sen:[['Candidato 21',42.6],['Candidato 22',35.4],['Candidato 23',15.8],['Candidato 24',6.2]]},
{p:22.7,rn:28.9,pres:[['Candidato 01',47.5],['Candidato 02',44.5],['Candidato 03',5.9],['Candidato 04',2.1]],gov:[['Candidato 11',51.0],['Candidato 12',39.1],['Candidato 13',6.6],['Candidato 14',3.3]],sen:[['Candidato 21',43.8],['Candidato 22',35.0],['Candidato 23',15.4],['Candidato 24',5.8]]},
{p:51.3,rn:59.5,pres:[['Candidato 01',48.1],['Candidato 02',44.3],['Candidato 03',5.6],['Candidato 04',2.0]],gov:[['Candidato 11',51.8],['Candidato 12',38.7],['Candidato 13',6.3],['Candidato 14',3.2]],sen:[['Candidato 21',44.2],['Candidato 22',34.6],['Candidato 23',15.5],['Candidato 24',5.7]]},
{p:82.6,rn:88.2,pres:[['Candidato 01',48.4],['Candidato 02',44.0],['Candidato 03',5.7],['Candidato 04',1.9]],gov:[['Candidato 11',52.0],['Candidato 12',38.5],['Candidato 13',6.2],['Candidato 14',3.3]],sen:[['Candidato 21',44.5],['Candidato 22',34.4],['Candidato 23',15.3],['Candidato 24',5.8]]},
{p:100,rn:100,pres:[['Candidato 01',48.5],['Candidato 02',43.9],['Candidato 03',5.7],['Candidato 04',1.9]],gov:[['Candidato 11',52.1],['Candidato 12',38.4],['Candidato 13',6.2],['Candidato 14',3.3]],sen:[['Candidato 21',44.6],['Candidato 22',34.3],['Candidato 23',15.3],['Candidato 24',5.8]]}
];
let mode='demo',demoStep=0,selectedOffice='pres',maps={br:null,rn:null};
let state={pres:{progress:0,candidates:[]},gov:{progress:0,candidates:[]},sen:{progress:0,candidates:[]}};

function fmtPct(v){return Number(v||0).toLocaleString('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:2})+'%'}
function nowStamp(){return new Date().toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'})}
function esc(s){return String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}

async function loadMaps(){
  const [br,rn]=await Promise.all([fetch('assets/maps/br-estados.geojson').then(r=>r.json()),fetch('assets/maps/rn-municipios.geojson').then(r=>r.json())]);
  maps={br,rn}; renderGeoJSON($('#brMap'),br); renderGeoJSON($('#rnMap'),rn); drawCanvas();
}

function coordsOfGeometry(g,out=[]){
  if(!g)return out;
  if(g.type==='Polygon')g.coordinates.forEach(r=>r.forEach(p=>out.push(p)));
  else if(g.type==='MultiPolygon')g.coordinates.forEach(poly=>poly.forEach(r=>r.forEach(p=>out.push(p))));
  return out;
}
function boundsOf(fc){
  const pts=[];fc.features.forEach(f=>coordsOfGeometry(f.geometry,pts));
  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  pts.forEach(([x,y])=>{minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y)});
  return {minX,minY,maxX,maxY};
}
function projector(fc,w,h,pad=12){
  const b=boundsOf(fc), sx=(w-pad*2)/(b.maxX-b.minX), sy=(h-pad*2)/(b.maxY-b.minY), s=Math.min(sx,sy);
  const ox=(w-(b.maxX-b.minX)*s)/2, oy=(h-(b.maxY-b.minY)*s)/2;
  return ([x,y])=>[ox+(x-b.minX)*s,h-(oy+(y-b.minY)*s)];
}
function ringPath(ring,proj){return ring.map((p,i)=>{const [x,y]=proj(p);return (i?'L':'M')+x.toFixed(2)+' '+y.toFixed(2)}).join(' ')+' Z'}
function geometryPath(g,proj){
  if(g.type==='Polygon')return g.coordinates.map(r=>ringPath(r,proj)).join(' ');
  if(g.type==='MultiPolygon')return g.coordinates.flatMap(poly=>poly.map(r=>ringPath(r,proj))).join(' ');
  return '';
}
function renderGeoJSON(svg,fc){
  const proj=projector(fc,420,300,10);
  svg.innerHTML=fc.features.map(f=>'<path class="map-feature" d="'+geometryPath(f.geometry,proj)+'"></path>').join('');
}
function drawGeoJSON(ctx,fc,x,y,w,h){
  if(!fc)return;const proj=projector(fc,w,h,5);
  ctx.save();ctx.translate(x,y);ctx.fillStyle='#f5c400';ctx.strokeStyle='#fff';ctx.lineWidth=1.4;
  fc.features.forEach(f=>{
    const g=f.geometry, polys=g.type==='Polygon'?[g.coordinates]:g.type==='MultiPolygon'?g.coordinates:[];
    polys.forEach(poly=>{ctx.beginPath();poly.forEach(ring=>ring.forEach((p,i)=>{const [px,py]=proj(p);i?ctx.lineTo(px,py):ctx.moveTo(px,py)}));ctx.closePath();ctx.fill('evenodd');ctx.stroke()});
  });ctx.restore();
}

function flattenCandidates(data){
  const out=[];(data.carg||[]).forEach(c=>(c.agr||[]).forEach(a=>(a.par||[]).forEach(p=>(p.cand||[]).forEach(cand=>out.push({name:cand.nmu||cand.nm||('Candidato '+(cand.n||'')),pct:Number(String(cand.pvap??0).replace(',','.'))||0,seq:Number(cand.seq||999999)})))));
  return out.sort((a,b)=>a.seq-b.seq);
}
function parseEA20(data){
  const progress=data.s&&data.s.pst!=null?Number(String(data.s.pst).replace(',','.')):(data.s&&data.s.ts?Number(data.s.st||0)/Number(data.s.ts)*100:0);
  return {progress:isFinite(progress)?progress:0,candidates:flattenCandidates(data),generatedAt:[data.dg,data.hg].filter(Boolean).join(' · ')||nowStamp()};
}
function applyDemo(){
  const d=demoStages[demoStep];
  state.pres={progress:d.p,candidates:d.pres.map((x,i)=>({name:x[0],pct:x[1],seq:i+1})),generatedAt:nowStamp()};
  state.gov={progress:d.rn,candidates:d.gov.map((x,i)=>({name:x[0],pct:x[1],seq:i+1})),generatedAt:nowStamp()};
  state.sen={progress:d.rn,candidates:d.sen.map((x,i)=>({name:x[0],pct:x[1],seq:i+1})),generatedAt:nowStamp()};
  renderAll();
}
async function loadRemote(){
  $('#refreshBtn').textContent='Carregando…';$('#refreshBtn').disabled=true;
  try{
    const keys=['pres','gov','sen'], vals=await Promise.all(keys.map(k=>fetch(ENDPOINTS[mode][k],{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error(r.status);return r.json()})));
    keys.forEach((k,i)=>state[k]=parseEA20(vals[i]));
    $('#statusTitle').textContent='Dados carregados';$('#statusText').textContent='Arquivos recebidos do ambiente '+MODE_LABELS[mode]+'.';renderAll();
  }catch(e){$('#statusTitle').textContent='Fonte indisponível';$('#statusText').textContent='Não foi possível carregar os arquivos agora. O modo demonstração continua disponível.'}
  finally{$('#refreshBtn').textContent='Atualizar dados';$('#refreshBtn').disabled=false}
}
function renderRows(k){
  const items=state[k].candidates.slice(0,4);$('#'+k+'Rows').innerHTML=items.map(c=>'<div class="candidate-row"><span class="name" title="'+esc(c.name)+'">'+esc(c.name)+'</span><span class="bar"><i style="width:'+Math.min(100,c.pct)+'%"></i></span><span class="pct">'+fmtPct(c.pct)+'</span></div>').join('');
  $('#'+k+'Small').textContent=fmtPct(state[k].progress)+' das seções totalizadas';$('#'+k+'More').textContent=state[k].candidates.length>4?'+ '+(state[k].candidates.length-4)+' candidato(s) no arquivo':'Ordem conforme a fonte de dados';
}
function renderAll(){
  ['pres','gov','sen'].forEach(renderRows);const br=state.pres.progress,rn=Math.max(state.gov.progress,state.sen.progress);
  $('#brProgressText').textContent=fmtPct(br);$('#brProgressBar').style.width=Math.min(100,br)+'%';$('#rnProgressText').textContent=fmtPct(rn);$('#rnProgressBar').style.width=Math.min(100,rn)+'%';
  $('#updatedAt').textContent=state[selectedOffice].generatedAt||'—';$('#sourceHint').textContent=mode==='demo'?'Dados de demonstração':'Dados do '+MODE_LABELS[mode];$('#liveLabel').textContent=mode==='demo'?'Demonstração':mode==='sim'?'Simulado TSE':'TSE';$('#modeBtn').textContent='Modo: '+MODE_LABELS[mode];$('#demoControls').classList.toggle('show',mode==='demo');$('#demoStepLabel').textContent='Etapa '+(demoStep+1)+' de '+demoStages.length;regenerate();
}
function selectOffice(k){selectedOffice=k;$('#officeSelect').value=k;$('#scopeSelect').value=officeMeta[k].scopeCode;$$('.result-card').forEach(el=>el.classList.toggle('selected',el.dataset.office===k));$$('[data-pick]').forEach(b=>b.classList.toggle('active',b.dataset.pick===k));regenerate()}
function makePostText(){
  const d=state[selectedOffice],m=officeMeta[selectedOffice],time=(d.generatedAt||'').split('·').pop().trim().slice(0,5);const lines=['ELEIÇÕES 2026'+(time?' | '+time:''),m.title+' · '+m.scope,fmtPct(d.progress)+' das seções totalizadas',''];d.candidates.slice(0,4).forEach(c=>lines.push(c.name+' — '+fmtPct(c.pct)));lines.push('','Fonte: TSE');return lines.join('\n');
}
function roundRect(ctx,x,y,w,h,r){r=Math.min(r,w/2,h/2);ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath()}
function drawCanvas(){
  const c=$('#shareCanvas'),ctx=c.getContext('2d'),d=state[selectedOffice],m=officeMeta[selectedOffice];ctx.clearRect(0,0,1080,1080);ctx.fillStyle='#f4f6f7';ctx.fillRect(0,0,1080,1080);
  ctx.fillStyle='rgba(245,196,0,.13)';ctx.beginPath();ctx.arc(1010,80,330,0,Math.PI*2);ctx.fill();
  const logo=new Image();logo.src='assets/brand.svg';if(logo.complete)ctx.drawImage(logo,70,62,86,86);
  ctx.fillStyle='#17191c';ctx.font='650 30px Inter,Segoe UI,Arial';ctx.fillText('UEFY Eleições',178,93);ctx.fillStyle='#58616a';ctx.font='400 18px Inter,Segoe UI,Arial';ctx.fillText('Observatório por Uefyerryeni',178,121);
  ctx.fillStyle='#17191c';ctx.font='650 64px Inter,Segoe UI,Arial';ctx.fillText('Eleições 2026',70,238);ctx.font='500 34px Inter,Segoe UI,Arial';ctx.fillText(m.title+' · '+m.scope,70,292);
  drawGeoJSON(ctx,m.scopeCode==='br'?maps.br:maps.rn,690,185,300,240);
  ctx.fillStyle='#58616a';ctx.font='500 22px Inter,Segoe UI,Arial';ctx.fillText('Seções totalizadas',70,370);ctx.fillStyle='#17191c';ctx.font='700 49px Inter,Segoe UI,Arial';ctx.fillText(fmtPct(d.progress),70,425);ctx.fillStyle='#e0e5e9';roundRect(ctx,250,389,365,18,9);ctx.fill();ctx.fillStyle='#f5c400';roundRect(ctx,250,389,365*Math.min(100,d.progress)/100,18,9);ctx.fill();
  let yy=525;d.candidates.slice(0,4).forEach((cand,i)=>{ctx.fillStyle='#25292e';ctx.font='600 24px Inter,Segoe UI,Arial';ctx.fillText(cand.name.length>25?cand.name.slice(0,24)+'…':cand.name,70,yy);ctx.fillStyle='#e3e7ea';roundRect(ctx,70,yy+22,660,20,10);ctx.fill();ctx.fillStyle=i===0?'#f5c400':'#a8b2bc';roundRect(ctx,70,yy+22,660*Math.min(100,cand.pct)/100,20,10);ctx.fill();ctx.fillStyle='#17191c';ctx.font='700 27px Inter,Segoe UI,Arial';ctx.textAlign='right';ctx.fillText(fmtPct(cand.pct),920,yy+4);ctx.textAlign='left';yy+=105});
  ctx.strokeStyle='#d3d9de';ctx.beginPath();ctx.moveTo(70,945);ctx.lineTo(1010,945);ctx.stroke();ctx.fillStyle='#58616a';ctx.font='500 18px Inter,Segoe UI,Arial';ctx.fillText(mode==='demo'?'Dados fictícios para demonstração':'Fonte: Tribunal Superior Eleitoral',70,985);ctx.textAlign='right';ctx.fillText(d.generatedAt||nowStamp(),1010,985);ctx.textAlign='left';
}
function regenerate(){const t=makePostText();$('#postText').value=t;$('#charCount').textContent=t.length+'/280';drawCanvas()}
function flash(btn,t){const old=btn.textContent;btn.textContent=t;setTimeout(()=>btn.textContent=old,1200)}
$('#officeSelect').onchange=e=>selectOffice(e.target.value);$('#scopeSelect').onchange=e=>{e.target.value=officeMeta[selectedOffice].scopeCode};$$('[data-pick]').forEach(b=>b.onclick=()=>selectOffice(b.dataset.pick));
$('#modeBtn').onclick=()=>{mode=MODES[(MODES.indexOf(mode)+1)%MODES.length];mode==='demo'?applyDemo():(renderAll(),loadRemote())};$('#refreshBtn').onclick=()=>mode==='demo'?applyDemo():loadRemote();
$('#demoNext').onclick=()=>{demoStep=Math.min(demoStages.length-1,demoStep+1);applyDemo()};$('#demoBack').onclick=()=>{demoStep=Math.max(0,demoStep-1);applyDemo()};$('#demoReset').onclick=()=>{demoStep=0;applyDemo()};
$('#postText').oninput=e=>$('#charCount').textContent=e.target.value.length+'/280';$('#copyText').onclick=async()=>{await navigator.clipboard.writeText($('#postText').value);flash($('#copyText'),'Copiado!')};$('#copyImage').onclick=async()=>{try{const b=await new Promise(r=>$('#shareCanvas').toBlob(r,'image/png'));await navigator.clipboard.write([new ClipboardItem({'image/png':b})]);flash($('#copyImage'),'Imagem copiada!')}catch{alert('Use “Baixar imagem” neste navegador.')}};$('#downloadImage').onclick=()=>{const a=document.createElement('a');a.download='uefy-eleicoes-2026-'+selectedOffice+'.png';a.href=$('#shareCanvas').toDataURL('image/png');a.click()};$('#openX').onclick=()=>window.open('https://twitter.com/intent/tweet?text='+encodeURIComponent($('#postText').value),'_blank','noopener,noreferrer');
const theme=$('#themeToggle');if(localStorage.getItem('uefy-eleicoes-theme')==='dark')document.body.classList.add('dark');theme.onclick=()=>{document.body.classList.toggle('dark');localStorage.setItem('uefy-eleicoes-theme',document.body.classList.contains('dark')?'dark':'light')};
const topBtn=$('#toTop');window.addEventListener('scroll',()=>topBtn.classList.toggle('show',scrollY>420),{passive:true});topBtn.onclick=()=>scrollTo({top:0,behavior:'smooth'});
applyDemo();loadMaps().catch(()=>{$('#statusText').textContent='Os mapas não puderam ser carregados.'});
