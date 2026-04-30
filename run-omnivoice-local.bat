@echo off
REM ============================================================
REM Launch a LOCAL OmniVoice TTS server for Script -> Video.
REM Apache-2.0, free, fully offline once the model is cached.
REM ============================================================
setlocal
cd /d "%~dp0"

powershell -NoProfile -ExecutionPolicy Bypass -Command "if (Get-NetTCPConnection -LocalPort 8001 -State Listen -ErrorAction SilentlyContinue) { exit 0 } exit 1" >nul 2>nul
if not errorlevel 1 (
  echo [omnivoice] local server is already running on http://localhost:8001
  exit /b 0
)

set "VENV=.venv-omnivoice"
set "PY=%VENV%\Scripts\python.exe"

if not exist "%PY%" (
  echo [omnivoice] %VENV% not found - creating with Python 3.12, 3.11, or 3.10...
  set "CREATED="
  where py >nul 2>&1
  if not errorlevel 1 (
    for %%V in (3.12 3.11 3.10) do (
      if not defined CREATED (
        py -%%V -m venv "%VENV%" >nul 2>nul
        if exist "%PY%" set "CREATED=%%V"
      )
    )
  )
  if not defined CREATED (
    where uv >nul 2>&1
    if not errorlevel 1 (
      echo [omnivoice] Python 3.10-3.12 not registered with py.exe - using uv to install Python 3.12...
      uv python install 3.12
      if not errorlevel 1 (
        uv venv "%VENV%" --python 3.12
        if exist "%PY%" set "CREATED=3.12 via uv"
      )
    )
  )
  if not defined CREATED (
    echo [error] Could not create %VENV%. Install Python 3.10-3.12 from python.org or install uv.
    exit /b 1
  )
  echo [omnivoice] created %VENV% with Python %CREATED%.
)

echo [omnivoice] using interpreter: %PY%
"%PY%" --version
"%PY%" -c "import sys; raise SystemExit(0 if (3,10) <= sys.version_info[:2] <= (3,12) else 1)" >nul 2>nul
if errorlevel 1 (
  echo [error] %VENV% must use Python 3.10-3.12. Python 3.12 is recommended on Windows.
  echo Rename or delete %VENV%, install Python 3.10-3.12, then run this script again.
  exit /b 1
)

echo [omnivoice] checking install...
"%PY%" -m pip show omnivoice >nul 2>nul
if errorlevel 1 (
  echo [omnivoice] installing requirements into %VENV%...
  "%PY%" -m pip --version >nul 2>nul
  if errorlevel 1 (
    echo [omnivoice] pip not found - bootstrapping with ensurepip...
    "%PY%" -m ensurepip --upgrade
  )
  "%PY%" -m pip install --upgrade pip
  "%PY%" -m pip install torch torchaudio --index-url https://download.pytorch.org/whl/cpu
  "%PY%" -m pip install -r requirements-omnivoice.txt
  if errorlevel 1 (
    echo [error] pip install failed. See https://github.com/k2-fsa/OmniVoice
    echo Tip: OmniVoice expects Python 3.10-3.12 plus PyTorch.
    exit /b 1
  )
)

echo [omnivoice] starting local server on http://localhost:8001 ...
call "%VENV%\Scripts\activate.bat"
"%PY%" -m omnivoice.cli.demo --ip 0.0.0.0 --port 8001 --no-asr %*
