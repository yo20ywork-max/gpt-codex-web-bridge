# ChatGPT Continue Message

When a mission is paused, say:

```text
continue
```

You can also say:

```text
繼續
```

Expected ChatGPT behavior:

- Call `continue_mission`.
- If the latest mission id is known, pass it.
- If not, omit `missionId`; the bridge resumes the latest paused mission.
- If the bridge reports `rate_limit_or_quota` again, summarize that it safely paused and can be resumed later.
