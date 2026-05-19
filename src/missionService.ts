import fs from "node:fs";
import path from "node:path";
import { CodexRunner } from "./codexRunner.js";
import { assertGitRepo, createOrSwitchBranch, ensureDirectoryExists, getCurrentBranch, getHeadCommit, isDirtyWorktree } from "./git.js";
import { MissionStore } from "./missionStore.js";
import { getBridgeRoot, isSamePath, normalizePath, nowIso } from "./paths.js";
import { buildStructuredReportSummary, generateReport } from "./report.js";
import { SafetyGuard } from "./safetyGuard.js";
import type { ContinueMissionInput, MissionState, StartMissionInput } from "./types.js";
import { MissionWorker, MissionWorkerManager } from "./worker.js";

export class MissionService {
  constructor(
    readonly store: MissionStore,
    readonly runner: CodexRunner,
    readonly workerManager: MissionWorkerManager
  ) {}

  static create(storageRoot?: string): MissionService {
    const store = new MissionStore(storageRoot);
    const runner = new CodexRunner();
    const worker = new MissionWorker(store, runner, new SafetyGuard());
    const workerManager = new MissionWorkerManager(worker);
    return new MissionService(store, runner, workerManager);
  }

  async startMission(input: StartMissionInput): Promise<Record<string, unknown>> {
    const validated = validateStartMissionInput(input);
    const repoPath = normalizePath(validated.repoPath);
    await ensureDirectoryExists(repoPath);
    const repoRoot = await assertGitRepo(repoPath);
    await this.assertNotSelfTarget(repoRoot);

    const missionId = this.store.createMissionId();
    const branch = `gcb/${missionId}`;
    const now = nowIso();
    let state: MissionState = {
      missionId,
      goal: validated.goal,
      repoPath: repoRoot,
      branch,
      status: "queued",
      createdAt: now,
      updatedAt: now,
      maxLoops: validated.maxLoops,
      currentLoop: 0,
      testCommand: validated.testCommand,
      lintCommand: validated.lintCommand,
      allowEnvRead: validated.allowEnvRead,
      autoContinue: validated.autoContinue,
      hasCodexRun: false,
      verificationPauseConsumed: false,
      lastGoodCommit: await getHeadCommit(repoRoot),
      lastValidation: { status: "not_run" },
      nextAction: "Preparing mission branch."
    };

    state = await this.store.createMission(state);
    await this.store.appendLedger(missionId, "mission_started", "Mission created.", {
      repoPath: repoRoot,
      branch,
      goal: validated.goal
    });

    if (await isDirtyWorktree(repoRoot)) {
      state = await this.store.patchState(missionId, {
        status: "blocked",
        blockReason: "dirty_worktree",
        nextAction: "Commit, revert, or move existing worktree changes, then run gcb continue."
      });
      await this.store.appendLedger(missionId, "blocked", "Target repository has uncommitted changes. The bridge did not stash or overwrite them.");
      await this.writeInitialReport(state);
      return this.statusPayload(state, { workerStarted: false });
    }

    try {
      await createOrSwitchBranch(repoRoot, branch);
    } catch (error) {
      state = await this.store.patchState(missionId, {
        status: "blocked",
        blockReason: "branch_creation_failed",
        nextAction: "Inspect git branch state, then run gcb continue."
      });
      await this.store.appendLedger(missionId, "blocked", (error as Error).message);
      await this.writeInitialReport(state);
      return this.statusPayload(state, { workerStarted: false });
    }

    state = await this.store.patchState(missionId, {
      status: "queued",
      nextAction: "Worker queued."
    });
    await this.writeInitialReport(state);
    const workerStarted = this.workerManager.start(missionId, { resumeCodex: false });
    return this.statusPayload(state, { workerStarted });
  }

