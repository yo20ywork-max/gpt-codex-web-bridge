export type MissionStatus = "queued" | "running" | "paused" | "blocked" | "completed" | "failed";

export type ValidationStatus = "not_run" | "passed" | "failed";

export type CodexMode = "real" | "mock";

export type LedgerEventType =
  | "mission_started"
  | "codex_started"
  | "codex_finished"
  | "validation_started"
  | "validation_finished"
  | "checkpoint"
  | "paused"
  | "resumed"
  | "blocked"
  | "completed"
  | "failed"
  | "rate_limit_detected";

export interface ValidationResult {
  status: ValidationStatus;
  command?: string;
  exitCode?: number;
  logPath?: string;
  summary?: string;
}

export interface MissionState {
  missionId: string;
  goal: string;
  repoPath: string;
  branch?: string;
  status: MissionStatus;
  codexMode?: CodexMode;
  createdAt: string;
  updatedAt: string;
  maxLoops: number;
  currentLoop: number;
  testCommand?: string;
  lintCommand?: string;
  allowEnvRead: boolean;
  autoContinue: boolean;
  requireRealCodex?: boolean;
  hasCodexRun: boolean;
  verificationPauseConsumed?: boolean;
  codexSessionId?: string;
  lastGoodCommit?: string;
  lastCodexOutputPath?: string;
  lastValidation: ValidationResult;
  pauseReason?: string;
  blockReason?: string;
  nextAction?: string;
}

export interface LedgerEvent {
  ts: string;
  type: LedgerEventType;
  message: string;
  data?: Record<string, unknown>;
}

export interface StartMissionInput {
  goal: string;
  repoPath: string;
  testCommand?: string;
  lintCommand?: string;
  maxLoops?: number;
  autoContinue?: boolean;
  allowEnvRead?: boolean;
  requireRealCodex?: boolean;
}

export interface ContinueMissionInput {
  missionId?: string;
  repoPath?: string;
}

export interface MissionPaths {
  missionDir: string;
  statePath: string;
  ledgerPath: string;
  reportPath: string;
  validationDir: string;
  codexDir: string;
}

export interface MissionSummary {
  missionId: string;
  goal: string;
  repoPath: string;
  branch?: string;
  status: MissionStatus;
  codexMode?: CodexMode;
  updatedAt: string;
  currentLoop: number;
  maxLoops: number;
  pauseReason?: string;
  blockReason?: string;
  nextAction?: string;
}

export interface GitChangeSummary {
  changedFiles: string[];
  statusLines: string[];
  dependencyFiles: string[];
  highRiskFiles: string[];
  forbiddenFiles: string[];
  deletedTestFiles: string[];
  weakenedTestSignals: string[];
  authPaymentPermissionFiles: string[];
  diffSummary: string;
}

export interface SafetyAssessment {
  blocked: boolean;
  riskFlags: string[];
  forbiddenFiles: string[];
  dependencyFiles: string[];
  highRiskFiles: string[];
  message: string;
}

export interface CodexRunOptions {
  mission: MissionState;
  prompt: string;
  resume: boolean;
}

export interface CodexRunResult {
  exitCode: number;
  stdoutPath: string;
  stderrPath: string;
  combinedOutputPath: string;
  combinedOutput: string;
  rateLimitDetected: boolean;
  sessionId?: string;
}

export interface CommandResult {
  command: string;
  exitCode: number;
  logPath: string;
  output: string;
}
