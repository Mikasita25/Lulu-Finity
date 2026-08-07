# HTML: nav item and page.
h=rep(h,"<button class=\"nav-item\" data-page=\"economy\"><span>☾</span>Economía</button>","<button class=\"nav-item\" data-page=\"games\"><span>♣</span>Juegos</button>\n<button class=\"nav-item\" data-page=\"economy\"><span>☾</span>Economía</button>",'games nav')
games_page=r'''<section class="page" id="page-games">
<div class="page-heading simple"><div><h1>Juegos del LIVE</h1><p>Los espectadores juegan con comandos usando únicamente las monedas virtuales de Lulu.</p></div><div class="heading-actions"><span class="count-pill"><b id="liveGamePlayCount">0</b> partidas</span><span class="count-pill"><b id="liveGameWinCount">0</b> victorias</span></div></div>
<div class="section-tabs category-section-tabs" data-category-tabs="games" role="tablist"><button class="section-tab active" data-category-tab="games" type="button">Juegos</button><button class="section-tab" data-category-tab="screen" type="button">Pantalla del stream</button><button class="section-tab" data-category-tab="results" type="button">Actividad</button></div>
<div class="category-section-pane active" data-category-pane="games" data-category-pane-group="games">
<div class="games-layout"><article class="panel games-config-card"><div class="setting-row top"><div><h3>Activar Juegos del LIVE</h3><p>Las apuestas usan Lunitas. No hay dinero real ni premios fuera de Lulu.</p></div><label class="switch"><input id="liveGamesEnabledInput" type="checkbox"/><span></span></label></div>
<div class="games-bet-grid"><div class="field-group"><label>Apuesta mínima</label><input id="liveGamesMinBetInput" min="1" max="1000000000" type="number" value="10"/></div><div class="field-group"><label>Apuesta predeterminada</label><input id="liveGamesDefaultBetInput" min="1" max="1000000000" type="number" value="50"/></div><div class="field-group"><label>Apuesta máxima</label><input id="liveGamesMaxBetInput" min="1" max="1000000000" type="number" value="1000"/></div><div class="field-group"><label>Cooldown por usuario</label><input id="liveGamesCooldownInput" min="0" max="300" type="number" value="8"/><small>Segundos entre partidas nuevas.</small></div></div>
<div class="game-output-options"><label class="setting-row compact"><span><strong>Leer resultados con TTS</strong><small>Lulu anuncia el resultado en voz alta.</small></span><span class="switch"><input id="liveGamesSpeakResultsInput" type="checkbox"/><span></span></span></label><label class="setting-row compact"><span><strong>Responder en el chat de TikTok</strong><small>Requiere la cuenta enlazada en Cuenta.</small></span><span class="switch"><input id="liveGamesChatResultsInput" type="checkbox"/><span></span></span></label></div></article>
<div class="live-games-list" id="liveGamesList"></div></div></div>
<div class="category-section-pane" data-category-pane="screen" data-category-pane-group="games"><div class="games-overlay-layout"><article class="panel stream-widget-card"><div class="panel-header"><div><h2>Pantalla de juego</h2><p class="hint">Muestra jugador, apuesta y resultado en TikTok LIVE Studio u OBS.</p></div><button class="ghost tiny" id="refreshGameWidgetBtn">Actualizar</button></div><div class="stream-widget-preview game-widget-preview"><iframe id="gameWidgetPreviewFrame" title="Vista previa de Juegos del LIVE"></iframe></div><div class="ranking-link-row"><input id="gameWidgetUrlOutput" readonly value="Preparando enlace HTTPS..."/><button class="primary" id="copyGameWidgetUrlBtn">Copiar HTTPS</button></div><div class="ranking-link-row ranking-local-row"><input id="gameWidgetLocalUrlOutput" readonly value="Preparando enlace local..."/><button class="ghost" id="copyGameWidgetLocalUrlBtn">Copiar local para OBS</button></div><small class="overlay-status" id="gameWidgetStatus">Sin fuente conectada</small><small>Resolución recomendada: 700 × 280.</small></article><article class="panel games-help-card"><h2>Cómo juegan</h2><div class="game-help-lines"><p><strong>🃏 Blackjack:</strong> <code>!blackjack 100</code>, luego <code>!pedir</code> o <code>!plantar</code>.</p><p><strong>🎟️ Rasca:</strong> <code>!rasca 50</code>.</p><p><strong>🎡 Ruleta:</strong> <code>!ruleta rojo 100</code>, negro, par, impar o un número.</p><p><strong>🎲 Dados:</strong> <code>!dados 50</code>.</p><p><strong>✂️ PPT:</strong> <code>!ppt piedra 50</code>.</p><p><strong>🎰 Slots:</strong> <code>!slots 50</code>.</p></div></article></div></div>
<div class="category-section-pane" data-category-pane="results" data-category-pane-group="games"><article class="panel games-results-card"><div class="panel-header"><div><h2>Resultados recientes</h2><p class="hint">Actividad de esta sesión. Los cobros y premios también aparecen en Economía.</p></div></div><div id="liveGameResultsList" class="live-game-results"></div></article></div>
</section>
'''
h=rep(h,"<section class=\"page\" id=\"page-economy\">",games_page+"<section class=\"page\" id=\"page-economy\">",'games page')
# version labels.
h=h.replace('v0.29.0','v0.32.0')

