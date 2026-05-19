# Verification Matrix

This matrix separates committed proof from documented procedures. Do not upgrade a row to `Verified` unless the repository contains reproducible evidence or the command is part of the maintained test/CI path.

| Item | Status | Command or method | Evidence file | Notes |
| --- | --- | --- | --- | --- |
| TypeScript build | Verified | `npm.cmd run build` | `.github/workflows/ci.yml`, `package.json` | Run locally in the latest verification pass and included in CI. |
| Unit tests | Verified | `npm.cmd test` | `tests/`, `.github/workflows/ci.yml` | 14 Vitest tests currently cover storage, prompts, safety, MCP noauth tool metadata, runner args, rate-limit detection, mock workflows, verification pause, and resume behavior. |
| Mock mission success | Mock-verified | `npm.cmd test`, `npm.cmd run mock-demo` | `tests/missionWorkflow.test.ts`, `examples/transcripts/mock-demo.txt` | Uses `GCB_MOCK_CODEX=1`; does not consume real Codex. |
| Mock validation fail then success | Mock-verified | `npm.cmd run mock-demo` | `tests/missionWorkflow.test.ts`, `examples/transcripts/mock-demo.txt` | Demonstrates validation failure, repair loop, validation pass, and report generation. |
| Mock rate-limit pause | Mock-verified | `npm.cmd run demo:rate-limit`, `npm.cmd test` | `tests/missionWorkflow.test.ts`, `examples/transcripts/rate-limit-demo.txt` | Verifies `pauseReason: rate_limit_or_quota`; no aggressive retry. |
| Mock pause then continue | Mock-verified | `npm.cmd run demo:rate-limit`, `npm.cmd test` | `tests/missionWorkflow.test.ts`, `examples/transcripts/rate-limit-demo.txt` | Verifies omitted `missionId` can resume the latest paused mission. |
| CLI doctor | Verified | `gcb doctor` | `docs/REAL_CODEX_RUN_TRANSCRIPT.md` | Verified during the real Codex smoke run on Windows PowerShell. |
| Local bridge HTTP endpoints | Verified | `gcb.cmd serve`, `curl.exe -i http://localhost:8787/status`, `curl.exe -i http://localhost:8787/mcp` | `docs/CHATGPT_WEB_RUN_TRANSCRIPT.md`, `examples/transcripts/chatgpt-web-connector-test.txt` | `/status` returned `200 OK`; raw `GET /mcp` returned expected `400 Invalid or missing MCP session id.` |
| HTTPS tunnel to local bridge | Verified | `ngrok http http://localhost:8787 --log=stdout` | `docs/CHATGPT_WEB_RUN_TRANSCRIPT.md`, `examples/transcripts/chatgpt-web-connector-test.txt` | ngrok forwarded `/status` with `200 OK`; raw `/mcp` returned expected MCP session `400`. |
| MCP tool list | Documented-only | MCP Inspector or JSON-RPC `tools/list` | `docs/MCP_INSPECTOR_TEST.md`, `docs/CHATGPT_WEB_RUN_TRANSCRIPT.md` | MCP Inspector was not installed locally; `npx.cmd --no-install @modelcontextprotocol/inspector --version` confirmed it would require a download. |
| Real Codex CLI mission | Verified | `gcb start --repo /tmp/gcb-real-codex-target --goal "Add a subtract..." --test "npm test"` | `docs/REAL_CODEX_RUN_TRANSCRIPT.md`, `examples/transcripts/real-codex-smoke-test.txt` | Verified by mission `m_mpcvo0l4_e4a2d4e1`: Codex modified `src/add.ts` and `tests/add.test.ts`; `npm test` passed. |
| Real Codex CLI resume | Verified | `GCB_VERIFY_PAUSE_AFTER_CODEX=1` mission, then `gcb continue` | `docs/REAL_CODEX_RESUME_TRANSCRIPT.md`, `examples/transcripts/real-codex-resume-test.txt` | Verified by mission `m_mpcyib0h_f6988e4a`; Codex log shows `codex exec resume 019e4176-2d4b-7240-90a2-8300b7a89e41 <prompt>` and `npm.cmd test` passed. |
| Real ChatGPT Web connector creation | Verified | ChatGPT Developer Mode / Apps / Connectors with `https://germicide-paddle-luminance.ngrok-free.dev/mcp` | `docs/CHATGPT_WEB_RUN_TRANSCRIPT.md`, `examples/transcripts/chatgpt-web-connector-test.txt` | Real ChatGPT Web evidence confirms the connector could call bridge tools. |
| Real ChatGPT Web `get_manager_prompt` tool call | Documented-only | ChatGPT Web calls `get_manager_prompt` | `docs/CHATGPT_WEB_RUN_TRANSCRIPT.md`, `examples/transcripts/chatgpt-web-connector-test.txt` | Template only. Do not claim verified until tool-call transcript or screenshot evidence is added. |
| Real ChatGPT Web `list_missions` tool call | Verified | ChatGPT Web calls `list_missions` | `docs/CHATGPT_WEB_RUN_TRANSCRIPT.md`, `examples/transcripts/chatgpt-web-connector-test.txt` | Returned 6 missions including completed, blocked, and failed historical mission states. |
| Real ChatGPT Web `get_mission_status` tool call | Partially verified | ChatGPT Web status returned after mock `start_mission` | `docs/CHATGPT_WEB_RUN_TRANSCRIPT.md`, `examples/transcripts/chatgpt-web-connector-test.txt` | Evidence includes final completed mock mission status, but no separate polling transcript is recorded. |
| Real ChatGPT Web `start_mission` mock mission | Verified | ChatGPT Web calls `start_mission` with `GCB_MOCK_CODEX=1` bridge | `docs/CHATGPT_WEB_RUN_TRANSCRIPT.md`, `examples/transcripts/chatgpt-web-connector-test.txt` | Verified mission `m_mpd37io2_033c3cbe`: completed, loop 1/4, `npm.cmd test` passed. |
| Real ChatGPT Web `continue_mission` tool call | Not tested | ChatGPT Web calls `continue_mission` | `docs/CHATGPT_WEB_RUN_TRANSCRIPT.md` | No ChatGPT Web continue transcript evidence is committed. |
| ChatGPT Web -> real Codex CLI mission | Not tested | ChatGPT Web calls `start_mission` without mock mode | `docs/CHATGPT_WEB_RUN_TRANSCRIPT.md` | Real Codex CLI is verified separately, but not through ChatGPT Web end-to-end. |

## Status Definitions

- `Verified`: command is part of the project verification path and has concrete repo evidence such as tests or CI configuration.
- `Mock-verified`: behavior is exercised using `GCB_MOCK_CODEX=1`; useful for product flow, not proof of real Codex or ChatGPT Web integration.
- `Partially verified`: some real evidence exists, but a narrower subcase or transcript is missing.
- `Documented-only`: reproducible procedure exists, but no completed transcript or screenshot evidence is committed.
- `Not tested`: no command, test, or procedure exists yet.
