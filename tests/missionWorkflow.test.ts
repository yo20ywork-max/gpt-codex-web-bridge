import { afterEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { CodexRunner } from "../src/codexRunner.js";
import { MissionService } from "../src/missionService.js";
import { MissionStore } from "../src/missionStore.js";
import type { CodexRunOptions, CodexRunResult } from "../src/types.js";
import { MissionWorker, MissionWorkerManager } from "../src/worker.js";
import { cleanupTempDir, createGitRepo } from "./helpers.js";

const originalMockCodex = process.env.GCB_MOCK_CODEX;
const originalMockScenario = process.env.GCB_MOCK_SCENARIO;
const originalVerifyPauseAfterCodex = process.env.GCB_VERIFY_PAUSE_AFTER_CODEX;

afterEach(() => {
  restoreEnv("GCB_MOCK_CODEX", originalMockCodex);
  restoreEnv("GCB_MOCK_SCENARIO", originalMockScenario);
  restoreEnv("GCB_VERIFY_PAUSE_AFTER_CODEX", originalVerifyPauseAfterCodex);
});

describe("mock mission workflow", () => {
  it("completes a mock Codex success mission", async () => {
    const fixture = await createGitRepo();
    try {
      process.env.GCB_MOCK_CODEX = "1";
      process.env.GCB_MOCK_SCENARIO = "success";
      const service = MissionService.create(fixture.storagePath);
      const start = await service.startMission({
        repoPath: fixture.repoPath,
        goal: "Mock success",
        testCommand: "npm test",
        maxLoops: 2
      });
      const missionId = String(start.missionId);
      await service.waitForMission(missionId);

      const status = await service.getMissionStatus(missionId);
      expect(status.status).toBe("completed");
      expect(status.lastValidation).toMatchObject({ status: "passed" });
    } finally {
      await cleanupTempDir(fixture.root);
    }
  });

  it("repairs a validation failure in a later loop", async () => {
    const fixture = await createGitRepo({
      packageJson: {
        scripts: {
          test: "node -e \"const fs=require('fs'); process.exit(fs.readFileSync('gcb-mock-status.txt','utf8').trim()==='pass'?0:1)\""
        }
      },
      files: {
        "gcb-mock-status.txt": "fail\n"
      }
    });
    try {
      process.env.GCB_MOCK_CODEX = "1";
      process.env.GCB_MOCK_SCENARIO = "validation_fail_then_success";
      const service = MissionService.create(fixture.storagePath);
      const start = await service.startMission({
        repoPath: fixture.repoPath,
        goal: "Mock validation repair",
        testCommand: "npm test",
        maxLoops: 4
      });
      const missionId = String(start.missionId);
      await service.waitForMission(missionId);

      const status = await service.getMissionStatus(missionId);
      const report = await service.getMissionReport(missionId);
      expect(status.status).toBe("completed");
      expect(status.currentLoop).toBe(2);
      expect(String(report.markdown)).toContain("Loop count: 2/4");
    } finally {
      await cleanupTempDir(fixture.root);
    }
  });

  it("pauses when mock Codex reports a rate limit", async () => {
    const fixture = await createGitRepo();
    try {
      process.env.GCB_MOCK_CODEX = "1";
      process.env.GCB_MOCK_SCENARIO = "rate_limit";
      const service = MissionService.create(fixture.storagePath);
      const start = await service.startMission({
        repoPath: fixture.repoPath,
        goal: "Mock rate limit",
        testCommand: "npm test",
        maxLoops: 2
      });
      const missionId = String(start.missionId);
      await service.waitForMission(missionId);

      const status = await service.getMissionStatus(missionId);
      expect(status.status).toBe("paused");
      expect(status.pauseReason).toBe("rate_limit_or_quota");
    } finally {
      await cleanupTempDir(fixture.root);
    }
  });

  it("continues the latest paused mission when missionId is omitted", async () => {
    const fixture = await createGitRepo();
    try {
      process.env.GCB_MOCK_CODEX = "1";
      process.env.GCB_MOCK_SCENARIO = "rate_limit";
      const service = MissionService.create(fixture.storagePath);
      const start = await service.startMission({
        repoPath: fixture.repoPath,
        goal: "Pause then resume",
        testCommand: "npm test",
        maxLoops: 3
      });
      const missionId = String(start.missionId);
      await service.waitForMission(missionId);

      const paused = await service.getMissionStatus(missionId);
      expect(paused.status).toBe("paused");
      expect(paused.pauseReason).toBe("rate_limit_or_quota");

      process.env.GCB_MOCK_SCENARIO = "success";
      const continued = await service.continueMission({});
      expect(continued.missionId).toBe(missionId);
      await service.waitForMission(missionId);

      const status = await service.getMissionStatus(missionId);
      expect(status.status).toBe("completed");
      expect(status.currentLoop).toBe(2);
    } finally {
      await cleanupTempDir(fixture.root);
    }
  });

  it("resumes a mock rate-limit pause through the service layer without missionId", async () => {
    const fixture = await createGitRepo();
    try {
      process.env.GCB_MOCK_CODEX = "1";
      process.env.GCB_MOCK_SCENARIO = "rate_limit_then_success";
      const service = MissionService.create(fixture.storagePath);
      const start = await service.startMission({
        repoPath: fixture.repoPath,
        goal: "ChatGPT Web continue_mission mock pause/resume",
        testCommand: "npm test",
        maxLoops: 4,
        allowEnvRead: false,
        autoContinue: true
      });
      const missionId = String(start.missionId);
      await service.waitForMission(missionId);

      const paused = await service.getMissionStatus(missionId);
      expect(paused.status).toBe("paused");
      expect(paused.pauseReason).toBe("rate_limit_or_quota");
      expect(paused.currentLoop).toBe(1);
      expect(paused.lastValidation).toMatchObject({ status: "not_run" });

      const continued = await service.continueMission({});
      expect(continued.missionId).toBe(missionId);
      expect(continued.workerStarted).toBe(true);
      await service.waitForMission(missionId);

      const completed = await service.getMissionStatus(missionId);
      expect(completed.status).toBe("completed");
      expect(completed.currentLoop).toBe(2);
      expect(completed.lastValidation).toMatchObject({ status: "passed" });
      expect(completed.nextRecommendedAction).toBe("Review the branch and merge manually when satisfied.");
    } finally {
      await cleanupTempDir(fixture.root);
    }
  });

  it("requests native resume for a repair loop even when no session id was parsed", async () => {
    const fixture = await createGitRepo({
      packageJson: {
        scripts: {
          test: "node -e \"const fs=require('fs'); process.exit(fs.readFileSync('gcb-mock-status.txt','utf8').trim()==='pass'?0:1)\""
        }
      },
      files: {
        "gcb-mock-status.txt": "fail\n"
      }
    });
    try {
      const store = new MissionStore(fixture.storagePath);
      const runner = new NoSessionRepairRunner();
      const worker = new MissionWorker(store, runner);
      const manager = new MissionWorkerManager(worker);
      const service = new MissionService(store, runner, manager);

      const start = await service.startMission({
        repoPath: fixture.repoPath,
        goal: "Repair without a parsed Codex session id",
        testCommand: "npm test",
        maxLoops: 4
      });
      const missionId = String(start.missionId);
      await service.waitForMission(missionId);

      const status = await service.getMissionStatus(missionId);
      expect(status.status).toBe("completed");
      expect(runner.resumeFlags).toEqual([false, true]);
    } finally {
      await cleanupTempDir(fixture.root);
    }
  });

  it("pauses once after Codex for verification and continues with native resume requested", async () => {
    const fixture = await createGitRepo();
    try {
      delete process.env.GCB_MOCK_CODEX;
      process.env.GCB_VERIFY_PAUSE_AFTER_CODEX = "1";

      const store = new MissionStore(fixture.storagePath);
      const runner = new VerificationPauseRunner();
      const worker = new MissionWorker(store, runner);
      const manager = new MissionWorkerManager(worker);
      const service = new MissionService(store, runner, manager);

      const start = await service.startMission({
        repoPath: fixture.repoPath,
        goal: "Pause after Codex for resume verification",
        testCommand: "npm test",
        maxLoops: 3
      });
      const missionId = String(start.missionId);
      await service.waitForMission(missionId);

      const pausedStatus = await service.getMissionStatus(missionId);
      const pausedState = await store.getMission(missionId);
      const pausedLedger = await store.readLedger(missionId);
      expect(pausedStatus.status).toBe("paused");
      expect(pausedStatus.pauseReason).toBe("verification_pause_after_codex");
      expect(pausedStatus.lastValidation).toMatchObject({ status: "not_run" });
      expect(pausedState.hasCodexRun).toBe(true);
      expect(pausedState.verificationPauseConsumed).toBe(true);
      expect(pausedState.codexSessionId).toBeUndefined();
      expect(pausedLedger.some((event) => event.type === "paused" && event.message.includes("Verification pause"))).toBe(true);

      const continued = await service.continueMission({ missionId });
      expect(continued.missionId).toBe(missionId);
      await service.waitForMission(missionId);

      const completedStatus = await service.getMissionStatus(missionId);
      expect(completedStatus.status).toBe("completed");
      expect(completedStatus.lastValidation).toMatchObject({ status: "passed" });
      expect(runner.resumeFlags).toEqual([false, true]);
    } finally {
      await cleanupTempDir(fixture.root);
    }
  });
});

class NoSessionRepairRunner extends CodexRunner {
  readonly resumeFlags: boolean[] = [];
  private count = 0;

  override async run(options: CodexRunOptions, codexDir: string): Promise<CodexRunResult> {
    this.count += 1;
    this.resumeFlags.push(options.resume);
    await fs.promises.mkdir(codexDir, { recursive: true });
    const status = this.count === 1 ? "fail" : "pass";
    await fs.promises.writeFile(path.join(options.mission.repoPath, "gcb-mock-status.txt"), `${status}\n`, "utf8");
    const output = `No-session Codex mock wrote ${status}.\n`;
    const stem = path.join(codexDir, `${Date.now()}-no-session`);
    const stdoutPath = `${stem}-stdout.log`;
    const stderrPath = `${stem}-stderr.log`;
    const combinedOutputPath = `${stem}-combined.log`;
    await fs.promises.writeFile(stdoutPath, output, "utf8");
    await fs.promises.writeFile(stderrPath, "", "utf8");
    await fs.promises.writeFile(combinedOutputPath, output, "utf8");

    return {
      exitCode: 0,
      stdoutPath,
      stderrPath,
      combinedOutputPath,
      combinedOutput: output,
      rateLimitDetected: false
    };
  }
}

function restoreEnv(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
    return;
  }
  process.env[name] = value;
}

class VerificationPauseRunner extends CodexRunner {
  readonly resumeFlags: boolean[] = [];
  private count = 0;

  override async run(options: CodexRunOptions, codexDir: string): Promise<CodexRunResult> {
    this.count += 1;
    this.resumeFlags.push(options.resume);
    await fs.promises.mkdir(codexDir, { recursive: true });
    await fs.promises.writeFile(path.join(options.mission.repoPath, "verification-resume.txt"), `run ${this.count}\n`, "utf8");
    const output = `Verification pause runner completed run ${this.count}.\n`;
    const stem = path.join(codexDir, `${Date.now()}-verification-pause`);
    const stdoutPath = `${stem}-stdout.log`;
    const stderrPath = `${stem}-stderr.log`;
    const combinedOutputPath = `${stem}-combined.log`;
    await fs.promises.writeFile(stdoutPath, output, "utf8");
    await fs.promises.writeFile(stderrPath, "", "utf8");
    await fs.promises.writeFile(combinedOutputPath, output, "utf8");

    return {
      exitCode: 0,
      stdoutPath,
      stderrPath,
      combinedOutputPath,
      combinedOutput: output,
      rateLimitDetected: false
    };
  }
}
