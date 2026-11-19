'use strict';

const port = Number(process.argv[2]);

async function main() {
  const base = `http://127.0.0.1:${port}`;
  let page;
  for (let attempt = 0; attempt < 65 && !page; attempt++) {
    try {
      const targets = await fetch(base + '/json/list', { signal: AbortSignal.timeout(900) }).then(response => response.json());
      page = targets.find(target => target.type === 'page' && new URL(target.url).hostname === 'tauri.localhost');
    } catch {}
    if (!page) await new Promise(resolve => setTimeout(resolve, 750));
  }
  if (!page) throw new Error('WebView2 no publicó el renderer de Lulu.');
  const socket = new WebSocket(page.webSocketDebuggerUrl);
  try {
    await new Promise((resolve, reject) => {
      socket.addEventListener('open', resolve, { once: true });
      socket.addEventListener('error', () => reject(new Error('La conexión local a WebView2 falló.')), { once: true });
    });
    const expression = `(async () => {
      for (let attempt = 0; attempt < 45 && (!window.voiceStudio || typeof state === 'undefined' || !state.settings); attempt++) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      if (!goToPage('account', { activateModules: false })) throw new Error('No se abrió Cuenta.');
      const account = await window.voiceStudio.getTikTokChatStatus();
      if (account.open || account.loggedIn) throw new Error('La prueba debe usar una cuenta nueva.');
      goToPage('dashboard');
      return 'ready';
    })()`;
    const result = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('La escena de memoria tardó demasiado.')), 45_000);
      socket.addEventListener('message', event => {
        const reply = JSON.parse(event.data);
        if (reply.id !== 1) return;
        clearTimeout(timer);
        if (reply.error || reply.result?.exceptionDetails) reject(new Error(reply.result?.exceptionDetails?.exception?.description || 'Falló la escena.'));
        else resolve(reply.result?.result?.value);
      });
      socket.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression, awaitPromise: true, returnByValue: true } }));
    });
    if (result !== 'ready') throw new Error('No terminó la escena de memoria.');
  } finally {
    socket.close();
  }
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
