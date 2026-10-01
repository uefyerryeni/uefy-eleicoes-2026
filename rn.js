const $=s=>document.querySelector(s);
const LOGO_URL='https://uefyerryeni.github.io/uefyerryeni-logo.png';
const OFFICE={gov:{title:'Governador',cargo:'0003'}};
let fc=null,selectedFeature=null,office='gov',mode='demo',current={progress:0,candidates:[],generatedAt:null};
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
  if(mode==='demo')loadRnCandidates();else loadRemote();
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
  const found=all.find(m=>(!m.uf||m.uf==='rn')&&norm(m.name)===target)||all.find(m=>norm(m.name)===target);
  if(!found)throw new Error('Município não encontrado na configuração do TSE');
  return found.code;
}
function resultUrl(code){
  const election=mode==='sim'?'21272':'6259',el=String(election).padStart(6,'0'),base=mode==='sim'?'https://resultados-sim.tse.jus.br/simulado/simulado2026/ele2026':'https://resultados.tse.jus.br/oficial/ele2026';
  return base+'/'+election+'/dados/rn/rn'+code+'-c'+OFFICE[office].cargo+'-e'+el+'-u.json';
}
function parseEA20(data){
  const out=[];(data.carg||[]).forEach(c=>(c.agr||[]).forEach(a=>(a.par||[]).forEach(p=>(p.cand||[]).forEach(cand=>out.push({id:String(cand.n||cand.nsqcand||''),number:String(cand.n||''),name:cand.nmu||cand.nm||(cand.n?'Número '+cand.n:'Nome não informado'),pct:Number(String(cand.pvap??0).replace(',','.'))||0,votes:Number(cand.vap||0),seq:Number(cand.seq||999999)})))));
  const progress=data.s&&data.s.pst!=null?Number(String(data.s.pst).replace(',','.')):(data.s&&data.s.ts?Number(data.s.st||0)/Number(data.s.ts)*100:0);
  return {progress:isFinite(progress)?progress:0,candidates:out.sort((a,b)=>b.pct-a.pct||a.seq-b.seq),generatedAt:[data.dg,data.hg].filter(Boolean).join(' · ')||nowStamp()};
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
  $('#rnRefresh').disabled=true;$('#rnRefresh').textContent='Carregando…';$('#rnStatus').textContent='Localizando o município na configuração do TSE…';
  try{
    const code=await municipalityCode(),r=await fetch(resultUrl(code),{cache:'no-store'});if(!r.ok)throw new Error('Resultado '+r.status);
    current=parseEA20(await r.json());
    if(mode==='official')current=await reconcileRnResult(current);
    if(mode==='sim'){
      $('#rnStatus').textContent='Dados de teste do Simulado TSE para este município. Não representam as candidaturas reais.';
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
    $('#rnResults').innerHTML=(current.candidates||[]).map(c=>'<div class="rn-result-line"><span>'+esc(c.name)+'</span><span class="bar"><i style="width:'+Math.min(100,c.pct)+'%"></i></span><b>'+fmtPct(c.pct)+'</b></div>').join('');
  }
  const t=makeText();$('#rnPostText').value=t;$('#rnChars').textContent=t.length+'/280';drawCanvas();
}
function makeText(){
  const name=selectedFeature?.properties?.nome||'Município';
  const lines=['ELEIÇÕES 2026',OFFICE[office].title+' · '+name+' (RN)'];
  if(mode==='demo'){
    lines.push(current.candidates.length+' candidatura(s) na base oficial','');
    current.candidates.slice(0,4).forEach(c=>lines.push(c.name+(c.number?' · '+c.number:'')+(c.party?' '+c.party:'')));
    lines.push('','Base oficial TSE · sem votos');
  }else{
    lines.push(fmtPct(current.progress)+' das seções totalizadas','');
    current.candidates.slice(0,4).forEach(c=>lines.push(c.name+' — '+fmtPct(c.pct)));
    lines.push('','Fonte: TSE');
  }
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
  if(!selectedFeature)return;
  const c=$('#rnCanvas'),ctx=c.getContext('2d'),name=selectedFeature.properties.nome;
  ctx.clearRect(0,0,1080,1080);ctx.fillStyle='#f4f6f7';ctx.fillRect(0,0,1080,1080);
  ctx.fillStyle='rgba(245,196,0,.13)';ctx.beginPath();ctx.arc(1010,80,330,0,Math.PI*2);ctx.fill();
  if(logo.complete)ctx.drawImage(logo,70,54,100,100);
  ctx.fillStyle='#17191c';ctx.font='700 40px Inter,Segoe UI,Arial';ctx.fillText('UEFY Eleições',190,112);
  ctx.font='600 18px Inter,Segoe UI,Arial';ctx.fillText(mode==='demo'?'CANDIDATURAS TSE · SEM VOTOS':'DADOS DO TSE',690,105);
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
      ctx.fillStyle=i===0?'#f5c400':'#a8b2bc';roundRect(ctx,70,yy+23,700*Math.min(100,cand.pct)/100,21,11);ctx.fill();
      ctx.fillStyle='#17191c';ctx.font='800 33px Inter,Segoe UI,Arial';ctx.textAlign='right';ctx.fillText(fmtPct(cand.pct),980,yy+6);ctx.textAlign='left';
      yy+=82;
    });
  }

  ctx.strokeStyle='#d3d9de';ctx.beginPath();ctx.moveTo(70,965);ctx.lineTo(1010,965);ctx.stroke();
  ctx.fillStyle='#58616a';ctx.font='600 20px Inter,Segoe UI,Arial';
  ctx.fillText(mode==='demo'?'Base de candidaturas: Tribunal Superior Eleitoral':'Fonte: Tribunal Superior Eleitoral',70,1008);
  ctx.textAlign='right';ctx.fillText(current.generatedAt||nowStamp(),1010,1008);ctx.textAlign='left';
}
async function shareRNImageAndText(openX=false,preopened=null){
  const canvas=$('#rnCanvas'),text=$('#rnPostText').value,name=selectedFeature?.properties?.nome||'rn';
  const blob=await new Promise(r=>canvas.toBlob(r,'image/png'));
  if(!blob){if(preopened)preopened.close();return}
  const file=new File([blob],`uefy-eleicoes-rn-${norm(name)}.png`,{type:'image/png'});
  const desktop=window.matchMedia?.('(pointer:fine)').matches&&window.innerWidth>820;
  if(!openX||!desktop){
    try{
      if(navigator.share&&navigator.canShare&&navigator.canShare({files:[file]})){
        await navigator.share({title:'UEFY Eleições · Rio Grande do Norte',text,files:[file]});
        if(preopened)preopened.close();
        return;
      }
    }catch(err){if(err?.name==='AbortError'){if(preopened)preopened.close();return}}
  }
  if(openX){
    let copied=false;
    try{
      if(navigator.clipboard&&window.ClipboardItem){
        await navigator.clipboard.write([new ClipboardItem({'image/png':blob})]);
        copied=true;
      }
    }catch{}
    const url='https://twitter.com/intent/tweet?text='+encodeURIComponent(text);
    if(preopened){preopened.opener=null;preopened.location.href=url}else window.open(url,'_blank','noopener,noreferrer');
    const b=$('#rnOpenX'),old=b.textContent;
    b.textContent=copied?'Imagem copiada · cole no X':'Imagem baixada · anexe no X';
    if(!copied){const dl=document.createElement('a');dl.download=file.name;dl.href=URL.createObjectURL(blob);dl.click();setTimeout(()=>URL.revokeObjectURL(dl.href),2000)}
    setTimeout(()=>b.textContent=old,2200);
    return;
  }
  const dl=document.createElement('a');dl.download=file.name;dl.href=URL.createObjectURL(blob);dl.click();setTimeout(()=>URL.revokeObjectURL(dl.href),2000);
  try{await navigator.clipboard.writeText(text)}catch{}
}
$('#munSearch').oninput=e=>renderList(e.target.value);

