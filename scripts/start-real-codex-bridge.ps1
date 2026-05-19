$ErrorActionPreference = "Stop"

function Invoke-Checked {
  param(
    [Parameter(Mandatory = $true)]
    [string] $FilePath,
    [Parameter(Mandatory = $true)]
    [string[]] $Arguments
  )

  Write-Host "> $FilePath $($Arguments -join ' ')"
  & $FilePath @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "$FilePath $($Arguments -join ' ') failed with exit code $LASTEXITCODE"
  }
}

$repoRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).ProviderPath
$packagePath = Join-Path $repoRoot "package.json"
if (-not (Test-Path -LiteralPath $packagePath)) {
  throw "Could not find package.json at detected repo root: $repoRoot"
}

$package = Get-Content -LiteralPath $packagePath -Raw | ConvertFrom-Json
if ($package.name -ne "gpt-codex-web-bridge") {
  throw "Detected repo root is not gpt-codex-web-bridge: $repoRoot"
}

Set-Location $repoRoot
Write-Host "Repo root: $repoRoot"
Write-Host "Clearing mock Codex environment variables for this PowerShell process."
Remove-Item Env:\GCB_MOCK_CODEX -ErrorAction SilentlyContinue
Remove-Item Env:\GCB_MOCK_SCENARIO -ErrorAction SilentlyContinue

Invoke-Checked "gcb.cmd" @("doctor")
Invoke-Checked "npx.cmd" @("-y", "@openai/codex", "--version")

Write-Host ""
Write-Host "Starting gpt-codex-web-bridge in real Codex mode."
Write-Host "Keep this PowerShell window open."
Write-Host "> gcb.cmd serve"
& gcb.cmd serve
if ($LASTEXITCODE -ne 0) {
  throw "gcb.cmd serve failed with exit code $LASTEXITCODE"
}
