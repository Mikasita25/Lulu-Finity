'use strict';

const WebSocket = require('ws');

// During reconnection, ws can emit an asynchronous 'error' when terminate()
// is called in CONNECTING. Removing all listeners first would turn that
// expected event into an uncaught exception in the relay.
function closeUpstreamSafely(socket) {
  if (!socket) return;
  socket.removeAllListeners();
  socket.on('error', () => {});
  if (socket.readyState === WebSocket.CLOSED) return;
  try { socket.terminate(); } catch {}
}

module.exports = { closeUpstreamSafely };
