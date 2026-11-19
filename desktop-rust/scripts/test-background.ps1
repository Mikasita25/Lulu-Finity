param(
  [Parameter(Mandatory)][string]$Executable,
  [Parameter(Mandatory)][string]$Marker
)
$ErrorActionPreference = 'Stop'
if ($env:GITHUB_ACTIONS -ne 'true') { throw 'Esta prueba usa la instalación temporal del runner.' }

$installDir = Split-Path $Executable
$backend = Join-Path $installDir 'backend/src/main.js'
Copy-Item (Join-Path $PSScriptRoot 'background-fixture.cjs') (Join-Path $installDir 'backend/src/background-fixture.cjs')
@'

ipcMain.on('app:renderer-ready', async () => {
  const marker = ciSmokeMarker('LULU_BACKGROUND_SMOKE_MARKER');
  if (!marker) return;
  try {
    const result = await require('./background-fixture.cjs')({
      main: mainWindow,
      createPlayer: createYoutubeWindow,
      expectMusic: active => { musicRecoveryState.youtube.lastProgressAt = Date.now(); markMusicExpected('youtube', active); },
      reportProgress: currentTime => noteMusicPlayerPayload('youtube', { paused: false, currentTime }),
      beginLive: async relayUrl => {
        const connection = new RailwayRelayConnection('lulu_test', relayUrl, '', relayEvents);
        liveConnection = connection;
        refreshAppSuspensionBlocker();
        attachLiveEvents(connection, ++liveConnectNonce);
        await connection.connect();
        markLiveConnectionEstablished(connection, liveConnectNonce);
        send('live:status', { status: 'connected', username: 'lulu_test', roomId: 'relay' });
      },
      endLive: () => disconnectLive('fixture')
    });
    fs.writeFileSync(marker, JSON.stringify(result));
  } catch (error) {
    fs.writeFileSync(marker, JSON.stringify({ ok: false, error: error.message }));
  }
});
'@ | Add-Content $backend -Encoding utf8NoBOM
$env:LULU_BACKGROUND_SMOKE_MARKER = $Marker
$app = Start-Process $Executable -PassThru
try {
  $limit = (Get-Date).AddSeconds(105)
  while (!(Test-Path $Marker) -and !$app.HasExited -and (Get-Date) -lt $limit) {
    Start-Sleep -Seconds 1
  }
  if (!(Test-Path $Marker)) { throw 'La app no terminó la prueba en segundo plano.' }
  $result = Get-Content $Marker -Raw | ConvertFrom-Json
  $result | ConvertTo-Json -Depth 4
  if (!$result.ok) { throw $result.error }
} finally {
  if (!$app.HasExited) { $null = & taskkill.exe /PID $app.Id /T /F }
}
