import type { LedgerEvent, MissionState } from "./types.js";
import { SafetyGuard } from "./safetyGuard.js";

const safetyGuard = new SafetyGuard();

export function createInitialCodexPrompt(state: MissionState): string {
  const validation = validationText(state);
  return [
    `You are Codex executing Mission ${state.missionId}.`,
    "",
    `Mission goal: ${state.goal}`,
    `Repository path: ${state.repoPath}`,
    `Mission branch: ${state.branch ?? `gcb/${state.missionId}`}`,
    "",
    safetyGuard.getPromptRules({ allowEnvRead: state.allowEnvRead, branch: state.branch }),
    "",
    "Acceptance criteria:",
    "- Implement the mission goal completely in the target repository.",
    "- Make the smallest correct code changes that satisfy the goal.",
    "- Preserve existing behavior unless the mission explicitly requires changing it.",
    "- Run the validation commands when possible and fix failures that are related to your changes.",
    "- Leave the repository on the mission branch.",
    "- Summarize changed files, validation results, risks, and next actions.",
    "",
    validation,
    "",
    "When you are done, provide a concise summary of changed files and any next actions."
  ].join("\n");
}

export function createRepairPrompt(state: MissionState, validationLog: string, gitDiffSummary: string): string {
  return [
    `You are Codex repairing Mission ${state.missionId}.`,
    "",
    `Previous goal: ${state.goal}`,
    `Repository path: ${state.repoPath}`,
    `Mission branch: ${state.branch ?? `gcb/${state.missionId}`}`,
    "",
    safetyGuard.getPromptRules({ allowEnvRead: state.allowEnvRead, branch: state.branch }),
    "",
    `Latest failed validation command: ${state.lastValidation.command ?? "unknown"}`,
    "",
    "Concise failure summary:",
    truncate(validationLog, 8000),
    "",
    "Current git diff summary:",
    gitDiffSummary.trim() || "No diff summary available.",
    "",
    "Fix the failing validation without deleting tests, weakening assertions, or changing unrelated behavior.",
    "After fixing, summarize changed files and the validation command to run next."
  ].join("\n");
}

export function createResumePrompt(
  state: MissionState,
  recentLedger: LedgerEvent[],
  gitDiffSummary: string,
  validationSummary: string
): string {
  const completedWork = recentLedger
    .filter((event) => ["checkpoint", "validation_finished", "codex_finished", "completed"].includes(event.type))
    .slice(-8)
    .map((event) => `- ${event.ts} ${event.type}: ${event.message}`)
    .join("\n");

  return [
    `You are resuming Mission ${state.missionId}.`,
    "",
    `Mission goal: ${state.goal}`,
    `Repository path: ${state.repoPath}`,
    `Mission branch: ${state.branch ?? `gcb/${state.missionId}`}`,
    `Current status: ${state.status}`,
    `Current loop: ${state.currentLoop}/${state.maxLoops}`,
    `Last failure or pause reason: ${state.pauseReason ?? state.blockReason ?? state.lastValidation.summary ?? "none recorded"}`,
    `Next recommended action: ${state.nextAction ?? "Continue implementing the mission and run validation."}`,
    "",
    safetyGuard.getPromptRules({ allowEnvRead: state.allowEnvRead, branch: state.branch }),
    "",
    "Completed work from recent ledger:",
    completedWork || "- No completed work recorded yet.",
    "",
    "Current git diff summary:",
    gitDiffSummary.trim() || "No git diff summary available.",
    "",
    "Latest validation summary:",
    validationSummary.trim() || "No validation has run yet.",
    "",
    "Validation command to run next:",
    state.lastValidation.command ?? state.testCommand ?? state.lintCommand ?? "Use the repository's detected test command if available.",
    "",
    "Continue from this checkpoint. Keep the changes small and directly tied to the mission goal."
  ].join("\n");
}

function validationText(state: MissionState): string {
  const commands = [state.testCommand, state.lintCommand].filter((item): item is string => Boolean(item));
  if (commands.length === 0) {
    return [
      "Validation commands:",
      "- No explicit validation command was supplied.",
      "- Auto-detect and run the repository's standard tests when possible."
    ].join("\n");
  }
  return ["Validation commands:", ...commands.map((command) => `- ${command}`)].join("\n");
}

function truncate(text: string, maxChars: number): string {
  if (text.length <= maxChars) {
    return text;
  }
  return `${text.slice(0, maxChars)}\n[truncated]`;
}
