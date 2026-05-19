#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { commandExists, runCommandToLog } from "./processUtils.js";
import { getStorageRoot } from "./paths.js";
import { MissionService } from "./missionService.js";
import { startServer } from "./server.js";

interface ParsedArgs {
  command?: string;
  positionals: string[];
  options: Record<string, string | boolean>;
}

async function main(argv = process.argv.slice(2)): Promise<void> {
  const parsed = parseArgs(argv);
  const command = parsed.command ?? "help";

  if (command === "serve") {
    await startServer();
    return;
  }

  if (command === "doctor") {
    printJson(await doctor());
    return;
  }

  if (command === "mock-demo") {
    await runMockDemo();
    return;
  }

  if (command === "demo-rate-limit") {
    await runRateLimitDemo();
    return;
  }

  const service = MissionService.create();

  if (command === "start") {
    const repo = requiredOption(parsed, "repo");
    const goal = requiredOption(parsed, "goal");
    const result = await service.startMission({
      repoPath: repo,
      goal,
      testCommand: stringOption(parsed, "test"),
      lintCommand: stringOption(parsed, "lint"),
      maxLoops: numberOption(parsed, "maxLoops") ?? numberOption(parsed, "max-loops") ?? 12,
      autoContinue: !booleanOption(parsed, "no-auto-continue"),
      allowEnvRead: booleanOption(parsed, "allow-env-read")
    });
    printJson(result);
    return;
  }

  if (command === "continue") {
    const missionId = parsed.positionals[0];
    printJson(await service.continueMission({ missionId }));
    return;
  }

  if (command === "status") {
    const missionId = parsed.positionals[0];
    printJson(await service.getMissionStatus(missionId));
    return;
  }

  if (command === "pause") {
    const missionId = parsed.positionals[0];
    if (!missionId) {
      throw new Error("Missing missionId for pause.");
    }
    printJson(await service.pauseMission(missionId));
    return;
  }

  if (command === "report") {
    const missionId = parsed.positionals[0];
    const result = await service.getMissionReport(missionId);
    console.log(result.markdown);
    return;
  }

  printHelp();
}

async function doctor(): Promise<Record<string, unknown>> {
  const storageRoot = getStorageRoot();
  await fs.promises.mkdir(storageRoot, { recursive: true });
  const probePath = path.join(storageRoot, ".doctor-write-test");
  await fs.promises.writeFile(probePath, "ok\n", "utf8");
  await fs.promises.rm(probePath, { force: true });

  return {
    node: {
      version: process.version,
      ok: Number(process.versions.node.split(".")[0]) >= 20
    },
    git: {
      available: await commandExists("git")
    },
    codex: {
      available: await commandExists("codex"),
      fallback: "npx -y codex"
    },
    storage: {
      path: storageRoot,
      writable: true
    },
    mcp: {
      endpoint: "http://localhost:8787/mcp"
    }
  };
}

async function runMockDemo(): Promise<void> {
  process.env.GCB_MOCK_CODEX = process.env.GCB_MOCK_CODEX ?? "1";
  process.env.GCB_MOCK_SCENARIO = process.env.GCB_MOCK_SCENARIO ?? "validation_fail_then_success";

  const root = await fs.promises.mkdtemp(path.join(os.tmpdir(), "gcb-mock-demo-"));
  const repoPath = path.join(root, "repo");
  const storagePath = path.join(root, "storage");
  await fs.promises.mkdir(repoPath, { recursive: true });
  await fs.promises.writeFile(
    path.join(repoPath, "package.json"),
    JSON.stringify(
      {
        scripts: {
          test: "node -e \"const fs=require('fs'); process.exit(fs.readFileSync('gcb-mock-status.txt','utf8').trim()==='pass'?0:1)\""
        }
      },
      null,
      2
    ),
    "utf8"
  );
  await fs.promises.writeFile(path.join(repoPath, "gcb-mock-status.txt"), "fail\n", "utf8");

  await runLogged("git init", repoPath, root);
  await runLogged("git config user.email gcb@example.local", repoPath, root);
  await runLogged("git config user.name gcb", repoPath, root);
  await runLogged("git add package.json gcb-mock-status.txt", repoPath, root);
  await runLogged("git commit -m initial", repoPath, root);

  const service = MissionService.create(storagePath);
  const start = await service.startMission({
    repoPath,
    goal: "Run the mock mission until validation passes.",
    testCommand: "npm test",
    maxLoops: 4,
    autoContinue: true,
    allowEnvRead: false
  });
  const missionId = String(start.missionId);
  await service.waitForMission(missionId);
  const status = await service.getMissionStatus(missionId);
  const report = await service.getMissionReport(missionId);

  printJson({
    demoRoot: root,
    repoPath,
    storagePath,
    status
  });
  console.log("\n--- report.md ---\n");
  console.log(report.markdown);
}

