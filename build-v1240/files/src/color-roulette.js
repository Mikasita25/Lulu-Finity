'use strict';
const COLORS = Object.freeze(['Rojo','Naranja','Amarillo','Verde','Cyan','Azul','Morado','Magenta']);
const DURATION_MS = 14110;
function normalizeColorRoulette(input = {}) {
  const finite = (v, fallback) => Number.isFinite(Number(v)) ? Number(v) : fallback;
  const rows = Array.isArray(input.colors) ? input.colors : [];
  return {
    cost: Math.max(0, Math.min(1000000000, Math.round(finite(input.cost, 0)))),
    cooldownSeconds: Math.max(0, Math.min(86400, finite(input.cooldownSeconds, 30))),
    cooldownScope: input.cooldownScope === 'global' ? 'global' : 'user',
    resultSeconds: Math.max(1, Math.min(15, finite(input.resultSeconds, 3))),
    colors: COLORS.map((name, index) => {
      const row = rows.find(row => row?.index === index) || rows[index] || {};
      return { index, name, probability: Math.max(0, Math.min(100, finite(row.probability, 12.5))),
        prize: String(row.prize ?? 'Sin premio').trim().slice(0, 160),
        amount: Math.max(0, Math.min(1000000000, Math.round(finite(row.amount, 0)))) };
    })
  };
}
function validateColorRoulette(config) {
  const total = config.colors.reduce((sum, row) => sum + row.probability, 0);
  return Math.abs(total - 100) < 0.000001 ? '' : 'Las probabilidades de los 8 colores deben sumar 100%.';
}
function pickColor(config, randomInt) {
  const weights = config.colors.map(row => Math.round(row.probability * 10000));
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  if (!total) throw new Error('La ruleta no tiene colores con probabilidad.');
  let roll = randomInt(total);
  for (let i = 0; i < weights.length; i++) { roll -= weights[i]; if (roll < 0) return config.colors[i]; }
  throw new Error('Resultado aleatorio fuera de rango.');
}
module.exports = { COLORS, DURATION_MS, normalizeColorRoulette, validateColorRoulette, pickColor };
