import test from "node:test";
import assert from "node:assert/strict";
import {
  assessChangeSet,
  evaluateUpdate,
  createRecoveryRecord
} from "../self-improvement-governance.js";

test("allows only explicitly allowlisted extension paths", () => {
  assert.equal(assessChangeSet(["modules/learning/example.js"]).allowed, true);
  assert.equal(assessChangeSet(["experiments/run-1/notes.md"]).allowed, true);
});

test("blocks kernel, recovery, workflow and worker paths", () => {
  for (const path of [
    "kernel/core.js",
    "recovery/backup.js",
    ".github/workflows/validate.yml",
    "worker/search-worker.js",
    "build.sh"
  ]) {
    assert.equal(assessChangeSet([path]).allowed, false, path);
  }
});

test("blocks traversal and paths outside the allowlist", () => {
  assert.equal(assessChangeSet(["modules/../kernel/core.js"]).allowed, false);
  assert.equal(assessChangeSet(["brain.js"]).reason, "PATH_OUTSIDE_ALLOWLIST");
});

test("limits the size of a proposed change set", () => {
  const paths = Array.from({ length: 13 }, (_, i) => `modules/m${i}.js`);
  assert.equal(assessChangeSet(paths).reason, "CHANGESET_TOO_LARGE");
});

test("rejects updates with failed tests or regressions", () => {
  const result = evaluateUpdate({
    testsPassed: true,
    buildPassed: true,
    regressionCount: 1,
    securityChecksPassed: true,
    resourceBudgetRespected: true,
    qualityScore: 90
  }, { qualityScore: 80 });
  assert.equal(result.accepted, false);
  assert.ok(result.failedChecks.includes("regressionCountZero"));
});

test("requires all gates and no quality regression", () => {
  const result = evaluateUpdate({
    testsPassed: true,
    buildPassed: true,
    regressionCount: 0,
    securityChecksPassed: true,
    resourceBudgetRespected: true,
    qualityScore: 90
  }, { qualityScore: 85 });
  assert.equal(result.accepted, true);
  assert.equal(result.decision, "ELIGIBLE_FOR_REVIEW");
});

test("creates a SHA-256 recovery metadata record", async () => {
  const record = await createRecoveryRecord({
    version: "0.5.0",
    commit: "abc123",
    artifactText: "stable artifact"
  });
  assert.equal(record.schema, "cpb01.recovery-record/1");
  assert.equal(record.algorithm, "SHA-256");
  assert.equal(record.artifactHash.length, 64);
  assert.equal(Object.isFrozen(record), true);
});
