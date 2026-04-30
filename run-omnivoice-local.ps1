# ============================================================
# Launch a LOCAL OmniVoice TTS server for Script -> Video.
# Apache-2.0, free, fully offline once the model is cached.
#
# Usage (from this folder):
#   .\run-omnivoice-local.ps1
# ============================================================
$ErrorActionPreference = 'Stop'
if (Get-Variable PSNativeCommandUseErrorActionPreference -ErrorAction SilentlyContinue) {
    $PSNativeCommandUseErrorActionPreference = $false
}
Set-Location -Path "$PSScriptRoot"

$venv = ".venv-omnivoice"
$python = Join-Path $venv "Scripts\python.exe"

if (-not (Test-Path $python)) {
    Write-Host "[omnivoice] $venv not found - creating with Python 3.12, 3.11, or 3.10..." -ForegroundColor Yellow
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
    & $python -c "import omnivoice" 2>$null
    if ($LASTEXITCODE -eq 0) { $installed = $true }
} catch { }

if (-not $installed) {
    Write-Host "[omnivoice] installing requirements into $venv..." -ForegroundColor Yellow
    & $python -m pip --version 2>$null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[omnivoice] pip not found - bootstrapping with ensurepip..." -ForegroundColor Yellow
        & $python -m ensurepip --upgrade
    }
    & $python -m pip install --upgrade pip
    & $python -m pip install torch torchaudio --index-url https://download.pytorch.org/whl/cpu
    & $python -m pip install -r requirements-omnivoice.txt
    if ($LASTEXITCODE -ne 0) {
        Write-Error "pip install failed. See https://github.com/k2-fsa/OmniVoice for PyTorch instructions."
        exit 1
    }
}

Write-Host "[omnivoice] starting local server on http://localhost:8001 ..." -ForegroundColor Green
. .venv-omnivoice\Scripts\Activate.ps1
& $python -m omnivoice.cli.demo --ip 0.0.0.0 --port 8001 @args
