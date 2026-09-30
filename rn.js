const $=s=>document.querySelector(s);
const LOGO_URL='https://uefyerryeni.github.io/uefyerryeni-logo.png';
const OFFICE={gov:{title:'Governador',cargo:'0003'},sen:{title:'Senado',cargo:'0005'},depf:{title:'Deputado federal',cargo:'0006'},depe:{title:'Deputado estadual',cargo:'0007'}};
const DEMO={gov:[['Candidato 11',52.1],['Candidato 12',38.4],['Candidato 13',6.2],['Candidato 14',3.3]],sen:[['Candidato 21',44.6],['Candidato 22',34.3],['Candidato 23',15.3],['Candidato 24',5.8]],depf:[['Candidato 31',29.3],['Candidato 32',24.8],['Candidato 33',18.0],['Candidato 34',12.3]],depe:[['Candidato 41',20.7],['Candidato 42',18.9],['Candidato 43',13.8],['Candidato 44',11.0]]};
const PROGRESS=[0,8.5,27.4,53.8,81.2,100];
let fc=null,selectedFeature=null,office='gov',mode='demo',demoStep=0,current={progress:0,candidates:[],generatedAt:null};
const logo=new Image();logo.crossOrigin='anonymous';logo.src=LOGO_URL;logo.onload=()=>drawCanvas();

