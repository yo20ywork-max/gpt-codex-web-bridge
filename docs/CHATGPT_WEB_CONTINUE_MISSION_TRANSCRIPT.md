# ChatGPT Web Continue Mission Transcript

Current status: Verified with real ChatGPT Web continue_mission evidence.

ChatGPT Web `continue_mission` was manually verified against the mock pause/resume flow. Local mock tests also verify the same service-layer behavior.

## Verified ChatGPT Web continue_mission

Successful mission:

```text
missionId: m_mpd5kp4z_b3257f96
first state: paused
pauseReason: rate_limit_or_quota
nextAction: Wait for quota or availability to recover, then run gcb continue.
```

Second user prompt:

```text
繼續。
```

Observed ChatGPT Web behavior:

```text
ChatGPT Web directly called continue_mission.
ChatGPT Web did not restart with start_mission.
```

Final result:

```text
missionId: m_mpd5kp4z_b3257f96
status: completed
currentLoop: 2 / 4
validation: passed
testCommand: npm.cmd test
exitCode: 0
summary: All validation commands passed.
nextAction: Review the branch and merge manually when satisfied.
```

Retest note:

```text
A later repeated start_mission attempt m_mpd5qj5h_f0ddc093 blocked with dirty_worktree because the same target repo was reused after verification. It is not the verification result.
```

## Prerequisites

- PR #3 merged.
- `npm.cmd run build`, `npm.cmd test`, and `npm.cmd run verify:mock` passing.
- ChatGPT Web connector already created.
- ngrok tunnel works.
- Connector uses noauth.

## Exact PowerShell Setup

Run from the bridge repo:

```powershell
cd C:\gpt-codex-web-bridge
npm.cmd run create:chatgpt-continue-target
```

Start the bridge in mock pause/resume mode and keep this process running:

```powershell
$env:GCB_MOCK_CODEX="1"
$env:GCB_MOCK_SCENARIO="rate_limit_then_success"
gcb.cmd serve
```

Start ngrok in another PowerShell window:

```powershell
ngrok http 8787
```

Connector URL:

```text
https://<fresh-ngrok-host>/mcp
```

## First ChatGPT Prompt

```text
請使用 gpt-codex-web-bridge 啟動一個 mock continue_mission 驗證任務。

goal: Run a ChatGPT Web continue_mission verification mission. The first mock Codex run should pause due to a usage limit, then I will say 繼續 and you should call continue_mission.
repoPath: C:\tmp\gcb-chatgpt-web-continue-target
testCommand: npm.cmd test
maxLoops: 4
allowEnvRead: false
autoContinue: true

啟動後請呼叫 get_mission_status，直到 mission 進入 paused、completed、blocked、或 failed。
如果 mission paused，請回報 missionId、pauseReason、nextAction。
```

Expected result:

```text
status = paused
pauseReason = rate_limit_or_quota
nextAction = Wait for quota or availability to recover, then run gcb continue.
```

## Second ChatGPT Prompt

```text
繼續。

請不要重新呼叫 start_mission。
請直接呼叫 gpt-codex-web-bridge 的 continue_mission。
missionId 可以省略，讓 bridge 接續最新 paused mission。
接著請呼叫 get_mission_status，直到 mission completed、paused、blocked、或 failed。
```

Expected result:

```text
status = completed
lastValidation.status = passed
nextAction = Review the branch and merge manually when satisfied.
```

## Evidence

### ChatGPT Tool-Call Transcript

```text
First ChatGPT Web prompt started a mock continue_mission verification mission.
The mission paused with pauseReason rate_limit_or_quota.

The user then said:
繼續。

ChatGPT Web directly called continue_mission and did not call start_mission again.
The mission completed with validation passed.
```

### missionId

```text
m_mpd5kp4z_b3257f96
```

### start_mission Result

```text
missionId: m_mpd5kp4z_b3257f96
status after first run: paused
pauseReason: rate_limit_or_quota
nextAction: Wait for quota or availability to recover, then run gcb continue.
```

### First get_mission_status Result

```text
missionId: m_mpd5kp4z_b3257f96
status: paused
pauseReason: rate_limit_or_quota
nextAction: Wait for quota or availability to recover, then run gcb continue.
```

### continue_mission Result

```text
ChatGPT Web called continue_mission directly after the user said "繼續。"
ChatGPT Web did not restart the flow with start_mission.
missionId: m_mpd5kp4z_b3257f96
```

### Final get_mission_status Result

```text
missionId: m_mpd5kp4z_b3257f96
status: completed
currentLoop: 2 / 4
validation: passed
testCommand: npm.cmd test
exitCode: 0
summary: All validation commands passed.
nextAction: Review the branch and merge manually when satisfied.
```

### gcb.cmd report Output

```powershell
cd C:\gpt-codex-web-bridge
gcb.cmd report <missionId>
```

```text
[paste report output here]
```

### Target Repo Git Status

```powershell
cd C:\tmp\gcb-chatgpt-web-continue-target
git status --short
```

```text
[paste target repo git status here]
```

### Target Repo npm.cmd test

```powershell
cd C:\tmp\gcb-chatgpt-web-continue-target
npm.cmd test
```

```text
[paste test output here]
```

## Final Verdict

```text
Verified. ChatGPT Web continue_mission resumed mission m_mpd5kp4z_b3257f96 after a mock rate-limit pause and completed with validation passed.
```
