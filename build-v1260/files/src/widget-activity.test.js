'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {normalize,stamp}=require('./widget-activity');
test('unchanged polls never extend visibility or revive expired widgets',()=>{
 const p={id:'goal',progress:4,visible:true};const a=stamp(p,null,{},1000),b=stamp({...p,updatedAt:9000},a,{},9000);
 assert.equal(b.activityAt,1000);assert.equal(b.activityExpiresAt,11000);
 const c=stamp({...p,progress:5},b,{},12000);assert.equal(c.activityExpiresAt,22000);
});
test('explicit recall revives same content, permanent mode and limits survive normalization',()=>{
 const a=stamp({id:'wallet',balance:4},null,{},1000);const b=stamp({id:'wallet',balance:4,recall:'new'},a,{autoHide:false,displaySeconds:3},2000);
 assert.equal(b.activityExpiresAt,5000);assert.equal(b.autoHide,false);assert.equal(normalize({displaySeconds:900}).displaySeconds,300);
});
test('roulette keeps full original animation and result duration',()=>{
 const a=stamp({animationDurationMs:14110,expiresAt:19000},null,{displaySeconds:1},1000);assert.equal(a.activityExpiresAt,19000);
});
test('duplicate playlist synchronization with generated ids does not recall it',()=>{
 const a=stamp({type:'playlist',id:'first',current:{title:'Song'}},null,{},1000);
 const b=stamp({type:'playlist',id:'poll',current:{title:'Song'},updatedAt:2000},a,{},2000);
 assert.equal(b.activityAt,1000);
});
test('expiry timer replacement cannot hide a newer activation',()=>{
 const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');let id=0;const timers=new Map();
 const source=fs.readFileSync(path.join(__dirname,'main.js'),'utf8');const fn=source.match(/function armActivityExpiry\(data\)\{[^}]+\}/)[0];
 const context={preview:false,hideTimer:0,Date:{now:()=>1000},clearTimeout:key=>timers.delete(key),setTimeout:(fn,delay)=>{timers.set(++id,{fn,delay});return id},hideAll(){}};
 vm.createContext(context);vm.runInContext(fn,context);context.armActivityExpiry({autoHide:true,activityExpiresAt:5000});context.armActivityExpiry({autoHide:true,activityExpiresAt:9000});assert.equal(timers.size,1);assert.equal([...timers.values()][0].delay,8000);
 context.armActivityExpiry({autoHide:false,activityExpiresAt:9000});assert.equal(timers.size,0);
});
