'use strict';

const RECOVERY_DELAYS_MS = Object.freeze([1200, 2500, 5000, 10000, 20000, 30000]);

function tunnelRecoveryDelay(attempt = 0) {
  const index = Math.max(0, Math.min(RECOVERY_DELAYS_MS.length - 1, Math.trunc(Number(attempt) || 0)));
  return RECOVERY_DELAYS_MS[index];
}

async function probeTunnelUrl(fetchImpl, baseUrl, timeoutMs = 7000) {
  if (typeof fetchImpl !== 'function') return { ok: false, status: 0, error: 'fetch no disponible' };
  const normalized = String(baseUrl || '').trim().replace(/\/+$/, '');
  if (!/^https:\/\//i.test(normalized)) return { ok: false, status: 0, error: 'URL HTTPS inválida' };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Math.max(1000, Number(timeoutMs) || 7000));
  timeout.unref?.();
  try {
    // El servidor local protege todas sus rutas con token. Un 403 demuestra que
    // Cloudflare sí alcanzó el origen; 5xx/errores de red indican un túnel roto.
    const response = await fetchImpl(`${normalized}/?lulu_health=${Date.now()}`, {
      method: 'GET',
      redirect: 'manual',
      cache: 'no-store',
      signal: controller.signal,
      headers: { 'Cache-Control': 'no-cache', 'User-Agent': 'Lulu-Finity-Overlay-Health/1' }
    });
    const status = Number(response?.status || 0);
    return { ok: status >= 200 && status < 500, status, error: '' };
  } catch (error) {
    return { ok: false, status: 0, error: error?.name === 'AbortError' ? 'timeout' : String(error?.message || error || 'error de red') };
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = { RECOVERY_DELAYS_MS, tunnelRecoveryDelay, probeTunnelUrl };
