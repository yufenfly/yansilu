import test from "node:test";
import assert from "node:assert/strict";
import {
  buildExplorerSidebarFlowState,
  distillationSummaryForSidebarFlow,
  handleSidebarFlowAction,
  installSidebarFlowEventHandler,
  renderExplorerSidebarFlowForRuntime,
  renderExplorerSidebarFlowMarkup,
  sidebarFlowNoteHasNetworkSignal
} from "../../apps/web/src/app-shell-sidebar-flow.js";

function actionTarget(action) {
  return actionTargetWithNote(action, "");
}

function actionTargetWithNote(action, noteId = "") {
  return {
    closest: (selector) => selector === "[data-sidebar-flow-action]"
      ? {
          dataset: { sidebarFlowAction: action, sidebarFlowNoteId: noteId },
          getAttribute: (name) => name === "data-sidebar-flow-note-id" ? noteId : action
        }
      : null
  };
}

test("sidebar flow detects network and distillation gaps", () => {
  assert.equal(sidebarFlowNoteHasNetworkSignal({ body: "[[Note]]" }, {
    parseLinks: () => ["Note"],
    parseTags: () => []
  }), true);

  const summary = distillationSummaryForSidebarFlow([
    { id: "n1", thesis: "", threeLineSummary: [] },
    { id: "n2", thesis: "Claim", threeLineSummary: [] }
  ], {
    distillationStatusOf: (note) => note.id === "n2" ? "confirmed" : "draft",
    noteHasBoundarySignal: (note) => note.id === "n2"
  });

  assert.equal(summary.pending, 1);
  assert.equal(summary.confirmed, 1);
  assert.equal(summary.writingReady, 1);
  assert.equal(summary.missingBoundary, 1);
});

test("sidebar flow state builds original-route progress and primary action", () => {
  const state = buildExplorerSidebarFlowState({
    rootId: "dir_original_default",
    currentNotes: [],
    originalNotes: [
      { id: "n1", thesis: "", threeLineSummary: [], body: "" },
      { id: "n2", thesis: "Claim", threeLineSummary: ["a", "b", "c"], body: "#tag" }
    ]
  }, {
    parseLinks: () => [],
    parseTags: (body) => body.includes("#") ? ["tag"] : [],
    noteHasGeneratedOriginal: () => false,
    distillationStatusOf: (note) => note.id === "n2" ? "confirmed" : "draft",
    noteHasBoundarySignal: (note) => note.id === "n2",
    isPermanentLikeNote: () => true
  });

  assert.equal(state.isOriginal, true);
  assert.equal(state.primaryAction, "continue-distillation");
  assert.equal(state.metrics.length, 3);
  assert.ok(state.topGaps.length > 0);
});

test("sidebar flow renders Smart Notes demo walkthrough when demo notes are present", () => {
  const state = buildExplorerSidebarFlowState({
    rootId: "dir_demo",
    selectedNoteId: "PERM-UNLINKED-PRACTICE",
    currentNotes: [
      { id: "GUIDE-SMART-NOTES-START" },
      { id: "PERM-WRITING-STARTS-BEFORE-DRAFT" },
      { id: "PERM-UNLINKED-PRACTICE" },
      { id: "THEME-WHY-LINK-NOTES" },
      { id: "WRITE-SMART-NOTES-DEMO" }
    ],
    originalNotes: []
  });
  const markup = renderExplorerSidebarFlowMarkup(state);

  assert.equal(state.kind, "smart-notes-demo");
  assert.match(markup, /3 分钟示例/);
  assert.match(markup, /从记录到写作/);
  assert.match(markup, /data-sidebar-flow-action="open-demo-note"/);
  assert.match(markup, /打开第 1 步笔记/);
  assert.doesNotMatch(markup, /data-sidebar-flow-action="open-demo-writing"/);
  assert.doesNotMatch(markup, /\b(?:PN-SN|WP-SN|IC-SN)-/);
});

test("sidebar flow markup escapes text and renders original primary action", () => {
  const markup = renderExplorerSidebarFlowMarkup({
    isOriginal: true,
    title: "<Title>",
    note: "note",
    steps: [["Step", true]],
    metrics: [[2, "Count"]],
    topGaps: [],
    primaryAction: "open-writing"
  }, {
    escapeHtml: (value) => String(value).replaceAll("<", "&lt;").replaceAll(">", "&gt;")
  });

  assert.match(markup, /&lt;Title&gt;/);
  assert.match(markup, /data-sidebar-flow-action="open-writing"/);
});

test("sidebar flow runtime keeps note boxes free of walkthrough chrome", () => {
  const classes = [];
  const element = {
    innerHTML: "stale walkthrough",
    classList: { add: (name) => classes.push(["add", name]) }
  };
  const flow = renderExplorerSidebarFlowForRuntime({
    rootId: "dir_fleeting_default",
    element,
    currentNotes: [{ id: "f1" }],
    originalNotes: []
  }, {
    parseLinks: () => [],
    parseTags: () => [],
    noteHasGeneratedOriginal: () => false,
    distillationStatusOf: () => "draft",
    noteHasBoundarySignal: () => false,
    isPermanentLikeNote: () => false,
    escapeHtml: (value) => String(value)
  });

  assert.equal(flow, null);
  assert.equal(element.innerHTML, "");
  assert.deepEqual(classes, [["add", "hidden"]]);
});

