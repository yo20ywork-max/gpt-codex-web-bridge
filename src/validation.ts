import fs from "node:fs";
import path from "node:path";
import { runCommandToLog } from "./processUtils.js";
import type { CommandResult, MissionState, ValidationResult } from "./types.js";

export async function detectValidationCommands(repoPath: string, state: MissionState): Promise<string[]> {
  const commands: string[] = [];
  if (state.testCommand) {
    commands.push(state.testCommand);
  } else {
    const detected = await detectTestCommand(repoPath);
    if (detected) {
      commands.push(detected);
    }
  }

  if (state.lintCommand) {
    commands.push(state.lintCommand);
  }

  return commands;
}

export async function runValidationCommands(
  repoPath: string,
  state: MissionState,
  validationDir: string
): Promise<{ result: ValidationResult; commandResults: CommandResult[] }> {
  const commands = await detectValidationCommands(repoPath, state);
  if (commands.length === 0) {
    return {
      result: {
        status: "not_run",
        summary: "No validation command was provided or auto-detected."
      },
      commandResults: []
    };
  }

  const commandResults: CommandResult[] = [];
  for (const [index, command] of commands.entries()) {
    const safeName = command.replace(/[^A-Za-z0-9_.-]+/g, "_").slice(0, 80);
    const logPath = path.join(validationDir, `${String(state.currentLoop).padStart(2, "0")}-${index + 1}-${safeName}.log`);
    const result = await runCommandToLog({ command, cwd: repoPath, logPath });
    commandResults.push(result);
    if (result.exitCode !== 0) {
      return {
        result: {
          status: "failed",
          command,
          exitCode: result.exitCode,
          logPath,
          summary: summarizeOutput(result.output)
        },
        commandResults
      };
    }
  }

  const last = commandResults.at(-1);
  return {
    result: {
      status: "passed",
      command: commands.join(" && "),
      exitCode: 0,
      logPath: last?.logPath,
      summary: "All validation commands passed."
    },
    commandResults
  };
}

export async function detectTestCommand(repoPath: string): Promise<string | undefined> {
  const packageJsonPath = path.join(repoPath, "package.json");
  const packageJson = await readJsonFile<{ scripts?: Record<string, string> }>(packageJsonPath);
  const hasTestScript = typeof packageJson?.scripts?.test === "string" && packageJson.scripts.test.trim().length > 0;
  const testScriptIsPlaceholder = hasTestScript && /no test specified|exit 1/i.test(packageJson?.scripts?.test ?? "");

  if (hasTestScript && !testScriptIsPlaceholder) {
    if (await exists(path.join(repoPath, "pnpm-lock.yaml"))) {
      return "pnpm test";
    }
    if (await exists(path.join(repoPath, "yarn.lock"))) {
      return "yarn test";
    }
    return "npm test";
  }

  if ((await exists(path.join(repoPath, "pytest.ini"))) || (await exists(path.join(repoPath, "pyproject.toml")))) {
    return "pytest";
  }
  if (await exists(path.join(repoPath, "go.mod"))) {
    return "go test ./...";
  }
  if (await exists(path.join(repoPath, "Cargo.toml"))) {
    return "cargo test";
  }

  return undefined;
}

export function summarizeOutput(output: string, maxLines = 40): string {
  const lines = output
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter(Boolean);
  return lines.slice(-maxLines).join("\n").slice(0, 6000);
}

async function exists(inputPath: string): Promise<boolean> {
  return await fs.promises
    .access(inputPath)
    .then(() => true)
    .catch(() => false);
}

async function readJsonFile<T>(inputPath: string): Promise<T | undefined> {
  try {
    return JSON.parse(await fs.promises.readFile(inputPath, "utf8")) as T;
  } catch {
    return undefined;
  }
}
