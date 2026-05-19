# Real Codex Run Transcript

Current status: verified for a real Codex CLI mission.

This file records a completed maintainer smoke test. It proves that the bridge can start a real Codex CLI mission against a tiny external repo, that Codex modifies the mission branch, that validation runs, and that `report.md` is produced.

What this does not prove yet: a successful real Codex resume mission with a task-producing diff. Mock/unit tests cover resume behavior, and real ChatGPT Web integration is tracked separately in `docs/CHATGPT_WEB_RUN_TRANSCRIPT.md`.

## Environment

- Date: 2026-05-20 Asia/Taipei
- OS/shell: Windows PowerShell
- Bridge repo: `C:\gpt-codex-web-bridge`
- Target repo: `C:\tmp\gcb-real-codex-target`
- User-facing repo path: `/tmp/gcb-real-codex-target` maps to `C:\tmp\gcb-real-codex-target` in this Windows shell.
- Node: `v24.14.1`
- Codex CLI: `codex-cli 0.131.0` via `npx -y @openai/codex`
- Mission ID: `m_mpcvo0l4_e4a2d4e1`

## Reproduce The Tiny Target Repo

Run outside the bridge repo. A `.gitignore` is included so `git add .` keeps the repo tiny instead of committing `node_modules`.

```powershell
$target = 'C:\tmp\gcb-real-codex-target'
Remove-Item -LiteralPath $target -Recurse -Force
New-Item -ItemType Directory -Force -Path $target | Out-Null
Set-Location $target
npm.cmd init -y
npm.cmd install -D vitest typescript
New-Item -ItemType Directory -Force -Path src, tests | Out-Null
Set-Content -Path .gitignore -Value "node_modules/`n" -Encoding UTF8
Set-Content -Path src\add.ts -Value @'
export function add(a: number, b: number): number {
  return a + b;
}
'@ -Encoding UTF8
Set-Content -Path tests\add.test.ts -Value @'
import { describe, expect, it } from "vitest";
import { add } from "../src/add";

describe("add", () => {
  it("adds two numbers", () => {
    expect(add(2, 3)).toBe(5);
  });
});
'@ -Encoding UTF8
npm.cmd pkg set scripts.test="vitest run"
git init
git config user.email smoke@example.local
git config user.name smoke
git add .
git commit -m "initial tiny test repo"
npm.cmd test
git status --short
```

Observed output:

```text
added 45 packages, and audited 46 packages in 9s
found 0 vulnerabilities
Initialized empty Git repository in C:/tmp/gcb-real-codex-target/.git/
[master (root-commit) 7c69870] initial tiny test repo
 5 files changed, 1336 insertions(+)
 create mode 100644 .gitignore
 create mode 100644 package-lock.json
 create mode 100644 package.json
 create mode 100644 src/add.ts
 create mode 100644 tests/add.test.ts

> gcb-real-codex-target@1.0.0 test
> vitest run

 RUN  v4.1.6 C:/tmp/gcb-real-codex-target

 Test Files  1 passed (1)
      Tests  1 passed (1)
```

`git status --short` produced no output.

## Bridge Build, Link, And Doctor

```powershell
cd C:\gpt-codex-web-bridge
npm.cmd run build
npm.cmd link
gcb.cmd doctor
npx.cmd -y @openai/codex --version
```

Observed output:

```text
> gpt-codex-web-bridge@0.1.0 build
> tsc

added 1 package, and audited 3 packages in 227ms
found 0 vulnerabilities

{
  "node": {
    "version": "v24.14.1",
    "ok": true
  },
  "git": {
    "available": true
  },
  "codex": {
    "available": true,
    "fallback": "npx -y @openai/codex"
  },
  "storage": {
    "path": "C:\\gpt-codex-web-bridge\\.gpt-codex-web-bridge",
    "writable": true
  },
  "mcp": {
    "endpoint": "http://localhost:8787/mcp"
  }
}

codex-cli 0.131.0
```

## Start Real Mission

```powershell
$env:GCB_MOCK_CODEX = $null
$env:GCB_MOCK_SCENARIO = $null
gcb.cmd start --repo /tmp/gcb-real-codex-target --goal "Add a subtract(a, b) function to src/add.ts, add tests for it, run npm test, and stop when validation passes." --test "npm test"
```

Observed start output:

```json
{
  "missionId": "m_mpcvo0l4_e4a2d4e1",
  "goal": "Add a subtract(a, b) function to src/add.ts, add tests for it, run npm test, and stop when validation passes.",
  "repoPath": "C:\\tmp\\gcb-real-codex-target",
  "branch": "gcb/m_mpcvo0l4_e4a2d4e1",
  "status": "queued",
  "currentLoop": 0,
  "maxLoops": 12,
  "nextAction": "Worker queued.",
  "workerStarted": true
}
```

## Mission Status

```powershell
gcb.cmd status
```

Observed status:

```json
{
  "missionId": "m_mpcvo0l4_e4a2d4e1",
  "goal": "Add a subtract(a, b) function to src/add.ts, add tests for it, run npm test, and stop when validation passes.",
  "repoPath": "C:\\tmp\\gcb-real-codex-target",
  "branch": "gcb/m_mpcvo0l4_e4a2d4e1",
  "status": "completed",
  "currentLoop": 1,
  "maxLoops": 12,
  "lastValidation": {
    "status": "passed",
    "command": "npm test",
    "exitCode": 0,
    "summary": "All validation commands passed."
  },
  "missionDir": "C:\\gpt-codex-web-bridge\\.gpt-codex-web-bridge\\missions\\m_mpcvo0l4_e4a2d4e1",
  "running": false
}
```

## Generated Report

```powershell
gcb.cmd report
```

Observed report:

```text
# Mission Report: m_mpcvo0l4_e4a2d4e1

