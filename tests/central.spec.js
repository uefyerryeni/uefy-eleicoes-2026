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
