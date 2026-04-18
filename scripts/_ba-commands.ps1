# _ba-commands.ps1 - the scratch/commands tab for Tier 1.
# Lands you in the repo root so you can run .\stop-ba.ps1 directly.

$Host.UI.RawUI.WindowTitle = 'commands'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

Write-Host '=== ba-taskmanager commands tab ===' -ForegroundColor Cyan
Write-Host "cwd: $(Get-Location)" -ForegroundColor DarkGray
Write-Host ''
Write-Host 'Tip: run .\stop-ba.ps1 here when you are done.' -ForegroundColor DarkGray
Write-Host ''
