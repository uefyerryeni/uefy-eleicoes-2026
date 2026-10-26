/* Entre Turnos UEFY — indicadores oficiais, sem dados de demonstração. */
(()=>{'use strict';
const $=q=>document.querySelector(q),$$=q=>Array.from(document.querySelectorAll(q));
const METRICS={
 turnout_pct:{label:'Comparecimento',unit:'pct',path:['turnout_pct'],note:'Percentual de eleitoras e eleitores que compareceram no recorte estadual de Governador.'},
 abstention_pct:{label:'Abstenção',unit:'pct',path:['abstention_pct'],note:'Percentual do eleitorado do RN que não compareceu no recorte estadual de Governador.'},
 turnout:{label:'Eleitores que compareceram',unit:'count',path:['turnout'],note:'Número absoluto de eleitores que compareceram no recorte estadual de Governador.'},
 abstention:{label:'Eleitores ausentes',unit:'count',path:['abstention'],note:'Número absoluto de eleitores que não compareceram no recorte estadual de Governador.'},
 gov_blank_pct:{label:'Votos brancos para Governador',unit:'pct',path:['governor','blank_pct'],statePath:['gov','blank_pct'],secondPath:['gov','blank_pct'],note:'Percentual de votos brancos entre os votos totais para Governador, não sobre todo o eleitorado.'},
 gov_null_pct:{label:'Votos nulos para Governador',unit:'pct',path:['governor','null_pct'],statePath:['gov','null_pct'],secondPath:['gov','null_pct'],note:'Percentual de votos nulos entre os votos totais para Governador, não sobre todo o eleitorado.'},
 pres_blank_pct:{label:'Votos brancos para Presidente',unit:'pct',path:['president','blank_pct'],statePath:['pres','blank_pct'],secondPath:['pres','blank_pct'],note:'Percentual de votos brancos entre os votos totais para Presidente. O recorte presidencial pode incluir votos em trânsito.'},
 pres_null_pct:{label:'Votos nulos para Presidente',unit:'pct',path:['president','null_pct'],statePath:['pres','null_pct'],secondPath:['pres','null_pct'],note:'Percentual de votos nulos entre os votos totais para Presidente. O recorte presidencial pode incluir votos em trânsito.'}
};
for(const [id,office,title] of [['gov','governor','Governador'],['pres','president','Presidente']]){
 for(const [field,label,unit] of [['blank','Votos brancos','count'],['null','Votos nulos','count'],['valid','Votos válidos','count'],['valid_pct','Votos válidos','pct'],['total_votes','Total de votos','count']]){
 METRICS[id+'_'+field]={label:label+' para '+title,unit,path:[office,field],statePath:[id,field],secondPath:[id,field],note:'Dados específicos de '+title+'. Percentuais sobre o total de votos do cargo; variação percentual em pontos percentuais.'};
 }
}
METRICS.electorate={label:'Eleitorado',unit:'count',path:['electorate'],note:'Eleitorado do recorte estadual para Governador.'};
for(const [id,m] of Object.entries(METRICS)){if(!$('#etMetric option[value="'+id+'"]')){const o=document.createElement('option');o.value=id;o.textContent=m.label+(m.unit==='pct'?' (%)':'');$('#etMetric').appendChild(o)}}
let mapView='first',sort='name',loading=false;
const viewLabel=()=>mapView==='delta'?'VARIAÇÃO · 2º − 1º TURNO':mapView==='second'?'2º TURNO':'1º TURNO';
let first=null,second=null,geo=null,rows=[],ready=false,metric='turnout_pct',city=new URLSearchParams(location.search).get('municipio')||'',mapPaths=new Map();
const fmtNumber=n=>Number(n).toLocaleString('pt-BR');
const fmt=(n,m)=>n===undefined||n===null||!Number.isFinite(Number(n))?'—':m.unit==='pct'?Number(n).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})+'%':fmtNumber(n);
const get=(obj,path)=>path.reduce((acc,key)=>acc==null?undefined:acc[key],obj);
const key=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const aliases={acu:'assu',ares:'arez',januariocicco:'boasaude'};
const norm=s=>aliases[key(s)]||key(s);
const statePath=m=>m.statePath||['gov',...m.path];
function firstVal(row,m){
 const p=row?row.participation:((first?.participation||{}).state_2026||{});
 const path=row?m.path:statePath(m);
 if(path.at(-1)==='valid_pct'){const base=get(p,path.slice(0,-1));return base?.total_votes>0?100*base.valid/base.total_votes:undefined;}
 return get(p,path);
}
function secondVal(row,m){
 if(!ready)return undefined;
 const p=row?row.second:second?.state;
 const path=row?(m.secondPath||m.statePath||['gov',...m.path]):(m.secondPath||statePath(m));
 if(path.at(-1)==='valid_pct'){const base=get(p,path.slice(0,-1));return base?.total_votes>0?100*base.valid/base.total_votes:undefined;}
 return get(p,path);
}
function difference(a,b){return typeof a==='number'&&typeof b==='number'?b-a:undefined;}
function deltaFormat(n,m){if(n===undefined)return '—';const abs=m.unit==='pct'?Math.abs(n).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})+' p.p.':fmtNumber(Math.abs(n))+(metric==='turnout'||metric==='abstention'||metric==='electorate'?' eleitores':' votos');return (n>0?'+':n<0?'−':'')+abs;}
function rgba(hex){return [0,2,4].map(i=>parseInt(hex.slice(1+i,3+i),16));}
function blend(a,b,t){const x=rgba(a),y=rgba(b);return '#'+x.map((v,i)=>Math.round(v+(y[i]-v)*Math.max(0,Math.min(1,t))).toString(16).padStart(2,'0')).join('');}
function cityByName(n){return rows.find(r=>norm(r.name)===norm(n));}
function project(features,w,h){const pts=[];const collect=g=>{if(g.type==='Polygon')g.coordinates.forEach(r=>r.forEach(p=>pts.push(p)));else if(g.type==='MultiPolygon')g.coordinates.forEach(poly=>poly.forEach(r=>r.forEach(p=>pts.push(p))))};
 features.forEach(f=>collect(f.geometry));const xx=pts.map(p=>p[0]),yy=pts.map(p=>p[1]),minX=Math.min(...xx),maxX=Math.max(...xx),minY=Math.min(...yy),maxY=Math.max(...yy),pad=18,s=Math.min((w-2*pad)/(maxX-minX),(h-2*pad)/(maxY-minY)),ox=(w-(maxX-minX)*s)/2,oy=(h-(maxY-minY)*s)/2;return ([x,y])=>[ox+(x-minX)*s,h-oy-(y-minY)*s];}
