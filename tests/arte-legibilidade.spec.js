const {test,expect}=require('@playwright/test'),fs=require('node:fs/promises'),path=require('node:path');
const output=path.resolve(__dirname,'../../../outputs');
test.beforeAll(async()=>fs.mkdir(output,{recursive:true}));
test('artes têm letras maiores e não sobrepõem conteúdo nos três formatos',async({page})=>{
 test.setTimeout(180000);await page.route(/^https:\/\//,r=>r.abort());await page.setViewportSize({width:390,height:844});await page.goto('/');await page.waitForFunction(()=>window.__stats?.model);await page.locator('#imageSettings summary').click();
 const findings=[];
 for(const size of ['1200x1200','1600x900','1080x1350']){
  await page.selectOption('#size',size);
  for(const template of ['map','list','routes','compare','ranking','card']){
   await page.selectOption('#metric',template==='ranking'?'turnout_pct':'leadership');await page.selectOption('#template',template);
   const audit=await page.evaluate(()=>window.__stats.artAudit);findings.push({size,template,errors:audit.errors,min:audit.minFont});expect(audit.text.filter(t=>['city','candidate','legend','value'].includes(t.role)).every(t=>t.size>=44)).toBe(true);
   if(!audit.errors.length&&size==='1200x1200'&&['map','list'].includes(template)){
    const url=await page.locator('#preview').evaluate(c=>c.toDataURL());await fs.writeFile(path.join(output,'arte-'+template+'-'+size+'.png'),Buffer.from(url.split(',')[1],'base64'));
    await page.locator('#preview').screenshot({path:path.join(output,'feed-'+template+'.png')});
   }
  }
 }
 await fs.writeFile(path.join(output,'auditoria-tipografia.json'),JSON.stringify(findings,null,2));
 expect(findings.filter(f=>f.errors.length)).toEqual([]);
 expect(findings.every(f=>f.min>=40)).toBe(true);
});
