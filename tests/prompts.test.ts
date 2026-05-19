import { describe, expect, it } from "vitest";
import { createInitialCodexPrompt } from "../src/prompts.js";
import type { MissionState } from "../src/types.js";

describe("prompt builders", () => {
  it("includes mission goal and safety rules", () => {
    const state: MissionState = {
      missionId: "m_prompt",
      goal: "Implement Google OAuth",
      repoPath: "/tmp/repo",
      branch: "gcb/m_prompt",
      status: "queued",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      maxLoops: 12,
      currentLoop: 0,
      testCommand: "npm test",
      allowEnvRead: false,
      autoContinue: true,
      hasCodexRun: false,
      lastValidation: { status: "not_run" }
    };

    const prompt = createInitialCodexPrompt(state);
    expect(prompt).toContain("Implement Google OAuth");
    expect(prompt).toContain("Safety rules:");
    expect(prompt).toContain("Do not read .env");
    expect(prompt).toContain("npm test");
  });
});
