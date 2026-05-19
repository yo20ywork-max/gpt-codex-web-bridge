import type { ChildProcess } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import spawn from "cross-spawn";
import { commandForPlatform } from "./processUtils.js";
import type { CodexRunOptions, CodexRunResult, MissionState } from "./types.js";

const RATE_LIMIT_PATTERNS = [
  /rate limit/i,
  /quota/i,
  /usage limit/i,
  /429/,
  /too many requests/i,
  /temporarily unavailable/i,
  /limit reached/i
];

export class CodexRunner {
  private readonly activeProcesses = new Map<string, ChildProcess>();
  private readonly mockRunCounts = new Map<string, number>();

  static detectRateLimit(output: string): boolean {
    return RATE_LIMIT_PATTERNS.some((pattern) => pattern.test(output));
  }

  async run(options: CodexRunOptions, codexDir: string): Promise<CodexRunResult> {
    await fs.promises.mkdir(codexDir, { recursive: true });

    if (process.env.GCB_MOCK_CODEX === "1") {
      return await this.runMock(options, codexDir);
    }

    const args = buildCodexArgs(options.mission, options.prompt, options.resume);
    const candidates = await this.getCodexCandidates(options.mission.repoPath);
    let finalResult: CodexRunResult | undefined;

    for (const [index, candidate] of candidates.entries()) {
      const primaryPaths = makeLogPaths(codexDir, `${Date.now()}-${index + 1}`);
      const result = await this.spawnCodex({
        missionId: options.mission.missionId,
        executable: candidate.executable,
        args: candidate.argsPrefix.concat(args),
        cwd: options.mission.repoPath,
        stdoutPath: primaryPaths.stdoutPath,
        stderrPath: primaryPaths.stderrPath,
        combinedOutputPath: primaryPaths.combinedOutputPath
      });
      finalResult = result;
      if (result.exitCode !== 127) {
        if (options.resume && result.exitCode !== 0 && !result.rateLimitDetected) {
          const fallbackPaths = makeLogPaths(codexDir, `${Date.now()}-${index + 1}-resume-fallback`);
          const fallback = await this.spawnCodex({
            missionId: options.mission.missionId,
            executable: candidate.executable,
            args: candidate.argsPrefix.concat(["exec", options.prompt]),
            cwd: options.mission.repoPath,
            stdoutPath: fallbackPaths.stdoutPath,
            stderrPath: fallbackPaths.stderrPath,
            combinedOutputPath: fallbackPaths.combinedOutputPath
          });
          finalResult = fallback.exitCode === 127 ? result : fallback;
        }
        break;
      }
    }

    if (!finalResult) {
      throw new Error("No Codex runner candidate was attempted.");
    }

    return finalResult;
  }

  terminate(missionId: string): boolean {
    const child = this.activeProcesses.get(missionId);
    if (!child) {
      return false;
    }
    child.kill("SIGTERM");
    return true;
  }

  private async getCodexCandidates(repoPath: string): Promise<Array<{ executable: string; argsPrefix: string[] }>> {
    const localCodex = path.join(repoPath, "node_modules", ".bin", process.platform === "win32" ? "codex.cmd" : "codex");
    const bridgeCodex = path.join(process.cwd(), "node_modules", ".bin", process.platform === "win32" ? "codex.cmd" : "codex");
    const candidates: Array<{ executable: string; argsPrefix: string[] }> = [];

    if (await exists(localCodex)) {
      candidates.push({ executable: localCodex, argsPrefix: [] });
    }
    if (await exists(bridgeCodex)) {
      candidates.push({ executable: bridgeCodex, argsPrefix: [] });
    }
    candidates.push({ executable: commandForPlatform("codex"), argsPrefix: [] });
    candidates.push({ executable: commandForPlatform("npx"), argsPrefix: ["-y", "codex"] });

    return candidates;
  }

