const BUILD=require('../version.json').build;
const { test, expect } = require('@playwright/test');

async function installCanvasGuard(page){
  await page.addInitScript(() => {
    window.__canvasOverflows=[];
    const original=CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText=function(text,x,y,maxWidth){
      try{
        const w=this.measureText(String(text)).width;
        const align=this.textAlign||'start';
        let left=x,right=x+w;
        if(align==='right'||align==='end'){left=x-w;right=x}
        else if(align==='center'){left=x-w/2;right=x+w/2}
        if(left < -1 || right > this.canvas.width+1){
          window.__canvasOverflows.push({text:String(text),left,right,width:this.canvas.width,align});
        }
      }catch{}
      return original.apply(this,arguments);
    };
  });
}
async function resetGuard(page){ await page.evaluate(()=>window.__canvasOverflows=[]); }
async function expectNoCanvasOverflow(page){
  const bad=await page.evaluate(()=>window.__canvasOverflows||[]);
  expect(bad).toEqual([]);
}
async function noOverlap(page,a,b){
  const A=await page.locator(a).boundingBox(), B=await page.locator(b).boundingBox();
  if(!A||!B)return;
  const overlap=!(A.x+A.width<=B.x || B.x+B.width<=A.x || A.y+A.height<=B.y || B.y+B.height<=A.y);
  expect(overlap).toBeFalsy();
}

test('Radar LAB cobre primeiro, meio e último candidato de todos os cargos e gera cards', async ({page})=>{
  await installCanvasGuard(page);
  await page.goto('/radar.html?v='+BUILD);
  await page.selectOption('#radarMode','lab');
  await expect(page.locator('#radarStatus')).toContainText('LABORATÓRIO UEFY');

  for(const office of ['sen','depf','depe']){
    await page.selectOption('#officeFilter',office);
    const count=await page.locator('#candidateFilter option').count();
    expect(count).toBeGreaterThan(3);
    const idx=[1,Math.max(1,Math.floor((count-1)/2)),count-1];
    const values=[];
    for(const i of idx) values.push(await page.locator('#candidateFilter option').nth(i).getAttribute('value'));
    for(const candidate of [...new Set(values)]){
      await page.selectOption('#candidateFilter',candidate);
      for(const typ of ['territorial_coverage','capital_share','top_municipalities','municipal_leads']){
        await resetGuard(page);
        await page.selectOption('#typeFilter',typ);
        await expect(page.locator('#findingCount')).not.toContainText('0 achados');
        await expect(page.locator('#detailContent')).toBeVisible();
        await expect(page.locator('#radarPostText')).not.toHaveValue('');
        await expectNoCanvasOverflow(page);
      }
    }
  }
});

test('Radar libera publicação somente após conferência', async ({page})=>{
  await page.goto('/radar.html?v='+BUILD);
  await page.selectOption('#radarMode','lab');
  const value=await page.locator('#candidateFilter option').nth(1).getAttribute('value');
  await page.selectOption('#candidateFilter',value);
  await page.selectOption('#typeFilter','capital_share');
  await expect(page.locator('#copyRadarImage')).toBeDisabled();
  await page.check('#reviewCheck');
  await expect(page.locator('#copyRadarImage')).toBeEnabled();
  await expect(page.locator('#shareRadarBundle')).toBeEnabled();
});

test('Geral e RN geram card LAB sem overflow', async ({page})=>{
  await installCanvasGuard(page);
  await page.goto('/index.html?v='+BUILD);
  await page.selectOption('#modeSelect','lab');
  await resetGuard(page);
  await page.click('#refreshBtn');
  await expect(page.locator('#postText')).not.toHaveValue('');
  await expectNoCanvasOverflow(page);

  await page.goto('/rn.html?v='+BUILD);
  await page.selectOption('#rnMode','lab');
  await resetGuard(page);
  await page.click('#rnRefresh');
  await expect(page.locator('#rnPostText')).not.toHaveValue('');
  await expectNoCanvasOverflow(page);
});

test('Cores de governador são fixas e exclusivas', async ({page})=>{
  await page.goto('/rn.html?v='+BUILD);
  const colors=await page.evaluate(()=>{
    const nums=['13','16','22','27','29','36','44','50','80'];
    return nums.map(n=>candidateColor('',n));
  });
  expect(colors[0]).toBe('#d62828');
  expect(colors[2]).toBe('#2e7d32');
  expect(colors[6]).toBe('#1976d2');
  expect(new Set(colors).size).toBe(colors.length);
});

for(const viewport of [{width:1440,height:900},{width:390,height:844}]){
  test(`Controles flutuantes não se sobrepõem em ${viewport.width}px`, async ({page})=>{
    await page.setViewportSize(viewport);
    for(const path of ['/index.html','/rn.html']){
      await page.goto(path+'?v='+BUILD);
      await page.evaluate(()=>scrollTo(0,1000));
      await page.waitForTimeout(150);
      await noOverlap(page,'.float-refresh','.to-top');
      if(viewport.width<=600) await noOverlap(page,'.float-refresh','.mobile-dock');
    }
  });
}


