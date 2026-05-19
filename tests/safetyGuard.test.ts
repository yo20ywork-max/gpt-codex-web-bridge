import { describe, expect, it } from "vitest";
import { SafetyGuard } from "../src/safetyGuard.js";

describe("SafetyGuard", () => {
  it("catches forbidden file paths", () => {
    const guard = new SafetyGuard();
    expect(guard.isForbiddenPath(".env")).toBe(true);
    expect(guard.isForbiddenPath("keys/prod.pem")).toBe(true);
    expect(guard.isForbiddenPath(".ssh/id_rsa")).toBe(true);
    expect(guard.isForbiddenPath("src/app.ts")).toBe(false);
  });
});