# CSS append.
s += r'''

/* Juegos del LIVE */
.games-layout,.games-overlay-layout{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(300px,.8fr);gap:16px}.games-config-card{grid-column:1/-1}.games-bet-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-top:14px}.game-output-options{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:14px}.live-games-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;grid-column:1/-1}.live-game-card{display:grid;grid-template-columns:54px minmax(0,1fr) minmax(160px,.55fr);gap:12px;align-items:center;padding:15px}.live-game-icon{width:52px;height:52px;display:grid;place-items:center;border-radius:16px;background:rgba(255,255,255,.07);font-size:27px}.live-game-copy strong,.live-game-copy small{display:block}.live-game-copy strong{font-size:16px}.live-game-copy small{margin-top:5px;color:var(--muted);line-height:1.35}.live-game-command{display:flex;align-items:center;gap:9px}.live-game-command input{min-width:0}.game-widget-preview{height:270px}.games-help-card{padding:18px}.game-help-lines{display:flex;flex-direction:column;gap:10px;margin-top:12px}.game-help-lines p{margin:0;color:var(--muted);line-height:1.5}.game-help-lines code{color:var(--text);background:rgba(255,255,255,.08);padding:2px 6px;border-radius:6px}.games-results-card{padding:18px}.live-game-results{display:flex;flex-direction:column;gap:9px}.live-game-result-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 14px;border:1px solid var(--line);border-radius:13px;background:rgba(255,255,255,.035)}.live-game-result-row strong,.live-game-result-row small{display:block}.live-game-result-row small{margin-top:4px;color:var(--muted)}.game-result-pill{padding:5px 9px;border-radius:999px;font-size:11px;font-weight:900;background:rgba(255,255,255,.08)}.game-result-pill.win{color:#67f2ad;background:rgba(56,200,126,.13)}.game-result-pill.loss{color:#ff7894;background:rgba(255,74,110,.12)}.game-result-pill.push{color:#ffe07d;background:rgba(255,211,85,.12)}.game-result-pill.pending{color:#7eeeff;background:rgba(37,244,238,.10)}
@media(max-width:1100px){.games-layout,.games-overlay-layout{grid-template-columns:1fr}.games-bet-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.live-games-list{grid-template-columns:1fr}.games-config-card{grid-column:auto}.game-output-options{grid-template-columns:1fr}}
@media(max-width:680px){.games-bet-grid{grid-template-columns:1fr}.live-game-card{grid-template-columns:48px minmax(0,1fr)}.live-game-command{grid-column:1/-1}.game-output-options{grid-template-columns:1fr}}
'''

# Package + changelog.
p['version']='0.32.0'
entry="""# Cambios

## 0.32.0

- Retira por completo **Voces divertidas** y el proveedor externo StreamElements; Voz TTS vuelve al sistema anterior de Lulu.
- Añade **Juegos del LIVE** con comandos y apuestas usando únicamente la moneda virtual configurada en Economía.
- Incluye Blackjack interactivo (`!blackjack`, `!pedir`, `!plantar`), Rasca y gana, Ruleta, Dados, Piedra/Papel/Tijera y Tragamonedas.
- Permite configurar comandos, activar/desactivar cada juego, apuesta mínima/máxima/predeterminada y cooldown por usuario.
- Añade una pantalla HTTPS/local para el stream que muestra jugador, apuesta, cartas/símbolos y resultado en tiempo real.
- Los cobros y premios pasan por la economía de Lulu y quedan registrados en el historial de movimientos.
- Los resultados pueden anunciarse opcionalmente por TTS y por el chat de TikTok enlazado.
- Mantiene el anti anuncios avanzado de YouTube, Railway, overlays, rankings, rollback a 0.27 y correcciones de arranque.

"""
c=entry+c

# Write.
main.write_text(m,encoding='utf-8'); rend.write_text(r,encoding='utf-8'); html.write_text(h,encoding='utf-8'); css.write_text(s,encoding='utf-8'); pre.write_text(pr,encoding='utf-8'); pkg.write_text(json.dumps(p,ensure_ascii=False,indent=2)+'\n',encoding='utf-8'); ch.write_text(c,encoding='utf-8')
print('patched 0.32.0')
