import { describe, expect, it } from "vitest";
import { generateReport } from "../src/report.js";
import type { MissionState } from "../src/types.js";

describe("report generator", () => {
  it("includes validation and next action", () => {
    const state: MissionState = {
      missionId: "m_report",
      goal: "Ship feature",
      repoPath: "/tmp/repo",
      branch: "gcb/m_report",
      status: "blocked",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      maxLoops: 12,
      currentLoop: 3,
      allowEnvRead: false,
      autoContinue: true,
      lastValidation: {
        status: "failed",
        command: "npm test",
        exitCode: 1,
        summary: "one test failed"
      },
      nextAction: "Fix the failing test."
    };

    const report = generateReport({ state, ledger: [] });
    expect(report).toContain("## Validation");
    expect(report).toContain("npm test");
    expect(report).toContain("Fix the failing test.");
    expect(report).toContain("gcb continue m_report");
  });
});
