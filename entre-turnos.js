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
let first=null,second=null,geo=null,rows=[],ready=false,metric='turnout_pct',city='',mapPaths=new Map();
const fmtNumber=n=>Number(n).toLocaleString('pt-BR');
const fmt=(n,m)=>n===undefined||n===null||!Number.isFinite(Number(n))?'—':m.unit==='pct'?Number(n).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})+'%':fmtNumber(n);
const get=(obj,path)=>path.reduce((acc,key)=>acc==null?undefined:acc[key],obj);
const key=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const aliases={acu:'assu',ares:'arez',januariocicco:'boasaude'};
const norm=s=>aliases[key(s)]||key(s);
const statePath=m=>m.statePath||['gov',...m.path];
function firstVal(row,m){
 const p=row?row.participation:((first?.participation||{}).state_2026||{});
 return get(p,row?m.path:statePath(m));
}
function secondVal(row,m){
 if(!ready)return undefined;
 const p=row?row.second:second?.state;
 return get(p,row?(m.secondPath||m.statePath||['gov',...m.path]):(m.secondPath||statePath(m)));
}
function difference(a,b){return typeof a==='number'&&typeof b==='number'?b-a:undefined;}
function deltaFormat(n,m){if(n===undefined)return '—';const abs=m.unit==='pct'?Math.abs(n).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})+' p.p.':fmtNumber(Math.abs(n))+' eleitores';return (n>0?'+':n<0?'−':'')+abs;}
function rgba(hex){return [0,2,4].map(i=>parseInt(hex.slice(1+i,3+i),16));}
function blend(a,b,t){const x=rgba(a),y=rgba(b);return '#'+x.map((v,i)=>Math.round(v+(y[i]-v)*Math.max(0,Math.min(1,t))).toString(16).padStart(2,'0')).join('');}
function cityByName(n){return rows.find(r=>norm(r.name)===norm(n));}
function project(features,w,h){const pts=[];const collect=g=>{if(g.type==='Polygon')g.coordinates.forEach(r=>r.forEach(p=>pts.push(p)));else if(g.type==='MultiPolygon')g.coordinates.forEach(poly=>poly.forEach(r=>r.forEach(p=>pts.push(p))))};
 features.forEach(f=>collect(f.geometry));const xx=pts.map(p=>p[0]),yy=pts.map(p=>p[1]),minX=Math.min(...xx),maxX=Math.max(...xx),minY=Math.min(...yy),maxY=Math.max(...yy),pad=18,s=Math.min((w-2*pad)/(maxX-minX),(h-2*pad)/(maxY-minY)),ox=(w-(maxX-minX)*s)/2,oy=(h-(maxY-minY)*s)/2;return ([x,y])=>[ox+(x-minX)*s,h-oy-(y-minY)*s];}
