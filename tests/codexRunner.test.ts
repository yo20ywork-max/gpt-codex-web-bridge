import { describe, expect, it } from "vitest";
import { CodexRunner } from "../src/codexRunner.js";

describe("CodexRunner", () => {
  it("detects rate limit and quota output", () => {
    expect(CodexRunner.detectRateLimit("429 too many requests")).toBe(true);
    expect(CodexRunner.detectRateLimit("Usage limit reached")).toBe(true);
    expect(CodexRunner.detectRateLimit("all good")).toBe(false);
  });
});
