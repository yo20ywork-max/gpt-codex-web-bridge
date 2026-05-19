import { afterEach, describe, expect, it } from "vitest";
import { MissionService } from "../src/missionService.js";
import { cleanupTempDir, createGitRepo } from "./helpers.js";

const originalMockCodex = process.env.GCB_MOCK_CODEX;
const originalMockScenario = process.env.GCB_MOCK_SCENARIO;

afterEach(() => {
  process.env.GCB_MOCK_CODEX = originalMockCodex;
  process.env.GCB_MOCK_SCENARIO = originalMockScenario;
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
});