$('#rnMode').onchange=e=>{mode=e.target.value;$('#liveLabel').textContent=mode==='demo'?'Candidaturas TSE':mode==='sim'?'Simulado TSE':'TSE';mode==='demo'?loadRnCandidates():loadRemote()};
$('#rnRefresh').onclick=()=>mode==='demo'?loadRnCandidates():loadRemote();
$('#rnPostText').oninput=e=>$('#rnChars').textContent=e.target.value.length+'/280';
$('#rnCopyText').onclick=async()=>navigator.clipboard.writeText($('#rnPostText').value);
$('#rnDownload').onclick=()=>{const a=document.createElement('a');a.download='uefy-eleicoes-rn-'+norm(selectedFeature.properties.nome)+'.png';a.href=$('#rnCanvas').toDataURL('image/png');a.click()};
$('#rnOpenX').onclick=()=>{const desktop=window.matchMedia?.('(pointer:fine)').matches&&window.innerWidth>820;const w=desktop?window.open('about:blank','_blank'):null;shareRNImageAndText(true,w)};$('#rnShareBundle').onclick=()=>shareRNImageAndText(false);
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
document.querySelector('#refreshAll')?.addEventListener('click',async e=>{const b=e.currentTarget;b.classList.add('loading');b.disabled=true;try{if(mode==='demo')await loadRnCandidates();else await loadRemote();renderFavStrip()}finally{setTimeout(()=>{b.classList.remove('loading');b.disabled=false},450)}});
renderFavStrip();
const _uefyInitFav=setInterval(()=>{if(fc&&selectedFeature){clearInterval(_uefyInitFav);const q=new URLSearchParams(location.search),m=q.get('fav');if(m){const ft=fc.features.find(x=>norm(x.properties.nome)===norm(m));if(ft)selectMunicipality(ft)}syncFavButton();renderFavStrip()}},100);
