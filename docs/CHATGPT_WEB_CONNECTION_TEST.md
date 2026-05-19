# ChatGPT Web Connection Test

This guide documents how to test ChatGPT Web with the local MCP bridge. It is a verification procedure, not proof that this repository has already been verified in ChatGPT Web.

## 1. Start The Local Bridge

```bash
npm ci
npm run build
npm run dev
```

Expected local endpoints:

```text
http://localhost:8787
http://localhost:8787/status
http://localhost:8787/mcp
```

## 2. Expose A Tunnel

Using localtunnel:

```bash
npx localtunnel --port 8787
```

Using Cloudflare Tunnel:

```bash
npx cloudflared tunnel --url http://localhost:8787
```

Required MCP URL:

```text
https://your-tunnel-url.example/mcp
```

## 3. Connect In ChatGPT Developer Mode / Apps / Connectors

In ChatGPT Web:

1. Open Developer Mode / Apps / Connectors.
2. Add a custom MCP server.
3. Paste the tunnel URL ending in `/mcp`.
4. Approve the connection if ChatGPT asks.

## 4. Call `get_manager_prompt`

Expected tool result shape:

```json
{
  "prompt": "You are the web ChatGPT mission manager for gpt-codex-web-bridge.\n\nWhen I give you..."
}
```

Paste or follow that prompt in ChatGPT Web.

## 5. Call `list_missions`

Expected empty result on a new install:

```json
{
  "missions": []
}
```

Expected non-empty result after demos:

```json
{
  "missions": [
    {
      "missionId": "m_...",
      "status": "completed",
      "currentLoop": 2,
      "maxLoops": 4
    }
  ]
}
```

## 6. Start A Mock Mission From ChatGPT

For local-only testing without real Codex, start the server with mock mode:

```bash
$env:GCB_MOCK_CODEX="1"
$env:GCB_MOCK_SCENARIO="validation_fail_then_success"
npm run dev
```

Ask ChatGPT:

```text
Use gpt-codex-web-bridge to run a mock mission in C:\path\to\tiny-git-repo, run npm test, fix failures, and report status.
```

Expected `start_mission` payload:

```json
{
  "goal": "run a mock mission ...",
  "repoPath": "C:\\path\\to\\tiny-git-repo",
  "testCommand": "npm test",
  "maxLoops": 12,
  "autoContinue": true,
  "allowEnvRead": false
}
```

Expected `start_mission` result:

```json
{
  "missionId": "m_...",
  "status": "queued",
  "branch": "gcb/m_...",
  "workerStarted": true
}
```

## 7. Continue A Paused Mission From ChatGPT

Start mock rate-limit mode:

```bash
$env:GCB_MOCK_CODEX="1"
$env:GCB_MOCK_SCENARIO="rate_limit"
npm run dev
```

After `start_mission`, expected paused status:

```json
{
  "status": "paused",
  "pauseReason": "rate_limit_or_quota",
  "nextRecommendedAction": "Wait for quota or availability to recover, then run gcb continue."
}
```

Change mock scenario to success and restart the local server:

```bash
$env:GCB_MOCK_SCENARIO="success"
npm run dev
```

Tell ChatGPT:

```text
continue
```

Expected `continue_mission` call:

```json
{
  "missionId": "m_..."
}
```

If ChatGPT does not know the id, it may omit `missionId`; the bridge resumes the latest paused mission.

## Common Errors

### Invalid MCP session id

Cause: ChatGPT or a manual client reused a stale `mcp-session-id`.

Fix: reconnect the MCP server in ChatGPT Web or start a fresh client session.

### Host header / tunnel blocked

Cause: tunnel host is not accepted by local host-header protection or the tunnel is rewriting headers unexpectedly.

Fix: use a tunnel URL that forwards to `http://localhost:8787`, or set `GCB_ALLOWED_HOSTS` to the expected hostnames before starting the server.

### ChatGPT asks for approval

Cause: ChatGPT requires user approval before invoking local tools.

Fix: approve only the specific tool call and repo path you intend to use.

### Local server not reachable

Cause: bridge is not running, port is blocked, or the tunnel died.

Fix:

```bash
npm run dev
curl http://localhost:8787/health
```

### Tool call payload approval

Cause: ChatGPT wants approval for arguments such as `repoPath`, `goal`, or `allowEnvRead`.

Fix: verify `repoPath` is a user-owned local repo, keep `allowEnvRead: false`, then approve.