function norm(s){return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'')}
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
  selectedFeature=feature;$('#selectedMun').textContent=feature.properties.nome;markSelection();renderFocusMap();
  if(mode==='demo')applyDemo();else loadRemote();
}
function applyDemo(){
  const p=PROGRESS[demoStep],base=DEMO[office];
  current={progress:p,candidates:base.map((x,i)=>({name:x[0],pct:demoStep===0?0:x[1],seq:i+1})),generatedAt:nowStamp()};
  $('#rnStatus').textContent='Demonstração com dados fictícios.';renderCurrent();
}
function municipalConfigUrl(){
  if(mode==='sim')return 'https://resultados-sim.tse.jus.br/simulado/simulado2026/ele2026/21270/config/mun-e021270-cm.json';
  return 'https://resultados.tse.jus.br/oficial/ele2026/6257/config/mun-e006257-cm.json';
}
function extractMunicipalities(data){
  const out=[];
  const walk=(node,uf=null)=>{
    if(Array.isArray(node)){node.forEach(x=>walk(x,uf));return}
    if(!node||typeof node!=='object')return;
    const localUf=String(node.sg||node.uf||node.cdabr||node.abr||uf||'').toLowerCase();
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
async function municipalityCode(){
  const cfg=await fetch(municipalConfigUrl(),{cache:'no-store'});if(!cfg.ok)throw new Error('Config '+cfg.status);
  const all=extractMunicipalities(await cfg.json());
  const target=norm(selectedFeature.properties.nome);
  const found=all.find(m=>(!m.uf||m.uf==='rn')&&norm(m.name)===target)||all.find(m=>norm(m.name)===target);
  if(!found)throw new Error('Município não encontrado na configuração do TSE');
  return found.code;
}
function resultUrl(code){
  const election=mode==='sim'?'21272':'6259',el=String(election).padStart(6,'0'),base=mode==='sim'?'https://resultados-sim.tse.jus.br/simulado/simulado2026/ele2026':'https://resultados.tse.jus.br/oficial/ele2026';
  return base+'/'+election+'/dados/rn/rn'+code+'-c'+OFFICE[office].cargo+'-e'+el+'-u.json';
}
function parseEA20(data){
  const out=[];(data.carg||[]).forEach(c=>(c.agr||[]).forEach(a=>(a.par||[]).forEach(p=>(p.cand||[]).forEach(cand=>out.push({name:cand.nmu||cand.nm||('Candidato '+(cand.n||'')),pct:Number(String(cand.pvap??0).replace(',','.'))||0,seq:Number(cand.seq||999999)})))));
  const progress=data.s&&data.s.pst!=null?Number(String(data.s.pst).replace(',','.')):(data.s&&data.s.ts?Number(data.s.st||0)/Number(data.s.ts)*100:0);
  return {progress:isFinite(progress)?progress:0,candidates:out.sort((a,b)=>a.seq-b.seq),generatedAt:[data.dg,data.hg].filter(Boolean).join(' · ')||nowStamp()};
}
async function loadRemote(){
  $('#rnRefresh').disabled=true;$('#rnRefresh').textContent='Carregando…';$('#rnStatus').textContent='Localizando o município na configuração do TSE…';
  try{
    const code=await municipalityCode(),r=await fetch(resultUrl(code),{cache:'no-store'});if(!r.ok)throw new Error('Resultado '+r.status);
    current=parseEA20(await r.json());$('#rnStatus').textContent='Dados carregados do '+(mode==='sim'?'simulado':'ambiente oficial')+' do TSE.';renderCurrent();
  }catch(e){$('#rnStatus').textContent='Não foi possível carregar este município agora: '+e.message}
  finally{$('#rnRefresh').disabled=false;$('#rnRefresh').textContent='Atualizar'}
}
function renderCurrent(){
  $('#rnProgress').textContent=fmtPct(current.progress);
  $('#rnResults').innerHTML=(current.candidates||[]).slice(0,4).map(c=>'<div class="rn-result-line"><span>'+c.name+'</span><span class="bar"><i style="width:'+Math.min(100,c.pct)+'%"></i></span><b>'+fmtPct(c.pct)+'</b></div>').join('');
  const t=makeText();$('#rnPostText').value=t;$('#rnChars').textContent=t.length+'/280';drawCanvas();
}
function makeText(){
  const name=selectedFeature?.properties?.nome||'Município';
  const lines=['ELEIÇÕES 2026',OFFICE[office].title+' · '+name+' (RN)',fmtPct(current.progress)+' das seções totalizadas',''];
  current.candidates.slice(0,4).forEach(c=>lines.push(c.name+' — '+fmtPct(c.pct)));lines.push('','Fonte: TSE');return lines.join('\n');
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
  if(!selectedFeature)return;
  const c=$('#rnCanvas'),ctx=c.getContext('2d'),name=selectedFeature.properties.nome;ctx.clearRect(0,0,1080,1080);ctx.fillStyle='#f4f6f7';ctx.fillRect(0,0,1080,1080);ctx.fillStyle='rgba(245,196,0,.13)';ctx.beginPath();ctx.arc(1010,80,330,0,Math.PI*2);ctx.fill();
  if(logo.complete)ctx.drawImage(logo,70,54,100,100);
  ctx.fillStyle='#17191c';ctx.font='700 40px Inter,Segoe UI,Arial';ctx.fillText('UEFY Eleições',190,112);ctx.font='600 18px Inter,Segoe UI,Arial';ctx.fillText(mode==='demo'?'DEMONSTRAÇÃO':'DADOS DO TSE',790,105);
  drawFocusedMunicipality(ctx,selectedFeature,555,115,470,350);
  ctx.fillStyle='#17191c';ctx.font='700 76px Inter,Segoe UI,Arial';ctx.fillText('Eleições 2026',70,235);
  fitCanvasText(ctx,OFFICE[office].title,70,300,440,44,32,'700','#17191c');
  fitCanvasText(ctx,name+' · RN',70,344,440,32,23,'600','#4d555d');

  ctx.fillStyle='#58616a';ctx.font='600 24px Inter,Segoe UI,Arial';ctx.fillText('Seções totalizadas',70,470);
  ctx.fillStyle='#17191c';ctx.font='800 60px Inter,Segoe UI,Arial';ctx.fillText(fmtPct(current.progress),70,535);
  ctx.fillStyle='#e0e5e9';roundRect(ctx,285,492,690,22,11);ctx.fill();
  ctx.fillStyle='#f5c400';roundRect(ctx,285,492,690*Math.min(100,current.progress)/100,22,11);ctx.fill();

  let yy=620;current.candidates.slice(0,4).forEach((cand,i)=>{
    ctx.fillStyle='#25292e';ctx.font='700 29px Inter,Segoe UI,Arial';
    ctx.fillText(cand.name.length>27?cand.name.slice(0,26)+'…':cand.name,70,yy);
    ctx.fillStyle='#e3e7ea';roundRect(ctx,70,yy+23,700,21,11);ctx.fill();
    ctx.fillStyle=i===0?'#f5c400':'#a8b2bc';roundRect(ctx,70,yy+23,700*Math.min(100,cand.pct)/100,21,11);ctx.fill();
    ctx.fillStyle='#17191c';ctx.font='800 33px Inter,Segoe UI,Arial';ctx.textAlign='right';ctx.fillText(fmtPct(cand.pct),980,yy+6);ctx.textAlign='left';
    yy+=82;
  });
  ctx.strokeStyle='#d3d9de';ctx.beginPath();ctx.moveTo(70,965);ctx.lineTo(1010,965);ctx.stroke();ctx.fillStyle='#58616a';ctx.font='600 20px Inter,Segoe UI,Arial';ctx.fillText(mode==='demo'?'Dados fictícios para demonstração':'Fonte: Tribunal Superior Eleitoral',70,1008);ctx.textAlign='right';ctx.fillText(current.generatedAt||nowStamp(),1010,1008);ctx.textAlign='left';
}
async function shareRNImageAndText(){
  const canvas=$('#rnCanvas'),text=$('#rnPostText').value,name=selectedFeature?.properties?.nome||'rn';
  const blob=await new Promise(r=>canvas.toBlob(r,'image/png'));
  if(!blob)return;
  const file=new File([blob],`uefy-eleicoes-rn-${norm(name)}.png`,{type:'image/png'});
  try{
    if(navigator.share && navigator.canShare && navigator.canShare({files:[file]})){
      await navigator.share({title:'UEFY Eleições · Rio Grande do Norte',text,files:[file]});
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
$('#munSearch').oninput=e=>renderList(e.target.value);
$('#rnOffice').onchange=e=>{office=e.target.value;mode==='demo'?applyDemo():loadRemote()};
$('#rnMode').onchange=e=>{mode=e.target.value;$('#liveLabel').textContent=mode==='demo'?'Demonstração':mode==='sim'?'Simulado TSE':'TSE';mode==='demo'?applyDemo():loadRemote()};
$('#rnRefresh').onclick=()=>mode==='demo'?applyDemo():loadRemote();
$('#rnNextDemo').onclick=()=>{demoStep=(demoStep+1)%PROGRESS.length;applyDemo()};
$('#rnPostText').oninput=e=>$('#rnChars').textContent=e.target.value.length+'/280';
$('#rnCopyText').onclick=async()=>navigator.clipboard.writeText($('#rnPostText').value);
$('#rnDownload').onclick=()=>{const a=document.createElement('a');a.download='uefy-eleicoes-rn-'+norm(selectedFeature.properties.nome)+'.png';a.href=$('#rnCanvas').toDataURL('image/png');a.click()};
$('#rnOpenX').onclick=()=>window.open('https://twitter.com/intent/tweet?text='+encodeURIComponent($('#rnPostText').value),'_blank','noopener,noreferrer');$('#rnShareBundle').onclick=shareRNImageAndText;
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
