'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, 'renderer.js'), 'utf8');
function section(begin, end) {
  const start = source.indexOf(begin), finish = source.indexOf(end, start + begin.length);
  assert.ok(start >= 0 && finish > start, 'función esperada en el renderer');
  return source.slice(start, finish);
}
function speechHarness() {
  let nextId = 0;
  const timers = new Map();
  const speech = {
    paused:false, calls:[], resumes:0, cancels:0,
    speak(utterance) { this.calls.push(utterance); },
    resume() { this.resumes += 1; this.calls.at(-1)?.onstart?.(); },
    cancel() { this.cancels += 1; this.calls.at(-1)?.onerror?.(); }
  };
  const events = [];
  const state = { speechToken:7, systemSpeechRecoveryCancel:null };
  const context = {
    window:{ speechSynthesis:speech },
    state, SpeechSynthesisUtterance: class { constructor(text) { this.text = text; } },
    speechTuning: () => ({rate:1,pitch:1,volume:.9}),
    currentSystemVoice:()=>null,
    markSpeechStarted: item=>events.push(['start',item?.id]),
    setTimeout(callback,delay) { const id=++nextId;timers.set(id,{callback,delay});return id; },
    clearTimeout(id) { timers.delete(id); }
  };
  vm.createContext(context);
  vm.runInContext(section('function startSystemSpeechNow(', '\nfunction runSpeechNow('), context);
  const fire = (delay) => {
    const matched=[...timers].filter(([,task])=>task.delay===delay);
    for (const [id,task] of matched) if(timers.delete(id)) task.callback();
  };
  return { context,speech,state,timers,events,fire };
}
test('una voz atascada arranca automáticamente sin esperar otro comentario', () => {
  const h=speechHarness();
  const ended=[];
  h.context.startSystemSpeechNow('Hola',null,7,result=>ended.push(result),{id:'first'});
  assert.equal(h.speech.calls.length,1);
  assert.deepEqual(h.events,[]);
  h.fire(900);
  assert.equal(h.speech.resumes,1);
  assert.deepEqual(h.events,[['start','first']]);
  h.speech.calls[0].onend();
  assert.deepEqual(ended,[true]);
  assert.equal(h.timers.size,0);
  assert.equal(h.state.systemSpeechRecoveryCancel,null);
});
test('reintenta una sola vez y no duplica la lectura tras un cancel tardío', () => {
  const h=speechHarness();
  h.speech.resume=function(){this.resumes++};
  const ended=[];
  h.context.startSystemSpeechNow('Mensaje',null,7,result=>ended.push(result),{id:'solo'});
  h.fire(9000);
  assert.equal(h.speech.cancels,1);
  assert.equal(h.speech.calls.length,2);
  h.speech.calls[0].onend?.();
  assert.deepEqual(ended,[]);
  h.speech.calls[1].onstart();
  h.speech.calls[1].onend();
  assert.deepEqual(h.events,[['start','solo']]);
  assert.deepEqual(ended,[true]);
});
test('cancelar la voz desactiva cualquier reintento pendiente',()=>{
  const h=speechHarness();
  h.context.startSystemSpeechNow('Hola',null,7,()=>{}, {id:'cancel'});
  h.state.systemSpeechRecoveryCancel();
  h.fire(9000);
  assert.equal(h.speech.calls.length,1);
  assert.equal(h.timers.size,0);
});
test('la preparación tiene límite y limpieza de temporizador', async ()=>{
  const context={ Promise,setTimeout(callback){context.fire=callback;return 1;},clearTimeout(id){context.cleared=id;},Error };
  vm.createContext(context);
  vm.runInContext(section('function withSpeechTimeout(', '\nasync function synthesizeSpeechData('),context);
  const p=context.withSpeechTimeout(new Promise(()=>{}),25);
  context.fire();
  await assert.rejects(p,/tardó demasiado/);
  assert.equal(context.cleared,1);
});
test('los comentarios normales conservan inicio inmediato y la cola sin descarte',()=>{
  assert.match(source,/\/\/ Cada comentario inicia el TTS por sí solo,[^\n]*\n  speakNext\(\);/);
  assert.match(source,/cola llena; se conservan los comentarios pendientes/);
  assert.match(source,/withSpeechTimeout\(audio\.play\(\), 12000\)/);
  assert.match(source,/systemSpeechRecoveryCancel\?\.\(\)/);
});
