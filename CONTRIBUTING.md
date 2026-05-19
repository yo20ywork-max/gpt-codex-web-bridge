# Contributing

Project vision:

> ChatGPT Web should be able to manage long-running Codex missions with checkpoint/resume.

This repository is a local-first MVP. The goal is to make the workflow feel simple:

1. A user gives ChatGPT Web one software-development goal.
2. ChatGPT calls MCP tools exposed by this bridge.
3. The bridge starts or resumes a Codex CLI mission in a user-owned repo.
4. Codex codes, tests, repairs, checkpoints, pauses on usage limits, and resumes later.

## Development

```bash
npm install
npm run build
npm test
npm run mock-demo
```

## Principles

- Prefer official ChatGPT Apps / MCP integration.
- Do not add ChatGPT DOM automation.
- Do not add credential storage.
- Do not bypass rate limits, quotas, approvals, or safety mitigations.
- Keep mission state inspectable on disk.
- Keep behavior testable in mock mode without real Codex usage.
- Keep destructive operations opt-in and visible.

## Before Opening a PR

Run:

```bash
npm run build
npm test
npm run mock-demo
```

If you change mission flow, add or update tests that exercise behavior, not just static output.
