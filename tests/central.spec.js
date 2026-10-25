const { test, expect } = require('@playwright/test');
const BUILD = require('../version.json').build;
const route = name => '/' + name + '?v=' + encodeURIComponent(BUILD);
// Os testes de interface não dependem de serviços externos nem de resultados antecipados.
test.beforeEach(async ({page}) => {
  await page.route(/^https:\/\/(?:fonts\.googleapis\.com|fonts\.gstatic\.com|uefyerryeni\.github\.io|resultados(?:-sim)?\.tse\.jus\.br)\//, route=>route.abort());
});

async function readyRN(page, name='index.html') {
  await page.goto(route(name),{waitUntil:'domcontentloaded'});
  await page.waitForFunction(() => typeof selectedFeature !== 'undefined' && selectedFeature !== null);
}
function rejectLeaks(errors) {
  const fatal = errors.filter(x=>!(/ResizeObserver loop/.test(x)));
  expect(fatal).toEqual([]);
}

test('RN é a capa do segundo turno e apresenta as duas candidaturas sem resultados inventados', async ({page}) => {
  const errors=[];page.on('pageerror', e=>errors.push(e.message));
  await readyRN(page);
  await expect(page.locator('#homeTitle')).toContainText('RN');
  await expect(page.locator('.turno2-duel')).toContainText('ALLYSON BEZERRA');
  await expect(page.locator('.turno2-duel')).toContainText('CADU DE LULA');
  await expect(page.locator('#rnMode option')).toHaveCount(1);
  await expect(page.locator('#rnMode')).toHaveValue('official');
  await expect(page.locator('.topbar .nav a[href="radar.html"]')).toHaveCount(0);
  await expect(page.locator('body')).not.toContainText('Laboratório UEFY');
  const snapshot=await page.evaluate(()=>leaderMapData);
  await expect(page.locator('#rnMapRead')).toHaveText(snapshot.municipalities_read+'/167');
  await expect(page.locator('#rnMapPublish')).toBeDisabled();
  rejectLeaks(errors);
});

test('RN usa exclusivamente a eleição 6260 e não confunde snapshots', async ({page}) => {
  await readyRN(page);
  const x=await page.evaluate(async()=>{
    const snapshot=await fetch('data/rn-governador-mapa-2t.json').then(r=>r.json());
    const out={round:snapshot.round,election:snapshot.election_id,status:snapshot.status,
      fetched:resultUrl('00001'),source:municipalConfigUrl(),
      valid:leaderMapData.round===2&&String(leaderMapData.election_id)==='6260'};
    return out;
  });
  expect(x.round).toBe(2);
  expect(x.election).toBe('6260');
  expect(x.valid).toBeTruthy();
  expect(x.fetched).toContain('/6260/dados/rn/');
  expect(x.fetched).toContain('-e006260-');
  expect(x.source).toContain('/6258/config/');
});

test('mapa do segundo turno oferece os 167 municípios e busca utilizável', async ({page}) => {
  await readyRN(page);
  await expect(page.locator('#rnLeaderMap path')).toHaveCount(167);
  await page.locator('#munSearch').fill('Parnamirim');
  await expect(page.locator('#munList .rn-item')).toHaveCount(1);
  await page.locator('#munList .rn-item').first().click();
  await expect(page.locator('#selectedMun')).toHaveText('Parnamirim');
  await expect(page.locator('#rnOpenX')).toBeDisabled();
});

test('RN preserva cores e aliases oficiais', async ({page}) => {
  await readyRN(page);
  const x=await page.evaluate(()=>({
    red:candidateColor('Cadu de Lula','13'),
    blue:candidateColor('Allyson','44'),
    acu:municipalityKey('Açu')===municipalityKey('ASSÚ'),
    ares:municipalityKey('Arês')===municipalityKey('AREZ'),
    boa:municipalityKey('Januário Cicco')===municipalityKey('BOA SAÚDE')
  }));
  expect(x).toEqual({red:'#d62828',blue:'#1976d2',acu:true,ares:true,boa:true});
});

test('publicação municipal inclui segundo turno e bloqueia erros de conciliação', async ({page}) => {
  await readyRN(page);
  const x=await page.evaluate(()=>{
    current={progress:52.1,generatedAt:'25/10/2026 · 18:30',municipality:selectedFeature.properties.nome,
      integrity:{matched:2,total:2,unmatched:1},candidates:[
        {id:'1',name:'Cadu de Lula',number:'13',party:'PT',votes:100,pct:55},
        {id:'2',name:'Allyson Bezerra',number:'44',party:'UNIÃO',votes:80,pct:45}
      ]};
    renderCurrent();
    return {text:document.querySelector('#rnPostText').value,
      disabled:document.querySelector('#rnOpenX').disabled&&document.querySelector('#rnShareBundle').disabled};
  });
  expect(x.text).toContain('2º TURNO');
  expect(x.disabled).toBeTruthy();
});

test('publicação municipal só habilita dados oficiais conciliados', async ({page}) => {
  await readyRN(page);
  // Simula o horário permitido pelo TSE; jamais desativa o bloqueio real.
  await page.clock.setFixedTime(new Date('2026-10-25T21:30:00.000Z'));
  const x=await page.evaluate(()=>{
    current={progress:80,generatedAt:'25/10/2026 · 19:00',municipality:selectedFeature.properties.nome,
      integrity:{matched:2,total:2,unmatched:0},candidates:[
        {id:'1',name:'Allyson Bezerra',number:'44',party:'UNIÃO',votes:120,pct:60},
        {id:'2',name:'Cadu de Lula',number:'13',party:'PT',votes:80,pct:40}
      ]};
    renderCurrent();
    return {allowed:!document.querySelector('#rnOpenX').disabled,text:document.querySelector('#rnPostText').value};
  });
  expect(x.allowed).toBeTruthy();
  expect(x.text).toMatch(/2º TURNO/);
});

test('Presidência usa somente a eleição federal 6258', async ({page}) => {
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(route('presidencia.html'),{waitUntil:'domcontentloaded'});
  await expect(page.locator('#officeSelect option')).toHaveCount(1);
  await expect(page.locator('#officeSelect')).toHaveValue('pres');
  await expect(page.locator('#modeSelect option')).toHaveCount(1);
  await expect(page.locator('.result-card')).toHaveCount(1);
  const endpoint=await page.evaluate(()=>endpointFor('pres','br'));
  expect(endpoint).toContain('/6258/dados/br/');
  expect(endpoint).toContain('-e006258-');
  rejectLeaks(errors);
});

test('Presidência bloqueia publicação quando resultados não conciliam', async ({page}) => {
  await page.goto(route('presidencia.html'),{waitUntil:'domcontentloaded'});
  const safe=await page.evaluate(()=>{
    selectedOffice='pres';selectedScope='br';
    state.pres={progress:35,integrity:{matched:1,total:2,unmatched:1},
      candidates:[{name:'Teste A',number:'13',pct:54,votes:200},{name:'Teste B',number:'22',pct:46,votes:180}]};
    regenerate();
    return publicationIsSafe();
  });
  expect(safe).toBeFalsy();
});

test('acervo separado mantém acesso ao primeiro turno e ao Legislativo', async ({page}) => {
  await page.goto(route('primeiro-turno.html'),{waitUntil:'domcontentloaded'});
  await expect(page.getByRole('heading',{name:/primeiro turno/i})).toBeVisible();
  await expect(page.locator('#officeSelect option')).toHaveCount(5);
  await expect(page.locator('script[src*="app-primeiro-turno.js"]')).toHaveCount(1);
  await page.goto(route('radar.html'),{waitUntil:'domcontentloaded'});
  await expect(page.getByRole('heading',{name:/1º turno/i})).toBeVisible();
  await page.goto(route('analises.html'),{waitUntil:'domcontentloaded'});
  await expect(page.locator('.analysis-hero .rn-badge')).toContainText('1º TURNO');
});

test('Entre Turnos carrega base histórica de 167 municípios e preserva o segundo turno pendente',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(route('entre-turnos.html'),{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__entreTurnos?.rows===167);
  await expect(page.locator('#etMap .et-city')).toHaveCount(167);
  await expect(page.locator('#etFirstValue')).toHaveText('81,61%');
  await expect(page.locator('#etSecondValue')).toHaveText('—');
  await expect(page.locator('#etDeltaValue')).toHaveText('—');
  expect(await page.evaluate(()=>window.__entreTurnos.ready)).toBeFalsy();
  rejectLeaks(errors);
});
test('Entre Turnos filtra município e indicador sem dados do segundo turno',async({page})=>{
  await page.goto(route('entre-turnos.html'),{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__entreTurnos?.rows===167);
  await page.locator('#etCity').selectOption({label:'NATAL'});
  await expect(page.locator('#etScopeTitle')).toContainText('NATAL');
  await page.locator('#etMetric').selectOption('abstention_pct');
  await expect(page.locator('#etFirstValue')).not.toHaveText('—');
  await expect(page.locator('#etSecondValue')).toHaveText('—');
  await page.locator('#etSearch').fill('Parnamirim');
  await expect(page.locator('#etTableBody tr')).toHaveCount(1);
});
test('Entre Turnos recusa snapshot parcial',async({page})=>{
  await page.goto(route('entre-turnos.html'),{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__entreTurnos?.rows===167);
  const snapshot=await page.evaluate(()=>window.__entreTurnos.second);
  expect(snapshot.round).toBe(2);
  expect(snapshot.election_ids).toEqual({gov:'6260',pres:'6258'});
  expect(snapshot.publication_ready).toBeFalsy();
});
test('atalho da consulta municipal abre Entre Turnos com o mesmo municipio',async({page})=>{
 await readyRN(page);
 await expect(page.locator('#rnCompareCity')).toHaveAttribute('href',/municipio=Natal/);
 const f=await page.evaluate(()=>fc.features.find(x=>x.properties.nome==='Parnamirim'));
 await page.evaluate(()=>selectMunicipality(fc.features.find(x=>x.properties.nome==='Parnamirim')));
 await expect(page.locator('#rnCompareCity')).toHaveAttribute('href',/municipio=Parnamirim/);
 await page.goto(route('entre-turnos.html')+'&municipio=Parnamirim',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__mapaMudancas?.count===167);
 await expect(page.locator('#mtChosen')).toHaveText('PARNAMIRIM');
});
test('mapa territorial do governo carrega 167 municipios do primeiro turno com segundo pendente', async({page})=>{
  await page.goto(route('entre-turnos.html'),{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__mapaMudancas?.count===167);
  expect(await page.evaluate(()=>window.__mapaMudancas.compared)).toBe(0);
  await expect(page.locator('#mtMap .mt-municipality')).toHaveCount(167);
  await expect(page.locator('#mtTotal')).toHaveText('0');
  await expect(page.locator('#mtMissing')).toHaveText('167');
  await expect(page.locator('#mtView option[value="changes"]')).toHaveJSProperty('disabled',true);
  await expect(page.locator('#mtView option[value="second"]')).toHaveJSProperty('disabled',true);
  await page.locator('#mtSearch').fill('Parnamirim');
  await expect(page.locator('#mtRows tr')).toHaveCount(1);
  await expect(page.locator('#mtRows tr').first()).toContainText('Aguardando');
});
test('mapa de mudancas detalha municipios sem sugerir transferencia individual de votos',async({page})=>{
  await page.goto(route('entre-turnos.html'),{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__mapaMudancas?.count===167);
  await page.locator('#mtRows tr').first().click();
  await expect(page.locator('#mtFirstName')).not.toHaveText('Selecione uma cidade');
  await expect(page.locator('#mtSecondName')).toHaveText('Aguardando totalização');
  await expect(page.locator('#mtChangeState')).toHaveText('Sem comparação disponível');
  await expect(page.locator('#mtDisclaimer')).toContainText('transferência');
});
test('Viradas e permanencias reconhecem combinacoes com dados simulados apenas dentro do teste',async({page})=>{
  const historical=require('../data/rn-governador-mapa.json');
  const fake={round:2,election_id:'6260',publication_ready:true,municipalities_read:167,
    errors:[],leaders:{}};
  for(const [name,record] of Object.entries(historical.leaders)){
    const number=record.candidate_number==='22'?'13':name==='ACARI'?'44':record.candidate_number;
    const other=number==='13'?'44':'13';
    fake.leaders[name]={code:record.code,status:'ok',progress:100,
      candidate_number:number,candidate:number==='13'?'CADU DE LULA':'ALLYSON',
      votes:100,pct:55.56,top3:[
       {number,votes:100,pct:55.56},
       {number:other,votes:80,pct:44.44}
      ]};
  }
  await page.route('**/data/rn-governador-mapa-2t.json*',route=>route.fulfill({json:fake}));
  await page.goto(route('entre-turnos.html'),{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__mapaMudancas?.compared===167);
  await expect(page.locator('#mtChanged')).toHaveText('30');
  await expect(page.locator('#mtStayed')).toHaveText('137');
  await page.locator('#mtView').selectOption('changes');
  await page.locator('#mtFilter').selectOption('22-13');
  await expect(page.locator('#mtRows tr')).toHaveCount(29);
  await page.locator('#mtFilter').selectOption('13-44');
  await expect(page.locator('#mtRows tr')).toHaveCount(1);
  await expect(page.locator('#mtRows tr').first()).toContainText('ACARI');
});
test('titulos editoriais usam familia larga e leitura confortavel',async({page})=>{
  await page.setViewportSize({width:1440,height:900});
  await page.goto(route('entre-turnos.html'),{waitUntil:'domcontentloaded'});
  const first=await page.locator('.et-intro h2').evaluate(el=>{
    const cs=getComputedStyle(el);return {font:cs.fontFamily,size:parseFloat(cs.fontSize),lineHeight:parseFloat(cs.lineHeight),scroll:el.scrollWidth,width:el.clientWidth}
  });
  expect(first.font).toContain('Space Grotesk');
  expect(first.lineHeight/first.size).toBeGreaterThan(1.08);
  expect(first.scroll).toBeLessThanOrEqual(first.width+2);
  await page.setViewportSize({width:390,height:844});
  const mobile=await page.locator('.et-intro h2').evaluate(el=>({scroll:el.scrollWidth,width:el.clientWidth}));
  expect(mobile.scroll).toBeLessThanOrEqual(mobile.width+2);
});

test('auditoria móvel: todas as páginas oferecem menu, campos legíveis e largura estável',async({page})=>{
 const files=['index.html','presidencia.html','entre-turnos.html','analises.html','radar.html','primeiro-turno.html'];
 for(const width of [320,360,390,430,600,768,820]){
  await page.setViewportSize({width,height:800});
  for(const path of files){
   await page.goto(route(path),{waitUntil:'domcontentloaded'});
   const r=await page.evaluate(()=>{
    const vis=el=>el&&getComputedStyle(el).display!=='none'&&getComputedStyle(el).visibility!=='hidden'&&el.getClientRects().length>0;
    const h=document.querySelector('.mobile-menu summary'),brand=document.querySelector('.brandtext strong');
    const controls=[...document.querySelectorAll('input,select,textarea')].filter(vis);
    return {
     excess:Math.max(0,document.documentElement.scrollWidth-document.documentElement.clientWidth),
     menu:!!vis(h),
     brandClipped:brand&&brand.scrollWidth>brand.clientWidth+3,
     smallInputs:controls.filter(el=>parseFloat(getComputedStyle(el).fontSize)<16).map(x=>x.id)
    };
   });
   expect(r.excess,path+' @ '+width+'px').toBeLessThanOrEqual(2);
   expect(r.menu,path+' @ '+width+'px: menu desapareceu').toBeTruthy();
   if(width<=600){
    expect(r.brandClipped,path+' @ '+width+'px: marca cortada').toBeFalsy();
   }
   expect(r.smallInputs,path+' @ '+width+'px: zoom no foco').toEqual([]);
  }
 }
});
test('celular: o título da Presidência cabe na largura de 320 pixels',async({page})=>{
 await page.setViewportSize({width:320,height:760});
 await page.goto(route('presidencia.html'),{waitUntil:'domcontentloaded'});
 const title=await page.locator('.hero h1').evaluate(el=>({scroll:el.scrollWidth,width:el.clientWidth}));
 expect(title.scroll).toBeLessThanOrEqual(title.width+2);
});
test('tabelas do Entre Turnos deslizam sem criar rolagem horizontal geral',async({page})=>{
 await page.setViewportSize({width:320,height:760});
 await page.goto(route('entre-turnos.html'),{waitUntil:'domcontentloaded'});
 const result=await page.evaluate(()=>{
  const tab=document.querySelector('.et-table-wrap');
  const other=document.querySelector('.mt-scroll');
  return {tab:tab.scrollWidth>tab.clientWidth,other:other.scrollWidth>other.clientWidth,body:document.documentElement.scrollWidth-document.documentElement.clientWidth};
 });
 expect(result.tab).toBeTruthy();expect(result.other).toBeTruthy();expect(result.body).toBeLessThanOrEqual(2);
});

test('navegação no modo escuro mantém largura e interações em celular',async({page})=>{
 await page.setViewportSize({width:360,height:780});
 for(const path of ['index.html','entre-turnos.html']){
  await page.goto(route(path),{waitUntil:'domcontentloaded'});
  const t=page.locator('#themeToggle');
  const before=await page.evaluate(()=>document.body.classList.contains('dark'));
  await t.click();
  const after=await page.evaluate(()=>document.body.classList.contains('dark'));
  expect(after).not.toBe(before);
  const el=page.locator('.mobile-menu summary');
  await el.click();
  await expect(page.locator('.mobile-menu-panel a[href="presidencia.html"]')).toBeVisible();
  const excess=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
  expect(excess).toBeLessThanOrEqual(2);
 }
});
test('atalhos editoriais e marca possuem área de toque adequada',async({page})=>{
 await page.setViewportSize({width:320,height:760});
 await page.goto(route('entre-turnos.html'),{waitUntil:'domcontentloaded'});
 const els=await page.locator('.topbar a.brand,.et-links a').evaluateAll(nodes=>nodes.map(n=>({name:n.textContent.trim().slice(0,25),height:n.getBoundingClientRect().height})));
 for(const v of els)expect(v.height,v.name).toBeGreaterThanOrEqual(40);
});
for (const viewport of [{width:1440,height:900},{width:390,height:844}]) {
  test('sem rolagem horizontal em '+viewport.width+'px', async ({page}) => {
    await page.setViewportSize(viewport);
    for (const pathname of ['index.html','presidencia.html','analises.html','radar.html','primeiro-turno.html','entre-turnos.html']) {
      await page.goto(route(pathname),{waitUntil:'domcontentloaded'});
      await page.waitForLoadState('domcontentloaded');
      const x=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,viewport:document.documentElement.clientWidth}));
      expect(x.scroll,pathname+' '+JSON.stringify(x)).toBeLessThanOrEqual(x.viewport+2);
    }
  });
}

test('menu e retorno ao topo funcionam em largura de celular', async ({page}) => {
  await page.setViewportSize({width:390,height:844});
  await readyRN(page);
  await page.locator('.mobile-menu summary').click();
  await expect(page.locator('.mobile-menu-panel a[href="presidencia.html"]')).toBeVisible();
  await page.locator('.mobile-menu summary').click();
  await page.evaluate(()=>scrollTo(0,1000));
  await expect(page.locator('#toTop')).toBeVisible();
  await page.locator('#toTop').click();
  await expect.poll(()=>page.evaluate(()=>window.scrollY)).toBeLessThan(100);
});


test('vídeo para Twitter existe em ambas as páginas, com prévia sem números fictícios', async({page})=>{
  await readyRN(page);
  await expect(page.locator('#uefyVideoStudio')).toBeVisible();
  await expect(page.locator('#uefyVideoCanvas')).toHaveAttribute('width','1080');
  await expect(page.locator('#uefyVideoCanvas')).toHaveAttribute('height','1080');
  await expect(page.locator('#uefyVideoOverlay')).toContainText('SEM DADOS');
  const rnVideo=await page.evaluate(()=>({
    duration:window.__uefyVideo.duration,
    officialReady:window.__uefyVideo.officialReady,
    isRN:window.__uefyVideo.isRN
  }));
  expect(rnVideo).toEqual({duration:8000,officialReady:false,isRN:true});
  expect(await page.evaluate(()=>window.__uefyVideo.revealEnd)).toBe(1450);
  await expect(page.locator('#uefyVideoCounter')).toContainText('00:08');
  await page.locator('#uefyVideoExport').click();
  await expect(page.locator('#uefyVideoStatus')).toContainText('exportação com votos está bloqueada');
  await expect(page.locator('#uefyVideoResult')).toBeHidden();
  await expect(page.locator('#uefyVideoShare')).toBeEnabled();
  await expect(page.locator('#uefyVideoShare')).toContainText('1/2 · Preparar MP4');
  await page.goto(route('presidencia.html'),{waitUntil:'domcontentloaded'});
  await expect(page.locator('#uefyVideoStudio')).toBeVisible();
  expect(await page.evaluate(()=>window.__uefyVideo.isRN)).toBeFalsy();
  await page.locator('#uefyVideoExport').click();
  await expect(page.locator('#uefyVideoResult')).toBeHidden();
});
test('vídeo municipal do RN só é liberado após horário oficial e conciliação integral',async({page})=>{
  await readyRN(page);
  await page.locator('#uefyVideoScope').selectOption('municipal');
  await page.clock.setFixedTime(new Date('2026-10-25T21:30:00.000Z'));
  const states=await page.evaluate(()=>{
    const city=selectedFeature.properties.nome;
    current={progress:55.2,generatedAt:'25/10/2026 · 18:30',municipality:city,
      integrity:{matched:2,total:2,unmatched:1},candidates:[
      {id:'13',number:'13',name:'CADU DE LULA',party:'PT',votes:100,pct:40},
      {id:'44',number:'44',name:'ALLYSON',party:'UNIÃO',votes:150,pct:60}
    ]};
    const blocked=window.__uefyVideo.officialReady;
    current.integrity.unmatched=0;
    const permitted=window.__uefyVideo.officialReady;
    current.integrity.error=true;
    const broken=window.__uefyVideo.officialReady;
    return {blocked,permitted,broken};
  });
  expect(states).toEqual({blocked:false,permitted:true,broken:false});
});


test('UEFY Motion apresenta capa editorial e botão de preparo MP4 ativo', async ({page}) => {
  await readyRN(page);
  const frame=await page.evaluate(()=>{
    const c=document.querySelector('#uefyVideoCanvas');
    const ctx=c.getContext('2d');
    const sample=(x,y)=>[...ctx.getImageData(x,y,1,1).data].slice(0,3);
    const button=document.querySelector('#uefyVideoShare');
    return {
      cover:sample(5,30),
      body:sample(30,510),
      card:sample(84,510),
      caption:document.querySelector('#uefyVideoStatus').textContent,
      button:button.textContent,
      disabled:button.disabled,
      v2:!!window.__uefyVideo
    };
  });
  expect(frame.cover).toEqual([244,221,25]);
  expect(frame.body).toEqual([18,23,20]);
  expect(frame.card).toEqual([246,245,238]);
  expect(frame.button).toContain('1/2 · Preparar MP4');
  expect(frame.disabled).toBeFalsy();
  expect(frame.v2).toBeTruthy();
});

test('capa do Motion v2 é legível no celular sem rolagem horizontal',async ({page})=>{
  await page.setViewportSize({width:390,height:844});
  await readyRN(page);
  const result=await page.evaluate(()=>{
    const studio=document.querySelector('#uefyVideoStudio');
    const share=document.querySelector('#uefyVideoShare');
    return {
      studioWidth:studio.getBoundingClientRect().width,
      viewportWidth:document.documentElement.clientWidth,
      overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,
      whiteButtonBackground:getComputedStyle(share).backgroundColor,
      text:share.textContent
    };
  });
  expect(result.overflow).toBeLessThanOrEqual(2);
  expect(result.studioWidth).toBeLessThanOrEqual(result.viewportWidth+2);
  expect(result.whiteButtonBackground).toBe('rgb(244, 221, 25)');
  expect(result.text).toContain('1/2 · Preparar MP4');
});

test('PNG editorial mantém a identidade em RN e Presidência',async({page})=>{
  await readyRN(page);
  const rnColors=await page.evaluate(()=>{
    const ctx=document.querySelector('#rnCanvas').getContext('2d');
    return {top:[...ctx.getImageData(9,7,1,1).data].slice(0,3),
      masthead:[...ctx.getImageData(10,80,1,1).data].slice(0,3),
      tally:[...ctx.getImageData(61,408,1,1).data].slice(0,3)};
  });
  expect(rnColors.top).toEqual([244,221,25]);
  expect(rnColors.masthead).toEqual([21,26,24]);
  expect(rnColors.tally).toEqual([244,221,25]);
  await page.goto(route('presidencia.html'),{waitUntil:'domcontentloaded'});
  const pres=await page.evaluate(()=>{
    const ctx=document.querySelector('#shareCanvas').getContext('2d');
    return {top:[...ctx.getImageData(9,7,1,1).data].slice(0,3),
      masthead:[...ctx.getImageData(10,80,1,1).data].slice(0,3)};
  });
  expect(pres.top).toEqual([244,221,25]);
  expect(pres.masthead).toEqual([21,26,24]);
});


// O teste usa candidaturas internas de teste somente no navegador do Playwright;
// nenhuma votação fictícia é publicada, exportada ou salva no site.
async function enableMockShare(page) {
  await page.evaluate(()=>{
    window.__capturedShare=null;
    Object.defineProperty(navigator,'canShare',{configurable:true,value:payload=>
      !!payload.files?.length && payload.files[0].type==='image/jpeg'});
    Object.defineProperty(navigator,'share',{configurable:true,value:payload=>{
      const file=payload.files[0];
      window.__capturedShare={
        text:payload.text,name:file.name,type:file.type,size:file.size,
        gesture:navigator.userActivation?.isActive??true
      };
      return Promise.resolve();
    }});
  });
}
test('Brave móvel: RN envia imagem JPEG e texto no mesmo toque, somente com TSE conferido',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await readyRN(page);
  await page.clock.setFixedTime(new Date('2026-10-25T21:30:00.000Z'));
  await page.evaluate(()=>{
    current={progress:70,generatedAt:'25/10/2026 · 18:30',
      municipality:selectedFeature.properties.nome,
      integrity:{matched:2,total:2,unmatched:0},candidates:[
        {id:'13',number:'13',name:'CADU DE LULA',party:'PT',votes:200,pct:55},
        {id:'44',number:'44',name:'ALLYSON BEZERRA',party:'UNIÃO',votes:150,pct:45}
      ]};
    renderCurrent();
  });
  await enableMockShare(page);
  await expect(page.locator('#rnShareBundle')).toBeEnabled();
  await page.locator('#rnShareBundle').click();
  const captured=await page.evaluate(()=>window.__capturedShare);
  expect(captured.text).toContain('GOVERNADOR DO RN');
  expect(captured.type).toBe('image/jpeg');
  expect(captured.name).toMatch(/\.jpg$/);
  expect(captured.size).toBeGreaterThan(5000);
  expect(captured.gesture).toBeTruthy();
  await expect(page.locator('#rnShareStatus')).toContainText('Confira');
  await expect(page.locator('#rnXManual')).toBeHidden();
  // O botão "Publicar no X" também deve compartilhar o arquivo pelo app no celular.
  await page.locator('#rnOpenX').click();
  expect((await page.evaluate(()=>window.__capturedShare)).size).toBeGreaterThan(5000);
});

test('Brave móvel: fallback RN informa o passo manual sem perder texto nem arte',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await readyRN(page);
  await page.clock.setFixedTime(new Date('2026-10-25T21:30:00.000Z'));
  await page.evaluate(()=>{
    current={progress:70,generatedAt:'25/10/2026 · 18:30',
      municipality:selectedFeature.properties.nome,
      integrity:{matched:2,total:2,unmatched:0},candidates:[
        {id:'13',number:'13',name:'CADU DE LULA',party:'PT',votes:200,pct:55},
        {id:'44',number:'44',name:'ALLYSON BEZERRA',party:'UNIÃO',votes:150,pct:45}
      ]};
    renderCurrent();
    Object.defineProperty(navigator,'canShare',{configurable:true,value:()=>false});
    Object.defineProperty(navigator,'share',{configurable:true,value:()=>Promise.reject(new Error('no files'))});
  });
  await page.locator('#rnShareBundle').click();
  await expect(page.locator('#rnShareStatus')).toContainText('Brave não enviou');
  await expect(page.locator('#rnXManual')).toBeVisible();
  await expect(page.locator('#rnXManual')).toHaveAttribute('href',/twitter\.com\/intent\/tweet/);
  await expect(page.locator('#rnCopyText')).toBeEnabled();
  await expect(page.locator('#rnDownload')).toBeEnabled();
});

test('Brave móvel: Presidência compartilha texto e arquivo de forma síncrona',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto(route('presidencia.html'),{waitUntil:'domcontentloaded'});
  await page.clock.setFixedTime(new Date('2026-10-25T21:30:00.000Z'));
  await page.evaluate(()=>{
    selectedOffice='pres';selectedScope='br';mode='official';
    state.pres={requestKey:'pres|br|official',progress:78,
      generatedAt:'25/10/2026 · 18:30',integrity:{matched:2,total:2,unmatched:0},
      candidates:[
        {name:'CANDIDATO A',party:'PARTIDO A',number:'13',votes:120,pct:60},
        {name:'CANDIDATO B',party:'PARTIDO B',number:'22',votes:80,pct:40}
      ]};
    regenerate();
  });
  await enableMockShare(page);
  await expect(page.locator('#shareBundle')).toBeEnabled();
  await page.locator('#shareBundle').click();
  const c=await page.evaluate(()=>window.__capturedShare);
  expect(c.type).toBe('image/jpeg');
  expect(c.size).toBeGreaterThan(5000);
  expect(c.gesture).toBeTruthy();
  expect(c.text).toContain('PRESIDÊNCIA');
  await expect(page.locator('#shareStatus')).toContainText('Confira');
  await expect(page.locator('#xManual')).toBeHidden();
});

