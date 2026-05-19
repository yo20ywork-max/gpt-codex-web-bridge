$ErrorActionPreference = "Stop"

$targetPath = "C:\tmp\gcb-chatgpt-real-codex-target"
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
  "name": "gcb-chatgpt-real-codex-target",
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
'@ | Set-Content -LiteralPath "src\math.ts" -Encoding UTF8

  @'
import { describe, expect, it } from "vitest";
import { add } from "../src/math";

describe("add", () => {
  it("adds two numbers", () => {
    expect(add(2, 3)).toBe(5);
  });
});
'@ | Set-Content -LiteralPath "tests\math.test.ts" -Encoding UTF8

  Invoke-Checked "git" @("init")
  Invoke-Checked "git" @("config", "user.name", "GCB Test")
  Invoke-Checked "git" @("config", "user.email", "gcb-test@example.com")
  Invoke-Checked "git" @("add", ".gitignore", "package.json", "package-lock.json", "src/math.ts", "tests/math.test.ts")
  Invoke-Checked "git" @("commit", "-m", "initial chatgpt real codex target")
  Invoke-Checked "npm.cmd" @("test")

  $status = & git status --short
  if ($LASTEXITCODE -ne 0) {
    throw "git status --short failed with exit code $LASTEXITCODE"
  }

  Write-Host ""
  Write-Host "Target path: $targetPath"
  Write-Host ""
  Write-Host "git status --short:"
  if ($status) {
    $status | ForEach-Object { Write-Host $_ }
  } else {
    Write-Host "(clean)"
  }
  Write-Host ""
  Write-Host "Next steps for starting gcb real Codex bridge:"
  Write-Host "1. In C:\gpt-codex-web-bridge, run:"
  Write-Host "   npm.cmd run build"
  Write-Host "   npm.cmd run serve:real-codex"
  Write-Host "2. Keep that PowerShell window open."
  Write-Host "3. In another PowerShell window, run: ngrok http 8787"
  Write-Host "4. Use https://<fresh-ngrok-host>/mcp as the ChatGPT Web connector URL."
  Write-Host "5. Use repoPath: $targetPath"
}
finally {
  Pop-Location
}
