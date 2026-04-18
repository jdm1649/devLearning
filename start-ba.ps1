# start-ba.ps1 - Tier 1 Prompt Lab (ba-taskmanager) one-shot launcher
#
# What it does:
#   1. Frees ports 5151 (backend) and 5173 (frontend) if anything is bound.
#   2. Warns if LM Studio is not listening on 1234 (model calls will fail).
#   3. Runs `npm install` in frontend/ only if node_modules is missing.
#   4. Opens ONE Windows Terminal window with three tabs:
#        - Tab 1: backend  (dotnet run, port 5151)
#        - Tab 2: frontend (npm run dev, port 5173)
#        - Tab 3: commands (empty prompt in repo root; run .\stop-ba.ps1 here)
#
# Each tab runs a tiny helper in scripts/ so there is no fragile quoting in
# the wt.exe command line.
#
# Requirements:
#   - Windows Terminal (wt.exe). Installed by default on Windows 11 and via the
#     Microsoft Store on Windows 10.
#
# Usage:
#   .\start-ba.ps1
#
# Stop with (from the "commands" tab or anywhere):
#   .\stop-ba.ps1

$ErrorActionPreference = 'Stop'
$root        = $PSScriptRoot
$scriptsDir  = Join-Path $root 'scripts'
$frontendDir = Join-Path $root 'frontend'

$backendPort  = 5151
$frontendPort = 5173
$lmStudioPort = 1234

function Write-Step($msg) { Write-Host "==> $msg" -ForegroundColor Cyan }
function Write-Ok($msg)   { Write-Host "    $msg" -ForegroundColor Green }
function Write-Warn2($msg){ Write-Host "    $msg" -ForegroundColor Yellow }
function Write-Err2($msg) { Write-Host "    $msg" -ForegroundColor Red }

function Free-Port {
    param([int]$Port, [string]$Label)
    $conn = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
    if (-not $conn) {
        Write-Ok "port $Port free ($Label)"
        return
    }
    $pid2 = $conn.OwningProcess
    $proc = Get-Process -Id $pid2 -ErrorAction SilentlyContinue
    $pname = if ($proc) { $proc.ProcessName } else { '<unknown>' }
    Write-Warn2 "port $Port is bound by pid=$pid2 ($pname) - killing"
    try {
        Stop-Process -Id $pid2 -Force -ErrorAction Stop
        Start-Sleep -Milliseconds 500
        Write-Ok "port $Port freed"
    } catch {
        Write-Err2 "failed to free port $Port : $($_.Exception.Message)"
        throw
    }
}

Write-Host ""
Write-Host "  Prompt Lab Tier 1 (ba-taskmanager) - starting" -ForegroundColor White
Write-Host "  root: $root" -ForegroundColor DarkGray
Write-Host ""

# --- Preflight: Windows Terminal ---------------------------------------------
$wt = Get-Command wt.exe -ErrorAction SilentlyContinue
if (-not $wt) {
    Write-Err2 "Windows Terminal (wt.exe) not found."
    Write-Err2 "Install from the Microsoft Store ('Windows Terminal') and re-run."
    exit 1
}

# --- Preflight: tab helpers exist --------------------------------------------
$backendHelper  = Join-Path $scriptsDir '_ba-backend.ps1'
$frontendHelper = Join-Path $scriptsDir '_ba-frontend.ps1'
$commandsHelper = Join-Path $scriptsDir '_ba-commands.ps1'
foreach ($h in @($backendHelper, $frontendHelper, $commandsHelper)) {
    if (-not (Test-Path $h)) {
        Write-Err2 "missing helper: $h"
        exit 1
    }
}

# --- Preflight: ports ---------------------------------------------------------
Write-Step "Preflight: freeing dev ports"
Free-Port -Port $backendPort  -Label 'backend'
Free-Port -Port $frontendPort -Label 'frontend (Vite)'

# --- Preflight: LM Studio -----------------------------------------------------
Write-Step "Preflight: checking LM Studio on $lmStudioPort"
$lm = Get-NetTCPConnection -LocalPort $lmStudioPort -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
if ($lm) {
    Write-Ok "LM Studio is listening on $lmStudioPort"
} else {
    Write-Warn2 "LM Studio is NOT listening on $lmStudioPort"
    Write-Warn2 "The app will start, but agent runs will fail until you open LM Studio"
    Write-Warn2 "and load mistralai/mistral-7b-instruct-v0.3 with the server enabled."
}

