const {test,expect}=require('@playwright/test'),path=require('node:path'),fs=require('node:fs/promises');
const out=path.resolve(__dirname,'../../../outputs');
test.beforeAll(async()=>fs.mkdir(out,{recursive:true}));
test.beforeEach(async({page})=>{await page.route(/^https:\/\//,r=>r.abort())});
async function ready(page){await page.goto('/');await expect(page.locator('#shareX')).toBeEnabled()}
test('pautas prontas produzem legendas distintas e casos vazios publicáveis',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await ready(page);
 await page.selectOption('#publication','same');await expect(page.locator('#supportText')).toHaveValue(/107 municípios mantiveram/);await expect(page.locator('#rowCount')).toHaveText('107 de 167 municípios');
 await page.selectOption('#publication','44-13');await expect(page.locator('#supportText')).toHaveValue(/31 municípios, Allyson Bezerra.*Cadu de Lula/);await expect(page.locator('#group')).toHaveValue('44-13');
 await page.selectOption('#publication','from-22');await expect(page.locator('#supportText')).toHaveValue(/29 municípios.*14 tiveram Cadu e 15 Allyson/);
 await page.selectOption('#publication','13-44');await expect(page.locator('#supportText')).toHaveValue(/nenhum município/);await expect(page.locator('#download')).toBeEnabled();await expect(page.locator('#shareX')).toBeEnabled();
 expect(errors).toEqual([]);
});
test('listas trocam PNG e legenda por parte, com nomes de todos os municípios',async({page})=>{
 await ready(page);await page.selectOption('#publication','same');await page.selectOption('#size','1200x1200');await page.selectOption('#captionStyle','names');await expect(page.locator('#template')).toHaveValue('list');await expect(page.locator('#partLabel')).toHaveText('Parte 1 de 27');
 await expect(page.locator('#shareX')).toBeEnabled();const first=await page.locator('#preview').evaluate(c=>c.toDataURL());await page.click('#nextPart');await expect(page.locator('#supportText')).toHaveValue(/parte 2\/27/);await expect(page.locator('#partLabel')).toHaveText('Parte 2 de 27');expect(await page.locator('#preview').evaluate(c=>c.toDataURL())).not.toBe(first);
 for(let i=2;i<27;i++)await page.click('#nextPart');await expect(page.locator('#partLabel')).toHaveText('Parte 27 de 27');await expect(page.locator('#nextPart')).toBeDisabled();
 await page.selectOption('#publication','44-13');await page.selectOption('#size','1200x1200');await expect(page.locator('#partLabel')).toHaveText('Parte 1 de 8');await page.locator('#preview').evaluate(c=>c.toDataURL()).then(async url=>fs.writeFile(path.join(out,'exemplo-lista-municipios.png'),Buffer.from(url.split(',')[1],'base64')));
});
test('compartilhamento móvel envia PNG e texto editado no gesto de clique',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.addInitScript(()=>{
 Object.defineProperty(navigator,'canShare',{configurable:true,value:({files})=>files?.length===1&&files[0].type==='image/png'});
 Object.defineProperty(navigator,'share',{configurable:true,value:data=>{window.shared={text:data.text,name:data.files[0].name,type:data.files[0].type,size:data.files[0].size,active:navigator.userActivation.isActive};return Promise.resolve()}});
 });await ready(page);await expect(page.locator('#imageSettings')).not.toHaveAttribute('open','');await page.selectOption('#publication','44-13');
 const caption='Governador do RN: 31 cidades passaram da liderança de Allyson no 1º turno para Cadu no 2º. Fonte: TSE, 2026.';await page.fill('#supportText',caption);await page.click('#shareX');
 expect(await page.evaluate(()=>window.shared)).toMatchObject({text:caption,type:'image/png',active:true});expect((await page.evaluate(()=>window.shared)).size).toBeGreaterThan(10000);
 await expect(page.locator('#exportStatus')).toContainText('Conteúdo entregue');await expect(page.locator('#shareX')).toBeEnabled();
});
test('fallback abre X com legenda e arquivo, e cancelamento não abre outra janela',async({page})=>{
 await page.addInitScript(()=>{Object.defineProperty(navigator,'share',{configurable:true,value:undefined});window.open=url=>{window.opened=url;return null}});await ready(page);await page.selectOption('#publication','22-44');const download=page.waitForEvent('download');await page.click('#shareX');expect((await download).suggestedFilename()).toContain('22-44');const url=new URL(await page.evaluate(()=>window.opened));expect(url.hostname).toBe('x.com');expect(url.searchParams.get('text')).toBe(await page.inputValue('#supportText'));await expect(page.locator('#exportStatus')).toContainText('Anexe o PNG');
 await page.evaluate(()=>{window.opened=null;Object.defineProperty(navigator,'canShare',{configurable:true,value:()=>true});Object.defineProperty(navigator,'share',{configurable:true,value:()=>Promise.reject(new DOMException('Cancelado','AbortError'))})});
 await page.click('#shareX');await expect(page.locator('#exportStatus')).toContainText('Compartilhamento cancelado');expect(await page.evaluate(()=>window.opened)).toBeNull();
});
test('legenda longa bloqueia compartilhar, edição sobrevive à mudança de visual',async({page})=>{
 await ready(page);await page.fill('#supportText','a'.repeat(281));await expect(page.locator('#shareX')).toBeDisabled();await expect(page.locator('#openX')).toHaveAttribute('aria-disabled','true');
 await page.fill('#supportText','Texto editado pelo usuário.');await page.selectOption('#palette','dark');await expect(page.locator('#supportText')).toHaveValue('Texto editado pelo usuário.');await expect(page.locator('#shareX')).toBeEnabled();
 await page.click('#regenerateText');await expect(page.locator('#supportText')).toHaveValue(/Governador do RN:/);
});
test('celular: atalhos fixos, cartões legíveis e ações com espaço para toque',async({page})=>{
 await page.setViewportSize({width:390,height:844});await ready(page);await expect(page.locator('.mobile-bottom-nav')).toBeVisible();await page.locator('.mobile-bottom-nav a[href="#estudio"]').click();await page.selectOption('#publication','same');await page.selectOption('#captionStyle','names');
 for(const width of [320,360,390,430,600,768,1440]){await page.setViewportSize({width,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(2)}
 await page.setViewportSize({width:390,height:844});const taps=await page.locator('.publish-actions .button,.mobile-bottom-nav a').evaluateAll(nodes=>nodes.map(n=>({h:n.getBoundingClientRect().height,w:n.getBoundingClientRect().width})));for(const t of taps){expect(t.h).toBeGreaterThanOrEqual(44);expect(t.w).toBeGreaterThanOrEqual(44)}
 await page.locator('.publication-panel').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(out,'publicacao-celular.png')});
 await page.locator('#preview').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(out,'lista-celular.png')});
});
test('panorama das transições gera quadro com totais e texto comparativo',async({page})=>{
 await ready(page);await page.selectOption('#publication','overview');await expect(page.locator('#template')).toHaveValue('routes');await expect(page.locator('#supportText')).toHaveValue(/31 foram de Allyson para Cadu/);await expect(page.locator('#shareX')).toBeEnabled();
 await page.locator('#preview').evaluate(c=>c.toDataURL()).then(async url=>fs.writeFile(path.join(out,'exemplo-trocas-candidatos.png'),Buffer.from(url.split(',')[1],'base64')));
});

test('link direto abre o estúdio após o carregamento das tabelas',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/#estudio');await expect(page.locator('#shareX')).toBeEnabled();
 await expect.poll(()=>page.locator('#estudio').evaluate(n=>Math.abs(n.getBoundingClientRect().top))).toBeLessThan(50);
});
