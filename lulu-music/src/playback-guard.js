'use strict';

(() => {
  const api = window.luluMusic;
  const audio = document.getElementById('audiusPlayer');
  if (!api || !audio) return;

  const STALL_MS = 7000;
  const MAX_RECOVERIES = 2;
  let appState = null;
  let active = false;
  let nonce = 0;
  let userPaused = false;
  let lastTime = 0;
  let lastAdvanceAt = Date.now();
  let recoveryAttempts = 0;
  let recoveryTimer = null;
  let recovering = false;

  function clearRecoveryTimer() {
    if (recoveryTimer) clearTimeout(recoveryTimer);
    recoveryTimer = null;
  }

  function resetProgress() {
    lastTime = Math.max(0, Number(audio.currentTime) || 0);
    lastAdvanceAt = Date.now();
  }

  function deactivate() {
    active = false;
    userPaused = false;
    recoveryAttempts = 0;
    recovering = false;
    clearRecoveryTimer();
  }

  async function forceReloadAtCurrentTime() {
    const source = String(audio.currentSrc || audio.src || '');
    if (!source) throw new Error('el stream ya no tiene una fuente activa');
    const resumeAt = Math.max(0, Number(audio.currentTime) || 0);
    const volume = audio.volume;
    audio.pause();
    audio.src = source;
    audio.load();
    await new Promise((resolve, reject) => {
      let settled = false;
      const cleanup = () => {
        audio.removeEventListener('loadedmetadata', onReady);
        audio.removeEventListener('canplay', onReady);
        audio.removeEventListener('error', onError);
        clearTimeout(timer);
      };
      const finish = (callback) => {
        if (settled) return;
        settled = true;
        cleanup();
        callback();
      };
      const onReady = () => finish(resolve);
      const onError = () => finish(() => reject(new Error('el stream no volvió a cargar')));
      const timer = setTimeout(() => finish(() => reject(new Error('el stream tardó demasiado en volver'))), 5000);
      audio.addEventListener('loadedmetadata', onReady, { once:true });
      audio.addEventListener('canplay', onReady, { once:true });
      audio.addEventListener('error', onError, { once:true });
    });
    if (Number.isFinite(resumeAt) && resumeAt > 0 && Number.isFinite(audio.duration) && audio.duration > resumeAt) {
      try { audio.currentTime = resumeAt; } catch {}
    }
    audio.volume = volume;
    await audio.play();
  }

  function reportFinalFailure(message) {
    api.reportAudiusState({
      nonce,
      type:'error',
      currentTime:Number(audio.currentTime) || 0,
      duration:Number(audio.duration) || 0,
      message:String(message || 'el stream dejó de avanzar')
    });
  }

  async function recover() {
    clearRecoveryTimer();
    if (!active || userPaused || recovering || !audio.getAttribute('src') || audio.ended) return;
    recovering = true;
    recoveryAttempts += 1;
    try {
      if (audio.paused && recoveryAttempts === 1) {
        await audio.play();
      } else {
        await forceReloadAtCurrentTime();
      }
      resetProgress();
    } catch (error) {
      if (recoveryAttempts >= MAX_RECOVERIES) reportFinalFailure(error?.message || 'el stream no pudo recuperarse');
      else scheduleRecovery(900);
    } finally {
      recovering = false;
    }
  }

  function scheduleRecovery(delay = 1600) {
    if (!active || userPaused || recoveryTimer || recovering || !audio.getAttribute('src') || audio.ended) return;
    recoveryTimer = setTimeout(() => void recover(), Math.max(300, Number(delay) || 1600));
  }

  audio.addEventListener('timeupdate', () => {
    if (!active) return;
    const current = Math.max(0, Number(audio.currentTime) || 0);
    if (current > lastTime + 0.08) {
      lastTime = current;
      lastAdvanceAt = Date.now();
      recoveryAttempts = 0;
      clearRecoveryTimer();
    }
  });
  audio.addEventListener('playing', () => {
    if (!active) return;
    resetProgress();
    if (!userPaused) clearRecoveryTimer();
  });
  audio.addEventListener('waiting', () => scheduleRecovery(1800));
  audio.addEventListener('stalled', () => scheduleRecovery(1800));
  audio.addEventListener('pause', () => {
    if (active && !userPaused && !audio.ended && audio.getAttribute('src')) scheduleRecovery(1200);
  });
  audio.addEventListener('ended', deactivate);

  api.onState((state) => { appState = state || appState; });
  api.onAudiusLoad((payload = {}) => {
    active = true;
    nonce = Number(payload.nonce) || 0;
    userPaused = false;
    recoveryAttempts = 0;
    clearRecoveryTimer();
    setTimeout(resetProgress, 0);
  });
  api.onAudiusCommand((payload = {}) => {
    const action = String(payload.action || '');
    const commandNonce = Number(payload.nonce) || 0;
    if (action === 'stop') {
      if (!commandNonce || commandNonce === nonce) deactivate();
      return;
    }
    if (commandNonce !== nonce) return;
    if (action === 'toggle') {
      const wasPaused = Boolean(appState?.playback?.paused);
      userPaused = !wasPaused;
      if (wasPaused) {
        userPaused = false;
        resetProgress();
      } else {
        clearRecoveryTimer();
      }
    }
    if (action === 'restart') {
      userPaused = false;
      recoveryAttempts = 0;
      resetProgress();
    }
  });

  setInterval(() => {
    if (!active || userPaused || recovering || audio.ended || !audio.getAttribute('src')) return;
    const current = Math.max(0, Number(audio.currentTime) || 0);
    if (current > lastTime + 0.08) {
      lastTime = current;
      lastAdvanceAt = Date.now();
      return;
    }
    if (Date.now() - lastAdvanceAt >= STALL_MS) scheduleRecovery(300);
  }, 1500);
})();
