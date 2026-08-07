'use strict';
const assert = require('assert');
const enginePath = process.argv[2] || './automation-engine.js';
const e = require(require('path').resolve(enginePath));

const rules = [{
  id:'rose', name:'Rosa', triggerType:'gift', filter:'Rose', minRepeat:2, cooldownSeconds:5,
  actions:[
    {type:'tts',value:'{user} mandó {count} {gift}'},
    {type:'alert',value:'Gracias {user}'},
    {type:'webhook',value:'https://example.com/hook'}
  ]
}];
const gift = {type:'gift',uniqueId:'lulu',nickname:'Lulu',giftName:'Rose',repeatCount:3,diamonds:3,timestamp:1};
const first = e.evaluateAutomations(rules,gift,{now:10000,cooldowns:{}});
assert.deepStrictEqual(first.matched,['rose']);
assert.strictEqual(first.actions[0].value,'Lulu mandó 3 Rose');
assert.strictEqual(first.actions[2].body.event.giftName,'Rose');
const second = e.evaluateAutomations(rules,gift,{now:12000,cooldowns:first.cooldowns});
assert.strictEqual(second.actions.length,0);
const third = e.evaluateAutomations(rules,gift,{now:16001,cooldowns:first.cooldowns});
assert.strictEqual(third.actions.length,3);
assert.strictEqual(e.evaluateAutomations(rules,{...gift,giftName:'TikTok'},{now:20000,cooldowns:{}}).actions.length,0);

let goals = [{id:'likes',type:'likes',title:'Likes',target:100,progress:10},{id:'diamonds',type:'diamonds',target:20,progress:0}];
goals = e.applyGoalEvent(goals,{type:'like',count:25});
assert.strictEqual(goals[0].progress,35);
goals = e.applyGoalEvent(goals,{type:'gift',diamonds:8,repeatCount:2});
assert.strictEqual(goals[1].progress,8);
assert.strictEqual(e.resetGoal(goals,'likes')[0].progress,0);

let stats = e.updateGiftStats({}, {type:'gift',uniqueId:'a',nickname:'A',giftName:'Rose',repeatCount:4,diamonds:4});
stats = e.updateGiftStats(stats, {type:'gift',uniqueId:'b',nickname:'B',giftName:'Lion',repeatCount:1,diamonds:30000});
assert.strictEqual(stats.totalGifts,5);
assert.strictEqual(stats.topGift.giftName,'Lion');
assert.strictEqual(stats.topStreak.repeatCount,4);
console.log('automation engine ok');
