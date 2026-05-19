import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function readRepoFile(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("ChatGPT Web real Codex E2E verification package", () => {
  it("clears mock mode instead of requiring mock env vars for real mode", () => {
    const startScript = readRepoFile("scripts/start-real-codex-bridge.ps1");
    const transcriptDoc = readRepoFile("docs/CHATGPT_WEB_REAL_CODEX_E2E_TRANSCRIPT.md");

    expect(startScript).toContain("Remove-Item Env:\\GCB_MOCK_CODEX");
    expect(startScript).toContain("Remove-Item Env:\\GCB_MOCK_SCENARIO");
    expect(startScript).not.toMatch(/\$env:GCB_MOCK_CODEX\s*=/i);
    expect(startScript).not.toMatch(/\$env:GCB_MOCK_SCENARIO\s*=/i);

    expect(transcriptDoc).toContain("Remove-Item Env:\\GCB_MOCK_CODEX");
    expect(transcriptDoc).toContain("Remove-Item Env:\\GCB_MOCK_SCENARIO");
    expect(transcriptDoc).not.toMatch(/\$env:GCB_MOCK_CODEX\s*=\s*["']?1/i);
    expect(transcriptDoc).not.toMatch(/\$env:GCB_MOCK_SCENARIO\s*=/i);
  });

  it("creates the target .gitignore before explicit git add and never uses git add dot", () => {
    const helperScript = readRepoFile("scripts/create-chatgpt-real-codex-target.ps1");
    const gitignoreWriteIndex = helperScript.indexOf('Set-Content -LiteralPath ".gitignore"');
    const explicitGitAddIndex = helperScript.indexOf('Invoke-Checked "git" @("add"');

    expect(gitignoreWriteIndex).toBeGreaterThan(-1);
    expect(explicitGitAddIndex).toBeGreaterThan(gitignoreWriteIndex);
    expect(helperScript).toContain(
      'Invoke-Checked "git" @("add", ".gitignore", "package.json", "package-lock.json", "src/math.ts", "tests/math.test.ts")'
    );
    expect(helperScript).not.toMatch(/\bgit(?:\.cmd)?\s+add\s+\./i);
    expect(helperScript).not.toContain('"git" @("add", ".")');
  });

  it("does not mark ChatGPT Web to real Codex as verified", () => {
    const matrix = readRepoFile("docs/VERIFICATION_MATRIX.md");
    const readme = readRepoFile("README.md");
    const realCodexRow = matrix
      .split(/\r?\n/)
      .find((line) => line.startsWith("| ChatGPT Web -> real Codex CLI mission |"));

    expect(realCodexRow).toBeDefined();
    expect(realCodexRow).toContain("| Documented-only |");
    expect(realCodexRow).not.toContain("| Verified |");
    expect(readme).toContain("ChatGPT Web -> real Codex CLI full end-to-end mission");
    expect(readme).not.toMatch(/ChatGPT Web -> real Codex CLI full end-to-end mission:\s*Verified/i);
  });

  it("requires the ChatGPT Web real E2E prompt to request real Codex mode", () => {
    const transcriptDoc = readRepoFile("docs/CHATGPT_WEB_REAL_CODEX_E2E_TRANSCRIPT.md");
    const template = readRepoFile("examples/transcripts/chatgpt-web-real-codex-e2e-test.txt");

    expect(transcriptDoc).toContain("requireRealCodex: true");
    expect(transcriptDoc).toContain("Codex Mode");
    expect(template).toContain("requireRealCodex: true");
    expect(template).toContain("codexMode");
  });

  it("labels the transcript template as a template rather than evidence", () => {
    const template = readRepoFile("examples/transcripts/chatgpt-web-real-codex-e2e-test.txt");

    expect(template).toContain("Template until replaced with real ChatGPT Web -> real Codex CLI evidence.");
    expect(template).toContain("Do not treat this file as proof of a successful run.");
  });
});
