'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');
const {normalizeColorRoulette,validateColorRoulette,pickColor,DURATION_MS}=require('./color-roulette');
const {LiveGameManager}=require('./live-games');
function setup(overrides={}){
 let time=100000;const published=[],payments=[];
 const config={liveGamesEnabled:true,economyEnabled:true,colorRoulette:normalizeColorRoulette()};
 const manager=new LiveGameManager({getConfig:async()=>config,now:()=>time,rng:()=>0,
 charge:async()=>{throw Error('Color roulette must not charge bets');},payout:async data=>{payments.push(data);return {ok:true,balance:data.amount};},publish:data=>published.push(data),...overrides});
 return {manager,config,published,payments,advance(ms){time+=ms;}};
}
test('eight colors preserve original animation indexes; weighted boundaries exclude 0%',()=>{
 const cfg=normalizeColorRoulette();assert.equal(validateColorRoulette(cfg),'');
 for(let i=0;i<8;i++)assert.equal(pickColor(cfg,()=>i*125000).index,i);
 cfg.colors.forEach(row=>row.probability=0);cfg.colors[7].probability=100;
 assert.equal(pickColor(cfg,()=>0).index,7);assert.equal(pickColor(cfg,n=>n-1).index,7);
 cfg.colors[7].probability=99;assert.ok(validateColorRoulette(cfg));
});
test('result and reward are decided before publishing; same request cannot pay twice',async()=>{
 const s=setup();s.config.colorRoulette.colors[0].amount=100;s.config.colorRoulette.colors[0].prize='Premio rojo';
 const result=await s.manager.play({game:'roulette',user:'alyA',requestId:'one'});
 assert.equal(result.ok,true);assert.equal(result.rouletteIndex,0);assert.equal(result.prize,'Premio rojo');assert.equal(result.payout,100);
 assert.equal(s.payments.length,1);assert.equal(s.published.length,1);assert.equal(result.expiresAt,result.animationStartedAt+DURATION_MS+3000);
 s.advance(40000);assert.equal((await s.manager.play({game:'roulette',user:'alya',requestId:'one'})).ok,false);assert.equal(s.payments.length,1);
});
test('concurrent calls cannot replace active animation, per-user and global cooldowns',async()=>{
 const s=setup();s.config.colorRoulette.cooldownSeconds=60;
 const results=await Promise.all([s.manager.play({game:'roulette',user:'a',requestId:'a'}),s.manager.play({game:'roulette',user:'b',requestId:'b'})]);
 assert.equal(results.filter(x=>x.ok).length,1);s.advance(20000);
 assert.equal((await s.manager.play({game:'roulette',user:'a',requestId:'a2'})).ok,false);
 assert.equal((await s.manager.play({game:'roulette',user:'b',requestId:'b2'})).ok,true);
 const g=setup();g.config.colorRoulette.cooldownScope='global';g.config.colorRoulette.cooldownSeconds=60;
 await g.manager.play({game:'roulette',user:'a'});g.advance(20000);assert.equal((await g.manager.play({game:'roulette',user:'b'})).ok,false);
});
test('preview never pays; text-only prizes work without Economy; invalid config does not publish',async()=>{
 const s=setup();s.config.economyEnabled=false;
 assert.equal((await s.manager.play({game:'roulette',user:'a'})).ok,true);assert.equal(s.payments.length,0);
 s.advance(40000);s.config.colorRoulette.colors[0].amount=100;
 assert.equal((await s.manager.play({game:'roulette',user:'b'})).ok,false);
 assert.equal((await s.manager.play({game:'roulette',user:'b',preview:true})).ok,true);assert.equal(s.payments.length,0);
 s.advance(40000);s.config.colorRoulette.colors[0].probability=0;
 assert.equal((await s.manager.play({game:'roulette',user:'c'})).ok,false);
});
test('failed payment publishes nothing and releases reservation',async()=>{
 const s=setup({payout:async()=>({ok:false})});s.config.colorRoulette.colors[0].amount=10;
 assert.equal((await s.manager.play({game:'roulette',user:'a',requestId:'failed'})).ok,false);assert.equal(s.published.length,0);assert.equal(s.manager.rouletteUntil,0);
 s.config.colorRoulette.colors[0].amount=0;assert.equal((await s.manager.play({game:'roulette',user:'a',requestId:'failed'})).ok,true);
});
test('streamer cost is charged once, configured color reward credits separately',async()=>{
 const charges=[];const s=setup({charge:async data=>{charges.push(data);return {ok:true,balance:950};}});
 s.config.colorRoulette.cost=50;s.config.colorRoulette.colors[0].amount=200;
 const r=await s.manager.play({game:'roulette',user:'a',requestId:'paid',bet:9999});
 assert.equal(r.ok,true);assert.equal(charges.length,1);assert.equal(charges[0].amount,50);assert.equal(s.payments[0].amount,200);assert.equal(r.profit,150);
 s.advance(40000);assert.equal((await s.manager.play({game:'roulette',user:'a',requestId:'paid'})).ok,false);assert.equal(charges.length,1);
 const before=s.payments.length;await s.manager.play({game:'roulette',user:'b',preview:true});assert.equal(charges.length,1);assert.equal(s.payments.length,before);
});
test('insufficient funds never publishes or pays a reward',async()=>{
 const s=setup({charge:async()=>({ok:false,balance:5})});s.config.colorRoulette.cost=50;
 const r=await s.manager.play({game:'roulette',user:'a',requestId:'poor'});
 assert.equal(r.ok,false);assert.match(r.error,/Saldo insuficiente/);assert.equal(s.published.length,0);assert.equal(s.payments.length,0);assert.equal(s.manager.rouletteUntil,0);
});
test('refund uses a separate idempotent transaction if reward fails before animation',async()=>{
 const payments=[];const s=setup({charge:async()=>({ok:true,balance:100}),payout:async data=>{payments.push(data);return {ok:data.transactionId.endsWith(':refund'),balance:150};}});
 s.config.colorRoulette.cost=50;s.config.colorRoulette.colors[0].amount=100;
 assert.equal((await s.manager.play({game:'roulette',user:'a',requestId:'refund'})).ok,false);
 assert.equal(payments.length,2);assert.equal(payments[1].amount,50);assert.equal(payments[1].transactionId,'game:refund:roulette:refund');assert.equal(s.published.length,0);assert.equal(s.manager.rouletteUntil,0);
});
