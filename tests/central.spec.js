const BUILD=require('../version.json').build;
const {test,expect}=require('@playwright/test');
async function guard(page){await page.addInitScript(()=>{window.__canvasOverflows=[];const o=CanvasRenderingContext2D.prototype.fillText;CanvasRenderingContext2D.prototype.fillText=function(text,x,y,maxWidth){try{const w=this.measureText(String(text)).width,a=this.textAlign||'start';let l=x,r=x+w;if(a==='right'||a==='end'){l=x-w;r=x}else if(a==='center'){l=x-w/2;r=x+w/2}if(l<-1||r>this.canvas.width+1)window.__canvasOverflows.push({text:String(text),l,r})}catch{}return o.apply(this,arguments)}})}
async function noOverlap(page,a,b){const A=await page.locator(a).boundingBox(),B=await page.locator(b).boundingBox();if(!A||!B)return;expect(!(A.x+A.width<=B.x||B.x+B.width<=A.x||A.y+A.height<=B.y||B.y+B.height<=A.y)).toBeFalsy()}

test('produção não expõe Laboratório UEFY',async({page})=>{for(const path of ['/index.html','/rn.html','/radar.html']){await page.goto(path+'?v='+BUILD);await expect(page.locator('body')).not.toContainText('Laboratório UEFY');await expect(page.locator('option[value="lab"]')).toHaveCount(0)}});

test('card geral editorial é legível e carrega estágio da totalização',async({page})=>{await guard(page);await page.goto('/index.html?v='+BUILD);const out=await page.evaluate(()=>{mode='official';selectedOffice='gov';selectedScope='uf_rn';state.gov={progress:63.42,generatedAt:'04/10/2026 · 18:07',finalTotalization:false,integrity:{matched:3,total:3,unmatched:0},candidates:[{id:'1',number:'13',name:'CANDIDATURA TESTE UM',party:'AAA',votes:650000,pct:48.7,seq:1},{id:'2',number:'22',name:'CANDIDATURA TESTE DOIS',party:'BBB',votes:590000,pct:44.2,seq:2},{id:'3',number:'44',name:'CANDIDATURA TESTE TRÊS',party:'CCC',votes:95000,pct:7.1,seq:3}]};window.__canvasOverflows=[];regenerate();return {text:document.querySelector('#postText').value,disabled:document.querySelector('#openX').disabled}});expect(out.text).toContain('APURAÇÃO PARCIAL');expect(out.text).toContain('63,42%');expect(out.disabled).toBeFalsy();expect(await page.evaluate(()=>window.__canvasOverflows)).toEqual([])});

test('falha de conciliação bloqueia publicação',async({page})=>{await page.goto('/index.html?v='+BUILD);const disabled=await page.evaluate(()=>{mode='official';selectedOffice='gov';selectedScope='uf_rn';state.gov={progress:10,generatedAt:'teste',integrity:{matched:1,total:2,unmatched:1},candidates:[{id:'1',name:'A',party:'X',votes:1,pct:60},{id:'2',name:'B',party:'Y',votes:1,pct:40}]};regenerate();return document.querySelector('#openX').disabled&&document.querySelector('#shareBundle').disabled&&document.querySelector('#copyText').disabled});expect(disabled).toBeTruthy()});

test('EA20 só declara situação eleitoral com estado oficial do TSE',async({page})=>{await page.goto('/index.html?v='+BUILD);const result=await page.evaluate(()=>{const fixture=(root,cands)=>({dg:'04/10/2026',hg:'20:00:00',tf:root.tf,and:root.and||'p',md:root.md||'n',s:{ts:100,st:100,pst:'100,00'},carg:[{agr:[{par:[{sg:'TESTE',cand:cands}]}]}]});mode='official';selectedOffice='gov';selectedScope='uf_rn';const partial=parseEA20(fixture({tf:'n',md:'n'},[{n:10,nmu:'A',vap:600,pvap:'60,00',seq:1,e:'n',st:''},{n:20,nmu:'B',vap:400,pvap:'40,00',seq:2,e:'n',st:''}]));const elected=parseEA20(fixture({tf:'n',md:'e'},[{n:10,nmu:'A',vap:600,pvap:'60,00',seq:1,e:'s',st:''},{n:20,nmu:'B',vap:400,pvap:'40,00',seq:2,e:'n',st:''}]));const runoff=parseEA20(fixture({tf:'n',md:'s'},[{n:10,nmu:'A',vap:480,pvap:'48,00',seq:1,e:'s',st:''},{n:20,nmu:'B',vap:420,pvap:'42,00',seq:2,e:'s',st:''}]));return {partial:officialOutcome(partial,'gov','uf_rn').kind,elected:officialOutcome(elected,'gov','uf_rn').kind,runoff:officialOutcome(runoff,'gov','uf_rn').kind}});expect(result).toEqual({partial:'none',elected:'elected',runoff:'second_round'})});


