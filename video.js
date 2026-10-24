/* UEFY / Central das Eleições — vídeo editorial quadrado para Twitter/X.
 * Exportação oficial somente após conciliação com o TSE.
 * Ensaio de ENVIO sem votos permitidos: mesmo formato, nunca rotulado como apuração.
 * Exportação de resultados restrita aos dados do TSE integralmente conciliados.
 */
(function () {
  'use strict';
  var rn = !!document.querySelector('#rnCanvas');
  var publisher = document.querySelector(rn ? '.rn-publisher' : '.publisher');
  var actions = publisher && publisher.querySelector(rn ? '.rn-actions' : '.actions');
  if (!publisher || !actions) return;

  var SIZE = 1080, LENGTH = 8000;
  // Identidade em menos de meio segundo; números fechados aos 1,45 s.
  var MOTION = Object.freeze({intro:420, cards:600, numberStart:520, numberEnd:1450, holdEnd:8000});
  var YELLOW = '#f4dd19', INK = '#151a18', WHITE = '#f7f6ef', PALE = '#cdd5cf';
  var studio = document.createElement('section');
  studio.className = 'uefy-video-studio';
  studio.id = 'uefyVideoStudio';
  studio.setAttribute('aria-labelledby', 'uefyVideoTitle');
  studio.innerHTML = '<div class="uefy-video-heading"><div><span class="uefy-video-kicker">UEFY MOTION / TWITTER</span><h3 id="uefyVideoTitle">Resultado em movimento.</h3><p>Vídeo quadrado · 1080 × 1080 · 8 segundos · sem áudio</p></div><span class="uefy-video-format">MP4 / H.264</span></div>' +
    '<div class="uefy-video-canvas-wrap"><canvas id="uefyVideoCanvas" width="1080" height="1080" aria-label="Prévia animada do vídeo eleitoral"></canvas><span class="uefy-video-overlay" id="uefyVideoOverlay">PRÉVIA VISUAL · SEM DADOS</span></div>' +
    '<div class="uefy-video-timeline"><span id="uefyVideoCounter">00:00 / 00:08</span><div class="uefy-video-track"><i id="uefyVideoProgress"></i></div></div>' +
    '<div class="uefy-video-actions"><button class="btn" id="uefyVideoPlay" type="button">▶ Ver animação</button><button class="btn primary" id="uefyVideoExport" type="button">↓ Gerar vídeo oficial MP4</button><button class="btn uefy-video-rehearsal" id="uefyVideoRehearsal" type="button">Testar publicação sem votos (MP4)</button><button class="btn uefy-video-copy" id="uefyVideoCopy" type="button">Copiar texto da publicação</button><button class="btn uefy-video-share" id="uefyVideoShare" type="button">1/2 · Preparar MP4 para compartilhar</button></div>' +
    '<p class="uefy-video-share-note">Brave: são dois toques separados. Primeiro prepare o MP4; depois toque em Compartilhar para enviar ao X. O vídeo de teste não tem votos. Amanhã o vídeo oficial só usará dados conferidos do TSE. Caso o aplicativo X ignore a legenda, use Copiar texto da publicação.</p><p class="uefy-video-status" id="uefyVideoStatus" role="status" aria-live="polite">Para testar no Brave: toque em “1/2 · Preparar MP4” e, depois, em “2/2 · Compartilhar no X”. O teste não apresenta votos.</p>' +
    '<div class="uefy-video-result" id="uefyVideoResult" hidden><video id="uefyVideoPlayer" controls playsinline preload="metadata"></video><a id="uefyVideoDownload" class="uefy-video-download" download="uefy-eleicoes-twitter.mp4">Baixar MP4 para o Twitter ↗</a></div>';
  actions.insertAdjacentElement('afterend', studio);

  var canvas = studio.querySelector('#uefyVideoCanvas');
  var ctx = canvas.getContext('2d', {alpha:false});
  var playBtn = studio.querySelector('#uefyVideoPlay');
  var exportBtn = studio.querySelector('#uefyVideoExport');
  var rehearsalBtn = studio.querySelector('#uefyVideoRehearsal');
  var shareBtn = studio.querySelector('#uefyVideoShare');
  var copyBtn = studio.querySelector('#uefyVideoCopy');
  var mobileScreen = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
  var status = studio.querySelector('#uefyVideoStatus');
  var count = studio.querySelector('#uefyVideoCounter');
  var progress = studio.querySelector('#uefyVideoProgress');
  var overlay = studio.querySelector('#uefyVideoOverlay');
  var result = studio.querySelector('#uefyVideoResult');
  var player = studio.querySelector('#uefyVideoPlayer');
  var download = studio.querySelector('#uefyVideoDownload');
  studio.querySelector('.uefy-video-actions').before(status);
  var previewId = 0, busy = false, lastUrl = null;
  var lastBlob = null, lastRecord = null, lastTweet = '';

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
    var place=rn
      ? (typeof selectedFeature!=='undefined'&&selectedFeature?.properties?.nome)||'RIO GRANDE DO NORTE'
      : (typeof scopeLabel==='function'?scopeLabel():'BRASIL');
    return {demo:true,office:rn?'GOVERNO DO RN':'PRESIDÊNCIA',
      label:String(place),rows:[
        {name:rn?'ALLYSON BEZERRA':'CANDIDATURA 01',party:rn?'UNIÃO BRASIL':'',pct:0,votes:0,color:rn?'#1976d2':YELLOW},
        {name:rn?'CADU DE LULA':'CANDIDATURA 02',party:rn?'PT':'',pct:0,votes:0,color:rn?'#d62828':'#e3e6e2'}],
      progress:0,final:false,elected:false,stamp:'',slug:'previa'};
  }
  function rehearsalRecord(){
    var snapshot=placeholder();
    snapshot.rehearsal=true; // Nunca recebe votos, porcentagens ou seções.
    snapshot.slug='PREVIA-SEM-RESULTADOS';
    return snapshot;
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
    // Motion 3: chegada aos números até 1,45 s; exposição estável até 8 s.
    // Os valores intermediários são apenas interpolação visual dos dados TSE
    // do snapshot capturado. Não representam novos boletins de apuração.
    var sec=Math.max(0,t)/1000;
    var heading=ease((t-50)/260);
    var place=ease((t-160)/310);
    var cards=ease((t-290)/380);
    var bars=ease((t-MOTION.numberStart)/(MOTION.numberEnd-MOTION.numberStart));
    var footer=ease((t-480)/430);
    var isDemo=!!d.demo;
    var cream='#f6f5ee', black='#121714', subtle='#657269', track='#d4dad0';
    ctx.globalAlpha=1;
    ctx.fillStyle=cream;ctx.fillRect(0,0,SIZE,SIZE);

    // Assinatura forte e legível — não é um quadro vazio de carregamento.
    line(0,0,1080,142,YELLOW);
    line(0,137,1080,6,black);
    text('UEFY',54,106,93,black,900,315);
    line(353,29,4,82,black);
    text('CENTRAL DAS ELEIÇÕES',385,70,31,black,900,645);
    text('2026   /   SEGUNDO TURNO',385,111,26,black,700,640);

    // Painel editorial escuro.
    line(0,143,1080,837,black);
    line(53,183,8,193,YELLOW);
    ctx.globalAlpha=Math.max(.05,heading);
    text(d.rehearsal?'MODELO DE PUBLICAÇÃO  /  SEM APURAÇÃO':'25 OUTUBRO 2026  /  DADOS DO TSE',82,207,26,cream,800,895);
    text(d.office,82,288-22*(1-heading),82,cream,900,940);
    ctx.globalAlpha=Math.max(.05,place);
    text(ellipsis(d.label.toLocaleUpperCase('pt-BR'),35),82,354-14*(1-place),45,YELLOW,850,930);
    ctx.globalAlpha=1;
    line(60,382,960,2,'#617064');
    var category=d.rehearsal?'TESTE DE ENVIO  /  NÃO É RESULTADO ELEITORAL':
      isDemo?'PRÉVIA DE DESIGN  /  AINDA SEM RESULTADOS':
      d.elected?'ELEIÇÃO DEFINIDA PELO TSE':
      d.final?'TOTALIZAÇÃO FINAL  /  TSE':'APURAÇÃO OFICIAL  /  PARCIAL';
    line(60,404,960,47,YELLOW);
    text(category,78,436,24,black,900,915);

    for(var i=0;i<2;i++){
      var c=d.rows[i],y=471+i*201,appear=ease((t-300-i*105)/300);
      var alpha=Math.max(.08,Math.min(cards,appear));
      ctx.globalAlpha=alpha;
      // Cards off-white densos: nome, porcentagem, barra e fonte.
      line(60,y+13*(1-alpha),960,185,cream);
      line(60,y+13*(1-alpha),17,185,c.color||YELLOW);
      var name=ellipsis(String(c.name||'').toLocaleUpperCase('pt-BR'),27);
      text(name,100,y+67+13*(1-alpha),44,black,900,650);
      if(!isDemo) {
        // Count-up curto. Valores finais são idênticos ao snapshot oficial.
        // A animação é completada até 1,45 s, sem espera no número.
        var numberT=ease((t-MOTION.numberStart-i*90)/
          (MOTION.numberEnd-MOTION.numberStart-i*90));
        var animatedPct=numberT>=1 ? c.pct : c.pct*numberT;
        text(pct(animatedPct),785,y+72+13*(1-alpha),67,black,900,220);
        ctx.globalAlpha=alpha*Math.max(.18,numberT);
        text(votes(c.votes)+' VOTOS'+(c.party?'  /  '+ellipsis(c.party,20):''),
          100,y+149+13*(1-alpha),24,subtle,800,855);
        ctx.globalAlpha=alpha;
      } else {
        text('—',920,y+64+13*(1-alpha),52,black,800,60);
        text(d.rehearsal?'SEM RESULTADOS / FORMATO DE PUBLICAÇÃO':'AGUARDANDO VOTOS OFICIAIS',
          100,y+147+13*(1-alpha),24,subtle,800,790);
      }
      line(100,y+89+13*(1-alpha),882,22,track);
      if(!isDemo && bars>0) line(100,y+89+13*(1-alpha),
        Math.max(0,882*Math.min(100,c.pct)/100*bars),22,c.color||YELLOW);
      // Na prévia sem votos, barras ficam neutras (sem proporções simuladas).
      ctx.globalAlpha=1;
    }
    ctx.globalAlpha=Math.max(.55,footer);
    line(60,891,960,3,'#657267');
    if(isDemo){
      text(d.rehearsal?'TESTE DE PUBLICAÇÃO / SEM VOTOS':'SEM APURAÇÃO PUBLICADA',
        60,928,33,YELLOW,900,940);
      text(d.rehearsal?'Amanhã: dados oficiais do TSE neste mesmo formato.':
        'O resultado será exibido após a divulgação oficial.',
        60,968,23,cream,650,945);
    }else{
      text((d.final?'RESULTADO FINAL':'SEÇÕES TOTALIZADAS')+
        '   '+pct(d.progress),60,928,32,YELLOW,900,952);
      text('TSE  /  '+ellipsis(d.stamp||'HORÁRIO DA FONTE NÃO INFORMADO',60),
        60,968,23,cream,700,948);
    }
    ctx.globalAlpha=1;

    // Rodapé fixo: não ocorre sumiço do quadro ao fim do vídeo.
    line(0,980,1080,100,YELLOW);
    line(0,980,1080,4,black);
    text('TWITTER  /  @UEFYERRYENI',55,1045,29,black,900,825);
    text(d.rehearsal?'TESTE':isDemo?'PRÉVIA':'TSE',934,1045,27,black,900,110);
    line(60,1070,960*Math.min(1,t/LENGTH),7,black);
  }
  function setTime(ms) {
    var secs=Math.floor(ms/1000);
    count.textContent='00:'+String(secs).padStart(2,'0')+' / 00:08';
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
    setStatus(snapshot.demo?'Prévia de identidade visual sem votos. O MP4 oficial fica bloqueado até o TSE divulgar resultados conferidos.':
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
  // Para celulares que não gravam MP4 por MediaRecorder, usa H.264 via WebCodecs.
  // A biblioteca de mux local evita conversão WebM→MP4 e arquivos com extensão falsa.
  async function webCodecsMp4(snapshot) {
    if(typeof VideoEncoder==='undefined' || typeof VideoFrame==='undefined')
      throw new Error('O navegador não disponibiliza o codificador H.264 via WebCodecs.');
    var fps=24, size=720, totalFrames=Math.round(LENGTH/1000*fps);
    var config={codec:'avc1.42E01E',width:size,height:size,
      bitrate:2800000,framerate:fps,avc:{format:'avc'}};
    var supported=await VideoEncoder.isConfigSupported(config);
    if(!supported.supported) throw new Error('O aparelho não oferece codificação H.264 neste navegador.');
    var module=await import('./vendor/mp4-muxer.min.mjs');
    var target=new module.ArrayBufferTarget();
    var muxer=new module.Muxer({target:target,video:{codec:'avc',
      width:size,height:size,frameRate:fps},fastStart:'in-memory'});
    var scaled=document.createElement('canvas');
    scaled.width=size;scaled.height=size;
    var scaledContext=scaled.getContext('2d',{alpha:false});
    if(!scaledContext) throw new Error('Não foi possível preparar o canvas para o MP4.');
    var encodeError=null;
    var encoder=new VideoEncoder({
      output:function(chunk,metadata){muxer.addVideoChunk(chunk,metadata);},
      error:function(err){encodeError=err;}
    });
    try {
      encoder.configure(config);
      for(var i=0;i<=totalFrames;i++){
        if(encodeError) throw encodeError;
        var ms=Math.min(LENGTH,i*1000/fps);
        draw(ms,snapshot);
        scaledContext.drawImage(canvas,0,0,size,size);
        var frame=new VideoFrame(scaled,{timestamp:Math.round(i*1000000/fps)});
        encoder.encode(frame,{keyFrame:i%48===0});
        frame.close();
        setTime(ms);
        (snapshot.rehearsal?rehearsalBtn:exportBtn).textContent='Gerando MP4 '+Math.floor(i/totalFrames*100)+'%…';
        if(encoder.encodeQueueSize>6) await encoder.flush();
        if(i%4===0) await new Promise(function(resolve){setTimeout(resolve,0);});
      }
      await encoder.flush();
      if(encodeError) throw encodeError;
      muxer.finalize();
      var blob=new Blob([target.buffer],{type:'video/mp4'});
      if(blob.size<20000) throw new Error('O MP4 foi gerado vazio ou incompleto.');
      return blob;
    }finally{
      if(encoder.state!=='closed')encoder.close();
      draw(LENGTH,snapshot);setTime(LENGTH);
    }
  }
  function updateShareButton(){
    if(busy){
      shareBtn.disabled=true;shareBtn.textContent='Gerando MP4…';
    }else if(lastBlob){
      shareBtn.disabled=false;
      shareBtn.textContent=shareBtn.dataset.fallback==='1'?'2/2 · Abrir X e baixar MP4':
        '2/2 · Compartilhar vídeo e texto no X';
    }else{
      shareBtn.disabled=false;shareBtn.textContent='1/2 · Preparar MP4 para compartilhar';
    }
  }
  async function checkMp4Signature(blob){
    if(!blob||blob.size<20000)throw new Error('O arquivo MP4 ficou vazio ou incompleto.');
    const bytes=new Uint8Array(await blob.slice(0,12).arrayBuffer());
    if(bytes[4]!==102||bytes[5]!==116||bytes[6]!==121||bytes[7]!==112)
      throw new Error('O navegador devolveu um arquivo sem cabeçalho MP4 válido.');
    return blob;
  }
  function finishVideo(blob,snapshot,tweet) {
    lastUrl=URL.createObjectURL(blob);
    lastBlob=blob;lastRecord=snapshot;lastTweet=tweet;
    updateShareButton();
    player.src=lastUrl;
    download.href=lastUrl;
    download.download=snapshot.rehearsal?'UEFY-TESTE-ENVIO-SEM-RESULTADOS.mp4':
      'uefy-eleicoes-'+snapshot.slug+'-2t.mp4';
    result.hidden=false;
    setStatus(snapshot.rehearsal?
      'Etapa 1/2 concluída: MP4 de teste gerado sem votos. Agora toque em “2/2 · Compartilhar vídeo e texto no X” e confira o rascunho.':
      'Etapa 1/2 concluída: MP4 oficial com dados conferidos. Agora toque em “2/2 · Compartilhar vídeo e texto no X”.',false);
  }
  function resetOldVideo() {
    if (lastUrl) URL.revokeObjectURL(lastUrl);
    lastUrl=null;lastBlob=null;lastRecord=null;lastTweet='';
    result.hidden=true;player.removeAttribute('src');player.load();
    download.removeAttribute('href');
    shareBtn.dataset.fallback='';
    updateShareButton();
  }
  async function exportVideo(rehearsal) {
    if (busy) return;
    // Ensaio é só o formato, sem votos. Resultados oficiais continuam estritamente bloqueados.
    var snapshot=rehearsal===true?rehearsalRecord():safeRecord();
    if (!snapshot) {
      setStatus('A exportação com votos está bloqueada até a publicação e a conciliação do TSE. Para verificar o compartilhamento no Brave, use “Testar publicação sem votos”.',true);
      return;
    }
    var type=getMp4Type();
    var nativeMp4=!!type && typeof canvas.captureStream==='function';
    var webCodecs=typeof VideoEncoder!=='undefined' && typeof VideoFrame!=='undefined';
    if(!nativeMp4 && !webCodecs) {
      setStatus('Seu navegador não permite gerar um MP4 H.264 neste aparelho. Abra o link no Chrome ou Samsung Internet atualizado, fora do navegador interno de outro aplicativo.',true);
      return;
    }
    busy=true;stopPreview();resetOldVideo();
    var tweet=makeTwitterText(snapshot);
    exportBtn.disabled=true;rehearsalBtn.disabled=true;playBtn.disabled=true;
    updateShareButton();
    (snapshot.rehearsal?rehearsalBtn:exportBtn).textContent='Gravando 0%…';
    overlay.hidden=true;
    if (document.fonts && document.fonts.ready) {
      try {await document.fonts.ready;} catch (_) {}
    }
    var stream=null,recorder=null,timer=null,raf=null,finished=false;
    try {
      if(!nativeMp4){
        setStatus('Gerando MP4 em H.264 para o celular. Mantenha esta página aberta até a prévia aparecer.',false);
        var webBlob=await checkMp4Signature(await webCodecsMp4(snapshot));
        finishVideo(webBlob,snapshot,tweet);
        return;
      }
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
      setStatus('Gerando 8 segundos em MP4. Mantenha esta aba aberta e visível até concluir.',false);
      function render(now) {
        var ms=Math.min(LENGTH,now-start);
        draw(ms,snapshot);setTime(ms);
        (snapshot.rehearsal?rehearsalBtn:exportBtn).textContent='Gravando '+Math.floor(ms/LENGTH*100)+'%…';
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
      var blob=await checkMp4Signature(await promise);
      finishVideo(blob,snapshot,tweet);
    } catch(e) {
      if(nativeMp4 && webCodecs){
        // Alguns celulares declaram MP4 nativo, mas a gravação falha. Tenta H.264 WebCodecs.
        try{
          if(raf){cancelAnimationFrame(raf);raf=null;}
          if(timer){clearTimeout(timer);timer=null;}
          if(recorder && recorder.state!=='inactive')try{recorder.stop();}catch(_){}
          if(stream)stream.getTracks().forEach(function(track){track.stop();});
          setStatus('A gravação MP4 nativa falhou. Testando a codificação H.264 alternativa do celular.',false);
          var alternate=await checkMp4Signature(await webCodecsMp4(snapshot));
          finishVideo(alternate,snapshot,tweet);
        }catch(second){
          setStatus('Não foi possível gerar MP4 neste celular: '+String(second&&second.message||second)+'. Tente Chrome ou Samsung Internet atualizado, fora do navegador interno de outro aplicativo.',true);
        }
      }else{
        setStatus('Não foi possível gerar MP4 neste aparelho: '+String(e&&e.message||e)+'. Tente Chrome ou Samsung Internet atualizado, fora do navegador interno de outro aplicativo.',true);
      }
    } finally {
      finished=true;
      if (raf) cancelAnimationFrame(raf);
      if (timer) clearTimeout(timer);
      if (recorder && recorder.state!=='inactive') {try {recorder.stop();} catch(_) {}}
      if (stream) stream.getTracks().forEach(function(track){track.stop();});
      busy=false;exportBtn.disabled=false;rehearsalBtn.disabled=false;playBtn.disabled=false;
      exportBtn.textContent='↓ Gerar vídeo oficial MP4';
      rehearsalBtn.textContent='Testar publicação sem votos (MP4)';
      updateShareButton();
    }
  }

  function makeTwitterText(snapshot) {
    if(snapshot.rehearsal) return [
      'TESTE DE PUBLICAÇÃO | UEFY ELEIÇÕES 2026',
      '2º turno · '+snapshot.office+' · '+snapshot.label,
      'Vídeo para conferir o formato e o compartilhamento no X.',
      'SEM RESULTADOS: nenhum voto ou percentual foi divulgado neste vídeo.',
      'A cobertura oficial usará os dados conferidos do TSE.'
    ].join('\n');
    var input=document.querySelector(rn?'#rnPostText':'#postText');
    var edited=String(input && input.value || '').trim();
    // Preserva textos curtos escritos pelo usuário; para textos extensos,
    // gera uma versão resumida a partir dos MESMOS dados capturados no vídeo.
    if(edited && edited.length<=275) return edited;
    var lines=['ELEIÇÕES 2026 | 2º TURNO | '+snapshot.office,
      snapshot.label.toLocaleUpperCase('pt-BR'),''];
    snapshot.rows.forEach(function (row) {
      lines.push(row.name+' — '+pct(row.pct));
    });
    lines.push('',(snapshot.final?'Resultado final':'Apuração parcial')+
      ' · '+pct(snapshot.progress)+' das seções','Fonte: TSE');
    var out=lines.join('\n');
    if(out.length<=275)return out;
    return 'ELEIÇÕES 2026 | 2º TURNO\n'+snapshot.office+' · '+
      snapshot.label+'\n'+snapshot.rows.map(function(row){
        return ellipsis(row.name,17)+': '+pct(row.pct);
      }).join('\n')+'\nFonte: TSE';
  }
  async function copyPostText() {
    var snapshot=lastRecord || safeRecord();
    if(!snapshot) {
      setStatus('O texto oficial só fica disponível após a apuração e a conferência dos dados do TSE.',true);
      return;
    }
    var value=lastRecord?lastTweet:makeTwitterText(snapshot);
    try{
      if(navigator.clipboard && navigator.clipboard.writeText){
        await navigator.clipboard.writeText(value);
      }else{
        var node=document.createElement('textarea');
        node.value=value;node.setAttribute('readonly','');
        node.style.position='fixed';node.style.opacity='0';
        document.body.appendChild(node);node.select();
        var copied=document.execCommand('copy');
        node.remove();
        if(!copied) throw new Error('A cópia não foi permitida neste navegador');
      }
      setStatus('Texto copiado. Abra o X ou Threads, anexe o MP4 e cole a legenda no post antes de publicar.',false);
    }catch(e){
      setStatus('O navegador bloqueou a cópia automática. Use o navegador principal do celular ou selecione o texto da publicação manualmente.',true);
    }
  }
  function fallbackTwitter() {
    if(!lastBlob || !lastUrl || !lastRecord) return;
    var short=lastTweet.length<=280 ? lastTweet : '';
    // Abrir a nova guia e baixar enquanto ainda há gesto de clique do usuário.
    // Intents web NÃO permitem anexar automaticamente mídia local.
    var target='https://twitter.com/intent/tweet'+
      (short?'?text='+encodeURIComponent(short):'');
    var win=window.open(target,'_blank');
    if(win)try{win.opener=null;}catch(_){}
    var a=document.createElement('a');
    a.href=lastUrl;a.download=download.download;
    document.body.appendChild(a);a.click();a.remove();
    if(!short && navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(lastTweet).catch(function(){});
    }
    setStatus((win?'O Twitter foi aberto e o MP4 foi baixado. ':
      'O navegador bloqueou a abertura do Twitter; o MP4 foi baixado. ')+
      'No compositor, escolha Mídia, selecione o vídeo e confira o texto antes de publicar.'+
      (!short?' O texto completo foi enviado à área de transferência, quando permitido.':''),false);
  }
  function shareTwitter() {
    if(busy) return;
    if(!lastBlob || !lastRecord || !lastUrl){
      // Sem MP4, o primeiro toque prepara o arquivo. Compartilhar requer novo gesto.
      setStatus('Etapa 1/2: preparando o MP4. Quando concluir, toque novamente para compartilhar no X.',false);
      exportVideo(!safeRecord());
      return;
    }
    if(shareBtn.dataset.fallback==='1'){
      fallbackTwitter();return;
    }
    var file=new File([lastBlob],download.download||'uefy-eleicoes.mp4',{type:'video/mp4'});
    var data={files:[file],text:lastTweet,title:'Central das Eleições UEFY'};
    var supported=false;
    try{
      supported=!!(navigator.share && navigator.canShare && navigator.canShare({files:[file]}));
    }catch(_){}
    if(!supported){
      fallbackTwitter();return;
    }
    // Compartilhamento nativo: a escolha do Twitter/X é feita pelo usuário.
    // É imprescindível invocar navigator.share diretamente no clique.
    var result;
    try{result=navigator.share(data);}
    catch(e){
      shareBtn.dataset.fallback='1';
      updateShareButton();
      setStatus('O compartilhamento nativo falhou. Use o botão branco novamente para abrir o Twitter e baixar o MP4.',true);
      return;
    }
    Promise.resolve(result).then(function(){
      setStatus('Vídeo enviado ao menu do celular. Confira no X se vídeo e legenda chegaram juntos. Se o aplicativo ignorar o texto, use “Copiar texto da publicação” e cole no post.',false);
    }).catch(function(e){
      if(e && e.name==='AbortError'){
        setStatus('Compartilhamento cancelado. O MP4 permanece disponível para baixar ou compartilhar novamente.',false);
        return;
      }
      shareBtn.dataset.fallback='1';
      updateShareButton();
      setStatus('O aplicativo não recebeu o vídeo pelo compartilhamento nativo. Baixe o MP4, copie o texto e anexe ambos na publicação.',true);
    });
  }

  playBtn.addEventListener('click',preview);
  shareBtn.addEventListener('click',shareTwitter);
  copyBtn.addEventListener('click',copyPostText);
  exportBtn.addEventListener('click',function(){exportVideo(false);});
  rehearsalBtn.addEventListener('click',function(){exportVideo(true);});
  window.addEventListener('pagehide',function () {stopPreview();if(lastUrl) URL.revokeObjectURL(lastUrl);});
  window.__uefyVideo={get officialReady(){return !!safeRecord();},
    get supportsMp4(){return !!getMp4Type();},
    get busy(){return busy;},
    get duration(){return LENGTH;},
    get revealEnd(){return MOTION.numberEnd;},
    get canShare(){return !!lastBlob;},
    get canEncodeWebCodecs(){return typeof VideoEncoder!=='undefined'&&typeof VideoFrame!=='undefined';},
    get hasNativeMp4(){return !!getMp4Type();},
    get isRN(){return rn;},
    get officialOnly(){return true;},
    get preflightAvailable(){return true;},
    get generatedIsRehearsal(){return !!lastRecord?.rehearsal;},
    get generatedText(){return lastTweet;},
    get rehearsalText(){return makeTwitterText(rehearsalRecord());}};
  overlay.hidden=false;
  draw(1650,safeRecord()||placeholder());setTime(0);
  updateShareButton();
})();