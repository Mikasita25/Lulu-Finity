'use strict';

function retainMusicWindow(window, playback) {
  if (!window || window.isDestroyed()) return false;
  return window.isVisible() || window.webContents.isLoadingMainFrame()
    || Boolean(playback.expectedPlaying || playback.userPaused || playback.replacing || playback.recoveryTimer);
}

module.exports = { retainMusicWindow };
