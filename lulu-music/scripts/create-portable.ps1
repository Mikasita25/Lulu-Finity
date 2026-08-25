$ErrorActionPreference = "Stop"
$PSNativeCommandUseErrorActionPreference = $true

$project = Split-Path $PSScriptRoot -Parent
$source = Join-Path $project "dist/win-unpacked"
$target = Join-Path $project "dist/Lulu-Music-1.0.2-x64.zip"
$temporary = Join-Path ([IO.Path]::GetTempPath()) ("lulu-music-portable-" + [Guid]::NewGuid().ToString("N"))

foreach ($required in @(
  (Join-Path $source "Lulu Music.exe"),
  (Join-Path $source "resources/app.asar")
)) {
  if (!(Test-Path $required -PathType Leaf)) { throw "Falta $required antes de crear el ZIP portable" }
}

Remove-Item $target -Force -ErrorAction SilentlyContinue
Compress-Archive -Path (Join-Path $source "*") -DestinationPath $target -CompressionLevel Optimal

try {
  New-Item -ItemType Directory $temporary -Force | Out-Null
  Expand-Archive -Path $target -DestinationPath $temporary -Force
  foreach ($required in @(
    (Join-Path $temporary "Lulu Music.exe"),
    (Join-Path $temporary "resources/app.asar")
  )) {
    if (!(Test-Path $required -PathType Leaf)) { throw "El ZIP portable no contiene $required" }
  }
}
finally {
  Remove-Item $temporary -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Host "ZIP portable creado y verificado: $target"
