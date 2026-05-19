# ChatGPT Web -> real Codex CLI E2E transcript

Current status: Local bridge -> real Codex CLI preflight verified. ChatGPT Web -> real Codex CLI remains documented-only until real ChatGPT Web evidence is pasted.

This file prepares the manual verification path for the final end-to-end proof:

```text
ChatGPT Web
-> start_mission
-> gpt-codex-web-bridge
-> real Codex CLI
-> modify clean target repo
-> run npm.cmd test
-> mission completed
-> report generated
```

Do not mark the ChatGPT Web path verified until real ChatGPT Web evidence is pasted into this file or the matching transcript file.

## Local Real Codex Preflight Evidence

This is not ChatGPT Web evidence. It proves the local bridge can run in real Codex mode with `requireRealCodex: true` and modify the clean target repo without mock artifacts.

Mission:

```text
missionId: m_mpd98phl_64e77b2a
status: completed
branch: gcb/m_mpd98phl_64e77b2a
currentLoop: 1
codexMode: real
validation status: passed
test command: npm.cmd test
exit code: 0
summary: All validation commands passed.
```

Evidence checks:

```text
report Codex Mode: real
report contains Mock Codex: no
report contains mock-combined.log: no
report contains gcb-mock-status.txt: no
target repo changed files: src/math.ts, tests/math.test.ts
target repo contains subtract(a, b): yes
target repo has subtract tests: yes
target repo npm.cmd test: passed, 1 test file, 2 tests
```

Target repo diff summary:

```text
src/math.ts        | 4 ++++
tests/math.test.ts | 8 +++++++-
2 files changed, 11 insertions(+), 1 deletion(-)
```

Notes:

- Previous mission `m_mpd89jvb_852bd55d` is not accepted as real E2E evidence because its report showed mock artifacts.
- ChatGPT Web manual connector evidence is still required before upgrading the ChatGPT Web -> real Codex CLI row to Verified.

## Prerequisites

- PR #3 merged.
- PR #4 merged or its continue_mission verification completed.
- Codex CLI installed and logged in.
- `gcb.cmd doctor` passes.
- ChatGPT Web connector exists and uses noauth.
- `ngrok` or `cloudflared` available.
- The user understands this will run real Codex, not mock mode.

## Exact PowerShell Setup

```powershell
cd C:\gpt-codex-web-bridge
git checkout main
git pull origin main
npm.cmd ci
npm.cmd run build
npm.cmd test
npm.cmd run create:chatgpt-real-codex-target
```

## Start Bridge In Real Codex Mode

```powershell
Remove-Item Env:\GCB_MOCK_CODEX -ErrorAction SilentlyContinue
Remove-Item Env:\GCB_MOCK_SCENARIO -ErrorAction SilentlyContinue
npm.cmd run serve:real-codex
```

Keep this PowerShell window open.

In another PowerShell:

```powershell
ngrok http 8787
```

Connector URL:

```text
https://<fresh-ngrok-host>/mcp
```

## ChatGPT Web Prompt

```text
請使用 gpt-codex-web-bridge 啟動一個 real Codex CLI end-to-end 驗證任務。

這次不是 mock。請透過 gpt-codex-web-bridge 呼叫 start_mission，並且 start_mission 參數必須包含 requireRealCodex: true，讓 bridge 呼叫本機 real Codex CLI 修改 target repo。

goal: Add a subtract(a, b) function to src/math.ts, add Vitest tests for subtract in tests/math.test.ts, run npm.cmd test, and stop when validation passes.
repoPath: C:\tmp\gcb-chatgpt-real-codex-target
testCommand: npm.cmd test
maxLoops: 4
allowEnvRead: false
autoContinue: true
requireRealCodex: true

啟動後請呼叫 get_mission_status，直到 mission completed、paused、blocked、或 failed。

完成後請呼叫 get_mission_report，並檢查：
1. Codex Mode 必須是 real
2. report 不可以出現 Mock Codex
3. report 不可以出現 mock-combined.log
4. report 不可以出現 gcb-mock-status.txt
5. changed files 必須包含 src/math.ts 或 tests/math.test.ts
6. validation 必須 passed

請回報：
- missionId
- status
- branch
- currentLoop
- codexMode
- validation status
- test command
- exit code
- changed files
- summary
- nextAction

如果 report 出現 Mock Codex、mock-combined.log 或 gcb-mock-status.txt，請直接判定這不是 real E2E，不要宣稱 verified。
```

## Expected Successful Result

- `status = completed`
- `codexMode = real`
- `lastValidation.status = passed`
- target repo contains `subtract(a, b)`
- `tests/math.test.ts` includes a subtract test
- `npm.cmd test` passes

If paused because of `rate_limit_or_quota`:

- Do not claim verified yet.
- Say the mission was safely paused.
- User can later say `繼續` and ChatGPT should call `continue_mission`.

If blocked:

- Record `blockReason`.
- Do not claim verified.

## Evidence Section

Fill this section only with real ChatGPT Web evidence.

Connector URL host:

```text
[paste fresh host only, not credentials]
```

ChatGPT `start_mission` transcript:

```text
[paste real ChatGPT Web tool call and result]
```

missionId:

```text
[paste mission id]
```

Final `get_mission_status` result:

```text
[paste real final status]
```

Codex Mode:

```text
[paste codexMode from status/report]
```

`gcb.cmd report` output:

```text
[paste report output]
```

Target repo `git status --short`:

```text
[paste output from C:\tmp\gcb-chatgpt-real-codex-target]
```

Target repo `git diff`:

```text
[paste diff from C:\tmp\gcb-chatgpt-real-codex-target]
```

Target repo `npm.cmd test` output:

```text
[paste test output]
```

Whether real Codex logs show a non-mock run:

```text
[paste yes/no plus relevant non-secret log lines]
```
