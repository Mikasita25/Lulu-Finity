# Add game engine module.
(root/'src/live-games.js').write_text((Path(__file__).parent/'live-games.js').read_text(encoding='utf-8'), encoding='utf-8')

# MAIN: import manager and state.
m=rep(m,"const WebSocket = require('ws');\n","const WebSocket = require('ws');\nconst { LiveGameManager } = require('./live-games');\n",'manager import')
m=rep(m,"let rankingBroadcastTimer = null;\n","let rankingBroadcastTimer = null;\nlet liveGameManager = null;\n",'manager state')

# MAIN: defaults.
anchor="  economyMigratedV014: false,\n"
games_defaults="""  liveGamesEnabled: true,
  liveGamesMinBet: 10,
  liveGamesMaxBet: 1000,
  liveGamesDefaultBet: 50,
  liveGamesCooldownSeconds: 8,
  liveGamesSpeakResults: false,
  liveGamesChatResults: false,
  liveGameCommands: [
    { id:'blackjack', trigger:'!blackjack', enabled:true },
    { id:'scratch', trigger:'!rasca', enabled:true },
    { id:'roulette', trigger:'!ruleta', enabled:true },
    { id:'dice', trigger:'!dados', enabled:true },
    { id:'rps', trigger:'!ppt', enabled:true },
    { id:'slots', trigger:'!slots', enabled:true }
  ],
  liveGamesMigratedV032: false,
"""+anchor
m=rep(m,anchor,games_defaults,'game defaults')

# MAIN: widget type.
m=rep(m,"const STREAM_WIDGET_TYPES = new Set(['playlist', 'wallet']);","const STREAM_WIDGET_TYPES = new Set(['playlist', 'wallet', 'game']);",'game widget type')

# MAIN: widget snapshot game.
anchor="""  if (preview) return {
    type:'playlist', id:'playlist-preview', updatedAt:Date.now(), provider:'YouTube',
"""
game_snapshot="""  if (normalized === 'game') {
    if (preview) return { type:'game', id:'game-preview', updatedAt:Date.now(), title:'Blackjack', displayName:'Lulu Fan', user:'lulu_fan', status:'win', bet:100, payout:200, profit:100, detail:'A♠ K♥ = 21 · Dealer 19', text:'Lulu Fan ganó 100 Lunitas en Blackjack.', currencyName:'Lunitas', currencySymbol:'🌙', playerCards:['A♠','K♥'], dealerCards:['10♦','9♣'] };
    return { type:'game', id:'game-empty', updatedAt:0, title:'Juegos del LIVE', displayName:'Esperando jugador', user:'', status:'pending', bet:0, payout:0, profit:0, detail:'Usa un comando de juego en el chat.', text:'Esperando una partida.', currencyName:'Lunitas', currencySymbol:'🌙' };
  }
"""+anchor
m=rep(m,anchor,game_snapshot,'game widget snapshot')