test('modo fictício removido da Central; publicação continua bloqueada antes da apuração',async({page})=>{
  await readyRN(page);
  await expect(page.locator('#uefyVideoDemo')).toHaveCount(0);
  expect(await page.evaluate(()=>window.__uefyVideo.officialOnly)).toBeTruthy();
  await expect(page.locator('#rnShareBundle')).toBeDisabled();
  await page.goto(route('presidencia.html'),{waitUntil:'domcontentloaded'});
  await expect(page.locator('#uefyVideoDemo')).toHaveCount(0);
  await expect(page.locator('#shareBundle')).toBeDisabled();
});


test('prévia operacional mantém a identidade real sem inventar resultados para o X',async({page})=>{
  await readyRN(page);
  await expect(page.locator('#uefyVideoRehearsal')).toBeVisible();
  await expect(page.locator('#uefyVideoExport')).toContainText('oficial');
  await expect(page.locator('#uefyVideoShare')).toBeEnabled();
  await expect(page.locator('#uefyVideoShare')).toContainText('1/2 · Preparar MP4');
  const result=await page.evaluate(()=>({
    officialReady:window.__uefyVideo.officialReady,
    previewReady:window.__uefyVideo.preflightAvailable,
    text:window.__uefyVideo.rehearsalText,
    realData:document.querySelector('#rnPostText').value
  }));
  expect(result.officialReady).toBeFalsy();
  expect(result.previewReady).toBeTruthy();
  expect(result.text).toContain('TESTE DE PUBLICAÇÃO');
  expect(result.text).toContain('SEM RESULTADOS');
  expect(result.text).not.toContain('Fonte: TSE');
  expect(result.text.length).toBeLessThanOrEqual(280);
  expect(result.realData).not.toContain('53,8%');
  await page.goto(route('presidencia.html'),{waitUntil:'domcontentloaded'});
  await expect(page.locator('#uefyVideoRehearsal')).toBeVisible();
  const text=await page.evaluate(()=>window.__uefyVideo.rehearsalText);
  expect(text).toContain('PRESIDÊNCIA');
  expect(text).toContain('SEM RESULTADOS');
  expect(text).not.toContain('53,8%');
});

