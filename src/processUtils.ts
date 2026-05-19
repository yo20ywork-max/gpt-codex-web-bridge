import type { ChildProcess } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import spawn from "cross-spawn";
import type { CommandResult } from "./types.js";

export function commandForPlatform(command: string): string {
  if (process.platform !== "win32") {
    return command;
  }

  const lower = command.toLowerCase();
  const needsCmd = ["npm", "npx", "pnpm", "yarn", "codex"].includes(lower);
  return needsCmd ? `${command}.cmd` : command;
}

export function parseCommand(command: string): string[] {
  const parts: string[] = [];
  let current = "";
  let quote: "'" | '"' | null = null;
  let escaping = false;

  for (const char of command) {
    if (escaping) {
      current += char;
      escaping = false;
      continue;
    }

    if (char === "\\") {
      escaping = true;
      continue;
    }

    if (quote) {
      if (char === quote) {
        quote = null;
      } else {
        current += char;
      }
      continue;
    }

    if (char === "'" || char === '"') {
      quote = char;
      continue;
    }

    if (/\s/.test(char)) {
      if (current.length > 0) {
        parts.push(current);
        current = "";
      }
      continue;
    }

    current += char;
  }

  if (escaping) {
    current += "\\";
  }
  if (current.length > 0) {
    parts.push(current);
  }

  return parts;
}

export async function runArgvToLog(options: {
  executable: string;
  args?: string[];
  cwd: string;
  logPath: string;
  displayCommand?: string;
  timeoutMs?: number;
  extraEnv?: NodeJS.ProcessEnv;
}): Promise<CommandResult> {
  await fs.promises.mkdir(path.dirname(options.logPath), { recursive: true });
  const executable = commandForPlatform(options.executable);
  const args = options.args ?? [];
  const displayCommand = options.displayCommand ?? [options.executable, ...args].join(" ");

  return await new Promise<CommandResult>((resolve) => {
    let output = "";
    const stream = fs.createWriteStream(options.logPath, { flags: "w" });
    const write = (chunk: Buffer): void => {
      const text = chunk.toString("utf8");
      output += text;
      stream.write(text);
    };

    let child: ChildProcess | undefined;
    let timeout: NodeJS.Timeout | undefined;
    if (options.timeoutMs && options.timeoutMs > 0) {
      timeout = setTimeout(() => {
        child?.kill("SIGTERM");
      }, options.timeoutMs);
    }

    try {
      child = spawn(executable, args, {
        cwd: options.cwd,
        env: { ...process.env, ...options.extraEnv },
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true
      });
    } catch (error) {
      if (timeout) {
        clearTimeout(timeout);
      }
      output += `\n[process error] ${(error as Error).message}\n`;
      stream.write(output);
      stream.end(() => {
        resolve({
          command: displayCommand,
          exitCode: 1,
          logPath: options.logPath,
          output
        });
      });
      return;
    }

    child.stdout?.on("data", write);
    child.stderr?.on("data", write);
    child.on("error", (error) => {
      output += `\n[process error] ${error.message}\n`;
      stream.write(`\n[process error] ${error.message}\n`);
    });
    child.on("close", (code) => {
      if (timeout) {
        clearTimeout(timeout);
      }
      stream.end(() => {
        resolve({
          command: displayCommand,
          exitCode: code ?? 1,
          logPath: options.logPath,
          output
        });
      });
    });
  });
}

export async function runCommandToLog(options: {
  command: string;
  cwd: string;
  logPath: string;
  timeoutMs?: number;
  extraEnv?: NodeJS.ProcessEnv;
}): Promise<CommandResult> {
  const parsed = parseCommand(options.command);
  if (parsed.length === 0) {
    throw new Error("Cannot run an empty command.");
  }

  await fs.promises.mkdir(path.dirname(options.logPath), { recursive: true });
  return await runArgvToLog({
    executable: parsed[0],
    args: parsed.slice(1),
    cwd: options.cwd,
    logPath: options.logPath,
    displayCommand: options.command,
    timeoutMs: options.timeoutMs,
    extraEnv: options.extraEnv
  });
}

export async function commandExists(command: string): Promise<boolean> {
  const pathValue = process.env.PATH ?? "";
  const pathEntries = pathValue.split(path.delimiter).filter(Boolean);
  const extensions =
    process.platform === "win32"
      ? (process.env.PATHEXT ?? ".EXE;.CMD;.BAT;.COM")
          .split(";")
          .filter(Boolean)
          .flatMap((extension) => [extension.toLowerCase(), extension.toUpperCase()])
      : [""];

  for (const entry of pathEntries) {
    for (const extension of extensions) {
      const candidate = path.join(entry, process.platform === "win32" && path.extname(command) === "" ? `${command}${extension}` : command);
      if (await isExecutable(candidate)) {
        return true;
      }
    }
  }

  return false;
}

async function isExecutable(candidate: string): Promise<boolean> {
  try {
    const stat = await fs.promises.stat(candidate);
    if (!stat.isFile()) {
      return false;
    }
    if (process.platform === "win32") {
      return true;
    }
    return (stat.mode & 0o111) !== 0;
  } catch {
    return false;
  }
}
