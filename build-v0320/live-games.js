'use strict';

const GAME_IDS = new Set(['blackjack','scratch','roulette','dice','rps','slots']);
const RED_ROULETTE = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
const SUITS = ['♠','♥','♦','♣'];
const RANKS = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
const SCRATCH_SYMBOLS = [
  { symbol:'🌸', weight:34, multiplier:2 },
  { symbol:'🌙', weight:28, multiplier:3 },
  { symbol:'⭐', weight:20, multiplier:5 },
  { symbol:'💎', weight:12, multiplier:10 },
  { symbol:'👑', weight:6, multiplier:20 }
];
const SLOT_SYMBOLS = [
  { symbol:'🍒', weight:32, multiplier:2 },
  { symbol:'🍋', weight:27, multiplier:3 },
  { symbol:'⭐', weight:20, multiplier:5 },
  { symbol:'💎', weight:13, multiplier:10 },
  { symbol:'7️⃣', weight:8, multiplier:15 }
];

function normalizeUser(value) {
  return String(value || '').trim().replace(/^@/, '').toLowerCase().slice(0, 80);
}

function safeName(value, fallback = 'Jugador') {
  return String(value || fallback).replace(/\s+/g, ' ').trim().slice(0, 80) || fallback;
}

function secureRandomInt(max, rng = null) {
  const n = Math.max(1, Math.floor(Number(max) || 1));
  if (typeof rng === 'function') return Math.max(0, Math.min(n - 1, Math.floor(Number(rng(n)) || 0)));
  const crypto = require('crypto');
  return crypto.randomInt(0, n);
}

function weightedPick(entries, rng = null) {
  const total = entries.reduce((sum, entry) => sum + Math.max(0, Number(entry.weight) || 0), 0);
  let roll = secureRandomInt(Math.max(1, total), rng);
  for (const entry of entries) {
    roll -= Math.max(0, Number(entry.weight) || 0);
    if (roll < 0) return entry;
  }
  return entries[entries.length - 1];
}

function drawCard(rng = null) {
  return { rank:RANKS[secureRandomInt(RANKS.length, rng)], suit:SUITS[secureRandomInt(SUITS.length, rng)] };
}

function cardText(card) { return `${card.rank}${card.suit}`; }

function blackjackValue(cards) {
  let total = 0;
  let aces = 0;
  for (const card of cards) {
    if (card.rank === 'A') { total += 11; aces += 1; }
    else if (['J','Q','K'].includes(card.rank)) total += 10;
    else total += Number(card.rank || 0);
  }
  while (total > 21 && aces > 0) { total -= 10; aces -= 1; }
  return total;
}

function money(amount, config = {}) {
  const symbol = String(config.currencySymbol || '🌙').slice(0, 4);
  const name = String(config.currencyName || 'Lunitas').slice(0, 24);
  return `${symbol} ${Math.round(Number(amount) || 0).toLocaleString('es-MX')} ${name}`;
}

function normalizeConfig(input = {}) {
  return {
    enabled: input.liveGamesEnabled !== false,
    economyEnabled: input.economyEnabled === true,
    minBet: Math.max(1, Math.round(Number(input.liveGamesMinBet || 10))),
    maxBet: Math.max(1, Math.round(Number(input.liveGamesMaxBet || 1000))),
    defaultBet: Math.max(1, Math.round(Number(input.liveGamesDefaultBet || 50))),
    cooldownSeconds: Math.max(0, Math.min(300, Math.round(Number(input.liveGamesCooldownSeconds ?? 8)))),
    currencyName: String(input.currencyName || 'Lunitas'),
    currencySymbol: String(input.currencySymbol || '🌙'),
    gameCommands: Array.isArray(input.liveGameCommands) ? input.liveGameCommands : []
  };
}

function gameEnabled(config, game) {
  const row = config.gameCommands.find((item) => String(item?.id || '') === game);
  return row ? row.enabled !== false : true;
}

class LiveGameManager {
  constructor(options = {}) {
    this.charge = options.charge;
    this.payout = options.payout;
    this.getConfig = options.getConfig;
    this.publish = options.publish || (() => {});
    this.rng = options.rng || null;
    this.now = options.now || (() => Date.now());
    this.cooldowns = new Map();
    this.blackjackHands = new Map();
  }

  async config() { return normalizeConfig(await this.getConfig()); }