async function runRateLimitDemo(): Promise<void> {
  process.env.GCB_MOCK_CODEX = "1";
  process.env.GCB_MOCK_SCENARIO = "rate_limit";

  const root = await fs.promises.mkdtemp(path.join(os.tmpdir(), "gcb-rate-limit-demo-"));
  const repoPath = path.join(root, "repo");
  const storagePath = path.join(root, "storage");
  await createMockRepo(repoPath);

  const service = MissionService.create(storagePath);
  const start = await service.startMission({
    repoPath,
    goal: "Demo a mission that pauses on a Codex usage limit, then resumes and completes.",
    testCommand: "npm test",
    maxLoops: 4,
    autoContinue: true,
    allowEnvRead: false
  });
  const missionId = String(start.missionId);
  await service.waitForMission(missionId);
  const paused = await service.getMissionStatus(missionId);

  process.env.GCB_MOCK_SCENARIO = "success";
  const continued = await service.continueMission({});
  await service.waitForMission(missionId);
  const completed = await service.getMissionStatus(missionId);
  const report = await service.getMissionReport(missionId);

  printJson({
    demoRoot: root,
    repoPath,
    storagePath,
    events: [
      "mission_started",
      "codex_working",
      "rate_limit_detected",
      "mission_paused",
      "user_resumed",
      "mission_completed"
    ],
    missionId,
    paused,
    continued,
    completed
  });
  console.log("\n--- report.md ---\n");
  console.log(report.markdown);
}

async function createMockRepo(repoPath: string): Promise<void> {
  const root = path.dirname(repoPath);
  await fs.promises.mkdir(repoPath, { recursive: true });
  await fs.promises.writeFile(
    path.join(repoPath, "package.json"),
    JSON.stringify(
      {
        scripts: {
          test: "node -e \"const fs=require('fs'); process.exit(fs.readFileSync('gcb-mock-status.txt','utf8').trim()==='pass'?0:1)\""
        }
      },
      null,
      2
    ),
    "utf8"
  );
  await fs.promises.writeFile(path.join(repoPath, "gcb-mock-status.txt"), "fail\n", "utf8");

  await runLogged("git init", repoPath, root);
  await runLogged("git config user.email gcb@example.local", repoPath, root);
  await runLogged("git config user.name gcb", repoPath, root);
  await runLogged("git add package.json gcb-mock-status.txt", repoPath, root);
  await runLogged("git commit -m initial", repoPath, root);
}

async function runLogged(command: string, cwd: string, logRoot: string): Promise<void> {
  const result = await runCommandToLog({
    command,
    cwd,
    logPath: path.join(logRoot, `${command.replace(/[^A-Za-z0-9_.-]+/g, "_")}.log`)
  });
  if (result.exitCode !== 0) {
    throw new Error(`Command failed: ${command}\n${result.output}`);
  }
}

function parseArgs(argv: string[]): ParsedArgs {
  const [command, ...rest] = argv;
  const parsed: ParsedArgs = { command, positionals: [], options: {} };

  for (let index = 0; index < rest.length; index += 1) {
    const item = rest[index];
    if (!item.startsWith("--")) {
      parsed.positionals.push(item);
      continue;
    }

    const keyValue = item.slice(2);
    const equalsIndex = keyValue.indexOf("=");
    if (equalsIndex >= 0) {
      parsed.options[keyValue.slice(0, equalsIndex)] = keyValue.slice(equalsIndex + 1);
      continue;
    }

    const next = rest[index + 1];
    if (!next || next.startsWith("--")) {
      parsed.options[keyValue] = true;
      continue;
    }
    parsed.options[keyValue] = next;
    index += 1;
  }

  return parsed;
}

function requiredOption(parsed: ParsedArgs, name: string): string {
  const value = stringOption(parsed, name);
  if (!value) {
    throw new Error(`Missing required option --${name}`);
  }
  return value;
}

function stringOption(parsed: ParsedArgs, name: string): string | undefined {
  const value = parsed.options[name];
  return typeof value === "string" ? value : undefined;
}

function numberOption(parsed: ParsedArgs, name: string): number | undefined {
  const value = stringOption(parsed, name);
  if (!value) {
    return undefined;
  }
  const number = Number(value);
  if (!Number.isFinite(number)) {
    throw new Error(`Invalid number for --${name}: ${value}`);
  }
  return number;
}

function booleanOption(parsed: ParsedArgs, name: string): boolean {
  return parsed.options[name] === true || parsed.options[name] === "true";
}

function printJson(value: unknown): void {
  console.log(JSON.stringify(value, null, 2));
}

function printHelp(): void {
  console.log(`gcb commands:
  gcb serve
  gcb start --repo <path> --goal "<goal>" [--test "npm test"] [--lint "npm run lint"]
  gcb continue [missionId]
  gcb pause <missionId>
  gcb status [missionId]
  gcb report [missionId]
  gcb doctor
  gcb mock-demo
  gcb demo-rate-limit`);
}

const entry = process.argv[1] ? pathToFileURL(process.argv[1]).href : "";
if (import.meta.url === entry) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
