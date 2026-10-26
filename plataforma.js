/* Central UEFY: estatísticas e produção de imagens PNG locais. */
(()=>{'use strict';
const E=window.ElectionStats,$=q=>document.querySelector(q),NS='http://www.w3.org/2000/svg';
const statusNames={changed:'Mudou',same:'Manteve',tie:'Empate',pending:'Aguardando'},categoryNames={...E.names,tie:'Empate',pending:'Aguardando',same:'Manteve',changed:'Mudou'};
let model=null,selected='',loading=false,visible=[],paths=new Map(),imageReady=false;
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
  const pick=()=>{selected=r.code;updateDetail();mapRender();renderTable();renderImage()};
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
 $('#imageScope option[value="city"]').disabled=!r;if(!r)$('#imageScope').value='state';
}
function renderTable(){
 const s=settings(),tbody=$('#municipalRows');tbody.replaceChildren();
 $('#rowCount').textContent=visible.length+' de 167 municípios';
 $('#sort').disabled=s.metric==='leadership';
 for(const r of visible){
  const tr=el('tr',undefined,r.code===selected?'selected':'');tr.dataset.code=r.code;
  const td=el('td'),btn=el('button',r.name,'city-button');btn.type='button';btn.addEventListener('click',()=>{selected=r.code;updateDetail();mapRender();renderTable();renderImage()});td.append(btn);tr.append(td);
  tr.append(el('td',categoryNames[r.from]),el('td',categoryNames[r.to]||'—'));const status=el('td');status.append(el('span',statusNames[r.status],'badge '+r.status));tr.append(status);
  if(s.metric==='leadership')tr.append(el('td',f(r.first.pct,'pct')),el('td',f(r.second?.pct,'pct')),el('td','—'));
  else{const a=E.value(r,s.metric,1,s.candidate),b=E.value(r,s.metric,2,s.candidate);tr.append(el('td',f(a,metric().unit)),el('td',f(b,metric().unit)),el('td',f(a===null||b===null?null:b-a,metric().unit==='pct'?'pp':metric().unit,true)))}
  tbody.append(tr);
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
 const s=settings(),m=metric();$('#candidateLabel').hidden=!m.candidate;
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
function summaryText(){
 const s=settings(),r=$('#imageScope').value==='city'?model.rows.find(r=>r.code===selected):null;
 const group=$('#group').selectedOptions[0].textContent,period=viewName(s);
 if(s.metric==='leadership'){
  if(r)return r.name+': '+E.names[r.from]+' foi o mais votado no 1º turno. '+(r.second?(r.to==='tie'?'Empate no 2º turno.':E.names[r.to]+' foi o mais votado no 2º turno.'): 'Segundo turno indisponível.')+' '+statusNames[r.status]+'. Mudança municipal não demonstra transferência individual de votos.';
  const count=visible.filter(r=>r.status==='changed').length;
  return model.ready?count+' dos '+visible.length+' municípios deste recorte mudaram de liderança entre os turnos para Governador do RN. Recorte: '+group+'. '+(s.search?'Busca: '+s.search+'. ':'')+'Mudança municipal não demonstra transferência individual de votos.':'Primeiro turno para Governador do RN: '+visible.length+' municípios neste recorte. Comparação com segundo turno indisponível.';
 }
 const a=r?E.value(r,s.metric,1,s.candidate):E.stateValue(model,s.metric,1,s.candidate),b=r?E.value(r,s.metric,2,s.candidate):E.stateValue(model,s.metric,2,s.candidate);
 const location=r?r.name:'Rio Grande do Norte (total estadual)';
 return location+' · '+topic(s)+': '+f(a,mUnit())+' no 1º turno; '+f(b,mUnit())+' no 2º. Variação: '+f(a===null||b===null?null:b-a,mUnit()==='pct'?'pp':mUnit(),true)+'. '+period+'. '+(metric().note||'Fonte: indicadores oficiais do TSE.');
}
const mUnit=()=>metric().unit;
function exportCsv(){
 const s=settings(),heads=['municipio','codigo_tse','lider_1t','lider_2t','situacao','indicador','candidatura','valor_1t','valor_2t','variacao','unidade_variacao','fonte'];
 const lines=visible.map(r=>{const a=E.value(r,s.metric,1,s.candidate),b=E.value(r,s.metric,2,s.candidate);return[r.name,r.code,categoryNames[r.from],categoryNames[r.to]||'',statusNames[r.status],metric().label,metric().candidate?E.names[s.candidate]:'',a,b,s.metric==='leadership'||a===null||b===null?'':b-a,metric().unit==='count'?'número':metric().unit==='category'?'não aplicável':'pontos percentuais','TSE 2026 | 6259 / 6260 | 6257 / 6258']});
 const safe=v=>{const x=String(v??'');return '"'+(/^[=+\-@]/.test(x)&&isNaN(Number(x))?"'":'')+x.replaceAll('"','""')+'"'};
 downloadBlob(new Blob(['\uFEFF'+[heads,...lines].map(a=>a.map(safe).join(';')).join('\r\n')],{type:'text/csv;charset=utf-8'}),'uefy-rn-estatisticas.csv');
}
function downloadBlob(blob,name){const url=URL.createObjectURL(blob),a=el('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),3000)}
/* Renderizador de imagens: vetores da malha, sem imagens remotas ou captura de tela. */
function renderImage(){
 imageReady=false;$('#download').disabled=true;$('#copyText').disabled=true;if(!model)return;
 const s=settings(),template=$('#template').value,[w,h]=$('#size').value.split('x').map(Number),canvas=$('#preview');canvas.width=w;canvas.height=h;
 const scopeLocked=template==='ranking'||template==='compare';$('#imageScope').disabled=scopeLocked;if(scopeLocked)$('#imageScope').value='state';
 const ctx=canvas.getContext('2d'),scale=w/1600;ctx.scale(scale,scale);const W=1600,H=h/scale,dark=$('#palette').value==='dark',ink=dark?'#f5f4ec':'#1d2621',muted=dark?'#bbc1b4':'#626c63',paper=dark?'#17241f':'#f8f7ee',line=dark?'#425047':'#d1d7c8';
 const M=64;ctx.fillStyle=paper;ctx.fillRect(0,0,W,H);ctx.fillStyle='#f4dd19';ctx.fillRect(0,0,W,13);
 const text=(t,x,y,size=24,color=ink,weight='400')=>{ctx.fillStyle=color;ctx.font=weight+' '+size+'px Arial';ctx.fillText(String(t),x,y)};
 const wrap=(t,x,y,max,size=26,color=ink,weight='400',limit=Infinity)=>{
  ctx.font=weight+' '+size+'px Arial';const words=String(t).split(/\s+/),lines=[];let row='';for(const word of words){if(ctx.measureText(row+(row?' ':'')+word).width>max&&row){lines.push(row);row=word}else row+=(row?' ':'')+word}if(row)lines.push(row);
  lines.slice(0,limit).forEach((line,i)=>text(line,x,y+i*size*1.3,size,color,weight));return Math.min(lines.length,limit)*size*1.3;
 };
 const rule=y=>{ctx.fillStyle=line;ctx.fillRect(M,y,W-M*2,1)};
 text('CENTRAL UEFY / ELEIÇÕES',M,67,21,ink,'700');text('RIO GRANDE DO NORTE · 2026',W-500,67,19,muted,'700');rule(90);
 const title=$('#imageTitle').value.trim()||(template==='compare'?'O RN entre o primeiro e o segundo turno':s.metric==='leadership'&&s.view==='delta'?'Onde o voto mudou de liderança':topic(s));
 let titleSize=58;while(titleSize>34){ctx.font='700 '+titleSize+'px Arial';if(ctx.measureText(title).width<(W-M*2)*1.75)break;titleSize-=2}
 const titleH=wrap(title,M,157,W-M*2,titleSize,ink,'700',2);
 const subtitleY=157+titleH+10,sub=topic(s)+' / '+(template==='compare'?'04 e 25 de outubro de 2026':viewName(s));
 wrap(sub,M,subtitleY,W-M*2,23,muted,'400',2);
 const chartTop=subtitleY+66,footerTop=H-180,chartBottom=footerTop-25,chartH=chartBottom-chartTop;
 const allowed=visible.length>0&&(s.view==='first'||model.ready)&&(template!=='compare'||model.ready)&&!((template==='ranking')&&s.metric==='leadership')&&!(template==='compare'&&metric().candidate&&s.candidate==='22');
 const rowsSet=new Set(visible.map(r=>r.code));
 const drawMap=(x,y,width,height,mapSettings)=>{
  const factor=Math.min(width/800,height/540),ox=x+(width-800*factor)/2,oy=y+(height-540*factor)/2;
  ctx.save();ctx.translate(ox,oy);ctx.scale(factor,factor);
  for(const r of model.rows){ctx.fillStyle=rowsSet.has(r.code)?getColor(r,mapSettings):(dark?'#2b3b31':'#e4e7dd');ctx.strokeStyle=dark?'#17241f':'#f8f7ee';ctx.lineWidth=.9;const p=new Path2D(paths.get(r.code));ctx.fill(p);ctx.stroke(p)}
  if(selected&&$('#imageScope').value==='city'){const p=new Path2D(paths.get(selected));ctx.strokeStyle=dark?'#fff':'#111';ctx.lineWidth=3;ctx.stroke(p)}
  ctx.restore();
 };
 const legend=(x,y,items,width)=>{
  let offset=x,cy=y;for(const [color,label] of items){ctx.font='18px Arial';const tw=ctx.measureText(label).width+45;if(offset+tw>x+width){offset=x;cy+=34}ctx.fillStyle=color;ctx.fillRect(offset,cy-15,17,17);text(label,offset+25,cy,18,muted);offset+=tw}return cy;
 };
 const recorte=$('#group').selectedOptions[0].textContent+(s.search?' · busca: '+s.search:'');
 if(!allowed){wrap(template==='ranking'&&s.metric==='leadership'?'Selecione um indicador numérico para gerar o ranking.':visible.length===0?'Nenhum município neste filtro. Ajuste o recorte para gerar a imagem.':'Comparação indisponível para este recorte. Use o primeiro turno ou aguarde bases completas.',M,chartTop+70,W-M*2,36,ink,'700',5)}
 else if(template==='compare'){
  const tall=H>1300;
  const mapAreaH=chartH-(tall?100:65);
  if(tall){
   const mh=(mapAreaH-85)/2;text('01 / PRIMEIRO TURNO',M,chartTop,24,ink,'700');drawMap(M,chartTop+15,W-M*2,mh,{...s,view:'first',shared:true});
   text('02 / SEGUNDO TURNO',M,chartTop+mh+70,24,ink,'700');drawMap(M,chartTop+mh+85,W-M*2,mh,{...s,view:'second',shared:true});
  }else{
   const half=(W-M*2-45)/2;text('01 / PRIMEIRO TURNO',M,chartTop,23,ink,'700');text('02 / SEGUNDO TURNO',M+half+45,chartTop,23,ink,'700');
   drawMap(M,chartTop+15,half,mapAreaH,{...s,view:'first',shared:true});drawMap(M+half+45,chartTop+15,half,mapAreaH,{...s,view:'second',shared:true});
  }
  legend(M,chartBottom-20,palette({...s,view:'first',shared:true}),W-M*2);
  if(s.metric!=='leadership')text('Mesma escala de cores nos dois turnos.',M,chartBottom+10,18,muted);
 }else if(template==='ranking'){
  const sorted=visible.filter(r=>Number.isFinite(display(r))).sort((a,b)=>s.sort==='asc'?display(a)-display(b):display(b)-display(a)).slice(0,8),max=Math.max(...sorted.map(r=>Math.abs(display(r))),.01);
  const rowH=Math.min(95,chartH/8),barX=M+420,barW=W-M*2-650;
  for(const [i,r] of sorted.entries()){const y=chartTop+i*rowH,v=display(r);text(String(i+1).padStart(2,'0'),M,y+28,22,muted);wrap(r.name,M+60,y+28,345,23,ink,'700',2);ctx.fillStyle=dark?'#354237':'#e6eadc';ctx.fillRect(barX,y+7,barW,27);ctx.fillStyle=v<0?'#3b7d9c':'#b26a1c';ctx.fillRect(barX,y+7,barW*Math.abs(v)/max,27);text(f(v,unit(),s.view==='delta'),barX+barW+25,y+29,25,ink,'700')}
 }else if(template==='card'){
  const r=$('#imageScope').value==='city'?model.rows.find(r=>r.code===selected):null;let big;
  if(s.metric==='leadership')big=r?(s.view==='first'?categoryNames[r.from]:s.view==='second'?categoryNames[r.to]:statusNames[r.status]):s.view==='delta'?visible.filter(r=>r.status==='changed').length+' municípios':visible.length+' municípios';
  else{const a=r?E.value(r,s.metric,1,s.candidate):E.stateValue(model,s.metric,1,s.candidate),b=r?E.value(r,s.metric,2,s.candidate):E.stateValue(model,s.metric,2,s.candidate);big=f(s.view==='first'?a:s.view==='second'?b:a===null||b===null?null:b-a,unit(),s.view==='delta')}
  const tall=H>1300,bigWidth=tall?W-M*2:650;wrap(r?r.name:'RIO GRANDE DO NORTE',M,chartTop+15,bigWidth,24,muted,'700',2);
  wrap(big,M,chartTop+135,bigWidth,76,ink,'700',2);
  const detailY=chartTop+235;
  wrap(s.metric==='leadership'?(s.view==='delta'?'Mudanças de liderança municipal entre o 1º e o 2º turno.':'Primeira posição municipal · '+viewName(s)):topic(s)+' · '+viewName(s),M,detailY,bigWidth,26,muted,'400',3);
  if(tall)drawMap(M,detailY+110,W-M*2,chartBottom-detailY-160,s);else drawMap(770,chartTop,760,chartH-50,s);
  legend(M,chartBottom,palette(s),W-M*2);
  }else{
  if(H<1100){
   drawMap(M,chartTop-35,960,chartH+5,s);
   const r=$('#imageScope').value==='city'?model.rows.find(r=>r.code===selected):null,x=1080;
   wrap(r?r.name:'RIO GRANDE DO NORTE',x,chartTop+25,440,22,muted,'700',2);
   let big,note;
   if(s.metric==='leadership'){big=r?(s.view==='delta'?statusNames[r.status]:categoryNames[s.view==='first'?r.from:r.to]):s.view==='delta'?visible.filter(r=>r.status==='changed').length:visible.length;note=r?'Primeira posição neste município':s.view==='delta'?'municípios mudaram de liderança':'municípios neste recorte'}
   else{const a=r?E.value(r,s.metric,1,s.candidate):E.stateValue(model,s.metric,1,s.candidate),b=r?E.value(r,s.metric,2,s.candidate):E.stateValue(model,s.metric,2,s.candidate);big=f(s.view==='first'?a:s.view==='second'?b:a===null||b===null?null:b-a,unit(),s.view==='delta');note=topic(s)}
   let bigSize=64;ctx.font='700 '+bigSize+'px Arial';while(ctx.measureText(String(big)).width>440&&bigSize>40){bigSize-=2;ctx.font='700 '+bigSize+'px Arial'}wrap(big,x,chartTop+130,440,bigSize,ink,'700',2);wrap(note,x,chartTop+210,430,24,muted,'400',3);
  }else drawMap(M,chartTop-10,W-M*2,chartH-50,s);
  legend(M,chartBottom-10,palette(s),W-M*2);
 }
 rule(footerTop);text('FONTE: TSE · '+visible.length+'/167 MUNICÍPIOS NO RECORTE · MALHA: IBGE',M,footerTop+35,18,muted,'700');
 const dateText=dates()+' | Indicadores 1º: '+(model.analysis.source_generated_at||'')+' / 2º: '+(model.ready?model.participation.source_generated_at:'indisponível');
 wrap(dateText,M,footerTop+67,W-M*2,17,muted,'400',2);
 wrap('Recorte: '+recorte+'. '+(s.metric==='leadership'?'Mudança de liderança não demonstra transferência individual de votos.':metric().note||'Taxas calculadas sobre o eleitorado ou total de votos do cargo; diferenças de taxas em pontos percentuais.'),M,footerTop+118,W-M*2,18,muted,'400',2);
 $('#dimensions').textContent=w+' × '+h+' · PNG';$('#studioContext').textContent=topic(s)+' · '+viewName(s)+' · '+visible.length+' municípios. '+(template==='ranking'?'Ranking usa o indicador, recorte temporal e ordenação selecionados.':'A imagem acompanha os filtros da análise.');
 const summary=summaryText();$('#supportText').textContent=summary+' Fonte: TSE. '+dates();$('#copyText').disabled=!allowed;$('#download').disabled=!allowed;imageReady=allowed;
}
async function load(){
 if(loading)return;loading=true;$('#refresh').disabled=true;$('#dataStatus').textContent='Conferindo as bases e os 167 municípios…';
 const json=async p=>{const r=await fetch(p+'?v='+Date.now(),{cache:'no-store'});if(!r.ok)throw Error('Fonte indisponível: '+p);return r.json()};
 try{
  const [first,analysis,geo]=await Promise.all([json('data/rn-governador-mapa.json'),json('data/rn-analises.json'),json('assets/maps/rn-municipios.geojson')]);
  const [second,part]=await Promise.all([json('data/rn-governador-mapa-2t.json').catch(()=>({})),json('data/entre-turnos-2t.json').catch(()=>({}))]);
  const next=E.build(first,second,analysis,part,geo);if(model?.ready&&!next.ready)throw Error('Atualização do segundo turno ainda não conciliada');
  model=next;preparePaths();
  const wanted=new URLSearchParams(location.search).get('municipio');if(wanted&&!selected)selected=model.rows.find(r=>E.key(r.name)===E.key(wanted))?.code||'';
  $('#compared').textContent=model.ready?'167':'—';$('#changed').textContent=model.ready?model.rows.filter(r=>r.status==='changed').length:'—';$('#same').textContent=model.ready?model.rows.filter(r=>r.status==='same').length:'—';
  const t1=E.stateValue(model,'turnout_pct',1),t2=E.stateValue(model,'turnout_pct',2);$('#turnout').textContent=f(t2,'pct');$('#turnoutDelta').textContent=t2===null?'segundo turno indisponível':f(t2-t1,'pp',true)+' em relação ao 1º turno';
  $('#dataStatus').textContent=model.ready?'Bases TSE conferidas · 167/167 municípios · dois turnos completos':'1º turno disponível · '+model.secondError;
  $('#sourceDates').textContent=dates();render();
 }catch(e){$('#dataStatus').textContent=model?'Falha na atualização. Mantendo a última base conferida.':'Dados indisponíveis: '+e.message;if(!model){$('#download').disabled=true;$('#csv').disabled=true;$('#copyText').disabled=true}}
 finally{loading=false;$('#refresh').disabled=false}
}
for(const id of ['metric','candidate','view','group','sort'])$('#'+id).addEventListener('change',render);
$('#search').addEventListener('input',render);$('#refresh').addEventListener('click',load);$('#csv').addEventListener('click',exportCsv);
$('#clearCity').addEventListener('click',()=>{selected='';render()});
$('#createImage').addEventListener('click',()=>{$('#imageScope').value=selected?'city':'state';renderImage();$('#estudio').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'auto':'smooth'})});
$('#studioForm').addEventListener('submit',e=>e.preventDefault());
for(const id of ['template','size','imageScope','palette'])$('#'+id).addEventListener('change',renderImage);
$('#imageTitle').addEventListener('input',renderImage);
$('#download').addEventListener('click',()=>{
 if(!imageReady)return;$('#download').disabled=true;$('#exportStatus').textContent='Preparando imagem…';
 $('#preview').toBlob(blob=>{if(blob){downloadBlob(blob,'uefy-rn-'+$('#metric').value+'-'+$('#candidate').value+'-'+$('#view').value+'-'+$('#template').value+'-'+$('#size').value+'.png');$('#exportStatus').textContent='Imagem PNG pronta para publicar no X.'}else $('#exportStatus').textContent='Falha ao gerar imagem. Tente novamente.';$('#download').disabled=!imageReady},'image/png');
});
$('#copyText').addEventListener('click',async()=>{try{await navigator.clipboard.writeText($('#supportText').textContent);$('#exportStatus').textContent='Texto de apoio copiado.'}catch(e){$('#exportStatus').textContent='Selecione e copie o texto de apoio abaixo da prévia.'}});
window.__stats={get model(){return model},get visible(){return visible},get imageReady(){return imageReady},renderImage};
load();
})();
