import type { GitChangeSummary, LedgerEvent, MissionState, SafetyAssessment } from "./types.js";

export interface ReportInput {
  state: MissionState;
  ledger: LedgerEvent[];
  changeSummary?: GitChangeSummary;
  safety?: SafetyAssessment;
}

export function generateReport(input: ReportInput): string {
  const { state, ledger, changeSummary, safety } = input;
  const latestLedger = ledger.slice(-12);

  return [
    `# Mission Report: ${state.missionId}`,
    "",
    `- Mission ID: ${state.missionId}`,
    `- Goal: ${state.goal}`,
    `- Repo: ${state.repoPath}`,
    `- Branch: ${state.branch ?? "not assigned"}`,
    `- Status: ${state.status}`,
    `- Loop count: ${state.currentLoop}/${state.maxLoops}`,
    `- Status page: http://localhost:8787/status?missionId=${encodeURIComponent(state.missionId)}`,
    "",
    "## Codex Mode",
    "",
    `- ${state.codexMode ?? "unknown"}`,
    "",
    "## Validation",
    "",
    `- Status: ${state.lastValidation.status}`,
    `- Command: ${state.lastValidation.command ?? "not run"}`,
    `- Exit code: ${state.lastValidation.exitCode ?? "n/a"}`,
    `- Log path: ${state.lastValidation.logPath ?? "n/a"}`,
    "",
    state.lastValidation.summary ? fenced(state.lastValidation.summary) : "No validation summary recorded.",
    "",
    "## Changed Files Summary",
    "",
    listOrNone(changeSummary?.changedFiles),
    "",
    changeSummary?.diffSummary ? fenced(changeSummary.diffSummary) : "No git diff summary recorded.",
    "",
    "## Risk Flags",
    "",
    listOrNone(safety?.riskFlags),
    "",
    "## Dependency Changes",
    "",
    listOrNone(changeSummary?.dependencyFiles),
    "",
    "## Forbidden File Check",
    "",
    safety?.forbiddenFiles && safety.forbiddenFiles.length > 0
      ? listOrNone(safety.forbiddenFiles)
      : "- Passed: no forbidden file changes detected.",
    "",
    "## Latest Ledger Summary",
    "",
    latestLedger.length > 0
      ? latestLedger.map((event) => `- ${event.ts} ${event.type}: ${event.message}`).join("\n")
      : "- No ledger events recorded.",
    "",
    "## Next Action",
    "",
    state.nextAction ?? defaultNextAction(state.status),
    "",
    "## Resume Command",
    "",
    "```bash",
    `gcb continue ${state.missionId}`,
    "```"
  ].join("\n");
}

export function buildStructuredReportSummary(state: MissionState, markdown: string): Record<string, unknown> {
  return {
    missionId: state.missionId,
    status: state.status,
    goal: state.goal,
    repoPath: state.repoPath,
    branch: state.branch,
    codexMode: state.codexMode,
    currentLoop: state.currentLoop,
    maxLoops: state.maxLoops,
    validation: state.lastValidation,
    pauseReason: state.pauseReason,
    blockReason: state.blockReason,
    nextAction: state.nextAction,
    markdownLength: markdown.length
  };
}

function listOrNone(items?: string[]): string {
  if (!items || items.length === 0) {
    return "- None.";
  }
  return items.map((item) => `- ${item}`).join("\n");
}

function fenced(text: string): string {
  return ["```text", text.trim(), "```"].join("\n");
}

function defaultNextAction(status: MissionState["status"]): string {
  switch (status) {
    case "completed":
      return "Review the branch and merge manually when satisfied.";
    case "paused":
      return "Resume later with the resume command after the pause reason is resolved.";
    case "blocked":
      return "Resolve the blocker, then run the resume command.";
    case "failed":
      return "Inspect the Codex and validation logs before retrying.";
    default:
      return "Wait for the worker to advance the mission or query status again.";
  }
}
