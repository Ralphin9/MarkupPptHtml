# ============================================================
# Start a local HTTP server on port 8080.
# Prefers .venv\Scripts\python.exe, then py launcher, then npx.
# ============================================================
$ErrorActionPreference = 'Stop'
Set-Location -Path $PSScriptRoot

$port = 8080
$venvPython = Join-Path $PSScriptRoot '.venv\Scripts\python.exe'

# ---- Prefer the project venv (and ensure it's usable) ----
if (Test-Path $venvPython) {
    $venvOk = $false
    try {
        & $venvPython --version *> $null
        $venvOk = $true
    } catch {
        $venvOk = $false
    }
    if ($venvOk) {
        Write-Host "[run-server] Using .venv Python on http://localhost:$port" -ForegroundColor Green
        & $venvPython -m http.server $port
        return
    }

    Write-Host "[run-server] .venv Python is broken or points to a missing interpreter." -ForegroundColor Yellow
    # Try to recreate the venv using the py launcher if available
    if (Get-Command py -ErrorAction SilentlyContinue) {
        Write-Host "[run-server] Recreating .venv with available Python versions via py..." -ForegroundColor Yellow
        Remove-Item -Recurse -Force (Join-Path $PSScriptRoot '.venv') -ErrorAction SilentlyContinue
        $created = $false
        foreach ($version in @("3.12", "3.11", "3.10")) {
            if (-not $created) {
                $probeErrorPreference = $ErrorActionPreference
                $ErrorActionPreference = 'Continue'
                & py "-$version" -m venv ".venv" 2>$null
                $ErrorActionPreference = $probeErrorPreference
                if (Test-Path $venvPython) {
                    Write-Host "[run-server] created .venv with Python $version." -ForegroundColor Green
                    $created = $true
                }
            }
        }
        if ($created) {
            & $venvPython -m http.server $port
            return
        }
    }
    Write-Host "[run-server] Could not recreate .venv automatically; falling back to other launchers." -ForegroundColor Yellow
}

# ---- Fall back to py launcher ----
if (Get-Command py -ErrorAction SilentlyContinue) {
    Write-Host "[run-server] .venv not found - using py launcher on http://localhost:$port" -ForegroundColor Yellow
    & py -m http.server $port
    return
}

# ---- Fall back to npx http-server ----
if (Get-Command npx -ErrorAction SilentlyContinue) {
    Write-Host "[run-server] Using npx http-server on http://localhost:$port" -ForegroundColor Yellow
    & npx --yes http-server -p $port -c-1
    return
}

Write-Error "No Python (.venv, py) or Node (npx) found. Install Python 3.9+ or Node.js."
