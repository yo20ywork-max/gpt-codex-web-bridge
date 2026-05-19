import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { runCommandToLog } from "../src/processUtils.js";

export async function createTempDir(prefix: string): Promise<string> {
  return await fs.promises.mkdtemp(path.join(os.tmpdir(), prefix));
}

export async function createGitRepo(options?: { packageJson?: Record<string, unknown>; files?: Record<string, string> }): Promise<{
  root: string;
  repoPath: string;
  storagePath: string;
}> {
  const root = await createTempDir("gcb-test-");
  const repoPath = path.join(root, "repo");
  const storagePath = path.join(root, "storage");
  await fs.promises.mkdir(repoPath, { recursive: true });

  const packageJson = options?.packageJson ?? {
    scripts: {
      test: "node -e \"process.exit(0)\""
    }
  };
  await fs.promises.writeFile(path.join(repoPath, "package.json"), `${JSON.stringify(packageJson, null, 2)}\n`, "utf8");

  for (const [file, content] of Object.entries(options?.files ?? {})) {
    const filePath = path.join(repoPath, file);
    await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
    await fs.promises.writeFile(filePath, content, "utf8");
  }

  await runLogged("git init", repoPath, root);
  await runLogged("git config user.email gcb@example.local", repoPath, root);
  await runLogged("git config user.name gcb", repoPath, root);
  await runLogged("git add .", repoPath, root);
  await runLogged("git commit -m initial", repoPath, root);

  return { root, repoPath, storagePath };
}

export async function cleanupTempDir(root: string): Promise<void> {
  await fs.promises.rm(root, { recursive: true, force: true });
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
