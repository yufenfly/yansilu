import test from "node:test";
import assert from "node:assert/strict";

import {
  createLocalDraftNote,
  deriveWritingProjectIntent,
  deriveWritingProjectTakeaway,
  directoryPathLabel,
  displayFolderName,
  distillationReasonOf,
  distillationStageLabel,
  distillationStageOf,
  distillationStatusLabel,
  distillationStatusOf,
  mapDirectoryItem,
  moduleLabel,
  mapNoteItem,
  noteMatchesSearchQuery,
  noteTypeLabel,
  relationNetworkWorkflowMessageForNote,
  saveAiSuggestionKey,
  sourceNoteTypeLabel,
  sourcePromotionWorkflowMessageForNote,
  workflowMessageDedupeKey,
  writingProjectStatusLabel
} from "../../apps/web/src/prototype-note-state-helpers.js";

const deps = {
  generatedOriginalNoteIdFromBody: (body) => body.includes("origin") ? "origin-note" : "",
  normalizeAuthorshipItem: (value) => value && typeof value === "object"
    ? { user_confirmed: Boolean(value.user_confirmed), ai_assisted: Boolean(value.ai_assisted) }
    : null,
  normalizeOptionalNumber: (value) => Number.isFinite(Number(value)) ? Number(value) : null,
  normalizeThinkingStatusItem: (value) => value || null,
  relationNetworkStatusForNote: (note) => note.relationNetworkStatus || "isolated",
  state: {},
  typeFromFolder: (_state, folderId) => folderId === "lit" ? "literature" : "permanent"
};

test("prototype note state helpers derive writing project intent and takeaway", () => {
  assert.equal(deriveWritingProjectIntent({ goal: "Goal" }), "Goal");
  assert.equal(deriveWritingProjectIntent({ title: "主题", indexCard: { central_question: "问题" } }), "问题");
  assert.equal(deriveWritingProjectIntent({ title: "主题" }), "说明「主题」这组材料到底想表达什么判断。");
  assert.equal(deriveWritingProjectTakeaway({ title: "主题", audience: "读者" }), "读者 读完后应带走这个判断：说明「主题」这组材料到底想表达什么判断。");
});

test("prototype note state helpers map directories and notes", () => {
  assert.deepEqual(mapDirectoryItem({
    id: "dir",
    title: "目录",
    parentDirectoryId: "root",
    isDefault: 1,
    isHidden: 0,
    maxNotes: "12",
    fsPath: "/notes"
  }), {
    id: "dir",
    name: "目录",
    parentId: "root",
    isDefault: true,
    hidden: false,
    maxCards: 12,
    fsPath: "/notes"
  });

  const note = mapNoteItem({
    id: "n1",
    title: "Title",
    directoryId: "lit",
    body: "origin body",
    originality_similarity: "0.12",
    authorship_confirmed: true,
    authorship_ai_assisted: false,
    thinkingStatus: { label: "Next" }
  }, deps);
  assert.equal(note.noteType, "literature");
  assert.equal(note.originalitySimilarity, 0.12);
  assert.deepEqual(note.authorship, { user_confirmed: true, ai_assisted: false });
  assert.equal(note.generatedOriginalNoteId, "origin-note");
});

test("prototype note state helpers create local drafts through injected deps", () => {
  const note = createLocalDraftNote({ folderId: "perm", body: "draft" }, {
    ...deps,
    ensureEditableNoteBody: (body) => `# ${body}`,
    uid: (prefix) => `${prefix}_1`
  });
  assert.equal(note.id, "local_note_1");
  assert.equal(note.noteType, "permanent");
  assert.equal(note.bodyLoaded, true);
  assert.equal(note.isLocalOnly, true);
});

