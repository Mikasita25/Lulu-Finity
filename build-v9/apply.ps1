$ErrorActionPreference = 'Stop'

$parts = Get-ChildItem "build-v9/patch/part-*.txt" | Sort-Object Name
if ($parts.Count -ne 3) { throw "Se esperaban 3 fragmentos y se encontraron $($parts.Count)." }

$encoded = ($parts | ForEach-Object { Get-Content $_.FullName -Raw }) -join ""
$gzipBytes = [Convert]::FromBase64String($encoded)
[IO.File]::WriteAllBytes("apply_v9.py.gz", $gzipBytes)
$gzipHash = (Get-FileHash "apply_v9.py.gz" -Algorithm SHA256).Hash.ToLower()
if ($gzipHash -ne "ec65384b772a5bf544cb29973db52ae5ef1d377213a42fb05ce4851783b9b79b") {
  throw "El hash del paquete de actualización no coincide: $gzipHash"
}

$input = [IO.File]::OpenRead("apply_v9.py.gz")
$output = [IO.File]::Create("apply_v9.py")
$stream = [IO.Compression.GZipStream]::new($input, [IO.Compression.CompressionMode]::Decompress)
try { $stream.CopyTo($output) } finally { $stream.Dispose(); $output.Dispose(); $input.Dispose() }

$scriptHash = (Get-FileHash "apply_v9.py" -Algorithm SHA256).Hash.ToLower()
if ($scriptHash -ne "79b4e59734dba454c40c51696dbb6e9a81366ae1fd0aba9f6ad245ecee62365d") {
  throw "El hash del script no coincide: $scriptHash"
}

python apply_v9.py

Push-Location app
try {
  node --check src/main.js
  node --check src/preload.js
  node --check src/renderer.js

  $package = Get-Content package.json -Raw | ConvertFrom-Json
  if ($package.version -ne "0.9.0") { throw "Versión inesperada: $($package.version)" }
  if ($package.build.productName -ne "Lulu Finity") { throw "Nombre de producto incorrecto." }
  if ($package.build.win.requestedExecutionLevel -ne "asInvoker") { throw "La app solicita elevación." }
  if ($package.build.nsis.perMachine -ne $false -or $package.build.nsis.allowElevation -ne $false) {
    throw "El instalador no está configurado por usuario."
  }

  $html = Get-Content src/index.html -Raw
  $main = Get-Content src/main.js -Raw
  $renderer = Get-Content src/renderer.js -Raw
  $styles = Get-Content src/styles.css -Raw

  if ($html.Contains('mascot-wrap')) { throw "La mascota todavía está en el panel lateral." }
  foreach ($required in @('sidebarStatusText','sidebarUsername','dashboardStatsPanel','dashboardCommentsPanel','dashboardMusicPanel','dashboardSimulatorPanel')) {
    if (!$html.Contains("id=`"$required`"")) { throw "Falta el control $required" }
  }
  foreach ($removed in @('dashboardCommandsList','dashboardNewCommandBtn','permissionSummary')) {
    if ($html.Contains("id=`"$removed`"")) { throw "El bloque $removed continúa en el panel general." }
  }
  foreach ($required in @('maxSongDurationMinutes','preventDuplicateSongs','blockedSongs','blockedChannels','themeMode','glowIntensity','panelOpacity','cornerRadius','hiddenDashboardPanels')) {
    if (!$main.Contains($required) -or !$renderer.Contains($required)) { throw "Falta la función $required" }
  }
  foreach ($required in @('maxSongDurationInput','preventDuplicateSongsInput','blockedSongsInput','blockedChannelsInput','themeModeInput','glowIntensityInput','panelOpacityInput','cornerRadiusInput')) {
    if (!$html.Contains("id=`"$required`"")) { throw "Falta el ajuste $required" }
  }
  if (!$styles.Contains('::-webkit-scrollbar') -or !$styles.Contains('dashboard-hidden')) {
    throw "Falta la corrección del scrollbar o la visibilidad del panel."
  }
  if ($main.Contains("app.getPath('localAppData')") -or $main.Contains('app.getPath("localAppData")')) {
    throw "Regresó el error de LocalAppData."
  }
} finally {
  Pop-Location
}