test('MP4 de ensaio pode ser enviado pelo Brave com legenda, mantendo vídeo oficial bloqueado',async({page})=>{
  test.setTimeout(30000);
  await page.setViewportSize({width:390,height:844});
  await readyRN(page);
  await page.evaluate(()=>{
    const RealRecorder=window.MediaRecorder;
    class Recorder {
      constructor(){this.state='inactive';}
      static isTypeSupported(type){return type.startsWith('video/mp4');}
      start(){this.state='recording';}
      stop(){
        if(this.state==='inactive')return;
        this.state='inactive';
        const bytes=new Uint8Array(26000);bytes.set([0,0,0,24,102,116,121,112,105,115,111,109],0);
        this.ondataavailable?.({data:new Blob([bytes],{type:'video/mp4'})});
        this.onstop?.();
      }
    }
    window.MediaRecorder=Recorder;
    window.__restoreRecorder=()=>{window.MediaRecorder=RealRecorder;};
    HTMLCanvasElement.prototype.captureStream=function(){return {getTracks:()=>[]};};
    window.__rehearsalPayload=null;
    Object.defineProperty(navigator,'canShare',{configurable:true,value:x=>
      !!x.files?.length&&x.files[0].type==='video/mp4'});
    Object.defineProperty(navigator,'share',{configurable:true,value:x=>{
      window.__rehearsalPayload={
        text:x.text,
        filename:x.files[0].name,
        bytes:x.files[0].size,
        mime:x.files[0].type,
        gesture:navigator.userActivation?.isActive??true
      };
      return Promise.resolve();
    }});
  });
  await page.locator('#uefyVideoExport').click();
  await expect(page.locator('#uefyVideoStatus')).toContainText('exportação com votos está bloqueada');
  await expect(page.locator('#uefyVideoShare')).toBeEnabled();
  await expect(page.locator('#uefyVideoShare')).toContainText('1/2 · Preparar MP4');
  await page.locator('#uefyVideoShare').click();
  await expect(page.locator('#uefyVideoShare')).toContainText('2/2 · Compartilhar',{timeout:20000});
  expect(await page.evaluate(()=>window.__uefyVideo.generatedIsRehearsal)).toBeTruthy();
  await expect(page.locator('#uefyVideoDownload')).toHaveAttribute('download','UEFY-TESTE-ENVIO-SEM-RESULTADOS.mp4');
  await page.locator('#uefyVideoShare').click();
  const posted=await page.evaluate(()=>window.__rehearsalPayload);
  expect(posted.mime).toBe('video/mp4');
  expect(posted.bytes).toBeGreaterThan(20000);
  expect(posted.filename).toContain('SEM-RESULTADOS');
  expect(posted.text).toContain('SEM RESULTADOS');
  expect(posted.text).not.toContain('53,8%');
  expect(posted.gesture).toBeTruthy();
  await expect(page.locator('#uefyVideoStatus')).toContainText('Confira no X');
});

