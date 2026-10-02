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

test('Radar Legislativo LAB gera mapas e resultado municipal em todos os cargos', async ({page})=>{
  await installCanvasGuard(page);
  await page.goto('/radar.html?v='+BUILD);
  await page.selectOption('#radarMode','lab');
  await expect(page.locator('#radarStatus')).toContainText('LABORATÓRIO UEFY');

  for(const office of ['sen','depf','depe']){
    await page.selectOption('#officeFilter',office);
    await expect(page.locator('#radarLegMap .radar-map-feature')).toHaveCount(167);
    await expect(page.locator('#radarLeaderSummary')).not.toContainText('Aguardando votos');
    await expect(page.locator('#radarMapPublish')).toBeEnabled();

    await page.selectOption('#radarMunicipality',{label:'Natal'});
    await expect(page.locator('#radarMunicipalResults .radar-municipal-row').first()).toBeVisible();
    await expect(page.locator('#radarMunicipalPublish')).toBeEnabled();

    await resetGuard(page);
    await page.click('#radarMapPublish');
    await expect(page.locator('#radarPostText')).not.toHaveValue('');
    await expect(page.locator('#publicationContextTitle')).toContainText('Mapa legislativo');
    await expectNoCanvasOverflow(page);

    await resetGuard(page);
    await page.click('#radarMunicipalPublish');
    await expect(page.locator('#publicationContextTitle')).toContainText('Natal');
    await expectNoCanvasOverflow(page);
  }
});

