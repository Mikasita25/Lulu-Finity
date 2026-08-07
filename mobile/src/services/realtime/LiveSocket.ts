import { parseRealtimePayload } from './eventParser';
import type { ParsedRealtimeMessage } from './eventParser';

const RELAY_URL =
  process.env.EXPO_PUBLIC_LULU_RELAY_URL ||
  'wss://lulu-finity-production.up.railway.app/v1/tiktok/live';

const CLIENT_TOKEN = process.env.EXPO_PUBLIC_LULU_RELAY_CLIENT_TOKEN || '';

type Listener = (message: ParsedRealtimeMessage) => void;

export class LiveSocket {
  private socket: WebSocket | null = null;
  private username = '';
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private retryCount = 0;
  private manuallyClosed = false;
  private listener: Listener;

  constructor(listener: Listener) {
    this.listener = listener;
  }

  connect(username: string) {
    const clean = username.trim().replace(/^@/, '');
    if (!clean) throw new Error('Escribe un usuario de TikTok.');
    this.disconnect();
    this.manuallyClosed = false;
    this.username = clean;
    this.open();
  }

  private open() {
    const url = `${RELAY_URL}?uniqueId=${encodeURIComponent(this.username)}`;
    this.listener({ kind: 'relay', state: 'connecting', message: 'Conectando con TikTok LIVE…' });

    // React Native acepta headers en el tercer argumento de WebSocket. El cast evita
    // depender de los tipos DOM, que solo describen la firma estándar del navegador.
    const SocketCtor = WebSocket as unknown as new (
      url: string,
      protocols?: string | string[] | null,
      options?: { headers?: Record<string, string> },
    ) => WebSocket;

    const headers = CLIENT_TOKEN
      ? { Authorization: `Bearer ${CLIENT_TOKEN}`, 'x-lulu-client-token': CLIENT_TOKEN }
      : undefined;

    const socket = new SocketCtor(url, null, { headers });
    this.socket = socket;

    socket.onopen = () => {
      this.retryCount = 0;
      this.listener({ kind: 'relay', state: 'connected', message: 'LIVE conectado' });
    };

    socket.onmessage = (event) => {
      const raw = typeof event.data === 'string' ? event.data : String(event.data ?? '');
      for (const parsed of parseRealtimePayload(raw)) this.listener(parsed);
    };

    socket.onerror = () => {
      this.listener({
        kind: 'relay',
        state: 'error',
        message: 'Hubo un problema con la conexión en tiempo real.',
      });
    };

    socket.onclose = (event) => {
      if (this.socket === socket) this.socket = null;
      if (this.manuallyClosed) {
        this.listener({ kind: 'relay', state: 'idle', message: 'LIVE desconectado' });
        return;
      }

      if (event.code === 4404) {
        this.listener({
          kind: 'relay',
          state: 'offline',
          message: 'TikTok no detecta un LIVE activo para esta cuenta.',
        });
        return;
      }

      if (event.code === 4400 || event.code === 1000) {
        this.listener({
          kind: 'relay',
          state: event.code === 1000 ? 'idle' : 'error',
          message: event.reason || 'La conexión terminó.',
        });
        return;
      }

      this.scheduleReconnect();
    };
  }

  private scheduleReconnect() {
    if (this.manuallyClosed || this.retryTimer) return;
    this.retryCount += 1;
    const delay = Math.min(15_000, 900 * 2 ** Math.min(4, this.retryCount));
    this.listener({
      kind: 'relay',
      state: 'rotating',
      message: `Reconectando en ${Math.ceil(delay / 1000)} s…`,
    });
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      if (!this.manuallyClosed) this.open();
    }, delay);
  }

  disconnect() {
    this.manuallyClosed = true;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = null;
    const socket = this.socket;
    this.socket = null;
    if (socket && socket.readyState < WebSocket.CLOSING) socket.close(1000, 'user disconnect');
  }
}
