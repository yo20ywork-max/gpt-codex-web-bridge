import { describe, expect, it } from "vitest";
import { MissionStore } from "../src/missionStore.js";
import type { MissionState } from "../src/types.js";
import { cleanupTempDir, createTempDir } from "./helpers.js";

describe("MissionStore", () => {
  it("creates, updates, and lists missions", async () => {
    const root = await createTempDir("gcb-store-");
    try {
      const store = new MissionStore(root);
      const now = new Date().toISOString();
      const state: MissionState = {
        missionId: "m_test",
        goal: "test goal",
        repoPath: root,
        branch: "gcb/m_test",
        status: "queued",
        createdAt: now,
        updatedAt: now,
        maxLoops: 12,
        currentLoop: 0,
        allowEnvRead: false,
        autoContinue: true,
        hasCodexRun: false,
        lastValidation: { status: "not_run" }
      };

      await store.createMission(state);
      const updated = await store.patchState("m_test", { status: "paused", pauseReason: "rate_limit_or_quota" });
      await store.appendLedger("m_test", "paused", "paused for test");
      const listed = await store.listMissions();
      const ledger = await store.readLedger("m_test");

      expect(updated.status).toBe("paused");
      expect(listed).toHaveLength(1);
      expect(listed[0].missionId).toBe("m_test");
      expect(ledger[0].type).toBe("paused");
    } finally {
      await cleanupTempDir(root);
    }
  });

  it("finds the latest paused mission", async () => {
    const root = await createTempDir("gcb-store-paused-");
    try {
      const store = new MissionStore(root);
      const base = new Date().toISOString();
      for (const id of ["older", "newer"]) {
        await store.createMission({
          missionId: id,
          goal: id,
          repoPath: root,
          status: "paused",
          createdAt: base,
          updatedAt: base,
          maxLoops: 12,
          currentLoop: 0,
          allowEnvRead: false,
          autoContinue: true,
          hasCodexRun: false,
          lastValidation: { status: "not_run" }
        });
        await new Promise((resolve) => setTimeout(resolve, 5));
      }

      const latest = await store.findLatestMission({ statuses: ["paused"] });
      expect(latest?.missionId).toBe("newer");
    } finally {
      await cleanupTempDir(root);
    }
  });
});
