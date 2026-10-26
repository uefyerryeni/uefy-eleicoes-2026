const {test,expect}=require('@playwright/test');
const first=require('../data/rn-analises.json');
function finalSnapshot(){
 const convert=p=>({...p,complete:true,turnout_pct:p.turnout_pct+1});
 return {round:2,election_ids:{gov:'6260',pres:'6258'},publication_ready:true,municipalities_read:167,errors:[],
 state:{gov:convert(first.participation.state_2026.gov),pres:convert(first.participation.state_2026.pres)},
 municipalities:first.cross.municipalities.map(r=>({code:r.code,gov:convert(r.participation.governor),pres:convert(r.participation.president)}))};
}
test.beforeEach(async({page})=>{await page.route(/^https:\/\//,r=>r.abort())});
test('mapas entre turnos, variacao em pontos e CSV filtrado',async({page})=>{
 await page.route('**/data/entre-turnos-2t.json*',r=>r.fulfill({json:finalSnapshot()}));
 await page.goto('/entre-turnos.html?municipio=Natal');await page.waitForFunction(()=>window.__entreTurnos?.ready);
 await expect(page.locator('#etScopeTitle')).toHaveText('NATAL');
 await page.selectOption('#etView','delta');await expect(page.locator('#etFocusValue')).toHaveText('+1,00 p.p.');
 await expect(page.locator('#etMap .et-city')).toHaveCount(167);
 await page.selectOption('#etView','second');await expect(page.locator('#etFocusValue')).not.toHaveText('—');
 await page.selectOption('#etSort','first_desc');
 const names=await page.locator('#etTableBody tr td:first-child').allTextContents();
 const expected=[...first.cross.municipalities].sort((a,b)=>b.participation.turnout_pct-a.participation.turnout_pct||a.name.localeCompare(b.name,'pt-BR'));
 expect(names[0]).toBe(expected[0].name);
 await page.fill('#etSearch','Natal');await page.evaluate(()=>{const original=URL.createObjectURL;URL.createObjectURL=blob=>{window.csvBlob=blob;return original(blob)}});await page.click('#etCsvAll');
 const csv=await page.evaluate(()=>window.csvBlob.text());
 expect(csv).toContain('pontos percentuais');expect(csv).toContain('NATAL');expect(csv).not.toContain('PARNAMIRIM');
 expect(csv.trim().split('\r\n')).toHaveLength(20);
});
test('falha de rede preserva comparacao carregada',async({page})=>{
 let fail=false;await page.route('**/data/entre-turnos-2t.json*',r=>fail?r.fulfill({status:503,body:'offline'}):r.fulfill({json:finalSnapshot()}));
 await page.goto('/entre-turnos.html');await page.waitForFunction(()=>window.__entreTurnos?.ready);
 const before=await page.locator('#etSecondValue').textContent();fail=true;await page.click('#etRefresh');
 await expect(page.locator('#etUpdateStatus')).toContainText('Mantendo');await expect(page.locator('#etSecondValue')).toHaveText(before);
});
test('municipio duplicado bloqueia liberacao',async({page})=>{
 const data=finalSnapshot();data.municipalities[1]=data.municipalities[0];
 await page.route('**/data/entre-turnos-2t.json*',r=>r.fulfill({json:data}));
 await page.goto('/entre-turnos.html');await page.waitForFunction(()=>window.__entreTurnos?.rows===167);
 expect(await page.evaluate(()=>window.__entreTurnos.ready)).toBe(false);
 await expect(page.locator('#etSecondValue')).toHaveText('—');await expect(page.locator('#etView option[value=delta]')).toHaveAttribute('disabled','');
 await page.selectOption('#etMetric','gov_valid');await expect(page.locator('#etFirstValue')).not.toHaveText('—');
});
