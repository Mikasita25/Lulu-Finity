param(
  [Parameter(Mandatory = $true)][string]$OutputZip
)

$ErrorActionPreference = "Stop"
$PSNativeCommandUseErrorActionPreference = $true
$OpenVoiceCommit = "74a1d147b17a8c3092dd5430504bd83ef6c7eb23"
$OpenVoiceModelCommit = "fd981100305a0e4291f93a9ad169c6d9f7bed54a"
$OpenVoiceCheckpointSha256 = "9652c27e92b6b2a91632590ac9962ef7ae2b712e5c5b7f4c34ec55ee2b37ab9e"
$PythonVersion = "3.9.13"
$Work = Join-Path $env:RUNNER_TEMP "lulu-clone-engine"
$Runtime = Join-Path $Work "runtime"
$PythonRoot = Join-Path $Runtime "python"
$SitePackages = Join-Path $PythonRoot "Lib/site-packages"

Remove-Item $Work -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory $PythonRoot -Force | Out-Null
New-Item -ItemType Directory $SitePackages -Force | Out-Null

$PythonArchive = Join-Path $Work "python-embed.zip"
Invoke-WebRequest "https://www.python.org/ftp/python/$PythonVersion/python-$PythonVersion-embed-amd64.zip" -OutFile $PythonArchive
Expand-Archive $PythonArchive -DestinationPath $PythonRoot -Force
$PthPath = Join-Path $PythonRoot "python39._pth"
$Pth = Get-Content $PthPath
$Pth = $Pth | ForEach-Object { if ($_ -eq "#import site") { "import site" } else { $_ } }
$Pth += "Lib/site-packages"
[IO.File]::WriteAllLines($PthPath, $Pth, [Text.UTF8Encoding]::new($false))

python -m pip install --disable-pip-version-check --no-compile --upgrade --target $SitePackages --index-url https://download.pytorch.org/whl/cpu --extra-index-url https://pypi.org/simple "torch==2.2.2"
python -m pip install --disable-pip-version-check --no-compile --upgrade --target $SitePackages "numpy==1.26.4" "scipy==1.13.1" "soundfile==0.12.1" "librosa==0.10.2.post1"
python -m pip install --disable-pip-version-check --no-compile --no-deps --target $SitePackages "git+https://github.com/myshell-ai/OpenVoice.git@$OpenVoiceCommit"

# La conversión de timbre no usa el procesador de texto de OpenVoice. Quitar esta
# importación evita incluir dependencias de chino/japonés que Lulu Finity bloquea.
$ApiPath = Join-Path $SitePackages "openvoice/api.py"
$Api = Get-Content $ApiPath -Raw
$Api = $Api.Replace("from openvoice.text import text_to_sequence`n", "")
$Api = $Api.Replace("from openvoice.text import text_to_sequence`r`n", "")
[IO.File]::WriteAllText($ApiPath, $Api, [Text.UTF8Encoding]::new($false))

$ConverterRoot = Join-Path $Runtime "checkpoints_v2/converter"
New-Item -ItemType Directory $ConverterRoot -Force | Out-Null
$Checkpoint = Join-Path $ConverterRoot "checkpoint.pth"
$Config = Join-Path $ConverterRoot "config.json"
$ModelBase = "https://huggingface.co/myshell-ai/OpenVoiceV2/resolve/$OpenVoiceModelCommit/converter"
Invoke-WebRequest "$ModelBase/checkpoint.pth?download=true" -OutFile $Checkpoint
Invoke-WebRequest "$ModelBase/config.json?download=true" -OutFile $Config
if ((Get-FileHash $Checkpoint -Algorithm SHA256).Hash.ToLower() -ne $OpenVoiceCheckpointSha256) {
  throw "El checkpoint oficial de OpenVoice V2 no coincide con su SHA-256 publicado."
}
$ConfigJson = Get-Content $Config -Raw | ConvertFrom-Json
if ($ConfigJson._version_ -ne "v2" -or $ConfigJson.data.sampling_rate -ne 22050) {
  throw "La configuración oficial de OpenVoice V2 no contiene el conversor esperado."
}

Copy-Item "build-v1001/engine/lulu-clone-engine.py" (Join-Path $Runtime "lulu-clone-engine.py") -Force
Invoke-WebRequest "https://raw.githubusercontent.com/myshell-ai/OpenVoice/$OpenVoiceCommit/LICENSE" -OutFile (Join-Path $Runtime "OPENVOICE-LICENSE.txt")
@"
Lulu Finity Clone Engine 1.0.1
OpenVoice V2 source and checkpoints: MyShell/MIT, pinned at source $OpenVoiceCommit and model $OpenVoiceModelCommit.
Python: Python Software Foundation License.
PyTorch: BSD-style license.
The bundled reference voice is distributed with the speaker owner's explicit authorization.
"@ | Set-Content (Join-Path $Runtime "THIRD_PARTY_NOTICES.txt") -Encoding UTF8

& (Join-Path $PythonRoot "python.exe") -c "import torch, librosa, soundfile; from openvoice.api import ToneColorConverter; print(torch.__version__)"

$OutputFull = [IO.Path]::GetFullPath($OutputZip)
Remove-Item $OutputFull -Force -ErrorAction SilentlyContinue
Compress-Archive -Path "$Runtime/*" -DestinationPath $OutputFull -CompressionLevel Optimal -Force
$Hash = (Get-FileHash $OutputFull -Algorithm SHA256).Hash.ToLower()
$Size = (Get-Item $OutputFull).Length
Write-Output "ENGINE_ZIP=$OutputFull"
Write-Output "ENGINE_SHA256=$Hash"
Write-Output "ENGINE_BYTES=$Size"
