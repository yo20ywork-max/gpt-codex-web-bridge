# Expected Report Shape

Every mission writes:

```text
.gpt-codex-web-bridge/missions/<missionId>/report.md
```

Expected sections:

```markdown
# Mission Report: <missionId>

- Mission ID: <missionId>
- Goal: <goal>
- Repo: <repoPath>
- Branch: gcb/<missionId>
- Status: completed | paused | blocked | failed | running
- Loop count: <current>/<max>
- Status page: http://localhost:8787/status?missionId=<missionId>

## Validation

- Status: passed | failed | not_run
- Command: npm test
- Exit code: 0
- Log path: <path>

## Changed Files Summary

- src/example.ts

## Risk Flags

- None.

## Dependency Changes

- None.

## Forbidden File Check

- Passed: no forbidden file changes detected.

## Latest Ledger Summary

- <timestamp> mission_started: Mission created.
- <timestamp> codex_started: Starting Codex loop 1.
- <timestamp> validation_finished: All validation commands passed.

## Next Action

Review the branch and merge manually when satisfied.

## Resume Command

gcb continue <missionId>
```
