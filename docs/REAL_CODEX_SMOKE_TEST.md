# Real Codex Smoke Test

This guide verifies the local bridge against a real Codex CLI session. It does not prove ChatGPT Web integration; use [`CHATGPT_WEB_CONNECTION_TEST.md`](CHATGPT_WEB_CONNECTION_TEST.md) for that connection path.

## 1. Install And Log In To Codex CLI

Install Codex CLI using the official instructions for your account or organization. For npm-based installs, this is commonly:

```bash
npm install -g @openai/codex
```

Verify the binary is available:

```bash
codex --version
```

Log in using the flow supported by your Codex CLI build:

```bash
codex login
```

If your Codex distribution uses a different install or login command, use that command instead. The bridge itself does not require or store an OpenAI API key; it relies on the existing Codex CLI authentication/session.

## 2. Build The Bridge

```bash
npm ci
npm run build
```

Optional local command alias:

```bash
npm link
```

If you do not link it, replace `gcb` below with `node dist/cli.js`.

## 3. Run Doctor

```bash
gcb doctor
```

Expected result:

```json
{
  "node": { "ok": true },
  "git": { "available": true },
  "codex": { "available": true },
  "storage": { "writable": true },
  "mcp": { "endpoint": "http://localhost:8787/mcp" }
}
```

## 4. Create A Tiny Local Git Repo

```bash
mkdir codex-smoke-repo
cd codex-smoke-repo
git init
git config user.email smoke@example.local
git config user.name smoke
npm init -y
npm pkg set scripts.test="node test.js"
echo "const fs = require('fs'); process.exit(fs.existsSync('hello.txt') ? 0 : 1);" > test.js
git add package.json test.js
git commit -m initial
cd ..
```

## 5. Run A Real Mission

```bash
gcb start --repo ./codex-smoke-repo --goal "Create hello.txt with the text hello from Codex. Keep the change minimal." --test "npm test"
```

Watch status:

```bash
gcb status
```

## 6. Verify Codex Modified A Branch

```bash
cd codex-smoke-repo
git branch --show-current
git status --short
git diff --stat
```

Expected:

- branch name starts with `gcb/`
- `hello.txt` exists
- `npm test` passes

## 7. Verify report.md Exists

Use `gcb status` to read `missionDir`, then inspect:

```bash
cat <missionDir>/report.md
```

Expected sections:

- Mission ID
- Goal
- Repo
- Branch
- Status page
- Validation
- Changed Files Summary
- Risk Flags
- Resume Command

## 8. Simulate Or Observe Resume Behavior

To observe resume without waiting for an actual quota event, pause a mission:

```bash
gcb pause <missionId>
gcb continue <missionId>
```

To observe repair-loop resume, start a mission that intentionally fails validation once, then let Codex repair it. The bridge records `hasCodexRun: true` after a successful Codex run and uses native `codex exec resume --last` for later repair/resume loops when no explicit session id was parsed.

Actual quota/rate-limit resume can only be verified when Codex CLI returns a real limit message such as `rate limit`, `quota`, `usage limit`, `429`, `too many requests`, or `limit reached`.

## 9. What Is Mock-Tested vs Real-Tested

Mock-tested by CI:

- mission creation
- branch creation
- validation loop
- validation repair loop
- rate-limit pause
- omitted-`missionId` resume
- report generation
- safety path checks

Real-tested only after following this guide:

- your Codex CLI installation
- your Codex CLI login/session
- real `codex exec` behavior
- real `codex exec resume --last` behavior
- real Codex modifications to a target repo

Not claimed as verified unless you provide a reproducible transcript or screenshot path:

- ChatGPT Web Developer Mode connection
- ChatGPT Web tool-call approval UX
- end-to-end ChatGPT Web to Codex mission execution