  async continueMission(input: ContinueMissionInput = {}): Promise<Record<string, unknown>> {
    const validated = validateContinueMissionInput(input);
    const state = validated.missionId
      ? await this.store.getMission(validated.missionId)
      : await this.findMissionToContinue(validated.repoPath);

    if (this.workerManager.isRunning(state.missionId)) {
      return this.statusPayload(state, { workerStarted: false, message: "Mission is already running." });
    }

    let updated = state;
    if (state.branch) {
      const currentBranch = await getCurrentBranch(state.repoPath);
      if (currentBranch !== state.branch) {
        try {
          await createOrSwitchBranch(state.repoPath, state.branch);
        } catch (error) {
          updated = await this.store.patchState(state.missionId, {
            status: "blocked",
            blockReason: "branch_switch_failed",
            nextAction: "Switch to the mission branch manually or clean conflicting worktree changes, then continue."
          });
          await this.store.appendLedger(state.missionId, "blocked", (error as Error).message);
          return this.statusPayload(updated, { workerStarted: false });
        }
      }
    }

    updated = await this.store.patchState(state.missionId, {
      status: "queued",
      pauseReason: undefined,
      blockReason: undefined,
      nextAction: "Worker queued for resume."
    });
    await this.store.appendLedger(state.missionId, "resumed", "Mission resumed.");
    const workerStarted = this.workerManager.start(state.missionId, { resumeCodex: true });
    return this.statusPayload(updated, { workerStarted });
  }

  async pauseMission(missionId: string): Promise<Record<string, unknown>> {
    const terminated = this.runner.terminate(missionId);
    const state = await this.store.patchState(missionId, {
      status: "paused",
      pauseReason: "user_requested_pause",
      nextAction: "Run gcb continue when ready."
    });
    await this.store.appendLedger(missionId, "paused", "Mission paused by user request.", { terminatedCodexProcess: terminated });
    return this.statusPayload(state, { terminatedCodexProcess: terminated });
  }

  async getMissionStatus(missionId?: string): Promise<Record<string, unknown>> {
    const state = missionId ? await this.store.getMission(missionId) : await this.getLatestMission();
    return this.statusPayload(state, {
      running: this.workerManager.isRunning(state.missionId)
    });
  }

  async listMissions(limit = 10): Promise<Record<string, unknown>> {
    const missions = await this.store.listMissions(limit);
    return {
      missions: missions.map((state) => this.store.toSummary(state))
    };
  }

  async getMissionReport(missionId?: string): Promise<Record<string, unknown>> {
    const state = missionId ? await this.store.getMission(missionId) : await this.getLatestMission();
    let markdown = await this.store.readReport(state.missionId);
    if (!markdown.trim()) {
      const ledger = await this.store.readLedger(state.missionId, 100);
      markdown = generateReport({ state, ledger });
      await this.store.saveReport(state.missionId, markdown);
    }
    return {
      markdown,
      summary: buildStructuredReportSummary(state, markdown)
    };
  }

  async getStatusWidgetData(missionId?: string): Promise<Record<string, unknown>> {
    const state = missionId ? await this.store.getMission(missionId) : await this.getLatestMission();
    let changedFilesCount = 0;
    let riskFlags: string[] = [];

    try {
      const guard = new SafetyGuard();
      const changeSummary = await guard.inspectGitDiff(state.repoPath);
      const safety = guard.assess(changeSummary);
      changedFilesCount = changeSummary.changedFiles.length;
      riskFlags = safety.riskFlags;
    } catch (error) {
      riskFlags = [`Unable to inspect git diff: ${(error as Error).message}`];
    }

    return {
      missionId: state.missionId,
      status: state.status,
      loopCount: `${state.currentLoop}/${state.maxLoops}`,
      currentLoop: state.currentLoop,
      maxLoops: state.maxLoops,
      validationResult: state.lastValidation.status,
      validationCommand: state.lastValidation.command,
      pauseReason: state.pauseReason,
      blockReason: state.blockReason,
      nextAction: state.nextAction,
      changedFilesCount,
      riskFlags,
      reportPath: this.store.getMissionPaths(state.missionId).reportPath
    };
  }

