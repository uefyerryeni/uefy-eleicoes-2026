const { test }=require('@playwright/test');
// Diagnóstico detalhado opcional; a homologação padrão usa os testes de regressão móveis.
test.skip(!process.env.MOBILE_AUDIT_VERBOSE,'Executar sob demanda com MOBILE_AUDIT_VERBOSE=1');
const BUILD=require('../version.json').build;
// Diagnóstico de interface em múltiplos tamanhos. Gera evidências no log,
// sem classificar como falha até que os números sejam revisados.
test('auditoria de largura, navegação e controles em telas móveis',async({page})=>{
 test.setTimeout(140000);
 await page.route(/^https:\/\/(?:fonts\.googleapis\.com|fonts\.gstatic\.com|uefyerryeni\.github\.io|resultados(?:-sim)?\.tse\.jus\.br)\//,r=>r.abort());
 const paths=['apuracao.html','presidencia.html','entre-turnos.html','analises.html','radar.html','primeiro-turno.html'];
 const widths=[320,360,390,430,600,768,820];
 const report=[];
 for(const width of widths){
  await page.setViewportSize({width,height:800});
  for(const file of paths){
   await page.goto('/'+file+'?v='+encodeURIComponent(BUILD),{waitUntil:'load',timeout:15000});
   const info=await page.evaluate(()=>{
    const $=s=>document.querySelector(s);
    const style=el=>getComputedStyle(el);
    const vis=el=>el&&el.getClientRects().length&&style(el).visibility!=='hidden'&&style(el).display!=='none';
    const rect=el=>el.getBoundingClientRect();
    const vw=document.documentElement.clientWidth;
    const strip=selector=>{
      const el=$(selector);return el&&vis(el)?{x:Math.round(rect(el).x),w:Math.round(rect(el).width),h:Math.round(rect(el).height)}:null;
    };
    const clipped=[...document.querySelectorAll('.brandtext strong,h1,h2,h3,.et-hero-aside>strong,.mt-route,.turno2-duel-candidate b')]
      .filter(vis).filter(el=>el.scrollWidth>el.clientWidth+3)
      .map(el=>({name:(el.textContent||'').trim().slice(0,38),s:el.scrollWidth,w:el.clientWidth})).slice(0,7);
    const inputs=[...document.querySelectorAll('input,select,textarea')].filter(vis)
     .filter(el=>parseFloat(style(el).fontSize)<16)
     .map(el=>({id:el.id||el.name,px:parseFloat(style(el).fontSize)})).slice(0,6);
    const short=[...document.querySelectorAll('button,a,.mobile-menu summary')].filter(vis)
     .filter(el=>{const r=rect(el);return r.width>=12&&r.width<42||r.height>=12&&r.height<42;})
     .slice(0,7).map(el=>({txt:(el.textContent||'').trim().slice(0,22),w:Math.round(rect(el).width),h:Math.round(rect(el).height)}));
    return {overflow:Math.max(0,document.documentElement.scrollWidth-vw),
     vp:vw,brand:strip('.brand'),menu:strip('.mobile-menu summary'),dock:strip('.mobile-dock'),
     floats:[strip('.float-refresh'),strip('.to-top')],clipped,smallinputs:inputs,smallTargets:short};
   });
   report.push({width,file,...info});
  }
 }
 for(const row of report) console.log('MOBILE_AUDIT '+JSON.stringify(row));
});