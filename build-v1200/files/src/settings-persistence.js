(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.LuluSettingsPersistence = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  // Serialize saves and retain edits made while an earlier IPC call was in flight.
  function create(save, read, write) {
    let tail = Promise.resolve();
    return function persist() {
      const task = tail.catch(() => {}).then(async () => {
        const snapshot = JSON.parse(JSON.stringify(read()));
        const saved = await save(snapshot);
        const current = read();
        const merged = { ...saved };
        for (const key of Object.keys(current)) {
          if (JSON.stringify(current[key]) !== JSON.stringify(snapshot[key])) merged[key] = current[key];
        }
        write(merged);
        return merged;
      });
      tail = task;
      return task;
    };
  }
  return { create };
});
