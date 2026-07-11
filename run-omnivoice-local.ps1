# ============================================================
# Launch a LOCAL OmniVoice TTS server for Script -> Video.
# Apache-2.0, free, fully offline once the model is cached.
#  winget install Gyan.FFmpeg  -- TODO
# Usage (from this folder):
#   .\run-omnivoice-local.ps1
# ============================================================
$ErrorActionPreference = 'Stop'
if (Get-Variable PSNativeCommandUseErrorActionPreference -ErrorAction SilentlyContinue) {
    $PSNativeCommandUseErrorActionPreference = $false
}
Set-Location -Path "$PSScriptRoot"

if (Get-NetTCPConnection -LocalPort 8001 -State Listen -ErrorAction SilentlyContinue) {
    Write-Host "[omnivoice] local server is already running on http://localhost:8001" -ForegroundColor Green
    exit 0
}

$venv = ".venv-omnivoice"
$python = Join-Path $venv "Scripts\python.exe"

if (-not (Test-Path $python)) {
    Write-Host "[omnivoice] $venv not found - creating with Python 3.12, 3.11, or 3.10..." -ForegroundColor Yellow
    Write-Host "[omnivoice] $venv # 1. Activate your environment  . .\.venv-omnivoice\Scripts\Activate.ps1..." -ForegroundColor Yellow
    Write-Host "[omnivoice] $venv # 2. Boot up the local Gradio interface demo    omnivoice-demo --ip 0.0.0.0 --port 8001 --no-asr ..." -ForegroundColor Yellow
    Write-Host "[omnivoice] $venv # 3. uv pip install -r requirements-omnivoice-uv.lock.txt --force-reinstall ..." -ForegroundColor Yellow
    

   
        


    $created = $false
    if (Get-Command py -ErrorAction SilentlyContinue) {
        foreach ($version in @("3.12", "3.11", "3.10")) {
            if (-not $created) {
                $probeErrorPreference = $ErrorActionPreference
                $ErrorActionPreference = 'Continue'
                & py "-$version" -m venv $venv 2>$null
                $ErrorActionPreference = $probeErrorPreference
                if (Test-Path $python) {
                    Write-Host "[omnivoice] created $venv with Python $version." -ForegroundColor Green
                    $created = $true
                }
            }
        }
    }
    if (-not $created -and (Get-Command uv -ErrorAction SilentlyContinue)) {
        Write-Host "[omnivoice] Python 3.10-3.12 not registered with py.exe - using uv to install Python 3.12..." -ForegroundColor Yellow
        & uv python install 3.12
        if ($LASTEXITCODE -eq 0) {
            & uv venv $venv --python 3.12
            if (Test-Path $python) {
                Write-Host "[omnivoice] created $venv with Python 3.12 via uv." -ForegroundColor Green
                $created = $true
            }
        }
    }
    if (-not $created) {
        Write-Error "Could not create $venv. Install Python 3.10-3.12 from python.org or install uv."
        exit 1
    }
}

Write-Host "[omnivoice] using interpreter: $python" -ForegroundColor Cyan
& $python --version
& $python -c "import sys; raise SystemExit(0 if (3,10) <= sys.version_info[:2] <= (3,12) else 1)"
if ($LASTEXITCODE -ne 0) {
    Write-Error "$venv must use Python 3.10-3.12. Python 3.12 is recommended on Windows. Rename or delete $venv, install Python 3.10-3.12, then run this script again."
    exit 1
}

Write-Host "[omnivoice] checking install..." -ForegroundColor Cyan
$installed = $false
try {
    # Check for omnivoice directly via Python import rather than pip show
    & $python -c "import omnivoice" 2>$null
    if ($LASTEXITCODE -eq 0) { $installed = $true }
} catch { }

if (-not $installed) {
    Write-Host "[omnivoice] installing requirements into $venv..." -ForegroundColor Yellow
    # Use uv directly if available, otherwise fall back to standard pip bootstrap
    if (Get-Command uv -ErrorAction SilentlyContinue) {
        & uv pip install torch torchaudio --index-url https://download.pytorch.org/whl/cpu
        & uv pip install -r requirements-omnivoice-uv.lock.txt
    } else {
        & $python -m ensurepip --upgrade
        & $python -m pip install --upgrade pip
        & $python -m pip install torch torchaudio --index-url https://download.pytorch.org/whl/cpu
        & $python -m pip install -r requirements-omnivoice-uv.lock.txt
    }
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Package installation failed. See https://github.com/k2-fsa/OmniVoice for PyTorch instructions."
        exit 1
    }
}


Write-Host "[omnivoice] starting local server on http://localhost:8001 ..." -ForegroundColor Green
Write-Host "[omnivoice] press Ctrl+C to stop" -ForegroundColor Yellow
. (Join-Path $PSScriptRoot "$venv\Scripts\Activate.ps1")
# Skip HuggingFace Hub online freshness checks — use cached model files directly.
$env:HF_HUB_OFFLINE = '1'
$env:TRANSFORMERS_OFFLINE = '1'
# Suppress Gradio analytics / pkg-version HTTP call.
$env:GRADIO_ANALYTICS_ENABLED = '0'
$siteCustomize = Join-Path $PSScriptRoot 'tools\omnivoice_sitecustomize'
if ($env:PYTHONPATH) {
    $env:PYTHONPATH = "$siteCustomize;$env:PYTHONPATH"
} else {
    $env:PYTHONPATH = $siteCustomize
}

Write-Host "[omnivoice] locating winget raw ffmpeg binaries..." -ForegroundColor Yellow
$ffmpegBin = (Get-ChildItem -Path "$env:LOCALAPPDATA\Microsoft\WinGet\Packages" -Filter "ffmpeg.exe" -Recurse -ErrorAction SilentlyContinue).DirectoryName
if ($ffmpegBin) {
    $env:Path += ";$ffmpegBin"
    Write-Host "[omnivoice] injected path destination: $ffmpegBin" -ForegroundColor Green
} else {
    Write-Host "[omnivoice] raw binary folder not discovered. Ensure winget installation completed." -ForegroundColor Red
}

Write-Host "[omnivoice] running: omnivoice-demo --ip 0.0.0.0 --port 8001 --no-asr" -ForegroundColor Cyan
omnivoice-demo --ip 0.0.0.0 --port 8001 --no-asr


Write-Host "[omnivoice] server stopped." -ForegroundColor Yellow
