const {test,expect}=require('@playwright/test');

/* Boletins deste arquivo são exclusivamente fixtures interceptadas pelo navegador.
 * Nunca são copiados para data/ nem para páginas de produção.
 */
const rnRegistry={rn:{candidates:[
  {cargo:3,numero:'44',nome:'ALLYSON BEZERRA',partido:'UNIÃO BRASIL'},
  {cargo:3,numero:'13',nome:'CADU DE LULA',partido:'PT'}
]}};
const brRegistry={source:'TSE/AGEL - Candidatos 2026',pres:[
  {numero:'22',nome:'FLÁVIO BOLSONARO',partido:'PL'},
  {numero:'13',nome:'LULA',partido:'PT'}
]};
function ea20(key,invalid=false){
 const rn=key==='rn';const a=rn?'44':'22';
 return {
   ele:rn?'6260':'6258',t:'2',f:'o',cdabr:key,dg:'25/10/2026',hg:'17:21:00',tf:'n',
   s:{pst:'50,00',st:500,ts:1000},
   carg:[{cd:rn?3:1,agr:[{par:[
     {sg:rn?'UNIÃO':'PL',cand:[{n:a,nmu:rn?'ALLYSON BEZERRA':'FLÁVIO BOLSONARO',vap:520000,pvap:invalid?'62,00':'52,00',dvt:'Válido'}]},
     {sg:'PT',cand:[{n:'13',nmu:rn?'CADU DE LULA':'LULA',vap:480000,pvap:'48,00',dvt:'Válido'}]}
   ]}]}]
 };
}
async function mockOfficial(page,invalidRN=false){
 await page.route('**/data/candidatos-ufs-c.json',route=>route.fulfill({json:rnRegistry}));
 await page.route('**/data/candidatos-2026.json',route=>route.fulfill({json:brRegistry}));
 await page.route('**/6260/dados/rn/rn-c0003-e006260-u.json',route=>route.fulfill({json:ea20('rn',invalidRN),headers:{'access-control-allow-origin':'*'}}));
 await page.route('**/6258/dados/br/br-c0001-e006258-u.json',route=>route.fulfill({json:ea20('br'),headers:{'access-control-allow-origin':'*'}}));
}
test('antes das 17h mostra candidaturas e nenhum voto',async({page})=>{
 await page.clock.install({time:new Date('2026-10-25T19:30:00Z')});
 await page.goto('/estudio-live.html');
 await expect(page.locator('#pct0')).toHaveText('—');
 await expect(page.locator('#votes0')).toHaveText('AGUARDANDO VOTOS');
 await expect(page.locator('#screenResultState')).toContainText('AGUARDANDO DIVULGAÇÃO');
 await expect(page.locator('#captureLink')).toHaveAttribute('href',/capture=1/);
});
test('somente boletim EA20 conciliado libera votos; alterna Brasil e RN',async({page})=>{
 await page.clock.install({time:new Date('2026-10-25T20:30:00Z')});
 await mockOfficial(page);
 await page.goto('/estudio-live.html');
 await expect(page.locator('#pct0')).toHaveText('52,00%');
 await expect(page.locator('#votes0')).toHaveText('520.000 VOTOS');
 await expect(page.locator('#progressValue')).toHaveText('50,00%');
 await expect(page.locator('#screenResultState')).toContainText('PARCIAL');
 await page.locator('#scopeBr').click();
 await expect(page.locator('#name0')).toHaveText('FLÁVIO BOLSONARO');
 await expect(page.locator('#pct1')).toHaveText('48,00%');
 await page.locator('#sceneOverview').click();
 await expect(page.locator('#overviewVotes')).toHaveText('1.000.000');
 await expect(page.locator('#overviewGap')).toHaveText('4,00 pp');
});
test('desacordo nos percentuais oculta votos do cargo afetado',async({page})=>{
 await page.clock.install({time:new Date('2026-10-25T20:30:00Z')});
 await mockOfficial(page,true);
 await page.goto('/estudio-live.html');
 await expect(page.locator('#screenResultState')).toHaveText('DADOS NÃO CONFIRMADOS');
 await expect(page.locator('#pct0')).toHaveText('—');
 await page.locator('#scopeBr').click();
 await expect(page.locator('#pct0')).toHaveText('52,00%');
});
test('saída OBS captura arte sem controles na resolução Full HD',async({page})=>{
 await page.setViewportSize({width:1920,height:1080});
 await page.clock.install({time:new Date('2026-10-25T19:30:00Z')});
 await page.goto('/estudio-live.html?capture=1&auto=0');
 await expect(page.locator('.control-desk')).toBeHidden();
 await expect(page.locator('#broadcastViewport')).toHaveCSS('width','1920px');
 await expect(page.locator('#broadcastViewport')).toHaveCSS('height','1080px');
 await expect(page.locator('#broadcast')).toBeVisible();
});