test('Radar mantém análises adicionais sem controlar a navegação principal', async ({page})=>{
  await page.goto('/radar.html?v='+BUILD);
  await page.selectOption('#radarMode','lab');
  await page.locator('#analises').evaluate(el=>el.open=true);
  const candidate=await page.locator('#candidateFilter option').nth(1).getAttribute('value');
  await page.selectOption('#candidateFilter',candidate);
  await page.selectOption('#typeFilter','capital_share');
  await expect(page.locator('#findingCount')).not.toContainText('0 análise');
  await expect(page.locator('#findingsGrid .finding-card').first()).toBeVisible();
  await expect(page.locator('#radarMapPublish')).toBeEnabled();
  await expect(page.locator('#radarMunicipalPublish')).toBeEnabled();
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
    for(const path of ['/index.html','/rn.html','/radar.html']){
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
  await page.click('#radarMapPublish');
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
  expect(compactGeneral.length).toBeLessThan(fullGeneral.length*0.7);
  expect(fullGeneral).toContain('Atualização:');
  expect(fullGeneral).toContain('1º lugar');

  await page.goto('/rn.html?v='+BUILD);
  await page.selectOption('#rnMode','lab');
  await page.click('#rnRefresh');
  const fullRn=await page.locator('#rnPostText').inputValue();
  await page.click('.text-mode-switch [data-text-mode="compact"]');
  const compactRn=await page.locator('#rnPostText').inputValue();
  expect(fullRn.length-compactRn.length).toBeGreaterThan(80);
  expect(compactRn.length).toBeLessThan(fullRn.length*0.7);
  expect(fullRn).toContain('Atualização:');
  expect(fullRn).toContain('1º lugar');

  await page.goto('/radar.html?v='+BUILD);
  await page.selectOption('#radarMode','lab');
  await page.click('#radarMapPublish');
  const fullRadar=await page.locator('#radarPostText').inputValue();
  await page.click('.text-mode-switch [data-text-mode="compact"]');
  const compactRadar=await page.locator('#radarPostText').inputValue();
  expect(fullRadar.length-compactRadar.length).toBeGreaterThan(80);
  expect(compactRadar.length).toBeLessThan(fullRadar.length*0.7);
  expect(fullRadar).toContain('Base municipal:');
  expect(fullRadar).toContain('Natal:');
  expect(compactRadar).not.toContain('Base municipal:');
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


test('Mapa RN também diferencia Completo de Enxuto', async ({page})=>{
  await page.goto('/rn.html?v='+BUILD);
  const sizes=await page.evaluate(()=>{
    mode='official';
    mapPublicationMode=true;
    leaderMapData={
      final_result:false,
      source_generated_at:'02/10/2026 · 19:00:00',
      municipalities_read:167,municipalities_expected:167,
      outcome:{kind:'none',candidates:[]},
      summary:[
        {name:'CANDIDATO A',number:'10',municipalities:70},
        {name:'CANDIDATO B',number:'20',municipalities:55},
        {name:'CANDIDATO C',number:'30',municipalities:25},
        {name:'CANDIDATO D',number:'40',municipalities:10},
        {name:'CANDIDATO E',number:'50',municipalities:5},
        {name:'CANDIDATO F',number:'60',municipalities:2}
      ],
      natal:{status:'ok',candidate:'CANDIDATO A',candidate_number:'10'}
    };
    publicationTextMode='full';
    const full=mapPostText();
    publicationTextMode='compact';
    const compact=mapPostText();
    return {full,compact};
  });
  expect(sizes.full).toContain('Base municipal:');
  expect(sizes.full).toContain('Natal:');
  expect(sizes.compact).not.toContain('Base municipal:');
  expect(sizes.compact).not.toContain('Natal:');
  expect(sizes.compact.length).toBeLessThan(sizes.full.length*0.7);
});

test('Resultado eleito mantém versões editorialmente diferentes', async ({page})=>{
  await page.goto('/index.html?v='+BUILD);
  const sizes=await page.evaluate(()=>{
    mode='official';selectedOffice='gov';selectedScope='uf_rn';
    state.gov={
      progress:92.4,finalTotalization:false,mathematicallyDefined:'e',generatedAt:'02/10/2026 · 19:05:00',
      candidates:[
        {id:'10',number:'10',name:'CANDIDATO A',party:'AAA',pct:54.2,votes:540000,elected:'s',totalizationStatus:''},
        {id:'20',number:'20',name:'CANDIDATO B',party:'BBB',pct:40.1,votes:399000,elected:'n',totalizationStatus:''},
        {id:'30',number:'30',name:'CANDIDATO C',party:'CCC',pct:5.7,votes:57000,elected:'n',totalizationStatus:''}
      ]
    };
    publicationTextMode='full';const full=makePostText();
    publicationTextMode='compact';const compact=makePostText();
    return {full,compact};
  });
  expect(sizes.full).toContain('Eleição matematicamente definida');
  expect(sizes.full).toContain('votos');
  expect(sizes.compact).toContain('ELEITO');
  expect(sizes.compact).not.toContain('matematicamente definida');
  expect(sizes.compact.length).toBeLessThan(sizes.full.length*0.7);
});


test('Todas as páginas têm atualizar e voltar ao topo', async ({page})=>{
  for(const path of ['/index.html','/rn.html','/radar.html']){
    await page.goto(path+'?v='+BUILD);
    await expect(page.locator('#refreshAll')).toBeAttached();
    await expect(page.locator('#toTop')).toBeAttached();
  }
});

test('Navegação usa nomes coerentes com as áreas', async ({page})=>{
  await page.goto('/index.html?v='+BUILD);
  await expect(page.locator('.nav')).toContainText('Apuração geral');
  await expect(page.locator('.nav')).toContainText('Governador RN');
  await expect(page.locator('.nav')).toContainText('Legislativo RN');

  await page.goto('/radar.html?v='+BUILD);
  await expect(page.locator('.nav a.active')).toHaveText('Legislativo RN');
});


test('Senado alterna 1º e 2º colocado no mapa sem confundir com eleito', async ({page})=>{
  await page.goto('/radar.html?v='+BUILD);
  await page.selectOption('#radarMode','lab');
  await page.selectOption('#officeFilter','sen');
  await expect(page.locator('#senateRankSwitch')).toBeVisible();
  await expect(page.locator('#radarMapExplanation')).toContainText('duas vagas');
  await expect(page.locator('#radarElectoralNote')).toContainText('dois candidatos mais votados no estado');

  const firstSummary=await page.locator('#radarLeaderSummary').innerText();
  await page.click('#senateRankSwitch [data-senate-rank="2"]');
  await expect(page.locator('#radarMapTitle')).toContainText('2ª maior');
  await expect(page.locator('#radarLeaderSummary')).toContainText('2º');
  const secondSummary=await page.locator('#radarLeaderSummary').innerText();
  expect(secondSummary).not.toBe(firstSummary);

  await page.click('#radarMapPublish');
  const text=await page.locator('#radarPostText').inputValue();
  expect(text).toContain('2º COLOCADO');
  expect(text).toContain('dois candidatos mais votados no estado');
});

test('Mapas de deputados deixam claro que votação municipal não define eleição', async ({page})=>{
  await page.goto('/radar.html?v='+BUILD);
  await page.selectOption('#radarMode','lab');
  for(const office of ['depf','depe']){
    await page.selectOption('#officeFilter',office);
    await expect(page.locator('#senateRankSwitch')).toBeHidden();
    await expect(page.locator('#radarMapExplanation')).toContainText('não indica candidatura eleita');
    await expect(page.locator('#radarElectoralNote')).toContainText('sistema proporcional');
    await page.click('#radarMapPublish');
    const text=await page.locator('#radarPostText').inputValue();
    expect(text).toContain('sistema proporcional');
    expect(text).toContain('não equivale a eleição');
  }
});

for(const viewport of [{width:1440,height:900},{width:390,height:844}]){
  test(\`Simulação operacional de domingo em \${viewport.width}px\`, async ({page})=>{
    await page.setViewportSize(viewport);

    await page.goto('/index.html?v='+BUILD);
    await page.selectOption('#modeSelect','lab');
    for(const office of ['pres','gov','sen','depf','depe']){
      await page.selectOption('#officeSelect',office);
      await page.click('#refreshBtn');
      await expect(page.locator('#postText')).not.toHaveValue('');
      await expect(page.locator('#shareCanvas')).toBeVisible();
    }
    await expect(page.locator('#refreshAll')).toBeAttached();
    await expect(page.locator('#toTop')).toBeAttached();

    await page.goto('/rn.html?v='+BUILD);
    await page.selectOption('#rnMode','lab');
    await page.click('#rnRefresh');
    await expect(page.locator('#rnPostText')).not.toHaveValue('');
    await expect(page.locator('#rnCanvas')).toBeVisible();
    await expect(page.locator('#refreshAll')).toBeAttached();
    await expect(page.locator('#toTop')).toBeAttached();

    await page.goto('/radar.html?v='+BUILD);
    await page.selectOption('#radarMode','lab');
    for(const office of ['sen','depf','depe']){
      await page.selectOption('#officeFilter',office);
      await page.selectOption('#radarMunicipality',{label:'Natal'});
      await expect(page.locator('#radarMunicipalResults .radar-municipal-row').first()).toBeVisible();
      await page.click('#radarMunicipalPublish');
      await expect(page.locator('#radarPostText')).not.toHaveValue('');
      await expect(page.locator('#radarCanvas')).toBeVisible();
    }
    await expect(page.locator('#copyRadarText')).toBeEnabled();
    await expect(page.locator('#copyRadarImage')).toBeEnabled();
    await expect(page.locator('#openRadarX')).toBeEnabled();
    await expect(page.locator('#shareRadarBundle')).toBeEnabled();
    await expect(page.locator('#refreshAll')).toBeAttached();
    await expect(page.locator('#toTop')).toBeAttached();
  });
}
