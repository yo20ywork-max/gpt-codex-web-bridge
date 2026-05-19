$ErrorActionPreference = "Stop"

$targetPath = "C:\tmp\gcb-chatgpt-web-continue-target"
$expectedFullPath = [System.IO.Path]::GetFullPath($targetPath)

function Invoke-Checked {
  param(
    [Parameter(Mandatory = $true)]
    [string] $FilePath,
    [Parameter(Mandatory = $true)]
    [string[]] $Arguments
  )

  & $FilePath @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "$FilePath $($Arguments -join ' ') failed with exit code $LASTEXITCODE"
  }
}

if (Test-Path -LiteralPath $targetPath) {
  $resolvedPath = (Resolve-Path -LiteralPath $targetPath).ProviderPath
  if ($resolvedPath -ne $expectedFullPath) {
    throw "Refusing to remove unexpected path: $resolvedPath"
  }
  Remove-Item -LiteralPath $resolvedPath -Recurse -Force
}

New-Item -ItemType Directory -Path $targetPath -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $targetPath "src") -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $targetPath "tests") -Force | Out-Null

Push-Location $targetPath
try {
  @'
{
  "name": "gcb-chatgpt-web-continue-target",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "vitest run"
  }
}
'@ | Set-Content -LiteralPath "package.json" -Encoding UTF8

  @'
node_modules/
.vite/
dist/
coverage/
'@ | Set-Content -LiteralPath ".gitignore" -Encoding UTF8

  Invoke-Checked "npm.cmd" @("install", "--save-dev", "vitest", "typescript")

  @'
export function add(a: number, b: number): number {
  return a + b;
}
'@ | Set-Content -LiteralPath "src\add.ts" -Encoding UTF8

  @'
import { describe, expect, it } from "vitest";
import { add } from "../src/add";

describe("add", () => {
  it("adds two numbers", () => {
    expect(add(2, 3)).toBe(5);
  });
});
'@ | Set-Content -LiteralPath "tests\add.test.ts" -Encoding UTF8

  Invoke-Checked "git" @("init")
  Invoke-Checked "git" @("config", "user.name", "GCB Test")
  Invoke-Checked "git" @("config", "user.email", "gcb-test@example.com")
  Invoke-Checked "git" @("add", ".gitignore", "package.json", "package-lock.json", "src/add.ts", "tests/add.test.ts")
  Invoke-Checked "git" @("commit", "-m", "initial chatgpt continue target")
  Invoke-Checked "npm.cmd" @("test")

  Write-Host ""
  Write-Host "Created clean ChatGPT Web continue target repo at $targetPath"
  Write-Host ""
  Write-Host "Next steps:"
  Write-Host "1. In C:\gpt-codex-web-bridge, start the bridge with:"
  Write-Host '   $env:GCB_MOCK_CODEX="1"'
  Write-Host '   $env:GCB_MOCK_SCENARIO="rate_limit_then_success"'
  Write-Host "   gcb.cmd serve"
  Write-Host "2. Start ngrok with: ngrok http 8787"
  Write-Host "3. Use https://<fresh-ngrok-host>/mcp as the ChatGPT Web connector URL."
  Write-Host "4. Use repoPath: $targetPath"
}
finally {
  Pop-Location
}
