from pathlib import Path
import json, sys
root=Path(sys.argv[1])
main=root/'src/main.js'; rend=root/'src/renderer.js'; html=root/'src/index.html'; pkg=root/'package.json'; pre=root/'src/preload.js'; ch=root/'CHANGELOG.md'
m=main.read_text(encoding='utf-8'); r=rend.read_text(encoding='utf-8'); h=html.read_text(encoding='utf-8'); p=json.loads(pkg.read_text(encoding='utf-8')); c=ch.read_text(encoding='utf-8')

def rep(text,a,b,label):
    if a not in text: raise SystemExit(f'missing anchor {label}')
    return text.replace(a,b,1)

# main constants/provider list
anchor="const FALLBACK_ONLINE_VOICES = [\n"
stream_code="""const STREAM_ELEMENTS_TTS_URL = 'https://api.streamelements.com/kappa/v2/speech';
const STREAM_ELEMENTS_VOICES = [
  ['Mia', 'Mia', 'es-MX', 'Female'],
  ['Miguel', 'Miguel', 'es-US', 'Male'],
  ['Penelope', 'Penélope', 'es-US', 'Female'],
  ['Conchita', 'Conchita', 'es-ES', 'Female'],
  ['Enrique', 'Enrique', 'es-ES', 'Male'],
  ['Rosalinda', 'Rosalinda', 'es-ES', 'Female'],
  ['Ivy', 'Ivy', 'en-US', 'Female'],
  ['Justin', 'Justin', 'en-US', 'Male'],
  ['Joanna', 'Joanna', 'en-US', 'Female'],
  ['Salli', 'Salli', 'en-US', 'Female'],
  ['Matthew', 'Matthew', 'en-US', 'Male'],
  ['Brian', 'Brian', 'en-GB', 'Male'],
  ['Amy', 'Amy', 'en-GB', 'Female'],
  ['Emma', 'Emma', 'en-GB', 'Female'],
  ['Mizuki', 'Mizuki', 'ja-JP', 'Female'],
  ['Takumi', 'Takumi', 'ja-JP', 'Male'],
  ['Koharu', 'Koharu', 'ja-JP', 'Female'],
  ['Miho', 'Miho', 'ja-JP', 'Female'],
  ['Haruto', 'Haruto', 'ja-JP', 'Male'],
  ['Seoyeon', 'Seoyeon', 'ko-KR', 'Female']
].map(([shortName, localName, locale, gender]) => ({
  shortName, localName, name: localName, locale, gender, provider: 'stream', providerLabel: 'StreamElements'
}));
const STREAM_ELEMENTS_VOICE_IDS = new Set(STREAM_ELEMENTS_VOICES.map((voice) => voice.shortName));

"""+anchor
m=rep(m,anchor,stream_code,'stream list')
# Edge normalized provider
old="""    gender: String(voice?.Gender || voice?.gender || '')
  };
}"""
new="""    gender: String(voice?.Gender || voice?.gender || ''),
    provider: 'edge',
    providerLabel: 'Microsoft'
  };
}"""
m=rep(m,old,new,'normalize provider')
# listOnlineVoices return mixed
old="""    return { voices, fallback: false };
  } catch (error) {
    console.warn('No se pudo cargar la lista de voces online:', error?.message || error);
    return { voices: FALLBACK_ONLINE_VOICES, fallback: true, message: friendlyUpdateError(error) };
  }
}"""
new="""    return { voices: [...STREAM_ELEMENTS_VOICES, ...voices], fallback: false, streamElements: STREAM_ELEMENTS_VOICES.length };
  } catch (error) {
    console.warn('No se pudo cargar la lista de voces Microsoft:', error?.message || error);
    const edgeFallback = FALLBACK_ONLINE_VOICES.map((voice) => ({ ...voice, provider: 'edge', providerLabel: 'Microsoft' }));
    return { voices: [...STREAM_ELEMENTS_VOICES, ...edgeFallback], fallback: true, streamElements: STREAM_ELEMENTS_VOICES.length, message: friendlyUpdateError(error) };
  }
}"""
m=rep(m,old,new,'list mixed')
# Add stream synth before synthesizeOnlineVoice
anchor="async function synthesizeOnlineVoice(request) {\n"
stream_synth="""async function synthesizeStreamElementsVoice(request) {
  const text = String(request?.text || '').trim().slice(0, 450);
  const voice = String(request?.voice || '').trim();
  if (!text) throw new Error('No hay texto para leer.');
  if (!STREAM_ELEMENTS_VOICE_IDS.has(voice)) throw new Error('La voz de StreamElements seleccionada no es válida.');

  const url = new URL(STREAM_ELEMENTS_TTS_URL);
  url.searchParams.set('voice', voice);
  url.searchParams.set('text', text);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'Accept': 'audio/mpeg,audio/*;q=0.9,*/*;q=0.1' }
    });
    if (!response.ok) throw new Error(`StreamElements respondió ${response.status}.`);
    const contentType = String(response.headers.get('content-type') || 'audio/mpeg').toLowerCase();
    const buffer = Buffer.from(await response.arrayBuffer());
    if (!buffer.length) throw new Error('StreamElements devolvió audio vacío.');
    if (buffer.length > 8 * 1024 * 1024) throw new Error('El audio generado es demasiado grande.');
    return { mimeType: contentType.split(';')[0] || 'audio/mpeg', data: buffer.toString('base64'), bytes: buffer.length, provider: 'stream' };
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error('StreamElements tardó demasiado en responder.');
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

"""+anchor
m=rep(m,anchor,stream_synth,'stream synth')
# route provider in synthesize function
old="""async function synthesizeOnlineVoice(request) {
  const text = String(request?.text || '').trim().slice(0, 500);
  const voice = String(request?.voice || '').trim();
  if (!text) throw new Error('No hay texto para leer.');
  if (!voice || !/^[A-Za-z0-9-]+Neural$/.test(voice)) {
    throw new Error('La voz online seleccionada no es válida.');
  }

  const module = await getEdgeTtsModule();"""
