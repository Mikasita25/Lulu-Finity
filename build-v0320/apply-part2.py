# PRELOAD.
pr=rep(pr,"  mutateEconomy: (details) => ipcRenderer.invoke('economy:mutate', details),\n","  mutateEconomy: (details) => ipcRenderer.invoke('economy:mutate', details),\n  playLiveGame: (details) => ipcRenderer.invoke('games:play', details),\n",'preload play')
pr=rep(pr,"  onStreamWidgetUpdate: (callback) => subscribe('widget:update', callback),\n","  onStreamWidgetUpdate: (callback) => subscribe('widget:update', callback),\n  onLiveGameResult: (callback) => subscribe('games:result', callback),\n",'preload game result')

# RENDERER state.
r=rep(r,"  streamWidgets: { playlist: {}, wallet: {} },","  streamWidgets: { playlist: {}, wallet: {}, game: {} },",'renderer widget state')
r=rep(r,"  tiktokChatFailureAt: 0\n};","  tiktokChatFailureAt: 0,\n  liveGameResults: [],\n  liveGameStats: { plays:0, wins:0, losses:0, pushes:0 }\n};",'renderer game state')

# RENDERER widget normalizer.
old="""async function refreshStreamWidgetInfo(type, refreshFrame=false) {
  const normalized=type==='wallet'?'wallet':'playlist';
  const prefix=normalized==='wallet'?'walletWidget':'playlistWidget';"""
new="""async function refreshStreamWidgetInfo(type, refreshFrame=false) {
  const normalized=['playlist','wallet','game'].includes(type)?type:'playlist';
  const prefix=normalized==='wallet'?'walletWidget':normalized==='game'?'gameWidget':'playlistWidget';"""
r=rep(r,old,new,'renderer widget info')
r=rep(r,"  const normalized=type==='wallet'?'wallet':'playlist';\n  const info=local?await api.copyStreamWidgetLocalUrl(normalized):await api.copyStreamWidgetUrl(normalized);","  const normalized=['playlist','wallet','game'].includes(type)?type:'playlist';\n  const info=local?await api.copyStreamWidgetLocalUrl(normalized):await api.copyStreamWidgetUrl(normalized);",'renderer copy widget')

