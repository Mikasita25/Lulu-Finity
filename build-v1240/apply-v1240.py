from pathlib import Path
import sys,json,shutil
ROOT=Path(sys.argv[1] if len(sys.argv)>1 else 'app').resolve()
FILES=Path(__file__).parent/'files'
def patch(name,old,new):
 p=ROOT/name;s=p.read_text(encoding='utf-8')
 if s.count(old)!=1:raise RuntimeError(f'{name}: expected one anchor {old[:80]!r}, found {s.count(old)}')
 p.write_text(s.replace(old,new,1),encoding='utf-8')
for p in FILES.rglob('*'):
 if p.is_file() and '.gz.' not in p.name:
  dst=ROOT/p.relative_to(FILES);dst.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(p,dst)
animation=b''.join((FILES/('src/roulette.html.gz.'+part)).read_bytes() for part in ['00','01'])
(ROOT/'src/roulette.html.gz').write_bytes(animation)
(ROOT/'railway-relay/src/roulette.html.gz').write_bytes(animation)
for name in ['package.json','package-lock.json']:
 p=ROOT/name;data=json.loads(p.read_text(encoding='utf-8'));assert data['version']=='1.2.3'
 data['version']='1.2.4'
 if name.endswith('lock.json'):data['packages']['']['version']='1.2.4'
 p.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
patch('src/live-games.js',"const GAME_IDS =", "const { normalizeColorRoulette, validateColorRoulette, pickColor, DURATION_MS } = require('./color-roulette');\nconst GAME_IDS =")
patch('src/live-games.js','    gameCommands: Array.isArray(input.liveGameCommands)', '    roulette: normalizeColorRoulette(input.colorRoulette),\n    gameCommands: Array.isArray(input.liveGameCommands)')
patch('src/live-games.js','    this.cooldowns = new Map();','    this.rouletteUntil = 0;\n    this.rouletteCooldowns = new Map();\n    this.rouletteRequests = new Map();\n    this.cooldowns = new Map();')
patch('src/live-games.js',"    if (!config.economyEnabled && !details.preview)","    if (game !== 'roulette' && !config.economyEnabled && !details.preview)")
patch('src/live-games.js','    if (!skipCooldown && !details.preview) {','    if (game !== \'roulette\' && !skipCooldown && !details.preview) {')
patch('src/live-games.js',"    const parsed = this.parseBet(details, config);", "    if (game === 'roulette') return this.playColorRoulette(details, config);\n    const parsed = this.parseBet(details, config);")
patch('src/live-games.js','  async playRoulette(details, bet, config) {',r'''  async playColorRoulette(details, config) {
    const cfg = config.roulette;
    const invalid = validateColorRoulette(cfg);
    if (invalid) return { ok:false, error:invalid };
    const now = this.now(), user = normalizeUser(details.user);
    for (const [id, entry] of this.rouletteRequests) if (now - entry.at > 86400000) this.rouletteRequests.delete(id);
    const requestId = String(details.requestId || '');
    if (requestId && this.rouletteRequests.has(requestId)) return { ok:false, error:'Este comando ya fue procesado.' };
    if (this.rouletteUntil > now) return { ok:false, error:'La ruleta está girando. Espera a que termine.' };
    const cooldownKey = cfg.cooldownScope === 'global' ? '*' : user;
    const until = this.rouletteCooldowns.get(cooldownKey) || 0;
    if (!details.preview && until > now) return { ok:false, error:`Espera ${Math.ceil((until-now)/1000)} s para usar la ruleta.` };
    if (!details.preview && !config.economyEnabled && (cfg.cost > 0 || cfg.colors.some(row => row.amount > 0 && row.probability > 0))) return { ok:false, error:'Activa Economía para cobrar y entregar premios en Lunitas, o configura las cantidades en 0.' };
    const totalMs = DURATION_MS + cfg.resultSeconds * 1000;
    this.rouletteUntil = now + totalMs;
    if (requestId) this.rouletteRequests.set(requestId, {at:now});
    const previousCooldown = until;
    if (!details.preview) this.rouletteCooldowns.set(cooldownKey, now + cfg.cooldownSeconds * 1000);
    let paid = false, charged = false;
    const base = this.resultBase(details, 'roulette', config);
    try {
      const selected = pickColor(cfg, max => secureRandomInt(max, this.rng));
      let balance = null;
      if (!details.preview && cfg.cost > 0) {
        const charge = await this.chargeBet(base, cfg.cost, 'roulette');
        if (!charge.ok) throw new Error(charge.error);
        charged = true; balance = charge.balance;
      }
      if (!details.preview && selected.amount > 0) {
        const payment = await this.pay(base, selected.amount, 'roulette', `Ruleta ${selected.name}: premio`);
        if (!payment?.ok) throw new Error('No se pudo entregar el premio.');
        paid = true; balance = payment.balance;
      }
      const animationStartedAt = this.now() + 1200;
      this.rouletteUntil = animationStartedAt + totalMs;
      return await this.emit({ ...base, timestamp:animationStartedAt, ok:true, status:'win', title:'Ruleta de colores',
        bet:cfg.cost, payout:selected.amount, profit:selected.amount-cfg.cost, balance, rouletteIndex:selected.index,
        rouletteColor:selected.name, prize:selected.prize || 'Sin premio', animationStartedAt,
        animationDurationMs:DURATION_MS, resultSeconds:cfg.resultSeconds, expiresAt:this.rouletteUntil,
        detail:`${selected.name} · ${selected.prize || 'Sin premio'}`,
        text:`${base.displayName}: salió ${selected.name}. ${selected.prize || 'Sin premio'}${selected.amount ? ` · ${money(selected.amount,config)}` : ''}.` });
    } catch (error) {
      if (charged && !paid) {
        const refund = await this.payout({ ...base, amount:cfg.cost, transactionId:`game:${base.id}:roulette:refund`, reason:'Ruleta: giro no iniciado, costo devuelto' });
        if (!refund?.ok) return {ok:false,error:'No se pudo iniciar la ruleta ni devolver el costo; revisa la transacción en Economía.'};
      }
      if (!paid) { this.rouletteUntil = 0; this.rouletteCooldowns.set(cooldownKey, previousCooldown); if(requestId)this.rouletteRequests.delete(requestId); }
      return { ok:false, error:error?.message || 'No se pudo iniciar la ruleta.' };
    }
  }

  async playRoulette(details, bet, config) {''')
