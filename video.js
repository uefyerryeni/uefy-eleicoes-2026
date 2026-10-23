/* UEFY / Central das Eleições — vídeo editorial quadrado para Twitter.
 * Exportação exclusivamente com dados oficiais conciliados do TSE.
 * Não há resultados simulados na gravação: a prévia antes da apuração
 * usa apenas rótulos vazios, sem votos ou percentuais inventados.
 */
(function () {
  'use strict';
  var rn = !!document.querySelector('#rnCanvas');
  var publisher = document.querySelector(rn ? '.rn-publisher' : '.publisher');
  var actions = publisher && publisher.querySelector(rn ? '.rn-actions' : '.actions');
  if (!publisher || !actions) return;

  var SIZE = 1080, LENGTH = 12000;
  var YELLOW = '#f4dd19', INK = '#151a18', WHITE = '#f7f6ef', PALE = '#cdd5cf';
  var studio = document.createElement('section');
  studio.className = 'uefy-video-studio';
  studio.id = 'uefyVideoStudio';
  studio.setAttribute('aria-labelledby', 'uefyVideoTitle');
  studio.innerHTML = '<div class="uefy-video-heading"><div><span class="uefy-video-kicker">UEFY MOTION / TWITTER</span><h3 id="uefyVideoTitle">Resultado em movimento.</h3><p>Vídeo quadrado · 1080 × 1080 · 12 segundos · sem áudio</p></div><span class="uefy-video-format">MP4 / H.264</span></div>' +
    '<div class="uefy-video-canvas-wrap"><canvas id="uefyVideoCanvas" width="1080" height="1080" aria-label="Prévia animada do vídeo eleitoral"></canvas><span class="uefy-video-overlay" id="uefyVideoOverlay">PRÉVIA VISUAL · SEM DADOS</span></div>' +
    '<div class="uefy-video-timeline"><span id="uefyVideoCounter">00:00 / 00:12</span><div class="uefy-video-track"><i id="uefyVideoProgress"></i></div></div>' +
    '<div class="uefy-video-actions"><button class="btn" id="uefyVideoPlay" type="button">▶ Ver animação</button><button class="btn primary" id="uefyVideoExport" type="button">↓ Gerar vídeo MP4</button></div>' +
    '<p class="uefy-video-status" id="uefyVideoStatus" role="status" aria-live="polite">A prévia visual funciona sem votos. A exportação só será liberada após a divulgação oficial e a conferência dos dados do TSE.</p>' +
    '<div class="uefy-video-result" id="uefyVideoResult" hidden><video id="uefyVideoPlayer" controls playsinline preload="metadata"></video><a id="uefyVideoDownload" class="uefy-video-download" download="uefy-eleicoes-twitter.mp4">Baixar MP4 para o Twitter ↗</a></div>';
  actions.insertAdjacentElement('afterend', studio);

  var canvas = studio.querySelector('#uefyVideoCanvas');
  var ctx = canvas.getContext('2d', {alpha:false});
  var playBtn = studio.querySelector('#uefyVideoPlay');
  var exportBtn = studio.querySelector('#uefyVideoExport');
  var status = studio.querySelector('#uefyVideoStatus');
  var count = studio.querySelector('#uefyVideoCounter');
  var progress = studio.querySelector('#uefyVideoProgress');
  var overlay = studio.querySelector('#uefyVideoOverlay');
  var result = studio.querySelector('#uefyVideoResult');
  var player = studio.querySelector('#uefyVideoPlayer');
  var download = studio.querySelector('#uefyVideoDownload');
  var previewId = 0, busy = false, lastUrl = null;

  function safeRecord() {
    if (typeof mode === 'undefined' || mode !== 'official') return null;
    if (typeof inSecondRoundPollingWindow !== 'function' || !inSecondRoundPollingWindow()) return null;
    if (rn && typeof mapPublicationMode !== 'undefined' && mapPublicationMode) return null;
    var source = rn ? (typeof current === 'undefined' ? null : current)
      : (typeof state === 'undefined' || typeof selectedOffice === 'undefined' ? null : state[selectedOffice]);
    if (!source || !Array.isArray(source.candidates) || source.candidates.length < 2) return null;
    var valid = rn ? (typeof rnPublicationIsSafe === 'function' && rnPublicationIsSafe())
      : (typeof publicationIsSafe === 'function' && publicationIsSafe());
    if (!valid || !source.integrity || source.integrity.error ||
        Number(source.integrity.unmatched) !== 0 ||
        Number(source.integrity.total) !== source.candidates.length ||
        Number(source.integrity.matched) !== source.candidates.length ||
        !(Number(source.progress) > 0)) return null;
    var rows = source.candidates.filter(function (x) {
      return x && Number(x.votes) > 0 && Number.isFinite(Number(x.pct)) &&
        Number(x.pct) >= 0 && Number(x.pct) <= 100 &&
        (!x.voteDestination || /^(válido|valido)$/i.test(String(x.voteDestination).trim()));
    }).slice().sort(function (a,b) {return Number(b.votes)-Number(a.votes);});
    if (rows.length < 2 || rows[0].number === rows[1].number) return null;
    var label = rn ? (selectedFeature && selectedFeature.properties ? selectedFeature.properties.nome : '')
      : (typeof scopeLabel === 'function' ? scopeLabel() : 'Brasil');
    if (!label) return null;
    var officialWinner = false;
    if (!rn && typeof officialOutcome === 'function') {
      var outcome = officialOutcome(source);
      officialWinner = outcome && outcome.kind === 'elected' &&
        Array.isArray(outcome.candidates) && outcome.candidates.length > 0;
    }
    return {
      demo:false,
      office:rn ? 'GOVERNO DO RN' : 'PRESIDÊNCIA',
      label:String(label),
      election:rn ? '6260' : '6258',
      rows:rows.slice(0,2).map(function (c,i) {
        return {name:String(c.name||'').trim(),party:String(c.party||'').trim(),
          number:String(c.number||''),votes:Number(c.votes),pct:Number(c.pct),
          color:rn ? (String(c.number)==='13'?'#d62828':String(c.number)==='44'?'#1976d2':PALE)
            : (i===0 ? YELLOW : '#e3e6e2')};
      }),
      progress:Number(source.progress),
      final:!!source.finalTotalization,
      elected:!!officialWinner,
      stamp:String(source.generatedAt||''),
      slug:(rn ? 'rn-' : 'pres-') + String(label).normalize('NFD')
        .replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')
    };
  }
  function placeholder() {
    return {demo:true,office:rn?'GOVERNO DO RN':'PRESIDÊNCIA',
      label:rn?'RIO GRANDE DO NORTE':'BRASIL',
      rows:[{name:'CANDIDATURA 01',pct:0,votes:0,color:rn?'#1976d2':YELLOW},
        {name:'CANDIDATURA 02',pct:0,votes:0,color:rn?'#d62828':'#e3e6e2'}],
      progress:0,final:false,elected:false,stamp:'',slug:'previa'};
  }
  function ease(x) {var t=Math.min(1,Math.max(0,x));return 1-Math.pow(1-t,3);}
  function lerp(a,b,t) {return a+(b-a)*t;}
  function setStatus(message,bad) {
    status.textContent=message;
    status.classList.toggle('is-warning',!!bad);
  }
  function text(str,x,y,size,color,weight,maxWidth) {
    str=String(str==null?'':str);
    ctx.fillStyle=color;ctx.textBaseline='alphabetic';
    var px=size;
    do {ctx.font=(weight||700)+' '+px+'px "Space Grotesk","DM Sans",Arial,sans-serif';px-=2;}
    while (maxWidth && ctx.measureText(str).width>maxWidth && px>=22);
    ctx.fillText(str,x,y,maxWidth||undefined);
  }
  function ellipsis(s,max) {
    s=String(s||'');
    return s.length>max?s.slice(0,max-1).trim()+'…':s;
  }
  function pct(p) {return Number(p).toLocaleString('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:2})+'%';}
  function votes(n) {return Number(n).toLocaleString('pt-BR');}
  function line(x,y,w,h,color) {ctx.fillStyle=color;ctx.fillRect(x,y,w,h);}
  function draw(t,d) {
    var second=t/1000, intro=ease((second-.3)/1.25), bars=ease((second-3.5)/3.1);
    var shown=ease((second-2.0)/1.15), footer=ease((second-8.2)/1.0);
    ctx.fillStyle=INK;ctx.fillRect(0,0,SIZE,SIZE);
    line(0,0,SIZE,16,YELLOW);
    line(0,16,14,SIZE-16,YELLOW);
    line(0,985,SIZE,95,YELLOW);
    text('UEFY',65,104,65,YELLOW,900);
    text('CENTRAL DAS ELEIÇÕES  /  2026',300,101,25,WHITE,800,705);
    line(65,135,950,2,'#52605a');
    text('25 OUT 2026  /  SEGUNDO TURNO',65,184,25,PALE,800);
    text(d.office,65,277-24*(1-intro),68,WHITE,900,947);
    text(ellipsis(d.label.toLocaleUpperCase('pt-BR'),32),65,339-16*(1-intro),42,YELLOW,800,950);
    line(65,370,950,2,'#52605a');
    var label=d.demo?'MODELO VISUAL · AGUARDANDO APURAÇÃO':d.elected?'ELEITO · CONFIRMADO PELO TSE':
      d.final?'TOTALIZAÇÃO FINAL · TSE':'APURAÇÃO OFICIAL · PARCIAL';
    text(label,65,421,23,d.demo?YELLOW:PALE,800,930);
    for (var i=0;i<2;i++) {
      var c=d.rows[i],baseY=470+i*202;
      var arrival=ease((second-2.2-i*.35)/.8);
      var shade=lerp(0,1,shown*arrival);
      ctx.globalAlpha=shade;
      text(ellipsis(c.name.toLocaleUpperCase('pt-BR'),27),65,baseY+19,41,WHITE,900,680);
      if (!d.demo) {
        var p=c.pct*bars;
        text(pct(p),790,baseY+19,50,WHITE,900,225);
      } else {
        text('—',908,baseY+19,50,PALE,900,85);
      }
      line(65,baseY+49,950,23,'#37413b');
      if (!d.demo) line(65,baseY+49,Math.max(1,950*c.pct/100*bars),23,c.color);
      else line(65,baseY+49,Math.max(1,950*.15*bars),23,c.color);
      text(d.demo?'SEM VOTOS PUBLICADOS':votes(c.votes)+' votos'+(c.party?'  ·  '+c.party:''),65,baseY+104,24,PALE,650,950);
      ctx.globalAlpha=1;
    }
    line(65,881,950,2,'#52605a');
    if (d.demo) {
      text('PRÉVIA · NÃO É RESULTADO ELEITORAL',65,927,29,YELLOW,900,950);
    } else {
      text((d.final?'RESULTADO FINAL':'SEÇÕES TOTALIZADAS')+'  '+pct(d.progress),65,927,29,YELLOW,850,930);
      ctx.globalAlpha=Math.max(.42,footer);
      text('TSE  ·  '+ellipsis(d.stamp||'ATUALIZAÇÃO OFICIAL',52),65,967,22,WHITE,650,950);
      ctx.globalAlpha=1;
    }
    text('TWITTER  /  @UEFYERRYENI',65,1045,29,INK,900,780);
    text('TSE',938,1045,29,INK,900,90);
    if (d.demo) {
      ctx.globalAlpha=.97;line(730,383,285,47,YELLOW);ctx.globalAlpha=1;
      text('SEM DADOS REAIS',744,416,24,INK,900,270);
    }
    // Arquivo temporal 12 s, sem alterar em momento algum os dados fotografados.
    line(65,1071,950*Math.min(1,t/LENGTH),9,INK);
  }
  function setTime(ms) {
    var secs=Math.floor(ms/1000);
    count.textContent='00:'+String(secs).padStart(2,'0')+' / 00:12';
    progress.style.width=(100*Math.min(1,ms/LENGTH)).toFixed(2)+'%';
  }
  function stopPreview() {
    if (previewId) cancelAnimationFrame(previewId);
    previewId=0;
    playBtn.disabled=false;
    playBtn.textContent='▶ Ver animação';
  }
  function preview() {
    if (busy) return;
    stopPreview();
    var snapshot=safeRecord()||placeholder();
    overlay.hidden=!snapshot.demo;
    playBtn.disabled=true;
    playBtn.textContent='Reproduzindo…';
    setStatus(snapshot.demo?'Prévia de identidade visual, sem resultados. A gravação continua bloqueada até a conferência do TSE.':
      'Prévia com dados oficiais capturados nesta consulta: '+snapshot.stamp+'.',false);
    var start=performance.now();
    function frame(now) {
      var ms=Math.min(LENGTH,now-start);
      draw(ms,snapshot);setTime(ms);
      if (ms<LENGTH) previewId=requestAnimationFrame(frame);
      else {previewId=0;playBtn.disabled=false;playBtn.textContent='↻ Reproduzir novamente';}
    }
    previewId=requestAnimationFrame(frame);
  }
  function getMp4Type() {
    if (!window.MediaRecorder || !MediaRecorder.isTypeSupported) return null;
    var options=['video/mp4;codecs=avc1.42E01E','video/mp4;codecs=avc1','video/mp4'];
    return options.find(function (type) {return MediaRecorder.isTypeSupported(type);})||null;
  }
  function resetOldVideo() {
    if (lastUrl) URL.revokeObjectURL(lastUrl);
    lastUrl=null;result.hidden=true;player.removeAttribute('src');player.load();
    download.removeAttribute('href');
  }
  async function exportVideo() {
    if (busy) return;
    var snapshot=safeRecord();
    if (!snapshot) {
      setStatus('Exportação bloqueada: é necessário ter pelo menos duas candidaturas com votos oficiais, turno iniciado e conferência integral das candidaturas. Se estiver vendo o mapa estadual, volte ao resultado de um município.',true);
      return;
    }
    var type=getMp4Type();
    if (!type || typeof canvas.captureStream !== 'function') {
      setStatus('Este navegador não oferece gravação MP4/H.264. Abra a Central no Chrome ou Edge atualizado no computador. Não geraremos um WebM com extensão MP4.',true);
      return;
    }
    busy=true;stopPreview();resetOldVideo();
    exportBtn.disabled=true;playBtn.disabled=true;
    exportBtn.textContent='Gravando 0%…';
    overlay.hidden=true;
    if (document.fonts && document.fonts.ready) {
      try {await document.fonts.ready;} catch (_) {}
    }
    var stream=null,recorder=null,timer=null,raf=null,finished=false;
    try {
      draw(0,snapshot);
      stream=canvas.captureStream(30);
      recorder=new MediaRecorder(stream,{mimeType:type,videoBitsPerSecond:4500000});
      var chunks=[];
      var promise=new Promise(function (resolve,reject) {
        recorder.ondataavailable=function (e) {if(e.data&&e.data.size)chunks.push(e.data);};
        recorder.onerror=function (e) {reject(e.error||new Error('Falha no codificador MP4.'));};
        recorder.onstop=function () {
          var blob=new Blob(chunks,{type:'video/mp4'});
          if(blob.size<20000) reject(new Error('O arquivo MP4 ficou vazio ou incompleto.'));
          else resolve(blob);
        };
      });
      var start=performance.now();
      recorder.start(1000);
      setStatus('Gerando 12 segundos em MP4. Mantenha esta aba aberta e visível até concluir.',false);
      function render(now) {
        var ms=Math.min(LENGTH,now-start);
        draw(ms,snapshot);setTime(ms);
        exportBtn.textContent='Gravando '+Math.floor(ms/LENGTH*100)+'%…';
        if(ms<LENGTH) raf=requestAnimationFrame(render);
      }
      raf=requestAnimationFrame(render);
      timer=setTimeout(function () {
        if (finished) return;
        finished=true;
        if (raf) cancelAnimationFrame(raf);
        draw(LENGTH,snapshot);setTime(LENGTH);
        if (recorder.state!=='inactive') recorder.stop();
      }, LENGTH+130);
      var blob=await promise;
      lastUrl=URL.createObjectURL(blob);
      player.src=lastUrl;
      download.href=lastUrl;
      download.download='uefy-eleicoes-'+snapshot.slug+'-2t.mp4';
      result.hidden=false;
      setStatus('MP4 gerado com dados oficiais de '+snapshot.stamp+'. Confira os números e o vídeo antes de publicar no Twitter.',false);
    } catch(e) {
      setStatus('Não foi possível concluir o MP4: '+String(e&&e.message||e)+'. Tente novamente no Chrome/Edge atualizado.',true);
    } finally {
      finished=true;
      if (raf) cancelAnimationFrame(raf);
      if (timer) clearTimeout(timer);
      if (recorder && recorder.state!=='inactive') {try {recorder.stop();} catch(_) {}}
      if (stream) stream.getTracks().forEach(function(track){track.stop();});
      busy=false;exportBtn.disabled=false;playBtn.disabled=false;
      exportBtn.textContent='↓ Gerar vídeo MP4';
    }
  }
  playBtn.addEventListener('click',preview);
  exportBtn.addEventListener('click',exportVideo);
  window.addEventListener('pagehide',function () {stopPreview();if(lastUrl) URL.revokeObjectURL(lastUrl);});
  window.__uefyVideo={get officialReady(){return !!safeRecord();},
    get supportsMp4(){return !!getMp4Type();},
    get busy(){return busy;},
    get duration(){return LENGTH;},
    get isRN(){return rn;}};
  overlay.hidden=false;
  draw(0,placeholder());setTime(0);
})();