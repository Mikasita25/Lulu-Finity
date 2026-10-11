'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),zlib=require('node:zlib'),vm=require('node:vm');
test('roulette decodes only selected winner and limits drawing to 60fps on 120Hz displays',async()=>{
 const html=zlib.gunzipSync(fs.readFileSync(require('node:path').join(__dirname,'roulette.html.gz'))).toString();
 let now=1000,listener;const frames=[],decoded=[];const ctx=new Proxy({}, {get:()=>()=>{}}),label={hidden:true},parent={postMessage(){}};
 const sandbox={document:{createElement:()=>({getContext:()=>ctx}),getElementById:id=>id==='wheel'?{getContext:()=>ctx}:label},parent,location:{origin:'http://local'},Image:class {async decode(){decoded.push(this.src)}},Audio:class {pause(){}play(){return Promise.resolve()}},Date:{now:()=>now},setTimeout:fn=>{fn()},requestAnimationFrame:fn=>frames.push(fn),addEventListener:(_,fn)=>listener=fn};
 vm.createContext(sandbox);vm.runInContext(html.match(/<script>([\s\S]*?)<\/script>/)[1],sandbox);
 let draws=0;sandbox.render=()=>draws++;
 const pending=listener({source:parent,origin:'http://local',data:{type:'lulu-roulette-play',id:'one',rouletteIndex:5,animationStartedAt:1000,resultSeconds:3}});await pending;
 assert.equal(decoded.length,23,'20 base layers + exactly three winner textures');
 for(let frame=1;frame<=120;frame++){now=1000+frame*1000/120;frames.shift()();}
 assert.ok(draws>=59&&draws<=61,'draw count: '+draws);
 now=16000;frames.shift()();assert.equal(label.hidden,false);
});
