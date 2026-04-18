# _ba-backend.ps1 - runs the Tier 1 backend inside its own tab.
# Called by start-ba.ps1. Not intended to be run directly, but safe if you do.

$Host.UI.RawUI.WindowTitle = 'backend (5151)'
$root = Split-Path -Parent $PSScriptRoot
Set-Location (Join-Path $root 'backend\TaskManager')

Write-Host '=== ba-taskmanager backend (Ctrl+C to stop) ===' -ForegroundColor Cyan
Write-Host "cwd: $(Get-Location)" -ForegroundColor DarkGray
Write-Host ''

dotnet run --urls http://localhost:5151