new="""async function synthesizeOnlineVoice(request) {
  const provider = String(request?.provider || 'edge').trim().toLowerCase();
  if (provider === 'stream') return synthesizeStreamElementsVoice(request);
  const text = String(request?.text || '').trim().slice(0, 500);
  const voice = String(request?.voice || '').trim();
  if (!text) throw new Error('No hay texto para leer.');
  if (!voice || !/^[A-Za-z0-9-]+Neural$/.test(voice)) {
    throw new Error('La voz Microsoft seleccionada no es válida.');
  }

  const module = await getEdgeTtsModule();"""
m=rep(m,old,new,'provider route')
# default provider setting main
m=rep(m,"  onlineVoice: 'es-MX-DaliaNeural',\n","  onlineVoice: 'es-MX-DaliaNeural',\n  onlineVoiceProvider: 'edge',\n",'default provider')

# renderer: presets all true non-Microsoft
start=r.index("const FUN_VOICE_PRESETS = Object.freeze([")
end=r.index("]);\n\nfunction selectedFunVoicePreset", start)+3
new_presets="""const FUN_VOICE_PRESETS = Object.freeze([
  { id:'mouse', label:'🐭 Ratón', provider:'stream', voice:'Ivy', rate:1.35, pitch:1.65, volume:0.92, description:'Voz infantil real de StreamElements, acelerada para efecto ratoncito.' },
  { id:'minion', label:'🍌 Minion (broma)', provider:'stream', voice:'Justin', rate:1.28, pitch:1.48, volume:0.94, description:'Base infantil de StreamElements con efecto rápido y agudo; no es un clon del personaje.' },
  { id:'anime-kawaii', label:'🌸 Anime kawaii', provider:'stream', voice:'Mizuki', rate:1.10, pitch:1.18, volume:0.92, description:'Voz japonesa Mizuki de StreamElements para un tono anime femenino.' },
  { id:'anime-chibi', label:'✨ Anime chibi', provider:'stream', voice:'Koharu', rate:1.22, pitch:1.34, volume:0.92, description:'Voz japonesa Koharu, más rápida y pequeña para estilo chibi.' },
  { id:'anime-senpai', label:'🎓 Senpai', provider:'stream', voice:'Takumi', rate:0.96, pitch:0.95, volume:0.94, description:'Voz japonesa masculina Takumi, tranquila y juvenil.' },
  { id:'anime-villain', label:'🖤 Villano anime', provider:'stream', voice:'Haruto', rate:0.82, pitch:0.78, volume:0.96, description:'Voz japonesa masculina Haruto con ritmo grave y dramático.' },
  { id:'virtual-idol', label:'🎤 Idol virtual', provider:'stream', voice:'Seoyeon', rate:1.08, pitch:1.16, volume:0.92, description:'Voz coreana Seoyeon, brillante y distinta a Microsoft.' },
  { id:'baby', label:'🍼 Bebé', provider:'stream', voice:'Ivy', rate:1.18, pitch:1.42, volume:0.90, description:'Voz infantil Ivy de StreamElements.' },
  { id:'demon', label:'😈 Demonio', provider:'stream', voice:'Brian', rate:0.72, pitch:0.72, volume:0.98, description:'Voz británica Brian con reproducción lenta y grave.' },
  { id:'robot', label:'🤖 Robot', provider:'stream', voice:'Matthew', rate:0.88, pitch:0.84, volume:0.94, description:'Voz Matthew de StreamElements con ajuste mecánico.' },
  { id:'epic', label:'⚔️ Narrador épico', provider:'stream', voice:'Brian', rate:0.84, pitch:0.86, volume:0.98, description:'Narrador británico Brian para frases tipo tráiler.' },
  { id:'turbo', label:'⚡ Meme turbo', provider:'stream', voice:'Justin', rate:1.55, pitch:1.20, volume:0.92, description:'Voz Justin realmente distinta, acelerada para mensajes caóticos.' }
]);"""
r=r[:start]+new_presets+r[end:]
# fun config/provider + apply
r=rep(r,"return { mode:'online', onlineVoice:preset.voice, voiceURI:'', rate:preset.rate, pitch:preset.pitch, volume:preset.volume };","return { mode:'online', onlineProvider:preset.provider || 'edge', onlineVoice:preset.voice, voiceURI:'', rate:preset.rate, pitch:preset.pitch, volume:preset.volume };",'fun config')
r=rep(r,"  state.settings.onlineVoice = preset.voice;\n","  state.settings.onlineVoice = preset.voice;\n  state.settings.onlineVoiceProvider = preset.provider || 'edge';\n",'fun apply provider')
r=rep(r,"  const value = `online:${preset.voice}`;\n","  const value = `online:${preset.provider || 'edge'}:${preset.voice}`;\n",'copy preset')
# selected/parse provider
old="""function selectedVoiceValue() {
  return state.settings.voiceMode === 'online'
    ? `online:${state.settings.onlineVoice || 'es-MX-DaliaNeural'}`
    : `system:${state.settings.voiceURI || ''}`;
}

function parseVoiceValue(value) {
  const raw = String(value || '');
  if (raw.startsWith('online:')) return { mode: 'online', onlineVoice: raw.slice(7), voiceURI: '' };
  if (raw.startsWith('system:')) return { mode: 'system', voiceURI: raw.slice(7), onlineVoice: '' };
  return null;
}"""
new="""function selectedVoiceValue() {
  return state.settings.voiceMode === 'online'
    ? `online:${state.settings.onlineVoiceProvider || 'edge'}:${state.settings.onlineVoice || 'es-MX-DaliaNeural'}`
    : `system:${state.settings.voiceURI || ''}`;
}

function parseVoiceValue(value) {
  const raw = String(value || '');
  if (raw.startsWith('online:stream:')) return { mode: 'online', onlineProvider: 'stream', onlineVoice: raw.slice(14), voiceURI: '' };
  if (raw.startsWith('online:edge:')) return { mode: 'online', onlineProvider: 'edge', onlineVoice: raw.slice(12), voiceURI: '' };
  if (raw.startsWith('online:')) return { mode: 'online', onlineProvider: 'edge', onlineVoice: raw.slice(7), voiceURI: '' };
  if (raw.startsWith('system:')) return { mode: 'system', voiceURI: raw.slice(7), onlineVoice: '', onlineProvider: '' };
  return null;
}"""
r=rep(r,old,new,'parse selected')
# voiceLabel provider aware
old="""  if (parsed.mode === 'online') {
    const voice = state.onlineVoices.find((item) => item.shortName === parsed.onlineVoice);
    return voice ? `${voice.localName || voice.name || voice.shortName} — ${voice.locale}` : parsed.onlineVoice;
  }"""
