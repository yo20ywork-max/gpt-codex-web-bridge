import fs from "node:fs";
import { CodexRunner } from "./codexRunner.js";
import { getDiff } from "./git.js";
import { MissionStore } from "./missionStore.js";
import { createInitialCodexPrompt, createRepairPrompt, createResumePrompt } from "./prompts.js";
import { generateReport } from "./report.js";
import { SafetyGuard } from "./safetyGuard.js";
import { runValidationCommands, summarizeOutput } from "./validation.js";
import type { GitChangeSummary, MissionState, SafetyAssessment } from "./types.js";

export class MissionWorker {
  constructor(
    private readonly store: MissionStore,
    private readonly runner: CodexRunner,
    private readonly safetyGuard = new SafetyGuard()
  ) {}

  async run(missionId: string, options?: { resumeCodex?: boolean }): Promise<void> {
    try {
      await this.runLoop(missionId, options);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const state = await this.store.tryGetMission(missionId);
      if (!state) {
        throw error;
      }
      const updated = await this.store.patchState(missionId, {
        status: "failed",
        blockReason: "worker_exception",
        nextAction: "Inspect mission logs and retry with gcb continue after fixing the local issue."
      });
      await this.store.appendLedger(missionId, "failed", `Worker exception: ${message}`);
      await this.writeReport(updated);
    }
  }

  private async runLoop(missionId: string, options?: { resumeCodex?: boolean }): Promise<void> {
    let state = await this.store.getMission(missionId);
    if (state.status === "completed") {
      return;
    }

    state = await this.store.patchState(missionId, {
      status: "running",
      pauseReason: undefined,
      blockReason: undefined,
      nextAction: "Codex is working on the mission."
    });

    let resumeCodex = shouldResumeCodex(state, Boolean(options?.resumeCodex));

    while (true) {
      state = await this.store.getMission(missionId);
      if (state.status === "paused") {
        await this.writeReport(state);
        return;
      }
      if (state.currentLoop >= state.maxLoops) {
        await this.block(state, "max_loops_reached", "Validation could not be fixed within maxLoops.");
        return;
      }

      state = await this.store.patchState(missionId, {
        currentLoop: state.currentLoop + 1,
        status: "running",
        nextAction: "Running Codex."
      });

      const paths = this.store.getMissionPaths(missionId);
      const prompt = await this.buildPrompt(state, resumeCodex);
      await this.store.appendLedger(missionId, "codex_started", `Starting Codex loop ${state.currentLoop}.`, {
        resumeCodex
      });

      const codexResult = await this.runner.run({ mission: state, prompt, resume: resumeCodex }, paths.codexDir);
      state = await this.store.patchState(missionId, {
        hasCodexRun: codexResult.exitCode === 0 && !codexResult.rateLimitDetected ? true : state.hasCodexRun,
        codexSessionId: codexResult.sessionId ?? state.codexSessionId,
        lastCodexOutputPath: codexResult.combinedOutputPath,
        nextAction: "Inspecting Codex output and repository diff."
      });
      resumeCodex = shouldResumeCodex(state, false);

      await this.store.appendLedger(missionId, "codex_finished", summarizeOutput(codexResult.combinedOutput, 12), {
        exitCode: codexResult.exitCode,
        outputPath: codexResult.combinedOutputPath
      });
      await this.store.appendLedger(missionId, "checkpoint", `Codex loop ${state.currentLoop} output saved.`, {
        outputPath: codexResult.combinedOutputPath
      });

      const externallyPaused = await this.store.getMission(missionId);
      if (externallyPaused.status === "paused") {
        await this.writeReport(externallyPaused);
        return;
      }

      if (codexResult.rateLimitDetected) {
        await this.store.appendLedger(missionId, "rate_limit_detected", "Codex reported a rate limit, quota, usage limit, or temporary availability limit.");
        state = await this.store.patchState(missionId, {
          status: "paused",
          pauseReason: "rate_limit_or_quota",
          nextAction: "Wait for quota or availability to recover, then run gcb continue."
        });
        await this.writeReport(state);
        return;
      }

      if (codexResult.exitCode !== 0) {
        state = await this.store.patchState(missionId, {
          status: "failed",
          blockReason: "codex_process_failed",
          nextAction: "Inspect Codex logs and retry with gcb continue after fixing the local issue."
        });
        await this.store.appendLedger(missionId, "failed", `Codex exited with code ${codexResult.exitCode}.`, {
          outputPath: codexResult.combinedOutputPath
        });
        await this.writeReport(state);
        return;
      }

      const { changeSummary, safety } = await this.inspectSafety(state);
      if (safety.blocked) {
        state = await this.store.patchState(missionId, {
          status: "blocked",
          blockReason: "safety_violation",
          nextAction: "Review forbidden file changes and manually decide how to proceed."
        });
        await this.store.appendLedger(missionId, "blocked", safety.message, {
          forbiddenFiles: safety.forbiddenFiles
        });
        await this.writeReport(state, changeSummary, safety);
        return;
      }

      if (shouldVerificationPause(state)) {
        state = await this.store.patchState(missionId, {
          status: "paused",
          pauseReason: "verification_pause_after_codex",
          verificationPauseConsumed: true,
          nextAction: `Run gcb continue ${missionId} to verify Codex resume.`
        });
        await this.store.appendLedger(missionId, "paused", "Verification pause after successful Codex run.", {
          reason: "verification_pause_after_codex"
        });
        await this.writeReport(state, changeSummary, safety);
        return;
      }

      await this.store.appendLedger(missionId, "validation_started", "Running validation commands.");
      const validation = await runValidationCommands(state.repoPath, state, paths.validationDir);
      state = await this.store.patchState(missionId, {
        lastValidation: validation.result,
        nextAction: validation.result.status === "failed" ? "Codex will repair the validation failure." : "Generating final report."
      });
      await this.store.appendLedger(missionId, "validation_finished", validation.result.summary ?? validation.result.status, {
        status: validation.result.status,
        command: validation.result.command,
        exitCode: validation.result.exitCode,
        logPath: validation.result.logPath
      });

      const latestSafety = await this.inspectSafety(state);
      await this.writeReport(state, latestSafety.changeSummary, latestSafety.safety);

      if (validation.result.status === "passed" || validation.result.status === "not_run") {
        state = await this.store.patchState(missionId, {
          status: "completed",
          nextAction:
            validation.result.status === "passed"
              ? "Review the branch and merge manually when satisfied."
              : "No validation command was available; inspect the diff manually before merging."
        });
        await this.store.appendLedger(missionId, "completed", "Mission completed.");
        const finalSafety = await this.inspectSafety(state);
        await this.writeReport(state, finalSafety.changeSummary, finalSafety.safety);
        return;
      }

      if (state.currentLoop >= state.maxLoops) {
        await this.block(state, "max_loops_reached", "Validation still failed after reaching maxLoops.");
        return;
      }

      resumeCodex = shouldResumeCodex(state, false);
    }
  }

