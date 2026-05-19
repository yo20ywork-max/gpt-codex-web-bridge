# Local CLI Demo

Build the project:

```bash
npm install
npm run build
```

Start the local MCP server:

```bash
npm run dev
```

Run a mock mission without real Codex usage:

```bash
npm run mock-demo
```

Run a quota/rate-limit pause and resume demo:

```bash
npm run demo:rate-limit
```

Start a real local mission:

```bash
node dist/cli.js start --repo C:\path\to\repo --goal "Implement the requested change, run tests, fix failures, and pause on usage limits." --test "npm test"
```

Inspect it:

```bash
node dist/cli.js status
node dist/cli.js report
```

Continue the latest paused mission:

```bash
node dist/cli.js continue
```