test('Fonte global do RN sincroniza mapa e consulta municipal', async ({page})=>{
  await page.goto('/rn.html?v='+BUILD);
  await expect(page.locator('#rnSourceTitle')).toHaveText('Oficial TSE');
  await expect(page.locator('#rnSourceBadge')).toHaveText('OFICIAL TSE');
  await expect(page.locator('#rnMunicipalSource')).toHaveText('Oficial TSE');

  await page.selectOption('#rnMode','sim');
  await expect(page.locator('#rnSourceTitle')).toHaveText('Simulado TSE');
  await expect(page.locator('#rnSourceBadge')).toHaveText('SIMULADO TSE');
  await expect(page.locator('#rnMunicipalSource')).toHaveText('Simulado TSE');
  await expect(page.locator('#rnLeaderSummary')).toContainText('Mapa estadual indisponível no Simulado TSE');

  await page.selectOption('#rnMode','lab');
  await expect(page.locator('#rnSourceTitle')).toHaveText('Laboratório UEFY');
  await expect(page.locator('#rnSourceBadge')).toContainText('LAB');
  await expect(page.locator('#rnMunicipalSource')).toHaveText('Laboratório UEFY');
});


test('Textos expandidos não usam limite de 280', async ({page})=>{
  await page.goto('/index.html?v='+BUILD);
  await page.selectOption('#modeSelect','lab');
  await page.click('#refreshBtn');
  await expect(page.locator('#charCount')).toContainText('caracteres');
  await expect(page.locator('#charCount')).not.toContainText('/280');

  await page.goto('/rn.html?v='+BUILD);
  await page.selectOption('#rnMode','lab');
  await page.click('#rnRefresh');
  await expect(page.locator('#rnChars')).toContainText('caracteres');
  await expect(page.locator('#rnChars')).not.toContainText('/280');

  await page.goto('/radar.html?v='+BUILD);
  await page.selectOption('#radarMode','lab');
  const v=await page.locator('#candidateFilter option').nth(1).getAttribute('value');
  await page.selectOption('#candidateFilter',v);
  await page.selectOption('#typeFilter','capital_share');
  await expect(page.locator('#radarChars')).toContainText('caracteres');
  await expect(page.locator('#radarChars')).not.toContainText('/280');
});


test('Modos Completo e Enxuto regeneram os textos sem truncamento', async ({page})=>{
  await page.goto('/index.html?v='+BUILD);
  await page.selectOption('#modeSelect','lab');
  await page.click('#refreshBtn');
  const fullGeneral=await page.locator('#postText').inputValue();
  await page.click('.text-mode-switch [data-text-mode="compact"]');
  const compactGeneral=await page.locator('#postText').inputValue();
  expect(fullGeneral.length-compactGeneral.length).toBeGreaterThan(80);
  expect(fullGeneral).toContain('Atualização:');
  expect(fullGeneral).toContain('1º lugar');

  await page.goto('/rn.html?v='+BUILD);
  await page.selectOption('#rnMode','lab');
  await page.click('#rnRefresh');
  const fullRn=await page.locator('#rnPostText').inputValue();
  await page.click('.text-mode-switch [data-text-mode="compact"]');
  const compactRn=await page.locator('#rnPostText').inputValue();
  expect(fullRn.length-compactRn.length).toBeGreaterThan(80);
  expect(fullRn).toContain('Atualização:');
  expect(fullRn).toContain('1º lugar');

  await page.goto('/radar.html?v='+BUILD);
  await page.selectOption('#radarMode','lab');
  const v=await page.locator('#candidateFilter option').nth(1).getAttribute('value');
  await page.selectOption('#candidateFilter',v);
  await page.selectOption('#typeFilter','capital_share');
  const fullRadar=await page.locator('#radarPostText').inputValue();
  await page.click('.text-mode-switch [data-text-mode="compact"]');
  const compactRadar=await page.locator('#radarPostText').inputValue();
  expect(fullRadar.length-compactRadar.length).toBeGreaterThan(80);
  expect(fullRadar).toContain('Como foi calculado:');
  expect(fullRadar).toContain('Dados do recorte:');
  expect(fullRadar).not.toContain('/280');
});