  resultBase(details, game, config) {
    return {
      id: String(details.requestId || `${this.now()}-${secureRandomInt(1_000_000, this.rng)}`),
      game,
      user: normalizeUser(details.user),
      displayName: safeName(details.displayName || details.user),
      profilePictureUrl: String(details.profilePictureUrl || '').slice(0, 1000),
      timestamp: this.now(),
      currencyName: config.currencyName,
      currencySymbol: config.currencySymbol
    };
  }

  async emit(result) {
    await Promise.resolve(this.publish(result));
    return result;
  }

  checkReady(details, config, game, skipCooldown = false) {
    if (!config.enabled) return 'Los Juegos del LIVE están desactivados.';
    if (!GAME_IDS.has(game)) return 'Ese juego no existe.';
    if (!gameEnabled(config, game)) return 'Ese juego está desactivado.';
    if (!config.economyEnabled && !details.preview) return 'Activa Economía para usar apuestas con Lunitas.';
    const user = normalizeUser(details.user);
    if (!user) return 'No se pudo identificar al usuario.';
    if (!skipCooldown && !details.preview) {
      const until = this.cooldowns.get(user) || 0;
      if (until > this.now()) return `Espera ${Math.max(1, Math.ceil((until - this.now()) / 1000))} s para volver a jugar.`;
    }
    return '';
  }

  parseBet(details, config) {
    const raw = details.bet === '' || details.bet == null ? config.defaultBet : Math.round(Number(details.bet));
    if (!Number.isFinite(raw) || raw <= 0) return { ok:false, error:`La apuesta debe ser un número entre ${config.minBet} y ${config.maxBet}.` };
    if (raw < config.minBet || raw > config.maxBet) return { ok:false, error:`La apuesta permitida es de ${money(config.minBet, config)} a ${money(config.maxBet, config)}.` };
    return { ok:true, bet:raw };
  }

  markCooldown(user, config) {
    if (config.cooldownSeconds > 0) this.cooldowns.set(user, this.now() + config.cooldownSeconds * 1000);
  }

  async chargeBet(base, bet, game) {
    const tx = `game:${base.id}:${game}:bet`;
    const result = await this.charge({ ...base, amount:bet, transactionId:tx, reason:`${game}: apuesta` });
    if (!result?.ok) return { ok:false, error:`Saldo insuficiente. Tienes ${money(result?.balance || 0, base)}.`, balance:result?.balance || 0 };
    return { ok:true, balance:result.balance, transactionId:tx };
  }

  async pay(base, amount, game, reason) {
    const value = Math.max(0, Math.round(Number(amount) || 0));
    if (!value) return null;
    return this.payout({ ...base, amount:value, transactionId:`game:${base.id}:${game}:payout`, reason });
  }

  async play(details = {}) {
    const config = await this.config();
    const action = String(details.action || 'play').toLowerCase();
    const game = String(details.game || '').toLowerCase();
    if (game === 'blackjack' && ['hit','stand'].includes(action)) return this.blackjackAction(details, action, config);
    const error = this.checkReady(details, config, game, false);
    if (error) return { ok:false, error };
    const parsed = this.parseBet(details, config);
    if (!parsed.ok) return { ok:false, error:parsed.error };
    if (game === 'blackjack') return this.startBlackjack(details, parsed.bet, config);
    if (game === 'scratch') return this.playScratch(details, parsed.bet, config);
    if (game === 'roulette') return this.playRoulette(details, parsed.bet, config);
    if (game === 'dice') return this.playDice(details, parsed.bet, config);
    if (game === 'rps') return this.playRps(details, parsed.bet, config);
    if (game === 'slots') return this.playSlots(details, parsed.bet, config);
    return { ok:false, error:'Juego no disponible.' };
  }