# RENDERER game engine helpers inserted before processChat.
anchor="async function processChat(message, simulated = false) {\n"
game_code=r'''const LIVE_GAME_DEFINITIONS = Object.freeze([
  { id:'blackjack', label:'Blackjack', icon:'🃏', trigger:'!blackjack', help:'!blackjack 100 · después !pedir o !plantar' },
  { id:'scratch', label:'Rasca y gana', icon:'🎟️', trigger:'!rasca', help:'!rasca 50' },
  { id:'roulette', label:'Ruleta', icon:'🎡', trigger:'!ruleta', help:'!ruleta rojo 100 · negro/par/impar/número' },
  { id:'dice', label:'Dados', icon:'🎲', trigger:'!dados', help:'!dados 50' },
  { id:'rps', label:'Piedra, papel o tijera', icon:'✂️', trigger:'!ppt', help:'!ppt piedra 50' },
  { id:'slots', label:'Tragamonedas', icon:'🎰', trigger:'!slots', help:'!slots 50' }
]);

function normalizedLiveGameCommands() {
  const source = Array.isArray(state.settings?.liveGameCommands) ? state.settings.liveGameCommands : [];
  return LIVE_GAME_DEFINITIONS.map((definition) => {
    const saved = source.find((item) => String(item?.id || '') === definition.id) || {};
    let trigger = String(saved.trigger || definition.trigger).trim().toLowerCase();
    if (!trigger.startsWith('!')) trigger = `!${trigger}`;
    return { ...definition, trigger:trigger.slice(0,32), enabled:saved.enabled !== false };
  });
}

function parseLiveGameCommand(comment) {
  if (state.settings?.liveGamesEnabled === false) return null;
  const text = String(comment || '').trim();
  const lower = text.toLowerCase();
  if (lower === '!pedir' || lower === '!hit') return { game:'blackjack', action:'hit', args:'' };
  if (lower === '!plantar' || lower === '!stand') return { game:'blackjack', action:'stand', args:'' };
  const commands = normalizedLiveGameCommands().filter((item)=>item.enabled).sort((a,b)=>b.trigger.length-a.trigger.length);
  const command = commands.find((item)=>lower===item.trigger || lower.startsWith(`${item.trigger} `));
  if (!command) return null;
  return { game:command.id, action:'play', args:text.slice(command.trigger.length).trim(), command };
}

function gameArgs(match) {
  const tokens = String(match?.args || '').split(/\s+/).map((item)=>item.trim()).filter(Boolean);
  const numericIndex = tokens.findIndex((token)=>/^\d+$/.test(token));
  const bet = numericIndex >= 0 ? Number(tokens[numericIndex]) : null;
  const choice = tokens.filter((_token,index)=>index!==numericIndex).join(' ').toLowerCase();
  return { bet, choice };
}

function gameResultFlag(payload) {
  return payload?.status === 'win' ? 'GANÓ' : payload?.status === 'loss' ? 'PERDIÓ' : payload?.status === 'push' ? 'EMPATE' : 'JUGANDO';
}

function renderLiveGames() {
  if (!$('liveGamesEnabledInput')) return;
  $('liveGamesEnabledInput').checked = state.settings.liveGamesEnabled !== false;
  $('liveGamesMinBetInput').value = Math.max(1, Math.round(Number(state.settings.liveGamesMinBet || 10)));
  $('liveGamesMaxBetInput').value = Math.max(1, Math.round(Number(state.settings.liveGamesMaxBet || 1000)));
  $('liveGamesDefaultBetInput').value = Math.max(1, Math.round(Number(state.settings.liveGamesDefaultBet || 50)));
  $('liveGamesCooldownInput').value = Math.max(0, Math.round(Number(state.settings.liveGamesCooldownSeconds || 8)));
  $('liveGamesSpeakResultsInput').checked = state.settings.liveGamesSpeakResults === true;
  $('liveGamesChatResultsInput').checked = state.settings.liveGamesChatResults === true;
  const list = $('liveGamesList');
  if (list) list.innerHTML = normalizedLiveGameCommands().map((game)=>`<article class="panel live-game-card" data-game="${game.id}"><div class="live-game-icon">${game.icon}</div><div class="live-game-copy"><strong>${escapeHtml(game.label)}</strong><small>${escapeHtml(game.help)}</small></div><div class="live-game-command"><input class="live-game-trigger" value="${escapeHtml(game.trigger)}" maxlength="32"/><label class="switch"><input class="live-game-enabled" type="checkbox" ${game.enabled?'checked':''}/><span></span></label></div></article>`).join('');
  qsa('.live-game-card').forEach((card)=>{
    const gameId=card.dataset.game;
    const save=()=>{
      const commands=normalizedLiveGameCommands();
      const item=commands.find((entry)=>entry.id===gameId); if(!item)return;
      const input=card.querySelector('.live-game-trigger'); let trigger=String(input?.value||item.trigger).trim(); if(!trigger.startsWith('!'))trigger=`!${trigger}`;
      item.trigger=trigger.slice(0,32); item.enabled=card.querySelector('.live-game-enabled')?.checked!==false;
      state.settings.liveGameCommands=commands.map(({id,trigger,enabled})=>({id,trigger,enabled})); scheduleSave();
    };
    card.querySelector('.live-game-trigger')?.addEventListener('change',save);
    card.querySelector('.live-game-enabled')?.addEventListener('change',save);
  });
  const recent=$('liveGameResultsList');
  if (recent) recent.innerHTML=state.liveGameResults.length?state.liveGameResults.slice(0,20).map((item)=>`<div class="live-game-result-row"><div><strong>${escapeHtml(item.title||item.game||'Juego')} · ${escapeHtml(item.displayName||item.user||'Jugador')}</strong><small>${escapeHtml(item.detail||item.text||'')}</small></div><span class="game-result-pill ${escapeHtml(item.status||'pending')}">${gameResultFlag(item)}</span></div>`).join(''):'<div class="empty-state small"><span>Aún no hay partidas en esta sesión.</span></div>';
  if ($('liveGamePlayCount')) $('liveGamePlayCount').textContent=String(state.liveGameStats.plays||0);
  if ($('liveGameWinCount')) $('liveGameWinCount').textContent=String(state.liveGameStats.wins||0);
}

async function announceLiveGameResult(payload) {
  if (!payload?.id) return;
  if (state.liveGameResults.some((item)=>item.id===payload.id && item.timestamp===payload.timestamp && item.detail===payload.detail)) return;
  state.liveGameResults.unshift(payload); if(state.liveGameResults.length>50)state.liveGameResults.length=50;
  if (payload.status !== 'pending') {
    state.liveGameStats.plays += 1;
    if(payload.status==='win')state.liveGameStats.wins+=1;
    else if(payload.status==='loss')state.liveGameStats.losses+=1;
    else if(payload.status==='push')state.liveGameStats.pushes+=1;
  }
  renderLiveGames();
  if (state.settings.liveGamesSpeakResults === true && payload.text) speakText(String(payload.text).slice(0,220), false, null, null, { label:`Juego ${payload.title||''}` });
  if (state.settings.liveGamesChatResults === true && payload.text) {
    api.sendTikTokChat({ message:String(payload.text).slice(0,175), username:state.settings.username || $('usernameInput')?.value || '', cooldownSeconds:Math.max(5,Number(state.settings.tiktokAutoChatCooldownSeconds||8)) }).catch(()=>{});
  }
  refreshEconomy().catch(()=>{});
}

async function handleLiveGameCommand(match, message) {
  if (!match) return false;
  const { bet, choice } = gameArgs(match);
  try {
    const result = await api.playLiveGame({
      game:match.game, action:match.action, bet, choice,
      requestId:message.id, user:message.uniqueId, displayName:message.nickname,
      profilePictureUrl:message.profilePictureUrl || ''
    });
    if (!result?.ok) {
      updateCommentResult(message.id,'blocked',result?.error||'juego no disponible');
      toast('Juego no iniciado', result?.error || 'No se pudo jugar.', 'error');
      return true;
    }
    updateCommentResult(message.id,'game',gameResultFlag(result).toLowerCase());
    return true;
  } catch(error) {
    updateCommentResult(message.id,'skipped','error del juego');
    toast('Error en Juegos del LIVE',error?.message||String(error),'error');
    return true;
  }
}

'''+anchor
r=rep(r,anchor,game_code,'renderer games code')
