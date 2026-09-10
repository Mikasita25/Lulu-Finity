'use strict';

function classifyUpstreamFailure(code, reason, error = null) {
  const text = `${code || ''} ${reason || ''} ${error?.message || error || ''}`.toLowerCase();
  if (/4005|4404|offline|not live|live has ended|room.*offline|useroffline/.test(text)) return 'offline';
  // Un error de firma/plan no se arregla rotando API keys. EulerStream puede aceptar
  // primero el handshake y rechazar después la sesión, por eso debe tratarse como
  // configuración y mostrarse al cliente en lugar de dejar un falso "conectado".
  if (/failed to sign|sign(?:ature|ing)?\s+(?:a\s+)?request|business\s+plan|purchase one|signature\s+access|upgrade\s+(?:your\s+)?plan/.test(text)) return 'configuration';
  if (/quota|monthly|billing|credits? exhausted|usage limit|plan limit|saldo|cuota/.test(text)) return 'quota';
  if (/429|4429|4555|rate.?limit|too many|concurrent|capacity|temporar.*limit|max.*connection|duration.*max|maximum duration/.test(text)) return 'temporary-limit';
  if (/401|403|4401|4403|invalid.*key|unauthori|forbidden|revoked|api.?key.*invalid/.test(text)) return 'invalid';
  if (/4400|invalid.*config|configuration.*invalid/.test(text)) return 'configuration';
  if (Number(code) === 1000) return 'normal';
  return 'transient';
}

module.exports = { classifyUpstreamFailure };