test('MP4 real do ensaio: arquivo H264 gerado no Chromium sem gravador falso', async({page})=>{
  test.setTimeout(40000);
  await readyRN(page);
  const supported=await page.evaluate(()=>(
    !!window.MediaRecorder && !!HTMLCanvasElement.prototype.captureStream &&
    ['video/mp4;codecs=avc1.42E01E','video/mp4;codecs=avc1','video/mp4']
      .some(type=>MediaRecorder.isTypeSupported(type))
  ));
  test.skip(!supported,'Ambiente de QA sem suporte nativo MP4: fluxo WebCodecs cobre navegadores compatíveis.');
  await page.locator('#uefyVideoShare').click();
  await expect(page.locator('#uefyVideoShare')).toContainText('2/2 · Compartilhar',{timeout:25000});
  await expect(page.locator('#uefyVideoPlayer')).toHaveAttribute('src',/^blob:/);
  const media=await page.evaluate(async()=>{
    const url=document.querySelector('#uefyVideoPlayer').src;
    const blob=await fetch(url).then(r=>r.blob());
    const buf=await blob.slice(0,32).arrayBuffer();
    const header=[...new Uint8Array(buf)];
    const video=document.querySelector('#uefyVideoPlayer');
    await new Promise((resolve,reject)=>{
      if(video.readyState>=1){resolve();return;}
      video.addEventListener('loadedmetadata',resolve,{once:true});
      video.addEventListener('error',()=>reject(new Error('MP4 não reproduzível')),{once:true});
      setTimeout(()=>reject(new Error('MP4 sem metadados reproduzíveis')),6000);
    });
    return {size:blob.size,type:blob.type,ftyp:String.fromCharCode(...header.slice(4,8)),
      duration:video.duration,videoWidth:video.videoWidth,videoHeight:video.videoHeight};
  });
  expect(media.ftyp).toBe('ftyp');
  expect(media.type).toBe('video/mp4');
  expect(media.size).toBeGreaterThan(20000);
  expect(media.videoWidth).toBeGreaterThanOrEqual(720);
  expect(media.videoHeight).toBeGreaterThanOrEqual(720);
  expect(media.duration).toBeGreaterThan(7);
});


