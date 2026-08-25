import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import fs from "node:fs/promises";
import os from "node:os";
import net from "node:net";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");

async function makeTempDir(prefix) {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

async function findFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.on("error", reject);
    server.listen(0, () => {
      const address = server.address();
      const port = typeof address === "object" ? address.port : 0;
      server.close(() => resolve(port));
    });
  });
}

async function waitForHealth(baseUrl) {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${baseUrl}/health`);
      if (res.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 80));
  }
  throw new Error("API server did not become healthy");
}

async function getJson(baseUrl, pathname) {
  const res = await fetch(`${baseUrl}${pathname}`);
  const json = await res.json();
  return { status: res.status, json };
}

async function postJson(baseUrl, pathname, body) {
  const res = await fetch(`${baseUrl}${pathname}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const json = await res.json();
  return { status: res.status, json };
}

test("AI field adoption rolls note and inbox state back if the linked suggestion disappears before review commit", async (t) => {
  const vaultPath = await makeTempDir("yansilu-ai-field-adoption-rollback-vault-");
  const port = await findFreePort();
  const baseUrl = `http://127.0.0.1:${port}`;

  const child = spawn(process.execPath, ["apps/api/src/server.mjs"], {
    cwd: REPO_ROOT,
    env: {
      ...process.env,
      API_PORT: String(port),
      VAULT_PATH: vaultPath
    },
    stdio: ["ignore", "pipe", "pipe"]
  });

  t.after(() => child.kill());
  await waitForHealth(baseUrl);

  const note = await postJson(baseUrl, "/api/v1/notes", {
    directoryId: "dir_original_default",
    title: "Rollback target",
    noteType: "permanent",
    body: "# Rollback target\n\nThis note should keep its pre-adoption state if the review commit fails.",
    thesis: "The original viewpoint must survive a failed AI draft adoption."
  });
  assert.equal(note.status, 201, JSON.stringify(note.json));

  const originalDetail = await getJson(baseUrl, `/api/v1/notes/${encodeURIComponent(note.json.item.id)}`);
  assert.equal(originalDetail.status, 200, JSON.stringify(originalDetail.json));

  const analysis = await postJson(baseUrl, `/api/v1/notes/${encodeURIComponent(note.json.item.id)}/ai-analysis`, {});
  assert.equal(analysis.status, 200, JSON.stringify(analysis.json));

  const suggestionId = analysis.json.item.reviewItems.storedSuggestionIds[0];
  assert.ok(suggestionId);
  const artifact = analysis.json.item.reviewItems.artifacts.find(
    (item) => item.type === "InsightCard" && item.payload?.fieldSuggestionId === suggestionId
  );
  assert.ok(artifact, "expected a persisted field suggestion artifact");

  const db = new DatabaseSync(path.join(vaultPath, ".yansilu", "ai-agent.db"));
  try {
    db.prepare("DELETE FROM ai_suggestions WHERE id = ?").run(suggestionId);
  } finally {
    db.close();
  }

  const adopted = await postJson(baseUrl, `/api/v1/ai/inbox/${encodeURIComponent(artifact.id)}/adopt-field-suggestion`, {
    confirm: true,
    comment: "This adopt should fail after the linked suggestion row is removed."
  });
  assert.equal(adopted.status, 404, JSON.stringify(adopted.json));
  assert.equal(adopted.json.error.code, "AI_SUGGESTION_NOT_FOUND");

  const noteAfterFailure = await getJson(baseUrl, `/api/v1/notes/${encodeURIComponent(note.json.item.id)}`);
  assert.equal(noteAfterFailure.status, 200, JSON.stringify(noteAfterFailure.json));
  assert.equal(noteAfterFailure.json.item.title, originalDetail.json.item.title);
  assert.equal(noteAfterFailure.json.item.body, originalDetail.json.item.body);
  assert.equal(noteAfterFailure.json.item.thesis, originalDetail.json.item.thesis);
  assert.deepEqual(noteAfterFailure.json.item.viewpointHistory, originalDetail.json.item.viewpointHistory);
  assert.equal(noteAfterFailure.json.item.authorship?.ai_assisted === true, false);

  const inboxDetail = await getJson(baseUrl, `/api/v1/ai/inbox/${encodeURIComponent(artifact.id)}?canonical=true`);
  assert.equal(inboxDetail.status, 200, JSON.stringify(inboxDetail.json));
  assert.equal(inboxDetail.json.item.status, "pending_review");
  assert.equal(inboxDetail.json.artifact.status, "pending_review");
  assert.equal(inboxDetail.json.artifact.payload.fieldSuggestion.status, "suggested");
  assert.deepEqual(inboxDetail.json.artifact.userDecisions, []);
  assert.equal(Object.prototype.hasOwnProperty.call(inboxDetail.json.canonical, "suggestion"), true);
  assert.equal(inboxDetail.json.canonical.suggestion, null);
  assert.deepEqual(inboxDetail.json.canonical.suggestion_review_events, []);
  assert.equal(inboxDetail.json.canonical.latest_suggestion_review_event, null);
  assert.deepEqual(Object.keys(inboxDetail.json.canonical.trace || {}).sort(), [
    "primary_source_note_id",
    "source_artifact_id",
    "source_note_ids",
    "suggestion_id",
    "suggestion_status",
    "target_field",
    "target_note_id"
  ]);
  assert.equal(inboxDetail.json.canonical.trace.suggestion_id, suggestionId);
  assert.equal(inboxDetail.json.canonical.trace.suggestion_status, "missing");
});