function geometryPath(g,p){const shape=poly=>poly.map(r=>r.map((v,i)=>{const [x,y]=p(v);return (i?'L':'M')+x.toFixed(1)+' '+y.toFixed(1)}).join(' ')+'Z').join(' ');return g.type==='Polygon'?shape(g.coordinates):g.type==='MultiPolygon'?g.coordinates.map(shape).join(' '):'';}
function mapValue(r,m){const a=firstVal(r,m),b=secondVal(r,m);return mapView==='delta'?difference(a,b):mapView==='second'?b:a;}
function drawMap(){
 const svg=$('#etMap');svg.innerHTML='';mapPaths.clear();
 if(!geo?.features?.length)return;
 const projection=project(geo.features,760,560);
 const values=rows.map(r=>mapValue(r,METRICS[metric])).filter(v=>typeof v==='number');
 const lo=Math.min(...values),hi=Math.max(...values),extent=Math.max(Math.abs(lo),Math.abs(hi));
 $('#etMapMode').textContent='MAPA · '+viewLabel();
 $('#etMapDescription').textContent='Distribuição de '+METRICS[metric].label.toLowerCase()+' · '+viewLabel()+'. Selecione um município para consultar os dois turnos.';
 $('.et-scale-bar').style.background=mapView==='delta'?'linear-gradient(90deg,#4169a1,#f1f1e8,#226652)':'';
 $('#etScaleLow').textContent=mapView==='delta'?'REDUÇÃO':'MENOR VALOR';$('#etScaleHigh').textContent=mapView==='delta'?'AUMENTO':'MAIOR VALOR';
 for(const f of geo.features){
   const r=cityByName(f.properties?.nome),v=r?mapValue(r,METRICS[metric]):undefined;
   const path=document.createElementNS('http://www.w3.org/2000/svg','path');
   path.setAttribute('d',geometryPath(f.geometry,projection));
   path.setAttribute('fill',v===undefined?'#dadfd3':mapView==='delta'?blend('#f1f1e8',v<0?'#4169a1':'#226652',extent?Math.abs(v)/extent:0):blend('#dfe7d7','#226652',hi>lo?(v-lo)/(hi-lo):.5));
   path.setAttribute('class','et-city'+(r&&city===r.name?' active':''));
   path.setAttribute('tabindex','0');
   path.setAttribute('role','button');
   path.setAttribute('aria-label',(f.properties?.nome||'Município')+' — '+(mapView==='delta'?deltaFormat(v,METRICS[metric]):fmt(v,METRICS[metric]))+' · '+viewLabel());
   const t=document.createElementNS('http://www.w3.org/2000/svg','title');
   t.textContent=(f.properties?.nome||'Município')+': '+(mapView==='delta'?deltaFormat(v,METRICS[metric]):fmt(v,METRICS[metric]))+' · '+viewLabel();path.appendChild(t);
   const activate=()=>{if(r){city=r.name;$('#etCity').value=r.name;renderSelection();}};
   path.addEventListener('click',activate);path.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();activate()}});
   svg.appendChild(path);if(r)mapPaths.set(r.name,path);
 }
}
function renderSelection(){
 const m=METRICS[metric],r=city?cityByName(city):null,a=firstVal(r,m),b=secondVal(r,m),d=difference(a,b);
 $('#etScopeTitle').textContent=r?.name||'Rio Grande do Norte';
 $('#etMetricLabel').textContent=m.label+' · '+(r?'recorte municipal':'total estadual');
 $('#etMetricDescription').textContent=m.note+' Variações percentuais são mostradas em pontos percentuais.';
 $('#etFirstValue').textContent=fmt(a,m);
 $('#etSecondValue').textContent=fmt(b,m);
 $('#etDeltaValue').textContent=deltaFormat(d,m);
 $('#etDeltaCaption').textContent=ready?'2º TURNO MENOS 1º TURNO':'SERÁ CALCULADA APÓS O RESULTADO OFICIAL';
 $('#etSecondCaption').textContent=ready?'SEGUNDO TURNO · FONTE: TSE':'AGUARDANDO BASE FINAL OFICIAL';
 $('#etFocusName').textContent=(r?.name||'RIO GRANDE DO NORTE').toLocaleUpperCase('pt-BR');
 $('#etFocusCaption').textContent=m.label+' · '+viewLabel();
 $('#etFocusValue').textContent=mapView==='delta'?deltaFormat(d,m):fmt(mapView==='second'?b:a,m);
 $('#etFocusText').textContent=r?'Dados agregados de '+r.name+'. A seleção não indica preferência eleitoral.':'Selecione um dos municípios no mapa, na tabela ou no filtro.';
 mapPaths.forEach((p,n)=>p.classList.toggle('active',n===city));
 $$('#etTableBody tr[data-city]').forEach(tr=>tr.classList.toggle('selected',tr.dataset.city===city));
}
function filteredRows(){
 const q=norm($('#etSearch').value),m=METRICS[metric];
 const value=r=>sort.startsWith('delta')?difference(firstVal(r,m),secondVal(r,m)):sort.startsWith('second')?secondVal(r,m):firstVal(r,m);
 return rows.filter(r=>!q||norm(r.name).includes(q)).sort((a,b)=>{if(sort==='name')return a.name.localeCompare(b.name,'pt-BR');const x=value(a),y=value(b);if(x==null||y==null)return x==null?(y==null?0:1):-1;return (sort.endsWith('asc')?x-y:y-x)||a.name.localeCompare(b.name,'pt-BR')});
}
function renderTable(){
 const m=METRICS[metric];
 const matches=filteredRows();
 const tbody=$('#etTableBody');tbody.innerHTML='';
 for(const r of matches){
   const a=firstVal(r,m),b=secondVal(r,m),d=difference(a,b);
   const tr=document.createElement('tr');tr.dataset.city=r.name;
   for(const value of [r.name,fmt(a,m),fmt(b,m),deltaFormat(d,m)]){
     const td=document.createElement('td');td.textContent=value;tr.appendChild(td);
   }
   tr.addEventListener('click',()=>{city=r.name;$('#etCity').value=r.name;renderSelection();});
   tbody.appendChild(tr);
 }
 if(!matches.length){const tr=document.createElement('tr');tr.innerHTML='<td colspan="4">Nenhum município encontrado.</td>';tbody.appendChild(tr)}
 $('#etTableCount').textContent=matches.length+' município(s) listado(s) · dados do 1º turno: 04/10/2026 · dados do 2º turno: '+(ready?'25/10/2026':'aguardando base final');
}
function render(){
 if(!first)return;
 rows=(first.cross?.municipalities||[]).filter(x=>x.participation).sort((a,b)=>a.name.localeCompare(b.name,'pt-BR')).map(x=>({...x,second:(second?.municipalities||[]).find(y=>String(y.code)===String(x.code))||null}));
 // Não divulgar comparação parcial: só 167 municípios e ambos os cargos estaduais finais.
 ready=Boolean(second?.publication_ready===true&&second?.round===2&&second.election_ids?.gov==='6260'&&second.election_ids?.pres==='6258'&&second.municipalities_read===167&&second.municipalities?.length===167&&new Set(second.municipalities.map(r=>String(r.code))).size===167&&!(second.errors?.length)&&rows.length===167&&rows.every(r=>r.second?.gov&&r.second?.pres)&&second.state?.gov?.complete&&second.state?.pres?.complete);
 $('#firstStatus').textContent=(rows.length===167?'167/167 municípios · dados oficiais':'Base incompleta · '+rows.length+'/167 municípios');
 $('#secondStatus').textContent=ready?'167/167 municípios · base oficial final':((second?.municipalities_read||0)+'/167 com resultado final · aguardando consolidação');
 const info=$('#etCompleteness');info.classList.toggle('ready',ready);
 info.innerHTML='<span class="et-indicator"></span><b>'+(ready?'Comparação disponível':'Base do segundo turno aguardada')+'</b><small>'+(ready?'Resultados oficiais completos, sem valores simulados.':'Comparações só serão exibidas após a conclusão dos dados oficiais.')+'</small>';
 if(!ready){mapView='first';$('#etView').value='first'}
 $$('#etView option, #etSort option').forEach(o=>{if(/second|delta/.test(o.value))o.disabled=!ready});
 if(!ready&&/second|delta/.test(sort)){sort='name';$('#etSort').value=sort}
 const sel=$('#etCity');const old=sel.value;sel.innerHTML='<option value="">Rio Grande do Norte (total estadual)</option>';
 rows.forEach(r=>{const o=document.createElement('option');o.value=r.name;o.textContent=r.name;sel.appendChild(o)});
 city=rows.find(r=>norm(r.name)===norm(city))?.name||'';sel.value=city;
 drawMap();renderTable();renderSelection();
}
async function load(){
 if(loading)return;loading=true;
 $('#etRefresh').disabled=true;$('#etRefresh').textContent='Atualizando…';
 try{
   const [a,b,g]=await Promise.all([
     fetch('data/rn-analises.json?ts='+Date.now(),{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('Primeiro turno indisponível');return r.json()}),
     fetch('data/entre-turnos-2t.json?ts='+Date.now(),{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('Segundo turno indisponível');return r.json()}),
     geo||fetch('assets/maps/rn-municipios.geojson',{cache:'force-cache'}).then(r=>r.json())
   ]);
   if(!Array.isArray(a.cross?.municipalities)||a.cross.municipalities.length!==167||!Array.isArray(g?.features)||g.features.length!==167)throw Error('Base incompleta');
   first=a;second=b;geo=g;
   render();
   $('#etUpdateStatus').textContent='Última consulta: '+new Date().toLocaleTimeString('pt-BR')+' · base do 2º turno: '+(b.source_generated_at||'aguardando')+'. Releitura automática a cada 60 s.';
 }catch(e){$('#etUpdateStatus').textContent=first?'Falha na atualização. Mantendo a última base carregada; consulte o horário da fonte.':'Não foi possível carregar as bases oficiais. Tente atualizar.';}
 finally{loading=false;$('#etRefresh').disabled=false;$('#etRefresh').innerHTML='Atualizar dados <span aria-hidden="true">↻</span>';}
}
function exportCsv(all=false){
 if(!rows.length)return;
 const m=METRICS[metric];const header=['municipio','indicador','unidade','primeiro_turno_2026','segundo_turno_2026','variacao','fonte'];
 const selected=all?Object.values(METRICS):[m];
 header.push('unidade_variacao','codigo_tse','situacao_segundo_turno','horario_fonte_segundo_turno');
 const lines=[header,...filteredRows().flatMap(r=>selected.map(indicator=>{
   const a=firstVal(r,indicator),b=secondVal(r,indicator);
   return [r.name,indicator.label,indicator.unit==='pct'?'percentual':'quantidade',a??'',b??'',difference(a,b)??'','TSE - resultados oficiais',indicator.unit==='pct'?'pontos percentuais':'quantidade',r.code,ready?'final':'aguardando base final',second?.source_generated_at||''];
 }))].map(row=>row.map(v=>'"'+String(v).replaceAll('"','""')+'"').join(';'));
 const blob=new Blob(['\ufeff'+lines.join('\r\n')],{type:'text/csv;charset=utf-8'});
 const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='uefy-entre-turnos-rn-'+(all?'todos-indicadores':metric)+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),30000);
}
$('#etMetric').addEventListener('change',e=>{metric=e.target.value;drawMap();renderTable();renderSelection()});
$('#etCity').addEventListener('change',e=>{city=e.target.value;renderSelection()});
$('#etSearch').addEventListener('input',renderTable);
$('#etReset').addEventListener('click',()=>{metric='turnout_pct';city='';mapView='first';sort='name';$('#etView').value='first';$('#etSort').value='name';$('#etMetric').value=metric;$('#etCity').value='';$('#etSearch').value='';drawMap();renderTable();renderSelection()});
$('#etCsv').addEventListener('click',()=>exportCsv());
$('#etCsvAll').addEventListener('click',()=>exportCsv(true));
$('#etView').addEventListener('change',e=>{mapView=e.target.value;drawMap();renderSelection()});
$('#etSort').addEventListener('change',e=>{sort=e.target.value;renderTable();renderSelection()});
$('#etRefresh').addEventListener('click',load);
const theme=$('#themeToggle');
if(localStorage.getItem('uefy-eleicoes-theme')==='dark')document.body.classList.add('dark');
const sync=()=>{const dark=document.body.classList.contains('dark');theme.textContent=dark?'☀':'◐';theme.setAttribute('aria-pressed',String(dark))};
theme.addEventListener('click',()=>{document.body.classList.toggle('dark');localStorage.setItem('uefy-eleicoes-theme',document.body.classList.contains('dark')?'dark':'light');sync()});sync();
document.querySelectorAll('.mobile-menu a').forEach(a=>a.addEventListener('click',()=>a.closest('details')?.removeAttribute('open')));
const top=$('#toTop');window.addEventListener('scroll',()=>top.classList.toggle('show',scrollY>360),{passive:true});top.addEventListener('click',()=>window.scrollTo({top:0,behavior:'smooth'}));
window.__entreTurnos={get ready(){return ready},get rows(){return rows.length},get second(){return second},get metric(){return metric}};
setInterval(()=>{if(!document.hidden)load()},60000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)load()});
load();
})();