new="""  if (parsed.mode === 'online') {
    const voice = state.onlineVoices.find((item) => item.shortName === parsed.onlineVoice && (item.provider || 'edge') === (parsed.onlineProvider || 'edge'));
    return voice ? `${voice.localName || voice.name || voice.shortName} — ${voice.locale} · ${voice.providerLabel || (voice.provider === 'stream' ? 'StreamElements' : 'Microsoft')}` : parsed.onlineVoice;
  }"""
r=rep(r,old,new,'voice label')
# renderVoiceOptions replace online block and total no need separate groups but provider label
old="""  const onlineMatches = state.onlineVoices.filter((voice) => (languageMatches(voice.locale, filter) || `online:${voice.shortName}` === selected) && (!search || normalizeText(`${voice.localName} ${voice.name} ${voice.shortName} ${voice.locale} ${voice.gender}`).includes(search) || `online:${voice.shortName}` === selected));
  if (onlineMatches.length) {
    const group = document.createElement('optgroup');
    group.label = `Voces neuronales online (${onlineMatches.length})`;
    for (const voice of onlineMatches) {
      const option = document.createElement('option');
      option.value = `online:${voice.shortName}`;
      const gender = voiceGenderLabel(voice.gender);
      option.textContent = `${voice.localName || voice.name || voice.shortName} — ${voice.locale}${gender ? ` · ${gender}` : ''}`;
      group.appendChild(option);
    }
    select.appendChild(group);
  }"""