  async getManagerPrompt(): Promise<Record<string, unknown>> {
    const promptPath = path.join(getBridgeRoot(), "prompts", "chatgpt-manager-prompt.md");
    const prompt = await fs.promises.readFile(promptPath, "utf8");
    return { prompt };
  }

  async waitForMission(missionId: string): Promise<void> {
    await this.workerManager.wait(missionId);
  }

  private async findMissionToContinue(repoPath?: string): Promise<MissionState> {
    const normalizedRepo = repoPath ? normalizePath(repoPath) : undefined;
    const paused = await this.store.findLatestMission({ statuses: ["paused"], repoPath: normalizedRepo });
    if (paused) {
      return paused;
    }
    const incomplete = await this.store.findLatestMission({
      statuses: ["queued", "running", "blocked", "failed"],
      repoPath: normalizedRepo
    });
    if (incomplete) {
      return incomplete;
    }
    throw new Error("No paused or incomplete mission found.");
  }

  private async getLatestMission(): Promise<MissionState> {
    const mission = await this.store.findLatestMission();
    if (!mission) {
      throw new Error("No missions found.");
    }
    return mission;
  }

  private async assertNotSelfTarget(repoPath: string): Promise<void> {
    if (process.env.GCB_ALLOW_SELF_TARGET === "1") {
      return;
    }
    const bridgeRoot = getBridgeRoot();
    if (isSamePath(repoPath, bridgeRoot)) {
      throw new Error("Refusing to target the bridge repository itself. Set GCB_ALLOW_SELF_TARGET=1 only if you explicitly intend this.");
    }
  }

  private async writeInitialReport(state: MissionState): Promise<void> {
    const ledger = await this.store.readLedger(state.missionId, 100);
    await this.store.saveReport(state.missionId, generateReport({ state, ledger }));
  }

  private statusPayload(state: MissionState, extra?: Record<string, unknown>): Record<string, unknown> {
    return {
      ...this.store.toSummary(state),
      completedSteps: this.completedSteps(state),
      currentLoop: state.currentLoop,
      branch: state.branch,
      lastCheckpoint: state.lastCodexOutputPath,
      lastValidation: state.lastValidation,
      pauseReason: state.pauseReason,
      blockReason: state.blockReason,
      nextRecommendedAction: state.nextAction,
      missionDir: this.store.getMissionPaths(state.missionId).missionDir,
      ...extra
    };
  }

  private completedSteps(state: MissionState): string[] {
    const steps: string[] = ["mission_created"];
    if (state.branch) {
      steps.push("branch_assigned");
    }
    if (state.currentLoop > 0) {
      steps.push("codex_started");
    }
    if (state.lastValidation.status !== "not_run") {
      steps.push("validation_ran");
    }
    if (state.status === "completed") {
      steps.push("completed");
    }
    return steps;
  }
}

function validateStartMissionInput(input: StartMissionInput): Required<Pick<StartMissionInput, "goal" | "repoPath" | "maxLoops" | "autoContinue" | "allowEnvRead">> &
  Pick<StartMissionInput, "testCommand" | "lintCommand"> {
  const goal = input.goal?.trim();
  const repoPath = input.repoPath?.trim();
  if (!goal) {
    throw new Error("start_mission requires a non-empty goal.");
  }
  if (!repoPath) {
    throw new Error("start_mission requires a non-empty repoPath.");
  }
  const maxLoops = input.maxLoops ?? 12;
  if (!Number.isInteger(maxLoops) || maxLoops < 1 || maxLoops > 100) {
    throw new Error("start_mission maxLoops must be an integer from 1 to 100.");
  }
  return {
    goal,
    repoPath,
    maxLoops,
    autoContinue: input.autoContinue ?? true,
    allowEnvRead: input.allowEnvRead ?? false,
    testCommand: trimOptional(input.testCommand),
    lintCommand: trimOptional(input.lintCommand)
  };
}

function validateContinueMissionInput(input: ContinueMissionInput): ContinueMissionInput {
  return {
    missionId: trimOptional(input.missionId),
    repoPath: trimOptional(input.repoPath)
  };
}

function trimOptional(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}
