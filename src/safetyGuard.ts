import path from "node:path";
import { getChangedFiles, getDiff } from "./git.js";
import { toPosixPath } from "./paths.js";
import type { GitChangeSummary, SafetyAssessment } from "./types.js";

const AUTH_PAYMENT_PERMISSION_RE = /(^|\/)(auth|oauth|login|session|permission|permissions|acl|rbac|roles?|payments?|billing|stripe|checkout)(\/|\.|-|_|$)/i;
const TEST_FILE_RE = /(^|\/)(__tests__|tests?|spec)(\/|$)|(\.|-)(test|spec)\.[jt]sx?$|_test\.(go|py)$/i;

export class SafetyGuard {
  getPromptRules(options?: { allowEnvRead?: boolean; branch?: string }): string {
    const envRule = options?.allowEnvRead
      ? "Only read environment files if the mission explicitly requires it and never print secret values."
      : "Do not read .env, .env.local, private keys, SSH keys, cloud credentials, kube configs, or credential files.";

    return [
      "Safety rules:",
      `- ${envRule}`,
      "- Do not modify production deployment config unless explicitly required by the mission.",
      "- Do not remove tests to make tests pass.",
      "- Do not weaken assertions, auth, permissions, validation, or payment logic.",
      "- Do not push, deploy, delete databases, or run destructive production commands.",
      options?.branch ? `- Work only on branch ${options.branch}.` : "- Work only on the mission branch.",
      "- Keep changes as small and directly related to the goal as possible.",
      "- If you encounter a quota, rate limit, approval, or access restriction, stop and report it instead of retrying aggressively."
    ].join("\n");
  }

  isForbiddenPath(filePath: string): boolean {
    const normalized = normalize(filePath);
    const base = path.posix.basename(normalized);
    const segments = normalized.split("/");

    if (base === ".env" || base.startsWith(".env.")) {
      return true;
    }
    if (normalized.endsWith(".pem") || normalized.endsWith(".key")) {
      return true;
    }
    if (base === "id_rsa" || base === "id_ed25519") {
      return true;
    }
    if (segments.includes(".ssh") || segments.includes("secrets") || segments.includes("credentials")) {
      return true;
    }
    if (segments.includes(".aws") || segments.includes(".gcloud") || segments.includes(".kube")) {
      return true;
    }
    return false;
  }

  isWorkflowPath(filePath: string): boolean {
    return normalize(filePath).startsWith(".github/workflows/");
  }

  isDependencyFile(filePath: string): boolean {
    const normalized = normalize(filePath);
    const base = path.posix.basename(normalized);
    return ["package.json", "package-lock.json", "pnpm-lock.yaml", "yarn.lock", "bun.lockb", "Cargo.lock", "go.sum"].includes(base);
  }

  isAuthPaymentPermissionPath(filePath: string): boolean {
    return AUTH_PAYMENT_PERMISSION_RE.test(normalize(filePath));
  }

  async inspectGitDiff(repoPath: string): Promise<GitChangeSummary> {
    const changed = await getChangedFiles(repoPath);
    const diffSummary = await getDiff(repoPath, { stat: true });
    const zeroContextDiff = await getDiff(repoPath, { unified: 0 });

    const changedFiles = changed.files.map(normalize);
    const deletedTestFiles = changed.statusLines
      .filter((line) => line.startsWith("D") || line.startsWith(" D"))
      .map((line) => normalize(line.slice(3).trim()))
      .filter((file) => TEST_FILE_RE.test(file));

    const weakenedTestSignals = zeroContextDiff
      .split(/\r?\n/)
      .filter((line) => line.startsWith("-") && !line.startsWith("---"))
      .filter((line) => /\b(expect|assert|should|it\(|test\(|describe\()\b/i.test(line))
      .slice(0, 20);

    return {
      changedFiles,
      statusLines: changed.statusLines,
      dependencyFiles: changedFiles.filter((file) => this.isDependencyFile(file)),
      highRiskFiles: changedFiles.filter((file) => this.isWorkflowPath(file)),
      forbiddenFiles: changedFiles.filter((file) => this.isForbiddenPath(file)),
      deletedTestFiles,
      weakenedTestSignals,
      authPaymentPermissionFiles: changedFiles.filter((file) => this.isAuthPaymentPermissionPath(file)),
      diffSummary: diffSummary.trim()
    };
  }

  assess(summary: GitChangeSummary): SafetyAssessment {
    const riskFlags: string[] = [];

    if (summary.highRiskFiles.length > 0) {
      riskFlags.push(`GitHub Actions workflow changed: ${summary.highRiskFiles.join(", ")}`);
    }
    if (summary.dependencyFiles.length > 0) {
      riskFlags.push(`Dependency manifest or lockfile changed: ${summary.dependencyFiles.join(", ")}`);
    }
    if (summary.deletedTestFiles.length > 0) {
      riskFlags.push(`Test files deleted: ${summary.deletedTestFiles.join(", ")}`);
    }
    if (summary.weakenedTestSignals.length > 0) {
      riskFlags.push("Possible test assertion weakening detected.");
    }
    if (summary.authPaymentPermissionFiles.length > 0) {
      riskFlags.push(`Auth/payment/permission-related files changed: ${summary.authPaymentPermissionFiles.join(", ")}`);
    }

    const blocked = summary.forbiddenFiles.length > 0;
    return {
      blocked,
      riskFlags,
      forbiddenFiles: summary.forbiddenFiles,
      dependencyFiles: summary.dependencyFiles,
      highRiskFiles: summary.highRiskFiles,
      message: blocked
        ? `Forbidden files changed: ${summary.forbiddenFiles.join(", ")}`
        : riskFlags.length > 0
          ? `Risk flags detected: ${riskFlags.join(" | ")}`
          : "No blocking safety issues detected."
    };
  }
}

function normalize(filePath: string): string {
  return toPosixPath(filePath).replace(/^\.\//, "");
}
