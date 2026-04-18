# stop-ba.ps1 - Tier 1 Prompt Lab (ba-taskmanager) one-shot stopper
#
# What it does:
#   - Kills whatever is bound to ports 5151 and 5173.
#   - Sweeps up any stray TaskManager.exe.
#   - Closes the Windows Terminal window that start-ba.ps1 opened, if any.
#     (Tracked via scripts/.ba-wt.pid; untracked WT windows are left alone.)
#   - Leaves LM Studio (port 1234) running on purpose.
#
# Usage (typically from Cursor's terminal, same one that launched start-ba.ps1):
#   .\stop-ba.ps1

$ErrorActionPreference = 'Continue'

$root       = $PSScriptRoot
$scriptsDir = Join-Path $root 'scripts'
$pidFile    = Join-Path $scriptsDir '.ba-wt.pid'

$backendPort  = 5151
$frontendPort = 5173

function Write-Step($msg) { Write-Host "==> $msg" -ForegroundColor Cyan }
function Write-Ok($msg)   { Write-Host "    $msg" -ForegroundColor Green }
function Write-Warn2($msg){ Write-Host "    $msg" -ForegroundColor Yellow }

function Stop-Port {
    param([int]$Port, [string]$Label)
    $conn = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
    if (-not $conn) {
        Write-Ok "port $Port already free ($Label)"
        return
    }
    $pid2 = $conn.OwningProcess
    $proc = Get-Process -Id $pid2 -ErrorAction SilentlyContinue
    $pname = if ($proc) { $proc.ProcessName } else { '<unknown>' }
    Write-Warn2 "killing pid=$pid2 ($pname) on port $Port ($Label)"
    Stop-Process -Id $pid2 -Force -ErrorAction SilentlyContinue
    Start-Sleep -Milliseconds 400
    $still = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($still) {
        Write-Warn2 "port $Port still bound after kill"
    } else {
        Write-Ok "port $Port freed"
    }
}

Write-Host ""
Write-Host "  Prompt Lab Tier 1 (ba-taskmanager) - stopping" -ForegroundColor White
Write-Host ""

Write-Step "Stopping backend (port $backendPort)"
Stop-Port -Port $backendPort  -Label 'backend'

Write-Step "Stopping frontend (port $frontendPort)"
Stop-Port -Port $frontendPort -Label 'frontend'

Write-Step "Cleanup: orphaned TaskManager.exe (if any)"
$tm = Get-Process -Name 'TaskManager' -ErrorAction SilentlyContinue
if ($tm) {
    $tm | ForEach-Object {
        Write-Warn2 "killing stray TaskManager pid=$($_.Id)"
        Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
    }
} else {
    Write-Ok "no stray TaskManager processes"
}

# --- Close the Windows Terminal window we opened ----------------------------
# Done LAST so any earlier Write-Host output actually makes it to the screen
# before we potentially kill the terminal host we're printing to.
Write-Step "Closing Windows Terminal window opened by start-ba.ps1"
if (Test-Path $pidFile) {
    $raw = (Get-Content -Path $pidFile -Raw -ErrorAction SilentlyContinue)
    $wtPid = 0
    if (-not [int]::TryParse(($raw.Trim()), [ref]$wtPid)) {
        Write-Warn2 "pid file exists but is unreadable; skipping close"
    } else {
        $proc = Get-Process -Id $wtPid -ErrorAction SilentlyContinue
        if ($proc -and $proc.ProcessName -eq 'WindowsTerminal') {
            Write-Ok "closing WindowsTerminal pid=$wtPid"
            # Remove pid file BEFORE killing; if the kill wipes us out mid-print,
            # at least the bookkeeping is correct on next run.
            Remove-Item -Path $pidFile -Force -ErrorAction SilentlyContinue
            Stop-Process -Id $wtPid -Force -ErrorAction SilentlyContinue
        } else {
            Write-Ok "tracked WT pid=$wtPid is not running (already closed)"
            Remove-Item -Path $pidFile -Force -ErrorAction SilentlyContinue
        }
    }
} else {
    Write-Ok "no pid file ($pidFile) - nothing to close"
}

Write-Host ""
Write-Host "  Stopped." -ForegroundColor Green
Write-Host "  (LM Studio on 1234 was left running on purpose.)" -ForegroundColor DarkGray
Write-Host ""