test('RN bloqueia publicação quando a conciliação falha',async({page})=>{await page.goto('/rn.html?v='+BUILD);await page.waitForFunction(()=>typeof selectedFeature!=='undefined'&&selectedFeature!==null);const disabled=await page.evaluate(()=>{current={progress:10,generatedAt:'teste',municipality:selectedFeature.properties.nome,integrity:{matched:1,total:2,unmatched:1},candidates:[{id:'1',name:'A',number:'13',party:'X',votes:10,pct:60},{id:'2',name:'B',number:'22',party:'Y',votes:5,pct:40}]};renderCurrent();return document.querySelector('#rnOpenX').disabled&&document.querySelector('#rnShareBundle').disabled&&document.querySelector('#rnCopyImage').disabled});expect(disabled).toBeTruthy()});

test('RN limpa resultado ao trocar de município',async({page})=>{await page.goto('/rn.html?v='+BUILD);await page.waitForFunction(()=>typeof selectedFeature!=='undefined'&&selectedFeature!==null);const clean=await page.evaluate(()=>{const old=selectedFeature;const next=fc.features.find(x=>x!==old);current={progress:55,generatedAt:'teste',municipality:old.properties.nome,integrity:{matched:1,total:1,unmatched:0},candidates:[{id:'1',name:'A',number:'13',votes:10,pct:55}]};selectMunicipality(next);return current.municipality===next.properties.nome&&current.candidates.length===0});expect(clean).toBeTruthy()});


test('aliases municipais do RN casam GeoJSON com TSE',async({page})=>{
  await page.goto('/rn.html?v='+BUILD);
  const rnAliases=await page.evaluate(()=>({
    acu:municipalityKey('Açu')===municipalityKey('ASSÚ'),
    ares:municipalityKey('Arês')===municipalityKey('AREZ'),
    boaSaude:municipalityKey('Januário Cicco')===municipalityKey('BOA SAÚDE')
  }));
  expect(rnAliases).toEqual({acu:true,ares:true,boaSaude:true});
  await page.goto('/radar.html?v='+BUILD);
  const radarAliases=await page.evaluate(()=>({
    acu:municipalityKey('Açu')===municipalityKey('ASSÚ'),
    ares:municipalityKey('Arês')===municipalityKey('AREZ'),
    boaSaude:municipalityKey('Januário Cicco')===municipalityKey('BOA SAÚDE')
  }));
  expect(radarAliases).toEqual({acu:true,ares:true,boaSaude:true});
});

test('RN mantém cores fixas de governador',async({page})=>{await page.goto('/rn.html?v='+BUILD);const colors=await page.evaluate(()=>['13','16','22','27','29','36','44','50','80'].map(n=>candidateColor('',n)));expect(colors[0]).toBe('#d62828');expect(colors[2]).toBe('#2e7d32');expect(colors[6]).toBe('#1976d2');expect(new Set(colors).size).toBe(colors.length)});

test('fontes restantes são Oficial e Simulado onde aplicável',async({page})=>{await page.goto('/index.html?v='+BUILD);await expect(page.locator('#modeSelect option')).toHaveCount(2);await expect(page.locator('#modeSelect')).toHaveValue('official');await page.goto('/rn.html?v='+BUILD);await expect(page.locator('#rnMode option')).toHaveCount(2);await expect(page.locator('#rnMode')).toHaveValue('official');await page.goto('/radar.html?v='+BUILD);await expect(page.locator('#radarMode')).toHaveCount(0)});

