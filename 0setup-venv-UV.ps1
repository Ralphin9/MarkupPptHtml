# Ensure the base directory on C drive exists
$C_Base = "C:\venvs"
if (!(Test-Path $C_Base)) { New-Item -ItemType Directory -Path $C_Base -Force | Out-Null }

# Get current project directory where the script is being executed
$Current_Project_Dir = Get-Location
Write-Host "Current Project: $Current_Project_Dir" -ForegroundColor Cyan

# 1. Ask user whether to use an existing venv or create a new one
Write-Host "`n Create a brand NEW Virtual Environment (via uv)" -ForegroundColor Green
Write-Host " Link an EXISTING Virtual Environment from C:\venvs" -ForegroundColor Green
$Choice = Read-Host "Choose an option (1 or 2)"

if ($Choice -eq "1") {
    # Create New
    $Venv_Name = Read-Host "Enter a custom name for your new venv (e.g., .venv-omnivoice)"
    $C_Target = Join-Path $C_Base $Venv_Name
    
    # Dynamic Python Version Picker (Parses text paths directly)
    Write-Host "`nScanning system for available Python versions..." -ForegroundColor Cyan
    
    $Py_Versions = uv python list | Where-Object { $_ -and $_ -notmatch '<download available>' } | ForEach-Object {
        # Extract the version prefix (e.g., cpython-3.12.13)
        ($_ -split '\s+')[0] -replace 'cpython-', ''
    } | Select-Object -Unique
    
    if ($Py_Versions.Count -eq 0) {
        Write-Host "No installed Python versions detected. Defaulting to system python." -ForegroundColor Yellow
        uv venv $C_Target
    } else {
        Write-Host "Available Python versions on your machine:" -ForegroundColor Cyan
        for ($i = 0; $i -lt $Py_Versions.Count; $i++) {
            Write-Host "[$i] Python $($Py_Versions[$i])"
        }
        $Py_Choice = Read-Host "Select the number of the Python version to use"
        $Selected_Python = $Py_Versions[[int]$Py_Choice]
        
        Write-Host "Creating fresh Python $Selected_Python environment at $C_Target..." -ForegroundColor Yellow
        uv venv $C_Target --python $Selected_Python
    }
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

# 3. Activation and package installation
$Activate_Script = Join-Path $D_Link_Path "Scripts\Activate.ps1"
if (Test-Path $Activate_Script) {
    Write-Host "`nSuccess! Activating environment..." -ForegroundColor Green
    & $Activate_Script
    
    # Dynamically find all files matching requirements*.txt
    $Req_Files = Get-ChildItem -Path $Current_Project_Dir -Filter "requirements*.txt" | Select-Object -ExpandProperty Name
    
    if ($Req_Files.Count -gt 0) {
        Write-Host "`nFound the following requirements files:" -ForegroundColor Cyan
        for ($i = 0; $i -lt $Req_Files.Count; $i++) {
            Write-Host "[$i] $($Req_Files[$i])"
        }
        Write-Host "[$($Req_Files.Count)] Skip installation"
        
        $Req_Choice = Read-Host "Select the number of the requirements file to install"
        
        if ([int]$Req_Choice -lt $Req_Files.Count) {
            $Selected_Req = $Req_Files[[int]$Req_Choice]
            Write-Host "Installing dependencies ultra-fast via uv pip..." -ForegroundColor Yellow
            uv pip install -r $Selected_Req
        } else {
            Write-Host "Skipping library installation." -ForegroundColor Yellow
        }
    } else {
        Write-Host "No requirements*.txt files found in this project directory." -ForegroundColor Yellow
    }
} else {
    Write-Host "Error: Activation script not found. Check your Python setup." -ForegroundColor Red
}
