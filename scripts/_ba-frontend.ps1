# _ba-frontend.ps1 - runs the Tier 1 frontend (Vite) inside its own tab.
# Called by start-ba.ps1. Not intended to be run directly, but safe if you do.

$Host.UI.RawUI.WindowTitle = 'frontend (5173)'
$root = Split-Path -Parent $PSScriptRoot
Set-Location (Join-Path $root 'frontend')

Write-Host '=== ba-taskmanager frontend (Ctrl+C to stop) ===' -ForegroundColor Cyan
Write-Host "cwd: $(Get-Location)" -ForegroundColor DarkGray
Write-Host ''

npm run dev