test('TSE define matematicamente o eleito antes de 100%: placar, panorama e captura OBS',async({page})=>{
 await page.clock.install({time:new Date('2026-10-25T23:30:00Z')});
 await page.route('**/data/candidatos-ufs-c.json',route=>route.fulfill({json:rnRegistry}));
 await page.route('**/data/candidatos-2026.json',route=>route.fulfill({json:brRegistry}));
 await page.route('**/6260/dados/rn/rn-c0003-e006260-u.json',route=>{
   const data=ea20('rn');data.md='e';data.s.pst='92,50';data.carg[0].agr[0].par[0].cand[0].e='s';
   return route.fulfill({json:data,headers:{'access-control-allow-origin':'*'}});
 });
 await page.route('**/6258/dados/br/br-c0001-e006258-u.json',route=>route.fulfill({json:ea20('br'),headers:{'access-control-allow-origin':'*'}}));
 await page.goto('/estudio-live.html?capture=1&auto=0');
 await expect(page.locator('#screenResultState')).toHaveText('ELEITO DEFINIDO / TSE');
 await expect(page.locator('#bulletinTitle')).toHaveText('Eleição matematicamente definida');
 await expect(page.locator('#bulletinText')).toContainText('ALLYSON BEZERRA');
 await expect(page.locator('#candidate0 .candidate-kicker')).toHaveText('ELEITO · CONFIRMADO PELO TSE');
 await expect(page.locator('#candidate1 .candidate-kicker')).toHaveText('CANDIDATURA 02');
 await expect(page.locator('#progressValue')).toHaveText('92,50%');
 await expect(page.locator('#screenEdition')).toHaveText('ELEIÇÃO DEFINIDA · TSE');
 await page.evaluate(()=>document.querySelector('[data-scene="panorama"]').click());
 await expect(page.locator('#overviewHeadline')).toContainText('Eleição definida');
 await expect(page.locator('#overviewCopy')).toContainText('ALLYSON BEZERRA');
 await expect(page.locator('#broadcast')).toHaveAttribute('data-decision','elected');
});
test('marcação de candidato sem md=e ou totalização final não anuncia eleito',async({page})=>{
 await page.clock.install({time:new Date('2026-10-25T23:30:00Z')});
 await page.route('**/data/candidatos-ufs-c.json',route=>route.fulfill({json:rnRegistry}));
 await page.route('**/data/candidatos-2026.json',route=>route.fulfill({json:brRegistry}));
 await page.route('**/6260/dados/rn/rn-c0003-e006260-u.json',route=>{
   const data=ea20('rn');data.md='n';data.carg[0].agr[0].par[0].cand[0].e='s';
   return route.fulfill({json:data,headers:{'access-control-allow-origin':'*'}});
 });
 await page.route('**/6258/dados/br/br-c0001-e006258-u.json',route=>route.fulfill({json:ea20('br'),headers:{'access-control-allow-origin':'*'}}));
 await page.goto('/estudio-live.html?capture=1&auto=0');
 await expect(page.locator('#screenResultState')).toHaveText('APURAÇÃO PARCIAL / TSE');
 await expect(page.locator('#candidate0 .candidate-kicker')).not.toContainText('ELEITO');
});
test('EA20 com eleição concluída mantém resultado final e identifica eleito confirmado',async({page})=>{
 await page.clock.install({time:new Date('2026-10-25T23:30:00Z')});
 await page.route('**/data/candidatos-ufs-c.json',route=>route.fulfill({json:rnRegistry}));
 await page.route('**/data/candidatos-2026.json',route=>route.fulfill({json:brRegistry}));
 await page.route('**/6260/dados/rn/rn-c0003-e006260-u.json',route=>{
   const data=ea20('rn');data.md='e';data.tf='s';data.s.pst='100,00';data.s.st=1000;
   data.carg[0].agr[0].par[0].cand[0].e='s';
   return route.fulfill({json:data,headers:{'access-control-allow-origin':'*'}});
 });
 await page.route('**/6258/dados/br/br-c0001-e006258-u.json',route=>route.fulfill({json:ea20('br'),headers:{'access-control-allow-origin':'*'}}));
 await page.goto('/estudio-live.html?capture=1&auto=0');
 await expect(page.locator('#screenResultState')).toHaveText('RESULTADO FINAL / TSE');
 await expect(page.locator('#candidate0 .candidate-kicker')).toContainText('ELEITO');
 await expect(page.locator('#progressValue')).toHaveText('100,00%');
});