test("sidebar flow actions route to distillation writing and permanent creation", async () => {
  const calls = [];
  const state = {};
  const deps = {
    state,
    activateModule: (moduleName) => calls.push(["activate", moduleName]),
    openDistillationModule: async () => calls.push(["distillation"]),
    openWritingModule: async () => calls.push(["writing"]),
    handleStateChange: async (reason) => calls.push(["state", reason])
  };

  assert.equal(await handleSidebarFlowAction({ target: actionTarget("continue-distillation") }, deps), true);
  assert.equal(await handleSidebarFlowAction({ target: actionTarget("open-writing") }, deps), true);
  assert.equal(await handleSidebarFlowAction({ target: actionTarget("create-permanent") }, deps), true);

  assert.deepEqual(calls, [
    ["activate", "distillation"],
    ["distillation"],
    ["activate", "writing"],
    ["writing"],
    ["state", "create-note-in-selected-folder"]
  ]);
  assert.equal(state.browserRootId, "dir_original_default");
  assert.equal(state.selectedFolderId, "dir_original_default");
});

test("sidebar flow demo actions open notes, relations, writing, and review", async () => {
  const calls = [];
  const deps = {
    activateModule: (moduleName) => calls.push(["activate", moduleName]),
    openNoteById: (noteId, options) => calls.push(["open", noteId, options]),
    continueWritingProjectEntry: async (projectId, options) => {
      calls.push(["writing-project", projectId, options]);
      return { id: projectId, scaffold_id: "DRAFT-SMART-NOTES-DEMO" };
    },
    handleStateChange: async (reason, payload) => calls.push(["state", reason, payload]),
    setStatus: (message, tone) => calls.push(["status", message, tone])
  };

  assert.equal(await handleSidebarFlowAction({ target: actionTargetWithNote("open-demo-note", "PERM-WRITING-STARTS-BEFORE-DRAFT") }, deps), true);
  assert.equal(await handleSidebarFlowAction({ target: actionTargetWithNote("open-demo-note-relations", "PERM-UNLINKED-PRACTICE") }, deps), true);
  assert.equal(await handleSidebarFlowAction({ target: actionTargetWithNote("open-demo-writing", "WRITE-SMART-NOTES-DEMO") }, deps), true);
  assert.equal(await handleSidebarFlowAction({ target: actionTarget("open-demo-review") }, deps), true);

  assert.deepEqual(calls, [
    ["activate", "explorer"],
    ["open", "PERM-WRITING-STARTS-BEFORE-DRAFT", { preferTitleSelection: false }],
    ["status", "已打开导览笔记。", "ok"],
    ["activate", "explorer"],
    ["open", "PERM-UNLINKED-PRACTICE", { preferTitleSelection: false }],
    ["state", "open-note-relations", { noteId: "PERM-UNLINKED-PRACTICE", source: "smart-notes-demo-walkthrough" }],
    ["status", "已打开导览笔记，可以开始补关系理由。", "ok"],
    ["writing-project", "WRITE-SMART-NOTES-DEMO", {
      openDraft: false,
      statusMessage: "已打开 Smart Notes Demo 的可追溯文章提纲。"
    }],
    ["activate", "today"]
  ]);
});

test("sidebar flow demo note action reports failure when the target note cannot open", async () => {
  const calls = [];
  const deps = {
    activateModule: (moduleName) => calls.push(["activate", moduleName]),
    openNoteById: (noteId, options) => {
      calls.push(["open", noteId, options]);
      return false;
    },
    handleStateChange: async (reason, payload) => calls.push(["state", reason, payload]),
    setStatus: (message, tone) => calls.push(["status", message, tone])
  };

  assert.equal(await handleSidebarFlowAction({ target: actionTargetWithNote("open-demo-note-relations", "MISSING") }, deps), false);
  assert.deepEqual(calls, [
    ["activate", "explorer"],
    ["open", "MISSING", { preferTitleSelection: false }],
    ["status", "没有找到这一步的导览笔记，请重新导入 Smart Notes Demo。", "warn"]
  ]);
});

test("sidebar flow installer reads latest deps when clicked", async () => {
  const handlers = new Map();
  let version = "first";
  const calls = [];
  const registrations = installSidebarFlowEventHandler({
    $: (id) => ["sidebarFlow", "demoGuidePanel"].includes(id) ? {
      addEventListener: (eventName, handler) => handlers.set(`${id}:${eventName}`, handler)
    } : null,
    depsProvider: () => ({
      activateModule: (moduleName) => calls.push(["activate", version, moduleName]),
      openWritingModule: async () => calls.push(["writing", version])
    })
  });

  assert.deepEqual(registrations.map((item) => [item.id, item.installed]), [["demoGuidePanel", true]]);
  await handlers.get("demoGuidePanel:click")({ target: actionTarget("open-writing") });
  version = "second";
  await handlers.get("demoGuidePanel:click")({ target: actionTarget("open-writing") });

  assert.deepEqual(calls, [
    ["activate", "first", "writing"],
    ["writing", "first"],
    ["activate", "second", "writing"],
    ["writing", "second"]
  ]);
});
