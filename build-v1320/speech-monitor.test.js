'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(process.argv[2] || 'src/renderer.js', 'utf8');
const start = source.indexOf('function monitorSpeechAudio(');
const end = source.indexOf('\nfunction runSpeechNow(', start);
assert.ok(start >= 0 && end > start);
function setup() {
  let now = 0, tick, cleared = false, stalled = 0, ended = 0;
  const audio = { currentTime: 0, ended: false };
  const ctx = { Date: { now: () => now }, Number,
    setInterval(fn) { tick = fn; return 1; }, clearInterval() { cleared = true; } };
  vm.createContext(ctx);
  vm.runInContext(source.slice(start, end), ctx);
  const stop = ctx.monitorSpeechAudio(audio, () => stalled++, () => ended++);
  return { audio, stop, advance(ms) { now += ms; if (!cleared) tick(); }, get stalled() { return stalled; }, get ended() { return ended; }, get cleared() { return cleared; } };
}
test('un audio sin avance libera la cola y solo se detecta una vez', () => {
  const h = setup(); h.advance(7999); assert.equal(h.stalled, 0);
  h.advance(1); assert.equal(h.stalled, 1); assert.equal(h.cleared, true);
  h.advance(9000); assert.equal(h.stalled, 1);
});
test('un audio largo que avanza no se interrumpe', () => {
  const h = setup();
  for (let i=1; i<=20; i++) { h.audio.currentTime=i; h.advance(1000); }
  assert.equal(h.stalled, 0); h.stop(); assert.equal(h.cleared, true);
});
test('un audio terminado libera la cola aunque falte el evento ended', () => {
  const h = setup(); h.audio.ended=true; h.advance(1000);
  assert.equal(h.ended, 1); assert.equal(h.stalled, 0); assert.equal(h.cleared, true);
});
test('cancelar el monitor impide que se active después', () => {
  const h = setup(); h.stop(); h.advance(10000); assert.equal(h.stalled, 0);
});
test('prepara Microsoft mientras otro sonido ocupa el reproductor', async () => {
  const begin = source.indexOf('function speakNext()');
  const finish = source.indexOf('\nfunction clearSpeechQueue()', begin);
  assert.ok(begin >= 0 && finish > begin);
  const item = { id:'1', text:'hola', voice:{ mode:'online' }, speedMultiplier:1 };
  let syntheses = 0, submitted;
  const ctx = { state:{ speaking:false, audioBusy:true, speechQueue:[item], settings:{} },
    speechItemExpired:()=>false, adaptiveSpeechMultiplier:()=>1, renderStats:()=>{},
    synthesizeSpeechData:async()=>{ syntheses++; return {data:'audio'}; },
    speakText:(...args)=>{ submitted=args; return {accepted:true}; },
    releaseAudioLock:()=>{}, updateCommentResult:()=>{}, queueMicrotask };
  vm.createContext(ctx); vm.runInContext(source.slice(begin,finish),ctx); ctx.speakNext();
  assert.equal(syntheses,1); assert.equal(submitted[4].speechItem,item);
  assert.equal((await item.preparedPromise).ok,true);
});