  private async buildPrompt(state: MissionState, resumeCodex: boolean): Promise<string> {
    const recentLedger = await this.store.readLedger(state.missionId, 20);
    const gitDiffSummary = await getDiff(state.repoPath, { stat: true }).catch(() => "");

    if (state.lastValidation.status === "failed" && state.lastValidation.logPath) {
      const validationLog = await fs.promises.readFile(state.lastValidation.logPath, "utf8").catch(() => state.lastValidation.summary ?? "");
      return createRepairPrompt(state, validationLog, gitDiffSummary);
    }

    if (resumeCodex || state.currentLoop > 1 || state.status === "paused") {
      return createResumePrompt(state, recentLedger, gitDiffSummary, state.lastValidation.summary ?? "");
    }

    return createInitialCodexPrompt(state);
  }

  private async inspectSafety(state: MissionState): Promise<{ changeSummary: GitChangeSummary; safety: SafetyAssessment }> {
    const changeSummary = await this.safetyGuard.inspectGitDiff(state.repoPath);
    const safety = this.safetyGuard.assess(changeSummary);
    return { changeSummary, safety };
  }

  private async block(state: MissionState, reason: string, message: string): Promise<void> {
    const updated = await this.store.patchState(state.missionId, {
      status: "blocked",
      blockReason: reason,
      nextAction: "Resolve the blocker and run gcb continue when ready."
    });
    await this.store.appendLedger(state.missionId, "blocked", message, { reason });
    await this.writeReport(updated);
  }

  private async writeReport(state: MissionState, changeSummary?: GitChangeSummary, safety?: SafetyAssessment): Promise<void> {
    let finalChangeSummary = changeSummary;
    let finalSafety = safety;
    if (!finalChangeSummary || !finalSafety) {
      try {
        const inspected = await this.inspectSafety(state);
        finalChangeSummary = inspected.changeSummary;
        finalSafety = inspected.safety;
      } catch {
        finalChangeSummary = undefined;
        finalSafety = undefined;
      }
    }
    const ledger = await this.store.readLedger(state.missionId, 100);
    await this.store.saveReport(
      state.missionId,
      generateReport({
        state,
        ledger,
        changeSummary: finalChangeSummary,
        safety: finalSafety
      })
    );
  }
}

export function shouldResumeCodex(state: MissionState, explicitResume: boolean): boolean {
  return explicitResume || Boolean(state.codexSessionId) || Boolean(state.hasCodexRun);
}

function shouldVerificationPause(state: MissionState): boolean {
  return (
    process.env.GCB_VERIFY_PAUSE_AFTER_CODEX === "1" &&
    process.env.GCB_MOCK_CODEX !== "1" &&
    !state.verificationPauseConsumed &&
    state.hasCodexRun
  );
}

export class MissionWorkerManager {
  private readonly active = new Map<string, Promise<void>>();

  constructor(private readonly worker: MissionWorker) {}

  start(missionId: string, options?: { resumeCodex?: boolean }): boolean {
    if (this.active.has(missionId)) {
      return false;
    }
    const run = this.worker
      .run(missionId, options)
      .catch((error) => {
        // The service layer records expected failures. This catch prevents an
        // unhandled rejection from taking down the long-running MCP server.
        console.error(`Mission worker ${missionId} failed:`, error);
      })
      .finally(() => {
        this.active.delete(missionId);
      });
    this.active.set(missionId, run);
    return true;
  }

  isRunning(missionId: string): boolean {
    return this.active.has(missionId);
  }

  async wait(missionId: string): Promise<void> {
    await this.active.get(missionId);
  }
}
