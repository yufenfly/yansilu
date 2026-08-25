import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import fs from "node:fs/promises";
import os from "node:os";
import net from "node:net";
import http from "node:http";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

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

async function readRequestJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const text = Buffer.concat(chunks).toString("utf8");
  return text ? JSON.parse(text) : {};
}

async function startJsonProvider(output) {
  const requests = [];
  const server = http.createServer(async (req, res) => {
    if (req.method !== "POST" || req.url !== "/v1/chat/completions") {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: { message: "not found" } }));
      return;
    }
    const body = await readRequestJson(req);
    requests.push({ body, headers: req.headers });
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        id: "chatcmpl_note_analysis_test",
        choices: [{ message: { role: "assistant", content: JSON.stringify(output) } }],
        usage: { prompt_tokens: 11, completion_tokens: 13, total_tokens: 24 }
      })
    );
  });

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      resolve({
        server,
        requests,
        baseUrl: `http://127.0.0.1:${address.port}`
      });
    });
  });
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

async function putJson(baseUrl, pathname, body) {
  const res = await fetch(`${baseUrl}${pathname}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const json = await res.json();
  return { status: res.status, json };
}

async function patchJson(baseUrl, pathname, body) {
  const res = await fetch(`${baseUrl}${pathname}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const json = await res.json();
  return { status: res.status, json };
}

async function deleteJson(baseUrl, pathname) {
  const res = await fetch(`${baseUrl}${pathname}`, { method: "DELETE" });
  const json = await res.json();
  return { status: res.status, json };
}

function escapeRegExp(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function markdownDestinationPattern(target) {
  const escaped = escapeRegExp(target);
  return new RegExp(`\\((?:<${escaped}>|${escaped})\\)`);
}

test("notes API creates, lists, loads, and updates markdown note", async (t) => {
  const vaultPath = await makeTempDir("yansilu-api-notes-vault-");
  const noteRoot = path.join(vaultPath, "notes", "original");
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

  const createDir = await postJson(baseUrl, "/api/v1/directories", {
    title: "research-method",
    parentDirectoryId: "dir_original_default",
    directoryType: "custom",
    fsPath: path.join(noteRoot, "research-method"),
    maxNotes: 500
  });
  assert.equal(createDir.status, 201);
  const directoryId = createDir.json.item.id;

  const rejectedConfirmedCreate = await postJson(baseUrl, "/api/v1/notes", {
    directoryId,
    body: "# Unconfirmed distillation\n\nThis should not become a confirmed judgment.",
    thesis: "Unconfirmed requests should not become stable judgments.",
    threeLineSummary: [
      "Unconfirmed requests should not become stable judgments.",
      "The user must explicitly confirm authorship first.",
      "That keeps AI or automation from silently owning the conclusion."
    ],
    distillationStatus: "confirmed"
  });
  assert.equal(rejectedConfirmedCreate.status, 400);
  assert.equal(rejectedConfirmedCreate.json.error.code, "PERMANENT_DISTILLATION_CONFIRMATION_REQUIRED");

  const createNote = await postJson(baseUrl, "/api/v1/notes", {
    directoryId,
    body: "# Writing starts from note units\n\nThis is test content.",
    thesis: "Writing should start from reusable note units instead of blank drafting.",
    threeLineSummary: [
      "Writing should start from reusable note units.",
      "That keeps argument-building tied to durable claims.",
      "It matters when the user wants to move from notes into structured prose."
    ],
    distillationStatus: "confirmed",
    authorshipConfirmed: true,
    boundaryOrCounterpoint: "This breaks down when the claim cannot be traced to a concrete note."
  });
  assert.equal(createNote.status, 201);
  assert.equal(createNote.json.item.noteType, "permanent");
  assert.equal(createNote.json.item.title, "Writing starts from note units");
  assert.equal(createNote.json.item.originalityStatus, "warning");
  assert.deepEqual(createNote.json.item.authorship, { user_confirmed: true, ai_assisted: false });
  assert.equal(createNote.json.item.thesis, "Writing should start from reusable note units instead of blank drafting.");
  assert.deepEqual(createNote.json.item.threeLineSummary, [
    "Writing should start from reusable note units.",
    "That keeps argument-building tied to durable claims.",
    "It matters when the user wants to move from notes into structured prose."
  ]);
  assert.equal(createNote.json.item.distillationStatus, "confirmed");
  assert.equal(createNote.json.item.thinkingStatus.status, "needs_relation");
  assert.equal(createNote.json.item.thinkingStatus.label, "待建立关系");
  assert.equal(
    createNote.json.item.boundaryOrCounterpoint,
    "This breaks down when the claim cannot be traced to a concrete note."
  );
  assert.match(createNote.json.item.body, /This is test content\./);
  assert.equal(path.basename(createNote.json.item.markdownPath), "Writing starts from note units.md");

  const noteId = createNote.json.item.id;
  const noteFile = path.join(vaultPath, createNote.json.item.markdownPath.replaceAll("/", path.sep));
  const markdown = await fs.readFile(noteFile, "utf8");
  assert.match(markdown, /# Writing starts from note units/);
  assert.match(markdown, /thesis: Writing should start from reusable note units instead of blank drafting\./);
  assert.match(markdown, /three_line_summary:/);
  assert.match(markdown, /distillation_status: confirmed/);
  assert.match(markdown, /originality_status: warning/);
  assert.match(markdown, /authorship: \{"user_confirmed":true,"ai_assisted":false\}/);
  assert.match(markdown, /boundary_or_counterpoint: This breaks down when the claim cannot be traced to a concrete note\./);

  const list = await getJson(baseUrl, `/api/v1/directories/${encodeURIComponent(directoryId)}/notes`);
  assert.equal(list.status, 200);
  assert.equal(list.json.total, 1);
  assert.equal(list.json.items[0].id, noteId);
  assert.equal(list.json.items[0].thinkingStatus.status, "needs_relation");

  const getNote = await getJson(baseUrl, `/api/v1/notes/${encodeURIComponent(noteId)}`);
  assert.equal(getNote.status, 200);
  assert.equal(getNote.json.item.id, noteId);
  assert.equal(getNote.json.item.thinkingStatus.status, "needs_relation");
  assert.equal(getNote.json.item.thesis, "Writing should start from reusable note units instead of blank drafting.");
  assert.deepEqual(getNote.json.item.threeLineSummary, [
    "Writing should start from reusable note units.",
    "That keeps argument-building tied to durable claims.",
    "It matters when the user wants to move from notes into structured prose."
  ]);
  assert.equal(getNote.json.item.distillationStatus, "confirmed");
  assert.equal(getNote.json.item.originalityStatus, "warning");
  assert.deepEqual(getNote.json.item.authorship, { user_confirmed: true, ai_assisted: false });
  assert.equal(
    getNote.json.item.boundaryOrCounterpoint,
    "This breaks down when the claim cannot be traced to a concrete note."
  );
  assert.match(getNote.json.item.body, /This is test content\./);

  const update = await putJson(baseUrl, `/api/v1/notes/${encodeURIComponent(noteId)}`, {
    body: "# Updated title line\n\nUpdated paragraph.",
    status: "active",
    thesis: "A durable writing flow begins from compressed claims, not blank pages.",
    thesisChangeReason: "The updated note narrows the claim from all writing to durable writing flows.",
    threeLineSummary: [
      "A durable writing flow begins from compressed claims.",
      "That lowers the cost of structuring paragraphs and arguments.",
      "It is most useful when the system turns notes into writing inputs."
    ],
    distillationStatus: "draft",
    boundaryOrCounterpoint: "This does not hold when the paragraph has no source trace.",
    originalityStatus: "pass",
    originalitySimilarity: 0.18,
    authorship: {
      user_confirmed: true,
      ai_assisted: false
    }
  });
  assert.equal(update.status, 200);
  assert.equal(update.json.item.id, noteId);
  assert.equal(update.json.item.title, "Updated title line");
  assert.equal(update.json.item.status, "active");
  assert.equal(update.json.item.thesis, "A durable writing flow begins from compressed claims, not blank pages.");
  assert.deepEqual(update.json.item.threeLineSummary, [
    "A durable writing flow begins from compressed claims.",
    "That lowers the cost of structuring paragraphs and arguments.",
    "It is most useful when the system turns notes into writing inputs."
  ]);
  assert.equal(update.json.item.distillationStatus, "draft");
  assert.equal(update.json.item.thinkingStatus.status, "needs_confirmation");
  assert.equal(update.json.item.originalityStatus, "pass");
  assert.equal(update.json.item.originalitySimilarity, 0.18);
  assert.deepEqual(update.json.item.authorship, { user_confirmed: true, ai_assisted: false });
  assert.equal(update.json.item.boundaryOrCounterpoint, "This does not hold when the paragraph has no source trace.");
  assert.equal(path.basename(update.json.item.markdownPath), "Updated title line.md");

  const rejectedConfirmedUpdate = await putJson(baseUrl, `/api/v1/notes/${encodeURIComponent(noteId)}`, {
    body: "# Updated title line\n\nUpdated paragraph.",
    thesis: "A durable writing flow begins from compressed claims, not blank pages.",
    threeLineSummary: [
      "A durable writing flow begins from compressed claims.",
      "That lowers the cost of structuring paragraphs and arguments.",
      "It is most useful when the system turns notes into writing inputs."
    ],
    distillationStatus: "confirmed",
    authorship: {
      user_confirmed: false,
      ai_assisted: false
    }
  });
  assert.equal(rejectedConfirmedUpdate.status, 400);
  assert.equal(rejectedConfirmedUpdate.json.error.code, "PERMANENT_DISTILLATION_CONFIRMATION_REQUIRED");

  const getAfterUpdate = await getJson(baseUrl, `/api/v1/notes/${encodeURIComponent(noteId)}`);
  assert.equal(getAfterUpdate.status, 200);
  assert.equal(getAfterUpdate.json.item.title, "Updated title line");
  assert.equal(getAfterUpdate.json.item.status, "active");
  assert.equal(getAfterUpdate.json.item.thesis, "A durable writing flow begins from compressed claims, not blank pages.");
  assert.deepEqual(getAfterUpdate.json.item.threeLineSummary, [
    "A durable writing flow begins from compressed claims.",
    "That lowers the cost of structuring paragraphs and arguments.",
    "It is most useful when the system turns notes into writing inputs."
  ]);
  assert.equal(getAfterUpdate.json.item.distillationStatus, "draft");
  assert.equal(getAfterUpdate.json.item.originalityStatus, "pass");
  assert.equal(getAfterUpdate.json.item.originalitySimilarity, 0.18);
  assert.deepEqual(getAfterUpdate.json.item.authorship, { user_confirmed: true, ai_assisted: false });
  assert.equal(getAfterUpdate.json.item.boundaryOrCounterpoint, "This does not hold when the paragraph has no source trace.");
  assert.match(getAfterUpdate.json.item.body, /Updated paragraph\./);
  assert.equal(path.basename(getAfterUpdate.json.item.markdownPath), "Updated title line.md");

  const renamedNoteFile = path.join(vaultPath, update.json.item.markdownPath.replaceAll("/", path.sep));
  await assert.rejects(fs.access(noteFile));
  const markdownAfterUpdate = await fs.readFile(renamedNoteFile, "utf8");
  assert.match(markdownAfterUpdate, /# Updated title line/);
  assert.match(markdownAfterUpdate, /status: active/);
  assert.match(markdownAfterUpdate, /thesis: "?A durable writing flow begins from compressed claims, not blank pages\."?/);
  assert.match(markdownAfterUpdate, /three_line_summary:/);
  assert.match(markdownAfterUpdate, /distillation_status: draft/);
  assert.match(markdownAfterUpdate, /originality_status: pass/);
  assert.match(markdownAfterUpdate, /originality_similarity: 0\.18/);
  assert.match(markdownAfterUpdate, /authorship: \{"user_confirmed":true,"ai_assisted":false\}/);
  assert.match(markdownAfterUpdate, /boundary_or_counterpoint: This does not hold when the paragraph has no source trace\./);
  assert.match(markdownAfterUpdate, /Updated paragraph\./);

  const queueSeed = await postJson(baseUrl, "/api/v1/notes", {
    directoryId,
    body: "# Queue seed\n\nThis note still needs a stable judgment."
  });
  assert.equal(queueSeed.status, 201);
  const queueBefore = await getJson(baseUrl, "/api/v1/distillation/queue?targetType=permanent_note&status=missing&limit=20");
  assert.equal(queueBefore.status, 200);
  assert.ok(queueBefore.json.items.some((item) => item.targetId === queueSeed.json.item.id));
  const queueItem = queueBefore.json.items.find((item) => item.targetId === queueSeed.json.item.id);
  assert.deepEqual(queueItem.missing, ["thesis", "three_line_summary"]);

  const distillationPatch = await patchJson(
    baseUrl,
    `/api/v1/permanent-notes/${encodeURIComponent(queueSeed.json.item.id)}/distillation`,
    {
      thesis: "A note becomes useful for writing when its judgment is explicit.",
      threeLineSummary: [
        "A note needs a clear judgment before it can guide writing.",
        "The three-line summary makes the reasoning and use visible.",
        "Confirmation stays separate so the user owns the final claim."
      ],
      boundaryOrCounterpoint: "This breaks when the note still reads like copied source material.",
      distillationStatus: "draft"
    }
  );
  assert.equal(distillationPatch.status, 200);
  assert.equal(distillationPatch.json.item.thesis, "A note becomes useful for writing when its judgment is explicit.");
  assert.equal(distillationPatch.json.item.distillationStatus, "draft");
  assert.equal(distillationPatch.json.item.boundaryOrCounterpoint, "This breaks when the note still reads like copied source material.");
  assert.deepEqual(distillationPatch.json.item.threeLineSummary, [
    "A note needs a clear judgment before it can guide writing.",
    "The three-line summary makes the reasoning and use visible.",
    "Confirmation stays separate so the user owns the final claim."
  ]);

  const rejectedPatchConfirm = await patchJson(
    baseUrl,
    `/api/v1/permanent-notes/${encodeURIComponent(queueSeed.json.item.id)}/distillation`,
    {
      thesis: "A note becomes useful for writing when its judgment is explicit.",
      threeLineSummary: [
        "A note needs a clear judgment before it can guide writing.",
        "The three-line summary makes the reasoning and use visible.",
        "Confirmation stays separate so the user owns the final claim."
      ],
      distillationStatus: "confirmed"
    }
  );
  assert.equal(rejectedPatchConfirm.status, 400);
  assert.equal(rejectedPatchConfirm.json.error.code, "PERMANENT_DISTILLATION_CONFIRMATION_REQUIRED");

  const confirmDistillation = await postJson(
    baseUrl,
    `/api/v1/permanent-notes/${encodeURIComponent(queueSeed.json.item.id)}/distillation/confirm`,
    { confirm: true }
  );
  assert.equal(confirmDistillation.status, 200);
  assert.equal(confirmDistillation.json.item.distillationStatus, "confirmed");
  assert.deepEqual(confirmDistillation.json.item.authorship, { user_confirmed: true, ai_assisted: false });

  const explicitRelation = await postJson(
    baseUrl,
    `/api/v1/notes/${encodeURIComponent(queueSeed.json.item.id)}/relations`,
    {
      toNoteId: noteId,
      relationType: "supports",
      rationale: "The updated note supports this judgment."
    }
  );
  assert.equal(explicitRelation.status, 201, JSON.stringify(explicitRelation.json));

  const relatedConfirmedNote = await getJson(
    baseUrl,
    `/api/v1/notes/${encodeURIComponent(queueSeed.json.item.id)}`
  );
  assert.equal(relatedConfirmedNote.status, 200);
  assert.equal(relatedConfirmedNote.json.item.thinkingStatus.status, "ready_for_index");

  const queueLimitBlocker = await postJson(baseUrl, "/api/v1/notes", {
    directoryId,
    body: "# Queue limit blocker\n\nThis note should not hide confirmed items when status filtering is active."
  });
  assert.equal(queueLimitBlocker.status, 201, JSON.stringify(queueLimitBlocker.json));

  const confirmedQueue = await getJson(baseUrl, "/api/v1/distillation/queue?status=confirmed&limit=1");
  assert.equal(confirmedQueue.status, 200);
  assert.ok(confirmedQueue.json.items.some((item) => item.targetId === queueSeed.json.item.id && item.missing.length === 0));

  const deletedQueueLimitBlocker = await deleteJson(baseUrl, `/api/v1/notes/${encodeURIComponent(queueLimitBlocker.json.item.id)}`);
  assert.equal(deletedQueueLimitBlocker.status, 200);

  const deletedQueueSeed = await deleteJson(baseUrl, `/api/v1/notes/${encodeURIComponent(queueSeed.json.item.id)}`);
  assert.equal(deletedQueueSeed.status, 200);

  const patchedDirectory = await patchJson(baseUrl, `/api/v1/directories/${encodeURIComponent(directoryId)}`, {
    title: "research-updated"
  });
  assert.equal(patchedDirectory.status, 200);
  assert.equal(patchedDirectory.json.item.title, "research-updated");

  const createDir2 = await postJson(baseUrl, "/api/v1/directories", {
    title: "drafts",
    parentDirectoryId: "dir_original_default",
    directoryType: "custom",
    fsPath: path.join(noteRoot, "drafts"),
    maxNotes: 500
  });
  assert.equal(createDir2.status, 201);
  const directoryId2 = createDir2.json.item.id;

  const moved = await postJson(baseUrl, `/api/v1/notes/${encodeURIComponent(noteId)}/move`, {
    directoryId: directoryId2
  });
  assert.equal(moved.status, 200);
  assert.equal(moved.json.item.directoryId, directoryId2);
  assert.equal(path.basename(moved.json.item.markdownPath), "Updated title line.md");
  const movedFile = path.join(vaultPath, moved.json.item.markdownPath.replaceAll("/", path.sep));
  await assert.rejects(fs.access(renamedNoteFile));
  await fs.access(movedFile);

  const listOld = await getJson(baseUrl, `/api/v1/directories/${encodeURIComponent(directoryId)}/notes`);
  assert.equal(listOld.status, 200);
  assert.equal(listOld.json.total, 0);

  const listNew = await getJson(baseUrl, `/api/v1/directories/${encodeURIComponent(directoryId2)}/notes`);
  assert.equal(listNew.status, 200);
  assert.equal(listNew.json.total, 1);
  assert.equal(listNew.json.items[0].id, noteId);

  const deleted = await deleteJson(baseUrl, `/api/v1/notes/${encodeURIComponent(noteId)}`);
  assert.equal(deleted.status, 200);

  const listAfterDelete = await getJson(baseUrl, `/api/v1/directories/${encodeURIComponent(directoryId2)}/notes`);
  assert.equal(listAfterDelete.status, 200);
  assert.equal(listAfterDelete.json.total, 0);

  const getAfterDelete = await getJson(baseUrl, `/api/v1/notes/${encodeURIComponent(noteId)}`);
  assert.equal(getAfterDelete.status, 404);
  await assert.rejects(fs.access(movedFile));
});

test("notes search returns explicit ranking metadata for relation target lookup", async (t) => {
  const vaultPath = await makeTempDir("yansilu-api-note-search-vault-");
  const noteRoot = path.join(vaultPath, "notes", "original");
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

  const createDir = await postJson(baseUrl, "/api/v1/directories", {
    title: "alpha-ranking",
    parentDirectoryId: "dir_original_default",
    directoryType: "custom",
    fsPath: path.join(noteRoot, "alpha-ranking"),
    maxNotes: 500
  });
  assert.equal(createDir.status, 201, JSON.stringify(createDir.json));
  const directoryId = createDir.json.item.id;

  const noteBodies = [
    "# Zeta unrelated\n\nOnly the folder path contains the query term.",
    "# Middle alpha target\n\nThe query appears in the middle of the title.",
    "# Alphabet trail\n\nThe title starts with the query.",
    "# Alpha\n\nThe title exactly matches the query."
  ];

  for (const body of noteBodies) {
    const created = await postJson(baseUrl, "/api/v1/notes", { directoryId, body });
    assert.equal(created.status, 201, JSON.stringify(created.json));
  }

  const search = await getJson(
    baseUrl,
    `/api/v1/notes/search?q=${encodeURIComponent("alpha")}&rootDirectoryId=${encodeURIComponent("dir_original_default")}&limit=10`
  );
  assert.equal(search.status, 200, JSON.stringify(search.json));
  assert.equal(search.json.ranking.method, "sqlite_catalog_note_search_v1");
  assert.deepEqual(search.json.ranking.priority.slice(0, 5), [
    "exact_title",
    "exact_id",
    "title_prefix",
    "id_prefix",
    "title_contains"
  ]);

  const titles = search.json.items.map((item) => item.title);
  assert.deepEqual(titles.slice(0, 4), ["Alpha", "Alphabet trail", "Middle alpha target", "Zeta unrelated"]);
  assert.deepEqual(
    search.json.items.slice(0, 4).map((item) => item.matchKind),
    ["exact_title", "title_prefix", "title_contains", "path_contains"]
  );
  assert.deepEqual(
    search.json.items.slice(0, 4).map((item) => item.rank),
    [0, 2, 4, 7]
  );
});

test("literature notes require paraphrase before they can be marked active", async (t) => {
  const vaultPath = await makeTempDir("yansilu-api-literature-vault-");
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

  const blockedCreate = await postJson(baseUrl, "/api/v1/notes", {
    directoryId: "dir_literature_default",
    status: "active",
    body: "# 概念与语言\n\n## 原文\n\n概念和语言可能让人停留在表层，而未真正进入理解。\n"
  });
  assert.equal(blockedCreate.status, 400);
  assert.equal(blockedCreate.json.error.code, "LITERATURE_PARAPHRASE_REQUIRED");
  assert.equal(blockedCreate.json.error.details.requirement, "paraphrase");
  assert.equal(blockedCreate.json.error.details.requestedStatus, "active");
  assert.match(blockedCreate.json.error.message, /require a paraphrase/i);

  const created = await postJson(baseUrl, "/api/v1/notes", {
    directoryId: "dir_literature_default",
    status: "draft",
    body:
      "# 概念与语言\n\n## 原文\n\n概念和语言可能让人停留在表层，而未真正进入理解。\n\n## 转述\n\n作者在提醒我，语言流畅不等于真正理解。\n"
  });
  assert.equal(created.status, 201);
  assert.equal(created.json.item.noteType, "literature");
  assert.equal(created.json.item.status, "draft");

  const blockedUpdate = await putJson(baseUrl, `/api/v1/notes/${encodeURIComponent(created.json.item.id)}`, {
    status: "active",
    body: "# 概念与语言\n\n## 原文\n\n概念和语言可能让人停留在表层，而未真正进入理解。\n\n## 转述\n\n"
  });
  assert.equal(blockedUpdate.status, 400);
  assert.equal(blockedUpdate.json.error.code, "LITERATURE_PARAPHRASE_REQUIRED");
  assert.equal(blockedUpdate.json.error.details.requirement, "paraphrase");
  assert.match(blockedUpdate.json.error.message, /require a paraphrase/i);

  const activated = await putJson(baseUrl, `/api/v1/notes/${encodeURIComponent(created.json.item.id)}`, {
    status: "active",
    body:
      "# 概念与语言\n\n## 原文\n\n概念和语言可能让人停留在表层，而未真正进入理解。\n\n## 转述\n\n真正的任务不是复述原句，而是说清它改变了我对理解的定义。\n"
  });
  assert.equal(activated.status, 200);
  assert.equal(activated.json.item.status, "active");
  assert.match(activated.json.item.body, /真正的任务不是复述原句/);
});

test("permanent notes recompute originality against linked literature notes", async (t) => {
  const vaultPath = await makeTempDir("yansilu-api-permanent-originality-vault-");
  const noteRoot = path.join(vaultPath, "notes", "original");
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

  const createDir = await postJson(baseUrl, "/api/v1/directories", {
    title: "originality-guard",
    parentDirectoryId: "dir_original_default",
    directoryType: "custom",
    fsPath: path.join(noteRoot, "originality-guard"),
    maxNotes: 500
  });
  assert.equal(createDir.status, 201);
  const directoryId = createDir.json.item.id;

  const literature = await postJson(baseUrl, "/api/v1/notes", {
    directoryId: "dir_literature_default",
    status: "draft",
    body:
      "# 概念与语言\n\n## 原文\n\nAI 不应该成为思想替身，而应该成为思想加速镜。\n\n## 转述\n\nAI 更适合帮助我暴露结构和冲突，而不是代替我做判断。\n"
  });
  assert.equal(literature.status, 201);

  const blockedCreate = await postJson(baseUrl, "/api/v1/notes", {
    directoryId,
    status: "active",
    body:
      "# 镜像句子\n\nAI 不应该成为思想替身，而应该成为思想加速镜。 [[概念与语言]]",
    originalityStatus: "pass",
    authorship: {
      user_confirmed: true,
      ai_assisted: false
    }
  });
  assert.equal(blockedCreate.status, 400);
  assert.equal(blockedCreate.json.error.code, "PERMANENT_ORIGINALITY_BLOCKED");
  assert.equal(blockedCreate.json.error.details.noteType, "permanent");
  assert.equal(blockedCreate.json.error.details.requestedStatus, "active");
  assert.equal(blockedCreate.json.error.details.originality.status, "blocked");
  assert.ok(Number(blockedCreate.json.error.details.originality.similarity) >= 0.8);
  assert.match(blockedCreate.json.error.message, /Permanent note save blocked/i);

  const distinctCreate = await postJson(baseUrl, "/api/v1/notes", {
    directoryId,
    status: "active",
    body:
      "# 我的判断\n\n真正该被加速的不是结论产出，而是我识别论证缺口与结构张力的速度。 [[概念与语言]]",
    originalityStatus: "warning",
    authorship: {
      user_confirmed: true,
      ai_assisted: false
    }
  });
  assert.equal(distinctCreate.status, 201);
  assert.equal(distinctCreate.json.item.status, "active");
  assert.equal(distinctCreate.json.item.originalityStatus, "pass");
  assert.ok(Number(distinctCreate.json.item.originalitySimilarity) < 0.6);

  const downgradedUpdate = await putJson(baseUrl, `/api/v1/notes/${encodeURIComponent(distinctCreate.json.item.id)}`, {
    status: "active",
    body:
      "# 我的判断\n\n这条笔记已经接近外部语言，但我还没有完成作者确认。 [[概念与语言]]",
    authorship: {
      user_confirmed: false,
      ai_assisted: false
    }
  });
  assert.equal(downgradedUpdate.status, 200);
  assert.equal(downgradedUpdate.json.item.status, "draft");
});

test("notes API syncs markdown wikilinks and tags into note relations", async (t) => {
  const vaultPath = await makeTempDir("yansilu-api-note-relations-vault-");
  const noteRoot = path.join(vaultPath, "notes", "original");
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

  const createDir = await postJson(baseUrl, "/api/v1/directories", {
    title: "relations",
    parentDirectoryId: "dir_original_default",
    directoryType: "custom",
    fsPath: path.join(noteRoot, "relations"),
    maxNotes: 500
  });
  assert.equal(createDir.status, 201);
  const directoryId = createDir.json.item.id;

  const targetNote = await postJson(baseUrl, "/api/v1/notes", {
    directoryId,
    body: "# Target idea\n\nThis note should receive a backlink."
  });
  assert.equal(targetNote.status, 201);

  const sourceNote = await postJson(baseUrl, "/api/v1/notes", {
    directoryId,
    body: "# Source idea\n\nThis links to [[Target idea]] and carries #writing #中文标签."
  });
  assert.equal(sourceNote.status, 201);

  const siblingDir = await postJson(baseUrl, "/api/v1/directories", {
    title: "relations-sibling",
    parentDirectoryId: "dir_original_default",
    directoryType: "custom",
    fsPath: path.join(noteRoot, "relations-sibling"),
    maxNotes: 500
  });
  assert.equal(siblingDir.status, 201);
  const siblingNote = await postJson(baseUrl, "/api/v1/notes", {
    directoryId: siblingDir.json.item.id,
    body: "# Sibling tagged note\n\nThis note is in another original directory but shares #writing."
  });
  assert.equal(siblingNote.status, 201);

  const literatureTaggedNote = await postJson(baseUrl, "/api/v1/notes", {
    directoryId: "dir_literature_default",
    body: "# Literature tagged note\n\nThis note should not appear in original-root #writing results."
  });
  assert.equal(literatureTaggedNote.status, 201);

  const sourceRelations = await getJson(baseUrl, `/api/v1/notes/${encodeURIComponent(sourceNote.json.item.id)}/relations`);
  assert.equal(sourceRelations.status, 200);
  assert.deepEqual(
    sourceRelations.json.item.tags.map((tag) => tag.name).sort(),
    ["writing", "中文标签"]
  );
  assert.equal(sourceRelations.json.item.outgoingLinks.length, 1);
  assert.equal(sourceRelations.json.item.outgoingLinks[0].toNoteId, targetNote.json.item.id);
  assert.equal(sourceRelations.json.item.outgoingLinks[0].relationType, "associated_with");
  assert.equal(sourceRelations.json.item.outgoingLinks[0].rationale, "markdown_wikilink");

  const targetRelations = await getJson(baseUrl, `/api/v1/notes/${encodeURIComponent(targetNote.json.item.id)}/relations`);
  assert.equal(targetRelations.status, 200);
  assert.equal(targetRelations.json.item.backlinks.length, 1);
  assert.equal(targetRelations.json.item.backlinks[0].fromNoteId, sourceNote.json.item.id);

  const graph = await getJson(baseUrl, `/api/v1/graph?scope=directory&directoryId=${encodeURIComponent(directoryId)}`);
  assert.equal(graph.status, 200);
  assert.equal(graph.json.item.scope, "directory");
  assert.equal(graph.json.item.directoryId, directoryId);
  assert.equal(graph.json.item.totalNodes, 2);
  assert.equal(graph.json.item.totalEdges, 1);
  assert.equal(graph.json.item.edges[0].fromNoteId, sourceNote.json.item.id);
  assert.equal(graph.json.item.edges[0].toNoteId, targetNote.json.item.id);
  assert.ok(graph.json.item.insights);
  assert.equal(graph.json.item.insights.supportingRelations.length, 0);
  assert.equal(graph.json.item.insights.conflictingRelations.length, 0);
  assert.equal(graph.json.item.insights.untypedRelations.length, 1);
  assert.equal(graph.json.item.insights.bridgeGaps.length, 0);
  assert.equal(graph.json.item.insights.connectedComponentCount, 1);

  const childDir = await postJson(baseUrl, "/api/v1/directories", {
    title: "relations-child",
    parentDirectoryId: directoryId,
    directoryType: "custom",
    fsPath: path.join(noteRoot, "relations", "relations-child"),
    maxNotes: 500
  });
  assert.equal(childDir.status, 201);

  const childTargetNote = await postJson(baseUrl, "/api/v1/notes", {
    directoryId: childDir.json.item.id,
    body: "# Child target idea\n\nThis note should only appear when descendants are included."
  });
  assert.equal(childTargetNote.status, 201);

  const childSourceNote = await postJson(baseUrl, "/api/v1/notes", {
    directoryId: childDir.json.item.id,
    body: "# Child source idea\n\nThis links to [[Child target idea]]."
  });
  assert.equal(childSourceNote.status, 201);

  const graphWithoutDescendants = await getJson(
    baseUrl,
    `/api/v1/graph?scope=directory&directoryId=${encodeURIComponent(directoryId)}&includeDescendants=false`
  );
  assert.equal(graphWithoutDescendants.status, 200);
  assert.equal(graphWithoutDescendants.json.item.scope, "directory");
  assert.equal(graphWithoutDescendants.json.item.includeDescendants, false);
  assert.equal(graphWithoutDescendants.json.item.totalNodes, 2);
  assert.equal(graphWithoutDescendants.json.item.totalEdges, 1);
  assert.equal(graphWithoutDescendants.json.item.nodes.some((item) => item.id === childSourceNote.json.item.id), false);

  const graphWithDescendants = await getJson(
    baseUrl,
    `/api/v1/graph?scope=directory&directoryId=${encodeURIComponent(directoryId)}&includeDescendants=true`
  );
  assert.equal(graphWithDescendants.status, 200);
  assert.equal(graphWithDescendants.json.item.scope, "directory_tree");
  assert.equal(graphWithDescendants.json.item.includeDescendants, true);
  assert.equal(graphWithDescendants.json.item.totalNodes, 4);
  assert.equal(graphWithDescendants.json.item.totalEdges, 2);
  assert.deepEqual(
    graphWithDescendants.json.item.nodes.map((item) => item.id).sort(),
    [sourceNote.json.item.id, targetNote.json.item.id, childSourceNote.json.item.id, childTargetNote.json.item.id].sort()
  );
  assert.deepEqual(
    graphWithDescendants.json.item.edges.map((item) => `${item.fromNoteId}->${item.toNoteId}`).sort(),
    [`${sourceNote.json.item.id}->${targetNote.json.item.id}`, `${childSourceNote.json.item.id}->${childTargetNote.json.item.id}`].sort()
  );

  const originalTagNotes = await getJson(
    baseUrl,
    `/api/v1/tags/${encodeURIComponent("writing")}/notes?rootDirectoryId=${encodeURIComponent("dir_original_default")}`
  );
  assert.equal(originalTagNotes.status, 200);
  assert.equal(originalTagNotes.json.tag, "writing");
  assert.equal(originalTagNotes.json.rootDirectoryId, "dir_original_default");
  assert.deepEqual(
    originalTagNotes.json.items.map((item) => item.id).sort(),
    [sourceNote.json.item.id, siblingNote.json.item.id].sort()
  );

  const scopedTagList = await getJson(
    baseUrl,
    `/api/v1/tags?rootDirectoryId=${encodeURIComponent("dir_original_default")}&q=${encodeURIComponent("writ")}`
  );
  assert.equal(scopedTagList.status, 200);
  assert.equal(scopedTagList.json.rootDirectoryId, "dir_original_default");
  assert.deepEqual(scopedTagList.json.items.map((item) => item.name), ["writing"]);
  assert.equal(scopedTagList.json.items[0].noteCount, 2);

  const allTagNotes = await getJson(baseUrl, `/api/v1/tags/${encodeURIComponent("writing")}/notes`);
  assert.equal(allTagNotes.status, 200);
  assert.deepEqual(
    allTagNotes.json.items.map((item) => item.id).sort(),
    [sourceNote.json.item.id, siblingNote.json.item.id, literatureTaggedNote.json.item.id].sort()
  );

  const update = await putJson(baseUrl, `/api/v1/notes/${encodeURIComponent(sourceNote.json.item.id)}`, {
    body: "# Source idea\n\nThe wikilink and tag were removed."
  });
  assert.equal(update.status, 200);

  const sourceRelationsAfterUpdate = await getJson(
    baseUrl,
    `/api/v1/notes/${encodeURIComponent(sourceNote.json.item.id)}/relations`
  );
  assert.equal(sourceRelationsAfterUpdate.status, 200);
  assert.deepEqual(sourceRelationsAfterUpdate.json.item.tags, []);
  assert.deepEqual(sourceRelationsAfterUpdate.json.item.outgoingLinks, []);

  const targetRelationsAfterUpdate = await getJson(
    baseUrl,
    `/api/v1/notes/${encodeURIComponent(targetNote.json.item.id)}/relations`
  );
  assert.equal(targetRelationsAfterUpdate.status, 200);
  assert.deepEqual(targetRelationsAfterUpdate.json.item.backlinks, []);

  const graphAfterUpdate = await getJson(baseUrl, `/api/v1/graph?scope=directory&directoryId=${encodeURIComponent(directoryId)}`);
  assert.equal(graphAfterUpdate.status, 200);
  assert.equal(graphAfterUpdate.json.item.totalNodes, 2);
  assert.equal(graphAfterUpdate.json.item.totalEdges, 0);
  assert.equal(graphAfterUpdate.json.item.insights.untypedRelations.length, 0);
  assert.equal(graphAfterUpdate.json.item.insights.bridgeGaps.length, 2);
  assert.equal(graphAfterUpdate.json.item.insights.connectedComponentCount, 2);

  const originalTagNotesAfterUpdate = await getJson(
    baseUrl,
    `/api/v1/tags/${encodeURIComponent("writing")}/notes?rootDirectoryId=${encodeURIComponent("dir_original_default")}`
  );
  assert.equal(originalTagNotesAfterUpdate.status, 200);
  assert.deepEqual(originalTagNotesAfterUpdate.json.items.map((item) => item.id), [siblingNote.json.item.id]);
});

test("notes API removes quick formal relations when the backing wikilink is deleted", async (t) => {
  const vaultPath = await makeTempDir("yansilu-api-quick-link-relation-vault-");
  const noteRoot = path.join(vaultPath, "notes", "original");
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

  const createDir = await postJson(baseUrl, "/api/v1/directories", {
    title: "quick-relations",
    parentDirectoryId: "dir_original_default",
    directoryType: "custom",
    fsPath: path.join(noteRoot, "quick-relations"),
    maxNotes: 500
  });
  assert.equal(createDir.status, 201);
  const directoryId = createDir.json.item.id;

  const targetNote = await postJson(baseUrl, "/api/v1/notes", {
    directoryId,
    body: "# Quick target\n\nThis note is linked from the source."
  });
  assert.equal(targetNote.status, 201);

  const sourceNote = await postJson(baseUrl, "/api/v1/notes", {
    directoryId,
    body: "# Quick source\n\nThis source links to [[Quick target]]."
  });
  assert.equal(sourceNote.status, 201);

  const sourceRelations = await getJson(baseUrl, `/api/v1/notes/${encodeURIComponent(sourceNote.json.item.id)}/relations`);
  assert.equal(sourceRelations.status, 200);
  assert.equal(sourceRelations.json.item.outgoingLinks.length, 1);
  const wikilinkRelation = sourceRelations.json.item.outgoingLinks[0];
  assert.equal(wikilinkRelation.rationale, "markdown_wikilink");

  const upgraded = await patchJson(baseUrl, `/api/v1/relations/${encodeURIComponent(wikilinkRelation.id)}`, {
    relationType: "associated_with",
    rationale: "手动确认关联。",
    insightQuestion: "__yansilu_quick_wikilink_association__",
    confidence: 1,
    status: "confirmed"
  });
  assert.equal(upgraded.status, 200, JSON.stringify(upgraded.json));
  assert.equal(upgraded.json.item.rationale, "手动确认关联。");
  assert.equal(upgraded.json.item.insightQuestion, null);

  const targetRelationsBeforeDelete = await getJson(baseUrl, `/api/v1/notes/${encodeURIComponent(targetNote.json.item.id)}/relations`);
  assert.equal(targetRelationsBeforeDelete.status, 200);
  assert.equal(targetRelationsBeforeDelete.json.item.backlinks.length, 1);
  assert.equal(targetRelationsBeforeDelete.json.item.backlinks[0].rationale, "手动确认关联。");

  const update = await putJson(baseUrl, `/api/v1/notes/${encodeURIComponent(sourceNote.json.item.id)}`, {
    body: "# Quick source\n\nThe linked note was intentionally removed from the body."
  });
  assert.equal(update.status, 200);

  const sourceRelationsAfterUpdate = await getJson(baseUrl, `/api/v1/notes/${encodeURIComponent(sourceNote.json.item.id)}/relations`);
  assert.equal(sourceRelationsAfterUpdate.status, 200);
  assert.deepEqual(sourceRelationsAfterUpdate.json.item.outgoingLinks, []);

  const targetRelationsAfterUpdate = await getJson(baseUrl, `/api/v1/notes/${encodeURIComponent(targetNote.json.item.id)}/relations`);
  assert.equal(targetRelationsAfterUpdate.status, 200);
  assert.deepEqual(targetRelationsAfterUpdate.json.item.backlinks, []);

  const graphAfterUpdate = await getJson(baseUrl, `/api/v1/graph?scope=directory&directoryId=${encodeURIComponent(directoryId)}`);
  assert.equal(graphAfterUpdate.status, 200);
  assert.equal(graphAfterUpdate.json.item.totalNodes, 2);
  assert.equal(graphAfterUpdate.json.item.totalEdges, 0);
});

test("graph API finds note paths and duplicate title conflicts", async (t) => {
  const vaultPath = await makeTempDir("yansilu-api-graph-tools-vault-");
  const noteRoot = path.join(vaultPath, "notes", "original");
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

  const createDir = await postJson(baseUrl, "/api/v1/directories", {
    title: "graph-tools",
    parentDirectoryId: "dir_original_default",
    directoryType: "custom",
    fsPath: path.join(noteRoot, "graph-tools"),
    maxNotes: 500
  });
  assert.equal(createDir.status, 201);
  const directoryId = createDir.json.item.id;

  const noteC = await postJson(baseUrl, "/api/v1/notes", {
    directoryId,
    body: "# Path C\n\nThe path should end here."
  });
  assert.equal(noteC.status, 201);

  const noteB = await postJson(baseUrl, "/api/v1/notes", {
    directoryId,
    body: "# Path B\n\nThis links onward to [[Path C]]."
  });
  assert.equal(noteB.status, 201);

  const noteA = await postJson(baseUrl, "/api/v1/notes", {
    directoryId,
    body: "# Path A\n\nThis starts the route through [[Path B]]."
  });
  assert.equal(noteA.status, 201);

  const pathResult = await getJson(
    baseUrl,
    `/api/v1/graph/path?fromNoteId=${encodeURIComponent(noteA.json.item.id)}&toNoteId=${encodeURIComponent(
      noteC.json.item.id
    )}&directoryId=${encodeURIComponent(directoryId)}&maxDepth=4`
  );
  assert.equal(pathResult.status, 200);
  assert.equal(pathResult.json.item.found, true);
  assert.equal(pathResult.json.item.hops, 2);
  assert.deepEqual(pathResult.json.item.path, [noteA.json.item.id, noteB.json.item.id, noteC.json.item.id]);
  assert.deepEqual(
    pathResult.json.item.edges.map((edge) => [edge.fromNoteId, edge.toNoteId]),
    [
      [noteA.json.item.id, noteB.json.item.id],
      [noteB.json.item.id, noteC.json.item.id]
    ]
  );

  const shallowPath = await getJson(
    baseUrl,
    `/api/v1/graph/path?fromNoteId=${encodeURIComponent(noteA.json.item.id)}&toNoteId=${encodeURIComponent(
      noteC.json.item.id
    )}&directoryId=${encodeURIComponent(directoryId)}&maxDepth=1`
  );
  assert.equal(shallowPath.status, 200);
  assert.equal(shallowPath.json.item.found, false);
  assert.deepEqual(shallowPath.json.item.path, []);

  const duplicateA = await postJson(baseUrl, "/api/v1/notes", {
    directoryId,
    body: "# Duplicate idea\n\nFirst version."
  });
  assert.equal(duplicateA.status, 201);
  const duplicateB = await postJson(baseUrl, "/api/v1/notes", {
    directoryId,
    body: "# Duplicate idea\n\nSecond version."
  });
  assert.equal(duplicateB.status, 201);

  const conflicts = await getJson(
    baseUrl,
    `/api/v1/graph/conflicts?directoryId=${encodeURIComponent(directoryId)}&includeDescendants=false`
  );
  assert.equal(conflicts.status, 200);
  assert.equal(conflicts.json.item.scope, "directory");
  assert.equal(conflicts.json.item.total, 1);
  assert.equal(conflicts.json.item.conflicts[0].conflictType, "duplicate_title");
  assert.equal(conflicts.json.item.conflicts[0].severity, "warning");
  assert.deepEqual(conflicts.json.item.conflicts[0].noteIds.sort(), [duplicateA.json.item.id, duplicateB.json.item.id].sort());
});

test("graph AI analysis API returns review-only bridge candidates without relation data", async (t) => {
  const vaultPath = await makeTempDir("yansilu-api-graph-ai-analysis-vault-");
  const noteRoot = path.join(vaultPath, "notes", "original");
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

  const createDir = await postJson(baseUrl, "/api/v1/directories", {
    title: "graph-ai-analysis",
    parentDirectoryId: "dir_original_default",
    directoryType: "custom",
    fsPath: path.join(noteRoot, "graph-ai-analysis"),
    maxNotes: 500
  });
  assert.equal(createDir.status, 201);
  const directoryId = createDir.json.item.id;

  const noteA = await postJson(baseUrl, "/api/v1/notes", {
    directoryId,
    body: "# Reviewable AI relation candidates\n\nAI relation candidates should remain reviewable suggestions. #ai-review"
  });
  const noteB = await postJson(baseUrl, "/api/v1/notes", {
    directoryId,
    body: "# Graph relation review boundary\n\nGraph relation candidates need human review before becoming edges. #ai-review"
  });
  const noteC = await postJson(baseUrl, "/api/v1/notes", {
    directoryId,
    body: "# Writing synthesis\n\nWriting synthesis needs traceable note clusters. #writing"
  });
  assert.equal(noteA.status, 201);
  assert.equal(noteB.status, 201);
  assert.equal(noteC.status, 201);

  const graphBeforeAnalysis = await getJson(
    baseUrl,
    `/api/v1/graph?scope=directory&directoryId=${encodeURIComponent(directoryId)}&includeDescendants=true`
  );
  assert.equal(graphBeforeAnalysis.status, 200, JSON.stringify(graphBeforeAnalysis.json));
  assert.equal(graphBeforeAnalysis.json.item.totalEdges, 0);

  const analysis = await postJson(baseUrl, "/api/v1/graph/ai-analysis", {
    directoryId,
    minRelationConfidence: 0.05,
    persistArtifacts: false
  });
  assert.equal(analysis.status, 200, JSON.stringify(analysis.json));
  assert.equal(analysis.json.item.analysis.analysisMode, "local_graph_rule");
  assert.equal(analysis.json.item.analysis.provenance.canAutoConfirm, false);
  assert.equal(analysis.json.item.reviewItems.artifactsPersisted, false);
  assert.equal(analysis.json.item.reviewItems.summary.canAutoConfirm, false);
  assert.ok(analysis.json.item.analysis.topicCandidates.some((item) => item.title === "ai-review"));
  assert.ok(analysis.json.item.reviewItems.artifacts.some((item) => item.type === "BridgeCard"));
  assert.ok(analysis.json.item.reviewItems.artifacts.some((item) => item.type === "QuestionCard"));
  assert.ok(analysis.json.item.reviewItems.artifacts.every((item) => item.status === "pending_review"));
});

test("notes API keeps title-based filenames unique inside a directory", async (t) => {
  const vaultPath = await makeTempDir("yansilu-api-note-title-path-vault-");
  const noteRoot = path.join(vaultPath, "notes", "original");
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

  const createDir = await postJson(baseUrl, "/api/v1/directories", {
    title: "duplicates",
    parentDirectoryId: "dir_original_default",
    directoryType: "custom",
    fsPath: path.join(noteRoot, "duplicates"),
    maxNotes: 500
  });
  assert.equal(createDir.status, 201);
  const directoryId = createDir.json.item.id;

  const noteA = await postJson(baseUrl, "/api/v1/notes", {
    directoryId,
    body: "# Same title\n\nAlpha."
  });
  assert.equal(noteA.status, 201);
  assert.equal(path.basename(noteA.json.item.markdownPath), "Same title.md");

  const noteB = await postJson(baseUrl, "/api/v1/notes", {
    directoryId,
    body: "# Same title\n\nBeta."
  });
  assert.equal(noteB.status, 201);
  assert.equal(path.basename(noteB.json.item.markdownPath), "Same title 2.md");

  const renamed = await putJson(baseUrl, `/api/v1/notes/${encodeURIComponent(noteB.json.item.id)}`, {
    body: "# Same title\n\nGamma."
  });
  assert.equal(renamed.status, 200);
  assert.equal(path.basename(renamed.json.item.markdownPath), "Same title 2.md");
});

test("notes API stores note assets and serves them back for preview", async (t) => {
  const vaultPath = await makeTempDir("yansilu-api-note-assets-vault-");
  const noteRoot = path.join(vaultPath, "notes", "original");
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

  const createDir = await postJson(baseUrl, "/api/v1/directories", {
    title: "assets",
    parentDirectoryId: "dir_original_default",
    directoryType: "custom",
    fsPath: path.join(noteRoot, "assets"),
    maxNotes: 500
  });
  assert.equal(createDir.status, 201);

  const note = await postJson(baseUrl, "/api/v1/notes", {
    directoryId: createDir.json.item.id,
    body: "# Asset host note\n\nThis note will receive an uploaded image."
  });
  assert.equal(note.status, 201);

  const onePixelPngBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9l9wAAAABJRU5ErkJggg==";
  const upload = await postJson(baseUrl, "/api/v1/assets", {
    noteId: note.json.item.id,
    fileName: "inline-image.png",
    mimeType: "image/png",
    contentBase64: onePixelPngBase64,
    kind: "image"
  });
  assert.equal(upload.status, 201);
  assert.equal(upload.json.item.assetKind, "image");
  assert.match(upload.json.item.assetPath, new RegExp(`^assets/images/${note.json.item.id}/inline-image`));
  assert.match(upload.json.item.markdownLinkPath, /assets\/images\//);

  const assetFile = path.join(vaultPath, upload.json.item.assetPath.replaceAll("/", path.sep));
  await fs.access(assetFile);

  const assetResponse = await fetch(`${baseUrl}/api/v1/assets/file?path=${encodeURIComponent(upload.json.item.assetPath)}`);
  assert.equal(assetResponse.status, 200);
  assert.equal(assetResponse.headers.get("content-type"), "image/png");
  const assetBuffer = Buffer.from(await assetResponse.arrayBuffer());
  assert.ok(assetBuffer.length > 0);
});

test("notes API rewrites relative asset links when moving a note between directories", async (t) => {
  const vaultPath = await makeTempDir("yansilu-api-note-move-assets-vault-");
  const noteRoot = path.join(vaultPath, "notes", "original");
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

  const sourceDir = await postJson(baseUrl, "/api/v1/directories", {
    title: "deep-source",
    parentDirectoryId: "dir_original_default",
    directoryType: "custom",
    fsPath: path.join(noteRoot, "nested", "deep-source"),
    maxNotes: 500
  });
  assert.equal(sourceDir.status, 201, JSON.stringify(sourceDir.json));

  const targetDir = await postJson(baseUrl, "/api/v1/directories", {
    title: "target",
    parentDirectoryId: "dir_original_default",
    directoryType: "custom",
    fsPath: path.join(noteRoot, "target"),
    maxNotes: 500
  });
  assert.equal(targetDir.status, 201, JSON.stringify(targetDir.json));

  const note = await postJson(baseUrl, "/api/v1/notes", {
    directoryId: sourceDir.json.item.id,
    body: "# Asset move note\n\nInitial body."
  });
  assert.equal(note.status, 201, JSON.stringify(note.json));

  const upload = await postJson(baseUrl, "/api/v1/assets", {
    noteId: note.json.item.id,
    fileName: "move-check.txt",
    mimeType: "text/plain",
    contentBase64: Buffer.from("asset move check").toString("base64"),
    kind: "file"
  });
  assert.equal(upload.status, 201, JSON.stringify(upload.json));

  const attached = await putJson(baseUrl, `/api/v1/notes/${encodeURIComponent(note.json.item.id)}`, {
    body: `# Asset move note\n\n[move-check.txt](${upload.json.item.markdownLinkPath})`
  });
  assert.equal(attached.status, 200, JSON.stringify(attached.json));
  const beforeMoveBody = attached.json.item.body;

  const moved = await postJson(baseUrl, `/api/v1/notes/${encodeURIComponent(note.json.item.id)}/move`, {
    directoryId: targetDir.json.item.id
  });
  assert.equal(moved.status, 200, JSON.stringify(moved.json));

  const fetched = await getJson(baseUrl, `/api/v1/notes/${encodeURIComponent(note.json.item.id)}`);
  assert.equal(fetched.status, 200, JSON.stringify(fetched.json));

  const expectedLink = path
    .posix
    .relative(path.posix.dirname(fetched.json.item.markdownPath), upload.json.item.assetPath)
    .replaceAll("\\", "/");
  assert.match(beforeMoveBody, /assets\/files\//);
  assert.match(fetched.json.item.body, markdownDestinationPattern(expectedLink));
  assert.ok(!fetched.json.item.body.includes(upload.json.item.markdownLinkPath));
});

test("notes API handles Chinese and space-containing vault paths with image and file assets", async (t) => {
  const baseRoot = path.join(os.tmpdir(), "\u7814\u601d\u5f55 MVP \u8def\u5f84 \u6d4b\u8bd5");
  await fs.mkdir(baseRoot, { recursive: true });
  const vaultPath = await fs.mkdtemp(path.join(baseRoot, "Vault \u4e2d\u6587 \u7a7a\u683c-"));
  const noteRoot = path.join(vaultPath, "notes", "original");
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

  const sourceDir = await postJson(baseUrl, "/api/v1/directories", {
    title: "\u8d44\u6599 \u6765\u6e90",
    parentDirectoryId: "dir_original_default",
    directoryType: "custom",
    fsPath: path.join(noteRoot, "\u9636\u6bb5 \u4e00", "\u8d44\u6599 \u6765\u6e90"),
    maxNotes: 500
  });
  assert.equal(sourceDir.status, 201, JSON.stringify(sourceDir.json));

  const targetDir = await postJson(baseUrl, "/api/v1/directories", {
    title: "\u8f93\u51fa \u76ee\u6807",
    parentDirectoryId: "dir_original_default",
    directoryType: "custom",
    fsPath: path.join(noteRoot, "\u8f93\u51fa \u76ee\u6807 \u4e2d\u6587"),
    maxNotes: 500
  });
  assert.equal(targetDir.status, 201, JSON.stringify(targetDir.json));

  const note = await postJson(baseUrl, "/api/v1/notes", {
    directoryId: sourceDir.json.item.id,
    body: "# \u4e2d\u6587\u8def\u5f84 \u7b14\u8bb0\n\n\u521d\u59cb\u5185\u5bb9\u3002"
  });
  assert.equal(note.status, 201, JSON.stringify(note.json));
  assert.ok(note.json.item.markdownPath.includes("%") === false);

  const originalMarkdownPath = path.join(vaultPath, note.json.item.markdownPath.replaceAll("/", path.sep));
  await fs.access(originalMarkdownPath);

  const imageUpload = await postJson(baseUrl, "/api/v1/assets", {
    noteId: note.json.item.id,
    fileName: "\u56fe\u50cf \u8d44\u6599.png",
    mimeType: "image/png",
    contentBase64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9l9wAAAABJRU5ErkJggg==",
    kind: "image"
  });
  assert.equal(imageUpload.status, 201, JSON.stringify(imageUpload.json));
  assert.equal(imageUpload.json.item.assetKind, "image");

  const fileUpload = await postJson(baseUrl, "/api/v1/assets", {
    noteId: note.json.item.id,
    fileName: "\u53c2\u8003 \u6587\u4ef6.txt",
    mimeType: "text/plain",
    contentBase64: Buffer.from("asset path with unicode and spaces", "utf8").toString("base64"),
    kind: "file"
  });
  assert.equal(fileUpload.status, 201, JSON.stringify(fileUpload.json));
  assert.equal(fileUpload.json.item.assetKind, "file");

  await fs.access(path.join(vaultPath, imageUpload.json.item.assetPath.replaceAll("/", path.sep)));
  await fs.access(path.join(vaultPath, fileUpload.json.item.assetPath.replaceAll("/", path.sep)));

  const imageAssetResponse = await fetch(`${baseUrl}/api/v1/assets/file?path=${encodeURIComponent(imageUpload.json.item.assetPath)}`);
  assert.equal(imageAssetResponse.status, 200);
  assert.equal(imageAssetResponse.headers.get("content-type"), "image/png");

  const fileAssetResponse = await fetch(`${baseUrl}/api/v1/assets/file?path=${encodeURIComponent(fileUpload.json.item.assetPath)}`);
  assert.equal(fileAssetResponse.status, 200);
  assert.match(fileAssetResponse.headers.get("content-type") || "", /^text\/plain\b/);

  const attached = await putJson(baseUrl, `/api/v1/notes/${encodeURIComponent(note.json.item.id)}`, {
    body: [
      "# \u4e2d\u6587\u8def\u5f84 \u7b14\u8bb0",
      "",
      `![\u56fe\u50cf \u8d44\u6599](${imageUpload.json.item.markdownLinkPath})`,
      "",
      `[\u53c2\u8003 \u6587\u4ef6.txt](${fileUpload.json.item.markdownLinkPath})`
    ].join("\n")
  });
  assert.equal(attached.status, 200, JSON.stringify(attached.json));
  assert.match(attached.json.item.body, new RegExp(escapeRegExp(imageUpload.json.item.markdownLinkPath)));
  assert.match(attached.json.item.body, new RegExp(escapeRegExp(fileUpload.json.item.markdownLinkPath)));

  const moved = await postJson(baseUrl, `/api/v1/notes/${encodeURIComponent(note.json.item.id)}/move`, {
    directoryId: targetDir.json.item.id
  });
  assert.equal(moved.status, 200, JSON.stringify(moved.json));
  assert.equal(moved.json.item.directoryId, targetDir.json.item.id);

  const movedMarkdownPath = path.join(vaultPath, moved.json.item.markdownPath.replaceAll("/", path.sep));
  await assert.rejects(fs.access(originalMarkdownPath));
  await fs.access(movedMarkdownPath);
  assert.equal(path.dirname(movedMarkdownPath), path.resolve(targetDir.json.item.fsPath));

  const fetched = await getJson(baseUrl, `/api/v1/notes/${encodeURIComponent(note.json.item.id)}`);
  assert.equal(fetched.status, 200, JSON.stringify(fetched.json));

  const expectedImageLink = path
    .posix
    .relative(path.posix.dirname(fetched.json.item.markdownPath), imageUpload.json.item.assetPath)
    .replaceAll("\\", "/");
  const expectedFileLink = path
    .posix
    .relative(path.posix.dirname(fetched.json.item.markdownPath), fileUpload.json.item.assetPath)
    .replaceAll("\\", "/");

  assert.match(fetched.json.item.body, markdownDestinationPattern(expectedImageLink));
  assert.match(fetched.json.item.body, markdownDestinationPattern(expectedFileLink));
  assert.ok(!fetched.json.item.body.includes(imageUpload.json.item.markdownLinkPath));
  assert.ok(!fetched.json.item.body.includes(fileUpload.json.item.markdownLinkPath));
});

test("notes AI analysis API stores reviewable local candidates without confirming relations", async (t) => {
  const vaultPath = await makeTempDir("yansilu-api-note-ai-analysis-vault-");
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

  const source = await postJson(baseUrl, "/api/v1/notes", {
    directoryId: "dir_original_default",
    body: "# AI 关系候选\n\nAI 可以帮助用户看见关系，但不能直接替用户确认图谱边。",
    thesis: "AI 关系候选应该帮助用户看见关系，而不是自动替用户确认关系。",
    threeLineSummary: ["候选不是判断。", "确认动作属于用户。", "这能保护原创判断。"],
    boundaryOrCounterpoint: "低风险提示可以自动出现，但图谱边必须人工确认。"
  });
  const target = await postJson(baseUrl, "/api/v1/notes", {
    directoryId: "dir_original_default",
    body: "# 好的关联要写出为什么\n\n好的关联必须说明为什么相关，而不能只画一条线。",
    thesis: "好的关联必须说明为什么相关，而不能只画一条线。",
    threeLineSummary: ["关系需要理由。", "理由帮助复查。", "理由让写作可追溯。"],
    boundaryOrCounterpoint: "弱关系可以留作候选。"
  });
  assert.equal(source.status, 201);
  assert.equal(target.status, 201);

  const analysis = await postJson(baseUrl, `/api/v1/notes/${encodeURIComponent(source.json.item.id)}/ai-analysis`, {
    relatedNoteIds: [target.json.item.id],
    minRelationConfidence: 0.1
  });
  assert.equal(analysis.status, 200, JSON.stringify(analysis.json));
  assert.equal(analysis.json.item.analysis.analysisMode, "local_rule");
  assert.equal(analysis.json.item.reviewItems.artifactsPersisted, true);
  assert.ok(analysis.json.item.reviewItems.summary.artifactCount >= 1);
  assert.ok(analysis.json.item.reviewItems.summary.relationCandidateCount >= 1);
  assert.equal(analysis.json.item.reviewItems.summary.canAutoConfirm, false);
  assert.ok(analysis.json.item.reviewItems.suggestions.every((item) => item.status === "suggested"));
  assert.equal(
    analysis.json.item.reviewItems.storedSuggestionIds.length,
    analysis.json.item.reviewItems.suggestions.length
  );
  assert.equal(analysis.json.item.reviewItems.suggestionsPersisted, true);
  if (analysis.json.item.reviewItems.suggestions.length) {
    assert.ok(
      analysis.json.item.reviewItems.artifacts.some((item) =>
        analysis.json.item.reviewItems.suggestions.some((suggestion) => item.payload?.fieldSuggestion?.id === suggestion.id)
      )
    );
    assert.ok(
      analysis.json.item.reviewItems.artifacts.some((item) =>
        analysis.json.item.reviewItems.suggestions.some((suggestion) => item.payload?.fieldSuggestionId === suggestion.id)
      )
    );
  }

  const inbox = await getJson(baseUrl, `/api/v1/ai/inbox?view=pending&sourceNoteId=${encodeURIComponent(source.json.item.id)}`);
  assert.equal(inbox.status, 200);
  assert.ok(inbox.json.items.some((item) => item.type === "LinkSuggestion"));
  if (analysis.json.item.reviewItems.suggestions.length) {
    assert.ok(inbox.json.items.some((item) => item.type === "InsightCard"));
  }
  assert.ok(inbox.json.items.every((item) => item.status === "pending_review"));

  const relations = await getJson(baseUrl, `/api/v1/notes/${encodeURIComponent(source.json.item.id)}/relations`);
  assert.equal(relations.status, 200);
  assert.equal(relations.json.item.outgoingLinks.length, 0);

  const existingAnalysis = await getJson(baseUrl, `/api/v1/notes/${encodeURIComponent(source.json.item.id)}/ai-analysis`);
  assert.equal(existingAnalysis.status, 200);
  assert.ok(existingAnalysis.json.item.items.some((item) => item.type === "LinkSuggestion"));
  if (analysis.json.item.reviewItems.suggestions.length) {
    assert.ok(existingAnalysis.json.item.items.some((item) => item.payload?.fieldSuggestion?.target?.field));
    const suggestionsList = await getJson(
      baseUrl,
      `/api/v1/ai-suggestions?targetType=permanent_note&targetId=${encodeURIComponent(source.json.item.id)}`
    );
    assert.equal(suggestionsList.status, 200, JSON.stringify(suggestionsList.json));
    assert.equal(suggestionsList.json.total, analysis.json.item.reviewItems.suggestions.length);
    assert.ok(
      suggestionsList.json.items.every((item) =>
        analysis.json.item.reviewItems.storedSuggestionIds.includes(item.id)
      )
    );
    assert.ok(
      suggestionsList.json.items.every((item) =>
        existingAnalysis.json.item.items.some((artifact) => artifact.payload?.fieldSuggestionId === item.id && item.sourceArtifactId === artifact.artifactId)
      )
    );

    const canonicalSuggestionsList = await getJson(
      baseUrl,
      `/api/v1/ai-suggestions?canonical=true&targetType=permanent_note&targetId=${encodeURIComponent(source.json.item.id)}`
    );
    assert.equal(canonicalSuggestionsList.status, 200, JSON.stringify(canonicalSuggestionsList.json));
    assert.equal(canonicalSuggestionsList.json.canonical.items.length, analysis.json.item.reviewItems.suggestions.length);
    assert.ok(
      canonicalSuggestionsList.json.canonical.items.every((item) =>
        analysis.json.item.reviewItems.storedSuggestionIds.includes(item.id)
      )
    );
    assert.ok(
      canonicalSuggestionsList.json.canonical.items.every((item) =>
        existingAnalysis.json.item.items.some((artifact) => artifact.payload?.fieldSuggestionId === item.id && item.source_artifact_id === artifact.artifactId)
      )
    );
  }

  const localModelPreview = await postJson(baseUrl, `/api/v1/notes/${encodeURIComponent(source.json.item.id)}/ai-analysis`, {
    relatedNoteIds: [target.json.item.id],
    prepareLocalModelRequest: true,
    localModel: "qwen2.5:7b",
    persistArtifacts: false
  });
  assert.equal(localModelPreview.status, 200, JSON.stringify(localModelPreview.json));
  assert.equal(localModelPreview.json.item.localModelRequest.requestType, "permanent_note_local_model_analysis");
  assert.equal(localModelPreview.json.item.localModelRequest.privacy.mode, "local_only");
  assert.equal(localModelPreview.json.item.localModelRequest.model.model, "qwen2.5:7b");
  assert.equal(localModelPreview.json.item.localModelRequest.canAutoConfirm, false);
  assert.equal(localModelPreview.json.item.reviewItems.artifactsPersisted, false);

  const rejectedLocalModelPreview = await postJson(baseUrl, `/api/v1/notes/${encodeURIComponent(source.json.item.id)}/ai-analysis`, {
    relatedNoteIds: [target.json.item.id],
    prepareLocalModelRequest: true,
    localModel: "llama3.2:3b",
    persistArtifacts: false
  });
  assert.equal(rejectedLocalModelPreview.status, 400, JSON.stringify(rejectedLocalModelPreview.json));
  assert.equal(rejectedLocalModelPreview.json.error.code, "OLLAMA_MODEL_NOT_ALLOWED");
  assert.deepEqual(rejectedLocalModelPreview.json.error.details.allowedModels, ["qwen2.5:7b", "qwen3:8b", "qwen3.5:9b"]);

  const localModelMerge = await postJson(baseUrl, `/api/v1/notes/${encodeURIComponent(source.json.item.id)}/ai-analysis`, {
    relatedNoteIds: [target.json.item.id],
    localModel: "qwen2.5:7b",
    localModelResponse: {
      distilledViewpoint: {
        thesis: "Local model output should remain a candidate until the user accepts it.",
        threeLineSummary: [
          "The model can propose a concise claim.",
          "Relations and topics stay reviewable.",
          "No graph edge or field is confirmed automatically."
        ]
      },
      relationCandidates: [
        {
          toNoteId: target.json.item.id,
          relationType: "supports",
          rationale: "Both notes discuss reviewable relation candidates.",
          confidence: 0.66
        }
      ],
      topicCandidates: [{ title: "AI review boundary", rationale: "The note is about review-first AI output." }],
      principleWarnings: [{ checkId: "authorship_boundary", message: "Review model wording before adoption." }]
    },
    persistArtifacts: false
  });
  assert.equal(localModelMerge.status, 200, JSON.stringify(localModelMerge.json));
  assert.equal(localModelMerge.json.item.analysis.analysisMode, "local_model_assisted");
  assert.equal(localModelMerge.json.item.analysis.provenance.cloudModelUsed, false);
  assert.equal(localModelMerge.json.item.reviewItems.summary.canAutoConfirm, false);
  assert.ok(localModelMerge.json.item.reviewItems.artifacts.every((item) => item.status === "pending_review"));
  assert.ok(localModelMerge.json.item.reviewItems.artifacts.every((item) => item.origin === "local_model"));
  assert.ok(localModelMerge.json.item.reviewItems.suggestions.every((item) => item.status === "suggested"));

  const rejectedLocalModelMerge = await postJson(baseUrl, `/api/v1/notes/${encodeURIComponent(source.json.item.id)}/ai-analysis`, {
    relatedNoteIds: [target.json.item.id],
    localModel: "llama3.2:3b",
    localModelResponse: {
      distilledViewpoint: {
        thesis: "This should not be accepted with a non-catalog model.",
        threeLineSummary: ["A", "B", "C"]
      }
    },
    persistArtifacts: false
  });
  assert.equal(rejectedLocalModelMerge.status, 400, JSON.stringify(rejectedLocalModelMerge.json));
  assert.equal(rejectedLocalModelMerge.json.error.code, "OLLAMA_MODEL_NOT_ALLOWED");

  const draftTarget = await postJson(baseUrl, "/api/v1/notes", {
    directoryId: "dir_original_default",
    body: "# AI 字段候选\n\nAI 可以提出一句话判断，但只能先进入草稿。"
  });
  assert.equal(draftTarget.status, 201, JSON.stringify(draftTarget.json));

  const fieldAnalysis = await postJson(baseUrl, `/api/v1/notes/${encodeURIComponent(draftTarget.json.item.id)}/ai-analysis`, {});
  assert.equal(fieldAnalysis.status, 200, JSON.stringify(fieldAnalysis.json));
  const storedFieldSuggestionId = fieldAnalysis.json.item.reviewItems.storedSuggestionIds[0];
  assert.ok(storedFieldSuggestionId);
  const fieldArtifact = fieldAnalysis.json.item.reviewItems.artifacts.find(
    (artifact) => artifact.type === "InsightCard" && artifact.payload?.fieldSuggestion?.target?.field === "thesis"
  );
  assert.ok(fieldArtifact, "expected a persisted thesis field suggestion artifact");
  assert.equal(fieldArtifact.payload.fieldSuggestionId, storedFieldSuggestionId);

  const adoptedField = await postJson(baseUrl, `/api/v1/ai/inbox/${encodeURIComponent(fieldArtifact.id)}/adopt-field-suggestion`, {
    confirm: true,
    comment: "Use the AI thesis as a draft only.",
    feedback: { useful: true }
  });
  assert.equal(adoptedField.status, 200, JSON.stringify(adoptedField.json));
  assert.equal(adoptedField.json.item.status, "adopted_as_draft");
  assert.equal(adoptedField.json.latestDecision.decision, "adopted_as_draft");
  assert.equal(adoptedField.json.latestDecision.noteId, draftTarget.json.item.id);
  assert.equal(adoptedField.json.adoptedField, "thesis");
  assert.equal(adoptedField.json.note.thesis, fieldArtifact.payload.fieldSuggestion.content.thesis);
  assert.equal(adoptedField.json.note.distillationStatus, "draft");
  assert.deepEqual(adoptedField.json.note.authorship, { user_confirmed: false, ai_assisted: true });
  assert.equal(adoptedField.json.suggestion.id, storedFieldSuggestionId);
  assert.equal(adoptedField.json.suggestion.status, "adopted_as_draft");
  assert.equal(adoptedField.json.suggestion.history[0].toStatus, "adopted_as_draft");
  assert.equal(adoptedField.json.artifact.payload.fieldSuggestion.status, "adopted_as_draft");
  assert.equal(adoptedField.json.artifact.payload.fieldSuggestion.target.field, "thesis");
  assert.equal(adoptedField.json.artifact.payload.fieldSuggestion.target.id, draftTarget.json.item.id);
  assert.equal(adoptedField.json.artifact.payload.adoptedNoteId, draftTarget.json.item.id);

  const existingViewpointAnalysis = await postJson(baseUrl, `/api/v1/notes/${encodeURIComponent(source.json.item.id)}/ai-analysis`, {
    localModel: "qwen2.5:7b",
    localModelResponse: {
      distilledViewpoint: {
        thesis: "AI 可以提出关系判断，但用户仍需确认它是否成为自己的观点。",
        threeLineSummary: []
      }
    }
  });
  assert.equal(existingViewpointAnalysis.status, 200, JSON.stringify(existingViewpointAnalysis.json));
  const existingViewpointArtifact = existingViewpointAnalysis.json.item.reviewItems.artifacts.find(
    (artifact) => artifact.type === "InsightCard" && artifact.payload?.fieldSuggestion?.target?.field === "thesis"
  );
  assert.ok(existingViewpointArtifact, "expected a thesis suggestion for a note with an existing viewpoint");
  const adoptedExistingViewpoint = await postJson(
    baseUrl,
    `/api/v1/ai/inbox/${encodeURIComponent(existingViewpointArtifact.id)}/adopt-field-suggestion`,
    { confirm: true }
  );
  assert.equal(adoptedExistingViewpoint.status, 200, JSON.stringify(adoptedExistingViewpoint.json));
  assert.equal(adoptedExistingViewpoint.json.note.thesis, "AI 可以提出关系判断，但用户仍需确认它是否成为自己的观点。");
  assert.equal(adoptedExistingViewpoint.json.note.distillationStatus, "draft");
  assert.deepEqual(adoptedExistingViewpoint.json.note.viewpointHistory, []);
  assert.equal(
    adoptedExistingViewpoint.json.note.pendingViewpointRevision?.previousThesis,
    "AI 关系候选应该帮助用户看见关系，而不是自动替用户确认关系。"
  );
  assert.equal(adoptedExistingViewpoint.json.note.pendingViewpointRevision?.reason, "采纳 AI 建议作为待确认草稿。");

  const committedExistingViewpoint = await patchJson(
    baseUrl,
    `/api/v1/permanent-notes/${encodeURIComponent(source.json.item.id)}/distillation`,
    {
      thesis: adoptedExistingViewpoint.json.note.thesis,
      thesisChangeReason: "用户核对来源后确认这条新判断。",
      commitViewpointChange: true,
      distillationStatus: "draft"
    }
  );
  assert.equal(committedExistingViewpoint.status, 200, JSON.stringify(committedExistingViewpoint.json));
  assert.equal(committedExistingViewpoint.json.item.pendingViewpointRevision, null);
  assert.equal(committedExistingViewpoint.json.item.viewpointHistory.at(-1)?.reason, "用户核对来源后确认这条新判断。");

  const adoptedFieldAgain = await postJson(baseUrl, `/api/v1/ai/inbox/${encodeURIComponent(fieldArtifact.id)}/adopt-field-suggestion?canonical=true`, {
    confirm: true
  });
  assert.equal(adoptedFieldAgain.status, 200, JSON.stringify(adoptedFieldAgain.json));
  assert.equal(adoptedFieldAgain.json.item.status, "adopted_as_draft");
  assert.equal(adoptedFieldAgain.json.latestDecision.decision, "adopted_as_draft");
  assert.equal(adoptedFieldAgain.json.note.id, draftTarget.json.item.id);
  assert.equal(adoptedFieldAgain.json.item.decisionCount, adoptedField.json.item.decisionCount);
  assert.equal(adoptedFieldAgain.json.artifact.userDecisions.length, adoptedField.json.artifact.userDecisions.length);
  assert.equal(adoptedFieldAgain.json.canonical.latestDecision.metadata.from_status, "pending_review");

  const adoptedFieldCanonicalDetail = await getJson(
    baseUrl,
    `/api/v1/ai/inbox/${encodeURIComponent(fieldArtifact.id)}?canonical=true`
  );
  assert.equal(adoptedFieldCanonicalDetail.status, 200, JSON.stringify(adoptedFieldCanonicalDetail.json));
  assert.equal(adoptedFieldCanonicalDetail.json.canonical.artifact.field_suggestion_id, storedFieldSuggestionId);
  assert.equal(adoptedFieldCanonicalDetail.json.canonical.artifact.payload.fieldSuggestion.status, "adopted_as_draft");
  assert.equal(adoptedFieldCanonicalDetail.json.canonical.artifact.payload.fieldSuggestion.target.field, "thesis");
  assert.equal(adoptedFieldCanonicalDetail.json.canonical.artifact.payload.fieldSuggestion.target.id, draftTarget.json.item.id);

  const adoptedSuggestion = await getJson(
    baseUrl,
    `/api/v1/ai-suggestions/${encodeURIComponent(storedFieldSuggestionId)}?canonical=true`
  );
  assert.equal(adoptedSuggestion.status, 200, JSON.stringify(adoptedSuggestion.json));
  assert.equal(adoptedSuggestion.json.item.status, "adopted_as_draft");
  assert.equal(adoptedSuggestion.json.item.sourceArtifactId, fieldArtifact.id);
  assert.equal(adoptedSuggestion.json.canonical.item.status, "adopted_as_draft");
  assert.equal(adoptedSuggestion.json.canonical.item.source_artifact_id, fieldArtifact.id);
  assert.equal(adoptedSuggestion.json.canonical.item.history[0].to_status, "adopted_as_draft");

  const invalidRejectedSuggestion = await patchJson(
    baseUrl,
    `/api/v1/ai-suggestions/${encodeURIComponent(storedFieldSuggestionId)}?canonical=true`,
    {
      status: "rejected",
      action: "reject",
      actor: "user",
      userId: "user_1",
      comment: "This should fail after adoption."
    }
  );
  assert.equal(invalidRejectedSuggestion.status, 400, JSON.stringify(invalidRejectedSuggestion.json));
  assert.equal(invalidRejectedSuggestion.json.error.code, "AI_SUGGESTION_TRANSITION_INVALID");

  const detailAfterInvalidReject = await getJson(
    baseUrl,
    `/api/v1/ai/inbox/${encodeURIComponent(fieldArtifact.id)}?canonical=true`
  );
  assert.equal(detailAfterInvalidReject.status, 200, JSON.stringify(detailAfterInvalidReject.json));
  assert.equal(detailAfterInvalidReject.json.item.status, "adopted_as_draft");
  assert.equal(detailAfterInvalidReject.json.canonical.suggestion.status, "adopted_as_draft");

  const editedSuggestion = await patchJson(
    baseUrl,
    `/api/v1/ai-suggestions/${encodeURIComponent(storedFieldSuggestionId)}?canonical=true`,
    {
      status: "edited",
      action: "edit",
      actor: "user",
      userId: "user_1",
      content: {
        thesis: "AI suggestions can become user-owned claims after explicit editing."
      }
    }
  );
  assert.equal(editedSuggestion.status, 200, JSON.stringify(editedSuggestion.json));
  assert.equal(editedSuggestion.json.item.status, "edited");
  assert.equal(editedSuggestion.json.item.content.thesis, "AI suggestions can become user-owned claims after explicit editing.");
  assert.equal(editedSuggestion.json.canonical.latest_review_event.event_type, "edited");

  const confirmedSuggestion = await patchJson(
    baseUrl,
    `/api/v1/ai-suggestions/${encodeURIComponent(storedFieldSuggestionId)}?canonical=true`,
    {
      status: "confirmed",
      action: "confirm",
      actor: "user",
      userId: "user_1",
      userConfirmed: true,
      content: {
        thesis: "AI suggestions can become user-owned claims after explicit editing."
      }
    }
  );
  assert.equal(confirmedSuggestion.status, 200, JSON.stringify(confirmedSuggestion.json));
  assert.equal(confirmedSuggestion.json.item.status, "confirmed");
  assert.equal(confirmedSuggestion.json.canonical.latest_review_event.event_type, "confirmed");
  assert.equal(confirmedSuggestion.json.canonical.review_events.at(-1).metadata.to_status, "confirmed");

  const confirmedFieldCanonicalDetail = await getJson(
    baseUrl,
    `/api/v1/ai/inbox/${encodeURIComponent(fieldArtifact.id)}?canonical=true`
  );
  assert.equal(confirmedFieldCanonicalDetail.status, 200, JSON.stringify(confirmedFieldCanonicalDetail.json));
  assert.equal(confirmedFieldCanonicalDetail.json.canonical.suggestion.status, "confirmed");
  assert.equal(confirmedFieldCanonicalDetail.json.canonical.suggestion.content.thesis, "AI suggestions can become user-owned claims after explicit editing.");
  assert.equal(confirmedFieldCanonicalDetail.json.canonical.latest_suggestion_review_event.event_type, "confirmed");
  assert.equal(confirmedFieldCanonicalDetail.json.canonical.suggestion_review_events.at(-1).metadata.to_status, "confirmed");

  const rejectTarget = await postJson(baseUrl, "/api/v1/notes", {
    directoryId: "dir_original_default",
    title: "Reject target",
    noteType: "permanent",
    body: "# Reject target\n\nThis note should exercise suggestion rejection from AI inbox."
  });
  assert.equal(rejectTarget.status, 201, JSON.stringify(rejectTarget.json));

  const rejectAnalysis = await postJson(baseUrl, `/api/v1/notes/${encodeURIComponent(rejectTarget.json.item.id)}/ai-analysis`, {});
  assert.equal(rejectAnalysis.status, 200, JSON.stringify(rejectAnalysis.json));
  const rejectSuggestionId = rejectAnalysis.json.item.reviewItems.storedSuggestionIds[0];
  assert.ok(rejectSuggestionId);
  const rejectArtifact = rejectAnalysis.json.item.reviewItems.artifacts.find(
    (artifact) => artifact.type === "InsightCard" && artifact.payload?.fieldSuggestionId === rejectSuggestionId
  );
  assert.ok(rejectArtifact, "expected a persisted field suggestion artifact for rejection");

  const rejectedSuggestion = await patchJson(
    baseUrl,
    `/api/v1/ai-suggestions/${encodeURIComponent(rejectSuggestionId)}?canonical=true`,
    {
      status: "rejected",
      action: "reject",
      actor: "user",
      userId: "user_1",
      comment: "Not useful enough for drafting."
    }
  );
  assert.equal(rejectedSuggestion.status, 200, JSON.stringify(rejectedSuggestion.json));
  assert.equal(rejectedSuggestion.json.item.status, "rejected");
  assert.equal(rejectedSuggestion.json.canonical.latest_review_event.event_type, "rejected");
  assert.equal(rejectedSuggestion.json.canonical.artifact.status, "ignored");

  const rejectedInboxDetail = await getJson(
    baseUrl,
    `/api/v1/ai/inbox/${encodeURIComponent(rejectArtifact.id)}?canonical=true`
  );
  assert.equal(rejectedInboxDetail.status, 200, JSON.stringify(rejectedInboxDetail.json));
  assert.equal(rejectedInboxDetail.json.item.status, "ignored");
  assert.equal(rejectedInboxDetail.json.canonical.artifact.status, "ignored");
  assert.equal(rejectedInboxDetail.json.canonical.suggestion.status, "rejected");

  const reviewedAfterReject = await getJson(
    baseUrl,
    `/api/v1/ai/inbox?view=reviewed&sourceNoteId=${encodeURIComponent(rejectTarget.json.item.id)}`
  );
  assert.equal(reviewedAfterReject.status, 200, JSON.stringify(reviewedAfterReject.json));
  assert.ok(reviewedAfterReject.json.items.some((entry) => entry.artifactId === rejectArtifact.id && entry.status === "ignored"));

  const adoptedNote = await getJson(baseUrl, `/api/v1/notes/${encodeURIComponent(draftTarget.json.item.id)}`);
  assert.equal(adoptedNote.status, 200, JSON.stringify(adoptedNote.json));
  assert.equal(adoptedNote.json.item.thesis, fieldArtifact.payload.fieldSuggestion.content.thesis);
  assert.deepEqual(adoptedNote.json.item.authorship, { user_confirmed: false, ai_assisted: true });

  const localProvider = await startJsonProvider({
    distilledViewpoint: {
      thesis: "Executed local model output must stay reviewable.",
      threeLineSummary: [
        "The API can execute a configured local provider.",
        "Provider output is normalized as review items.",
        "No graph edge or note field is confirmed automatically."
      ]
    },
    relationCandidates: [
      {
        toNoteId: target.json.item.id,
        relationType: "supports",
        rationale: "The executed provider also keeps relations review-only.",
        confidence: 0.71
      }
    ],
    topicCandidates: [{ title: "executed local analysis", rationale: "Provider execution is now wired through the API." }]
  });
  t.after(() => localProvider.server.close());

  const providerConfig = await postJson(baseUrl, "/api/v1/ai/provider-configs", {
    providerId: "ollama_local_gateway",
    authMode: "local_no_key",
    endpointUrl: `${localProvider.baseUrl}/v1/chat/completions`
  });
  assert.equal(providerConfig.status, 200, JSON.stringify(providerConfig.json));

  const executedLocalModel = await postJson(baseUrl, `/api/v1/notes/${encodeURIComponent(source.json.item.id)}/ai-analysis`, {
    relatedNoteIds: [target.json.item.id],
    executeLocalModel: true,
    localModel: "qwen2.5:7b",
    persistArtifacts: false
  });
  assert.equal(executedLocalModel.status, 200, JSON.stringify(executedLocalModel.json));
  assert.equal(executedLocalModel.json.item.analysis.analysisMode, "local_model_assisted");
  assert.equal(executedLocalModel.json.item.analysis.provenance.cloudModelUsed, false);
  assert.equal(executedLocalModel.json.item.modelExecution.status, "succeeded");
  assert.equal(executedLocalModel.json.item.modelExecution.providerId, "ollama_local_gateway");
  assert.equal(executedLocalModel.json.item.reviewItems.artifactsPersisted, false);
  assert.ok(executedLocalModel.json.item.reviewItems.artifacts.every((item) => item.status === "pending_review"));
  assert.ok(executedLocalModel.json.item.reviewItems.artifacts.every((item) => item.origin === "local_model"));
  assert.equal(localProvider.requests.length, 1);
  assert.equal(localProvider.requests[0].body.model, "qwen2.5:7b");
});

test("notes AI analysis API rejects non-permanent notes", async (t) => {
  const vaultPath = await makeTempDir("yansilu-api-note-ai-analysis-reject-vault-");
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

  const literature = await postJson(baseUrl, "/api/v1/notes", {
    directoryId: "dir_literature_default",
    body: "# Literature note\n\n## Paraphrase\n\nThis source has been paraphrased."
  });
  assert.equal(literature.status, 201);

  const analysis = await postJson(baseUrl, `/api/v1/notes/${encodeURIComponent(literature.json.item.id)}/ai-analysis`, {});
  assert.equal(analysis.status, 400);
  assert.equal(analysis.json.error.code, "NOTE_AI_ANALYSIS_PERMANENT_REQUIRED");
});