test('Presidência segundo turno: TSE confirma Flávio 22 e Lula 13 no painel e no Motion',async({page})=>{
  const errors=[];page.on('pageerror',err=>errors.push(err.message));
  await page.goto(route('presidencia.html'),{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__uefyVideo?.presidentialBallotVerified===true &&
    state.pres?.previewOnly===true);
  await expect(page.locator('#presRows')).toContainText('FLAVIO BOLSONARO');
  await expect(page.locator('#presRows')).toContainText('LULA');
  await expect(page.locator('#presRows')).toContainText('22 · PL');
  await expect(page.locator('#presRows')).toContainText('13 · PT');
  await expect(page.locator('#presRows')).not.toContainText('0,0%');
  const checked=await page.evaluate(()=>{
    const names=window.__uefyVideo.previewCandidates;
    const text=document.querySelector('#postText').value;
    const cache=state.pres;
    return {names,text,integrity:cache.integrity,official:window.__uefyVideo.officialReady,
      verified:window.__uefyVideo.presidentialBallotVerified};
  });
  expect(checked.names).toEqual([
    {name:'FLAVIO BOLSONARO',party:'PL',number:'22',pct:0,votes:0},
    {name:'LULA',party:'PT',number:'13',pct:0,votes:0}
  ]);
  expect(checked.text).toContain('FLAVIO BOLSONARO');
  expect(checked.text).toContain('LULA');
  expect(checked.text).toContain('SEM APURAÇÃO');
  expect(checked.text).not.toContain('0,0%');
  expect(checked.integrity).toBeNull();
  expect(checked.verified).toBeTruthy();
  expect(checked.official).toBeFalsy();
  await expect(page.locator('#shareBundle')).toBeDisabled();
  await page.locator('#uefyVideoPlay').click();
  await expect(page.locator('#uefyVideoStatus')).toContainText('base oficial',{timeout:7000});
  rejectLeaks(errors);
});

test('Presidência recusa prévia exportável se candidaturas não puderem ser conferidas no TSE',async({page})=>{
  await page.route('**/data/candidatos-2026.json',route=>
    route.fulfill({status:404,contentType:'application/json',body:'{}'}));
  await page.goto(route('presidencia.html'),{waitUntil:'domcontentloaded'});
  await expect(page.locator('#statusTitle')).toContainText('Conferência de candidaturas indisponível');
  expect(await page.evaluate(()=>window.__uefyVideo.presidentialBallotVerified)).toBeFalsy();
  await page.locator('#uefyVideoRehearsal').click();
  await expect(page.locator('#uefyVideoStatus')).toContainText('não será gerado');
  await expect(page.locator('#uefyVideoShare')).toContainText('1/2 · Preparar MP4');
  await expect(page.locator('#uefyVideoResult')).toBeHidden();
});

test('base local de candidaturas coincide com os dois nomes e partidos publicados pelo TSE',async({request})=>{
  const res=await request.get('/data/candidatos-2026.json');
  expect(res.ok()).toBeTruthy();
  const data=await res.json();
  expect(data.source).toBe('TSE/AGEL - Candidatos 2026');
  expect(data.source_url).toContain('consulta_cand_2026.zip');
  const candidates=['22','13'].map(n=>data.pres.find(c=>String(c.numero)===n));
  expect(candidates.map(c=>({name:c.nome,party:c.partido,status:c.situacao}))).toEqual([
    {name:'FLAVIO BOLSONARO',party:'PL',status:'DEFERIDO'},
    {name:'LULA',party:'PT',status:'DEFERIDO'}
  ]);
});


test('Motion RN: primeiro vídeo e texto são estaduais; Natal só após escolha municipal',async({page})=>{
  await readyRN(page);
  await expect(page.locator('#uefyVideoScope')).toHaveValue('state');
  const general=await page.evaluate(()=>({
    scope:window.__uefyVideo.rnVideoScope,
    label:window.__uefyVideo.rehearsalText,
    endpoint:window.__uefyVideo.rnTotalUrl,
    ready:window.__uefyVideo.officialReady
  }));
  expect(general.scope).toBe('state');
  expect(general.label).toContain('RIO GRANDE DO NORTE');
  expect(general.label).not.toContain('Natal');
  await expect(page.locator('#uefyVideoCaption')).toHaveValue(/RIO GRANDE DO NORTE/);
  await expect(page.locator('#uefyVideoCaption')).not.toHaveValue(/Natal/);
  expect(general.endpoint).toBe('https://resultados.tse.jus.br/oficial/ele2026/6260/dados/rn/rn-c0003-e006260-u.json');
  expect(general.ready).toBeFalsy();
  await page.locator('#uefyVideoScope').selectOption('municipal');
  expect(await page.evaluate(()=>window.__uefyVideo.rehearsalText)).toContain('Natal');
  await expect(page.locator('#uefyVideoCaption')).toHaveValue(/Natal/);
  await page.locator('#uefyVideoScope').selectOption('state');
  expect(await page.evaluate(()=>window.__uefyVideo.rehearsalText)).not.toContain('Natal');
  await expect(page.locator('#uefyVideoCaption')).not.toHaveValue(/Natal/);
});

test('Motion estadual confere RN todo pelo EA20; rejeita usar o resultado municipal como substituto',async({page})=>{
  test.setTimeout(30000);
  await page.setViewportSize({width:390,height:844});
  await readyRN(page);
  await page.clock.setFixedTime(new Date('2026-10-25T21:30:00.000Z'));
  await page.route('**/6260/dados/rn/rn-c0003-e006260-u.json',route=>
    route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
      dg:'25/10/2026',hg:'18:30:00',s:{pst:'52,00'},
      carg:[{agr:[{par:[
        {sg:'PT',cand:[{n:'13',nmu:'CADU DE LULA',pvap:'56,00',vap:56000}]},
        {sg:'UNIÃO',cand:[{n:'44',nmu:'ALLYSON BEZERRA',pvap:'44,00',vap:44000}]}
      ]}]}]
    })}));
  await page.evaluate(()=>{
    current={
      municipality:'Natal',progress:96,integrity:{matched:2,total:2,unmatched:0},
      candidates:[
        {number:'13',name:'CADU DE LULA',votes:10,pct:1},
        {number:'44',name:'ALLYSON BEZERRA',votes:990,pct:99}
      ]};
  });
  await page.locator('#uefyVideoExport').click();
  await page.waitForFunction(()=>window.__uefyVideo.rnStateReady===true,{timeout:12000});
  const snapshot=await page.evaluate(()=>({
    scope:window.__uefyVideo.rnVideoScope,
    label:window.__uefyVideo.officialLabel,
    rows:window.__uefyVideo.officialRows,
    ready:window.__uefyVideo.officialReady
  }));
  expect(snapshot.scope).toBe('state');
  expect(snapshot.label).toBe('RIO GRANDE DO NORTE');
  expect(snapshot.ready).toBeTruthy();
  expect(snapshot.rows).toEqual([
    {number:'13',votes:56000,pct:56},
    {number:'44',votes:44000,pct:44}
  ]);
});

