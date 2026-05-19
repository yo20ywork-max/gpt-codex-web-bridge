# ChatGPT Web Run Transcript

Current status: ChatGPT Web connector creation, `list_missions`, and mock `start_mission` are verified with real ChatGPT Web evidence. ChatGPT Web `continue_mission` and ChatGPT Web -> real Codex CLI missions are not yet verified.

This file is the reproducible verification guide and evidence log for the ChatGPT Web / MCP connector. Do not claim ChatGPT Web -> real Codex CLI end-to-end or ChatGPT Web `continue_mission` verification until matching evidence is added.

## Verified ChatGPT Web Connector Tool Calls

Evidence source: real ChatGPT Web tool-call output summarized by the maintainer.

Connector URL used:

```text
https://germicide-paddle-luminance.ngrok-free.dev/mcp
```

Verified statuses:

- ChatGPT Web connector creation: Verified
- ChatGPT Web `list_missions`: Verified
- ChatGPT Web `start_mission` mock mission: Verified
- ChatGPT Web `get_mission_status` / status polling: Partially verified / status returned. The available evidence includes a completed mission result, but no separate polling transcript has been recorded here.
- ChatGPT Web `continue_mission`: Not yet verified
- ChatGPT Web -> real Codex CLI mission: Not yet verified

### `list_missions` Result Summary

ChatGPT Web successfully called `list_missions`. It returned 6 missions:

- `m_mpcyib0h_f6988e4a`: completed
- `m_mpcxaaai_48463dfb`: blocked
- `m_mpcvo0l4_e4a2d4e1`: completed
- `m_mpcvhxwz_3006b7d2`: completed
- `m_mpcvh78p_d1ae8f32`: failed
- `m_mpcvdybg_a662905e`: completed

Known old failed attempt: `m_mpcxaaai_48463dfb` is an intentionally preserved blocked/failed historical attempt caused by a test repo that accidentally staged `node_modules` and lacked local git user identity. It is not the current ChatGPT Web verification result.

### Mock `start_mission` Result

ChatGPT Web successfully called `start_mission` for a mock mission.

```text
Mission ID: m_mpd37io2_033c3cbe
Status: completed
Repo: C:\tmp\gcb-chatgpt-web-mock-target
Branch: gcb/m_mpd37io2_033c3cbe
Loop: 1 / 4
Validation: passed
Test command: npm.cmd test
Exit code: 0
Summary: All validation commands passed.
Next action: Review the branch and merge manually when satisfied.
```

Final status: completed.

Validation result: passed.

## Local Bridge Verification

Latest local verification pass: 2026-05-20 on Windows PowerShell.

Commands run from `C:\gpt-codex-web-bridge`:

```powershell
npm.cmd run build
npm.cmd test
npm.cmd run verify:mock
```

Result: all passed.

Mock MCP server startup command:

```powershell
$env:GCB_MOCK_CODEX="1"
$env:GCB_MOCK_SCENARIO="validation_fail_then_success"
gcb.cmd serve
```

Expected startup output:

```text
gpt-codex-web-bridge listening at http://127.0.0.1:8787
MCP endpoint: http://127.0.0.1:8787/mcp
```

Local endpoint checks run with `curl.exe`:

```powershell
curl.exe -i http://localhost:8787/status
curl.exe -i http://localhost:8787/mcp
```

Observed result:

```text
GET /status -> HTTP/1.1 200 OK, text/html mission status page
GET /mcp -> HTTP/1.1 400 Bad Request, "Invalid or missing MCP session id."
```

The raw `GET /mcp` result is expected without an MCP client session. ChatGPT Web or an MCP client starts with the MCP initialize/session flow.

## MCP Inspector

MCP Inspector was not run on this machine.

Checks performed:

```powershell
Get-Command mcp-inspector -ErrorAction SilentlyContinue
npm.cmd ls @modelcontextprotocol/inspector
npx.cmd --no-install @modelcontextprotocol/inspector --version
```

Observed result: no local inspector command or dependency was present, and `npx.cmd --no-install` reported that `@modelcontextprotocol/inspector` would need to be downloaded. No global install was performed.

Optional inspector command when the inspector is already available:

```powershell
npx.cmd @modelcontextprotocol/inspector http://localhost:8787/mcp
```

Record the inspector tool list output in `examples/transcripts/chatgpt-web-connector-test.txt` before marking this row verified.

## Tunnel Verification

Availability checks:

```powershell
ngrok version
cloudflared --version
```

Observed:

```text
ngrok version 3.39.1-msix-stable
cloudflared version 2025.8.1
```

`cloudflared tunnel --url http://localhost:8787 --no-autoupdate` produced disposable `trycloudflare.com` URLs, but remote HTTP checks were not reliable in this pass. One run failed DNS resolution immediately after tunnel creation; another returned Cloudflare `404` for `/status` and `/mcp`. Do not use those cloudflared results as proof of connector reachability.

`ngrok` produced a working HTTPS tunnel in this pass:

```powershell
ngrok http http://localhost:8787 --log=stdout
```

Observed disposable URL:

```text
https://germicide-paddle-luminance.ngrok-free.dev
```

Observed connector URL format:

```text
https://germicide-paddle-luminance.ngrok-free.dev/mcp
```

Observed tunnel endpoint checks:

```text
GET /status -> HTTP/1.1 200 OK, text/html mission status page
GET /mcp -> HTTP/1.1 400 Bad Request, "Invalid or missing MCP session id."
```

The ngrok URL above was a temporary verification URL and may no longer be active. For ChatGPT Web, start a fresh tunnel and copy the current HTTPS URL ending in `/mcp`. Do not use `localhost` as the ChatGPT connector URL.

## Mock Target Repo

Create the target repo before asking ChatGPT Web to start a mock mission:

```powershell
npm.cmd run create:chatgpt-mock-target
```

This creates `C:\tmp\gcb-chatgpt-web-mock-target` with:

- `.gitignore` created before `git add`
- `node_modules/` ignored
- local git `user.name` and `user.email`
- committed `package.json`, `package-lock.json`, `src/add.ts`, and `tests/add.test.ts`
- passing `npm.cmd test`
- no `git add .`

## ChatGPT Web Checklist

1. Start the bridge in mock mode:

```powershell
$env:GCB_MOCK_CODEX="1"
$env:GCB_MOCK_SCENARIO="validation_fail_then_success"
gcb.cmd serve
```

2. Start an HTTPS tunnel to port `8787`, for example:

```powershell
ngrok http http://localhost:8787 --log=stdout
```

3. Copy the HTTPS `/mcp` connector URL:

```text
https://<tunnel-host>/mcp
```

4. In ChatGPT Web, open:

```text
Settings -> Apps & Connectors -> Advanced settings -> Developer mode
```

5. Create a connector with the HTTPS `/mcp` URL.
6. Open a new chat.
7. Click `+` near the composer.
8. Click `More`.
9. Add the `gpt-codex-web-bridge` connector.
10. Ask ChatGPT to call `get_manager_prompt`, `list_missions`, and `get_mission_status`.
11. If those pass, ask ChatGPT to start a mock mission only. Do not ask for a real Codex mission during this verification.

## First ChatGPT Prompt

```text
請使用 gpt-codex-web-bridge。

先不要啟動真 Codex 任務。請只測試 connector 是否可用：

1. 呼叫 get_manager_prompt
2. 呼叫 list_missions
3. 呼叫 get_mission_status

請回報每個工具呼叫是否成功。
```

Expected result: ChatGPT Web shows successful tool calls for all three tools. Paste the tool-call output into `examples/transcripts/chatgpt-web-connector-test.txt`.

## Second ChatGPT Prompt

Use this only after the first prompt succeeds:

```text
請使用 gpt-codex-web-bridge 啟動一個 mock mission。

goal: Run a ChatGPT Web mock mission until validation passes.
repoPath: C:\tmp\gcb-chatgpt-web-mock-target
testCommand: npm.cmd test
maxLoops: 4
allowEnvRead: false
autoContinue: true

啟動後請呼叫 get_mission_status，直到 mission completed、paused、blocked、或 failed。
```

Expected `start_mission` arguments:

```json
{
  "goal": "Run a ChatGPT Web mock mission until validation passes.",
  "repoPath": "C:\\tmp\\gcb-chatgpt-web-mock-target",
  "testCommand": "npm.cmd test",
  "maxLoops": 4,
  "allowEnvRead": false,
  "autoContinue": true
}
```

Expected final mock result:

```json
{
  "status": "completed",
  "lastValidation": {
    "status": "passed"
  }
}
```

## Evidence To Paste

Fill this section only with real ChatGPT Web evidence.

```text
Maintainer:
Date:
OS:
Browser:
Tunnel provider:
Fresh HTTPS /mcp URL:

Connector creation:
[paste screenshot path or description]

get_manager_prompt:
[paste ChatGPT Web tool call and result]

list_missions:
[paste ChatGPT Web tool call and result]

get_mission_status:
[paste ChatGPT Web tool call and result]

start_mission:
[paste ChatGPT Web tool call and result]

status polling:
[paste get_mission_status calls until terminal state]

Final verdict:
[not yet verified | verified]
```

## Troubleshooting

### ChatGPT shows "OAuth client not found"

- This bridge is noauth for the current MVP.
- Do not click account linking or connect account.
- Recreate the connector as No Authentication.
- Refresh the connector after restarting the server.
- Verify all tools advertise `securitySchemes: [{ type: "noauth" }]`.

## Evidence Checklist

- [x] Connector creation verified
- [ ] `get_manager_prompt` tool call pasted
- [x] `list_missions` tool call summary recorded
- [ ] `get_mission_status` polling transcript pasted
- [x] `start_mission` mock mission tool call summary recorded
- [x] final mock mission terminal status recorded
- [ ] maintainer, date, OS, browser, and tunnel provider recorded

## Final Verdict

```text
Partially verified with real ChatGPT Web evidence. Connector creation, list_missions, and mock start_mission are verified. ChatGPT Web continue_mission and ChatGPT Web -> real Codex CLI missions are not yet verified.
```