# --- Preflight: frontend deps -------------------------------------------------
Write-Step "Preflight: frontend dependencies"
if (-not (Test-Path (Join-Path $frontendDir 'node_modules'))) {
    Write-Warn2 "node_modules missing - running 'npm install' (one-time)"
    Push-Location $frontendDir
    try {
        npm install
        if ($LASTEXITCODE -ne 0) { throw "npm install exited with code $LASTEXITCODE" }
        Write-Ok "npm install complete"
    } finally {
        Pop-Location
    }
} else {
    Write-Ok "node_modules present"
}

# --- Launch: one window, three tabs ------------------------------------------
Write-Step "Launching Windows Terminal with three tabs"

# wt.exe argument rules:
#   - `;` (with spaces around it) separates tabs
#   - quoted strings preserve literal spaces inside a tab's command
# Tab titles use no spaces/parens to avoid any parser ambiguity.
# Each tab runs: powershell -NoExit -File <helper.ps1>
# The helpers handle cwd, in-shell titles, and the real commands -- no
# semicolons inside any per-tab command, so wt's parser has nothing to confuse.

$psExe   = 'powershell.exe'
$psFlags = @('-NoExit', '-NoProfile', '-ExecutionPolicy', 'Bypass')

$wtArgs = @(
    'new-tab', '--title', 'backend-5151'
    $psExe
    $psFlags
    '-File'
    "`"$backendHelper`""
    ';'
    'new-tab', '--title', 'frontend-5173'
    $psExe
    $psFlags
    '-File'
    "`"$frontendHelper`""
    ';'
    'new-tab', '--title', 'commands'
    $psExe
    $psFlags
    '-File'
    "`"$commandsHelper`""
)

# Snapshot existing WT pids so we can identify the new one we spawn.
$beforeWt = @(Get-Process -Name WindowsTerminal -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Id)

# Launch. Using -PassThru gives us the wt.exe pid, but wt is a packaged
# Store app and sometimes hands off to an existing host process; we
# reconcile with the "new pid after launch" method below as a fallback.
$wtProc = Start-Process -FilePath 'wt.exe' -ArgumentList $wtArgs -PassThru -ErrorAction Stop
Write-Ok "wt.exe launched (initial pid=$($wtProc.Id))"

# Give WT a moment to materialize as a full window process.
Start-Sleep -Milliseconds 1200

$afterWt = @(Get-Process -Name WindowsTerminal -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Id)
$newWtPids = @($afterWt | Where-Object { $beforeWt -notcontains $_ })

# Prefer a newly-appeared WindowsTerminal pid (the real window host).
# Fall back to the pid Start-Process returned if nothing new appeared.
$ourWtPid = $null
if ($newWtPids.Count -eq 1) {
    $ourWtPid = $newWtPids[0]
    Write-Ok "captured WT window pid=$ourWtPid"
} elseif ($newWtPids.Count -gt 1) {
    $ourWtPid = $newWtPids[0]
    Write-Warn2 "multiple new WT pids detected ($($newWtPids -join ', ')); using $ourWtPid"
} else {
    $ourWtPid = $wtProc.Id
    Write-Warn2 "no new WT process detected; will track launched pid=$ourWtPid"
}

# Persist the pid so stop-ba.ps1 can close exactly our window.
$pidFile = Join-Path $scriptsDir '.ba-wt.pid'
Set-Content -Path $pidFile -Value $ourWtPid -NoNewline -Encoding ascii
Write-Ok "wrote pid file: $pidFile"

Write-Ok "three tabs launched (backend-5151 / frontend-5173 / commands)"

Write-Host ""
Write-Host "  Started." -ForegroundColor Green
Write-Host "    backend : http://localhost:$backendPort" -ForegroundColor White
Write-Host "    frontend: http://localhost:$frontendPort" -ForegroundColor White
Write-Host ""
Write-Host "  To stop everything, switch to the 'commands' tab and run:" -ForegroundColor DarkGray
Write-Host "      .\stop-ba.ps1" -ForegroundColor DarkGray
Write-Host ""
