# Ensure the base directory on C drive exists
$C_Base = "C:\venvs"
if (!(Test-Path $C_Base)) { New-Item -ItemType Directory -Path $C_Base -Force | Out-Null }

# Get current project directory where the script is being executed
$Current_Project_Dir = Get-Location
Write-Host "Current Project: $Current_Project_Dir" -ForegroundColor Cyan

# 1. Ask user whether to use an existing venv or create a new one
Write-Host "`n[1] Create a brand NEW Virtual Environment" -ForegroundColor Green
Write-Host "[2] Link an EXISTING Virtual Environment from C:\venvs" -ForegroundColor Green
$Choice = Read-Host "Choose an option (1 or 2)"

if ($Choice -eq "1") {
    # Create New
    $Venv_Name = Read-Host "Enter a custom name for your new venv (e.g., .venv-omnivoice)"
    $C_Target = Join-Path $C_Base $Venv_Name
    
    Write-Host "Creating fresh Python environment at $C_Target..." -ForegroundColor Yellow
    python -m venv $C_Target
} 
else {
    # Link Existing
    $Existing_Venvs = Get-ChildItem -Path $C_Base -Directory | Select-Object -ExpandProperty Name
    if ($Existing_Venvs.Count -eq 0) {
        Write-Host "No environments found in $C_Base! Exiting." -ForegroundColor Red
        return
    }
    
    Write-Host "`nAvailable environments in ${C_Base}:" -ForegroundColor Cyan
    for ($i = 0; $i -lt $Existing_Venvs.Count; $i++) {
        Write-Host "[$i] $($Existing_Venvs[$i])"
    }
    $Index = Read-Host "Select the number of the venv to link"
    $Venv_Name = $Existing_Venvs[[int]$Index]
    $C_Target = Join-Path $C_Base $Venv_Name
}

# 2. Setup the Symlink in the current project directory
$D_Link_Path = Join-Path $Current_Project_Dir $Venv_Name

# Clear out any conflicting folder/file on D drive first
if (Test-Path $D_Link_Path) {
    Write-Host "Removing existing local folder/link at $D_Link_Path..." -ForegroundColor Yellow
    Remove-Item -Recurse -Force $D_Link_Path
}

Write-Host "Creating Symbolic Link: $D_Link_Path ---> $C_Target" -ForegroundColor Yellow
New-Item -ItemType SymbolicLink -Path $D_Link_Path -Target $C_Target | Out-Null

# 3. Activate and handle requirements.txt if present
$Activate_Script = Join-Path $D_Link_Path "Scripts\Activate.ps1"
if (Test-Path $Activate_Script) {
    Write-Host "`nSuccess! Activating environment..." -ForegroundColor Green
    & $Activate_Script
    
    if (Test-Path "requirements.txt") {
        $Install_Reqs = Read-Host "requirements.txt found! Do you want to run pip install? (y/n)"
        if ($Install_Reqs -eq 'y' -or $Install_Reqs -eq 'Y') {
            pip install -r requirements.txt
        }
    }
} else {
    Write-Host "Error: Activation script not found. Check your Python setup." -ForegroundColor Red
}
