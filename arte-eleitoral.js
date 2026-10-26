/* Composição editorial para leitura no feed: escala de referência 1200 px. */
(function(root){'use strict';
const E=root.ElectionStats,P=root.ElectionPublications;
const C={light:{paper:'#f6f5ed',ink:'#102b23',muted:'#384a42',line:'#c8d1c5',panel:'#e9eee2'},dark:{paper:'#102b23',ink:'#fffef2',muted:'#e0e8d9',line:'#486153',panel:'#1d4032'}};
function render(o){
 const {canvas,model,s,rows,paths,brief,template,size,page=0,city=null,title='',colors}=o;
 const [width,height]=size.split('x').map(Number);canvas.width=width;canvas.height=height;
 const ctx=canvas.getContext('2d',{alpha:false,willReadFrequently:true}),W=1200,H=height/width*W,M=48,B=W-M*2,wide=H<900;
 const theme=C[o.palette||'light'],{paper,ink,muted,line,panel}=theme;
 const audit={width,height,referenceWidth:W,text:[],errors:[],page,pageCount:1};
 ctx.setTransform(width/W,0,0,width/W,0,0);ctx.textBaseline='top';ctx.fillStyle=paper;ctx.fillRect(0,0,W,H);
 ctx.fillStyle='#f4dd19';ctx.fillRect(0,0,W,12);
 function lines(t,size,max,weight='700'){
  ctx.font=weight+' '+size+'px Arial';const result=[];let current='';
  for(const word of String(t).split(/\s+/)){const next=current?current+' '+word:word;if(current&&ctx.measureText(next).width>max){result.push(current);current=word}else current=next}if(current)result.push(current);return result;
 }
 function text(t,x,y,{size=44,max=B,weight='700',color=ink,role='body',lineHeight=1.13,limit=Infinity}={}){
  const a=lines(t,size,max,weight);if(a.length>limit)audit.errors.push('Texto longo demais: '+t);
  ctx.fillStyle=color;ctx.font=weight+' '+size+'px Arial';
  for(const [i,str] of a.entries()){const w=ctx.measureText(str).width;ctx.fillText(str,x,y+i*size*lineHeight);audit.text.push({text:str,size,role,x,y:y+i*size*lineHeight,width:w,height:size*lineHeight});if(w>max+.5||x+w>W-M+1)audit.errors.push('Largura: '+str)}
  return y+a.length*size*lineHeight;
 }
 const rule=y=>{ctx.fillStyle=line;ctx.fillRect(M,y,B,2)};
 const fmt=(v,u,sign=false)=>E.format(v,u,sign),m=E.metrics[s.metric],unit=s.view==='delta'&&m.unit==='pct'?'pp':m.unit;
 const series=P.artPages(rows,{size,template,s}),part=Math.min(page,series.length-1),items=series[part];audit.page=part;audit.pageCount=series.length;
 const labelRound=round=>(round===1?'1º turno · 04 OUT':'2º turno · 25 OUT');
 const round=template==='compare'?part+1:s.view==='first'?1:2;
 const mapSettings=template==='compare'?{...s,view:round===1?'first':'second',shared:true}:s;
 const viewLabel=template==='compare'?labelRound(round):s.view==='delta'?'1º → 2º turno · 04 e 25 OUT':labelRound(round);
 let heading=title||brief.title;
 if(!title&&template==='map'&&s.metric==='leadership'&&s.view==='delta'&&s.group==='all'&&!city)heading=brief.changed+' municípios mudaram de liderança';
 if(!title&&template==='compare')heading=round===1?'O RN no primeiro turno':'O RN no segundo turno';
 if(!title&&template==='routes')heading='Quem liderou antes e depois';
 if(!title&&template==='list'){
  heading=s.group==='same'?'Quem manteve a liderança':s.group==='changed'?'Onde a liderança mudou':brief.title;
 }
 ctx.fillStyle='#f4dd19';ctx.fillRect(M,34,52,52);text('U',M+9,35,{size:44,max:52,role:'brand',color:'#102b23'});text('UEFY',M+72,40,{size:40,max:300,role:'brand'});
 text('RN · 2026',W-M-234,40,{size:40,max:234,color:muted,role:'brand'});
 rule(106);
 if(wide&&!title){if(template==='routes')heading='Lideranças: 1º → 2º turno';else if(template==='list')heading=s.group==='same'?'Quem manteve a liderança':s.group==='changed'?'Onde a liderança mudou':s.group==='all'?'Lideranças nos municípios':brief.title;else if(template==='map'||template==='card'){if(s.metric==='leadership'){if(city)heading=city.name;else if(s.group==='all'||s.group==='changed')heading=brief.count+' municípios mudaram';else if(s.group==='same')heading=brief.count+' municípios mantiveram';else heading=brief.title}else heading=m.label+(m.candidate?' · '+P.short[s.candidate]:'')}}
 if(wide&&!title&&s.metric==='leadership'&&['map','list','card'].includes(template)){if(s.group.startsWith('from-'))heading='Onde '+P.short[s.group.slice(5)]+' liderava';if(s.group.startsWith('to-'))heading='Lideranças de '+P.short[s.group.slice(3)];if(P.routes.includes(s.group))heading=P.short[s.group.split('-')[0]]+' → '+P.short[s.group.split('-')[1]]}
 const kicker=m.office==='pres'?'PRESIDENTE · RIO GRANDE DO NORTE':'GOVERNADOR · RIO GRANDE DO NORTE';
 if(!wide)text(kicker,M,128,{size:40,color:muted,role:'context',max:B});
 let y=text(heading,M,wide?116:190,{size:wide?66:80,max:B,limit:wide?2:3,role:'title',lineHeight:1.03})+18;
 const context=template==='list'?(wide?'1º → 2º · ':'1º → 2º turno · ')+rows.length+' cidades · '+(part+1)+'/'+series.length:series.length>1?(wide?(s.view==='delta'?'1º → 2º turno':labelRound(round)):viewLabel)+' · Parte '+(part+1)+'/'+series.length:viewLabel;
 y=text(context,M,y,{size:40,max:B,weight:'400',color:muted,role:'context',limit:2})+28;
 const footer=H-136,bodyTop=y,bodyBottom=footer-20,bodyH=bodyBottom-bodyTop;
 function fitOne(t,x,yy,w,initial=56,min=44,role='body',color=ink){
  let font=initial;ctx.font='700 '+font+'px Arial';while(ctx.measureText(String(t)).width>w&&font>min){font-=2;ctx.font='700 '+font+'px Arial'}
  return text(t,x,yy,{size:font,max:w,role,color});
 }
 function drawMap(x,yy,w,h,settings=mapSettings){
  if(h<=0){audit.errors.push('Mapa sem espaço');return}
  const scale=Math.min(w/800,h/540),ox=x+(w-800*scale)/2,oy=yy+(h-540*scale)/2,set=new Set(rows.map(r=>r.code));
  ctx.save();ctx.translate(ox,oy);ctx.scale(scale,scale);
  for(const r of model.rows){const p=new Path2D(paths.get(r.code));ctx.fillStyle=set.has(r.code)?colors(r,settings):panel;ctx.strokeStyle=paper;ctx.lineWidth=1.3;ctx.fill(p);ctx.stroke(p)}
  if(city){const p=new Path2D(paths.get(city.code));ctx.strokeStyle=ink;ctx.lineWidth=5;ctx.stroke(p)}
  ctx.restore();
 }
 function legendItems(settings=mapSettings){
  if(s.metric==='leadership'){
   if(settings.view==='delta'){
    const labels={changed:['#d3a228','Mudou'],same:['#327762','Manteve'],tie:['#775a9e','Empate'],pending:['#bac3b5','Pendente']};
    return Object.entries(labels).map(([key,[color,name]])=>[color,name+' · '+rows.filter(r=>r.status===key).length]).filter((item,i)=>rows.some(r=>r.status===Object.keys(labels)[i]));
   }
   const field=settings.view==='first'?'from':'to';return ['13','44','22','tie'].map(n=>[E.colors[n]||'#775a9e',(P.short[n]||'Empate')+' · '+rows.filter(r=>r[field]===n).length]).filter((item,i)=>rows.some(r=>r[field]===['13','44','22','tie'][i]));
  }
  const values=rows.flatMap(r=>settings.shared?[E.value(r,s.metric,1,s.candidate),E.value(r,s.metric,2,s.candidate)]:[E.displayed(r,s.metric,settings.view,s.candidate)]).filter(Number.isFinite);
  if(!values.length)return [];
  const lo=Math.min(...values),hi=Math.max(...values),u=settings.view==='delta'&&m.unit==='pct'?'pp':m.unit;
  return [[settings.view==='delta'?'#3b7d9c':'#e1edda',fmt(lo,u,settings.view==='delta')],[settings.view==='delta'?'#b26a1c':'#235c4c',fmt(hi,u,settings.view==='delta')]];
 }
 function legend(list,yy){
  let x=M,cy=yy;for(const [color,label] of list){ctx.font='700 44px Arial';const needed=ctx.measureText(label).width+66;if(x+needed>W-M&&x>M){cy+=64;x=M}ctx.fillStyle=color;ctx.fillRect(x,cy+5,30,34);text(label,x+44,cy,{size:44,max:B-(x-M)-44,role:'legend'});x+=needed+28}return cy+52;
 }
 function values(){
  const a=city?E.value(city,s.metric,1,s.candidate):E.stateValue(model,s.metric,1,s.candidate),b=city?E.value(city,s.metric,2,s.candidate):E.stateValue(model,s.metric,2,s.candidate);
  if(s.metric==='leadership'){
   if(city){return {major:s.view==='delta'?({same:'Manteve',changed:'Mudou',tie:'Empate',pending:'Pendente'}[city.status]):P.short[s.view==='first'?city.from:city.to]||'Empate',label:'primeira posição em '+city.name}}
   return {major:String(s.view==='delta'?brief.count:rows.length),label:s.view==='delta'?brief.label:'municípios neste recorte'};
  }
  const v=s.view==='first'?a:s.view==='second'?b:a===null||b===null?null:b-a;
  let major=v===null?'—':fmt(v,'count',s.view==='delta'),label=m.label;
  if(unit==='pct'||unit==='pp'){major=v===null?'—':fmt(v,unit,s.view==='delta').replace(/%| p\.p\./g,'');label=(unit==='pct'?'% · ':'pontos percentuais · ')+label}
  else if(Math.abs(v)>=1000000){major=Number(v/1000000).toLocaleString('pt-BR',{maximumFractionDigits:2});label='milhões · '+label}
  return {major,label};
 }
 if(bodyH<120)audit.errors.push('Título e contexto ocupam espaço demais');
 if(template==='list'){
  const per=items.length||1,rowH=bodyH/Math.max(P.pageCapacity(size,'list'),per);
  items.forEach((r,i)=>{
   const yy=bodyTop+i*rowH;
   text(String(part*P.pageCapacity(size,'list')+i+1).padStart(2,'0'),M,yy+8,{size:40,max:80,color:muted,role:'index'});
   let bottom=fitOne(r.name,M+88,yy,B-88,wide?52:60,48,'city');
   const route=(P.short[r.from]||'Empate')+' no 1º → '+(P.short[r.to]||'Sem dado')+' no 2º';
   bottom=text(route,M+88,bottom+8,{size:44,max:B-88,weight:'400',color:muted,role:'route'})+2;
   if(bottom>yy+rowH+1)audit.errors.push('Linha municipal sem espaço: '+r.name);
   if(i<items.length-1){ctx.fillStyle=line;ctx.fillRect(M,yy+rowH-8,B,1)}
  });
  if(!items.length)text('Nenhum município nesta transição.',M,bodyTop+30,{size:56,role:'body'});
 }else if(template==='routes'){
  const headH=58,rowH=(bodyH-headH)/items.length;
  text('1º turno',M+16,bodyTop,{size:40,max:350,color:muted,role:'context'});text('2º turno',M+492,bodyTop,{size:40,max:350,color:muted,role:'context'});text('Cidades',W-M-158,bodyTop,{size:40,max:158,color:muted,role:'context'});
  items.forEach((k,i)=>{
   const [a,b]=k.split('-'),yy=bodyTop+headH+i*rowH;
   ctx.fillStyle=i%2?panel:paper;ctx.fillRect(M,yy,B,rowH-7);ctx.fillStyle=E.colors[a];ctx.fillRect(M,yy+10,7,rowH-27);
   fitOne(E.names[a],M+16,yy+Math.max(10,(rowH-53)/2),370,wide?46:48,44,'candidate');
   text('→',M+414,yy+Math.max(10,(rowH-53)/2),{size:48,max:60,role:'route'});
   fitOne(E.names[b],M+492,yy+Math.max(10,(rowH-53)/2),370,wide?46:48,44,'candidate');
   text(brief.counts[k],W-M-145,yy+Math.max(5,(rowH-76)/2),{size:72,max:145,role:'number'});
  });
 }else if(template==='ranking'){
  const max=Math.max(...items.map(r=>Math.abs(E.displayed(r,s.metric,s.view,s.candidate))),.01),rowH=bodyH/P.pageCapacity(size,'ranking');
  items.forEach((r,i)=>{
   const yy=bodyTop+i*rowH,v=E.displayed(r,s.metric,s.view,s.candidate);
   text(String(part*P.pageCapacity(size,'ranking')+i+1).padStart(2,'0'),M,yy,{size:40,max:80,color:muted,role:'index'});
   const bottom=fitOne(r.name,M+88,yy,B-355,wide?52:58,48,'city');
   fitOne(fmt(v,unit,s.view==='delta'),W-M-250,yy,250,58,48,'value');
   const by=bottom+18;ctx.fillStyle=panel;ctx.fillRect(M+88,by,B-88,20);ctx.fillStyle=v<0?'#357da4':'#b26a1c';ctx.fillRect(M+88,by,(B-88)*Math.abs(v)/max,20);
   if(by+28>yy+rowH)audit.errors.push('Ranking sem espaço: '+r.name);
  });
 }else if(template==='card'){
  const v=values(),numberWidth=wide?440:B;
  const bottom=fitOne(v.major,M,bodyTop,numberWidth,wide?104:190,84,'hero');
  const cardLabel=wide?(s.metric==='leadership'?(city?'liderança municipal':'municípios no recorte'):v.label.startsWith('milhões')?'milhões':unit==='pct'?'por cento':unit==='pp'?'pontos percentuais':'votos / eleitores'):v.label;
  const labelBottom=text(cardLabel,M,bottom+8,{size:wide?44:48,max:wide?440:B,role:'body',limit:3});
  if(wide)drawMap(M+482,bodyTop,B-482,bodyH-70);
  else drawMap(M,labelBottom+12,B,bodyBottom-labelBottom-92);
  legend(legendItems(),bodyBottom-58);
 }else{
  const list=legendItems(),legendRows=(()=>{let used=0,total=1;for(const [,label]of list){ctx.font='700 44px Arial';const w=ctx.measureText(label).width+94;if(used+w>B){total++;used=0}used+=w}return total})();
  const ly=bodyBottom-legendRows*64;drawMap(M,bodyTop,B,Math.max(1,ly-bodyTop-12));legend(list,ly);
 }
 const content=audit.text.filter(t=>!['brand'].includes(t.role));for(const t of content){if(t.y+t.height>footer+1)audit.errors.push('Conteúdo no rodapé: '+t.text)}
 rule(footer);
 const geo=['map','compare','card'].includes(template);
 const primary=s.metric==='leadership'?model.first:model.analysis,secondary=s.metric==='leadership'?model.second:model.participation;
 const date=d=>String(d?.source_generated_at||d?.generated_at||'').match(/\b(\d{2}\/\d{2})\/\d{4}/)?.[1]||'—';
 const base2=model.ready?date(secondary):'pendente';
 text('Fonte: TSE'+(geo?' / IBGE':'')+' · Bases '+date(primary)+' e '+base2,M,footer+17,{size:40,max:B,color:muted,role:'source',weight:'400'});
 const note=geo&&s.metric==='leadership'?'Liderança em cada município':s.metric==='leadership'?'Mais votado em cada município':m.base==='electorate'?'Taxa sobre o eleitorado do cargo':m.base==='total_votes'?'Taxa sobre os votos do cargo':m.candidate?'Votação da mesma candidatura':'Valores oficiais do cargo';
 text(note,M,footer+70,{size:40,max:B,color:muted,role:'source',weight:'400'});
 const pixel=ctx.getImageData(5,5,1,1).data;if(pixel[0]!==244||pixel[1]!==221||pixel[2]!==25)audit.errors.push('Falha ao desenhar o PNG');
 for(const item of audit.text)if(item.y<0||item.y+item.height>H-12)audit.errors.push('Altura: '+item.text);
 audit.minFont=Math.min(...audit.text.map(t=>t.size));audit.valid=!audit.errors.length;
 canvas.dataset.artAudit=JSON.stringify(audit);
 return audit;
}
root.ElectionArt={render};
})(window);
