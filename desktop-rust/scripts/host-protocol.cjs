'use strict';

const readline = require('node:readline');

function createHostProtocol({ input, output, onCall, onEvent, onClose }) {
  const pending = new Map();
  let sequence = 0;
  const lines = readline.createInterface({ input, crlfDelay: Infinity });
  const send = message => output.write(JSON.stringify(message) + '\n');

  lines.on('line', async line => {
    let message;
    try { message = JSON.parse(line); }
    catch { console.error('Mensaje interno de escritorio inválido.'); return; }
    if (message.type === 'host-result') {
      const waiter = pending.get(message.id);
      if (!waiter) return;
      pending.delete(message.id);
      clearTimeout(waiter.timer);
      if (message.error) waiter.reject(new Error(message.error));
      else waiter.resolve(message.value);
    } else if (message.type === 'invoke') {
      try {
        send({ type: 'invoke-result', id: message.id, value: await onCall(message.channel, message.args) });
      } catch (error) {
        send({ type: 'invoke-result', id: message.id, error: error?.message || String(error) });
      }
    } else if (message.type === 'window-event') {
      try { onEvent(message); }
      catch (error) { console.error('Evento interno de escritorio:', error); }
    }
  });

  lines.once('close', () => {
    for (const waiter of pending.values()) {
      clearTimeout(waiter.timer);
      waiter.reject(new Error('Se cerró el proceso de escritorio.'));
    }
    pending.clear();
    onClose();
  });

  return {
    send,
    call(method, args = {}) {
      const id = ++sequence;
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          pending.delete(id);
          reject(new Error(`La operación de escritorio ${method} tardó demasiado.`));
        }, method.startsWith('dialog-') || method === 'update-install' ? 600_000 : 35_000);
        pending.set(id, { resolve, reject, timer });
        send({ type: 'host-call', id, method, args });
      });
    }
  };
}

module.exports = { createHostProtocol };
