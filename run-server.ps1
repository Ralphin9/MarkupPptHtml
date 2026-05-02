# ============================================================
# Start a local HTTP server on port 8080.
# Prefers .venv\Scripts\python.exe, then py launcher, then npx.
# ============================================================
$ErrorActionPreference = 'Stop'
Set-Location -Path $PSScriptRoot

$port = 8080
$venvPython = Join-Path $PSScriptRoot '.venv\Scripts\python.exe'

# ---- Prefer the project venv ----
if (Test-Path $venvPython) {
    Write-Host "[run-server] Using .venv Python on http://localhost:$port" -ForegroundColor Green
    & $venvPython -m http.server $port
    return
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
