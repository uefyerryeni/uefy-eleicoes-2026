/* UEFY Entre Turnos — governadoria do RN: mudanças de primeira posição municipal.
 * Critério: somente TSE oficial e município com 100% das seções totalizadas.
 * Jamais interpretar mudança de primeiro colocado como transferência individual de voto.
 */
(()=>{'use strict';
const $=s=>document.querySelector(s), NS='http://www.w3.org/2000/svg';
const labels={'13':'CADU DE LULA','44':'ALLYSON BEZERRA','22':'ÁLVARO DIAS'};
const colors={'13':'#d62828','44':'#1976d2','22':'#2e7d32'};
const unknown='#dfe4db';
let first=null,second=null,geometry=null,rows=[],view='first',group='all',selected='',currentStatus='waiting';
const fmt=n=>Number(n).toLocaleString('pt-BR');
const pct=n=>Number(n).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})+'%';
const validCodes=new Set(Object.keys(labels));
const clean=n=>String(n||'').replace(/\D/g,'');
function isComplete(v){
 return !!v&&v.status==='ok'&&Number(v.progress)===100&&Number(v.votes)>0
  &&validCodes.has(clean(v.candidate_number))&&Array.isArray(v.top3)&&v.top3.length>=2
  &&Number(v.top3[0].votes)>Number(v.top3[1].votes)
  &&clean(v.top3[0].number)===clean(v.candidate_number)
  &&Number(v.top3[0].votes)===Number(v.votes);
}
function classify(a,b){
 if(!isComplete(a)||!isComplete(b))return 'pending';
 return clean(a.candidate_number)===clean(b.candidate_number)?'same':'changed';
}
const linkByCode=leaders=>{
 const result=new Map();
 for(const [name,value] of Object.entries(leaders||{})){
  const code=String(value?.code||'');
  if(!/^\d{5}$/.test(code)||result.has(code))return null;
  result.set(code,{...value,name});
 }
 return result;
};
function buildRows(){
 rows=[];
 const base=linkByCode(first?.leaders),next=linkByCode(second?.leaders);
 const authorized=second?.round===2&&String(second?.election_id)==='6260';
 const safeFirst=first?.publication_ready===true&&Number(first?.municipalities_read)===167;
 if(!safeFirst||!base||base.size!==167)throw Error('Base histórica do primeiro turno incompleta.');
 for(const [code,a] of base){
   if(!isComplete(a))throw Error('Registro do 1º turno sem totalização completa: '+code);
   // Se não foi validado como segundo turno, não exibe nenhum candidato do segundo turno.
   const potential=authorized?next?.get(code):null;
   const b=isComplete(potential)&&['13','44'].includes(clean(potential?.candidate_number))?potential:null;
   const status=b?classify(a,b):'pending';
   rows.push({code,name:a.name,first:a,second:b,status,
    from:clean(a.candidate_number),to:b?clean(b.candidate_number):null});
 }
 rows.sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'));
 const municipalityParam=new URLSearchParams(location.search).get('municipio');
 if(municipalityParam&&!selected){
  const match=rows.find(r=>municipalAlias(r.name)===municipalAlias(municipalityParam));
  if(match)selected=match.code;
 }
 const completed=rows.filter(r=>r.second).length;
 currentStatus=completed===167?'complete':completed>0?'partial':'waiting';
 // Mesmo ao terminar, não classificar 100% dos municípios se o snapshot tiver erros.
 if(completed===167&&(!second?.publication_ready||Number(second?.municipalities_read)!==167||(second?.errors||[]).length)){currentStatus='partial'}
}
function summary(){
 const ready=rows.filter(r=>r.status!=='pending');
 const unchanged=ready.filter(r=>r.status==='same');
 const changed=ready.filter(r=>r.status==='changed');
 $('#mtTotal').textContent=fmt(ready.length);
 $('#mtStayed').textContent=fmt(unchanged.length);
 $('#mtChanged').textContent=fmt(changed.length);
 $('#mtMissing').textContent=fmt(rows.length-ready.length);
 $('#mtCadastrados').textContent=fmt(rows.length);
 const readyAll=currentStatus==='complete'&&ready.length===167;
 $('#mtStatus').textContent=readyAll?'167 municípios comparados · dados oficiais de ambos os turnos':ready.length?ready.length+' municípios totalizados no 2º turno · comparações parciais oficiais':'Primeiro turno completo · segundo turno aguardando apuração';
 $('#mtStatus').classList.toggle('is-ready',readyAll);
 $('#mtDisclaimer').textContent=readyAll?
  'Resultados oficiais municipalizados. Permanência ou mudança refere-se somente ao candidato com mais votos válidos em cada município.' :
  'Sem projeções: mudanças só aparecem onde a totalização municipal oficial do segundo turno alcançou 100%. As demais cidades ficam pendentes.';
 const counts=new Map();
 for(const r of ready){const k=r.from+'-'+r.to;counts.set(k,(counts.get(k)||0)+1)}
 const transitions=['13-13','44-44','13-44','44-13','22-13','22-44'];
 const panel=$('#mtTransitions');panel.replaceChildren();
 if(!ready.length){const p=document.createElement('p');p.className='mt-await';p.textContent='As seis combinações possíveis serão preenchidas com as totalizações oficiais de 25 de outubro.';panel.appendChild(p);}
 else{
  for(const k of transitions){
   const [a,b]=k.split('-'),cnt=counts.get(k)||0;
   const el=document.createElement('button');el.type='button';el.className='mt-route'+(group===k?' active':'');
   el.setAttribute('aria-pressed',String(group===k));
   const left=document.createElement('span');left.textContent=labels[a];const right=document.createElement('span');right.textContent=labels[b];
   const arrow=document.createElement('b');arrow.textContent='→';const qty=document.createElement('strong');qty.textContent=fmt(cnt);
   el.append(left,arrow,right,qty);
   el.addEventListener('click',()=>{group=group===k?'all':k;$('#mtFilter').value=group;renderView()});
   panel.append(el);
  }
 }
}
function color(r){
 if(view==='first')return colors[r.from]||unknown;
 if(view==='second')return r.second?colors[r.to]:unknown;
 if(!r.second)return unknown;
 if(r.status==='same')return '#2d7361';
 return '#d8a227';
}
function includes(r){
 if(group==='all')return true;
 if(group==='same'||group==='changed'||group==='pending')return r.status===group;
 const [a,b]=group.split('-');return r.from===a&&r.to===b;
}
function project(features){
 const coords=[];
 const collect=g=>{
  if(g?.type==='Polygon')g.coordinates.forEach(r=>r.forEach(p=>coords.push(p)));
  if(g?.type==='MultiPolygon')g.coordinates.forEach(poly=>poly.forEach(r=>r.forEach(p=>coords.push(p))));
 };
 features.forEach(f=>collect(f.geometry));
 let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
 for(const [x,y] of coords){minX=Math.min(x,minX);maxX=Math.max(x,maxX);minY=Math.min(y,minY);maxY=Math.max(y,maxY)}
 const width=760,height=560,pad=20,scale=Math.min((width-pad*2)/(maxX-minX),(height-pad*2)/(maxY-minY));
 const dx=(width-(maxX-minX)*scale)/2,dy=(height-(maxY-minY)*scale)/2;
 return ([x,y])=>[dx+(x-minX)*scale,height-dy-(y-minY)*scale];
}
function geometryPath(g,p){
 const ring=polygon=>polygon.map(r=>r.map(([x,y],i)=>{const q=p([x,y]);return (i?'L':'M')+q[0].toFixed(1)+','+q[1].toFixed(1)}).join('')+'Z').join('');
 return g.type==='Polygon'?ring(g.coordinates):g.type==='MultiPolygon'?g.coordinates.map(ring).join(''):'';
}
function municipalAlias(name){
 const key=String(name||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
 return ({acu:'assu',ares:'arez',januariocicco:'boasaude'})[key]||key;
}
function drawMap(){
 const svg=$('#mtMap');svg.replaceChildren();
 const p=project(geometry.features),byCode=new Map(rows.map(r=>[r.code,r]));
 for(const feature of geometry.features){
  const code=String(feature.properties?.codarea||feature.properties?.cdmun||feature.properties?.codigo||'');
  let row=byCode.get(code);
  if(!row){const name=municipalAlias(feature.properties?.nome);row=rows.find(r=>municipalAlias(r.name)===name)}
  const path=document.createElementNS(NS,'path');
  path.setAttribute('d',geometryPath(feature.geometry,p));
  path.setAttribute('class','mt-municipality'+(row?.code===selected?' selected':''));
  path.setAttribute('fill',row&&includes(row)?color(row):'#e5e6de');
  path.setAttribute('opacity',row&&includes(row)?'1':'0.32');
  const title=document.createElementNS(NS,'title');
  title.textContent=row?row.name+': '+labels[row.from]+' (1º turno)'+(row.second?' / '+labels[row.to]+' (2º turno)':' / aguardando 2º turno'):'Município';
  path.append(title);
  if(row){
   path.tabIndex=0;path.setAttribute('role','button');path.setAttribute('aria-label',title.textContent);
   const activate=()=>{selected=row.code;renderDetail();drawMap()};
   path.addEventListener('click',activate);
   path.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();activate()}});
  }
  svg.append(path);
 }
}
function renderDetail(){
 const r=rows.find(r=>r.code===selected);
 $('#mtChosen').textContent=r?r.name:'RIO GRANDE DO NORTE';
 $('#mtFirstName').textContent=r?labels[r.from]:'Selecione uma cidade';
 $('#mtSecondName').textContent=r?(r.second?labels[r.to]:'Aguardando totalização'):'Aguardando 25/10';
 $('#mtFirstValue').textContent=r?(pct(r.first.pct)+' · '+fmt(r.first.votes)+' votos'):'—';
 $('#mtSecondValue').textContent=r?.second?(pct(r.second.pct)+' · '+fmt(r.second.votes)+' votos'):'—';
 $('#mtChangeState').textContent=r?({pending:'Sem comparação disponível',same:'Manteve a primeira posição',changed:'Mudou a primeira posição'}[r.status]):'Selecione um município';
 $('#mtDetailNote').textContent=r?'A classificação descreve a primeira posição municipal, não a transferência de votos entre pessoas.':'Clique em um município no mapa ou na tabela para conferir.';
}
function renderTable(){
 const search=String($('#mtSearch').value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 const subset=rows.filter(r=>includes(r)&&r.name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().includes(search));
 const tbody=$('#mtRows');tbody.replaceChildren();
 for(const r of subset){
  const tr=document.createElement('tr');tr.dataset.code=r.code;
  if(selected===r.code)tr.classList.add('selected');
  const vals=[r.name,labels[r.from],r.second?labels[r.to]:'—',r.status==='pending'?'Aguardando':r.status==='same'?'Permaneceu':'Mudou'];
  vals.forEach((value,i)=>{const td=document.createElement('td');td.textContent=value;if(i===3)td.className='mt-class-'+r.status;tr.append(td)});
  tr.tabIndex=0;tr.addEventListener('click',()=>{selected=r.code;renderDetail();drawMap();renderTable()});
  tr.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();tr.click()}});
  tbody.append(tr);
 }
 if(!subset.length){const tr=document.createElement('tr');tr.innerHTML='<td colspan="4">Não há municípios neste filtro.</td>';tbody.append(tr)}
 $('#mtCount').textContent=subset.length+' de '+rows.length+' municípios exibidos';
}
function renderView(){
 const available=rows.some(r=>r.second);
 if(!available&&view!=='first'){view='first';$('#mtView').value='first'}
 // Ao aguardar, filtros por mudanças ficam indisponíveis.
 $('#mtView').querySelector('option[value="second"]').disabled=!available;
 $('#mtView').querySelector('option[value="changes"]').disabled=!available;
 $('#mtMapLabel').textContent=view==='first'?'MAPA · 1º TURNO':view==='second'?'MAPA · 2º TURNO':'MAPA · PERMANÊNCIAS E MUDANÇAS';
 $('#mtLegend').innerHTML='';
 const pairs=view==='changes'?[['#2d7361','Permaneceu'],['#d8a227','Mudou'],[unknown,'Aguardando']]:view==='first'?
 [['#d62828','Cadu de Lula'],['#1976d2','Allyson Bezerra'],['#2e7d32','Álvaro Dias']]:
 [['#d62828','Cadu de Lula'],['#1976d2','Allyson Bezerra'],[unknown,'Aguardando']];
 for(const [c,n] of pairs){const item=document.createElement('span');const sw=document.createElement('i');sw.style.background=c;item.append(sw,document.createTextNode(n));$('#mtLegend').append(item)}
 const sel=$('#mtFilter');for(const opt of sel.options){if(['same','changed','13-13','44-44','13-44','44-13','22-13','22-44'].includes(opt.value))opt.disabled=!available}
 if(!available&&group!=='all'&&group!=='pending'){group='all';sel.value='all'}
 summary();drawMap();renderDetail();renderTable();
}
function exportCsv(){
 const cols=['municipio','codigo_tse','mais_votado_1t','votos_1t','pct_1t','mais_votado_2t','votos_2t','pct_2t','situacao','fonte_1t','fonte_2t'];
 const output=[cols,...rows.filter(includes).map(r=>[r.name,r.code,labels[r.from],r.first.votes,r.first.pct,
  r.second?labels[r.to]:'',r.second?r.second.votes:'',r.second?r.second.pct:'',r.status==='pending'?'aguardando':r.status==='same'?'permaneceu':'mudou',
  'TSE 2026 - Governador - 6259',r.second?'TSE 2026 - Governador - 6260':'aguardando'])];
 const csv='\uFEFF'+output.map(arr=>arr.map(v=>'"'+String(v??'').replaceAll('"','""')+'"').join(';')).join('\r\n');
 const file=new Blob([csv],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(file),a=document.createElement('a');
 a.href=url;a.download='uefy-mudancas-municipais-rn-2026.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);
}
async function load(){
 $('#mtRefresh').disabled=true;$('#mtStatus').textContent='Conferindo os 167 municípios…';
 try{
  const fetchJSON=path=>fetch(path+(path.includes('?')?'&':'?')+'ts='+Date.now(),{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('Falha em '+path);return r.json()});
  [first,second,geometry]=await Promise.all([
   fetchJSON('data/rn-governador-mapa.json'),fetchJSON('data/rn-governador-mapa-2t.json'),
   geometry||fetch('assets/maps/rn-municipios.geojson').then(r=>r.json())
  ]);
  if(!Array.isArray(geometry?.features)||geometry.features.length!==167)throw Error('Malha municipal incompleta');
  buildRows();renderView();
  window.__mapaMudancas={get count(){return rows.length},get compared(){return rows.filter(r=>r.second).length},get pending(){return rows.filter(r=>!r.second).length},get ready(){return currentStatus==='complete'},get sample(){return rows[0]||null}};
 }catch(err){
  $('#mtStatus').textContent='Dados indisponíveis: '+err.message;
  $('#mtTableStatus').textContent='Não foi possível conferir as bases oficiais.';
 }finally{$('#mtRefresh').disabled=false}
}
$('#mtView').addEventListener('change',e=>{view=e.target.value;renderView()});
$('#mtFilter').addEventListener('change',e=>{group=e.target.value;renderView()});
$('#mtSearch').addEventListener('input',renderTable);
$('#mtRefresh').addEventListener('click',load);
$('#mtExport').addEventListener('click',exportCsv);
load();
})();