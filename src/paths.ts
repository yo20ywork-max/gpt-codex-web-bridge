import path from "node:path";

export function nowIso(): string {
  return new Date().toISOString();
}

export function getBridgeRoot(): string {
  return path.resolve(process.env.GCB_BRIDGE_ROOT ?? process.cwd());
}

export function getStorageRoot(): string {
  return path.resolve(process.env.GCB_STORAGE_DIR ?? path.join(getBridgeRoot(), ".gpt-codex-web-bridge"));
}

export function getMissionsRoot(storageRoot = getStorageRoot()): string {
  return path.join(storageRoot, "missions");
}

export function normalizePath(inputPath: string): string {
  return path.resolve(inputPath);
}

export function toPosixPath(inputPath: string): string {
  return inputPath.split(path.sep).join("/");
}

export function isSamePath(a: string, b: string): boolean {
  return path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase();
}
