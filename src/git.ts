import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { runArgvToLog } from "./processUtils.js";

export async function runGit(repoPath: string, args: string[]): Promise<{ exitCode: number; output: string }> {
  const logPath = path.join(os.tmpdir(), `gcb-git-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}.log`);
  const result = await runArgvToLog({
    executable: "git",
    args,
    cwd: repoPath,
    logPath,
    displayCommand: `git ${args.join(" ")}`
  });
  return { exitCode: result.exitCode, output: result.output };
}

export async function assertGitRepo(repoPath: string): Promise<string> {
  const result = await runGit(repoPath, ["rev-parse", "--show-toplevel"]);
  if (result.exitCode !== 0) {
    throw new Error(`Path is not a git repository: ${repoPath}`);
  }
  return path.resolve(result.output.trim().split(/\r?\n/).at(-1) ?? repoPath);
}

export async function getCurrentBranch(repoPath: string): Promise<string | undefined> {
  const result = await runGit(repoPath, ["branch", "--show-current"]);
  if (result.exitCode !== 0) {
    return undefined;
  }
  const branch = result.output.trim().split(/\r?\n/).at(-1)?.trim();
  return branch || undefined;
}

export async function getHeadCommit(repoPath: string): Promise<string | undefined> {
  const result = await runGit(repoPath, ["rev-parse", "HEAD"]);
  if (result.exitCode !== 0) {
    return undefined;
  }
  return result.output.trim().split(/\r?\n/).at(-1)?.trim();
}

export async function getPorcelainStatus(repoPath: string): Promise<string[]> {
  const result = await runGit(repoPath, ["status", "--porcelain"]);
  if (result.exitCode !== 0) {
    throw new Error(`Unable to read git status: ${result.output}`);
  }
  return result.output
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter(Boolean);
}

export async function isDirtyWorktree(repoPath: string): Promise<boolean> {
  const lines = await getPorcelainStatus(repoPath);
  return lines.length > 0;
}

export async function createOrSwitchBranch(repoPath: string, branch: string): Promise<void> {
  const exists = await runGit(repoPath, ["rev-parse", "--verify", branch]);
  const args = exists.exitCode === 0 ? ["switch", branch] : ["switch", "-c", branch];
  const result = await runGit(repoPath, args);
  if (result.exitCode !== 0) {
    throw new Error(`Unable to switch to branch ${branch}: ${result.output}`);
  }
}

export async function getChangedFiles(repoPath: string): Promise<{ statusLines: string[]; files: string[] }> {
  const statusLines = await getPorcelainStatus(repoPath);
  const files = statusLines.map((line) => line.slice(3).trim()).filter(Boolean);
  return { statusLines, files };
}

export async function getDiff(repoPath: string, options?: { stat?: boolean; unified?: number }): Promise<string> {
  const args = ["diff"];
  if (options?.stat) {
    args.push("--stat");
  }
  if (typeof options?.unified === "number") {
    args.push(`--unified=${options.unified}`);
  }
  const result = await runGit(repoPath, args);
  return result.output;
}

export async function ensureDirectoryExists(inputPath: string): Promise<void> {
  const stat = await fs.promises.stat(inputPath).catch(() => undefined);
  if (!stat?.isDirectory()) {
    throw new Error(`Directory does not exist: ${inputPath}`);
  }
}
