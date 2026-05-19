# Security

`gpt-codex-web-bridge` is local-first and intentionally conservative. It is designed to let ChatGPT Web manage Codex missions through MCP without turning ChatGPT Web into a scraped or automated browser target.

## Boundaries

- No ChatGPT DOM scraping.
- No programmatic extraction of ChatGPT Web conversations.
- The bridge never intentionally stores passwords, cookies, browser session tokens, OpenAI API keys, or OpenAI credentials.
- No rate-limit, quota, approval, safety mitigation, or access restriction bypassing.
- No automatic production deploys.
- No automatic pushes to `main`.
- Branch-first workflow: missions work on `gcb/<missionId>`.
- Dirty worktrees are blocked instead of stashed or overwritten.
- The bridge instructs Codex not to read secrets.
- The bridge blocks/reports forbidden files if they are changed in git diff.
- The current MVP does not provide OS-level file-read prevention.
- Users should rely on Codex sandbox/approval settings and avoid running missions on repos containing production secrets.

## Forbidden Secret Files

The bridge blocks/reports changes to common secret and credential paths when they appear in git diff:

```text
.env
.env.*
**/*.pem
**/*.key
id_rsa
id_ed25519
**/.ssh/**
**/secrets/**
**/credentials/**
**/.aws/**
**/.gcloud/**
**/.kube/**
```

## Risk Flags

The bridge reports risk flags for:

- GitHub Actions workflow changes
- dependency manifest or lockfile changes
- auth, payment, or permission-related changes
- deleted tests
- possible assertion weakening

## Reporting Issues

Please open a GitHub issue with:

- affected version or commit
- operating system
- Node.js version
- redacted mission report
- redacted ledger excerpt if relevant

Do not include secrets, tokens, credentials, private keys, `.env` contents, or proprietary source code in public reports.
