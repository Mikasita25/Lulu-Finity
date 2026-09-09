import assert from 'node:assert/strict';
import { test } from 'node:test';
import vm from 'node:vm';
import { browserSearchUrl, isYouTubeUrl } from '../src/services/browserUrl.ts';
import { playerAutomation } from '../src/services/playerAutomation.ts';

test('navigation accepts YouTube HTTPS only and encodes searches', () => {
  for (const url of ['https://m.youtube.com/watch?v=abc', 'https://youtu.be/abc']) assert.equal(isYouTubeUrl(url), true);
  for (const url of ['javascript:alert(1)', 'https://youtube.com.evil.test', 'https://evil-youtube.com', 'http://youtube.com', 'https://u:p@youtube.com']) assert.equal(isYouTubeUrl(url), false);
  assert.equal(browserSearchUrl('https://youtu.be/abc'), 'https://youtu.be/abc');
  assert.equal(browserSearchUrl(' a & b '), 'https://m.youtube.com/results?search_query=a%20%26%20b');
});

function page({ paused = false, autoSelect = true, background = true, pathname = '/watch', hostname = 'm.youtube.com' } = {}) {
  const events = {};
  const messages = [];
  let plays = 0, pauses = 0, clicks = 0;
  const video = { tagName: 'VIDEO', dataset: {}, paused: true, ended: false, readyState: 4, volume: 1,
    play() { plays++; this.paused = false; return Promise.resolve(); },
    pause() { pauses++; this.paused = true; }, addEventListener(name, callback) { events[name] = callback; } };
  class Document {}
  Object.defineProperty(Document.prototype, 'hidden', { get: () => true });
  Object.defineProperty(Document.prototype, 'visibilityState', { get: () => 'hidden' });
  const document = Object.assign(new Document(), { title: 'Song', documentElement: {},
    addEventListener() {}, getElementById() { return null; },
    querySelector(selector) { return selector === 'video' ? video : null; },
    querySelectorAll(selector) { return selector === 'video, audio' ? [video] : selector === 'a[href*="/watch?v="]' ? [{ getAttribute() { return '/watch?v=abc'; }, click() { clicks++; } }] : []; }
  });
  const window = { ReactNativeWebView: { postMessage(value) { messages.push(JSON.parse(value)); } } };
  const context = { window, document, Document, location: { hostname, pathname, href: 'https://m.youtube.com/watch?v=abc' }, MutationObserver: class { observe() {} }, setInterval() {}, setTimeout() {}, Date };
  vm.runInNewContext(playerAutomation(.35, paused, false, false, autoSelect, background), context);
  return { video, document, window, events, messages, plays: () => plays, pauses: () => pauses, clicks: () => clicks, context };
}

test('playback volume and explicit pause are applied', () => {
  const playing = page(); assert.equal(playing.plays(), 1); assert.equal(playing.video.volume, .35);
  const paused = page({ paused: true }); assert.equal(paused.plays(), 0); assert.equal(paused.pauses(), 1);
});
test('manual browser search does not select the first result', () => {
  assert.equal(page({ pathname: '/results', autoSelect: false }).clicks(), 0);
  assert.equal(page({ pathname: '/results' }).clicks(), 1);
});
test('background preference preserves native visibility when disabled', () => {
  assert.equal(page().document.hidden, false);
  assert.equal(page({ background: false }).document.hidden, true);
});
test('injection is not installed on an external page', () => {
  assert.equal(page({ hostname: 'example.com' }).window.__luluAutoPlayerInstalled, undefined);
});
test('user pause is reported and repeated injection does not force play', () => {
  const p = page(); p.window.__luluUserGesture = Date.now(); p.events.pause();
  assert.equal(p.window.__luluPlaybackPaused, true); assert.equal(p.messages.at(-1).type, 'user-pause');
  vm.runInNewContext(playerAutomation(.2, true, false, false), p.context);
  assert.equal(p.plays(), 1); assert.equal(p.video.paused, true);
});

test('native service receives actual playback and background preference', () => {
  const p = page();
  const report = p.messages.find(m => m.type === 'lulu-native-playback');
  assert.equal(report.enabled, true);
  assert.equal(report.playing, true);
  assert.equal(report.paused, false);
  vm.runInNewContext(playerAutomation(.2, true, false, false, false, false), p.context);
  const disabled = p.messages.filter(m => m.type === 'lulu-native-playback').at(-1);
  assert.equal(disabled.enabled, false);
  assert.equal(disabled.paused, true);
});
test('native pulse respects an explicit pause while JavaScript timers are suspended', () => {
  const p = page({ paused: true });
  p.window.__luluNativeTick();
  assert.equal(p.plays(), 0);
});
