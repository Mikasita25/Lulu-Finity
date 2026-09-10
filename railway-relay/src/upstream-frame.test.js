'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { inspectUpstreamFrame, structuralFailureDetail, isEventEnvelope } = require('./upstream-frame');

test('acepta un frame bundle con mensajes de TikTok', () => {
  const result = inspectUpstreamFrame(JSON.stringify({ messages:[{ type:'WebcastChatMessage', data:{ comment:'hola' } }] }));
  assert.equal(result.valid, true);
  assert.equal(result.failureDetail, '');
  assert.equal(result.kind, 'event');
});

test('solo valida sobres type + data', () => {
  assert.equal(isEventEnvelope({ type:'workerInfo', data:{ roomId:'123' } }), true);
  assert.equal(inspectUpstreamFrame(JSON.stringify({ hello:'world' })).valid, false);
  assert.equal(inspectUpstreamFrame(JSON.stringify({ messages:[] })).valid, false);
  assert.equal(inspectUpstreamFrame('{').valid, false);
});

test('detecta errores estructurados del proveedor', () => {
  assert.equal(structuralFailureDetail({ error:'Failed to sign a request' }), 'Failed to sign a request');
  assert.equal(inspectUpstreamFrame(JSON.stringify({ success:false, message:'Signature Access required' })).failureDetail, 'Signature Access required');
});

test('no confunde el texto de un comentario con un error del proveedor', () => {
  const result = inspectUpstreamFrame(JSON.stringify({ messages:[{ type:'WebcastChatMessage', data:{ comment:'me salió un error jaja' } }] }));
  assert.equal(result.valid, true);
  assert.equal(result.failureDetail, '');
});
