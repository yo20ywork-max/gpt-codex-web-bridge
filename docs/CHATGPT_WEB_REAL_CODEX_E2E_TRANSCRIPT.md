# ChatGPT Web -> real Codex CLI E2E transcript

Current status: Documented-only until real ChatGPT Web evidence is pasted.

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

Do not mark this path verified until real ChatGPT Web evidence is pasted into this file or the matching transcript file.

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

這次不是 mock。請透過 gpt-codex-web-bridge 呼叫 start_mission，讓 bridge 呼叫本機 real Codex CLI 修改 target repo。

goal: Add a subtract(a, b) function to src/math.ts, add Vitest tests for subtract in tests/math.test.ts, run npm.cmd test, and stop when validation passes.
repoPath: C:\tmp\gcb-chatgpt-real-codex-target
testCommand: npm.cmd test
maxLoops: 4
allowEnvRead: false
autoContinue: true

啟動後請呼叫 get_mission_status，直到 mission completed、paused、blocked、或 failed。
請回報：
- missionId
- status
- branch
- currentLoop
- validation status
- test command
- exit code
- summary
- nextAction
```

## Expected Successful Result

- `status = completed`
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
