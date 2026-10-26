/* Central UEFY: estatísticas e produção de imagens PNG locais. */
(()=>{'use strict';
const E=window.ElectionStats,P=window.ElectionPublications,$=q=>document.querySelector(q),NS='http://www.w3.org/2000/svg';
const statusNames={changed:'Mudou',same:'Manteve',tie:'Empate',pending:'Aguardando'},categoryNames={...E.names,tie:'Empate',pending:'Aguardando',same:'Manteve',changed:'Mudou'};
let model=null,selected='',loading=false,visible=[],paths=new Map(),imageReady=false,cachedShare=null,imageRevision=0,listPage=0,captionDirty=false,sharing=false;
const settings=()=>({metric:$('#metric').value,candidate:$('#candidate').value,view:$('#view').value,group:$('#group').value,search:$('#search').value,sort:$('#sort').value});
const metric=()=>E.metrics[$('#metric').value],unit=()=>$('#view').value==='delta'&&metric().unit==='pct'?'pp':metric().unit;
const f=(v,u,sign=false)=>E.format(v,u,sign);
const display=(r,s=settings())=>E.displayed(r,s.metric,s.view,s.candidate);
const colorUnknown='#d5d9cd';
for(const [id,m] of Object.entries(E.metrics)){const o=document.createElement('option');o.value=id;o.textContent=m.label;$('#metric').append(o)}
function el(tag,txt,cls){const n=document.createElement(tag);if(txt!==undefined)n.textContent=txt;if(cls)n.className=cls;return n}
function pathData(geometry,project){
 const ring=poly=>poly.map(r=>r.map((p,i)=>{const q=project(p);return(i?'L':'M')+q[0].toFixed(2)+','+q[1].toFixed(2)}).join('')+'Z').join('');
 return geometry.type==='Polygon'?ring(geometry.coordinates):geometry.coordinates.map(ring).join('');
}
function preparePaths(){
 const points=[];for(const r of model.rows){const g=r.feature.geometry;const polys=g.type==='Polygon'?[g.coordinates]:g.coordinates;for(const poly of polys)for(const ring of poly)points.push(...ring)}
 const merc=([x,y])=>[x,Math.log(Math.tan(Math.PI/4+y*Math.PI/360))*180/Math.PI],p=points.map(merc);
 const xs=p.map(v=>v[0]),ys=p.map(v=>v[1]),minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
 const scale=Math.min(756/(maxX-minX),496/(maxY-minY)),dx=(800-(maxX-minX)*scale)/2,dy=(540-(maxY-minY)*scale)/2;
 const project=point=>{const [x,y]=merc(point);return[dx+(x-minX)*scale,540-dy-(y-minY)*scale]};
 paths=new Map(model.rows.map(r=>[r.code,pathData(r.feature.geometry,project)]));
}
function palette(s=settings()){
 if(s.metric==='leadership')return s.view==='delta'?[['#d3a228','Mudou'],['#327762','Manteve'],['#7a6995','Empate'],[colorUnknown,'Sem comparação']]:[...Object.entries(E.colors).filter(([n])=>s.view==='first'||n!=='22').map(([n,c])=>[c,E.names[n]]),['#7a6995','Empate']];
 const vals=(s.shared?visible.flatMap(r=>[E.value(r,s.metric,1,s.candidate),E.value(r,s.metric,2,s.candidate)]):visible.map(r=>display(r,s))).filter(Number.isFinite);
 if(s.view==='delta'){const max=Math.max(...vals.map(Math.abs),.01);return [['#3b7d9c',f(-max,unit())],['#e9e8df','0'],['#b26a1c',f(max,unit(),true)],[colorUnknown,'Sem dado']]}
 return [['#e1edda',vals.length?f(Math.min(...vals),metric().unit):'—'],['#235c4c',vals.length?f(Math.max(...vals),metric().unit):'—'],[colorUnknown,'Sem dado']];
}
function blend(a,b,t){const parse=h=>h.match(/\w\w/g).map(x=>parseInt(x,16)),x=parse(a.slice(1)),y=parse(b.slice(1));return '#'+x.map((v,i)=>Math.round(v+(y[i]-v)*Math.max(0,Math.min(1,t))).toString(16).padStart(2,'0')).join('')}
function getColor(r,s=settings()){
 const v=display(r,s);if(v===null)return colorUnknown;
 if(s.metric==='leadership')return s.view==='delta'?({changed:'#d3a228',same:'#327762',tie:'#7a6995',pending:colorUnknown}[v]||colorUnknown):(E.colors[v]||'#7a6995');
 const vals=(s.shared?visible.flatMap(row=>[E.value(row,s.metric,1,s.candidate),E.value(row,s.metric,2,s.candidate)]):visible.map(row=>display(row,s))).filter(Number.isFinite);
 if(s.view==='delta'){const max=Math.max(...vals.map(Math.abs),.01);return blend('#e9e8df',v>=0?'#b26a1c':'#3b7d9c',Math.abs(v)/max)}
 const min=Math.min(...vals),max=Math.max(...vals);return blend('#e1edda','#235c4c',max===min?.6:(v-min)/(max-min));
}
const viewName=s=>s.view==='first'?'1º turno · 04/10/2026':s.view==='second'?'2º turno · 25/10/2026':s.metric==='leadership'?'Mudanças de liderança · 1º → 2º':'Variação · 2º menos 1º turno';
const topic=s=>E.metrics[s.metric].label+(E.metrics[s.metric].candidate?' · '+E.names[s.candidate]:'');
function mapRender(){
 const s=settings(),svg=$('#statsMap'),set=new Set(visible.map(r=>r.code));svg.replaceChildren();
 for(const r of model.rows){
  const path=document.createElementNS(NS,'path');path.setAttribute('d',paths.get(r.code));path.setAttribute('fill',set.has(r.code)?getColor(r):'#e2e4dc');path.setAttribute('opacity',set.has(r.code)?'1':'.25');
  path.setAttribute('class','municipality'+(r.code===selected?' selected':''));path.setAttribute('role','button');path.setAttribute('tabindex','0');
  const v=display(r),label=r.name+' · '+(s.metric==='leadership'?categoryNames[v]||'Aguardando':f(v,unit(),s.view==='delta'));
  path.setAttribute('aria-label',label);const title=document.createElementNS(NS,'title');title.textContent=label;path.append(title);
  const pick=()=>{resetPublicationText();selected=r.code;updateDetail();mapRender();renderTable();renderImage()};
  path.addEventListener('click',pick);path.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();pick()}});svg.append(path);
 }
 $('#mapTitle').textContent=topic(s)+' / '+viewName(s);
 $('#coverage').textContent=visible.length+' / 167 MUNICÍPIOS';
 $('#legend').replaceChildren(...palette().map(([c,t])=>{const n=el('span'),sw=el('i');sw.style.background=c;n.append(sw,el('span',t));return n}));
 $('#metricNote').textContent=metric().note||((metric().office==='pres'?'Presidente no RN. ':'Governador do RN. ')+(metric().base==='total_votes'?'Percentual sobre todos os votos do cargo.':metric().base==='electorate'?'Percentual sobre o eleitorado do cargo.':'Valores absolutos.')+' Bases estaduais usam os totais do cargo.');
}
function focusValues(){
 const s=settings(),r=model.rows.find(r=>r.code===selected),a=r?E.value(r,s.metric,1,s.candidate):E.stateValue(model,s.metric,1,s.candidate),b=r?E.value(r,s.metric,2,s.candidate):E.stateValue(model,s.metric,2,s.candidate);
 return {r,a,b,delta:a===null||b===null?null:b-a};
}
function updateDetail(){
 const s=settings(),{r,a,b,delta}=focusValues();$('#scope').textContent=r?r.name:'Rio Grande do Norte';$('#clearCity').hidden=!r;
 $('#focusLabel').textContent=topic(s);$('#deltaLabel').textContent=s.metric==='leadership'?'SITUAÇÃO DO MUNICÍPIO':'VARIAÇÃO · 2º − 1º';
 if(s.metric==='leadership'){
  $('#firstValue').textContent=r?categoryNames[a]:'167 municípios';$('#secondValue').textContent=r?categoryNames[b]||'Aguardando':model.ready?'167 municípios':'Aguardando';
  $('#deltaValue').textContent=r?statusNames[r.status]:model.ready?model.rows.filter(x=>x.status==='changed').length+' mudaram':'Sem comparação';
 }else{$('#firstValue').textContent=f(a,metric().unit);$('#secondValue').textContent=f(b,metric().unit);$('#deltaValue').textContent=f(delta,metric().unit==='pct'?'pp':metric().unit,true)}
 $('#detailNote').textContent=s.candidate==='22'&&metric().candidate?'Álvaro Dias não disputou o segundo turno. Ausência não equivale a zero voto.':r?'Código TSE '+r.code+'. Liderança municipal não demonstra transferência individual de votos.':'Totais do RN. Filtros de municípios alteram o mapa e a tabela; este destaque estadual usa todos os municípios.';
 $('#publication option[value="city"]').disabled=!r;$('#imageScope option[value="city"]').disabled=!r;if(!r)$('#imageScope').value='state';
}
function renderTable(){
 const s=settings(),tbody=$('#municipalRows');tbody.replaceChildren();
 $('#rowCount').textContent=visible.length+' de 167 municípios';
 $('#sort').disabled=s.metric==='leadership';
 for(const r of visible){
  const tr=el('tr',undefined,r.code===selected?'selected':'');tr.dataset.code=r.code;
  const td=el('td'),btn=el('button',r.name,'city-button');btn.type='button';btn.addEventListener('click',()=>{resetPublicationText();selected=r.code;updateDetail();mapRender();renderTable();renderImage()});td.append(btn);tr.append(td);
  tr.append(el('td',categoryNames[r.from]),el('td',categoryNames[r.to]||'—'));const status=el('td');status.append(el('span',statusNames[r.status],'badge '+r.status));tr.append(status);
  if(s.metric==='leadership')tr.append(el('td',f(r.first.pct,'pct')),el('td',f(r.second?.pct,'pct')),el('td','—'));
  else{const a=E.value(r,s.metric,1,s.candidate),b=E.value(r,s.metric,2,s.candidate);tr.append(el('td',f(a,metric().unit)),el('td',f(b,metric().unit)),el('td',f(a===null||b===null?null:b-a,metric().unit==='pct'?'pp':metric().unit,true)))}
  [...tr.children].forEach((td,i)=>td.dataset.label=['Município','Liderança · 1º turno','Liderança · 2º turno','Situação','Valor · 1º turno','Valor · 2º turno','Variação'][i]);tbody.append(tr);
 }
 if(!visible.length){const tr=el('tr'),td=el('td','Nenhum município para este filtro.');td.colSpan=7;tr.append(td);tbody.append(tr)}
 $('#col1').textContent=s.metric==='leadership'?'% do líder · 1º':'Valor · 1º turno';$('#col2').textContent=s.metric==='leadership'?'% do líder · 2º':'Valor · 2º turno';$('#colDelta').textContent=s.metric==='leadership'?'Variação não aplicável':metric().unit==='count'?'Diferença em números':'Diferença em p.p.';
}
function renderTransitions(){
 const panel=$('#transitions');panel.replaceChildren();
 for(const route of ['13-13','44-44','13-44','44-13','22-13','22-44']){
  const [a,b]=route.split('-'),count=model.ready?model.rows.filter(r=>r.from===a&&r.to===b).length:null;
  const btn=el('button',undefined,$('#group').value===route?'active':'');btn.type='button';btn.disabled=!model.ready;btn.setAttribute('aria-pressed',String($('#group').value===route));btn.append(el('span',E.names[a]+' → '+E.names[b]),el('strong',count===null?'—':String(count)));
  btn.addEventListener('click',()=>{$('#group').value=$('#group').value===route?'all':route;render()});panel.append(btn);
 }
}
function render(){
 if(!model)return;
 const s=settings(),m=metric();$('#candidateLabel').hidden=!m.candidate;for(const o of $('#publication').options)if(o.value!=='analysis'&&o.value!=='city')o.disabled=!model.ready;
 for(const o of $('#view').options)o.disabled=o.value!=='first'&&(!model.ready||(m.candidate&&s.candidate==='22'));
 if($('#view').selectedOptions[0].disabled)$('#view').value='first';
 for(const o of $('#group').options)o.disabled=o.value!=='all'&&!model.ready;
 if($('#group').selectedOptions[0].disabled)$('#group').value='all';
 $('#view option[value="delta"]').textContent=s.metric==='leadership'?'Mudança entre turnos':'Variação · 2º − 1º turno';
 visible=E.filtered(model,settings());if(selected&&!visible.some(r=>r.code===selected))selected="";mapRender();updateDetail();renderTable();renderTransitions();renderImage();$('#csv').disabled=false;
}
function dates(){
 const first=model.first.source_generated_at||model.first.generated_at,second=model.second.source_generated_at||model.second.generated_at;
 return 'Mapa 1º: '+first+' | 2º: '+(model.ready?second:'indisponível')+' · Horários das bases';
}