patch('src/main.js','  liveGamesMigratedV032: false,','  colorRoulette: { cost:0, cooldownSeconds:30, cooldownScope:\'user\', resultSeconds:3 },\n  liveGamesMigratedV032: false,')
patch('src/main.js','expiresAt:Date.now() + (pending ? 95_000 : 12_000)','expiresAt:result?.animationDurationMs ? result.expiresAt : Date.now() + (pending ? 95_000 : 12_000)')
# Protect cooldowns and event deduplication against the idle-module release.
p=ROOT/'src/main.js';s=p.read_text(encoding='utf-8');s=s.replace("Boolean(liveGameManager?.blackjackHands?.size)","Boolean(liveGameManager?.blackjackHands?.size || liveGameManager?.rouletteRequests?.size || liveGameManager?.rouletteUntil > Date.now())");p.write_text(s,encoding='utf-8')
patch('src/main.js',"      if (url.pathname === '/widget') {", "      if (url.pathname === '/roulette.html') {\n        response.writeHead(200, { 'Content-Type':'text/html; charset=utf-8', 'Cache-Control':'public, max-age=3600' });\n        response.end(require('zlib').gunzipSync(fs.readFileSync(path.join(__dirname,'roulette.html.gz')))); return;\n      }\n      if (url.pathname === '/widget') {")
bridge=(FILES/'src/roulette-overlay-bridge.js').read_text(encoding='utf-8')
patch('src/main.js',"  function renderGame(data){hideAll();", "  " + bridge.replace('ROULETTE_FRAME_URL',"'/roulette.html?token='+encodeURIComponent("+'${safeToken}'+")") + "\n  function renderGame(data){hideAll();if(data.game==='roulette'&&Number.isInteger(data.rouletteIndex)){showColorRoulette(data);return;}")
patch('src/main.js','function hideAll(){clearTimeout(hideTimer);','function hideAll(){stopColorRoulette();clearTimeout(hideTimer);')
patch('src/main.js',"  next.automationRules = Array.isArray(next.automationRules)", "  const colorConfig = require('./color-roulette');\n  next.colorRoulette = colorConfig.normalizeColorRoulette(next.colorRoulette);\n  const rouletteError = colorConfig.validateColorRoulette(next.colorRoulette);\n  if (rouletteError) throw new Error(rouletteError);\n  next.automationRules = Array.isArray(next.automationRules)")
patch('src/renderer.js',"help:'!ruleta rojo 100 · negro/par/impar/número'", "help:'!ruleta · 8 colores con premios configurables'")
patch('src/renderer.js',"function renderLiveGames() {",(FILES/'src/roulette-settings-ui.js').read_text(encoding='utf-8')+"\nfunction renderLiveGames() {")
patch('src/renderer.js',"  const recent=$('liveGameResultsList');", "  renderColorRouletteSettings();\n  const recent=$('liveGameResultsList');")
patch('src/renderer.js',"  if (state.settings.liveGamesSpeakResults === true && payload.text)","  if (payload.animationDurationMs && !payload.animationAnnounced) {\n    setTimeout(()=>announceColorRouletteResult(payload), Math.max(0, Number(payload.animationStartedAt)+Number(payload.animationDurationMs)-Date.now()));\n    refreshEconomy().catch(()=>{}); return;\n  }\n  if (state.settings.liveGamesSpeakResults === true && payload.text)")
patch('src/index.html','<strong>🎡 Ruleta:</strong> <code>!ruleta rojo 100</code>, negro, par, impar o un número.', '<strong>🎡 Ruleta:</strong> <code>!ruleta</code>. Sortea uno de los 8 colores y entrega el premio configurado.')
patch('src/index.html','Resolución recomendada: 700 × 280. El tema elegido viaja dentro del enlace.','Para la ruleta usa una fuente web de 960 × 960 con fondo transparente. Copia este enlace en TikTok Studio; aparece con el comando y desaparece al terminar.')
p=ROOT/'src/index.html';p.write_text(p.read_text(encoding='utf-8').replace('v1.2.3','v1.2.4'),encoding='utf-8')
patch('railway-relay/src/overlay-page.js',"connect-src 'self';", "connect-src 'self'; frame-src 'self';")
patch('railway-relay/src/overlay-page.js',"  function renderGame(data){hideRoot();", "  "+bridge.replace('ROULETTE_FRAME_URL',"'/roulette.html'")+"\n  function renderGame(data){hideRoot();if(data.game==='roulette'&&Number.isInteger(data.rouletteIndex)){showColorRoulette(data);return;}")
patch('railway-relay/src/overlay-page.js','const hideRoot=()=>{clearTimeout(hideTimer);','const hideRoot=()=>{stopColorRoulette();clearTimeout(hideTimer);')
patch('railway-relay/src/server.js',"    if (request.method === 'GET' && url.pathname === '/health') {", "    if (request.method === 'GET' && url.pathname === '/roulette.html') {\n      response.writeHead(200, { 'Content-Type':'text/html; charset=utf-8', 'Cache-Control':'public, max-age=3600', 'Content-Security-Policy':\"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; media-src data:; frame-ancestors 'self'\" });\n      response.end(require('zlib').gunzipSync(require('fs').readFileSync(require('path').join(__dirname,'roulette.html.gz')))); return;\n    }\n    if (request.method === 'GET' && url.pathname === '/health') {")
print('Lulu Finity 1.2.4: ruleta de 8 colores integrada.')

patch('src/runtime-regression.test.js', r"expiresAt:Date\.now\(\) \+ \(pending \? 95_000 : 12_000\)", r"expiresAt:result\?\.animationDurationMs \? result\.expiresAt : Date\.now\(\) \+ \(pending \? 95_000 : 12_000\)")

p=ROOT/'src/live-games.js';s=p.read_text(encoding='utf-8');a=s.index('  async playRoulette(');b=s.index('  async playDice(',a);s=s[:a]+s[b:];s=s.replace("    if (game === 'roulette') return this.playRoulette(details, parsed.bet, config);\n",'');p.write_text(s,encoding='utf-8')
