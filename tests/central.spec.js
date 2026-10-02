const { test, expect } = require('@playwright/test');

async function installCanvasGuard(page){
  await page.addInitScript(() => {
    window.__canvasOverflows=[];
    const original=CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText=function(text,x,y,maxWidth){
      try{
        const w=this.measureText(String(text)).width;
        if(x < -1 || x+w > this.canvas.width+1){
          window.__canvasOverflows.push({text:String(text),x,w,width:this.canvas.width});
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
  await page.goto('/radar.html');
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
  await page.goto('/radar.html');
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
  await page.goto('/index.html');
  await page.selectOption('#modeSelect','lab');
  await resetGuard(page);
  await page.click('#refreshBtn');
  await expect(page.locator('#postText')).not.toHaveValue('');
  await expectNoCanvasOverflow(page);

  await page.goto('/rn.html');
  await page.selectOption('#rnMode','lab');
  await resetGuard(page);
  await page.click('#rnRefresh');
  await expect(page.locator('#rnPostText')).not.toHaveValue('');
  await expectNoCanvasOverflow(page);
});

test('Cores de governador são fixas e exclusivas', async ({page})=>{
  await page.goto('/rn.html');
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
      await page.goto(path);
      await page.evaluate(()=>scrollTo(0,1000));
      await page.waitForTimeout(150);
      await noOverlap(page,'.float-refresh','.to-top');
      if(viewport.width<=600) await noOverlap(page,'.float-refresh','.mobile-dock');
    }
  });
}