function geometryPath(g,p){const shape=poly=>poly.map(r=>r.map((v,i)=>{const [x,y]=p(v);return (i?'L':'M')+x.toFixed(1)+' '+y.toFixed(1)}).join(' ')+'Z').join(' ');return g.type==='Polygon'?shape(g.coordinates):g.type==='MultiPolygon'?g.coordinates.map(shape).join(' '):'';}
function drawMap(){
 const svg=$('#etMap');svg.innerHTML='';mapPaths.clear();
 if(!geo?.features?.length)return;
 const projection=project(geo.features,760,560);
 const values=rows.map(r=>firstVal(r,METRICS[metric])).filter(v=>typeof v==='number');
 const lo=Math.min(...values),hi=Math.max(...values);
 for(const f of geo.features){
   const r=cityByName(f.properties?.nome),v=r?firstVal(r,METRICS[metric]):undefined;
   const path=document.createElementNS('http://www.w3.org/2000/svg','path');
   path.setAttribute('d',geometryPath(f.geometry,projection));
   path.setAttribute('fill',v===undefined?'#dadfd3':blend('#dfe7d7','#226652',hi>lo?(v-lo)/(hi-lo):.5));
   path.setAttribute('class','et-city'+(r&&city===r.name?' active':''));
   path.setAttribute('tabindex','0');
   path.setAttribute('role','button');
   path.setAttribute('aria-label',(f.properties?.nome||'Município')+' — '+fmt(v,METRICS[metric])+' no 1º turno');
   const t=document.createElementNS('http://www.w3.org/2000/svg','title');
   t.textContent=(f.properties?.nome||'Município')+': '+fmt(v,METRICS[metric])+' no primeiro turno';path.appendChild(t);
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
 $('#etFocusCaption').textContent=m.label+' · 1º turno';
 $('#etFocusValue').textContent=fmt(a,m);
 $('#etFocusText').textContent=r?'Dados agregados de '+r.name+'. A seleção não indica preferência eleitoral.':'Selecione um dos municípios no mapa, na tabela ou no filtro.';
 mapPaths.forEach((p,n)=>p.classList.toggle('active',n===city));
 $$('#etTableBody tr[data-city]').forEach(tr=>tr.classList.toggle('selected',tr.dataset.city===city));
}
function renderTable(){
 const m=METRICS[metric],q=norm($('#etSearch').value);
 const matches=rows.filter(r=>!q||norm(r.name).includes(q));
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
 ready=Boolean(second?.publication_ready===true&&second?.round===2&&second.election_ids?.gov==='6260'&&second.election_ids?.pres==='6258'&&second.municipalities_read===167&&rows.length===167&&rows.every(r=>r.second?.gov&&r.second?.pres)&&second.state?.gov?.complete&&second.state?.pres?.complete);
 $('#firstStatus').textContent=(rows.length===167?'167/167 municípios · dados oficiais':'Base incompleta · '+rows.length+'/167 municípios');
 $('#secondStatus').textContent=ready?'167/167 municípios · base oficial final':((second?.municipalities_read||0)+'/167 com resultado final · aguardando consolidação');
 const info=$('#etCompleteness');info.classList.toggle('ready',ready);
 info.innerHTML='<span class="et-indicator"></span><b>'+(ready?'Comparação disponível':'Base do segundo turno aguardada')+'</b><small>'+(ready?'Resultados oficiais completos, sem valores simulados.':'Comparações só serão exibidas após a conclusão dos dados oficiais.')+'</small>';
 $('#etMapMode').textContent='MAPA · 1º TURNO';
 const sel=$('#etCity');const old=sel.value;sel.innerHTML='<option value="">Rio Grande do Norte (total estadual)</option>';
 rows.forEach(r=>{const o=document.createElement('option');o.value=r.name;o.textContent=r.name;sel.appendChild(o)});
 sel.value=rows.some(r=>r.name===city)?city:'';
 drawMap();renderTable();renderSelection();
}
async function load(){
 $('#etRefresh').disabled=true;$('#etRefresh').textContent='Atualizando…';
 try{
   const [a,b,g]=await Promise.all([
     fetch('data/rn-analises.json?ts='+Date.now(),{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('Primeiro turno indisponível');return r.json()}),
     fetch('data/entre-turnos-2t.json?ts='+Date.now(),{cache:'no-store'}).then(r=>r.ok?r.json():null).catch(()=>null),
     geo||fetch('assets/maps/rn-municipios.geojson',{cache:'force-cache'}).then(r=>r.json())
   ]);
   first=a;second=b;geo=g;
   render();
 }catch(e){$('#firstStatus').textContent='Não foi possível carregar a base histórica.';$('#etCompleteness').querySelector('small').textContent='Dados indisponíveis. Atualize a página.';}
 finally{$('#etRefresh').disabled=false;$('#etRefresh').innerHTML='Atualizar dados <span aria-hidden="true">↻</span>';}
}
function exportCsv(){
 if(!rows.length)return;
 const m=METRICS[metric];const header=['municipio','indicador','unidade','primeiro_turno_2026','segundo_turno_2026','variacao','fonte'];
 const lines=[header,...rows.map(r=>{
   const a=firstVal(r,m),b=secondVal(r,m);
   return [r.name,m.label,m.unit==='pct'?'percentual':'eleitores',a??'',b??'',difference(a,b)??'','TSE - resultados oficiais'];
 })].map(row=>row.map(v=>'"'+String(v).replaceAll('"','""')+'"').join(';'));
 const blob=new Blob(['\ufeff'+lines.join('\r\n')],{type:'text/csv;charset=utf-8'});
 const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='uefy-entre-turnos-rn-'+metric+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),2500);
}
$('#etMetric').addEventListener('change',e=>{metric=e.target.value;drawMap();renderTable();renderSelection()});
$('#etCity').addEventListener('change',e=>{city=e.target.value;renderSelection()});
$('#etSearch').addEventListener('input',renderTable);
$('#etReset').addEventListener('click',()=>{metric='turnout_pct';city='';$('#etMetric').value=metric;$('#etCity').value='';$('#etSearch').value='';drawMap();renderTable();renderSelection()});
$('#etCsv').addEventListener('click',exportCsv);
$('#etRefresh').addEventListener('click',load);
const theme=$('#themeToggle');
if(localStorage.getItem('uefy-eleicoes-theme')==='dark')document.body.classList.add('dark');
const sync=()=>{const dark=document.body.classList.contains('dark');theme.textContent=dark?'☀':'◐';theme.setAttribute('aria-pressed',String(dark))};
theme.addEventListener('click',()=>{document.body.classList.toggle('dark');localStorage.setItem('uefy-eleicoes-theme',document.body.classList.contains('dark')?'dark':'light');sync()});sync();
document.querySelectorAll('.mobile-menu a').forEach(a=>a.addEventListener('click',()=>a.closest('details')?.removeAttribute('open')));
const top=$('#toTop');window.addEventListener('scroll',()=>top.classList.toggle('show',scrollY>360),{passive:true});top.addEventListener('click',()=>window.scrollTo({top:0,behavior:'smooth'}));
window.__entreTurnos={get ready(){return ready},get rows(){return rows.length},get second(){return second},get metric(){return metric}};
load();
})();