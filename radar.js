const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const DATA_URL='data/radar-rn.json';
const LOGO_URL='https://uefyerryeni.github.io/uefyerryeni-logo.png';
const OFFICE_LABELS={sen:'Senador',depf:'Deputado federal',depe:'Deputado estadual'};
const TYPE_LABELS={territorial_coverage:'Presença municipal',capital_share:'Natal x interior',top_municipalities:'Concentração territorial',municipal_leads:'Primeiro lugar nos municípios'};
let radar={status:'loading',findings:[],offices:{}}, selected=null;
const pct=v=>Number(v||0).toLocaleString('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:1})+'%';
function flash(btn,text){if(!btn)return;const old=btn.textContent;btn.textContent=text;setTimeout(()=>btn.textContent=old,1800)}
function setStatus(msg,error=false){const el=$('#radarStatus');el.hidden=!msg;el.textContent=msg||'';el.classList.toggle('error',error)}
function escapeHtml(s=''){return String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}
function activeOffice(){return $('#officeFilter')?.value||'sen'}
async function loadRadar(){
  setStatus('Carregando a última leitura oficial do Radar RN…');
  try{
    const r=await fetch(DATA_URL+'?ts='+Date.now(),{cache:'no-store'});if(!r.ok)throw new Error('HTTP '+r.status);
    radar=await r.json();
    $('#sourceGenerated').textContent=radar.source_generated_at||radar.generated_at||'Aguardando resultados';
    $('#sourceMeta').textContent=(radar.source_name||'Tribunal Superior Eleitoral')+(radar.progress!=null?' · '+pct(radar.progress)+' das seções totalizadas':'');
    if(radar.source_url)$('#sourceLink').href=radar.source_url;
    $('#radarLive').textContent=radar.status==='ok'?'TSE oficial':'Aguardando TSE';
    if(radar.status!=='ok')setStatus(radar.message||'Os resultados oficiais ainda não estão disponíveis para o Radar RN.',false);else setStatus('');
    buildFilters();renderFindings();
  }catch(e){setStatus('Não foi possível carregar a leitura do Radar RN agora. A apuração principal continua independente desta área.',true);radar={status:'error',findings:[],offices:{}};buildFilters();renderFindings()}
}
function buildFilters(){
  const office=activeOffice(),c=$('#candidateFilter'),t=$('#typeFilter');
  const scoped=(radar.findings||[]).filter(f=>f.office===office);
  const names=[...new Set(scoped.map(f=>f.candidate).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
  c.innerHTML='<option value="all">Todas</option>'+names.map(n=>'<option value="'+escapeHtml(n)+'">'+escapeHtml(n)+'</option>').join('');
  const types=[...new Set(scoped.map(f=>f.type))];
  t.innerHTML='<option value="all">Todos os achados</option>'+types.map(x=>'<option value="'+x+'">'+(TYPE_LABELS[x]||x)+'</option>').join('');
}
function filtered(){
  const office=activeOffice(),c=$('#candidateFilter').value,t=$('#typeFilter').value;
  return (radar.findings||[]).filter(f=>f.office===office&&(c==='all'||f.candidate===c)&&(t==='all'||f.type===t));
}
function renderFindings(){
  const items=filtered();
  $('#findingCount').textContent=items.length===1?'1 achado disponível':items.length+' achados disponíveis';
  const grid=$('#findingsGrid');
  if(!items.length){
    const office=OFFICE_LABELS[activeOffice()];
    grid.innerHTML='<div class="no-findings">Ainda não há achados oficiais para '+escapeHtml(office)+'. Assim que os resultados do TSE estiverem disponíveis, o Radar passa a calcular automaticamente a distribuição municipal dos votos.</div>';
    return;
  }
  grid.innerHTML=items.map(f=>'<article class="finding-card '+(selected?.id===f.id?'selected':'')+'" data-id="'+escapeHtml(f.id)+'" tabindex="0"><div class="finding-meta"><span class="finding-chip">'+escapeHtml(TYPE_LABELS[f.type]||f.type)+'</span><span class="finding-chip">'+escapeHtml(OFFICE_LABELS[f.office]||f.office)+'</span></div><div class="finding-value">'+escapeHtml(f.display_value||'Dado')+'</div><h3>'+escapeHtml(f.headline)+'</h3><p>'+escapeHtml(f.summary||'')+'</p><button type="button">Conferir cálculo →</button></article>').join('');
  $$('.finding-card').forEach(el=>{el.onclick=()=>selectFinding(el.dataset.id);el.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();selectFinding(el.dataset.id)}}});
}
function selectFinding(id){selected=(radar.findings||[]).find(f=>f.id===id)||null;renderFindings();renderDetail();drawCanvas();updatePublisher(false);$('#detailContent')?.scrollIntoView({behavior:'smooth',block:'nearest'})}
function renderDetail(){
  $('#detailEmpty').hidden=!!selected;$('#detailContent').hidden=!selected;if(!selected)return;
  $('#detailType').textContent=TYPE_LABELS[selected.type]||selected.type;
  $('#detailCandidate').textContent=[OFFICE_LABELS[selected.office],selected.candidate].filter(Boolean).join(' · ');
  $('#detailHeadline').textContent=selected.headline;$('#detailExplain').textContent=selected.explanation||selected.summary||'';
  $('#detailCalc').textContent=selected.calculation||'Cálculo disponível no snapshot.';
  $('#detailBase').textContent=radar.source_generated_at||radar.generated_at||'—';
  const items=selected.breakdown||[];$('#detailBreakdown').innerHTML=items.map(x=>'<div class="break-item"><span>'+escapeHtml(x.label)+'</span><strong>'+escapeHtml(x.value)+'</strong></div>').join('');
  $('#reviewCheck').checked=false;$('#reviewCheck').onchange=e=>updatePublisher(e.target.checked);
}
function makePost(f){
  if(!f)return'';
  const progress=radar.progress!=null?' · '+pct(radar.progress)+' das seções':'';
  let text='ELEIÇÕES 2026 | RADAR RN\\n\\n'+(f.post_text||f.headline)+'\\n\\nFonte: TSE'+progress;
  if(text.length>280)text=text.slice(0,277)+'…';return text;
}
function updatePublisher(reviewed){const text=selected?makePost(selected):'';$('#radarPostText').value=text;$('#radarChars').textContent=text.length+'/280';['#copyRadarText','#copyRadarImage','#openRadarX','#downloadRadar'].forEach(s=>$(s).disabled=!selected||!reviewed)}
function roundRect(ctx,x,y,w,h,r){r=Math.min(r,w/2,h/2);ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath()}
function wrap(ctx,text,x,y,maxWidth,lineHeight,maxLines){const words=String(text).split(/\\s+/);let line='',lines=[];for(const w of words){const test=line?line+' '+w:w;if(ctx.measureText(test).width>maxWidth&&line){lines.push(line);line=w}else line=test}if(line)lines.push(line);if(lines.length>maxLines){lines=lines.slice(0,maxLines);let last=lines[maxLines-1];while(ctx.measureText(last+'…').width>maxWidth&&last.includes(' '))last=last.slice(0,last.lastIndexOf(' '));lines[maxLines-1]=last+'…'}lines.forEach((l,i)=>ctx.fillText(l,x,y+i*lineHeight));return y+lines.length*lineHeight}
const logo=new Image();logo.crossOrigin='anonymous';logo.src=LOGO_URL;logo.onload=drawCanvas;
function drawCanvas(){
  const c=$('#radarCanvas'),ctx=c.getContext('2d');ctx.clearRect(0,0,1080,1080);ctx.fillStyle='#f4f6f7';ctx.fillRect(0,0,1080,1080);
  ctx.fillStyle='rgba(245,196,0,.16)';ctx.beginPath();ctx.arc(1010,60,340,0,Math.PI*2);ctx.fill();
  if(logo.complete)try{ctx.drawImage(logo,70,55,86,86)}catch{}
  ctx.fillStyle='#17191c';ctx.font='750 34px Inter,Segoe UI,Arial';ctx.fillText('Central das Eleições UEFY',180,103);
  ctx.font='700 18px Inter,Segoe UI,Arial';ctx.fillText('RADAR RN · MAPA DO VOTO',70,185);
  ctx.fillStyle='#626a72';ctx.font='600 17px Inter,Segoe UI,Arial';ctx.fillText((selected?OFFICE_LABELS[selected.office]:OFFICE_LABELS[activeOffice()])+' · Eleições 2026',70,218);
  if(!selected){ctx.fillStyle='#17191c';ctx.font='800 70px Inter,Segoe UI,Arial';ctx.fillText('Radar RN',70,410);ctx.fillStyle='#59626b';ctx.font='600 28px Inter,Segoe UI,Arial';wrap(ctx,'Selecione um achado e confira o cálculo antes de gerar a publicação.',70,470,850,42,3)}
  else{ctx.fillStyle='#17191c';ctx.font='850 90px Inter,Segoe UI,Arial';ctx.fillText(selected.display_value||'Dado',70,405);ctx.font='800 47px Inter,Segoe UI,Arial';const end=wrap(ctx,selected.headline,70,475,920,58,4);ctx.fillStyle='#5b646d';ctx.font='600 24px Inter,Segoe UI,Arial';wrap(ctx,selected.card_note||selected.summary||'',70,end+30,890,36,4);ctx.fillStyle='#fff';roundRect(ctx,70,790,940,105,16);ctx.fill();ctx.strokeStyle='#d7dce0';ctx.stroke();ctx.fillStyle='#6b737b';ctx.font='700 16px Inter,Segoe UI,Arial';ctx.fillText('COMO FOI CALCULADO',95,827);ctx.fillStyle='#17191c';ctx.font='700 22px Inter,Segoe UI,Arial';wrap(ctx,selected.calculation||'Cálculo reproduzível a partir dos resultados municipais.',95,861,870,29,2)}
  ctx.strokeStyle='#d0d6db';ctx.beginPath();ctx.moveTo(70,956);ctx.lineTo(1010,956);ctx.stroke();ctx.fillStyle='#59626b';ctx.font='600 18px Inter,Segoe UI,Arial';ctx.fillText('Fonte: Tribunal Superior Eleitoral · resultados oficiais',70,998);ctx.textAlign='right';ctx.fillText(radar.source_generated_at||radar.generated_at||'',1010,1030);ctx.textAlign='left';
}
async function canvasBlob(){return await new Promise((res,rej)=>$('#radarCanvas').toBlob(b=>b?res(b):rej(new Error('blob')),'image/png'))}
async function copyImage(){if(!window.isSecureContext||!navigator.clipboard||!window.ClipboardItem)throw new Error('clipboard');const b=await canvasBlob();await navigator.clipboard.write([new ClipboardItem({'image/png':b})])}
function openX(text,w=null){const u='https://twitter.com/intent/tweet?text='+encodeURIComponent(text);if(w){w.opener=null;w.location.href=u}else window.open(u,'_blank','noopener,noreferrer')}
$('#copyRadarText').onclick=async()=>{try{await navigator.clipboard.writeText($('#radarPostText').value);flash($('#copyRadarText'),'Texto copiado!')}catch{flash($('#copyRadarText'),'Cópia bloqueada')}};
$('#copyRadarImage').onclick=async()=>{try{await copyImage();flash($('#copyRadarImage'),'Imagem copiada!')}catch{flash($('#copyRadarImage'),'Cópia bloqueada')}};
$('#downloadRadar').onclick=()=>{const a=document.createElement('a');a.download='uefy-radar-rn-'+(selected?.id||'achado')+'.png';a.href=$('#radarCanvas').toDataURL('image/png');a.click()};
$('#openRadarX').onclick=async()=>{const desktop=window.matchMedia?.('(pointer:fine)').matches&&innerWidth>820,w=desktop?window.open('about:blank','_blank'):null;let copied=false;if(desktop)try{await copyImage();copied=true}catch{}openX($('#radarPostText').value,w);flash($('#openRadarX'),copied?'Imagem copiada · cole com Ctrl+V':'X aberto')};
$('#officeFilter').onchange=()=>{selected=null;buildFilters();renderFindings();renderDetail();drawCanvas();updatePublisher(false)};
$('#candidateFilter').onchange=renderFindings;$('#typeFilter').onchange=renderFindings;$('#refreshRadar').onclick=()=>loadRadar();
const theme=$('#themeToggle');if(localStorage.getItem('uefy-eleicoes-theme')==='dark')document.body.classList.add('dark');function syncTheme(){const d=document.body.classList.contains('dark');theme.textContent=d?'☀':'◐';theme.title=d?'Usar tema claro':'Usar tema escuro'}syncTheme();theme.onclick=()=>{document.body.classList.toggle('dark');localStorage.setItem('uefy-eleicoes-theme',document.body.classList.contains('dark')?'dark':'light');syncTheme();drawCanvas()};
const topBtn=$('#toTop');addEventListener('scroll',()=>topBtn.classList.toggle('show',scrollY>420),{passive:true});topBtn.onclick=()=>scrollTo({top:0,behavior:'smooth'});document.querySelectorAll('.mobile-menu a').forEach(a=>a.addEventListener('click',()=>a.closest('details')?.removeAttribute('open')));drawCanvas();updatePublisher(false);loadRadar();