test('WebCodecs grava MP4 com taxa de quadros fixa e sem captura em tempo real',async({page})=>{
  test.setTimeout(45000);
  await readyRN(page);
  const supported=await page.evaluate(async()=>{
    if(typeof VideoEncoder==='undefined'||typeof VideoFrame==='undefined')return false;
    try{return !!(await VideoEncoder.isConfigSupported({
      codec:'avc1.42E01E',width:720,height:720,bitrate:2800000,
      framerate:24,avc:{format:'avc'}
    })).supported;}catch(e){return false;}
  });
  test.skip(!supported,'WebCodecs H264 indisponível neste ambiente');
  await page.evaluate(()=>{window.MediaRecorder=undefined;});
  await page.locator('#uefyVideoRehearsal').click();
  await expect(page.locator('#uefyVideoShare')).toContainText('2/2 · Compartilhar',{timeout:35000});
  const actual=await page.evaluate(async()=>{
    const video=document.querySelector('#uefyVideoPlayer');
    const blob=await fetch(video.src).then(r=>r.blob());
    const bytes=new Uint8Array(await blob.slice(0,12).arrayBuffer());
    return {size:blob.size,ftyp:String.fromCharCode(...bytes.slice(4,8)),
      duration:await new Promise(resolve=>{
        if(video.readyState>=1)resolve(video.duration);
        else video.addEventListener('loadedmetadata',()=>resolve(video.duration),{once:true});
      }),text:window.__uefyVideo.generatedText};
  });
  expect(actual.size).toBeGreaterThan(20000);
  expect(actual.ftyp).toBe('ftyp');
  expect(actual.duration).toBeGreaterThan(7.9);
  expect(actual.duration).toBeLessThan(8.2);
  expect(actual.text).toContain('RIO GRANDE DO NORTE');
  expect(actual.text).not.toContain('Natal');
});
