import { describe, expect, it } from "vitest";
import { buildCodexArgs, CodexRunner } from "../src/codexRunner.js";
import type { MissionState } from "../src/types.js";

describe("CodexRunner", () => {
  it("detects rate limit and quota output", () => {
    expect(CodexRunner.detectRateLimit("429 too many requests")).toBe(true);
    expect(CodexRunner.detectRateLimit("Usage limit reached")).toBe(true);
    expect(CodexRunner.detectRateLimit("node_modules/vitest/dist/chunks/cli-api.js:3429: active task")).toBe(false);
    expect(CodexRunner.detectRateLimit("all good")).toBe(false);
  });

  it("builds native resume --last args when resume is requested without a session id", () => {
    const state: MissionState = {
      missionId: "m_args",
      goal: "test args",
      repoPath: "/tmp/repo",
      status: "running",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      maxLoops: 2,
      currentLoop: 1,
      allowEnvRead: false,
      autoContinue: true,
      hasCodexRun: true,
      lastValidation: { status: "failed" }
    };

    expect(buildCodexArgs(state, "repair prompt", true)).toEqual(["exec", "resume", "--last", "repair prompt"]);
  });
});