  private async spawnCodex(options: {
    missionId: string;
    executable: string;
    args: string[];
    cwd: string;
    stdoutPath: string;
    stderrPath: string;
    combinedOutputPath: string;
  }): Promise<CodexRunResult> {
    await fs.promises.mkdir(path.dirname(options.stdoutPath), { recursive: true });

    return await new Promise<CodexRunResult>((resolve) => {
      const stdout = fs.createWriteStream(options.stdoutPath, { flags: "w" });
      const stderr = fs.createWriteStream(options.stderrPath, { flags: "w" });
      const combined = fs.createWriteStream(options.combinedOutputPath, { flags: "w" });
      let combinedOutput = "";
      let settled = false;

      const finish = (exitCode: number): void => {
        if (settled) {
          return;
        }
        settled = true;
        this.activeProcesses.delete(options.missionId);
        stdout.end();
        stderr.end();
        combined.end();
        const sessionId = detectSessionId(combinedOutput);
        resolve({
          exitCode,
          stdoutPath: options.stdoutPath,
          stderrPath: options.stderrPath,
          combinedOutputPath: options.combinedOutputPath,
          combinedOutput,
          rateLimitDetected: CodexRunner.detectRateLimit(combinedOutput),
          ...(sessionId ? { sessionId } : {})
        });
      };

      let child: ChildProcess;
      try {
        child = spawn(options.executable, options.args, {
          cwd: options.cwd,
          env: process.env,
          stdio: ["ignore", "pipe", "pipe"],
          windowsHide: true
        });
      } catch (error) {
        const text = `[codex process error] ${(error as Error).message}\n`;
        combinedOutput += text;
        stderr.write(text);
        combined.write(text);
        finish((error as NodeJS.ErrnoException).code === "ENOENT" ? 127 : 1);
        return;
      }

      this.activeProcesses.set(options.missionId, child);

      child.stdout?.on("data", (chunk: Buffer) => {
        const text = chunk.toString("utf8");
        combinedOutput += text;
        stdout.write(text);
        combined.write(text);
      });
      child.stderr?.on("data", (chunk: Buffer) => {
        const text = chunk.toString("utf8");
        combinedOutput += text;
        stderr.write(text);
        combined.write(text);
      });
      child.on("error", (error: NodeJS.ErrnoException) => {
        const text = `[codex process error] ${error.message}\n`;
        combinedOutput += text;
        stderr.write(text);
        combined.write(text);
        finish(error.code === "ENOENT" ? 127 : 1);
      });
      child.on("close", (code) => {
        finish(code ?? 1);
      });
    });
  }

  private async runMock(options: CodexRunOptions, codexDir: string): Promise<CodexRunResult> {
    const count = (this.mockRunCounts.get(options.mission.missionId) ?? 0) + 1;
    this.mockRunCounts.set(options.mission.missionId, count);

    const timestamp = Date.now();
    const stdoutPath = path.join(codexDir, `${timestamp}-mock-stdout.log`);
    const stderrPath = path.join(codexDir, `${timestamp}-mock-stderr.log`);
    const combinedOutputPath = path.join(codexDir, `${timestamp}-mock-combined.log`);
    const scenario = process.env.GCB_MOCK_SCENARIO ?? "success";

    let output = "";
    let exitCode = 0;

    if (scenario === "rate_limit") {
      output = "Mock Codex: usage limit reached. Please resume later.\n";
      exitCode = 1;
    } else if (scenario === "validation_fail_then_success") {
      const status = count === 1 ? "fail" : "pass";
      await fs.promises.writeFile(path.join(options.mission.repoPath, "gcb-mock-status.txt"), `${status}\n`, "utf8");
      output = `Mock Codex run ${count}: wrote gcb-mock-status.txt=${status}.\n`;
    } else {
      await fs.promises.writeFile(path.join(options.mission.repoPath, "gcb-mock-status.txt"), "pass\n", "utf8");
      output = "Mock Codex: success.\n";
    }

    await fs.promises.writeFile(stdoutPath, output, "utf8");
    await fs.promises.writeFile(stderrPath, "", "utf8");
    await fs.promises.writeFile(combinedOutputPath, output, "utf8");

    return {
      exitCode,
      stdoutPath,
      stderrPath,
      combinedOutputPath,
      combinedOutput: output,
      rateLimitDetected: CodexRunner.detectRateLimit(output),
      sessionId: `mock-${options.mission.missionId}`
    };
  }
}

function makeLogPaths(codexDir: string, stem: string): { stdoutPath: string; stderrPath: string; combinedOutputPath: string } {
  return {
    stdoutPath: path.join(codexDir, `${stem}-stdout.log`),
    stderrPath: path.join(codexDir, `${stem}-stderr.log`),
    combinedOutputPath: path.join(codexDir, `${stem}-combined.log`)
  };
}

function buildCodexArgs(state: MissionState, prompt: string, resume: boolean): string[] {
  if (!resume) {
    return ["exec", prompt];
  }
  if (state.codexSessionId) {
    return ["exec", "resume", state.codexSessionId, prompt];
  }
  return ["exec", "resume", "--last", prompt];
}

function detectSessionId(output: string): string | undefined {
  const match = output.match(/(?:session|conversation|resume)[^\n:]*[:\s]+([A-Za-z0-9_-]{8,})/i);
  return match?.[1];
}

async function exists(inputPath: string): Promise<boolean> {
  return await fs.promises
    .access(inputPath)
    .then(() => true)
    .catch(() => false);
}