function publicationBrief(){return P.brief(model,settings(),{rows:visible,city:$('#imageScope').value==='city'?model.rows.find(r=>r.code===selected):null})}
function imageFilename(){return 'uefy-rn-'+settings().metric+'-'+settings().group+'-'+settings().view+'-'+$('#template').value+'-'+$('#size').value+(artPages().length>1?'-parte-'+(listPage+1):'')+'.png'}
function updateShareControls(){
 const text=$('#supportText').value,check=P.analyzeText(text),valid=check.valid&&text.trim().length>0;
 $('#characterCount').textContent=check.length+' / 280';$('#characterCount').classList.toggle('over-limit',!valid);
 $('#shareX').disabled=!imageReady||!cachedShare||!valid||sharing;
 $('#download').disabled=!imageReady||!cachedShare;
 $('#copyText').disabled=!imageReady||!text.trim();
 const link=$('#openX');link.href='https://x.com/intent/tweet?text='+encodeURIComponent(text);link.setAttribute('aria-disabled',String(!imageReady||!valid));link.tabIndex=imageReady&&valid?0:-1;
 if(!valid&&imageReady)$('#exportStatus').textContent=text.trim()?'O texto passou de 280 caracteres. Edite a legenda antes de abrir o X.':'Escreva uma legenda para compartilhar.';
}
function updateCaption(force=false){
 if(!model)return;
 const pages=artPages();
 if(force||!captionDirty)$('#supportText').value=P.makePost(publicationBrief(),{style:$('#captionStyle').value,page:listPage,pageCount:pages.length,pageRows:pages[listPage]||[],template:$('#template').value});
 updateShareControls();
}
function resetPublicationText(){captionDirty=false;listPage=0;$('#exportStatus').textContent=''}
function choosePublication(){
 const choice=$('#publication').value;resetPublicationText();$('#imageTitle').value='';
 if(choice==='analysis'){render();return}
 $('#metric').value='leadership';$('#view').value='delta';$('#search').value='';
 $('#group').value=choice==='overview'||choice==='city'?'all':choice;
 if(choice==='city'){$('#imageScope').value='city';$('#template').value='map'}
 else{selected='';$('#imageScope').value='state';if(choice==='overview'){$('#template').value='routes';$('#captionStyle').value='compare'}else if(['ranking','routes'].includes($('#template').value))$('#template').value='map'}
 render();
}
function sharePublication(){
 if($('#shareX').disabled||!cachedShare)return;
 const file=cachedShare.file,text=$('#supportText').value;sharing=true;updateShareControls();
 const finish=()=>{sharing=false;updateShareControls()};
 try{
  if(typeof navigator.share==='function'&&typeof navigator.canShare==='function'&&navigator.canShare({files:[file]})){
   // A chamada ocorre no mesmo gesto do usuário, com o PNG já preparado.
   const promise=navigator.share({files:[file],text,title:'Central UEFY Eleições'});
   $('#exportStatus').textContent='Escolha o X no menu e confira imagem e legenda antes de publicar.';
   Promise.resolve(promise).then(()=>{$('#exportStatus').textContent='Conteúdo entregue ao aplicativo escolhido. Confira a legenda no X antes de publicar.'},error=>{
    $('#exportStatus').textContent=error?.name==='AbortError'?'Compartilhamento cancelado. Nada foi publicado pela plataforma.':'O envio ao aplicativo não foi concluído. Use “Baixar PNG” e “Abrir X com o texto” para anexar a imagem.';
   }).finally(finish);return;
  }
 }catch(error){$('#exportStatus').textContent='O compartilhamento do navegador não está disponível. Use o arquivo e o texto abaixo.'}
 downloadBlob(file,file.name);
 window.open('https://x.com/intent/tweet?text='+encodeURIComponent(text),'_blank','noopener,noreferrer');
 $('#exportStatus').textContent='A imagem foi preparada para download e o X foi aberto com o texto. Anexe o PNG no X. Se a nova aba não abriu, toque em “Abrir X com o texto”.';finish();
}
function exportCsv(){
 const s=settings(),heads=['municipio','codigo_tse','lider_1t','lider_2t','situacao','indicador','candidatura','valor_1t','valor_2t','variacao','unidade_variacao','fonte'];
 const lines=visible.map(r=>{const a=E.value(r,s.metric,1,s.candidate),b=E.value(r,s.metric,2,s.candidate);return[r.name,r.code,categoryNames[r.from],categoryNames[r.to]||'',statusNames[r.status],metric().label,metric().candidate?E.names[s.candidate]:'',a,b,s.metric==='leadership'||a===null||b===null?'':b-a,metric().unit==='count'?'número':metric().unit==='category'?'não aplicável':'pontos percentuais','TSE 2026 | 6259 / 6260 | 6257 / 6258']});
 const safe=v=>{const x=String(v??'');return '"'+(/^[=+\-@]/.test(x)&&isNaN(Number(x))?"'":'')+x.replaceAll('"','""')+'"'};
 downloadBlob(new Blob(['\uFEFF'+[heads,...lines].map(a=>a.map(safe).join(';')).join('\r\n')],{type:'text/csv;charset=utf-8'}),'uefy-rn-estatisticas.csv');
}
function downloadBlob(blob,name){const url=URL.createObjectURL(blob),a=el('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),3000)}
/* Renderização das artes e preparação do PNG para compartilhar. */
function artPages(){return P.artPages(visible,{template:$('#template').value,size:$('#size').value,s:settings()})}
function renderImage(){
 const revision=++imageRevision;cachedShare=null;imageReady=false;$('#shareX').disabled=true;$('#download').disabled=true;$('#copyText').disabled=true;if(!model)return;
 const s=settings(),template=$('#template').value,canvas=$('#preview');
 const scopeLocked=['ranking','compare','list','routes'].includes(template);$('#imageScope').disabled=scopeLocked;if(scopeLocked)$('#imageScope').value='state';
 const pages=artPages();listPage=Math.min(listPage,pages.length-1);
 const zeroRoute=model.ready&&s.metric==='leadership'&&s.view==='delta'&&s.group!=='all'&&!s.search;
 let allowed=(visible.length>0||zeroRoute)&&!(['list','routes'].includes(template)&&(s.metric!=='leadership'||!model.ready))&&(s.view==='first'||model.ready)&&(template!=='compare'||model.ready)&&!((template==='ranking')&&s.metric==='leadership')&&!(template==='compare'&&metric().candidate&&s.candidate==='22');
 const city=$('#imageScope').value==='city'?model.rows.find(r=>r.code===selected):null;
 const report=window.ElectionArt.render({canvas,model,s,rows:visible,paths,brief:publicationBrief(),template,size:$('#size').value,page:listPage,city,title:$('#imageTitle').value.trim(),palette:$('#palette').value,colors:getColor});
 if(report.valid&&$('#exportStatus').textContent.startsWith('Encurte'))$('#exportStatus').textContent='';
 if(!report.valid){allowed=false;$('#exportStatus').textContent='Encurte o título ou escolha o formato quadrado para manter a leitura da arte.'}
 const [w,h]=$('#size').value.split('x');$('#dimensions').textContent=w+' × '+h+' · PNG';
 $('#studioContext').textContent=topic(s)+' · '+viewName(s)+' · '+visible.length+' municípios. Letras maiores para o feed do X.';
 $('#listPagination').hidden=pages.length===1;$('#listNotice').hidden=pages.length===1;
 $('#listNotice').textContent='Cada parte tem sua própria imagem e legenda. O conteúdo foi dividido para manter os nomes e números legíveis.';
 $('#partLabel').textContent='Parte '+(listPage+1)+' de '+pages.length;$('#previousPart').disabled=listPage===0;$('#nextPart').disabled=listPage>=pages.length-1;
 imageReady=allowed;updateCaption();
 if(allowed)requestAnimationFrame(()=>{if(revision!==imageRevision)return;canvas.toBlob(blob=>{
  if(revision!==imageRevision||!imageReady)return;
  if(!blob){$('#exportStatus').textContent='Não foi possível preparar o PNG. Altere o formato e tente novamente.';return}
  cachedShare={revision,file:new File([blob],imageFilename(),{type:'image/png'})};updateShareControls();
 },'image/png')});
}
async function load(){
 if(loading)return;loading=true;$('#refresh').disabled=true;$('#dataStatus').textContent='Conferindo as bases e os 167 municípios…';
 const json=async p=>{const r=await fetch(p+'?v='+Date.now(),{cache:'no-store'});if(!r.ok)throw Error('Fonte indisponível: '+p);return r.json()};
 try{
  const [first,analysis,geo,second,part]=await Promise.all([json('data/rn-governador-mapa.json'),json('data/rn-analises.json'),json('assets/maps/rn-municipios.geojson'),json('data/rn-governador-mapa-2t.json').catch(()=>({})),json('data/entre-turnos-2t.json').catch(()=>({}))]);
  const next=E.build(first,second,analysis,part,geo);if(model?.ready&&!next.ready)throw Error('Atualização do segundo turno ainda não conciliada');
  const initialLoad=!model;model=next;preparePaths();
  const wanted=new URLSearchParams(location.search).get('municipio');if(wanted&&!selected)selected=model.rows.find(r=>E.key(r.name)===E.key(wanted))?.code||'';
  $('#compared').textContent=model.ready?'167':'—';$('#changed').textContent=model.ready?model.rows.filter(r=>r.status==='changed').length:'—';$('#same').textContent=model.ready?model.rows.filter(r=>r.status==='same').length:'—';
  const t1=E.stateValue(model,'turnout_pct',1),t2=E.stateValue(model,'turnout_pct',2);$('#turnout').textContent=f(t2,'pct');$('#turnoutDelta').textContent=t2===null?'segundo turno indisponível':f(t2-t1,'pp',true)+' em relação ao 1º turno';
  $('#dataStatus').textContent=model.ready?'Bases TSE conferidas · 167/167 municípios · dois turnos completos':'1º turno disponível · '+model.secondError;
  $('#sourceDates').textContent=dates();render();
  if(initialLoad&&location.hash)requestAnimationFrame(()=>document.getElementById(location.hash.slice(1))?.scrollIntoView({behavior:'instant'}));
 }catch(e){$('#dataStatus').textContent=model?'Falha na atualização. Mantendo a última base conferida.':'Dados indisponíveis: '+e.message;if(!model){$('#download').disabled=true;$('#csv').disabled=true;$('#copyText').disabled=true}}
 finally{loading=false;$('#refresh').disabled=false}
}

for(const id of ['metric','candidate','view','group','sort'])$('#'+id).addEventListener('change',()=>{$('#publication').value='analysis';resetPublicationText();render()});
$('#search').addEventListener('input',()=>{$('#publication').value='analysis';resetPublicationText();render()});$('#refresh').addEventListener('click',load);$('#csv').addEventListener('click',exportCsv);
$('#clearCity').addEventListener('click',()=>{selected='';resetPublicationText();render()});
$('#createImage').addEventListener('click',()=>{$('#imageScope').value=selected?'city':'state';$('#publication').value=selected?'city':'analysis';resetPublicationText();renderImage();$('#estudio').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'auto':'smooth'})});
$('#studioForm').addEventListener('submit',e=>e.preventDefault());
$('#publication').addEventListener('change',choosePublication);
$('#captionStyle').addEventListener('change',()=>{
 resetPublicationText();if($('#captionStyle').value==='names'){$('#template').value='list';$('#metric').value='leadership';$('#view').value='delta';$('#imageScope').value='state';render()}else{if($('#template').value==='list')$('#template').value='map';renderImage()}
});
$('#size').addEventListener('change',()=>{if(artPages().length>1||['list','ranking','routes','compare'].includes($('#template').value))resetPublicationText();renderImage()});$('#imageScope').addEventListener('change',()=>{resetPublicationText();renderImage()});$('#palette').addEventListener('change',renderImage);
$('#template').addEventListener('change',()=>{
 resetPublicationText();if(['list','routes'].includes($('#template').value)){$('#metric').value='leadership';$('#view').value='delta'}
 if($('#template').value==='list')$('#captionStyle').value='names';else if($('#captionStyle').value==='names')$('#captionStyle').value='summary';
 render();
});
$('#imageTitle').addEventListener('input',renderImage);
$('#supportText').addEventListener('input',()=>{captionDirty=true;$('#exportStatus').textContent='';updateShareControls()});
$('#regenerateText').addEventListener('click',()=>{captionDirty=false;$('#exportStatus').textContent='';updateCaption(true)});
$('#previousPart').addEventListener('click',()=>{if(listPage>0){listPage--;captionDirty=false;renderImage()}});
$('#nextPart').addEventListener('click',()=>{if(listPage<artPages().length-1){listPage++;captionDirty=false;renderImage()}});
$('#download').addEventListener('click',()=>{if(!imageReady||!cachedShare)return;downloadBlob(cachedShare.file,cachedShare.file.name);$('#exportStatus').textContent='PNG preparado para download. Use a legenda acima para publicar no X.'});
$('#shareX').addEventListener('click',sharePublication);
$('#openX').addEventListener('click',event=>{if($('#openX').getAttribute('aria-disabled')==='true'){event.preventDefault();return}$('#exportStatus').textContent='O X abrirá com o texto. Anexe o PNG da imagem antes de publicar.'});
$('#copyText').addEventListener('click',async()=>{try{await navigator.clipboard.writeText($('#supportText').value);$('#exportStatus').textContent='Texto para o X copiado.'}catch(e){$('#supportText').focus();$('#supportText').select();$('#exportStatus').textContent='Texto selecionado. Use Copiar no menu do celular.'}});
if(matchMedia('(max-width:760px)').matches){$('#imageSettings').open=false;$('#size').value='1200x1200'}
window.__stats={get model(){return model},get visible(){return visible},get imageReady(){return imageReady},get shareReady(){return !!cachedShare},get listPage(){return listPage},get artAudit(){return JSON.parse($('#preview').dataset.artAudit||'{}')},renderImage};
load();
})();
