const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const DATA_URL='data/radar-rn.json';
const CANDIDATE_URL='data/candidatos-ufs-c.json';
const LOGO_URL='https://uefyerryeni.github.io/uefyerryeni-logo.png';
const OFFICE_LABELS={sen:'Senador',depf:'Deputado federal',depe:'Deputado estadual'};
const TYPE_LABELS={territorial_coverage:'Presença municipal',capital_share:'Natal x interior',top_municipalities:'Concentração territorial',municipal_leads:'Primeiro lugar nos municípios'};
let radar={status:'loading',findings:[],offices:{}}, selected=null, candidateRegistry=[], radarMode='official', labStep=0;
let publicationTextMode='full';
const LAB_STEPS=[0,8,22,41,63,81,95,100];
const pct=v=>Number(v||0).toLocaleString('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:1})+'%';
function flash(btn,text){if(!btn)return;const old=btn.textContent;btn.textContent=text;setTimeout(()=>btn.textContent=old,1800)}
function setStatus(msg,error=false){const el=$('#radarStatus');el.hidden=!msg;el.textContent=msg||'';el.classList.toggle('error',error)}
function escapeHtml(s=''){return String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}
function activeOffice(){return $('#officeFilter')?.value||'sen'}
const OFFICE_CARGO={sen:5,depf:6,depe:7};
function registryForOffice(office=activeOffice()){return candidateRegistry.filter(x=>Number(x.cargo)===OFFICE_CARGO[office]).sort((a,b)=>String(a.nome).localeCompare(String(b.nome),'pt-BR'))}
function selectedRegistryCandidate(){const v=$('#candidateFilter')?.value;if(!v||v==='all')return null;return registryForOffice().find(x=>String(x.seq||x.nome)===v)||null}
function labFinding(id,office,type,candidate,value,headline,summary,calculation,breakdown=[]){
  return {id,office,type,candidate,display_value:value,headline,summary,explanation:summary,calculation,breakdown,post_text:headline,card_note:'Cenário fictício criado exclusivamente para testar o Radar RN.'};
}
function buildLabRadar(){
  const progress=LAB_STEPS[labStep%LAB_STEPS.length],findings=[],offices={};
  Object.keys(OFFICE_LABELS).forEach((office,oi)=>{
    const regs=registryForOffice(office);
    offices[office]={label:OFFICE_LABELS[office],progress,candidates_with_votes:progress?regs.length:0};
    if(!progress)return;
    regs.forEach((c,i)=>{
      const coverage=Math.min(167,Math.round((progress/100)*167*(.72+((i+oi)%4)*.07)));
      const natal=12+((i*9+labStep*4+oi*5)%47),top3=28+((i*7+labStep*3)%39),leads=Math.min(167,Math.round(coverage*(.08+((i+labStep)%5)*.08)));
      const base=(c.nome||'Candidatura')+' · '+(c.numero||'');
      findings.push(labFinding('lab-'+office+'-'+i+'-cov',office,'territorial_coverage',c.nome,String(coverage)+'/167',c.nome+' registra votos em '+coverage+' municípios no cenário de teste.','Indicador fictício de presença municipal para validar filtros, cards e publicação do Radar.','Municípios com votos fictícios ÷ 167 municípios do RN',[{label:'Municípios com votos',value:String(coverage)},{label:'Total do RN',value:'167'}]));
      findings.push(labFinding('lab-'+office+'-'+i+'-nat',office,'capital_share',c.nome,pct(natal),pct(natal)+' da votação fictícia de '+c.nome+' está em Natal.','Comparação fictícia entre capital e interior para testar o comportamento do Radar.','Votos fictícios em Natal ÷ votos fictícios totais da candidatura',[{label:'Natal',value:pct(natal)},{label:'Interior',value:pct(100-natal)}]));
      findings.push(labFinding('lab-'+office+'-'+i+'-top',office,'top_municipalities',c.nome,pct(top3),'Os três maiores municípios concentram '+pct(top3)+' da votação fictícia de '+c.nome+'.','Concentração territorial artificial para teste do cálculo e da arte.','Soma dos votos fictícios nos 3 maiores municípios ÷ total fictício',[{label:'Top 3',value:pct(top3)},{label:'Demais municípios',value:pct(100-top3)}]));
      findings.push(labFinding('lab-'+office+'-'+i+'-lead',office,'municipal_leads',c.nome,String(leads),c.nome+' aparece em primeiro em '+leads+' municípios no cenário fictício.','Contagem simulada de lideranças municipais para testar o Radar.','Quantidade de municípios em que a candidatura ocupa ficticiamente o 1º lugar',[{label:'Municípios liderados',value:String(leads)},{label:'Base com votos',value:String(coverage)}]));
    });
  });
  radar={status:'ok',generated_at:new Date().toLocaleString('pt-BR'),source_generated_at:'LAB · cenário '+(labStep+1)+'/'+LAB_STEPS.length,source_name:'Laboratório UEFY · dados fictícios',progress,scope:'Rio Grande do Norte',offices,municipalities:167,request_errors:0,findings,lab:true};
}
async function loadRadar(){
  setStatus(radarMode==='lab'?'Montando cenário fictício do Radar RN…':'Carregando a última leitura oficial do Radar RN…');
  try{
    const [radarRes,candRes]=await Promise.all([
      fetch(DATA_URL+'?ts='+Date.now(),{cache:'no-store'}),
      fetch(CANDIDATE_URL+'?ts='+Date.now(),{cache:'no-store'})
    ]);
    if(!radarRes.ok)throw new Error('Radar HTTP '+radarRes.status);
    radar=await radarRes.json();
    if(candRes.ok){
      const base=await candRes.json();
      candidateRegistry=Array.isArray(base?.rn?.candidates)?base.rn.candidates:[];
    }else candidateRegistry=[];
    if(radarMode==='lab')buildLabRadar();
    $('#sourceGenerated').textContent=radar.source_generated_at||radar.generated_at||'Aguardando resultados';
    $('#sourceMeta').textContent=(radar.source_name||'Tribunal Superior Eleitoral')+(radar.status==='ok'&&radar.progress!=null?' · '+pct(radar.progress)+(radarMode==='lab'?' da simulação':' das seções totalizadas'):'');
    if(radar.source_url)$('#sourceLink').href=radar.source_url;
    $('#radarLive').textContent=radarMode==='lab'?'LAB fictício':(radar.status==='ok'?'TSE oficial':'Aguardando apuração');
    if(radarMode==='lab')setStatus('LABORATÓRIO UEFY · DADOS FICTÍCIOS · cenário '+(labStep+1)+'/'+LAB_STEPS.length+'. Clique em Atualizar tela para avançar a apuração simulada.',false);else if(radar.status!=='ok')setStatus('Candidaturas carregadas. Os indicadores de votação serão ativados quando a apuração oficial estiver disponível.',false);else setStatus('');
    buildFilters();syncSelectionFromFilters();
  }catch(e){setStatus('Não foi possível carregar o Radar RN agora. Tente atualizar a página.',true);radar={status:'error',findings:[],offices:{}};candidateRegistry=[];buildFilters();renderFindings()}
}
function buildFilters(){
  const office=activeOffice(),c=$('#candidateFilter'),t=$('#typeFilter');
  const currentCandidate=c.value,currentType=t.value;
  const regs=registryForOffice(office);
  c.innerHTML='<option value="all">Todas as candidaturas</option>'+regs.map(x=>{
    const meta=[x.numero,x.partido].filter(Boolean).join(' · ');
    return '<option value="'+escapeHtml(String(x.seq||x.nome))+'">'+escapeHtml(x.nome+(meta?' — '+meta:''))+'</option>';
  }).join('');
  if([...c.options].some(o=>o.value===currentCandidate))c.value=currentCandidate;
  const types=Object.keys(TYPE_LABELS);
  t.innerHTML='<option value="all">Todos os achados</option>'+types.map(x=>'<option value="'+x+'">'+TYPE_LABELS[x]+'</option>').join('');
  if([...t.options].some(o=>o.value===currentType))t.value=currentType;
}
function filtered(){
  const office=activeOffice(),candidate=selectedRegistryCandidate(),t=$('#typeFilter').value;
  return (radar.findings||[]).filter(f=>f.office===office&&(!candidate||f.candidate===candidate.nome)&&(t==='all'||f.type===t));
}
function renderFindings(){
  const items=filtered();
  $('#findingCount').textContent=items.length===1?'1 achado disponível':items.length+' achados disponíveis';
  const grid=$('#findingsGrid');
  if(!items.length){
    const office=OFFICE_LABELS[activeOffice()],cand=selectedRegistryCandidate(),regs=registryForOffice();
    if(radar.status!=='ok'){
      if(cand){
        const meta=[cand.numero,cand.partido].filter(Boolean).join(' · ');
        grid.innerHTML='<div class="no-findings waiting-candidate"><span class="waiting-kicker">CANDIDATURA SELECIONADA</span><h3>'+escapeHtml(cand.nome)+'</h3><p class="waiting-meta">'+escapeHtml(meta)+'</p><p>A candidatura já pode ser selecionada no Radar. Os números abaixo só serão calculados quando houver votos oficiais disponíveis.</p><div class="waiting-metrics"><span>Presença municipal</span><span>Natal x interior</span><span>Concentração territorial</span><span>Primeiro lugar nos municípios</span></div></div>';
      }else{
        grid.innerHTML='<div class="no-findings waiting-candidate"><span class="waiting-kicker">RADAR PREPARADO</span><h3>'+escapeHtml(office)+'</h3><p>'+regs.length+' candidatura(s) estão disponíveis no filtro acima. Selecione uma para deixar o Radar preparado; os indicadores de votação serão preenchidos automaticamente quando a apuração oficial estiver disponível.</p><div class="waiting-metrics"><span>Presença municipal</span><span>Natal x interior</span><span>Concentração territorial</span><span>Primeiro lugar nos municípios</span></div></div>';
      }
    }else{
      grid.innerHTML='<div class="no-findings">Não há achado para a combinação de filtros selecionada. Tente outra candidatura ou outro tipo de análise.</div>';
    }
    return;
  }
  grid.innerHTML=items.map(f=>'<article class="finding-card '+(selected?.id===f.id?'selected':'')+'" data-id="'+escapeHtml(f.id)+'" tabindex="0"><div class="finding-meta"><span class="finding-chip">'+escapeHtml(TYPE_LABELS[f.type]||f.type)+'</span><span class="finding-chip">'+escapeHtml(OFFICE_LABELS[f.office]||f.office)+'</span></div><div class="finding-value">'+escapeHtml(f.display_value||'Dado')+'</div><h3>'+escapeHtml(f.headline)+'</h3><p>'+escapeHtml(f.summary||'')+'</p><button type="button">Conferir cálculo →</button></article>').join('');
  $$('.finding-card').forEach(el=>{el.onclick=()=>selectFinding(el.dataset.id);el.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();selectFinding(el.dataset.id)}}});
}
function selectFinding(id,scroll=true){
  selected=(radar.findings||[]).find(f=>f.id===id)||null;
  renderFindings();renderDetail();drawCanvas();updatePublisher(false);
  if(scroll)$('#detailContent')?.scrollIntoView({behavior:'smooth',block:'nearest'});
}
function syncSelectionFromFilters(){
  selected=null;
  const items=filtered();
  const specificCandidate=$('#candidateFilter')?.value&&$('#candidateFilter').value!=='all';
  const specificType=$('#typeFilter')?.value&&$('#typeFilter').value!=='all';
  if(items.length===1&&(specificCandidate||specificType)){
    selectFinding(items[0].id,false);
    return;
  }
  renderFindings();renderDetail();drawCanvas();updatePublisher(false);
}
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
function candidateParty(name){
  const target=String(name||'').toLocaleLowerCase('pt-BR');
  const item=candidateRegistry.find(x=>String(x.nome||'').toLocaleLowerCase('pt-BR')===target);
  return item?.partido||'';
}
function makePost(f){
  if(!f)return'';
  const party=candidateParty(f.candidate);
  const candidateLabel=f.candidate+(party?' ('+party+')':'');
  const headline=(f.post_text||f.headline||'').replace(f.candidate,candidateLabel);
  const lines=['ELEIÇÕES 2026 | RADAR RN','',headline];
  if(publicationTextMode==='full'){
    const explanation=String(f.explanation||f.summary||'').trim();
    const calculation=String(f.calculation||'').trim();
    if(explanation&&explanation!==f.headline)lines.push('',explanation.replace(f.candidate,candidateLabel));
    if(calculation)lines.push('','Como foi calculado: '+calculation);
  }
  if(radarMode==='lab'){
    lines.push('','LABORATÓRIO UEFY · DADOS FICTÍCIOS');
  }else{
    if(radar.progress!=null)lines.push('','Apuração: '+pct(radar.progress)+' das seções.');
    if(publicationTextMode==='full'&&(radar.source_generated_at||radar.generated_at))lines.push('Atualização: '+(radar.source_generated_at||radar.generated_at));
    lines.push('Fonte: Tribunal Superior Eleitoral');
  }
  return lines.join('\n');
}
function updatePublisher(reviewed){const text=selected?makePost(selected):'';$('#radarPostText').value=text;$('#radarChars').textContent=text.length+' caracteres';['#copyRadarText','#copyRadarImage','#openRadarX','#downloadRadar','#shareRadarBundle'].forEach(s=>{const el=$(s);if(el)el.disabled=!selected||!reviewed})}
function roundRect(ctx,x,y,w,h,r){r=Math.min(r,w/2,h/2);ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath()}
function fitLine(ctx,text,maxWidth,minChars=4){
  let value=String(text||'');
  if(ctx.measureText(value).width<=maxWidth)return value;
  while(value.length>minChars&&ctx.measureText(value+'…').width>maxWidth)value=value.slice(0,-1);
  return value.trimEnd()+'…';
}
function wrap(ctx,text,x,y,maxWidth,lineHeight,maxLines){
  const words=String(text||'').split(/\\s+/).filter(Boolean);let line='',lines=[];
  for(const raw of words){
    const w=ctx.measureText(raw).width>maxWidth?fitLine(ctx,raw,maxWidth):raw;
    const test=line?line+' '+w:w;
    if(ctx.measureText(test).width>maxWidth&&line){lines.push(fitLine(ctx,line,maxWidth));line=w}
    else line=test;
  }
  if(line)lines.push(fitLine(ctx,line,maxWidth));
  if(lines.length>maxLines){
    lines=lines.slice(0,maxLines);
    let last=lines[maxLines-1];
    if(!last.endsWith('…'))last=fitLine(ctx,last+'…',maxWidth);
    lines[maxLines-1]=last;
  }
  lines.forEach((l,i)=>ctx.fillText(l,x,y+i*lineHeight));return y+lines.length*lineHeight;
}
function drawAdaptiveHeadline(ctx,text,x,y,maxWidth){
  let size=45;
  while(size>=31){
    ctx.font='800 '+size+'px Inter,Segoe UI,Arial';
    const words=String(text||'').split(/\\s+/),tmp=[];let line='',ok=true;
    for(const w of words){
      if(ctx.measureText(w).width>maxWidth){ok=false;break}
      const t=line?line+' '+w:w;
      if(ctx.measureText(t).width>maxWidth&&line){tmp.push(line);line=w}else line=t;
    }
    if(line)tmp.push(line);
    if(ok&&tmp.length<=3)break;
    size-=2;
  }
  ctx.font='800 '+size+'px Inter,Segoe UI,Arial';
  return wrap(ctx,text,x,y,maxWidth,Math.round(size*1.2),3);
}
const logo=new Image();logo.crossOrigin='anonymous';logo.src=LOGO_URL;logo.onload=drawCanvas;
function drawCanvas(){
  const c=$('#radarCanvas'),ctx=c.getContext('2d');ctx.clearRect(0,0,1080,1080);ctx.fillStyle='#f4f6f7';ctx.fillRect(0,0,1080,1080);
  ctx.fillStyle='rgba(245,196,0,.16)';ctx.beginPath();ctx.arc(1010,60,340,0,Math.PI*2);ctx.fill();
  if(logo.complete)try{ctx.drawImage(logo,70,55,86,86)}catch{}
  ctx.fillStyle='#17191c';ctx.font='750 34px Inter,Segoe UI,Arial';ctx.fillText('Central das Eleições UEFY',180,103);
  ctx.font='700 18px Inter,Segoe UI,Arial';ctx.fillText('RADAR RN · MAPA DO VOTO',70,185);
  ctx.fillStyle='#626a72';ctx.font='600 17px Inter,Segoe UI,Arial';ctx.fillText((selected?OFFICE_LABELS[selected.office]:OFFICE_LABELS[activeOffice()])+' · Eleições 2026',70,218);
  if(!selected){ctx.fillStyle='#17191c';ctx.font='800 70px Inter,Segoe UI,Arial';ctx.fillText('Radar RN',70,410);ctx.fillStyle='#59626b';ctx.font='600 28px Inter,Segoe UI,Arial';wrap(ctx,'Selecione um achado e confira o cálculo antes de gerar a publicação.',70,470,850,42,3)}
  else{
    ctx.fillStyle='#17191c';let valueSize=90;while(valueSize>54){ctx.font='850 '+valueSize+'px Inter,Segoe UI,Arial';if(ctx.measureText(selected.display_value||'Dado').width<=920)break;valueSize-=2}ctx.fillText(selected.display_value||'Dado',70,390);
    const end=drawAdaptiveHeadline(ctx,selected.headline,70,458,920);
    ctx.fillStyle='#5b646d';ctx.font='600 23px Inter,Segoe UI,Arial';const noteEnd=wrap(ctx,selected.card_note||selected.summary||'',70,end+18,890,33,2);
    const calcY=Math.max(690,Math.min(750,noteEnd+55));
    ctx.fillStyle='#fff';roundRect(ctx,70,calcY,940,170,16);ctx.fill();ctx.strokeStyle='#d7dce0';ctx.stroke();
    ctx.fillStyle='#6b737b';ctx.font='700 16px Inter,Segoe UI,Arial';ctx.fillText('COMO FOI CALCULADO',95,calcY+38);
    ctx.fillStyle='#17191c';ctx.font='700 21px Inter,Segoe UI,Arial';wrap(ctx,selected.calculation||'Cálculo reproduzível a partir dos resultados municipais.',95,calcY+76,870,27,3);
  }
  ctx.strokeStyle='#d0d6db';ctx.beginPath();ctx.moveTo(70,956);ctx.lineTo(1010,956);ctx.stroke();ctx.fillStyle='#59626b';ctx.font='600 18px Inter,Segoe UI,Arial';ctx.fillText(radarMode==='lab'?'LABORATÓRIO UEFY · DADOS FICTÍCIOS · NÃO É RESULTADO ELEITORAL':'Fonte: Tribunal Superior Eleitoral · resultados oficiais',70,998);ctx.textAlign='right';ctx.fillText(radar.source_generated_at||radar.generated_at||'',1010,1030);ctx.textAlign='left';
}
async function canvasBlob(){return await new Promise((res,rej)=>$('#radarCanvas').toBlob(b=>b?res(b):rej(new Error('blob')),'image/png'))}
async function radarShareJpegBlob(){
  const canvas=$('#radarCanvas'),flat=document.createElement('canvas');flat.width=canvas.width;flat.height=canvas.height;
  const ctx=flat.getContext('2d',{alpha:false});ctx.fillStyle='#f4f6f7';ctx.fillRect(0,0,flat.width,flat.height);ctx.drawImage(canvas,0,0);
  return await new Promise((res,rej)=>flat.toBlob(b=>b?res(b):rej(new Error('blob')),'image/jpeg',0.96));
}
async function copyImage(){if(!window.isSecureContext||!navigator.clipboard||!window.ClipboardItem)throw new Error('clipboard');const b=await canvasBlob();await navigator.clipboard.write([new ClipboardItem({'image/png':b})])}
async function shareRadar(){
  const png=await canvasBlob();const desktop=window.matchMedia?.('(pointer:fine)').matches&&innerWidth>820;
  let blob=png;if(!desktop)try{blob=await radarShareJpegBlob()}catch{}
  const file=new File([blob],`uefy-radar-rn-${selected?.id||'achado'}.${blob.type==='image/jpeg'?'jpg':'png'}`,{type:blob.type||'image/png'});
  if(navigator.share&&navigator.canShare&&navigator.canShare({files:[file]})){await navigator.share({title:'Central das Eleições UEFY · Radar RN',text:$('#radarPostText').value,files:[file]});return true}
  await copyImage();return false;
}
async function openX(text,w=null){
  const encoded=encodeURIComponent(text),useIntent=encoded.length<=6000;
  const u=useIntent?'https://twitter.com/intent/tweet?text='+encoded:'https://x.com/compose/post';
  if(!useIntent)try{await navigator.clipboard.writeText(text)}catch{}
  if(w){w.opener=null;w.location.href=u}else window.open(u,'_blank','noopener,noreferrer');
  return useIntent;
}
function syncRadarTextModeButtons(){
  $('.text-mode-switch [data-text-mode]').forEach(b=>b.classList.toggle('active',b.dataset.textMode===publicationTextMode));
}
$('.text-mode-switch [data-text-mode]').forEach(b=>b.onclick=()=>{
  publicationTextMode=b.dataset.textMode;
  syncRadarTextModeButtons();
  updatePublisher($('#reviewCheck')?.checked||false);
});
syncRadarTextModeButtons();

