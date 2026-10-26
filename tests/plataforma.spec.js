const {test,expect}=require('@playwright/test'),path=require('node:path');
test.beforeAll(async()=>{await require('node:fs/promises').mkdir(path.resolve(__dirname,'../../../outputs'),{recursive:true})});
test.beforeEach(async({page})=>{await page.route(/^https:\/\//,r=>r.abort())});
async function ready(page){await page.goto('/');await expect(page.locator('#dataStatus')).toContainText('167/167');await expect(page.locator('#download')).toBeEnabled()}
test('plataforma combina filtros, seleção municipal, candidatos e retorno ao RN',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await ready(page);
 await expect(page.locator('#statsMap path')).toHaveCount(167);await expect(page.locator('#changed')).toHaveText('60');await expect(page.locator('video')).toHaveCount(0);await expect(page.locator('script[src*="video"]')).toHaveCount(0);
 await page.selectOption('#metric','candidate_pct');await page.selectOption('#candidate','13');await page.fill('#search','Natal');await expect(page.locator('#municipalRows tr')).toHaveCount(1);await page.locator('#municipalRows button').click();
 await expect(page.locator('#scope')).toHaveText('NATAL');await expect(page.locator('#deltaValue')).toContainText('p.p.');await page.click('#createImage');await expect(page.locator('#imageScope')).toHaveValue('city');
 await page.selectOption('#candidate','22');await expect(page.locator('#view')).toHaveValue('first');await expect(page.locator('#secondValue')).toHaveText('—');await expect(page.locator('#view option[value="delta"]')).toHaveAttribute('disabled','');
 await page.click('#clearCity');await expect(page.locator('#scope')).toHaveText('Rio Grande do Norte');expect(errors).toEqual([]);
});
test('imagens PNG com modelos e dimensões reais; CSV respeita busca',async({page})=>{
 test.setTimeout(90000);await ready(page);
 await page.evaluate(()=>{const orig=URL.createObjectURL;URL.createObjectURL=blob=>{window.imageBlob=blob;return orig(blob)}});
 for(const [template,size] of [['map','1600x900'],['compare','1200x1200'],['card','1080x1350'],['ranking','1600x900']]){
  if(template==='ranking')await page.selectOption('#metric','turnout_pct');
  await page.selectOption('#template',template);await page.selectOption('#size',size);
  const promised=page.waitForEvent('download');await page.click('#download');const download=await promised;expect(download.suggestedFilename()).toMatch(/\.png$/);
  const dest=path.resolve(__dirname,'../../../outputs/exemplo-'+template+'.png');
  // Valida bytes exportados independentemente do gerenciador de downloads do sistema.
  const png=Buffer.from(await page.evaluate(async()=>Array.from(new Uint8Array(await window.imageBlob.arrayBuffer()))));
  expect(png.subarray(1,4).toString()).toBe('PNG');expect(await page.evaluate(()=>window.imageBlob.type)).toBe('image/png');await require('node:fs/promises').writeFile(dest,png);
  const data=await page.evaluate(()=>{const c=document.querySelector('#preview');return {w:c.width,h:c.height,url:c.toDataURL().slice(0,22)}});const [w,h]=size.split('x').map(Number);expect(data).toEqual({w,h,url:'data:image/png;base64,'});
 }
 await page.fill('#search','Natal');await page.evaluate(()=>{const orig=URL.createObjectURL;URL.createObjectURL=blob=>{window.exportBlob=blob;return orig(blob)}});await page.click('#csv');
 const csv=await page.evaluate(()=>window.exportBlob.text());expect(csv).toContain('NATAL');expect(csv).not.toContain('MOSSORÓ');
});
test('dados incompletos bloqueiam comparação e preservam primeiro turno',async({page})=>{
 await page.route('**/data/rn-governador-mapa-2t.json*',r=>r.fulfill({json:{round:2,election_id:'6260',publication_ready:false,leaders:{}}}));
 await page.goto('/');await expect(page.locator('#dataStatus')).toContainText('1º turno disponível');await expect(page.locator('#view')).toHaveValue('first');await expect(page.locator('#changed')).toHaveText('—');
 await page.selectOption('#template','compare');await expect(page.locator('#download')).toBeDisabled();await page.selectOption('#template','map');await expect(page.locator('#download')).toBeEnabled();
});
test('erro posterior mantém última base conferida e filtro vazio bloqueia PNG',async({page})=>{
 await ready(page);await page.route('**/data/rn-analises.json*',r=>r.fulfill({status:503,body:'offline'}));await page.click('#refresh');await expect(page.locator('#dataStatus')).toContainText('Mantendo');await expect(page.locator('#changed')).toHaveText('60');
 await page.fill('#search','cidade inexistente');await expect(page.locator('#download')).toBeDisabled();await expect(page.locator('#rowCount')).toHaveText('0 de 167 municípios');
});
test('layout móvel mantém largura, campos e exportação acessíveis',async({page})=>{
 await ready(page);for(const width of [320,390,768,1440]){await page.setViewportSize({width,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(2)}
 await page.setViewportSize({width:390,height:844});await page.selectOption('#metric','turnout_pct');await page.selectOption('#palette','dark');await page.locator('#estudio').scrollIntoViewIfNeeded();await page.screenshot({path:path.resolve(__dirname,'../../../outputs/plataforma-celular.png')});
 await page.setViewportSize({width:1440,height:1000});await page.goto('/');await expect(page.locator('#changed')).toHaveText('60');await page.screenshot({path:path.resolve(__dirname,'../../../outputs/plataforma-desktop.png')});
});
