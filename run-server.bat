@echo off
REM Start a local HTTP server on port 8080.
REM Tries Python first, then Node.js (npx http-server), then PowerShell as fallback.

cd /d "%~dp0"

REM ---- Try Python (py launcher, then python, but skip the WindowsApps stub) ----
where py >nul 2>nul
if %errorlevel%==0 (
    echo [run-server] Using Python via 'py' launcher on http://localhost:8080
    py -m http.server 8080
    goto :eof
)

REM Detect a real python.exe (NOT the Microsoft Store alias)
for /f "delims=" %%P in ('where python 2^>nul') do (
    echo %%P | findstr /i "WindowsApps" >nul
    if errorlevel 1 (
        echo [run-server] Using Python at %%P on http://localhost:8080
        "%%P" -m http.server 8080
        goto :eof
    )
)

REM ---- Try Node.js (npx http-server) ----
where npx >nul 2>nul
if %errorlevel%==0 (
    echo [run-server] Using npx http-server on http://localhost:8080
    npx --yes http-server -p 8080 -c-1
    goto :eof
)

REM ---- Fallback: PowerShell HttpListener ----
echo [run-server] No Python or Node found. Using PowerShell fallback on http://localhost:8080
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; $root = (Get-Location).Path; $http = [System.Net.HttpListener]::new(); $http.Prefixes.Add('http://localhost:8080/'); $http.Start(); Write-Host 'Serving' $root 'at http://localhost:8080/  (Ctrl+C to stop)'; while ($http.IsListening) { $ctx = $http.GetContext(); $rel = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath.TrimStart('/')); if ([string]::IsNullOrEmpty($rel)) { $rel = 'index.html' }; $path = Join-Path $root $rel; if ((Test-Path $path) -and -not (Get-Item $path).PSIsContainer) { $ext = [IO.Path]::GetExtension($path).ToLower(); $mime = switch ($ext) { '.html' {'text/html'} '.htm' {'text/html'} '.css' {'text/css'} '.js' {'application/javascript'} '.json' {'application/json'} '.png' {'image/png'} '.jpg' {'image/jpeg'} '.jpeg' {'image/jpeg'} '.gif' {'image/gif'} '.svg' {'image/svg+xml'} '.ico' {'image/x-icon'} '.woff' {'font/woff'} '.woff2' {'font/woff2'} default {'application/octet-stream'} }; $bytes = [IO.File]::ReadAllBytes($path); $ctx.Response.ContentType = $mime; $ctx.Response.OutputStream.Write($bytes,0,$bytes.Length); } else { $ctx.Response.StatusCode = 404 }; $ctx.Response.Close() }"

pause