  async startBlackjack(details, bet, config) {
    const base = this.resultBase(details, 'blackjack', config);
    if (this.blackjackHands.has(base.user)) return { ok:false, error:'Ya tienes una partida de Blackjack abierta. Usa !pedir o !plantar.' };
    let charge = { ok:true, balance:null };
    if (!details.preview) {
      charge = await this.chargeBet(base, bet, 'blackjack');
      if (!charge.ok) return charge;
      this.markCooldown(base.user, config);
    }
    const player = [drawCard(this.rng), drawCard(this.rng)];
    const dealer = [drawCard(this.rng), drawCard(this.rng)];
    const hand = { ...base, bet, player, dealer, balance:charge.balance, preview:Boolean(details.preview), startedAt:this.now(), timer:null };
    const playerValue = blackjackValue(player), dealerValue = blackjackValue(dealer);
    if (playerValue === 21 || dealerValue === 21) return this.settleBlackjack(hand, true);
    if (!details.preview) {
      hand.timer = setTimeout(() => { this.expireBlackjack(base.user, base.id).catch(() => {}); }, 90_000);
      this.blackjackHands.set(base.user, hand);
    }
    return this.emit({ ...base, ok:true, status:'pending', title:'Blackjack', bet, balance:charge.balance, playerCards:player.map(cardText), dealerCards:[cardText(dealer[0]), '🂠'], playerValue, dealerValue:null, payout:0, profit:0, detail:`Tus cartas: ${player.map(cardText).join(' ')} = ${playerValue}. Dealer: ${cardText(dealer[0])} 🂠.`, text:`${base.displayName} tiene ${playerValue} en Blackjack. Usa !pedir o !plantar.` });
  }

  async expireBlackjack(user, id) {
    const hand = this.blackjackHands.get(user);
    if (!hand || hand.id !== id) return;
    this.blackjackHands.delete(user);
    if (hand.timer) clearTimeout(hand.timer);
    let balance = hand.balance;
    if (!hand.preview) {
      const refund = await this.pay(hand, hand.bet, 'blackjack', 'Blackjack: partida expirada, apuesta devuelta');
      if (refund) balance = refund.balance;
    }
    await this.emit({ ...hand, ok:true, status:'push', title:'Blackjack', balance, payout:hand.bet, profit:0, playerCards:hand.player.map(cardText), dealerCards:hand.dealer.map(cardText), playerValue:blackjackValue(hand.player), dealerValue:blackjackValue(hand.dealer), detail:'La partida expiró y la apuesta fue devuelta.', text:`La partida de Blackjack de ${hand.displayName} expiró. Se devolvió ${money(hand.bet, hand)}.` });
  }

  async blackjackAction(details, action, config) {
    const user = normalizeUser(details.user);
    const hand = this.blackjackHands.get(user);
    if (!hand) return { ok:false, error:'No tienes una partida de Blackjack activa. Usa !blackjack cantidad.' };
    const error = this.checkReady(details, config, 'blackjack', true);
    if (error) return { ok:false, error };
    if (action === 'hit') {
      hand.player.push(drawCard(this.rng));
      const value = blackjackValue(hand.player);
      if (value >= 21) return this.settleBlackjack(hand, false);
      return this.emit({ ...hand, ok:true, status:'pending', title:'Blackjack', playerCards:hand.player.map(cardText), dealerCards:[cardText(hand.dealer[0]),'🂠'], playerValue:value, dealerValue:null, payout:0, profit:0, detail:`Carta nueva: ${cardText(hand.player[hand.player.length-1])}. Total ${value}.`, text:`${hand.displayName} pidió carta y ahora tiene ${value}. Usa !pedir o !plantar.` });
    }
    return this.settleBlackjack(hand, false);
  }

  async settleBlackjack(hand, naturalCheck = false) {
    const config = await this.config();
    if (hand.timer) clearTimeout(hand.timer);
    this.blackjackHands.delete(hand.user);
    let playerValue = blackjackValue(hand.player);
    let dealerValue = blackjackValue(hand.dealer);
    const playerNatural = hand.player.length === 2 && playerValue === 21;
    const dealerNatural = hand.dealer.length === 2 && dealerValue === 21;
    if (!naturalCheck && playerValue <= 21) {
      while (dealerValue < 17) { hand.dealer.push(drawCard(this.rng)); dealerValue = blackjackValue(hand.dealer); }
    }
    let status = 'loss', gross = 0;
    if (playerValue > 21) { status = 'loss'; }
    else if (playerNatural && !dealerNatural) { status = 'win'; gross = Math.round(hand.bet * 2.5); }
    else if (dealerNatural && !playerNatural) { status = 'loss'; }
    else if (dealerValue > 21 || playerValue > dealerValue) { status = 'win'; gross = hand.bet * 2; }
    else if (playerValue === dealerValue) { status = 'push'; gross = hand.bet; }
    let balance = hand.balance;
    if (!hand.preview && gross > 0) {
      const paid = await this.pay(hand, gross, 'blackjack', status === 'push' ? 'Blackjack: empate' : 'Blackjack: premio');
      if (paid) balance = paid.balance;
    }
    const profit = gross - hand.bet;
    const outcome = status === 'win' ? `ganó ${money(Math.max(0, profit), config)}` : status === 'push' ? 'empató y recuperó su apuesta' : `perdió ${money(hand.bet, config)}`;
    return this.emit({ ...hand, ok:true, status, title:'Blackjack', balance, payout:gross, profit, playerCards:hand.player.map(cardText), dealerCards:hand.dealer.map(cardText), playerValue, dealerValue, detail:`Jugador ${playerValue} · Dealer ${dealerValue}.`, text:`${hand.displayName} ${outcome} en Blackjack. ${hand.player.map(cardText).join(' ')} vs ${hand.dealer.map(cardText).join(' ')}.` });
  }