new="""  const onlineMatches = state.onlineVoices.filter((voice) => {
    const provider = voice.provider || 'edge';
    const value = `online:${provider}:${voice.shortName}`;
    return (languageMatches(voice.locale, filter) || value === selected) && (!search || normalizeText(`${voice.localName} ${voice.name} ${voice.shortName} ${voice.locale} ${voice.gender} ${voice.providerLabel || provider}`).includes(search) || value === selected);
  });
  for (const provider of ['stream', 'edge']) {
    const providerVoices = onlineMatches.filter((voice) => (voice.provider || 'edge') === provider);
    if (!providerVoices.length) continue;
    const group = document.createElement('optgroup');
    group.label = provider === 'stream' ? `StreamElements / voces externas (${providerVoices.length})` : `Microsoft / Edge (${providerVoices.length})`;
    for (const voice of providerVoices) {
      const option = document.createElement('option');
      option.value = `online:${provider}:${voice.shortName}`;
      const gender = voiceGenderLabel(voice.gender);
      option.textContent = `${voice.localName || voice.name || voice.shortName} — ${voice.locale}${gender ? ` · ${gender}` : ''}`;
      group.appendChild(option);
    }
    select.appendChild(group);
  }"""
r=rep(r,old,new,'render online groups')
# preferred logic use correct provider
old="""    if (preferredOnline) {
      select.value = `online:${preferredOnline.shortName}`;
      state.settings.voiceMode = 'online';
      state.settings.onlineVoice = preferredOnline.shortName;
    } else if (preferredSystem) {"""
new="""    if (preferredOnline) {
      const provider = preferredOnline.provider || 'edge';
      select.value = `online:${provider}:${preferredOnline.shortName}`;
      state.settings.voiceMode = 'online';
      state.settings.onlineVoiceProvider = provider;
      state.settings.onlineVoice = preferredOnline.shortName;
    } else if (preferredSystem) {"""
r=rep(r,old,new,'preferred provider')
# status text changed
r=r.replace('voces online disponibles', 'voces online disponibles (StreamElements + Microsoft)')
# runSpeech request provider + stream playback effect
old="""        const result = await api.synthesizeOnlineVoice({
          text,
          voice: voiceConfig?.onlineVoice || state.settings.onlineVoice,
          rate: tuning.rate,
          pitch: tuning.pitch
        });
        if (finished || token !== state.speechToken) { finish(false); return; }
        const audio = new Audio(`data:${result.mimeType || 'audio/mpeg'};base64,${result.data}`);
        audio.volume = tuning.volume;
        state.onlineAudio = audio;"""