- Mission ID: m_mpcvo0l4_e4a2d4e1
- Goal: Add a subtract(a, b) function to src/add.ts, add tests for it, run npm test, and stop when validation passes.
- Repo: C:\tmp\gcb-real-codex-target
- Branch: gcb/m_mpcvo0l4_e4a2d4e1
- Status: completed
- Loop count: 1/12
- Status page: http://localhost:8787/status?missionId=m_mpcvo0l4_e4a2d4e1

## Validation

- Status: passed
- Command: npm test
- Exit code: 0
- Log path: C:\gpt-codex-web-bridge\.gpt-codex-web-bridge\missions\m_mpcvo0l4_e4a2d4e1\validation\01-1-npm_test.log

All validation commands passed.

## Changed Files Summary

- src/add.ts
- tests/add.test.ts

src/add.ts        | 4 ++++
tests/add.test.ts | 8 +++++++-
2 files changed, 11 insertions(+), 1 deletion(-)

## Risk Flags

- None.

## Dependency Changes

- None.

## Forbidden File Check

- Passed: no forbidden file changes detected.

## Next Action

Review the branch and merge manually when satisfied.

## Resume Command

gcb continue m_mpcvo0l4_e4a2d4e1
```

Evidence files:

```text
C:\gpt-codex-web-bridge\.gpt-codex-web-bridge\missions\m_mpcvo0l4_e4a2d4e1\state.json
C:\gpt-codex-web-bridge\.gpt-codex-web-bridge\missions\m_mpcvo0l4_e4a2d4e1\ledger.jsonl
C:\gpt-codex-web-bridge\.gpt-codex-web-bridge\missions\m_mpcvo0l4_e4a2d4e1\report.md
C:\gpt-codex-web-bridge\.gpt-codex-web-bridge\missions\m_mpcvo0l4_e4a2d4e1\codex\1779209951511-2-combined.log
C:\gpt-codex-web-bridge\.gpt-codex-web-bridge\missions\m_mpcvo0l4_e4a2d4e1\validation\01-1-npm_test.log
```

## Target Repo Verification

```powershell
cd C:\tmp\gcb-real-codex-target
git status
git diff
npm.cmd test
```

Observed output:

```text
On branch gcb/m_mpcvo0l4_e4a2d4e1
Changes not staged for commit:
	modified:   src/add.ts
	modified:   tests/add.test.ts

diff --git a/src/add.ts b/src/add.ts
index b758642..9aeef09 100644
--- a/src/add.ts
+++ b/src/add.ts
@@ -1,3 +1,7 @@
 export function add(a: number, b: number): number {
   return a + b;
 }
+
+export function subtract(a: number, b: number): number {
+  return a - b;
+}
diff --git a/tests/add.test.ts b/tests/add.test.ts
index 96a9052..8cc7b19 100644
--- a/tests/add.test.ts
+++ b/tests/add.test.ts
@@ -1,8 +1,14 @@
 import { describe, expect, it } from "vitest";
-import { add } from "../src/add";
+import { add, subtract } from "../src/add";

describe("add", () => {
   it("adds two numbers", () => {
     expect(add(2, 3)).toBe(5);
   });
 });
+
+describe("subtract", () => {
+  it("subtracts the second number from the first", () => {
+    expect(subtract(5, 3)).toBe(2);
+  });
+});

> gcb-real-codex-target@1.0.0 test
> vitest run

 RUN  v4.1.6 C:/tmp/gcb-real-codex-target

 Test Files  1 passed (1)
      Tests  2 passed (2)
```

## Pass Criteria

- `gcb doctor` produced JSON and detected Git, Codex availability, writable storage, and the MCP endpoint.
- The mission ran with `GCB_MOCK_CODEX` unset.
- Mission status became `completed`.
- Target repo branch was `gcb/m_mpcvo0l4_e4a2d4e1`.
- Codex modified `src/add.ts` and `tests/add.test.ts`.
- `npm test` passed with 2 tests.
- `report.md`, `state.json`, `ledger.jsonl`, Codex logs, and validation logs exist.

Final verdict: pass for real Codex CLI mission.