$('#copyRadarText').onclick=async()=>{try{await navigator.clipboard.writeText($('#radarPostText').value);flash($('#copyRadarText'),'Texto copiado!')}catch{flash($('#copyRadarText'),'Cópia bloqueada')}};
$('#copyRadarImage').onclick=async()=>{try{await copyImage();flash($('#copyRadarImage'),'Imagem copiada!')}catch{flash($('#copyRadarImage'),'Cópia bloqueada')}};
$('#downloadRadar').onclick=()=>{const a=document.createElement('a');a.download='uefy-radar-rn-'+(selected?.id||'achado')+'.png';a.href=$('#radarCanvas').toDataURL('image/png');a.click()};
$('#openRadarX').onclick=async()=>{const desktop=window.matchMedia?.('(pointer:fine)').matches&&innerWidth>820,w=desktop?window.open('about:blank','_blank'):null;let copied=false;if(desktop)try{await copyImage();copied=true}catch{}const prefilled=await openX($('#radarPostText').value,w);flash($('#openRadarX'),prefilled?(copied?'Imagem copiada · cole com Ctrl+V':'X aberto'):'Texto copiado · cole no X')};
$('#shareRadarBundle')?.addEventListener('click',async()=>{try{const native=await shareRadar();if(!native)flash($('#shareRadarBundle'),'Imagem copiada · texto acima')}catch(e){if(e?.name!=='AbortError')flash($('#shareRadarBundle'),'Use Copiar texto / Copiar imagem')}});
$('#officeFilter').onchange=()=>{selected=null;buildFilters();syncSelectionFromFilters()};
$('#candidateFilter').onchange=()=>syncSelectionFromFilters();
$('#typeFilter').onchange=()=>syncSelectionFromFilters();
$('#radarMode').onchange=e=>{radarMode=e.target.value;labStep=radarMode==='lab'?1:0;selected=null;loadRadar()};
$('#refreshRadar').onclick=()=>{if(radarMode==='lab'){labStep=(labStep+1)%LAB_STEPS.length;if(labStep===0)labStep=1}selected=null;loadRadar()};
const theme=$('#themeToggle');if(localStorage.getItem('uefy-eleicoes-theme')==='dark')document.body.classList.add('dark');function syncTheme(){const d=document.body.classList.contains('dark');theme.textContent=d?'☀':'◐';theme.title=d?'Usar tema claro':'Usar tema escuro'}syncTheme();theme.onclick=()=>{document.body.classList.toggle('dark');localStorage.setItem('uefy-eleicoes-theme',document.body.classList.contains('dark')?'dark':'light');syncTheme();drawCanvas()};
const topBtn=$('#toTop');addEventListener('scroll',()=>topBtn.classList.toggle('show',scrollY>420),{passive:true});topBtn.onclick=()=>scrollTo({top:0,behavior:'smooth'});document.querySelectorAll('.mobile-menu a').forEach(a=>a.addEventListener('click',()=>a.closest('details')?.removeAttribute('open')));drawCanvas();updatePublisher(false);loadRadar();