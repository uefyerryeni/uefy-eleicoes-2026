const { test, expect } = require('@playwright/test');
const BUILD = require('../version.json').build;
const route = name => '/' + name + '?v=' + encodeURIComponent(BUILD);

async function readyRN(page, name='index.html') {
  await page.goto(route(name));
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
  await expect(page.locator('#rnMapRead')).toContainText('0/167');
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
  await page.goto(route('presidencia.html'));
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
  await page.goto(route('presidencia.html'));
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
  await page.goto(route('primeiro-turno.html'));
  await expect(page.getByRole('heading',{name:/primeiro turno/i})).toBeVisible();
  await expect(page.locator('#officeSelect option')).toHaveCount(5);
  await expect(page.locator('script[src*="app-primeiro-turno.js"]')).toHaveCount(1);
  await page.goto(route('radar.html'));
  await expect(page.getByRole('heading',{name:/1º turno/i})).toBeVisible();
  await page.goto(route('analises.html'));
  await expect(page.locator('.rn-badge')).toContainText('1º TURNO');
});

for (const viewport of [{width:1440,height:900},{width:390,height:844}]) {
  test('sem rolagem horizontal em '+viewport.width+'px', async ({page}) => {
    await page.setViewportSize(viewport);
    for (const pathname of ['index.html','presidencia.html','analises.html','radar.html','primeiro-turno.html']) {
      await page.goto(route(pathname));
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
