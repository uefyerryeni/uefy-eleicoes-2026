const {test,expect}=require('@playwright/test');
// Somente cargas isoladas no navegador de teste; nunca são arquivos de produção.
const ea20=(scope,values=[60,40])=>({ele:'6260',t:'2',f:'o',cdabr:scope,dg:'25/10/2026',hg:'18:30:00',s:{pst:'50,00'},carg:[{cd:'3',agr:[{par:[{sg:'PT',cand:[{n:'13',nmu:'CADU DE LULA',vap:String(values[0]),pvap:String(values[0])}]},{sg:'UNIÃO',cand:[{n:'44',nmu:'ALLYSON',vap:String(values[1]),pvap:String(values[1])}]}]}]}]});
test.beforeEach(async({page})=>{
 await page.clock.setFixedTime(new Date('2026-10-24T21:00:00Z'));
 await page.route(/^https:\/\/(?:fonts\.googleapis\.com|fonts\.gstatic\.com|uefyerryeni\.github\.io|resultados\.tse\.jus\.br)\//,r=>r.abort());
 await page.goto('/apuracao.html');
 await page.waitForFunction(()=>typeof selectedFeature!=='undefined'&&selectedFeature);
});
test('EA20 rejeita eleição, turno, cargo, abrangência e números inválidos',async({page})=>{
 const payload=ea20('rn');
 const errors=await page.evaluate(body=>{
  const expected={election:'6260',cargo:3,scope:'rn'},cases=[];
  for(const mutate of [x=>x.ele='6259',x=>x.t='1',x=>x.f='s',x=>x.cdabr='17612',x=>x.carg[0].cd='1',x=>x.s.pst='NaN',x=>x.carg[0].agr[0].par[0].cand[0].vap='-1',x=>x.carg[0].agr[0].par[0].cand[0].pvap='99']){
   const copy=structuredClone(body);mutate(copy);try{UEFYElection.validate(copy,expected);cases.push(false)}catch{cases.push(true)}
  }
  return cases;
 },payload);
 expect(errors).toEqual(Array(8).fill(true));
});
test('troca durante consulta descarta Natal e carrega apenas Parnamirim',async({page})=>{
 await page.locator('#rnPublicationScope').selectOption('municipal');
 await page.clock.setFixedTime(new Date('2026-10-25T21:30:00Z'));
 await page.evaluate(()=>{municipalityConfigCache.official=[{uf:'rn',code:'17612',name:'Natal'},{uf:'rn',code:'17914',name:'Parnamirim'}]});
 let release,hit;const held=new Promise(r=>release=r),requested=new Promise(r=>hit=r);
 await page.route('**/rn17612-c0003-e006260-u.json',async route=>{hit();await held;await route.fulfill({json:ea20('17612')})});
 await page.route('**/rn17914-c0003-e006260-u.json',route=>route.fulfill({json:ea20('17914',[20,80])}));
 await page.evaluate(()=>{void loadRemote()});await requested;
 await page.locator('#munSearch').fill('Parnamirim');await page.locator('#munList .rn-item').click();
 release();
 await page.waitForFunction(()=>!rnLoading&&current.municipality==='Parnamirim'&&current.progress===50);
 expect(await page.evaluate(()=>({city:current.municipality,votes:current.candidates.find(c=>String(c.number)==='13').votes,safe:rnPublicationIsSafe()}))).toEqual({city:'Parnamirim',votes:20,safe:true});
});
test('falha de rede preserva leitura anterior e bloqueia nova publicação',async({page})=>{
 await page.locator('#rnPublicationScope').selectOption('municipal');
 await page.clock.setFixedTime(new Date('2026-10-25T21:30:00Z'));
 await page.evaluate(()=>{
  municipalityConfigCache.official=[{uf:'rn',code:'17612',name:'Natal'}];
  current={municipality:'Natal',progress:50,generatedAt:'25/10/2026 · 18:30',integrity:{matched:2,total:2,unmatched:0},candidates:[{number:'13',name:'CADU DE LULA',party:'PT',votes:60,pct:60},{number:'44',name:'ALLYSON',party:'UNIÃO',votes:40,pct:40}]};renderCurrent();
 });
 await expect(page.locator('#rnShareBundle')).toBeEnabled();
 await page.evaluate(()=>loadRemote());
 expect(await page.evaluate(()=>current.candidates[0].votes)).toBe(60);
 await expect(page.locator('#rnShareBundle')).toBeDisabled();
 await expect(page.locator('#rnStatus')).toContainText('Mantendo o último resultado válido');
});
test('legenda estadual não herda edição municipal curta',async({page})=>{
 await page.locator('#rnPublicationScope').selectOption('municipal');
 await page.clock.setFixedTime(new Date('2026-10-25T21:30:00Z'));
 await page.route('**/rn-c0003-e006260-u.json',route=>route.fulfill({json:ea20('rn')}));
 await page.locator('#rnPostText').fill('NATAL: texto municipal curto');
 await page.locator('#uefyVideoExport').click();
 await page.waitForFunction(()=>window.__uefyVideo.rnStateReady);
 // Uma mudança no seletor atualiza a legenda com o snapshot estadual já conferido.
 await page.locator('#uefyVideoScope').selectOption('municipal');await page.locator('#uefyVideoScope').selectOption('state');
 await expect(page.locator('#uefyVideoCaption')).toHaveValue(/RIO GRANDE DO NORTE/);
 await expect(page.locator('#uefyVideoCaption')).not.toHaveValue(/NATAL/);
});
test('publicação rejeita duplicidades, votos negativos, destinação inválida e progresso impossível',async({page})=>{
 const cases=await page.evaluate(()=>{
  const base={progress:50,candidates:[{number:'13',votes:60,pct:60},{number:'44',votes:40,pct:40}]};
  return [x=>x.progress=101,x=>x.candidates[0].votes=-1,x=>x.candidates[0].pct=NaN,x=>x.candidates[0].number='44',x=>x.candidates[0].voteDestination='Anulado',x=>x.stale=true].map(change=>{const d=structuredClone(base);change(d);return UEFYElection.publishable(d,['13','44'])});
 });expect(cases).toEqual(Array(6).fill(false));
});

test('imagem e vídeo iniciais representam o RN inteiro e não mudam com a cidade',async({page})=>{
 await expect(page.locator('#rnPublicationScope')).toHaveValue('state');
 await expect(page.locator('#uefyVideoScope')).toHaveValue('state');
 await page.locator('#munSearch').fill('Parnamirim');await page.locator('#munList .rn-item').click();
 await expect(page.locator('#rnPostText')).toHaveValue(/Rio Grande do Norte/);
 await expect(page.locator('#rnPostText')).not.toHaveValue(/Parnamirim/);
});

test('total estadual não recebe votos da seleção municipal',async({page})=>{
 await page.clock.setFixedTime(new Date('2026-10-25T21:30:00Z'));
 await page.route('**/rn-c0003-e006260-u.json',route=>route.fulfill({json:ea20('rn')}));
 await page.evaluate(()=>refreshStatePublication());
 await expect(page.locator('#rnShareBundle')).toBeEnabled();
 await page.locator('#munSearch').fill('Parnamirim');await page.locator('#munList .rn-item').click();
 expect(await page.evaluate(()=>({name:publicationName(),votes:publicationResult().candidates.find(c=>String(c.number)==='13').votes,safe:rnPublicationIsSafe()}))).toEqual({name:'Rio Grande do Norte',votes:60,safe:true});
});

test('animação mostra somente percentuais exatos do snapshot, sem contagem intermediária',async({page})=>{
 await page.clock.setFixedTime(new Date('2026-10-25T21:30:00Z'));
 await page.locator('#uefyVideoScope').selectOption('municipal');
 await page.evaluate(()=>{
  current={municipality:'Natal',progress:50,integrity:{matched:2,total:2,unmatched:0},candidates:[{number:'13',name:'CADU DE LULA',party:'PT',votes:60,pct:60},{number:'44',name:'ALLYSON',party:'UNIÃO',votes:40,pct:40}]};
  window.__pctSeen=[];const original=CanvasRenderingContext2D.prototype.fillText;
  CanvasRenderingContext2D.prototype.fillText=function(value,...args){
   if(this.canvas.id==='uefyVideoCanvas'&&/^\d+[,.]\d+%$/.test(String(value)))window.__pctSeen.push(Number(String(value).replace(',','.').replace('%','')));
   return original.call(this,value,...args);
  };
 });
 await page.locator('#uefyVideoPlay').click();
 await page.waitForFunction(()=>window.__pctSeen.includes(60)&&window.__pctSeen.includes(40));
 expect(await page.evaluate(()=>window.__pctSeen.every(n=>[60,40,50].includes(n)))).toBeTruthy();
});