new="""        const onlineProvider = voiceConfig?.onlineProvider || state.settings.onlineVoiceProvider || 'edge';
        const onlineVoice = voiceConfig?.onlineVoice || state.settings.onlineVoice;
        let audio;
        if (onlineProvider === 'stream') {
          const streamUrl = new URL('https://api.streamelements.com/kappa/v2/speech');
          streamUrl.searchParams.set('voice', onlineVoice);
          streamUrl.searchParams.set('text', String(text).slice(0, 450));
          audio = new Audio(streamUrl.toString());
          audio.preservesPitch = false;
          audio.playbackRate = clamp(tuning.rate * Math.sqrt(tuning.pitch), 0.5, 2);
        } else {
          const result = await api.synthesizeOnlineVoice({
            text,
            provider: onlineProvider,
            voice: onlineVoice,
            rate: tuning.rate,
            pitch: tuning.pitch
          });
          audio = new Audio(`data:${result.mimeType || 'audio/mpeg'};base64,${result.data}`);
        }
        if (finished || token !== state.speechToken) { finish(false); return; }
        audio.volume = tuning.volume;
        state.onlineAudio = audio;"""
r=rep(r,old,new,'synth provider playback')
# voice select change handler
old="""    if (mode === 'online') { state.settings.voiceMode = 'online'; state.settings.onlineVoice = id; }
    else { state.settings.voiceMode = 'system'; state.settings.voiceURI = id; }"""
new="""    if (mode === 'online') {
      const parsed = parseVoiceValue($('voiceSelect').value);
      if (parsed) {
        state.settings.voiceMode = 'online';
        state.settings.onlineVoiceProvider = parsed.onlineProvider || 'edge';
        state.settings.onlineVoice = parsed.onlineVoice;
      }
    } else { state.settings.voiceMode = 'system'; state.settings.voiceURI = id; }"""
r=rep(r,old,new,'select change')
# Need handler destructuring maybe preceding mode/id comes from split; inspect later. We'll validate.

# HTML wording
h=h.replace('Presets de broma creados combinando voces online con velocidad y tono. No son clones de actores.', 'Presets de broma con voces externas reales de StreamElements y efectos de velocidad/tono. Microsoft ya no es la base de estos presets.')
h=h.replace('Voces neuronales online', 'Voces online de varios proveedores')
h=h.replace('voces online', 'voces online')
h=h.replace('<span class="version" id="versionLabel">v0.30.0</span>', '<span class="version" id="versionLabel">v0.31.0</span>')
h=h.replace('Lulu Finity 0.30.0', 'Lulu Finity 0.31.0')
# package version
p['version']='0.31.0'; pkg.write_text(json.dumps(p,ensure_ascii=False,indent=2)+"\n", encoding='utf-8')
# changelog
entry="""# Cambios\n\n## 0.31.0\n\n- Añade voces externas reales mediante StreamElements; ya no todo el TTS online depende de Microsoft/Edge.\n- El selector de voz muestra grupos separados para StreamElements y Microsoft.\n- Incluye voces como Mia, Miguel, Ivy, Justin, Brian, Mizuki, Koharu, Takumi, Haruto y Seoyeon.\n- Los 12 presets divertidos ahora usan voces de StreamElements como base: Ratón, Minion (broma), Anime kawaii/chibi, Senpai, Villano anime, Idol virtual, Bebé, Demonio, Robot, Narrador épico y Meme turbo.\n- Mantiene compatibilidad con configuraciones antiguas `online:<voz>` interpretándolas como Microsoft.\n- Conserva el anti anuncios avanzado de YouTube, rollback a 0.27 y correcciones de arranque.\n\n"""
ch.write_text(entry+c, encoding='utf-8')
main.write_text(m, encoding='utf-8'); rend.write_text(r, encoding='utf-8'); html.write_text(h, encoding='utf-8')
print('patched 0.31.0')