  async playScratch(details, bet, config) {
    const base = this.resultBase(details, 'scratch', config);
    let charge={ok:true,balance:null}; if(!details.preview){charge=await this.chargeBet(base,bet,'scratch');if(!charge.ok)return charge;this.markCooldown(base.user,config);}
    const picks=[weightedPick(SCRATCH_SYMBOLS,this.rng),weightedPick(SCRATCH_SYMBOLS,this.rng),weightedPick(SCRATCH_SYMBOLS,this.rng)];
    let gross=0; if(picks[0].symbol===picks[1].symbol&&picks[1].symbol===picks[2].symbol)gross=Math.round(bet*picks[0].multiplier); else if(picks[0].symbol===picks[1].symbol||picks[0].symbol===picks[2].symbol||picks[1].symbol===picks[2].symbol)gross=Math.round(bet*0.5);
    let balance=charge.balance;if(!details.preview&&gross){const paid=await this.pay(base,gross,'scratch','Rasca y gana: premio');if(paid)balance=paid.balance;}
    const profit=gross-bet,status=gross>bet?'win':gross===bet?'push':'loss';
    return this.emit({...base,ok:true,status,title:'Rasca y gana',bet,balance,payout:gross,profit,symbols:picks.map(x=>x.symbol),detail:picks.map(x=>x.symbol).join('  '),text:gross?`${base.displayName} rascó ${picks.map(x=>x.symbol).join(' ')} y recibió ${money(gross,config)}.`:`${base.displayName} rascó ${picks.map(x=>x.symbol).join(' ')} y no obtuvo premio esta vez.`});
  }

  async playRoulette(details, bet, config) {
    const choice=String(details.choice||'').trim().toLowerCase().replace('número','').replace('numero','');
    const exact=Number(choice); const valid=['rojo','negro','par','impar'].includes(choice)||(Number.isInteger(exact)&&exact>=0&&exact<=36);
    if(!valid)return{ok:false,error:'Usa !ruleta rojo 100, !ruleta negro 100, !ruleta par 100, !ruleta impar 100 o !ruleta 17 100.'};
    const base=this.resultBase(details,'roulette',config);let charge={ok:true,balance:null};if(!details.preview){charge=await this.chargeBet(base,bet,'roulette');if(!charge.ok)return charge;this.markCooldown(base.user,config);}
    const number=secureRandomInt(37,this.rng);const color=number===0?'verde':RED_ROULETTE.has(number)?'rojo':'negro';
    let won=false,multiplier=0;if(Number.isInteger(exact)&&exact>=0&&exact<=36){won=number===exact;multiplier=36;}else if(choice==='rojo'||choice==='negro'){won=color===choice;multiplier=2;}else if(choice==='par'){won=number!==0&&number%2===0;multiplier=2;}else if(choice==='impar'){won=number!==0&&number%2===1;multiplier=2;}
    const gross=won?bet*multiplier:0;let balance=charge.balance;if(!details.preview&&gross){const paid=await this.pay(base,gross,'roulette','Ruleta: premio');if(paid)balance=paid.balance;}
    return this.emit({...base,ok:true,status:won?'win':'loss',title:'Ruleta',bet,balance,payout:gross,profit:gross-bet,choice,rouletteNumber:number,rouletteColor:color,detail:`Salió ${number} ${color}. Apostó a ${choice}.`,text:won?`${base.displayName} acertó en la ruleta: salió ${number} ${color} y recibió ${money(gross,config)}.`:`${base.displayName} perdió en la ruleta. Salió ${number} ${color}.`});
  }

