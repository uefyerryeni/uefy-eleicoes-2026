const {test,expect}=require('@playwright/test');
const first=require('../data/rn-analises.json');
const snapshot=()=>({round:2,election_ids:{gov:'6260',pres:'6258'},publication_ready:true,municipalities_read:167,errors:[],source_generated_at:'FIXTURE DE TESTE',state:{gov:{...first.participation.state_2026.gov,complete:true},pres:{...first.participation.state_2026.pres,complete:true}},municipalities:first.cross.municipalities.map(r=>({code:r.code,gov:{...r.participation.governor},pres:{...r.participation.president}}))});
test.beforeEach(async({page})=>{await page.route(/^https:\/\//,r=>r.abort())});
test('feed bloqueado com base pendente',async({page})=>{
 await page.route('**/data/entre-turnos-2t.json*',r=>r.fulfill({json:require('./fixtures/entre-turnos-2t.json')}));
 await page.goto('/entre-turnos.html');await page.waitForFunction(()=>window.__entreTurnos?.rows===167);
 await expect(page.locator('#etFeedDownload')).toBeDisabled();await expect(page.locator('#etFeedShare')).toBeDisabled();await expect(page.locator('#etFeedCopy')).toBeDisabled();
 await expect(page.locator('#etFeedCaption')).toHaveValue(/aguardando/);
});
test('feed estadual acompanha cidade e indicador, compartilha arquivo e bloqueia falha de rede',async({page})=>{
 let offline=false;await page.route('**/data/entre-turnos-2t.json*',r=>offline?r.abort():r.fulfill({json:snapshot()}));
 await page.addInitScript(()=>{Object.defineProperty(navigator,'canShare',{value:()=>true});Object.defineProperty(navigator,'share',{value:data=>{window.sentFeed={text:data.text,name:data.files[0].name,type:data.files[0].type,size:data.files[0].size};return Promise.resolve()}})});
 await page.goto('/entre-turnos.html');await page.waitForFunction(()=>window.__entreTurnos?.feedReady);
 await expect(page.locator('#etFeedCaption')).toHaveValue(/TOTAL ESTADUAL|Total estadual/);
 await expect(page.locator('#etFeedCaption')).toHaveValue(/Votos nulos/);
 await page.selectOption('#etCity','NATAL');await expect(page.locator('#etFeedCaption')).toHaveValue(/Recorte municipal: NATAL/);
 await page.selectOption('#etMetric','pres_blank_pct');await page.selectOption('#etFeedMode','indicator');
 await expect(page.locator('#etFeedCaption')).toHaveValue(/Votos brancos para Presidente/);
 await page.click('#etFeedShare');
 const sent=await page.evaluate(()=>window.sentFeed);expect(sent.name).toContain('natal-pres_blank_pct');expect(sent.text).toContain('NATAL');expect(sent.size).toBeGreaterThan(10000);
 expect(await page.locator('#etFeedCanvas').getAttribute('width')).toBe('1080');
 await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
 require('fs').writeFileSync('../feed-indicador-teste.png',Buffer.from((await page.locator('#etFeedCanvas').evaluate(c=>c.toDataURL('image/png'))).split(',')[1],'base64'));
 await page.selectOption('#etFeedMode','summary');await page.selectOption('#etCity','');await page.setViewportSize({width:1440,height:1000});require('fs').writeFileSync('../feed-resumo-teste.png',Buffer.from((await page.locator('#etFeedCanvas').evaluate(c=>c.toDataURL('image/png'))).split(',')[1],'base64'));
 offline=true;await page.click('#etRefresh');await expect(page.locator('#etFeedDownload')).toBeDisabled();await expect(page.locator('#etFeedStatus')).toContainText('bloqueada');
});
test('resumo estadual final de Governador independe da Presidencia e respeita o cargo selecionado',async({page})=>{
 const data=snapshot();data.publication_ready=false;data.municipalities_read=0;data.municipalities=[];data.state.pres.complete=false;
 data.state.gov.source_generated_at='BOLETIM FINAL GOVERNADOR';
 await page.route('**/data/entre-turnos-2t.json*',r=>r.fulfill({json:data}));
 await page.goto('/entre-turnos.html#publicar');await page.waitForFunction(()=>window.__entreTurnos?.feedReady);
 expect(await page.evaluate(()=>window.__entreTurnos.ready)).toBe(false);
 await expect(page.locator('#etFeedDownload')).toBeEnabled();await expect(page.locator('#etFeedCaption')).toHaveValue(/BOLETIM FINAL GOVERNADOR/);
 await page.selectOption('#etCity','NATAL');await expect(page.locator('#etFeedDownload')).toBeDisabled();
 await page.click('#etFeedState');await expect(page.locator('#etFeedDownload')).toBeEnabled();
 await page.selectOption('#etMetric','pres_blank_pct');await page.selectOption('#etFeedMode','indicator');await expect(page.locator('#etFeedDownload')).toBeDisabled();
 await page.selectOption('#etMetric','gov_blank_pct');await expect(page.locator('#etFeedDownload')).toBeEnabled();
});
