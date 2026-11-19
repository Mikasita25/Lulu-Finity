'use strict';

process.parentPort = {
  on(_event, callback) { process.on('message', data => callback({ data })); },
  postMessage(value) { if (process.connected) process.send(value); }
};
process.on('disconnect', () => process.exit(0));
require(process.argv[2]);