  async playDice(details, bet, config) {
    const base=this.resultBase(details,'dice',config);let charge={ok:true,balance:null};if(!details.preview){charge=await this.chargeBet(base,bet,'dice');if(!charge.ok)return charge;this.markCooldown(base.user,config);}
    const player=secureRandomInt(6,this.rng)+1,dealer=secureRandomInt(6,this.rng)+1;const status=player>dealer?'win':player===dealer?'push':'loss';const gross=status==='win'?bet*2:status==='push'?bet:0;let balance=charge.balance;if(!details.preview&&gross){const paid=await this.pay(base,gross,'dice',status==='push'?'Dados: empate':'Dados: premio');if(paid)balance=paid.balance;}
    return this.emit({...base,ok:true,status,title:'Dados',bet,balance,payout:gross,profit:gross-bet,dice:[player,dealer],detail:`🎲 ${player} vs 🎲 ${dealer}`,text:status==='win'?`${base.displayName} ganó en Dados ${player} contra ${dealer} y recibió ${money(gross,config)}.`:status==='push'?`${base.displayName} empató en Dados ${player} a ${dealer} y recuperó su apuesta.`:`${base.displayName} perdió en Dados ${player} contra ${dealer}.`});
  }

  async playRps(details, bet, config) {
    const aliases={p:'piedra',piedra:'piedra',papel:'papel',t:'tijera',tijera:'tijera',tijeras:'tijera'};const choice=aliases[String(details.choice||'').trim().toLowerCase()];if(!choice)return{ok:false,error:'Usa !ppt piedra 50, !ppt papel 50 o !ppt tijera 50.'};
    const base=this.resultBase(details,'rps',config);let charge={ok:true,balance:null};if(!details.preview){charge=await this.chargeBet(base,bet,'rps');if(!charge.ok)return charge;this.markCooldown(base.user,config);}
    const options=['piedra','papel','tijera'],bot=options[secureRandomInt(3,this.rng)];let status='push';if(choice!==bot){status=((choice==='piedra'&&bot==='tijera')||(choice==='papel'&&bot==='piedra')||(choice==='tijera'&&bot==='papel'))?'win':'loss';}const gross=status==='win'?bet*2:status==='push'?bet:0;let balance=charge.balance;if(!details.preview&&gross){const paid=await this.pay(base,gross,'rps',status==='push'?'PPT: empate':'PPT: premio');if(paid)balance=paid.balance;}
    const icon={piedra:'🪨',papel:'📄',tijera:'✂️'};return this.emit({...base,ok:true,status,title:'Piedra, papel o tijera',bet,balance,payout:gross,profit:gross-bet,choice,botChoice:bot,detail:`${icon[choice]} ${choice} vs ${icon[bot]} ${bot}`,text:status==='win'?`${base.displayName} ganó ${choice} contra ${bot} y recibió ${money(gross,config)}.`:status==='push'?`${base.displayName} empató: ${choice} contra ${bot}. Recuperó su apuesta.`:`${base.displayName} perdió: ${choice} contra ${bot}.`});
  }

  async playSlots(details, bet, config) {
    const base=this.resultBase(details,'slots',config);let charge={ok:true,balance:null};if(!details.preview){charge=await this.chargeBet(base,bet,'slots');if(!charge.ok)return charge;this.markCooldown(base.user,config);}
    const picks=[weightedPick(SLOT_SYMBOLS,this.rng),weightedPick(SLOT_SYMBOLS,this.rng),weightedPick(SLOT_SYMBOLS,this.rng)];let gross=0;if(picks[0].symbol===picks[1].symbol&&picks[1].symbol===picks[2].symbol)gross=Math.round(bet*picks[0].multiplier);else if(picks[0].symbol===picks[1].symbol||picks[0].symbol===picks[2].symbol||picks[1].symbol===picks[2].symbol)gross=Math.round(bet*0.5);let balance=charge.balance;if(!details.preview&&gross){const paid=await this.pay(base,gross,'slots','Tragamonedas: premio');if(paid)balance=paid.balance;}const status=gross>bet?'win':gross===bet?'push':'loss';return this.emit({...base,ok:true,status,title:'Tragamonedas',bet,balance,payout:gross,profit:gross-bet,symbols:picks.map(x=>x.symbol),detail:`│ ${picks.map(x=>x.symbol).join(' │ ')} │`,text:gross?`${base.displayName} sacó ${picks.map(x=>x.symbol).join(' ')} en Tragamonedas y recibió ${money(gross,config)}.`:`${base.displayName} sacó ${picks.map(x=>x.symbol).join(' ')} en Tragamonedas. Sin premio.`});
  }
}

module.exports = { LiveGameManager, normalizeConfig, blackjackValue, drawCard, weightedPick, RED_ROULETTE };
