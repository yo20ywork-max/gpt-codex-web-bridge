# ChatGPT Start Message

Paste this after connecting the `gpt-codex-web-bridge` MCP server:

```text
Use gpt-codex-web-bridge to implement Google OAuth in C:\Users\me\project, run tests, fix failures, pause if usage limit is reached, and resume when I say continue.
```

Expected ChatGPT behavior:

- Call `start_mission`.
- Use the repo path you provided.
- Set `maxLoops` to `12`.
- Set `autoContinue` to `true`.
- Set `allowEnvRead` to `false`.
- Check status/report until the bridge says the mission is running, completed, paused, blocked, or failed.
