'use strict';
const assert = require('assert');
const target = process.argv[2];
if (!target) throw new Error('Falta ruta a live-games.js');
const { LiveGameManager, blackjackValue } = require(require('path').resolve(target));
assert.equal(blackjackValue([{rank:'A'},{rank:'K'}]), 21);
assert.equal(blackjackValue([{rank:'A'},{rank:'A'},{rank:'9'}]), 21);
let balance = 1000;
const published = [];
const manager = new LiveGameManager({
  getConfig: async () => ({ liveGamesEnabled:true, economyEnabled:true, liveGamesMinBet:10, liveGamesMaxBet:500, liveGamesDefaultBet:50, liveGamesCooldownSeconds:0, currencyName:'Lunitas', currencySymbol:'🌙' }),
  charge: async ({amount}) => balance < amount ? {ok:false,balance} : {ok:true,balance:balance -= amount},
  payout: async ({amount}) => ({ok:true,balance:balance += amount}),
  publish: (result) => published.push(result),
  rng: () => 0
});
(async () => {
  const dice = await manager.play({game:'dice', user:'ana', displayName:'Ana', bet:100, requestId:'d1'});
  assert(dice.ok && dice.status === 'push');
  assert.equal(balance, 1000);
  const roulette = await manager.play({game:'roulette', user:'ana', displayName:'Ana', bet:100, choice:'0', requestId:'r1'});
  assert(roulette.ok && roulette.status === 'win' && roulette.rouletteNumber === 0);
  assert.equal(balance, 4500);
  const rps = await manager.play({game:'rps', user:'ana', displayName:'Ana', bet:50, choice:'piedra', requestId:'p1'});
  assert(rps.ok && rps.status === 'push');
  assert.equal(balance, 4500);
  const blackjack = await manager.play({game:'blackjack', user:'ana', displayName:'Ana', bet:100, requestId:'b1'});
  assert(blackjack.ok && blackjack.status === 'pending');
  const stand = await manager.play({game:'blackjack', action:'stand', user:'ana', displayName:'Ana', requestId:'b2'});
  assert(stand.ok && ['win','push','loss'].includes(stand.status));
  const badBet = await manager.play({game:'slots', user:'ana', displayName:'Ana', bet:1, requestId:'bad'});
  assert(!badBet.ok && /apuesta/i.test(badBet.error));
  console.log(`live-games: OK (${published.length} resultados)`);
})().catch((error) => { console.error(error); process.exit(1); });
