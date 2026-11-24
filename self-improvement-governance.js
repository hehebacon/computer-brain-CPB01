/**
 * CPB-01 bounded self-improvement governance.
 *
 * This module evaluates proposed changes and records recovery metadata.
 * It does NOT execute code, access GitHub, grant permissions, or deploy.
 * A server-side permission broker and isolated CI runner are still required.
 */

export const SELF_IMPROVEMENT_POLICY = Object.freeze({
  version: 1,
  allowedPrefixes: Object.freeze(["modules/", "experiments/", "learning-data/"]),
  protectedPrefixes: Object.freeze([
    "kernel/",
    "recovery/",
    ".github/workflows/",
    "worker/",
    "wrangler.toml",
    "build.sh",
    "package.json"
  ]),
  maxChangedFiles: 12,
  requireHumanApprovalForProtectedChanges: true,
  requireHumanApprovalForMainMerge: true
});

function normalizePath(path) {
  if (typeof path !== "string" || !path.trim()) {
    throw new TypeError("A non-empty repository path is required");
  }
  const value = path.replaceAll("\\", "/").replace(/^\.\//, "");
  if (value.startsWith("/") || value.split("/").some(part => part === ".." || part === ".")) {
    throw new Error("Unsafe repository path");
  }
  return value;
}

export function assessChangeSet(paths, policy = SELF_IMPROVEMENT_POLICY) {
  if (!Array.isArray(paths) || paths.length === 0) {
    return { allowed: false, reason: "EMPTY_CHANGESET", paths: [] };
  }
  const normalized = [...new Set(paths.map(normalizePath))];
  if (normalized.length > policy.maxChangedFiles) {
    return { allowed: false, reason: "CHANGESET_TOO_LARGE", paths: normalized };
  }

  const protectedPaths = normalized.filter(path =>
    policy.protectedPrefixes.some(prefix => path === prefix || path.startsWith(prefix))
  );
  if (protectedPaths.length) {
    return {
      allowed: false,
      reason: "PROTECTED_PATH",
      paths: normalized,
      protectedPaths,
      requiresHumanApproval: true
    };
  }

  const outsideAllowlist = normalized.filter(path =>
    !policy.allowedPrefixes.some(prefix => path.startsWith(prefix))
  );
  if (outsideAllowlist.length) {
    return {
      allowed: false,
      reason: "PATH_OUTSIDE_ALLOWLIST",
      paths: normalized,
      rejectedPaths: outsideAllowlist
    };
  }

  return {
    allowed: true,
    reason: "ALLOWLISTED",
    paths: normalized,
    requiresHumanApproval: false
  };
}

export function evaluateUpdate(candidate, baseline = {}) {
  const checks = {
    testsPassed: candidate?.testsPassed === true,
    buildPassed: candidate?.buildPassed === true,
    regressionCountZero: Number(candidate?.regressionCount) === 0,
    securityChecksPassed: candidate?.securityChecksPassed === true,
    resourceBudgetRespected: candidate?.resourceBudgetRespected === true,
    scoreIsFinite: Number.isFinite(candidate?.qualityScore),
    scoreNotWorse: Number.isFinite(candidate?.qualityScore) &&
      Number.isFinite(baseline?.qualityScore) &&
      candidate.qualityScore >= baseline.qualityScore
  };
  const failedChecks = Object.entries(checks)
    .filter(([, passed]) => !passed)
    .map(([name]) => name);
  return Object.freeze({
    accepted: failedChecks.length === 0,
    checks: Object.freeze(checks),
    failedChecks: Object.freeze(failedChecks),
    decision: failedChecks.length === 0 ? "ELIGIBLE_FOR_REVIEW" : "REJECTED"
  });
}

export async function createRecoveryRecord({
  version,
  commit,
  artifactText,
  createdAt = new Date().toISOString()
}) {
  if (!version || !commit || typeof artifactText !== "string") {
    throw new TypeError("version, commit and artifactText are required");
  }
  if (!globalThis.crypto?.subtle) {
    throw new Error("Web Crypto SHA-256 is required to create a recovery record");
  }
  const bytes = new TextEncoder().encode(artifactText);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  const hash = [...new Uint8Array(digest)]
    .map(byte => byte.toString(16).padStart(2, "0"))
    .join("");
  return Object.freeze({
    schema: "cpb01.recovery-record/1",
    version,
    commit,
    createdAt,
    algorithm: "SHA-256",
    artifactHash: hash,
    artifactBytes: bytes.byteLength,
    immutableByDesign: true,
    note: "Metadata only: preserve the actual artifact in a separately protected Git tag or backup store."
  });
}
