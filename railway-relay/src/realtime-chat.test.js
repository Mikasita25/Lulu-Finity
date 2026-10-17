'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { inspectUpstreamFrame } = require('./upstream-frame');

const source = readFileSync(path.join(__dirname, 'server.js'), 'utf8');
const begin = source.indexOf('function buildUpstreamUrl(');
const end = source.indexOf('\nclass RelaySession', begin);

function upstreamUrl(uniqueId = 'luluvcupidx') {
  assert.ok(begin >= 0 && end > begin, 'se conserva buildUpstreamUrl');
  const context = { URL, UPSTREAM_WS_URL: 'wss://ws.eulerstream.com' };
  vm.createContext(context);
  vm.runInContext(source.slice(begin, end), context);
  return new URL(context.buildUpstreamUrl(uniqueId, 'testing'));
}

test('los comentarios TikTok se piden sin agrupar para lectura inmediata', () => {
  const url = upstreamUrl();
  assert.equal(url.searchParams.get('uniqueId'), 'luluvcupidx');
  assert.equal(url.searchParams.get('features.bundleEvents'), 'false');
  assert.equal(url.searchParams.get('features.rawMessages'), 'false');
  assert.equal(url.searchParams.get('schemaVersion'), 'v1');
  assert.equal(url.searchParams.get('features.normalizeUniqueId'), 'true');
});

test('el relay acepta mensajes individuales y paquetes antiguos', () => {
  const comment = { type:'WebcastChatMessage', data:{ comment:'Hola', user:{ uniqueId:'alguien' } } };
  const single = Buffer.from(JSON.stringify(comment));
  const bundle = Buffer.from(JSON.stringify({ messages:[comment] }));
  assert.equal(inspectUpstreamFrame(single).valid, true);
  assert.equal(inspectUpstreamFrame(bundle).valid, true);
  assert.match(source, /upstream\\.on\\('message',[\\s\\S]*?this\\.client\\.send\\(data, \\{ binary: isBinary \\}\\)/);
});
