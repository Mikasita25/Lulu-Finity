param(
  [Parameter(Mandatory)][string]$Executable,
  [Parameter(Mandatory)][string]$Marker
)
$ErrorActionPreference = 'Stop'
if ($env:GITHUB_ACTIONS -ne 'true') { throw 'Esta prueba usa la instalación temporal del runner.' }

foreach ($name in @('AudioEndpointBuilder', 'Audiosrv')) {
  $service = Get-Service $name -ErrorAction SilentlyContinue
  if ($service -and $service.Status -ne 'Running') {
    try { Start-Service $service -ErrorAction Stop }
    catch { Write-Warning $_.Exception.Message }
  }
}

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
$env:RUST_BACKTRACE = '1'
$since = Get-Date
$stderr = "$Marker.stderr.log"
$stdout = "$Marker.stdout.log"
$app = Start-Process $Executable -RedirectStandardError $stderr -RedirectStandardOutput $stdout -PassThru
try {
  $limit = (Get-Date).AddSeconds(140)
  while (!(Test-Path $Marker) -and !$app.HasExited -and (Get-Date) -lt $limit) {
    Start-Sleep -Seconds 1
  }
  if (!(Test-Path $Marker)) {
    if (Test-Path $stderr) { Get-Content $stderr -Tail 35 }
    $backendLog = Join-Path $env:APPDATA 'com.mikasita.lulufinity.rustbeta/backend.log'
    if (Test-Path $backendLog) { Get-Content $backendLog -Tail 30 }
    Get-WinEvent -FilterHashtable @{LogName='Application'; Id=1000,1001; StartTime=$since} -ErrorAction SilentlyContinue |
      Where-Object { $_.Message -match 'lulu-finity-rust\.exe' } | Select-Object -First 4 -ExpandProperty Message
    throw "La app no terminó la prueba en segundo plano (salida: $($app.ExitCode))."
  }
  $result = Get-Content $Marker -Raw | ConvertFrom-Json
  $result | ConvertTo-Json -Depth 4
  if (!$result.ok) { throw $result.error }
} finally {
  if (!$app.HasExited) { $null = & taskkill.exe /PID $app.Id /T /F }
}