test('EA20 só declara vencedor com estado oficial do TSE', async ({page})=>{
  await page.goto('/index.html?v='+BUILD);
  const result=await page.evaluate(()=>{
    const fixture=(root,cands)=>({
      dg:'04/10/2026',hg:'20:00:00',tf:root.tf,and:root.and||'p',md:root.md||'n',
      s:{ts:100,st:100,pst:'100,00'},
      carg:[{agr:[{par:[{sg:'TESTE',cand:cands}]}]}]
    });
    mode='official';selectedOffice='gov';selectedScope='uf_rn';
    const partial=parseEA20(fixture({tf:'n',md:'n'},[
      {n:10,nmu:'CANDIDATO A',vap:600,pvap:'60,00',seq:1,e:'n',st:''},
      {n:20,nmu:'CANDIDATO B',vap:400,pvap:'40,00',seq:2,e:'n',st:''}
    ]));
    state.gov=partial;
    const partialOutcome=officialOutcome(partial,'gov','uf_rn');
    const partialText=makePostText();

    const elected=parseEA20(fixture({tf:'n',md:'e'},[
      {n:10,nmu:'CANDIDATO A',vap:600,pvap:'60,00',seq:1,e:'s',st:''},
      {n:20,nmu:'CANDIDATO B',vap:400,pvap:'40,00',seq:2,e:'n',st:''}
    ]));
    const electedOutcome=officialOutcome(elected,'gov','uf_rn');

    const runoff=parseEA20(fixture({tf:'n',md:'s'},[
      {n:10,nmu:'CANDIDATO A',vap:480,pvap:'48,00',seq:1,e:'s',st:''},
      {n:20,nmu:'CANDIDATO B',vap:420,pvap:'42,00',seq:2,e:'s',st:''},
      {n:30,nmu:'CANDIDATO C',vap:100,pvap:'10,00',seq:3,e:'n',st:''}
    ]));
    const runoffOutcome=officialOutcome(runoff,'gov','uf_rn');

    selectedOffice='depf';selectedScope='uf_rn';
    const proportional=parseEA20(fixture({tf:'s',md:''},[
      {n:1010,nmu:'DEPUTADO A',vap:10000,pvap:'10,00',seq:1,e:'s',st:'Eleito por QP'},
      {n:2020,nmu:'DEPUTADO B',vap:9000,pvap:'9,00',seq:2,e:'s',st:'Eleito por média'},
      {n:3030,nmu:'DEPUTADO C',vap:8000,pvap:'8,00',seq:3,e:'n',st:'Suplente'}
    ]));
    const proportionalOutcome=officialOutcome(proportional,'depf','uf_rn');
    return {
      partialKind:partialOutcome.kind,
      partialText,
      electedKind:electedOutcome.kind,
      electedName:electedOutcome.candidates[0]?.name,
      runoffKind:runoffOutcome.kind,
      runoffCount:runoffOutcome.candidates.length,
      proportionalKind:proportionalOutcome.kind,
      proportionalCount:proportionalOutcome.candidates.length
    };
  });
  expect(result.partialKind).toBe('none');
  expect(result.partialText).toContain('APURAÇÃO PARCIAL');
  expect(result.partialText).not.toContain('RESULTADO FINAL');
  expect(result.electedKind).toBe('elected');
  expect(result.electedName).toBe('CANDIDATO A');
  expect(result.runoffKind).toBe('second_round');
  expect(result.runoffCount).toBe(2);
  expect(result.proportionalKind).toBe('elected_multiple');
  expect(result.proportionalCount).toBe(2);
});

test('RN mostra destaque estadual de eleito e segundo turno', async ({page})=>{
  await page.goto('/rn.html?v='+BUILD);
  await page.evaluate(()=>{
    mode='official';
    leaderMapData.outcome={kind:'elected',candidates:[{name:'CANDIDATO TESTE',party:'ABC',pct:55.4}]};
    renderElectionOutcome();
  });
  await expect(page.locator('#rnElectionOutcome')).toBeVisible();
  await expect(page.locator('#rnElectionOutcome')).toContainText('ELEITO');
  await expect(page.locator('#rnElectionOutcome')).toContainText('CANDIDATO TESTE (ABC)');

  await page.evaluate(()=>{
    leaderMapData.outcome={kind:'second_round',candidates:[
      {name:'CANDIDATO A',party:'AAA',pct:45},
      {name:'CANDIDATO B',party:'BBB',pct:40}
    ]};
    renderElectionOutcome();
  });
  await expect(page.locator('#rnElectionOutcome')).toContainText('2º TURNO CONFIRMADO');
  await expect(page.locator('#rnElectionOutcome')).toContainText('CANDIDATO A (AAA)');
  await expect(page.locator('#rnElectionOutcome')).toContainText('CANDIDATO B (BBB)');
});


test('Quadro de revisão do texto é ampliado', async ({page})=>{
  await page.setViewportSize({width:1440,height:900});
  for(const [path,selector] of [['/index.html','#postText'],['/rn.html','#rnPostText'],['/radar.html','#radarPostText']]){
    await page.goto(path+'?v='+BUILD);
    const box=await page.locator(selector).boundingBox();
    expect(box).not.toBeNull();
    expect(box.height).toBeGreaterThanOrEqual(275);
  }
});
