import { parseRealtimePayload } from './eventParser';
import type { ParsedRealtimeMessage } from './eventParser';
import { socketPayloadToText } from './socketPayload';

const RELAY_URL =
  process.env.EXPO_PUBLIC_LULU_RELAY_URL ||
  'wss://lulu-finity-production.up.railway.app/v1/tiktok/live';

const CLIENT_TOKEN = process.env.EXPO_PUBLIC_LULU_RELAY_CLIENT_TOKEN || '';

type Listener = (message: ParsedRealtimeMessage) => void;

const terminalClose: Record<number, { state: 'idle' | 'offline' | 'error'; message: string }> = {
  1008: { state: 'error', message: 'El relay rechazó la conexión por seguridad.' },
  4005: { state: 'idle', message: 'El LIVE terminó.' },
  4400: { state: 'error', message: 'La configuración del LIVE no es válida.' },
  4401: { state: 'error', message: 'Esta versión no tiene autorización para usar el relay.' },
  4403: { state: 'error', message: 'El relay no permitió esta conexión.' },
  4404: { state: 'offline', message: 'TikTok no detecta un LIVE activo para esta cuenta.' },
  4429: { state: 'error', message: 'Se alcanzó el límite de conexiones. Intenta más tarde.' },
};

const reconnectDelays = [1_000, 2_500, 5_000, 10_000, 20_000, 30_000, 60_000, 120_000] as const;

export class LiveSocket {
  private socket: WebSocket | null = null;
  private username = '';
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private retryCount = 0;
  private manuallyClosed = false;
  private messageChain: Promise<void> = Promise.resolve();
  private listener: Listener;

  constructor(listener: Listener) {
    this.listener = listener;
  }

  connect(username: string) {
    const clean = username.trim().replace(/^@/, '');
    if (!clean) throw new Error('Escribe un usuario de TikTok.');
    if (!CLIENT_TOKEN) {
      throw new Error(
        'Esta compilación de Lulú Finity no incluye el acceso al relay. Instala una compilación oficial actualizada.',
      );
    }
    this.disconnect();
    this.manuallyClosed = false;
    this.retryCount = 0;
    this.messageChain = Promise.resolve();
    this.username = clean;
    this.open();
  }

  private open() {
    const url = `${RELAY_URL}?uniqueId=${encodeURIComponent(this.username)}`;
    this.listener({
      kind: 'relay',
      state: 'connecting',
      message: this.retryCount
        ? 'Recuperando la conexión con TikTok LIVE…'
        : 'Conectando con TikTok LIVE…',
      transportReconnect: this.retryCount > 0,
    });

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
      this.listener({
        kind: 'relay',
        state: 'connecting',
        message: 'Relay abierto; esperando confirmación de TikTok LIVE…',
      });
    };

    socket.onmessage = (event) => {
      this.messageChain = this.messageChain
        .then(async () => {
          const raw = await socketPayloadToText(event.data);
          if (this.socket !== socket) return;
          for (const parsed of parseRealtimePayload(raw)) {
            if (parsed.kind === 'relay' && parsed.state === 'connected') this.retryCount = 0;
            this.listener(parsed);
          }
        })
        .catch((error) => {
          console.warn('[LuluFinity] No se pudo leer un paquete del LIVE', error);
        });
    };

    socket.onerror = () => {
      this.listener({
        kind: 'relay',
        state: 'error',
        message: 'Hubo un problema con la conexión en tiempo real.',
      });
    };

    socket.onclose = (event) => {
      // A close callback from a replaced socket must never schedule another
      // reconnect over the new connection.
      if (this.socket !== socket) return;
      this.socket = null;
      if (this.manuallyClosed) {
        this.listener({ kind: 'relay', state: 'idle', message: 'LIVE desconectado' });
        return;
      }

      const terminal = terminalClose[event.code];
      if (terminal) {
        this.listener({
          kind: 'relay',
          state: terminal.state,
          message: event.reason || terminal.message,
        });
        return;
      }

      this.scheduleReconnect();
    };
  }

  private scheduleReconnect() {
    if (this.manuallyClosed || this.retryTimer) return;
    this.retryCount += 1;
    if (this.retryCount > reconnectDelays.length) {
      this.listener({
        kind: 'relay',
        state: 'error',
        message: 'No se pudo recuperar el LIVE después de varios intentos. Pulsa Conectar para volver a intentar.',
      });
      return;
    }
    const delay = reconnectDelays[this.retryCount - 1] ?? reconnectDelays[reconnectDelays.length - 1]!;
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
    this.messageChain = Promise.resolve();
    const socket = this.socket;
    this.socket = null;
    if (socket && socket.readyState < WebSocket.CLOSING) socket.close(1000, 'user disconnect');
    this.listener({ kind: 'relay', state: 'idle', message: 'LIVE desconectado' });
  }
}
