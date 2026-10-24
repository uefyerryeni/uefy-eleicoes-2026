/* UEFY Eleições — ponte síncrona de compartilhamento para navegadores móveis.
 * A chamada navigator.share PRECISA ocorrer no mesmo gesto de clique:
 * nenhuma Promise/await/toBlob/font.ready antes dela.
 * Ao app de destino cabe aceitar ou ignorar a legenda; sempre confira antes de postar.
 */
(function(){
'use strict';
function fileFromCanvas(canvas,filename,type){
  var mime=type==='image/png'?'image/png':'image/jpeg';
  var data=canvas.toDataURL(mime,mime==='image/jpeg'?0.91:undefined);
  var encoded=data.slice(data.indexOf(',')+1),raw=atob(encoded);
  var bytes=new Uint8Array(raw.length);
  for(var i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);
  return new File([bytes],filename.replace(/\.(png|jpg|jpeg)$/i,mime==='image/png'?'.png':'.jpg'),{type:mime});
}
function prepare(canvas,text,filename,title){
  // jpg compacto costuma ter melhor aceitação no Android/Brave. PNG alternativo.
  if(!canvas||!canvas.width||!text)return {ok:false,reason:'missing'};
  if(typeof navigator.share!=='function'||typeof navigator.canShare!=='function')return {ok:false,reason:'unsupported'};
  for(var mime of ['image/jpeg','image/png']){
    try{
      var file=fileFromCanvas(canvas,filename,mime);
      if(navigator.canShare({files:[file]}))return {ok:true,data:{title:title||'UEFY Eleições',text:text,files:[file]},mime:mime};
    }catch(e){}
  }
  return {ok:false,reason:'unsupported'};
}
function send(options){
  var candidate=prepare(options.canvas,options.text,options.filename,options.title);
  if(!candidate.ok)return Promise.resolve({status:'unsupported'});
  try{
    // INVOCAR SINCRONAMENTE no clique, antes de qualquer await.
    return Promise.resolve(navigator.share(candidate.data)).then(function(){
      return {status:'shared',mime:candidate.mime};
    },function(error){
      return {status:error&&error.name==='AbortError'?'cancelled':'error',error:error?.name||'unknown'};
    });
  }catch(error){
    return Promise.resolve({status:error&&error.name==='AbortError'?'cancelled':'error',error:error?.name||'unknown'});
  }
}
function download(canvas,filename){
  var a=document.createElement('a');
  a.href=canvas.toDataURL('image/png');
  a.download=filename.replace(/\.(jpg|jpeg)$/i,'.png');
  document.body.appendChild(a);a.click();a.remove();
}
function notice(id,message,isWarning){
  var el=document.querySelector(id);if(!el)return;
  el.textContent=message;el.classList.toggle('is-warning',!!isWarning);
}
async function copyText(text,field){
  try{
    if(navigator.clipboard&&navigator.clipboard.writeText){
      await navigator.clipboard.writeText(text);
      return true;
    }
    var el=document.createElement('textarea');el.value=text;el.setAttribute('readonly','');
    el.style.position='fixed';el.style.left='-9999px';
    document.body.appendChild(el);el.focus();el.select();
    var ok=document.execCommand('copy');el.remove();if(ok)return true;
  }catch(e){}
  if(field){field.focus();field.select();field.setSelectionRange(0,field.value.length);}
  return false;
}
window.UEFYShare={send:send,download:download,notice:notice,copyText:copyText,
  get supportsFiles(){return typeof navigator.share==='function'&&typeof navigator.canShare==='function';}};
})();