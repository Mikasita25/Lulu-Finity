param(
  [Parameter(Mandatory)][string]$BeforeInstaller,
  [Parameter(Mandatory)][string]$AfterInstaller,
  [Parameter(Mandatory)][string]$OutputFile
)

$ErrorActionPreference = 'Stop'
if ($env:GITHUB_ACTIONS -ne 'true' -or !$env:RUNNER_TEMP) {
  throw 'Esta comparación usa perfiles temporales de un runner de CI.'
}

function Read-LuluMemory([int]$RootId) {
  $processTree = @(Get-CimInstance Win32_Process)
  $included = [System.Collections.Generic.HashSet[int]]::new()
  [void]$included.Add($RootId)
  do {
    $previousCount = $included.Count
    foreach ($entry in $processTree) {
      if ($included.Contains([int]$entry.ParentProcessId)) {
        [void]$included.Add([int]$entry.ProcessId)
      }
    }
  } while ($included.Count -gt $previousCount)

  $samples = @(Get-CimInstance Win32_PerfRawData_PerfProc_Process | Where-Object { $included.Contains([int]$_.IDProcess) })
  if ($samples.Count -lt 2) { throw 'Windows no encontró el proceso principal y sus hijos.' }
  $private = ($samples | Measure-Object WorkingSetPrivate -Sum).Sum
  $resident = ($samples | Measure-Object WorkingSet -Sum).Sum
  [ordered]@{
    privateMiB = [math]::Round($private / 1MB, 1)
    residentMiB = [math]::Round($resident / 1MB, 1)
    webView2Processes = @($processTree | Where-Object { $included.Contains([int]$_.ProcessId) -and $_.Name -eq 'msedgewebview2.exe' }).Count
  }
}

function Invoke-LuluMemorySample([string]$Installer, [string]$Label) {
  $installDir = Join-Path $env:RUNNER_TEMP "lulu-memory-$Label"
  $installed = Start-Process -FilePath $Installer -ArgumentList @('/S', "/D=$installDir") -Wait -PassThru
  if ($installed.ExitCode -ne 0) { throw "El instalador de $Label salió con código $($installed.ExitCode)." }
  # Extend the installed app's CI-only navigation scene equally for both versions.
  # It drives the real account check and leaves the app at the dashboard.
  $backend = Join-Path $installDir 'backend/src/main.js'
  $source = Get-Content $backend -Raw
  $anchor = "goToPage('dashboard',{activateModules:false,notifyMain:false,scroll:false});"
  if ($source.Split($anchor, [System.StringSplitOptions]::None).Length -ne 2) { throw "Falta el punto de prueba en $Label." }
  $query = "const account=await window.voiceStudio.getTikTokChatStatus(); if(account.open||account.loggedIn) throw new Error('Perfil de prueba con sesión');"
  Set-Content $backend -Value ($source.Replace($anchor, "$query $anchor")) -Encoding utf8NoBOM -NoNewline
  $env:LULU_NAVIGATION_SMOKE_MARKER = Join-Path $env:RUNNER_TEMP "lulu-memory-$Label.json"
  $env:LULU_NATIVE_SMOKE_LOG = Join-Path $env:RUNNER_TEMP "lulu-memory-$Label.log"
  $app = Start-Process (Join-Path $installDir 'lulu-finity-rust.exe') -PassThru
  try {
    $limit = (Get-Date).AddSeconds(85)
    while (!(Test-Path $env:LULU_NAVIGATION_SMOKE_MARKER) -and !$app.HasExited -and (Get-Date) -lt $limit) {
      Start-Sleep -Seconds 1
    }
    if (!(Test-Path $env:LULU_NAVIGATION_SMOKE_MARKER)) { throw "La ventana de $Label no terminó la escena." }
    $navigation = Get-Content $env:LULU_NAVIGATION_SMOKE_MARKER -Raw | ConvertFrom-Json
    if (!$navigation.ok) { throw "Falló la escena de $Label. $($navigation.error)" }
    Start-Sleep -Seconds 12
    $samples = for ($i = 0; $i -lt 3; $i++) {
      Read-LuluMemory $app.Id
      Start-Sleep -Seconds 2
    }
    [ordered]@{
      samples = $samples
      privateMiB = @($samples.privateMiB | Sort-Object)[1]
      residentMiB = @($samples.residentMiB | Sort-Object)[1]
      webView2Processes = @($samples.webView2Processes | Sort-Object)[1]
    }
  } finally {
    if (!$app.HasExited) { $null = & taskkill.exe /PID $app.Id /T /F }
    Start-Sleep -Seconds 3
  }
}

$profile = Join-Path $env:APPDATA 'com.mikasita.lulufinity.rustbeta'
$savedProfile = "$profile-ci-original"
if (Test-Path $profile) { Move-Item $profile $savedProfile }
try {
  $before = Invoke-LuluMemorySample $BeforeInstaller 'beta2'
  if (Test-Path $profile) { Move-Item $profile "$profile-ci-beta2" }
  $after = Invoke-LuluMemorySample $AfterInstaller 'beta3'
  $report = [ordered]@{
    workload = 'Cuenta de TikTok consultada una vez, luego panel principal en reposo'
    before = $before
    after = $after
    targetResidentMiB = 250
    targetMetInThisScenario = $after.residentMiB -lt 250
  }
  $report | ConvertTo-Json -Depth 6 | Tee-Object -FilePath $OutputFile
} finally {
  Remove-Item Env:\LULU_NAVIGATION_SMOKE_MARKER -ErrorAction SilentlyContinue
  if (Test-Path $profile) { Move-Item $profile "$profile-ci-beta3" }
  if (Test-Path $savedProfile) { Move-Item $savedProfile $profile }
}
