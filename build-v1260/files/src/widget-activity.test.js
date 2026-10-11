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