for(const viewport of [{width:1440,height:900},{width:390,height:844}]){test('controles flutuantes não se sobrepõem em '+viewport.width+'px',async({page})=>{await page.setViewportSize(viewport);for(const path of ['/index.html','/rn.html','/radar.html']){await page.goto(path+'?v='+BUILD);await page.evaluate(()=>scrollTo(0,1000));await page.waitForTimeout(120);await noOverlap(page,'.float-refresh','.to-top');if(viewport.width<=600)await noOverlap(page,'.float-refresh','.mobile-dock')}})}


test('Radar bloqueia ações finais sem snapshot publicável',async({page})=>{await page.goto('/radar.html?v='+BUILD);const disabled=await page.evaluate(()=>{radar={status:'waiting',offices:{},municipal_maps:{}};publicationView='map';renderAll();return document.querySelector('#openRadarX').disabled&&document.querySelector('#copyRadarImage').disabled&&document.querySelector('#shareRadarBundle').disabled});expect(disabled).toBeTruthy()});

test('contadores de publicação não impõem limite de 280',async({page})=>{await page.goto('/index.html?v='+BUILD);await expect(page.locator('#charCount')).not.toContainText('/280');await page.goto('/rn.html?v='+BUILD);await expect(page.locator('#rnChars')).not.toContainText('/280');await page.goto('/radar.html?v='+BUILD);await expect(page.locator('#radarChars')).not.toContainText('/280')});


test('Análises RN carrega 167 municípios, mapas e publicação no desktop',async({page})=>{
  await page.setViewportSize({width:1440,height:900});
  await page.goto('/analises.html?v='+BUILD);
  await page.waitForFunction(()=>window.__analysisReady===true||window.__analysisError!==null);
  const err=await page.evaluate(()=>window.__analysisError);
  expect(err).toBeNull();
  await expect(page.locator('#crossMap path')).toHaveCount(167);
  await expect(page.locator('#participationMap path')).toHaveCount(167);
  await expect(page.locator('#crossPostText')).not.toHaveValue('');
  await expect(page.locator('#participationPostText')).not.toHaveValue('');
  await expect(page.locator('#crossCanvas')).toBeVisible();
  await expect(page.locator('#participationCanvas')).toBeVisible();
  expect(await page.locator('#pairFilter option').count()).toBeGreaterThan(1);
  await page.locator('#metricSelect').selectOption('president.null_pct');
  await expect(page.locator('#participationPubTitle')).toContainText('Nulos');
  await expect(page.locator('#participationPostText')).toHaveValue(/NULOS/);
  await expect(page.locator('#participationPostText')).toHaveValue(/2022/);
  await expect(page.locator('#historyCompare .history-row')).toHaveCount(6);
});


test('Linguagem do cruzamento é explícita e publicação não usa sinal de confronto',async({page})=>{
  await page.setViewportSize({width:1440,height:900});
  await page.goto('/analises.html?v='+BUILD);
  await page.waitForFunction(()=>window.__analysisReady===true);
  await expect(page.getByRole('heading',{name:/Quem foi mais votado para Presidente \+ Governador/i})).toBeVisible();
  const options=await page.locator('#pairFilter option').allTextContents();
  expect(options.some(x=>x.includes('(Presidente) +')&&x.includes('(Governador)'))).toBeTruthy();
  await page.locator('#pairFilter').selectOption({index:1});
  await expect(page.locator('#crossPostText')).toHaveValue(/foi o candidato mais votado para Presidente/);
  await expect(page.locator('#crossPostText')).not.toHaveValue(/×/);
  await expect(page.locator('#comparecimentoScopeNote')).toContainText('Governador');
});


test('Card de participação inclui escala cromática no canvas',async({page})=>{
  await page.setViewportSize({width:1440,height:900});
  await page.goto('/analises.html?v='+BUILD);
  await page.waitForFunction(()=>window.__analysisReady===true);
  const hasScale=await page.evaluate(()=>typeof drawMetricScaleCanvas==='function');
  expect(hasScale).toBeTruthy();
  await expect(page.locator('#participationCanvas')).toBeVisible();
});