# MAIN: widget CSS/HTML/JS.
old_css=".balance{text-align:right;white-space:nowrap}.balance strong{display:block;font-size:25px;color:#ffe07d;text-shadow:0 0 12px rgba(255,224,125,.25)}.balance small{font-size:11px;color:rgba(255,255,255,.65)}@keyframes flow"
new_css=".balance{text-align:right;white-space:nowrap}.balance strong{display:block;font-size:25px;color:#ffe07d;text-shadow:0 0 12px rgba(255,224,125,.25)}.balance small{font-size:11px;color:rgba(255,255,255,.65)}.game{width:min(620px,100%);border-radius:24px;padding:18px}.game-player{display:flex;align-items:center;justify-content:space-between;gap:14px}.game-copy strong,.game-copy small{display:block}.game-copy strong{font-size:22px}.game-copy small{margin-top:4px;color:rgba(255,255,255,.65)}.game-result{margin-top:13px;padding:15px;border-radius:17px;background:rgba(255,255,255,.075);border:1px solid rgba(255,255,255,.1);font-size:22px;font-weight:850;letter-spacing:.02em}.game-result.win{box-shadow:inset 0 0 0 1px rgba(81,255,166,.22)}.game-result.loss{box-shadow:inset 0 0 0 1px rgba(255,89,122,.24)}.game-meta{display:flex;justify-content:space-between;gap:12px;margin-top:11px;color:rgba(255,255,255,.73);font-size:13px}.game-payout{font-weight:900;color:#ffe07d}@keyframes flow"
m=rep(m,old_css,new_css,'widget game css')
old_html="</section><section id=\"walletCard\" class=\"card wallet hidden\"><div id=\"avatar\" class=\"avatar\">L</div><div class=\"wallet-name\"><strong id=\"displayName\">Esperando usuario</strong><small id=\"username\">@usuario</small></div><div class=\"balance\"><strong id=\"balance\">0</strong><small id=\"currency\">Lunitas</small></div></section><script>"
new_html="</section><section id=\"walletCard\" class=\"card wallet hidden\"><div id=\"avatar\" class=\"avatar\">L</div><div class=\"wallet-name\"><strong id=\"displayName\">Esperando usuario</strong><small id=\"username\">@usuario</small></div><div class=\"balance\"><strong id=\"balance\">0</strong><small id=\"currency\">Lunitas</small></div></section><section id=\"gameCard\" class=\"card game hidden\"><div class=\"head\"><strong id=\"gameTitle\">Juegos del LIVE</strong><span class=\"badge\" id=\"gameBadge\">LIVE</span></div><div class=\"game-player\"><div class=\"game-copy\"><strong id=\"gamePlayer\">Esperando jugador</strong><small id=\"gameUser\">@usuario</small></div><div class=\"game-payout\" id=\"gamePayout\">🌙 0</div></div><div class=\"game-result\" id=\"gameResult\">Usa un comando de juego en el chat.</div><div class=\"game-meta\"><span id=\"gameBet\">Apuesta: —</span><span id=\"gameStatus\">Esperando</span></div></section><script>"
m=rep(m,old_html,new_html,'widget game html')
m=rep(m,"const playlistCard=document.getElementById('playlistCard'),walletCard=document.getElementById('walletCard');","const playlistCard=document.getElementById('playlistCard'),walletCard=document.getElementById('walletCard'),gameCard=document.getElementById('gameCard');",'widget vars')
m=rep(m,"function renderPlaylist(data){playlistCard.classList.remove('hidden');walletCard.classList.add('hidden');","function renderPlaylist(data){playlistCard.classList.remove('hidden');walletCard.classList.add('hidden');gameCard.classList.add('hidden');",'playlist hides game')
m=rep(m,"function renderWallet(data){walletCard.classList.remove('hidden');playlistCard.classList.add('hidden');","function renderWallet(data){walletCard.classList.remove('hidden');playlistCard.classList.add('hidden');gameCard.classList.add('hidden');",'wallet hides game')
old_render="function render(data){if(widget==='wallet')renderWallet(data);else renderPlaylist(data)}"
new_render="""function renderGame(data){gameCard.classList.remove('hidden');playlistCard.classList.add('hidden');walletCard.classList.add('hidden');document.getElementById('gameTitle').textContent=text(data.title,'Juegos del LIVE');document.getElementById('gameBadge').textContent=data.status==='win'?'GANÓ':data.status==='loss'?'PERDIÓ':data.status==='push'?'EMPATE':'JUGANDO';document.getElementById('gamePlayer').textContent=text(data.displayName||data.user,'Esperando jugador');document.getElementById('gameUser').textContent=data.user?'@'+text(data.user):'Comandos activos';const symbol=text(data.currencySymbol,'🌙');document.getElementById('gamePayout').textContent=Number(data.payout||0)>0?symbol+' '+Number(data.payout||0).toLocaleString('es-MX'):symbol+' 0';const result=document.getElementById('gameResult');result.textContent=text(data.detail||data.text,'Usa un comando de juego en el chat.');result.className='game-result '+text(data.status,'pending');document.getElementById('gameBet').textContent=Number(data.bet||0)>0?'Apuesta: '+symbol+' '+Number(data.bet).toLocaleString('es-MX'):'Apuesta: —';document.getElementById('gameStatus').textContent=data.status==='win'?'Victoria':data.status==='loss'?'Derrota':data.status==='push'?'Empate':'En juego'}
  function render(data){if(widget==='wallet')renderWallet(data);else if(widget==='game')renderGame(data);else renderPlaylist(data)}"""
m=rep(m,old_render,new_render,'widget game render')

# MAIN: manager factory after streamWidgetInfo.
anchor="""async function streamWidgetInfo(type = 'playlist', forceTunnel = false) {
  await startOverlayServer();
"""
# insert factory after function end via known following ranking const
following="\n\nconst RANKING_TYPES = new Set(['coins','likes','economy','gifts','comments','shares','follows','members','subscribes','fanStickers']);"
factory="""

function getLiveGameManager() {
  if (liveGameManager) return liveGameManager;
  liveGameManager = new LiveGameManager({
    getConfig: async () => ({ ...DEFAULT_SETTINGS, ...(await readJson(getDataPaths().settings, DEFAULT_SETTINGS)) }),
    charge: async (details) => mutateEconomy({ mode:'charge', user:details.user, displayName:details.displayName, profilePictureUrl:details.profilePictureUrl, amount:details.amount, reason:details.reason, transactionId:details.transactionId }),
    payout: async (details) => mutateEconomy({ mode:'add', user:details.user, displayName:details.displayName, profilePictureUrl:details.profilePictureUrl, amount:details.amount, reason:details.reason, transactionId:details.transactionId }),
    publish: async (result) => {
      setStreamWidgetState('game', { ...result, type:'game' });
      send('games:result', result);
    }
  });
  return liveGameManager;
}
"""+following
m=rep(m,following,factory,'manager factory')

# MAIN: app state widgets and settings save and IPC.
m=rep(m,"widgets: { playlist: await streamWidgetInfo('playlist'), wallet: await streamWidgetInfo('wallet') }","widgets: { playlist: await streamWidgetInfo('playlist'), wallet: await streamWidgetInfo('wallet'), game: await streamWidgetInfo('game') }",'app widgets')
m=rep(m,"  next.customCommands = Array.isArray(next.customCommands) ? next.customCommands : DEFAULT_SETTINGS.customCommands;\n","  next.customCommands = Array.isArray(next.customCommands) ? next.customCommands : DEFAULT_SETTINGS.customCommands;\n  next.liveGameCommands = Array.isArray(next.liveGameCommands) ? next.liveGameCommands : DEFAULT_SETTINGS.liveGameCommands;\n",'save games')
m=rep(m,"ipcMain.handle('economy:mutate', async (_event, details) => mutateEconomy(details));\n","ipcMain.handle('economy:mutate', async (_event, details) => mutateEconomy(details));\nipcMain.handle('games:play', async (_event, details) => getLiveGameManager().play(details || {}));\n",'games ipc')
