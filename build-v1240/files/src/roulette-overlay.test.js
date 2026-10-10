'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),zlib=require('node:zlib');
test('local and HTTPS page scripts compile with the integrated animation bridge',()=>{
 const source=fs.readFileSync(path.join(__dirname,'main.js'),'utf8'),a=source.indexOf('function streamWidgetHtml('),b=source.indexOf('\nfunction streamWidgetClientCount',a);
 const context={normalizeStreamWidgetType:x=>x,normalizeStreamWidgetTheme:x=>x,normalizeStreamWidgetBackground:x=>x,DEFAULT_STREAM_WIDGET_THEMES:{game:'lulu'},DEFAULT_STREAM_WIDGET_BACKGROUNDS:{game:'plain'},DEFAULT_STREAM_WIDGET_STYLES:{game:{}},normalizeStreamWidgetStyle:x=>x,streamWidgetThemeCss:()=>'',streamWidgetBackgroundCss:()=>'',streamWidgetCustomCss:()=>'',LuluWidgetDesign:{css:()=>''}};
 vm.createContext(context);vm.runInContext(source.slice(a,b),context);
 const relay=require('../railway-relay/src/overlay-page');
 for(const html of [context.streamWidgetHtml('game','token',false,'lulu','plain',{}),relay.renderOverlayPage('test','widget','game')]){
  for(const match of html.matchAll(/<script>([\s\S]*?)<\/script>/g))new vm.Script(match[1]);
  assert.ok(html.includes('showColorRoulette(data)'));assert.ok(html.includes("data.visible===false||Number(data.expiresAt)<=Date.now()"));
 }
 assert.ok(relay.overlayPageCsp().includes("frame-src 'self'"));
});
test('animation keeps original 960px assets, all eight winner variants and transparent idle canvas',()=>{
 const html=zlib.gunzipSync(fs.readFileSync(path.join(__dirname,'roulette.html.gz'))).toString();
 for(let i=0;i<8;i++)for(let j=0;j<3;j++)assert.ok(html.includes('"winner_'+i+'_'+j+'"'));
 assert.ok(html.includes('DURATION=14.109635'));assert.ok(html.includes('background:transparent'));assert.ok(html.includes('label.hidden=true'));
 assert.ok(!html.includes('draw(9.5)'));new vm.Script(html.match(/<script>([\s\S]*?)<\/script>/)[1]);
});
test('bridge rejects foreign messages and hides the frame on expiry',()=>{
 const messages=[],microtasks=[];let listener,expire;
 const frame={style:{},setAttribute(){},contentWindow:{postMessage(message){messages.push(message);}}};
 const context={document:{createElement:()=>frame,body:{append(){}}},location:{origin:'http://localhost'},addEventListener:(_name,fn)=>listener=fn,
 setTimeout:fn=>{expire=fn;return 1;},clearTimeout(){},queueMicrotask:fn=>microtasks.push(fn),Date:{now:()=>1000}};
 vm.createContext(context);vm.runInContext(fs.readFileSync(path.join(__dirname,'roulette-overlay-bridge.js'),'utf8').replace('ROULETTE_FRAME_URL',"'/roulette.html'"),context);
 context.showColorRoulette({id:'one',expiresAt:2000,rouletteIndex:5});assert.equal(frame.style.display,'block');
 listener({source:frame.contentWindow,origin:'https://foreign',data:{type:'lulu-roulette-ready'}});assert.equal(messages.length,0);
 listener({source:frame.contentWindow,origin:'http://localhost',data:{type:'lulu-roulette-ready'}});assert.equal(messages[0].type,'lulu-roulette-play');
 context.stopColorRoulette();context.showColorRoulette({id:'one',expiresAt:2000,rouletteIndex:5});microtasks.splice(0).forEach(fn=>fn());assert.equal(messages.filter(x=>x.type==='lulu-roulette-stop').length,0);
 expire();microtasks.splice(0).forEach(fn=>fn());assert.equal(frame.style.display,'none');assert.equal(messages.at(-1).type,'lulu-roulette-stop');
});
