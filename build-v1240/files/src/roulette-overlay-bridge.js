let rouletteFrame=null,roulettePayload=null,rouletteTimer=0,rouletteReady=false;
function prepareColorRoulette(){
  if(rouletteFrame)return;
  rouletteFrame=document.createElement('iframe');rouletteFrame.title='Ruleta';
  rouletteFrame.setAttribute('allow','autoplay');rouletteFrame.src=ROULETTE_FRAME_URL;
  rouletteFrame.style.cssText='position:fixed;inset:0;width:100%;height:100%;border:0;background:transparent;display:none;z-index:100';
  document.body.append(rouletteFrame);
  addEventListener('message',event=>{
    if(event.source!==rouletteFrame.contentWindow||event.origin!==location.origin||event.data?.type!=='lulu-roulette-ready')return;
    rouletteReady=true;if(roulettePayload)rouletteFrame.contentWindow.postMessage({...roulettePayload,type:'lulu-roulette-play'},location.origin);
  });
}
function stopColorRoulette(){
  clearTimeout(rouletteTimer);roulettePayload=null;
  if(rouletteFrame){rouletteFrame.style.display='none';queueMicrotask(()=>{if(!roulettePayload)rouletteFrame.contentWindow.postMessage({type:'lulu-roulette-stop'},location.origin);});}
}
function showColorRoulette(data){
  if(data.visible===false||Number(data.expiresAt)<=Date.now())return;
  prepareColorRoulette();roulettePayload=data;rouletteFrame.style.display='block';
  if(rouletteReady)rouletteFrame.contentWindow.postMessage({...data,type:'lulu-roulette-play'},location.origin);
  rouletteTimer=setTimeout(stopColorRoulette,Math.max(0,Number(data.expiresAt)-Date.now()));
}
if((typeof widget!=='undefined'&&widget==='game'&&typeof preview!=='undefined'&&!preview)||(typeof boot!=='undefined'&&boot.name==='game'))prepareColorRoulette();
