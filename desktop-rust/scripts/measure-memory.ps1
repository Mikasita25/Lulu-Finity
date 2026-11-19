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

function Invoke-LuluMemorySample([string]$Installer, [string]$Label, [int]$Port) {
  $installDir = Join-Path $env:RUNNER_TEMP "lulu-memory-$Label"
  $installed = Start-Process -FilePath $Installer -ArgumentList @('/S', "/D=$installDir") -Wait -PassThru
  if ($installed.ExitCode -ne 0) { throw "El instalador de $Label salió con código $($installed.ExitCode)." }
  $env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS = "--remote-debugging-port=$Port"
  $env:LULU_NATIVE_SMOKE_LOG = Join-Path $env:RUNNER_TEMP "lulu-memory-$Label.log"
  $app = Start-Process (Join-Path $installDir 'lulu-finity-rust.exe') -PassThru
  try {
    node (Join-Path $PSScriptRoot 'memory-scene.cjs') $Port
    if ($LASTEXITCODE -ne 0) { throw "Falló la escena de memoria para $Label." }
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
  $before = Invoke-LuluMemorySample $BeforeInstaller 'beta1' 9241
  if (Test-Path $profile) { Move-Item $profile "$profile-ci-beta1" }
  $after = Invoke-LuluMemorySample $AfterInstaller 'beta2' 9242
  $report = [ordered]@{
    workload = 'Cuenta de TikTok consultada una vez, luego panel principal en reposo'
    before = $before
    after = $after
  }
  $report | ConvertTo-Json -Depth 6 | Tee-Object -FilePath $OutputFile
  if ($after.webView2Processes -ge $before.webView2Processes) {
    throw 'La consulta de cuenta debe usar menos procesos WebView2 que la beta anterior.'
  }
} finally {
  Remove-Item Env:\WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS -ErrorAction SilentlyContinue
  if (Test-Path $profile) { Move-Item $profile "$profile-ci-beta2" }
  if (Test-Path $savedProfile) { Move-Item $savedProfile $profile }
}