test("prototype note state helpers compute labels and distillation stages", () => {
  assert.equal(moduleLabel("graph"), "关系图谱");
  assert.equal(moduleLabel("backup"), "备份与恢复");
  assert.equal(moduleLabel("unknown"), "工作台");
  assert.equal(displayFolderName({ id: "dir_original_default" }), "永久笔记盒");
  assert.equal(noteTypeLabel("literature"), "文献笔记");
  assert.equal(sourceNoteTypeLabel("fleeting"), "随笔");
  assert.equal(sourceNoteTypeLabel("other"), "来源笔记");
  assert.equal(noteMatchesSearchQuery({ title: "Alpha", body: "Body", tags: ["tag"] }, "alp"), true);
  assert.equal(noteMatchesSearchQuery({ title: "Alpha", body: "Body", tags: ["tag"] }, "missing"), false);
  assert.equal(noteTypeLabel("unknown"), "笔记");
  assert.equal(writingProjectStatusLabel("active"), "进行中");
  assert.equal(writingProjectStatusLabel(""), "草稿中");

  assert.equal(distillationStatusOf({}), "missing");
  assert.equal(distillationStatusOf({ thesis: "判断" }), "draft");
  assert.equal(distillationStatusOf({ distillationStatus: "confirmed" }), "confirmed");
  assert.equal(distillationReasonOf({ thesis: "判断", threeLineSummary: ["a"] }), "待确认观点");
  assert.equal(distillationStatusLabel("draft"), "待确认");
  assert.equal(distillationStageOf({ thesis: "判断", threeLineSummary: ["a", "b", "c"] }), "needs_confirm");
  assert.equal(distillationStageOf({ thesis: "判断", threeLineSummary: ["a"] }), "needs_confirm");
});

test("prototype note state helpers build directory path labels", () => {
  const folders = new Map([
    ["root", { id: "root", name: "永久笔记目录" }],
    ["child", { id: "child", parentId: "root", name: "主题" }]
  ]);
  assert.equal(directoryPathLabel("child", {
    state: {},
    folderById: (_state, id) => folders.get(id) || null
  }), "永久笔记盒 / 主题");
  assert.equal(directoryPathLabel("missing", {
    state: {},
    folderById: () => null
  }), "未选择目录");
});

test("prototype note state helpers build stable AI suggestion keys", () => {
  assert.equal(saveAiSuggestionKey({ id: "n1", updatedAt: "2026-01-01", body: "body" }, "record"), "n1:2026-01-01:record");
  assert.equal(saveAiSuggestionKey({ id: "n1", body: "body" }, "record"), "n1:4:body:record");
  assert.equal(workflowMessageDedupeKey("n1", "category", "focus"), "category:n1:focus");
});

test("prototype note state helpers build workflow system messages", () => {
  const sourceMessage = sourcePromotionWorkflowMessageForNote({
    id: "n1",
    title: "文献",
    folderId: "lit"
  }, { text: "提示" }, {
    isOriginalRecordableSource: () => true,
    noteHasGeneratedOriginal: () => false,
    state: {},
    typeFromFolder: (_state, folderId) => folderId === "lit" ? "literature" : "fleeting"
  });

  assert.equal(sourceMessage.category, "source-promotion");
  assert.equal(sourceMessage.title, "文献 适合生成永久笔记");
  assert.match(sourceMessage.body, /当前提示：提示/);
  assert.equal(sourceMessage.workflowRoute.focus, "record-permanent");

  const resolved = relationNetworkWorkflowMessageForNote(
    { id: "n2", title: "永久" },
    { relationState: "loaded", explicitRelationCount: 1 },
    { distillationStatusOf: () => "confirmed", isPermanentLikeNote: () => true }
  );
  assert.deepEqual(resolved, { resolved: true, dedupeKey: "relation-network:n2:relations" });

  const relationMessage = relationNetworkWorkflowMessageForNote(
    { id: "n2", title: "永久" },
    {},
    { distillationStatusOf: () => "confirmed", isPermanentLikeNote: () => true }
  );
  assert.equal(relationMessage.category, "relation-network");
  assert.equal(relationMessage.title, "永久 还没关联");
  assert.equal(relationMessage.actionLabel, "关联一条笔记");
});
