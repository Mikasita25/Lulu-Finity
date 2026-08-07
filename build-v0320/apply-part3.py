# processChat games after custom commands, before song.
old="""  const customCommand = findCommand(normalizedMessage.comment);
  if (customCommand) {
    await handleCustomCommand(customCommand, normalizedMessage);
    return;
  }

  const songRequest = parseSongCommand(normalizedMessage.comment);"""
new="""  const customCommand = findCommand(normalizedMessage.comment);
  if (customCommand) {
    await handleCustomCommand(customCommand, normalizedMessage);
    return;
  }

  const liveGameCommand = parseLiveGameCommand(normalizedMessage.comment);
  if (liveGameCommand) {
    await handleLiveGameCommand(liveGameCommand, normalizedMessage);
    return;
  }

  const songRequest = parseSongCommand(normalizedMessage.comment);"""
r=rep(r,old,new,'process game command')
# comment flag.
r=rep(r,"const flag = item.result === 'command'\n      ? '<span class=\"flag song\">COMANDO</span>'","const flag = item.result === 'game'\n      ? '<span class=\"flag song\">JUEGO</span>'\n      : item.result === 'command'\n      ? '<span class=\"flag song\">COMANDO</span>'",'game comment flag')

# populate game settings.
anchor="  if ($('spotifyRecommendedInput')) $('spotifyRecommendedInput').checked=settings.spotifyContinueRecommended!==false;\n  syncOutputs();"
game_pop="""  if ($('spotifyRecommendedInput')) $('spotifyRecommendedInput').checked=settings.spotifyContinueRecommended!==false;
  state.settings.liveGameCommands = normalizedLiveGameCommands().map(({id,trigger,enabled})=>({id,trigger,enabled}));
  renderLiveGames();
  syncOutputs();"""
r=rep(r,anchor,game_pop,'populate games')

# setup events game controls after economy.
anchor="""  $('economySetBtn')?.addEventListener('click',()=>adjustEconomyUser('set'));
  $('copyPlaylistWidgetUrlBtn')?.addEventListener('click',()=>copyStreamWidgetLink('playlist',false));"""
game_events="""  $('economySetBtn')?.addEventListener('click',()=>adjustEconomyUser('set'));
  $('liveGamesEnabledInput')?.addEventListener('change',()=>{state.settings.liveGamesEnabled=$('liveGamesEnabledInput').checked;scheduleSave();renderLiveGames();});
  for (const [id,key,min] of [['liveGamesMinBetInput','liveGamesMinBet',1],['liveGamesMaxBetInput','liveGamesMaxBet',1],['liveGamesDefaultBetInput','liveGamesDefaultBet',1],['liveGamesCooldownInput','liveGamesCooldownSeconds',0]]) {
    $(id)?.addEventListener('change',()=>{state.settings[key]=Math.max(min,Math.round(Number($(id).value||min)));if(state.settings.liveGamesMaxBet<state.settings.liveGamesMinBet)state.settings.liveGamesMaxBet=state.settings.liveGamesMinBet;if(state.settings.liveGamesDefaultBet<state.settings.liveGamesMinBet)state.settings.liveGamesDefaultBet=state.settings.liveGamesMinBet;if(state.settings.liveGamesDefaultBet>state.settings.liveGamesMaxBet)state.settings.liveGamesDefaultBet=state.settings.liveGamesMaxBet;scheduleSave();renderLiveGames();});
  }
  $('liveGamesSpeakResultsInput')?.addEventListener('change',()=>{state.settings.liveGamesSpeakResults=$('liveGamesSpeakResultsInput').checked;scheduleSave();});
  $('liveGamesChatResultsInput')?.addEventListener('change',()=>{state.settings.liveGamesChatResults=$('liveGamesChatResultsInput').checked;scheduleSave();});
  $('copyGameWidgetUrlBtn')?.addEventListener('click',()=>copyStreamWidgetLink('game',false));
  $('copyGameWidgetLocalUrlBtn')?.addEventListener('click',()=>copyStreamWidgetLink('game',true));
  $('refreshGameWidgetBtn')?.addEventListener('click',()=>refreshStreamWidgetInfo('game',true));
  $('copyPlaylistWidgetUrlBtn')?.addEventListener('click',()=>copyStreamWidgetLink('playlist',false));"""
r=rep(r,anchor,game_events,'game setup events')

# export summary games.
r=rep(r,"      economy: { enabled:state.settings.economyEnabled, currencyName:state.settings.currencyName, currencySymbol:state.settings.currencySymbol, rewards:normalizedEconomyRewards() },\n","      economy: { enabled:state.settings.economyEnabled, currencyName:state.settings.currencyName, currencySymbol:state.settings.currencySymbol, rewards:normalizedEconomyRewards() },\n      liveGames: { enabled:state.settings.liveGamesEnabled, minBet:state.settings.liveGamesMinBet, maxBet:state.settings.liveGamesMaxBet, defaultBet:state.settings.liveGamesDefaultBet, cooldownSeconds:state.settings.liveGamesCooldownSeconds, commands:normalizedLiveGameCommands().map(({id,trigger,enabled})=>({id,trigger,enabled})) },\n",'export games')

# overlay tunnel refresh game.
r=rep(r,"if(ready){refreshOverlayInfo();refreshRankingInfo(null,false);refreshStreamWidgetInfo('playlist',false);refreshStreamWidgetInfo('wallet',false);}","if(ready){refreshOverlayInfo();refreshRankingInfo(null,false);refreshStreamWidgetInfo('playlist',false);refreshStreamWidgetInfo('wallet',false);refreshStreamWidgetInfo('game',false);}",'tunnel game refresh')
# game event subscription.
r=rep(r,"  api.onStreamWidgetUpdate((payload)=>{if(!payload?.widget)return;state.streamWidgets[payload.widget]={...state.streamWidgets[payload.widget],snapshot:payload.snapshot};});\n  api.onChat((message) => processChat(message));","  api.onStreamWidgetUpdate((payload)=>{if(!payload?.widget)return;state.streamWidgets[payload.widget]={...state.streamWidgets[payload.widget],snapshot:payload.snapshot};});\n  api.onLiveGameResult((payload)=>announceLiveGameResult(payload));\n  api.onChat((message) => processChat(message));",'game subscription')

# init render games and refresh game widget.
r=rep(r,"  renderEconomy();\n  renderDashboardMusic();","  renderEconomy();\n  renderLiveGames();\n  await refreshStreamWidgetInfo('game',true);\n  renderDashboardMusic();",'init games')
# normalize settings near init.
r=rep(r,"  state.settings.hiddenDashboardPanels = Array.isArray(state.settings.hiddenDashboardPanels) ? state.settings.hiddenDashboardPanels : [];\n","  state.settings.hiddenDashboardPanels = Array.isArray(state.settings.hiddenDashboardPanels) ? state.settings.hiddenDashboardPanels : [];\n  state.settings.liveGameCommands = Array.isArray(state.settings.liveGameCommands) ? state.settings.liveGameCommands : LIVE_GAME_DEFINITIONS.map(({id,trigger})=>({id,trigger,enabled:true}));\n",'init game normalize')
