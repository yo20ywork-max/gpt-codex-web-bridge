import { randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { getMissionsRoot, getStorageRoot, nowIso } from "./paths.js";
import type { LedgerEvent, LedgerEventType, MissionPaths, MissionState, MissionStatus, MissionSummary } from "./types.js";

export class MissionStore {
  readonly storageRoot: string;

  constructor(storageRoot = getStorageRoot()) {
    this.storageRoot = path.resolve(storageRoot);
  }

  async init(): Promise<void> {
    await fs.promises.mkdir(this.missionsRoot, { recursive: true });
  }

  get missionsRoot(): string {
    return getMissionsRoot(this.storageRoot);
  }

  createMissionId(): string {
    return `m_${Date.now().toString(36)}_${randomBytes(4).toString("hex")}`;
  }

  getMissionPaths(missionId: string): MissionPaths {
    const missionDir = path.join(this.missionsRoot, missionId);
    return {
      missionDir,
      statePath: path.join(missionDir, "state.json"),
      ledgerPath: path.join(missionDir, "ledger.jsonl"),
      reportPath: path.join(missionDir, "report.md"),
      validationDir: path.join(missionDir, "validation"),
      codexDir: path.join(missionDir, "codex")
    };
  }

  async createMission(state: MissionState): Promise<MissionState> {
    await this.init();
    const paths = this.getMissionPaths(state.missionId);
    await fs.promises.mkdir(paths.validationDir, { recursive: true });
    await fs.promises.mkdir(paths.codexDir, { recursive: true });
    const saved = await this.saveState(state);
    await fs.promises.writeFile(paths.ledgerPath, "", "utf8");
    await fs.promises.writeFile(paths.reportPath, "", "utf8");
    return saved;
  }

  async getMission(missionId: string): Promise<MissionState> {
    const paths = this.getMissionPaths(missionId);
    const text = await fs.promises.readFile(paths.statePath, "utf8");
    return JSON.parse(text) as MissionState;
  }

  async tryGetMission(missionId: string): Promise<MissionState | undefined> {
    try {
      return await this.getMission(missionId);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return undefined;
      }
      throw error;
    }
  }

  async saveState(state: MissionState): Promise<MissionState> {
    const paths = this.getMissionPaths(state.missionId);
    await fs.promises.mkdir(paths.missionDir, { recursive: true });
    const updated: MissionState = { ...state, updatedAt: nowIso() };
    const tempPath = `${paths.statePath}.${process.pid}.tmp`;
    await fs.promises.writeFile(tempPath, `${JSON.stringify(updated, null, 2)}\n`, "utf8");
    await fs.promises.rename(tempPath, paths.statePath);
    return updated;
  }

  async patchState(missionId: string, patch: Partial<MissionState>): Promise<MissionState> {
    const current = await this.getMission(missionId);
    const next: MissionState = { ...current, ...patch, updatedAt: nowIso() };
    return await this.saveState(next);
  }

  async appendLedger(
    missionId: string,
    type: LedgerEventType,
    message: string,
    data?: Record<string, unknown>
  ): Promise<LedgerEvent> {
    const event: LedgerEvent = {
      ts: nowIso(),
      type,
      message,
      ...(data ? { data } : {})
    };
    const paths = this.getMissionPaths(missionId);
    await fs.promises.mkdir(paths.missionDir, { recursive: true });
    await fs.promises.appendFile(paths.ledgerPath, `${JSON.stringify(event)}\n`, "utf8");
    return event;
  }

  async readLedger(missionId: string, limit?: number): Promise<LedgerEvent[]> {
    const paths = this.getMissionPaths(missionId);
    try {
      const text = await fs.promises.readFile(paths.ledgerPath, "utf8");
      const events = text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => JSON.parse(line) as LedgerEvent);
      return typeof limit === "number" && limit > 0 ? events.slice(-limit) : events;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return [];
      }
      throw error;
    }
  }

  async saveReport(missionId: string, markdown: string): Promise<void> {
    const paths = this.getMissionPaths(missionId);
    await fs.promises.mkdir(paths.missionDir, { recursive: true });
    await fs.promises.writeFile(paths.reportPath, markdown.endsWith("\n") ? markdown : `${markdown}\n`, "utf8");
  }

  async readReport(missionId: string): Promise<string> {
    const paths = this.getMissionPaths(missionId);
    try {
      return await fs.promises.readFile(paths.reportPath, "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return "";
      }
      throw error;
    }
  }

  async listMissions(limit = 10): Promise<MissionState[]> {
    await this.init();
    const entries = await fs.promises.readdir(this.missionsRoot, { withFileTypes: true });
    const states: MissionState[] = [];
    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }
      const state = await this.tryGetMission(entry.name);
      if (state) {
        states.push(state);
      }
    }
    states.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
    return states.slice(0, Math.max(0, limit));
  }

  async findLatestMission(options?: { statuses?: MissionStatus[]; repoPath?: string }): Promise<MissionState | undefined> {
    const states = await this.listMissions(1000);
    return states.find((state) => {
      if (options?.statuses && !options.statuses.includes(state.status)) {
        return false;
      }
      if (options?.repoPath && path.resolve(options.repoPath) !== path.resolve(state.repoPath)) {
        return false;
      }
      return true;
    });
  }

  toSummary(state: MissionState): MissionSummary {
    return {
      missionId: state.missionId,
      goal: state.goal,
      repoPath: state.repoPath,
      branch: state.branch,
      status: state.status,
      updatedAt: state.updatedAt,
      currentLoop: state.currentLoop,
      maxLoops: state.maxLoops,
      pauseReason: state.pauseReason,
      blockReason: state.blockReason,
      nextAction: state.nextAction
    };
  }
}
