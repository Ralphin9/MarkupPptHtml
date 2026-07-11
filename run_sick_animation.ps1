Set-Location -Path "$PSScriptRoot"
$env:PATH = [System.Environment]::GetEnvironmentVariable("PATH", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("PATH", "User")
$env:PATH = "C:\Users\ralph\AppData\Local\Programs\MiKTeX\miktex\bin\x64;" + $env:PATH
. .venv\Scripts\Activate.ps1
.venv\Scripts\python.exe -m manim render media\sick_animation8-YT.py
pause