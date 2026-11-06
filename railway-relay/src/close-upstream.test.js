'use strict';

const { EventEmitter } = require('node:events');
const test = require('node:test');
const assert = require('node:assert/strict');
const WebSocket = require('ws');
const { closeUpstreamSafely } = require('./close-upstream');

function socketAt(state) {
  const socket = new EventEmitter();
  socket.readyState = state;
  socket.terminated = 0;
  socket.terminate = () => {
    socket.terminated += 1;
    if (state === WebSocket.CONNECTING) {
      queueMicrotask(() => socket.emit('error', new Error('WebSocket was closed before the connection was established')));
    }
  };
  return socket;
}

test('closing a CONNECTING upstream handles the delayed ws error', async () => {
  const socket = socketAt(WebSocket.CONNECTING);
  socket.on('message', () => {});
  closeUpstreamSafely(socket);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(socket.terminated, 1);
  assert.equal(socket.listenerCount('message'), 0);
  assert.equal(socket.listenerCount('error'), 1);
});

test('an OPEN upstream is terminated, and a CLOSED one is left closed', () => {
  const open = socketAt(WebSocket.OPEN);
  const closed = socketAt(WebSocket.CLOSED);
  closeUpstreamSafely(open);
  closeUpstreamSafely(closed);
  assert.equal(open.terminated, 1);
  assert.equal(closed.terminated, 0);
});

test('null sockets can be cleaned up safely', () => {
  assert.doesNotThrow(() => closeUpstreamSafely(null));
});
