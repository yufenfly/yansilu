import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  graphBlockedAiRelationPairKeysForNote as moduleGraphBlockedAiRelationPairKeysForNote,
  graphAiRelationCandidatesForNote as moduleGraphAiRelationCandidatesForNote,
  graphMergeRelationCandidatesForDisplay as moduleGraphMergeRelationCandidatesForDisplay,
  graphPendingAiCandidateCount as moduleGraphPendingAiCandidateCount,
  graphPotentialRelationRationaleDraft as moduleGraphPotentialRelationRationaleDraft,
  graphRelationRationaleIsActionable as moduleGraphRelationRationaleIsActionable,
  graphRelationStatusCountsAsNetworkEdge as moduleGraphRelationStatusCountsAsNetworkEdge
} from "../../apps/web/src/graph-ai-candidates.js";
import {
  graphManualRelationTargetsForNote as moduleGraphManualRelationTargetsForNote
} from "../../apps/web/src/graph-local-relations.js";
import {
  graphIsolatedJoinNetworkFormModel
} from "../../apps/web/src/graph-isolated-relation-form.js";
import {
  graphNormalizeRelationWorkflowSelection
} from "../../apps/web/src/graph-relation-workflow-controller.js";
import {
  relationNetworkStatusForNotePolicy
} from "../../apps/web/src/note-persistence-policy.js";
import {
  renderGraphClusterGlowView
} from "../../apps/web/src/graph-visual-map-view.js";
import {
  renderGraphMapEmptyStateView,
  renderGraphMapSvgDefsView,
  renderGraphVisualMapShellView,
  renderGraphZoomStepperView
} from "../../apps/web/src/graph-visual-map-shell.js";
import {
  graphZoomStep as moduleGraphZoomStep
} from "../../apps/web/src/graph-visual-zoom-model.js";
import {
  renderGraphIconView
} from "../../apps/web/src/graph-icon-view.js";
import {
  graphSelectionUsesOverlay
} from "../../apps/web/src/graph-visual-map-shell-props.js";
import {
  applyGraphFocusContextModeInteraction,
  applyGraphFocusDepthInteraction,
  applyGraphReadingLensInteraction,
  applyGraphRelationTypeFilterInteraction,
  applyGraphViewModeInteraction,
  applyGraphWheelZoomInteraction,
  applyGraphZoomOptionInteraction,
  applyGraphZoomStepInteraction
} from "../../apps/web/src/graph-toolbar-interaction-controller.js";
import {
  renderGraphSelectionByKind
} from "../../apps/web/src/graph-selection-dispatcher.js";
import {
  graphReadingLensMeta,
  renderGraphReadingLensControls
} from "../../apps/web/src/graph-reading-lens-controls.js";
import {
  renderGraphViewModeSwitcher
} from "../../apps/web/src/graph-view-mode-state.js";
import {
  graphFocusContextCollapsedState,
  graphFocusContextCollapsedStatus,
  renderGraphFocusContextPanel
} from "../../apps/web/src/graph-focus-context-panel.js";
import {
  GRAPH_DENSITY_HINT_TIMEOUT_MS,
  scheduleGraphDensityHintDismissForRuntime,
  shouldShowGraphDensityHintForRuntime
} from "../../apps/web/src/graph-density-hint-controller.js";
import {
  resetGraphDemoPresentationStateForRuntime
} from "../../apps/web/src/graph-presentation-controller.js";
import {
  graphResearchNavigatorState,
  renderGraphResearchNavigatorPanelView
} from "../../apps/web/src/graph-research-navigator.js";
import {
  buildGraphPanelState
} from "../../apps/web/src/graph-panel-state-builder.js";
import {
  refreshDirectoryGraphForRuntime
} from "../../apps/web/src/graph-refresh-controller.js";
import {
  graphVisualNodeViewState,
  renderGraphVisualNodeView
} from "../../apps/web/src/graph-visual-node-view.js";
import {
  graphComputedIsolatedNotesForGraph,
  graphIsolatedQueueItemsForGraph,
  graphMarkIsolatedNodesForGraph,
  graphNextIsolatedQueueItem
} from "../../apps/web/src/graph-isolated-queue.js";
import {
  renderGraphWorkbenchEntryPillsView,
  renderGraphWorkbenchPanelView,
  renderGraphWorkbenchPriorityQueueView
} from "../../apps/web/src/graph-workbench-panel.js";
import {
  applyGraphEmptyCloseInteraction,
  applyGraphSectionOpenState,
  applyGraphThinkingFilterInteraction,
  applyGraphThinkingHideInteraction,
  applyGraphThinkingToggleInteraction,
  applyGraphThinkingVisibilityInteraction,
  applyGraphUtilityDrawerCloseInteraction,
  applyGraphUtilityDrawerOpenState,
  applyGraphUtilityVisibilityInteraction,
  applyGraphWorkbenchCloseInteraction,
  applyGraphWorkbenchEntryInteraction,
  applyGraphWorkbenchTabInteraction
} from "../../apps/web/src/graph-workspace-interaction-controller.js";
import {
  buildGraphQuestionSpotSummaryForGraph as moduleBuildGraphQuestionSpotSummaryForGraph,
  buildGraphThinkingItemsForGraph as moduleBuildGraphThinkingItemsForGraph,
  graphAiAnalysisSummaryStateForGraph as moduleGraphAiAnalysisSummaryStateForGraph
} from "../../apps/web/src/graph-thinking-items-model.js";
import {
  applyGraphThinkingHoverDomState,
  graphThinkingHighlightAttrsForItem
} from "../../apps/web/src/graph-thinking-hover-controller.js";

const repoRoot = path.resolve(fileURLToPath(new URL("../..", import.meta.url)));

function readPrototypeApp() {
  return fs.readFileSync(path.join(repoRoot, "apps/web/src/prototype-app.js"), "utf8");
}

function readGraphResidualViews() {
  return [
    "graph-residual-views.js",
    "graph-relation-workspace-runtime.js",
    "graph-isolated-workspace-runtime.js",
    "graph-selection-residual-view.js",
    "graph-thinking-panel-residual-view.js"
  ]
    .map((file) => fs.readFileSync(path.join(repoRoot, "apps/web/src", file), "utf8"))
    .join("\n");
}

function readGraphRouteRuntime() {
  return fs.readFileSync(path.join(repoRoot, "apps/web/src/graph-route-runtime.js"), "utf8");
}

function readSettingsEventBindings() {
  return fs.readFileSync(path.join(repoRoot, "apps/web/src/settings-event-bindings.js"), "utf8");
}

function readAppRailEventBindings() {
  return fs.readFileSync(path.join(repoRoot, "apps/web/src/app-rail-event-bindings.js"), "utf8");
}

function readQuickActionEventBindings() {
  return fs.readFileSync(path.join(repoRoot, "apps/web/src/quick-action-event-bindings.js"), "utf8");
}

function readGraphIsolatedRelationWorkspace() {
  return fs.readFileSync(path.join(repoRoot, "apps/web/src/graph-isolated-relation-workspace.js"), "utf8");
}

function readGraphIsolatedRelationController() {
  return fs.readFileSync(path.join(repoRoot, "apps/web/src/graph-isolated-relation-controller.js"), "utf8");
}

function readGraphIsolatedWorkflowShell() {
  return fs.readFileSync(path.join(repoRoot, "apps/web/src/graph-isolated-workflow-shell.js"), "utf8");
}

function readGraphRelationStateQuery() {
  return fs.readFileSync(path.join(repoRoot, "apps/web/src/graph-relation-state-query.js"), "utf8");
}

function readGraphRelationSaveController() {
  return fs.readFileSync(path.join(repoRoot, "apps/web/src/graph-relation-save-controller.js"), "utf8");
}

function readGraphRelationWorkflowController() {
  return fs.readFileSync(path.join(repoRoot, "apps/web/src/graph-relation-workflow-controller.js"), "utf8");
}

function readGraphWorkbenchPanel() {
  return fs.readFileSync(path.join(repoRoot, "apps/web/src/graph-workbench-panel.js"), "utf8");
}

function readGraphAiCandidates() {
  return fs.readFileSync(path.join(repoRoot, "apps/web/src/graph-ai-candidates.js"), "utf8");
}

function readGraphIsolatedDecisionNoteUpdate() {
  return fs.readFileSync(path.join(repoRoot, "apps/web/src/graph-isolated-decision-note-update.js"), "utf8");
}

function readGraphAiConnectModel() {
  return fs.readFileSync(path.join(repoRoot, "apps/web/src/graph-ai-connect-model.js"), "utf8");
}

function readGraphAiConnectRuntimeController() {
  return fs.readFileSync(path.join(repoRoot, "apps/web/src/graph-ai-connect-runtime-controller.js"), "utf8");
}

function readGraphFollowupDraftTemplates() {
  return fs.readFileSync(path.join(repoRoot, "apps/web/src/graph-followup-draft-templates.js"), "utf8");
}

function readGraphIsolatedDecisionController() {
  return fs.readFileSync(path.join(repoRoot, "apps/web/src/graph-isolated-decision-controller.js"), "utf8");
}

function readGraphPanelStateBuilder() {
  return fs.readFileSync(path.join(repoRoot, "apps/web/src/graph-panel-state-builder.js"), "utf8");
}

function readGraphPanelRenderer() {
  return fs.readFileSync(path.join(repoRoot, "apps/web/src/graph-panel-renderer.js"), "utf8");
}

function readGraphPanelShell() {
  return fs.readFileSync(path.join(repoRoot, "apps/web/src/graph-panel-shell.js"), "utf8");
}

function readGraphVisualMapRuntimeState() {
  return fs.readFileSync(path.join(repoRoot, "apps/web/src/graph-visual-map-runtime-state.js"), "utf8");
}

function readGraphVisualMapControlsState() {
  return fs.readFileSync(path.join(repoRoot, "apps/web/src/graph-visual-map-controls-state.js"), "utf8");
}

function readGraphVisualMapSelectionState() {
  return fs.readFileSync(path.join(repoRoot, "apps/web/src/graph-visual-map-selection-state.js"), "utf8");
}

function readGraphVisualMapController() {
  return fs.readFileSync(path.join(repoRoot, "apps/web/src/graph-visual-map-controller.js"), "utf8");
}

function readGraphCanvasEventRouter() {
  return fs.readFileSync(path.join(repoRoot, "apps/web/src/graph-canvas-event-router.js"), "utf8");
}

function readAppShellSidebarController() {
  return fs.readFileSync(path.join(repoRoot, "apps/web/src/app-shell-sidebar-controller.js"), "utf8");
}

function readGraphSelectionPanel() {
  return fs.readFileSync(path.join(repoRoot, "apps/web/src/graph-selection-panel.js"), "utf8");
}

function readGraphNodeSelectionPanel() {
  return fs.readFileSync(path.join(repoRoot, "apps/web/src/graph-node-selection-panel.js"), "utf8");
}

function readGraphEdgeSelectionPanel() {
  return fs.readFileSync(path.join(repoRoot, "apps/web/src/graph-edge-selection-panel.js"), "utf8");
}

function readGraphClusterSelectionPanel() {
  return fs.readFileSync(path.join(repoRoot, "apps/web/src/graph-cluster-selection-panel.js"), "utf8");
}

function readRelationSaveTransaction() {
  return fs.readFileSync(path.join(repoRoot, "apps/web/src/relation-save-transaction.js"), "utf8");
}

const mojibakeCopyPattern = new RegExp("\\u93b5\\u5b0d|\\u93b5\\u5b35|\\u93b5\\u5b2a\\u4f10|\\u934f\\u5d07\\u90f4|\\u951b");

function readPrototypeHtml() {
  return [
    fs.readFileSync(path.join(repoRoot, "apps/web/src/prototype.html"), "utf8"),
    fs.readFileSync(path.join(repoRoot, "apps/web/src/prototype.css"), "utf8")
  ].join("\n");
}

function readDomainCatalogStore() {
  return fs.readFileSync(path.join(repoRoot, "packages/domain/src/note-catalog-store.mjs"), "utf8");
}

function extractFunctionSource(source, name) {
  const start = source.indexOf(`function ${name}`);
  assert.ok(start >= 0, `expected ${name}() to exist`);
  const paramsStart = source.indexOf("(", start);
  assert.ok(paramsStart > start, `expected ${name}() to have parameters`);
  let parenDepth = 0;
  let paramsEnd = -1;
  for (let index = paramsStart; index < source.length; index += 1) {
    const char = source[index];
    if (char === "(") parenDepth += 1;
    if (char === ")") {
      parenDepth -= 1;
      if (parenDepth === 0) {
        paramsEnd = index;
        break;
      }
    }
  }
  assert.ok(paramsEnd > paramsStart, `expected ${name}() parameter list to close`);
  const bodyStart = source.indexOf("{", paramsEnd);
  assert.ok(bodyStart > start, `expected ${name}() to have a body`);
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    const char = source[index];
    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  assert.fail(`expected to find the end of ${name}()`);
}

function createGraphHoverTestElement(attrs = {}, children = {}) {
  const classes = new Set(String(attrs.class || "").split(/\s+/).filter(Boolean));
  return {
    attrs: { ...attrs },
    innerHTML: "",
    classList: {
      add: (...names) => names.forEach((name) => classes.add(name)),
      remove: (...names) => names.forEach((name) => classes.delete(name)),
      contains: (name) => classes.has(name),
      toggle: (name, force) => {
        const next = force === undefined ? !classes.has(name) : Boolean(force);
        if (next) classes.add(name);
        else classes.delete(name);
        return next;
      }
    },
    getAttribute(name) {
      return this.attrs[name] ?? "";
    },
    querySelectorAll(selector) {
      return children[selector] || [];
    }
  };
}

function graphFocusPanelTestDeps() {
  const relationVisualKeys = {
    supports: "support",
    counters: "conflict",
    boundary: "boundary",
    bridges: "bridge",
    sequence: "flow"
  };
  return {
    renderGraphIcon: (name) => `<i>${name}</i>`,
    graphNodeTitle: (nodeMap, id, fallback = "") => nodeMap.get(id)?.title || fallback || id,
    graphFocusContextModeMeta: (value = "argument") =>
      value === "writing"
        ? { key: "writing", label: "写作怎么用", note: "按写作用途排序关系。" }
        : { key: "argument", label: "观点怎么连", note: "按观点关系排序关系。" },
    graphRelationStatusCountsAsNetworkEdge: (status) => status !== "rejected",
    graphRelationVisual: (relationType) => ({ key: relationVisualKeys[String(relationType || "").trim()] || "neutral" }),
    graphRelationTypeLabel: (relationType) => String(relationType || "相关关系"),
    graphFocusedEdgeDirection: () => "指向",
    graphRelationSourceLabel: () => "手动保存",
    graphFocusCardActionMeta: () => ({ label: "补强理由" })
  };
}

function graphResearchNavigatorTestDeps() {
  const relationVisualKeys = {
    supports: "support",
    contradicts: "conflict",
    qualifies: "boundary",
    bridges: "bridge",
    sequence: "flow",
    part_of: "index"
  };
  return {
    renderGraphIcon: (name) => `<i>${name}</i>`,
    renderGraphSelectionMetrics: (items = []) => items.map((item) => `<b>${item.label}:${item.value}</b>`).join(""),
    graphRelationStatusCountsAsNetworkEdge: (status) => status !== "rejected",
    graphRelationVisual: (relationType) => ({ key: relationVisualKeys[String(relationType || "").trim()] || "neutral" })
  };
}

function graphWorkbenchViewTestDeps(overrides = {}) {
  return {
    renderGraphIcon: (name) => `<i>${name}</i>`,
    graphWorkbenchTabMeta: (value = "clues") => {
      const meta = {
        clues: { key: "clues", label: "补全关系", emptyLabel: "暂无需要补的关系", panelTitle: "补全关系", note: "先处理关系" },
        questions: { key: "questions", label: "找主题", emptyLabel: "暂无可找主题的线索", panelTitle: "找主题", note: "继续追问" }
      };
      return meta[value] || meta.clues;
    },
    graphThinkingFilterMeta: (value = "all") => {
      const meta = {
        all: { key: "all", label: "全部", note: "查看全部" },
        theme: { key: "theme", label: "主题", note: "查看主题" },
        organize: { key: "organize", label: "关系", note: "查看关系" }
      };
      return meta[value] || meta.all;
    },
    graphThinkingHighlightAttrs: (item = {}) => item.highlight ? `data-test-highlight="${item.highlight}"` : "",
    graphCompactActionLabel: (label = "") => String(label || "查看").slice(0, 2),
    graphState: {},
    ...overrides
  };
}

function graphThinkingModelTestDeps(overrides = {}) {
  const relationPairKey = (leftNoteId = "", rightNoteId = "") => {
    const normalized = [String(leftNoteId || "").trim(), String(rightNoteId || "").trim()].filter(Boolean).sort();
    return normalized.length === 2 ? `${normalized[0]}::${normalized[1]}` : "";
  };
  const endpointIds = (candidate = {}) => ({
    sourceNoteId: String(candidate.fromNoteId || candidate.sourceNoteId || (Array.isArray(candidate.noteIds) ? candidate.noteIds[0] : "") || "").trim(),
    targetNoteId: String(candidate.toNoteId || candidate.targetNoteId || (Array.isArray(candidate.targetNoteIds) ? candidate.targetNoteIds[0] : "") || (Array.isArray(candidate.noteIds) ? candidate.noteIds[1] : "") || "").trim()
  });
  return {
    escapeHtml: (value = "") => String(value ?? ""),
    graphAiAnalysisPayload: (result = null) => result?.analysis || result || {},
    graphBridgeSelectionKey: (gap = {}, index = 0) => String(gap?.id || index),
    graphCandidateCanSaveRelation: (candidate = {}) => String(candidate.relationType || "associated_with").trim() !== "no_relation",
    graphCandidateEndpointIds: endpointIds,
    graphCandidateTouchesNodeScope: (candidate = {}, nodeIds = new Set()) => {
      if (!nodeIds?.size) return true;
      const { sourceNoteId, targetNoteId } = endpointIds(candidate);
      return Boolean((sourceNoteId && nodeIds.has(sourceNoteId)) || (targetNoteId && nodeIds.has(targetNoteId)));
    },
    graphComputedIsolatedNotes: (nodes = [], _edges = [], aiIsolatedNotes = []) => {
      const nodeIds = new Set((Array.isArray(nodes) ? nodes : []).map((node) => String(node?.id || "").trim()).filter(Boolean));
      return (Array.isArray(aiIsolatedNotes) ? aiIsolatedNotes : []).filter((note) => nodeIds.has(String(note?.noteId || note?.id || "").trim()));
    },
    graphExistingRelationPairKeys: (edges = []) => new Set((Array.isArray(edges) ? edges : []).map((edge) => relationPairKey(edge?.fromNoteId, edge?.toNoteId)).filter(Boolean)),
    graphFullNoteById: (noteId = "", nodeMap = new Map()) => nodeMap.get(noteId) || null,
    graphIsolatedQueueItems: ({ isolatedNotes = [] } = {}) => (Array.isArray(isolatedNotes) ? isolatedNotes : []),
    graphIsolatedSelectionKey: (note = {}, index = 0) => String(note?.noteId || note?.id || index),
    graphLocalizedActionText: (value = "", fallback = "") => String(value || fallback || "").trim(),
    graphNodeIdsInScope: (nodes = []) => new Set((Array.isArray(nodes) ? nodes : []).map((node) => String(node?.id || "").trim()).filter(Boolean)),
    graphNoteHasSavedIsolationDisposition: () => false,
    graphNoteIdFromIsolatedItem: (item = {}) => String(item?.noteId || item?.id || "").trim(),
    graphPendingAiCandidateCount: moduleGraphPendingAiCandidateCount,
    graphPreferredPotentialRelationType: (candidate = {}) => String(candidate.relationType || "associated_with").trim() || "associated_with",
    graphRankThemeCandidates: () => [],
    graphRelationPairKey: relationPairKey,
    graphRelationQualityLabel: (level = "") => String(level || "寰呰ˉ"),
    graphRelationReviewReasonLabel: (reason = "") => String(reason || "待确认"),
    graphRelationTypeLabel: (type = "") => String(type || "相关"),
    graphSelectEdgeActionAttrs: () => "",
    graphThemeSelectionKey: (topic = {}, index = 0) => String(topic?.id || index),
    ...overrides
  };
}

test("graph workbench entries use task language and reading lens controls stay hidden", () => {
  const entryMarkup = renderGraphWorkbenchEntryPillsView({
    clueSummary: { total: 2 },
    questionSummary: { total: 0 }
  }, graphWorkbenchViewTestDeps({ graphState: { workbenchPanelOpen: true, workbenchPanelTab: "clues" } }));
  const lensMarkup = renderGraphReadingLensControls("bridge", true, entryMarkup);
  const viewMarkup = renderGraphViewModeSwitcher("meaningful", "bridge");

  assert.equal(graphReadingLensMeta("unknown").key, "insight");
  assert.match(entryMarkup, /data-graph-workbench-entry="clues"/);
  assert.match(entryMarkup, /data-graph-workbench-entry="questions"/);
  assert.match(entryMarkup, /补全关系/);
  assert.match(entryMarkup, /is-empty/);
  assert.equal(lensMarkup, "");
  assert.doesNotMatch(lensMarkup, /data-graph-reading-lens="insight"/);
  assert.doesNotMatch(lensMarkup, /data-graph-reading-lens="bridge"/);
  assert.match(viewMarkup, /data-graph-task-view="structure"/);
  assert.match(viewMarkup, /data-graph-task-view="relations" aria-pressed="true"/);
  assert.match(viewMarkup, /data-graph-task-view="themes"/);
  assert.doesNotMatch(viewMarkup, />看图</);
  assert.match(entryMarkup, /data-graph-workbench-entry="clues"/);
});

test("graph residual view switcher forwards active reading lens", () => {
  const residualViewsSource = fs.readFileSync(path.join(repoRoot, "apps/web/src/graph-residual-views.js"), "utf8");
  assert.match(
    residualViewsSource,
    /const renderGraphViewModeSwitcher = \(relationType = "meaningful", activeLens = "insight"\) =>\s*renderGraphViewModeSwitcherForRuntime\(relationType, activeLens, \{ escapeHtml \}\);/
  );
});

test("live graph connectivity overrides stale persisted relation status once a scope is loaded", () => {
  const connectedIds = new Set(["pn_connected"]);

  assert.equal(
    relationNetworkStatusForNotePolicy({
      note: { id: "pn_connected", relationNetworkStatus: "unknown" },
      noteType: "permanent",
      connectedIds,
      connectivityReady: true,
      storedStatus: "isolated"
    }),
    "connected"
  );
  assert.equal(
    relationNetworkStatusForNotePolicy({
      note: { id: "pn_isolated", relationNetworkStatus: "connected" },
      noteType: "permanent",
      connectedIds,
      connectivityReady: true,
      storedStatus: "connected"
    }),
    "isolated"
  );
});

test("graph refresh repaints the explorer tree after connectivity state changes", async () => {
  const calls = [];
  const graphState = {};
  await refreshDirectoryGraphForRuntime({
    graphState,
    graphScopeDirectoryId: () => "selected-dir",
    graphOriginalScopeDirectoryId: "original-root",
    fetchDirectoryGraph: async () => ({ nodes: [], edges: [] }),
    fetchGraphConflicts: async () => null,
    fetchRelationReviewQueue: async () => ({ items: [], total: 0 }),
    renderGraphPanel: () => calls.push("panel"),
    renderAll: () => calls.push("all")
  });

  assert.equal(graphState.loading, false);
  assert.deepEqual(calls, ["panel", "all"]);
});

test("graph focus relation panel can be collapsed and restored explicitly", () => {
  const runtimeStateSource = readGraphVisualMapRuntimeState();
  const controlsStateSource = readGraphVisualMapControlsState();
  const html = readPrototypeHtml();
  const panel = renderGraphFocusContextPanel({
    focusedNoteId: "a",
    nodeMap: new Map([
      ["a", { title: "当前笔记" }],
      ["b", { title: "支持笔记" }]
    ]),
    edges: [
      { id: "r1", fromNoteId: "a", toNoteId: "b", relationType: "supports", status: "accepted", rationale: "支持理由", createdBy: "manual" }
    ],
    focusContextMode: "argument"
  }, graphFocusPanelTestDeps());

  assert.match(runtimeStateSource, /buildGraphVisualMapControlsState\(/);
  assert.match(controlsStateSource, /const focusContextAvailable = filterActive && normalizedFocusedNoteId;/);
  assert.equal(graphFocusContextCollapsedState(false, "close"), true);
  assert.equal(graphFocusContextCollapsedState(true, "open"), false);
  assert.equal(graphFocusContextCollapsedState(false, "toggle"), true);
  assert.equal(graphFocusContextCollapsedStatus(true), "已收起选中笔记详情");
  assert.equal(graphFocusContextCollapsedStatus(false), "已显示选中笔记详情");
  assert.match(panel, /id="graphFocusContextPanel" class="graph-focus-context"/);
  assert.match(panel, /class="graph-overlay-close graph-focus-panel-close" type="button" data-graph-focus-context-toggle="close"/);
  assert.match(panel, /data-open-note="b"/);
  assert.match(panel, /支持理由/);

  assert.match(html, /\.graph-focus-panel-head \{[\s\S]*justify-content: space-between;/);
  assert.match(html, /\.graph-focus-panel-toggle \{[\s\S]*min-height: 30px;[\s\S]*cursor: pointer;/);
  assert.match(html, /\.graph-focus-panel-close \{[\s\S]*position: static;[\s\S]*width: 30px;/);
});

test("graph focus relation panel keeps relation wording simple", () => {
  const html = readPrototypeHtml();
  const panel = renderGraphFocusContextPanel({
    focusedNoteId: "a",
    nodeMap: new Map([["a", { title: "当前笔记" }]]),
    edges: [],
    focusContextMode: "writing"
  }, graphFocusPanelTestDeps());

  assert.match(fs.readFileSync(path.join(repoRoot, "apps/web/src/graph-focus-controls-state.js"), "utf8"), /label: "观点怎么连"/);
  assert.match(fs.readFileSync(path.join(repoRoot, "apps/web/src/graph-focus-controls-state.js"), "utf8"), /label: "写作怎么用"/);
  assert.match(panel, /观点怎么连/);
  assert.match(panel, /写作怎么用/);
  assert.match(panel, /<div class="graph-focus-kicker">选中笔记<\/div>/);
  assert.match(panel, /还没有关联/);
  assert.match(panel, /这条笔记还没有和其他笔记建立关联/);
  assert.doesNotMatch(panel, /data-graph-focus-help-toggle/);
  assert.doesNotMatch(panel, /正式关系|正式关联|链接 1/);

  assert.match(html, /\.graph-side-stack \{[\s\S]*width: min\(560px, calc\(100% - 36px\)\);/);
  assert.match(html, /\.graph-side-stack:has\(\.graph-focus-context\) \{[\s\S]*width: min\(920px, calc\(100% - 36px\)\);/);
  assert.doesNotMatch(html, /\.graph-focus-help-toggle \{/);
});

test("graph focus relation panel shows saved associations for a connected note", () => {
  const panel = renderGraphFocusContextPanel({
    focusedNoteId: "a",
    nodeMap: new Map([
      ["a", { title: "当前笔记", degree: 1 }],
      ["b", { title: "关联笔记" }]
    ]),
    edges: [
      { id: "r1", fromNoteId: "a", toNoteId: "b", relationType: "supports", status: "accepted", rationale: "它支撑当前判断。" }
    ],
    focusContextMode: "argument"
  }, graphFocusPanelTestDeps());

  assert.match(panel, /已保存 1 条关联/);
  assert.match(panel, /关联笔记/);
  assert.match(panel, /它支撑当前判断。/);
  assert.doesNotMatch(panel, /暂无关联/);
  assert.doesNotMatch(panel, /链接 1/);
  assert.doesNotMatch(panel, /正式关系|正式关联|链接 1/);
});

test("graph focus relation panel turns body links into editable relation hints", () => {
  const runtimeSource = readGraphResidualViews();
  const panel = renderGraphFocusContextPanel({
    focusedNoteId: "a",
    nodeMap: new Map([
      ["a", { title: "当前笔记", degree: 1 }],
      ["b", { title: "正文链接笔记" }]
    ]),
    edges: [
      { fromNoteId: "a", toNoteId: "b", relationType: "associated_with", status: "accepted", rationale: "markdown_wikilink" }
    ],
    focusContextMode: "argument"
  }, graphFocusPanelTestDeps());

  assert.match(panel, /正文链接笔记/);
  assert.match(panel, /由正文中的双链形成。点“补关系说明”写清为什么相关。/);
  assert.match(panel, /data-graph-relation-source="a"/);
  assert.match(panel, /data-graph-target-note="b"/);
  assert.match(panel, /data-graph-relation-adjustment="strengthen"/);
  assert.doesNotMatch(panel, /markdown_wikilink/);
  assert.doesNotMatch(panel, /graph-focus-card-action[^>]*disabled/);
  assert.doesNotMatch(runtimeSource, /if \(!relationId\) return openGraphRelationFormInSelection\(button\);/);
  assert.match(runtimeSource, /if \(!relationId\) \{[\s\S]*setStatus\("Relation context is missing\. Open the shared relation composer from the relation action\.", "warn"\);[\s\S]*return false;[\s\S]*\}/);
});
test("graph workbench panel replaces map-covering clue and question floaters", () => {
  const html = readPrototypeHtml();
  const panel = renderGraphWorkbenchPanelView({
    clueSummary: { total: 1, detail: "关系待处理" },
    questionSummary: { total: 2, detail: "问题待处理" },
    clueSectionsMarkup: "<section>关系列表</section>",
    thinkingItems: [{ title: "问题一", view: "theme", actionAttrs: 'data-open-note="n1"' }],
    isolatedQueueMarkup: "<section>孤立待处理</section>"
  }, graphWorkbenchViewTestDeps({ graphState: { workbenchPanelOpen: true, workbenchPanelTab: "clues" } }));

  assert.match(panel, /class="graph-workbench-panel"/);
  assert.doesNotMatch(panel, /data-graph-workbench-tab="clues"/);
  assert.doesNotMatch(panel, /data-graph-workbench-tab="questions"/);
  assert.match(panel, /data-graph-workbench-close/);
  assert.match(panel, /graph-workbench-note-list/);
  assert.doesNotMatch(panel, /孤立待处理/);
  assert.doesNotMatch(panel, /关系列表/);
  assert.doesNotMatch(panel, /data-open-note="n1"/);
  assert.doesNotMatch(panel, /graph-priority-queue|graph-workbench-all/);

  assert.match(html, /\.graph-side-stack \{[\s\S]*position: absolute;[\s\S]*right: 18px;[\s\S]*bottom: 18px;/);
  assert.match(html, /\.graph-workbench-entry \{[\s\S]*min-height: 30px;[\s\S]*padding: 0 10px;/);
  assert.match(html, /\.graph-workbench-entry-group \{[\s\S]*flex-wrap: nowrap;/);
  assert.match(html, /\.graph-side-stack \{[\s\S]*max-height: calc\(var\(--graph-map-height\) - 36px\);[\s\S]*overflow: auto;/);
  assert.match(html, /\.graph-map-stage \{[\s\S]*background: transparent;[\s\S]*overflow: visible;/);
  assert.match(html, /\.graph-map-stage::before \{[\s\S]*content: none;/);
  assert.match(html, /\.graph-map-empty-canvas \{[\s\S]*background:[\s\S]*linear-gradient\(180deg, #030812 0%, #060d18 42%, #091423 100%\);/);
});
test("graph research navigator explains the map before users drill into details", () => {
  const source = readGraphResidualViews();
  const appShellSource = readPrototypeApp();
  const workbenchSource = readGraphWorkbenchPanel();
  const html = readPrototypeHtml();
  const deps = graphResearchNavigatorTestDeps();
  const nav = graphResearchNavigatorState({
    nodes: [
      { id: "n1", title: "Alpha", degree: 4 },
      { id: "n2", title: "Beta", degree: 2 },
      { id: "n3", title: "Gamma", degree: 1 }
    ],
    edges: [
      { fromNoteId: "n1", toNoteId: "n2", relationType: "supports", status: "accepted" },
      { fromNoteId: "n2", toNoteId: "n3", relationType: "qualifies", status: "accepted" }
    ],
    clusterMeta: [{ clusterKey: "c1", title: "主题群 A", memberIds: ["n1", "n2", "n3"] }],
    clueSummary: { total: 1 },
    questionSummary: { total: 2 }
  }, deps);
  const panel = renderGraphResearchNavigatorPanelView({ nav }, deps);

  assert.equal(nav.clusters.length, 1);
  assert.equal(nav.brightNodes[0].id, "n1");
  assert.equal(nav.pendingTotal, 3);
  assert.match(panel, /class="graph-research-navigator" aria-label="看结构"/);
  assert.match(panel, /看结构/);
  assert.match(panel, /data-graph-research-close/);
  assert.match(panel, /主要结构/);
  assert.match(panel, /先看这几条/);
  assert.doesNotMatch(panel, /data-graph-select-cluster=/);
  assert.doesNotMatch(panel, /data-graph-select-node=/);
  assert.doesNotMatch(panel, /data-node-id=/);
  assert.doesNotMatch(panel, /graph-selection-metrics/);
  assert.doesNotMatch(panel, /graph-research-next/);
  assert.doesNotMatch(panel, /当前风险|读图顺序|观点关系/);
  assert.match(workbenchSource, /renderGraphResearchNavigatorEntryView\(\) \{\s*return "";\s*\}/);
  assert.match(source, /renderGraphResearchNavigatorPanel,/);
  assert.match(source, /return \{[\s\S]*renderGraphResearchNavigatorPanel,[\s\S]*renderGraphSelectionPanel[\s\S]*\};/);
  assert.match(appShellSource, /renderGraphResearchNavigatorPanel:\s*renderGraphResearchNavigatorPanelForGraph/);
  assert.match(html, /\.graph-research-navigator \{[\s\S]*display: grid;/);
});
test("graph structure view falls back to galaxy clusters instead of an empty map", () => {
  const panelStateBuilderSource = readGraphPanelStateBuilder();
  const html = readPrototypeHtml();
  const fallbackEdges = [{ fromNoteId: "n1", toNoteId: "n2", relationType: "supports", status: "accepted" }];
  const panelState = buildGraphPanelState({
    graphState: {
      item: {
        nodes: [{ id: "n1" }, { id: "n2" }],
        edges: fallbackEdges
      },
      filters: { relationType: "index", status: "all" }
    },
    canReuseScopedGraph: true
  }, {
    graphRelationStatusCountsAsNetworkEdge: () => true,
    graphScopedItems: (graph) => ({ nodes: graph.nodes, allNodes: graph.nodes, edges: graph.edges }),
    normalizeGraphRelationTypeFilter: () => "index",
    graphEdgeMatchesFilters: (edge, filters) => edge.relationType === filters.relationType,
    graphFocusedItems: (nodes, edges, allNodes) => ({ nodes, edges, allNodes, focused: false, focusedNoteId: "" }),
    graphRelationTouchesNodeScope: () => true,
    graphHasMeaningfulStructureEdges: () => true,
    graphStructureFallbackEdges: () => fallbackEdges,
    graphMarkIsolatedNodes: (nodes) => nodes
  });

  assert.equal(panelState.structureFallback, true);
  assert.deepEqual(panelState.edges, fallbackEdges);
  assert.match(panelStateBuilderSource, /const structureFallback = effectiveRelationType === "index" && !showingFocusedNote && !filteredEdges\.length && graphHasMeaningfulStructureEdges\(focused\.edges\);/);
  assert.match(panelStateBuilderSource, /filteredEdges = graphStructureFallbackEdges\(focused\.edges, activeFilters\);/);
  assert.match(html, /\.graph-structure-fallback-note \{[\s\S]*background: rgba\(239, 250, 255, 0\.9\);/);
});

test("graph empty map card can be closed back to argument relations", () => {
  const relationFilterCalls = [];
  const graphState = { selection: { kind: "cluster", clusterKey: "c1" } };
  const emptyMarkup = renderGraphMapEmptyStateView(
    { title: "No notes", message: "Try another mode" },
    { labels: { closeEmpty: "关闭提示并返回观点关系" } }
  );

  assert.match(emptyMarkup, /data-graph-empty-close/);
  assert.match(emptyMarkup, /aria-label="关闭提示并返回观点关系/);
  assert.deepEqual(applyGraphEmptyCloseInteraction(graphState, {
    setRelationTypeFilter: (...args) => relationFilterCalls.push(args)
  }), {
    relationType: "meaningful",
    selection: null
  });
  assert.deepEqual(relationFilterCalls, [["meaningful"]]);
  assert.equal(graphState.selection, null);
});

test("graph workbench interactions toggle entry, tab, and close state", () => {
  const appShellSource = readPrototypeApp();
  const graphState = {
    workbenchPanelOpen: false,
    workbenchPanelTab: "questions"
  };
  const deps = {
    graphWorkbenchTabMeta: (value = "") => {
      const key = String(value || "clues").trim() || "clues";
      return { key, label: key === "clues" ? "补全关系" : "找主题", statusLabel: key === "clues" ? "补全关系" : "找主题" };
    }
  };

  assert.deepEqual(applyGraphWorkbenchEntryInteraction(graphState, "clues", deps), {
    tab: "clues",
    open: true,
    meta: { key: "clues", label: "补全关系", statusLabel: "补全关系" }
  });
  assert.equal(graphState.workbenchPanelOpen, true);
  assert.equal(graphState.workbenchPanelTab, "clues");

  assert.equal(applyGraphWorkbenchEntryInteraction(graphState, "clues", deps).open, false);
  assert.equal(graphState.workbenchPanelOpen, false);

  assert.equal(applyGraphWorkbenchTabInteraction(graphState, "questions", deps).open, true);
  assert.equal(graphState.workbenchPanelOpen, true);
  assert.equal(graphState.workbenchPanelTab, "questions");

  assert.deepEqual(applyGraphWorkbenchCloseInteraction(graphState), { open: false });
  assert.equal(graphState.workbenchPanelOpen, false);
  assert.match(appShellSource, /graphThinkingHighlightAttrsForItem,/);
});

test("graph workspace interactions keep thinking and utility state predictable", () => {
  const graphState = {
    selection: { kind: "node", nodeId: "n1" },
    thinkingPanelOpen: false,
    thinkingPanelVisible: false,
    thinkingFilter: "all",
    utilityDrawerOpen: true,
    utilityDrawerVisible: true,
    sectionOpen: {}
  };
  const filterDeps = {
    graphThinkingFilterMeta: (value = "") => {
      const key = String(value || "all").trim() || "all";
      return { key, label: key === "theme" ? "主题" : "全部" };
    }
  };

  assert.deepEqual(applyGraphThinkingToggleInteraction(graphState), { open: true, visible: true });
  assert.equal(graphState.selection, null);
  assert.equal(graphState.thinkingPanelOpen, true);
  assert.equal(graphState.thinkingPanelVisible, true);

  assert.deepEqual(applyGraphThinkingHideInteraction(graphState), { open: false, visible: false });
  assert.equal(graphState.thinkingPanelOpen, false);
  assert.equal(graphState.thinkingPanelVisible, false);

  graphState.thinkingPanelOpen = true;
  assert.deepEqual(applyGraphThinkingVisibilityInteraction(graphState, "hide"), { open: false, visible: false });
  assert.equal(graphState.thinkingPanelOpen, false);
  assert.equal(graphState.thinkingPanelVisible, false);

  assert.deepEqual(applyGraphThinkingFilterInteraction(graphState, "theme", filterDeps), {
    filter: "theme",
    meta: { key: "theme", label: "主题" }
  });
  assert.equal(graphState.thinkingFilter, "theme");

  assert.deepEqual(applyGraphUtilityDrawerCloseInteraction(graphState), { open: false, visible: false });
  assert.equal(graphState.utilityDrawerOpen, false);
  assert.equal(graphState.utilityDrawerVisible, false);

  graphState.utilityDrawerOpen = true;
  assert.deepEqual(applyGraphUtilityVisibilityInteraction(graphState, "show"), { open: false, visible: true });
  assert.equal(graphState.utilityDrawerOpen, false);
  assert.equal(graphState.utilityDrawerVisible, true);

  assert.deepEqual(applyGraphUtilityDrawerOpenState(graphState, true), { open: true });
  assert.equal(graphState.utilityDrawerOpen, true);

  assert.deepEqual(applyGraphSectionOpenState(graphState, "ai-analysis", true), { sectionKey: "ai-analysis", open: true });
  assert.equal(graphState.sectionOpen["ai-analysis"], true);
});

test("graph research navigator uses cluster maturity for global verdicts", () => {
  const deps = graphResearchNavigatorTestDeps();
  const nodes = Array.from({ length: 8 }, (_, index) => ({
    id: `n${index + 1}`,
    title: `Note ${index + 1}`,
    degree: 8 - index
  }));
  const edges = [
    { fromNoteId: "n1", toNoteId: "n2", relationType: "supports", status: "accepted" },
    { fromNoteId: "n2", toNoteId: "n3", relationType: "supports", status: "accepted" },
    { fromNoteId: "n3", toNoteId: "n4", relationType: "supports", status: "accepted" },
    { fromNoteId: "n4", toNoteId: "n5", relationType: "qualifies", status: "accepted" },
    { fromNoteId: "n5", toNoteId: "n6", relationType: "contradicts", status: "accepted" }
  ];
  const mature = graphResearchNavigatorState({
    nodes,
    edges,
    clusterMeta: [{ clusterKey: "mature", title: "成熟主题", memberIds: nodes.map((node) => node.id) }]
  }, deps);
  const thin = graphResearchNavigatorState({
    nodes: nodes.slice(0, 3),
    edges: [],
    clusterMeta: [{ clusterKey: "thin", title: "薄主题", memberIds: ["n1", "n2", "n3"] }]
  }, deps);

  assert.equal(mature.matureClusterCount, 1);
  assert.equal(mature.promisingClusterCount, 1);
  assert.match(mature.verdict, /其中 1 组值得继续整理。/);
  assert.equal(thin.promisingClusterCount, 0);
  assert.match(thin.headline, /先补关系，再判断主题/);
});
test("graph workbench prioritizes Chinese clue and question actions", async () => {
  const panelStateBuilderSource = readGraphPanelStateBuilder();
  const html = readPrototypeHtml();
  const domain = readDomainCatalogStore();
  const reviewCalls = [];
  const priorityMarkup = renderGraphWorkbenchPriorityQueueView([
    { title: "桥接", view: "organize", tone: "bridge", kicker: "缺少连接", actionAttrs: 'data-open-note="n1"' },
    { title: "确认", view: "organize", tone: "review", kicker: "理由待补", actionAttrs: 'data-open-note="n2"' },
    { title: "主题", view: "theme", tone: "theme", kicker: "可写主题推荐", actionAttrs: 'data-open-note="n3"' },
    { title: "第四项", view: "theme", tone: "theme", kicker: "不会优先显示", actionAttrs: 'data-open-note="n4"' }
  ], "clues", graphWorkbenchViewTestDeps());
  const bridgeItems = moduleBuildGraphThinkingItemsForGraph({
    nodes: [{ id: "n1", title: "桥接" }, { id: "n2", title: "目标" }],
    bridgeGaps: [{ id: "gap-1", noteIds: ["n1"], targetNoteIds: ["n2"], suggestedAction: "补一条中间判断" }]
  }, graphThinkingModelTestDeps());

  assert.equal(bridgeItems.find((item) => item.id === "bridge-gap-1")?.detail, "补一条中间判断");
  assert.ok(panelStateBuilderSource.includes("const scopedActionNodeIds = graphNodeIdsInScope(scopedAllNodes);"));
  assert.ok(panelStateBuilderSource.includes("const scopedReviewQueue = graphReviewQueueInNodeScope(graphState.reviewQueue, scopedActionNodeIds);"));
  assert.ok(panelStateBuilderSource.includes("const scopedNetworkEdges = allGraphEdges.filter((edge) => graphRelationTouchesNodeScope(edge, scopedActionNodeIds));"));
  assert.ok(panelStateBuilderSource.includes("const conflictingRelations = graphMergeRelationsByKey(insightConflictingRelations, scopedTensionRelations);"));
  await refreshDirectoryGraphForRuntime({
    graphScopeDirectoryId: () => "selected-dir",
    graphOriginalScopeDirectoryId: "original-root",
    fetchDirectoryGraph: async () => ({ nodes: [], edges: [] }),
    fetchGraphConflicts: async () => null,
    fetchRelationReviewQueue: async (options) => {
      reviewCalls.push(options);
      return { items: [], total: 0 };
    }
  });
  assert.deepEqual(reviewCalls, [{ directoryId: "selected-dir", includeDescendants: true, limit: 8 }]);
  assert.match(priorityMarkup, /class="graph-priority-queue"/);
  assert.match(priorityMarkup, /桥接/);
  assert.match(priorityMarkup, /确认/);
  assert.doesNotMatch(priorityMarkup, /第四项/);

  assert.match(html, /\.graph-priority-queue \{[\s\S]*display: grid;[\s\S]*radial-gradient/);
  assert.match(html, /\.graph-workbench-all \{[\s\S]*display: grid;[\s\S]*border: 1px solid #dbe7ef;/);
  assert.match(domain, /suggestedAction:/);
  assert.doesNotMatch(domain, /Add an intermediate note or an explicit relation/);
});
test("graph map side panel does not stretch a second dark canvas below the map", () => {
  const html = readPrototypeHtml();
  const shellMarkup = renderGraphVisualMapShellView({
    hasNodes: true,
    sidePanelMarkup: "<aside>side</aside>",
    selectionOverlayMarkup: "<section>overlay</section>",
    zoomKey: "fit",
    layoutWidth: 960,
    layoutHeight: 520
  });

  assert.match(shellMarkup, /class="graph-map-stage has-side-panel has-selection-overlay"/);
  assert.match(shellMarkup, /class="graph-map-body has-side-panel"/);
  assert.match(shellMarkup, /<div class="graph-map-canvas">[\s\S]*<aside>side<\/aside>[\s\S]*<\/div>/);
  assert.match(shellMarkup, /<aside>side<\/aside>/);
  assert.match(shellMarkup, /class="graph-selection-overlay"/);
  assert.match(html, /\.graph-map-stage\.has-side-panel \{[\s\S]*min-height: 0;[\s\S]*background: transparent;[\s\S]*overflow: visible;/);
  assert.match(html, /\.graph-map-stage\.has-side-panel::before,[\s\S]*\.graph-map-stage\.has-side-panel::after \{[\s\S]*display: none;/);
  assert.match(html, /\.graph-map-body\.has-side-panel \{[\s\S]*grid-template-columns: minmax\(0, 1fr\);[\s\S]*align-items: stretch;/);
  assert.match(html, /\.graph-side-stack \{[\s\S]*position: absolute;[\s\S]*box-shadow: 0 26px 70px/);
  assert.match(html, /\.graph-map-stage\.has-side-panel \.graph-map-canvas \{[\s\S]*overflow: hidden;[\s\S]*linear-gradient\(180deg, #030812 0%, #060d18 42%, #091423 100%\);/);
});

test("graph clusters are selectable research objects with their own summary panel", () => {
  const source = readGraphResidualViews();
  const graphCanvasEventRouterSource = readGraphCanvasEventRouter();
  const clusterSelectionPanelSource = readGraphClusterSelectionPanel();
  const html = readPrototypeHtml();
  const clusterGlow = renderGraphClusterGlowView([
    { clusterKey: "cluster-alpha", title: "Alpha", tone: "teal", cx: 1, cy: 2, rx: 3, ry: 4 }
  ]);

  assert.match(source, /function graphClusterResearchMeta\(cluster = \{\}, \{ nodeMap = new Map\(\), edges = \[\] \} = \{\}\) \{/);
  assert.match(source, /function renderGraphClusterSelectionPanel\(\{ selection = null, clusterMeta = \[\], nodeMap = new Map\(\), edges = \[\] \} = \{\}\) \{/);
  assert.match(source, /renderGraphClusterSelectionPanelView\(\{ selection, clusterMeta, nodeMap, edges \}/);
  assert.equal(renderGraphSelectionByKind(
    { selection: { kind: "cluster", clusterKey: "cluster-alpha" }, clusterMeta: [{ clusterKey: "cluster-alpha" }] },
    { renderClusterPanel: ({ selection }) => `cluster:${selection.clusterKey}` }
  ), "cluster:cluster-alpha");
  assert.match(clusterGlow, /data-graph-select-cluster="cluster-alpha"/);
  assert.match(clusterGlow, /role="button"/);
  assert.match(clusterGlow, /aria-label="View cluster summary: Alpha"/);
  assert.match(graphCanvasEventRouterSource, /openGraphSelection\(\{ kind: "cluster", clusterKey \}\);/);
  assert.match(clusterSelectionPanelSource, /kicker: "主题"/);
  assert.match(clusterSelectionPanelSource, /roleLabel: meta\.label/);
  assert.match(clusterSelectionPanelSource, /补主题关系/);

  assert.match(html, /\.graph-map-cluster-glows \{[\s\S]*pointer-events: auto;/);
  assert.match(html, /\.graph-map-cluster-glow \{[\s\S]*cursor: pointer;[\s\S]*pointer-events: visiblePainted;/);
});

test("graph research details cover nodes and relation gravity lines with next actions", () => {
  const source = readPrototypeApp();
  const panelStateBuilderSource = readGraphPanelStateBuilder();
  const selectionPanelSource = readGraphSelectionPanel();
  const nodeSelectionPanelSource = readGraphNodeSelectionPanel();
  const edgeSelectionPanelSource = readGraphEdgeSelectionPanel();
  const html = readPrototypeHtml();

  assert.match(panelStateBuilderSource, /String\(graphState\.selection\?\.kind \|\| ""\)\.trim\(\)\.toLowerCase\(\) !== "cluster"/);
  assert.match(selectionPanelSource, /class="graph-overlay-close graph-selection-close"/);
  assert.doesNotMatch(selectionPanelSource, /data-graph-selection-close[^>]*>收起<\/button>/);
  assert.match(nodeSelectionPanelSource, /kicker: "笔记"/);
  assert.doesNotMatch(nodeSelectionPanelSource, /renderGraphNodeInsightPanel\(insight\)/);
  assert.match(nodeSelectionPanelSource, /已保存关系 \$\{directEdges\.length\}/);
  assert.match(nodeSelectionPanelSource, /task: null/);
  assert.doesNotMatch(nodeSelectionPanelSource, /手动关联/);
  assert.doesNotMatch(nodeSelectionPanelSource, /data-graph-create-theme-index/);
  assert.match(edgeSelectionPanelSource, /kicker: "关系"/);
  assert.match(edgeSelectionPanelSource, /roleLabel: review\.label/);
  assert.match(edgeSelectionPanelSource, /renderGraphPromptDetails\("思考提示", prompts\)/);
  assert.match(edgeSelectionPanelSource, /data-graph-relation-adjustment/);

  assert.match(html, /\.graph-selection-close \{[\s\S]*position: absolute;[\s\S]*right: 10px;/);
  assert.match(html, /\.graph-map-floater \{[\s\S]*position: sticky;[\s\S]*height: 36px;[\s\S]*margin: 12px 0 -48px 12px;[\s\S]*overflow: visible;/);
});

test("graph AI analysis opens the question workbench instead of navigating away", () => {
  const source = readGraphRouteRuntime();
  const match = source.match(/async function runGraphAiAnalysis\(\) \{([\s\S]*?)\n  \}/);
  assert.ok(match, "expected runGraphAiAnalysis() to exist");

  assert.match(match[1], /graphState\.thinkingPanelVisible = true;/);
  assert.match(match[1], /graphState\.thinkingPanelOpen = true;/);
  assert.match(match[1], /graphState\.thinkingFilter = "all";/);
  assert.match(match[1], /graphState\.workbenchPanelOpen = true;/);
  assert.match(match[1], /if \(graphState\.workbenchPanelTab !== "clues"\) \{[\s\S]*graphState\.workbenchPanelTab = "questions";/);
  assert.doesNotMatch(match[1], /addSystemMessage\(\{/);
  assert.match(match[1], /graphState\.aiReviewSystemMessageId = "";/);
  assert.doesNotMatch(match[1], /openAiInboxModule/, "graph scan should not auto-navigate away from the graph");
});

test("graph AI scan button opens the right workbench for the action mode", () => {
  const source = readGraphCanvasEventRouter();

  assert.match(source, /const mode = String\(graphAiButton\.getAttribute\("data-run-graph-ai-analysis"\)/);
  assert.match(source, /graphState\.workbenchPanelOpen = true;[\s\S]*graphState\.workbenchPanelTab = mode === "theme" \? "questions" : mode === "gap" \? "clues" : graphState\.workbenchPanelTab === "questions" \? "questions" : "clues";[\s\S]*void runGraphAiAnalysis\(\);/);
});

test("graph AI review action stays inside the graph workbench", () => {
  const source = readGraphCanvasEventRouter();
  const start = source.indexOf('  const graphThinkingReviewButton = event.target.closest("[data-graph-focus-thinking-review]");');
  const end = source.indexOf('  const retryButton = event.target.closest("[data-graph-retry]");', start);
  assert.ok(start >= 0 && end > start, "expected graph thinking review action handler");
  const handler = source.slice(start, end);

  assert.match(handler, /graphState\.workbenchPanelOpen = true;/);
  assert.match(handler, /graphState\.workbenchPanelTab = "questions";/);
  assert.match(handler, /graphState\.thinkingPanelOpen = true;/);
  assert.match(handler, /graphState\.thinkingFilter = "all";/);
  assert.doesNotMatch(handler, /openSystemMessages\(\)/);
  assert.doesNotMatch(handler, /activateModule\("aiInbox"\)/);
  assert.doesNotMatch(handler, /openAiInboxModule\(\)/);
});

test("graph thinking tasks ignore stale AI isolated and relation candidates after the network is already connected", () => {
  const panelStateBuilderSource = readGraphPanelStateBuilder();
  const thinkingItems = moduleBuildGraphThinkingItemsForGraph({
    nodes: [{ id: "scope-a", title: "Scope A" }, { id: "scope-b", title: "Scope B" }],
    edges: [{ fromNoteId: "scope-a", toNoteId: "scope-b", status: "accepted" }],
    isolatedNotes: [],
    aiAnalysis: {
      analysis: {
        isolatedNotes: [{ noteId: "scope-a", title: "Stale isolated" }],
        relationCandidates: [
          { fromNoteId: "scope-a", toNoteId: "scope-b", relationType: "same_topic", rationale: "already connected" },
          { fromNoteId: "outside-a", toNoteId: "outside-b", relationType: "same_topic", rationale: "outside scope" },
          { fromNoteId: "scope-a", toNoteId: "outside-c", relationType: "supports", rationale: "still relevant" }
        ]
      }
    },
    nodeLookupMap: new Map([
      ["scope-a", { id: "scope-a", title: "Scope A" }],
      ["scope-b", { id: "scope-b", title: "Scope B" }],
      ["outside-c", { id: "outside-c", title: "Outside C" }]
    ])
  }, graphThinkingModelTestDeps());

  assert.deepEqual(thinkingItems.map((item) => item.title), ["Scope A -> Outside C"]);
  assert.equal(thinkingItems[0].tone, "review");
  assert.deepEqual(thinkingItems[0].highlightNodeIds, ["scope-a", "outside-c"]);
  assert.match(panelStateBuilderSource, /const scopedNetworkEdges = allGraphEdges\.filter\(\(edge\) => graphRelationTouchesNodeScope\(edge, scopedActionNodeIds\)\);/);
  assert.match(panelStateBuilderSource, /graphComputedIsolatedNotes\(scopedAllNodes, scopedNetworkEdges, aiIsolatedNotes\)/);
  assert.match(panelStateBuilderSource, /edges: scopedNetworkEdges,\s*bridgeGaps/);
  assert.match(panelStateBuilderSource, /aiAnalysis: graphState\.aiAnalysis,\s*isolatedNotes,\s*nodeLookupMap: graphRelationTargetNodeMap/);
  assert.match(panelStateBuilderSource, /const graphRelationTargetNodeMap = graphPotentialRelationNodeMap\(\);/);
  assert.match(panelStateBuilderSource, /const questionSpotSummary = !showingFocusedNote\s*\? buildGraphQuestionSpotSummaryFromItems\(thinkingItems,/);
});

test("isolated graph notes can request AI-assisted relation candidates and save them inside the graph workspace", () => {
  const source = readGraphResidualViews();
  const appShellSource = readPrototypeApp();
  const graphRouteSource = readGraphRouteRuntime();
  const nodeSelectionPanelSource = readGraphNodeSelectionPanel();
  const joinWorkspaceSource = readGraphIsolatedRelationWorkspace();
  const relationControllerSource = readGraphIsolatedRelationController();
  const isolatedWorkflowShellSource = readGraphIsolatedWorkflowShell();
  const relationStateQuerySource = readGraphRelationStateQuery();
  const saveControllerSource = readGraphRelationSaveController();
  const workflowControllerSource = readGraphRelationWorkflowController();
  const relationSaveTransactionSource = readRelationSaveTransaction();
  const graphAiCandidatesSource = readGraphAiCandidates();
  const isolatedDecisionNoteUpdateSource = readGraphIsolatedDecisionNoteUpdate();
  const graphAiConnectModelSource = readGraphAiConnectModel();
  const graphAiConnectRuntimeSource = readGraphAiConnectRuntimeController();
  const graphFollowupDraftTemplatesSource = readGraphFollowupDraftTemplates();
  const isolatedDecisionControllerSource = readGraphIsolatedDecisionController();
  const graphCanvasEventRouterSource = readGraphCanvasEventRouter();
  const html = readPrototypeHtml();
  assert.match(appShellSource, /from "\.\/graph-isolated-workflow-shell\.js";/);
  assert.match(appShellSource, /from "\.\/graph-relation-state-query\.js";/);
  assert.match(appShellSource, /from "\.\/graph-relation-workflow-controller\.js";/);
  assert.match(source, /createGraphIsolatedWorkflowShellRenderer\(\{/);
  assert.match(source, /createGraphRelationWorkflowController\(\{/);
  assert.match(source, /renderJoinNetworkFlow: renderGraphIsolatedJoinNetworkFlow/);
  assert.match(appShellSource, /graphDirectNetworkEdgeCount as computeGraphDirectNetworkEdgeCount/);
  assert.match(source, /graphRelationSaveResultForNote\(noteId, graphState\.isolatedRelationSaveResultByNoteId\)/);
  assert.match(relationStateQuerySource, /export function graphDirectNetworkEdgesForNote/);
  assert.match(relationStateQuerySource, /export function graphConnectedNoteIdsForNote/);
  assert.match(relationStateQuerySource, /export function graphIsolatedNodeIdsForGraph/);
  assert.match(isolatedWorkflowShellSource, /graphDirectNetworkEdgeCount/);
  assert.doesNotMatch(isolatedWorkflowShellSource, /function directNetworkEdgeCount/);

  assert.match(graphAiCandidatesSource, /export function graphAiRelationCandidatesForNote\(noteId = "", \{ analysis = null, nodeMap = new Map\(\), edges = \[\], limit = 5 \} = \{\}/);
  assert.match(source, /function graphRelationCandidateKey\(fromNoteId = "", toNoteId = "", relationType = ""\) \{/);
  assert.match(source, /function graphRelationPairKey\(leftNoteId = "", rightNoteId = ""\) \{/);
  assert.match(source, /function graphExistingRelationPairKeys\(edges = \[\]\) \{/);
  assert.match(source, /function graphPotentialRelationNodeMap\(\) \{/);
  assert.match(graphAiCandidatesSource, /export function graphPotentialRelationEvidenceText\(candidate = \{\}\) \{/);
  assert.match(graphAiCandidatesSource, /export function graphPotentialRelationRationaleDraft\(\{/);
  assert.match(graphAiCandidatesSource, /export function graphDecoratePotentialRelationCandidate\(candidate = \{\}, \{ nodeMap = new Map\(\) \} = \{\}, deps = \{\}\) \{/);
  assert.match(source, /function graphReviewSummaryFromAnalysis\(analysis = \{\}, previousSummary = \{\}\) \{/);
  assert.match(source, /const artifactCount = topicCandidateCount \+ Math\.max\(0, relationCandidateCount - bridgeCandidateCount\) \+ bridgeCandidateCount \+ isolatedNoteCount;/);
  assert.match(graphAiCandidatesSource, /export const GRAPH_REVERSIBLE_POTENTIAL_RELATION_TYPES = new Set\(\["bridges", "same_topic", "associated_with"\]\);/);
  assert.match(graphAiCandidatesSource, /export function graphCandidateBlocksFormalRelation\(candidate = \{\}\) \{/);
  assert.match(graphAiCandidatesSource, /export function graphCandidateCanSaveRelation\(candidate = \{\}/);
  assert.match(graphAiCandidatesSource, /export function graphRelationRationaleIsActionable\(value = ""\) \{/);
  assert.match(graphAiCandidatesSource, /export function graphPotentialRelationActionEndpoints\(cleanNoteId = "", sourceNoteId = "", targetNoteId = "", relationType = ""/);
  assert.match(graphAiCandidatesSource, /const relationType = graphPreferredRelationType\(candidate\);/);
  assert.match(graphAiCandidatesSource, /if \(!canSaveRelation\(candidate\)\) return null;/);
  assert.match(graphAiCandidatesSource, /const sourceNoteId = fromNoteId;/);
  assert.match(graphAiCandidatesSource, /const targetNoteId = toNoteId;/);
  assert.match(graphAiCandidatesSource, /id: String\(candidate\.id \|\| candidate\.candidateId \|\| candidate\.candidate_id \|\| ""\)\.trim\(\),/);
  assert.match(graphAiCandidatesSource, /sourceContentHash: String\(candidate\.sourceContentHash \|\| candidate\.source_content_hash \|\| ""\)\.trim\(\),/);
  assert.match(graphAiCandidatesSource, /const counterpartNoteId = fromNoteId === cleanNoteId \? toNoteId : fromNoteId;/);
  assert.match(graphAiCandidatesSource, /const \{ actionSourceNoteId, actionTargetNoteId \} = actionEndpoints\(cleanNoteId, sourceNoteId, targetNoteId, relationType\);/);
  assert.match(graphAiCandidatesSource, /const pairKey = graphRelationPairKey\(sourceNoteId, targetNoteId\);/);
  assert.match(graphAiCandidatesSource, /if \(!pairKey \|\| seenPairKeys\.has\(pairKey\) \|\| existingRelationPairKeys\.has\(pairKey\)\) return null;/);
  assert.match(graphAiCandidatesSource, /actionSourceNoteId,/);
  assert.match(graphAiCandidatesSource, /actionTargetNoteId,/);
  assert.match(graphAiConnectRuntimeSource, /async function refineGraphPotentialRelationsForNote\(noteId = "", candidates = \[\], \{ directoryId = "" \} = \{\}\) \{/);
  assert.match(graphAiConnectRuntimeSource, /let generatedThisRun = 0;/);
  assert.match(graphAiConnectRuntimeSource, /let waitingConfirmationThisRun = 0;/);
  assert.match(graphAiConnectRuntimeSource, /let failedThisRun = 0;/);
  assert.match(graphAiConnectRuntimeSource, /let removedThisRun = 0;/);
  assert.match(graphAiConnectRuntimeSource, /const refineResult = await refineGraphPotentialRelationCandidate\(cleanNoteId, candidate, \{ directoryId \}\);/);
  assert.match(graphAiConnectRuntimeSource, /if \(refineResult\?\.aiReasonGenerated\) generatedThisRun \+= 1;/);
  assert.match(graphAiConnectRuntimeSource, /if \(refineResult\?\.removed\) \{/);
  assert.match(graphAiConnectRuntimeSource, /removedThisRun \+= 1;/);
  assert.match(graphAiConnectRuntimeSource, /continue;/);
  assert.match(graphAiConnectRuntimeSource, /if \(refineResult\?\.needsConfirmation\) \{/);
  assert.match(graphAiConnectRuntimeSource, /waitingConfirmationThisRun \+= 1;/);
  assert.match(graphAiConnectRuntimeSource, /if \(refineResult\?\.needsConfirmation\) \{[\s\S]*break;/);
  assert.match(graphAiConnectRuntimeSource, /if \(refineResult\?\.ok === false\) failedThisRun \+= 1;/);
  assert.match(graphAiConnectRuntimeSource, /已补充 \${generatedThisRun} 条可能关联的 AI 理由，另有 \${waitingConfirmationThisRun} 条等待你确认当前 AI 设置后再生成理由/);
  assert.match(graphAiConnectRuntimeSource, /已补充 \${generatedThisRun} 条可能关联的 AI 理由，另有 \${failedThisRun} 条暂未生成理由，可稍后重试/);
  assert.match(graphAiConnectRuntimeSource, /`\${failedThisRun} 条可能关联暂未生成 AI 理由，可稍后重试`/);
  assert.match(graphAiConnectRuntimeSource, /async function refineGraphPotentialRelationCandidate\(noteId = "", candidate = \{\}, \{ directoryId = "", confirmationApproved = false \} = \{\}\) \{/);
  assert.match(graphAiConnectRuntimeSource, /const refined = await refinePotentialRelationCandidate\(\{/);
  assert.match(graphAiConnectRuntimeSource, /const merged = Boolean\(refined && mergePotentialRelationCandidateIntoGraphAnalysis\(refined\)\);/);
  assert.match(source, /function removePotentialRelationCandidateFromGraphAnalysis\(candidateToRemove = \{\}\) \{/);
  assert.match(source, /const nextSummary = graphReviewSummaryFromAnalysis\(nextAnalysis, graphState\.aiAnalysis\?\.reviewItems\?\.summary\);/);
  assert.match(source, /summary: nextSummary/);
  assert.match(graphAiConnectRuntimeSource, /const aiReason = String\(refined\?\.aiRationale \|\| ""\)\.trim\(\);/);
  assert.match(graphAiConnectRuntimeSource, /const aiError = String\(refined\?\.aiError \|\| ""\)\.trim\(\);/);
  assert.match(graphAiConnectRuntimeSource, /const needsConfirmation =/);
  assert.match(graphAiConnectRuntimeSource, /if \(needsConfirmation\) \{/);
  assert.match(graphAiConnectRuntimeSource, /confirmationApproved: true, confirmBudget: true/);
  assert.match(graphAiCandidatesSource, /return decorateCandidate\(\{[\s\S]*sourceContentHash: String\(candidate\.sourceContentHash \|\| candidate\.source_content_hash \|\| ""\)\.trim\(\),[\s\S]*relationType[\s\S]*\}, \{ nodeMap \}/);
  assert.match(source, /return graphDecoratePotentialRelationCandidate\(\{[\s\S]*\.\.\.refinedCandidate,[\s\S]*targetNoteId: refinedCandidate\.targetNoteId \|\| refinedCandidate\.toNoteId \|\| candidate\.targetNoteId[\s\S]*\}, \{ nodeMap \}\);/);
  assert.match(graphAiConnectRuntimeSource, /if \(code === "POTENTIAL_RELATION_CANDIDATE_NOT_FOUND"\) \{/);
  assert.match(graphAiConnectRuntimeSource, /const removed = removePotentialRelationCandidateFromGraphAnalysis\(candidate\);/);
  assert.match(graphAiConnectRuntimeSource, /这条可能关联已不在当前图谱范围内，暂时不再显示/);
  assert.match(graphAiConnectRuntimeSource, /else setStatus\(`生成关系说明失败：\${String\(error\?\.message \|\| error\)}`\, "warn"\);/);
  assert.match(graphAiConnectRuntimeSource, /mergePotentialRelationCandidateIntoGraphAnalysis\(refined\)/);
  assert.match(source, /function graphPotentialRelationNeedsConfirmation\(candidate = \{\}\) \{/);
  assert.match(source, /data-graph-ai-refine-confirm/);
  assert.match(source, /data-graph-ai-refine-retry/);
  assert.match(graphRouteSource, /已重新生成这条可能关联的 AI 理由/);
  assert.match(graphRouteSource, /async function triggerGraphPotentialRelationRefine\(/);
  assert.match(graphRouteSource, /async function confirmGraphPotentialRelationRefine\(button = null\) \{/);
  assert.match(graphRouteSource, /async function retryGraphPotentialRelationRefine\(button = null\) \{/);
  assert.match(graphRouteSource, /正在重新生成关系说明/);
  assert.match(graphRouteSource, /progressStatus: "正在按当前 AI 设置生成关系说明\.\.\."/);
  assert.doesNotMatch(graphRouteSource, /setStatus\("已确认使用当前 AI 设置，正在生成关系说明", "ok"\);/);
  assert.match(source, /function renderGraphIsolatedJoinNetworkFlow\(\s*noteId = "",\s*\{/);
  assert.match(source, /renderGraphIsolatedJoinNetworkFlowHtml\(noteId, \{/);
  assert.match(source, /aiCandidatesForNote: graphAiRelationCandidatesForNote/);
  assert.match(source, /manualTargetsForNote: graphManualRelationTargetsForNote/);
  assert.match(source, /relationDraft: graphState\.isolatedRelationDraftByNoteId\?\.\[String\(noteId \|\| ""\)\.trim\(\)\] \|\| \{\}/);
  assert.match(joinWorkspaceSource, /aria-label="建立笔记关系"/);
  assert.doesNotMatch(source, /关联工作台/);
  assert.match(joinWorkspaceSource, /data-graph-ai-candidate-list/);
  assert.match(joinWorkspaceSource, /data-graph-manual-relation-type/);
  assert.match(joinWorkspaceSource, /const targetId = String\(candidate\.counterpartNoteId \|\| ""\)\.trim\(\);/);
  assert.match(joinWorkspaceSource, /if \(!targetId \|\| targetId === cleanNoteId\) return "";/);
  assert.match(joinWorkspaceSource, /reversibleRelationTypes\.has\(rawRelationType\)/);
  assert.match(joinWorkspaceSource, /\? rawRelationType\s*: "associated_with";/);
  assert.match(joinWorkspaceSource, /data-graph-manual-target-search/);
  assert.match(joinWorkspaceSource, /data-graph-isolated-relation-type/);
  assert.match(joinWorkspaceSource, /data-graph-default-relation-type/);
  assert.match(joinWorkspaceSource, /data-graph-isolated-rationale/);
  assert.match(joinWorkspaceSource, /data-graph-isolated-relation-save/);
  assert.match(joinWorkspaceSource, /关联/);
  assert.doesNotMatch(joinWorkspaceSource, mojibakeCopyPattern);
  assert.match(joinWorkspaceSource, /saveHint = "保存后进入关系网。"/);
  assert.match(joinWorkspaceSource, /找目标笔记/);
  assert.match(source, /function renderGraphIsolatedWorkflowTabs\(\{ noteId = "", isolatedQueueMarkup = "", decisionCards = \[\], prompts = \[\], nodeMap = new Map\(\), edges = \[\], visibleEdgeCount = 0 \} = \{\}\) \{/);
  assert.match(source, /return graphIsolatedWorkflowShell\.renderWorkflowTabs\(\{ noteId, isolatedQueueMarkup, decisionCards, prompts, nodeMap, edges, visibleEdgeCount \}\);/);
  assert.match(isolatedWorkflowShellSource, /renderJoinNetworkFlow\(cleanNoteId, \{[\s\S]*heading: "关联"[\s\S]*helper: ""/);
  assert.doesNotMatch(isolatedWorkflowShellSource, /选目标、写理由、保存|先选一条真正相关的笔记/);
  assert.doesNotMatch(source, /function renderGraphRelationFormSelectionPanel/);
  assert.doesNotMatch(workflowControllerSource, /kind: "relationForm"/);
  assert.match(source, /openRelationComposerFromGraphAction/);
  assert.match(source, /data-graph-open-relation-form/);
  assert.match(source, /return graphIsolatedWorkflowShell\.renderSelectionPanel\(\{ selection, isolatedNotes, nodeMap, edges \}\);/);
  assert.match(isolatedWorkflowShellSource, /renderWorkflowTabs\(\{ noteId, isolatedQueueMarkup, nodeMap, edges, visibleEdgeCount \}\)/);
  assert.match(isolatedWorkflowShellSource, /task: null,/);
  assert.doesNotMatch(source, /"开始处理"/);
  assert.equal(graphSelectionUsesOverlay("isolated"), true);
  assert.equal(graphSelectionUsesOverlay("isolatedComplete"), true);
  assert.equal(graphSelectionUsesOverlay("node", true), true);
  assert.equal(graphSelectionUsesOverlay("node", false), false);
  assert.match(
    renderGraphVisualMapShellView({ selectionOverlayMarkup: "<section>overlay</section>" }),
    /<div class="graph-selection-overlay" role="dialog" aria-modal="false"/
  );
  assert.match(joinWorkspaceSource, /data-graph-ai-candidate-list/);
  assert.match(joinWorkspaceSource, /data-graph-pick-manual-target="\$\{escapeHtml\(targetId\)\}"/);
  assert.match(source, /function syncGraphIsolatedAiCandidateForm\(select = null\) \{/);
  assert.match(source, /return graphIsolatedRelationController\.syncAiCandidateForm\(select\);/);
  assert.match(source, /function markGraphIsolatedRationaleUserEdited\(input = null\) \{/);
  assert.match(source, /return graphIsolatedRelationController\.markRationaleUserEdited\(input\);/);
  assert.match(source, /function updateGraphIsolatedInlinePreview\(form = null, source = null\) \{/);
  assert.match(source, /return graphIsolatedRelationController\.updateInlinePreview\(form, source\);/);
  assert.match(relationControllerSource, /updateInlinePreview\(form, nextDraft\.option\)/);
  assert.match(relationControllerSource, /updateInlinePreview\(form, button\)/);
  assert.match(relationControllerSource, /const clearButton = panel\.querySelector\("\[data-graph-clear-candidate-preview\]"\);/);
  assert.match(relationControllerSource, /if \(clearButton\) clearButton\.hidden = !title;/);
  assert.match(relationControllerSource, /delete graphState\.isolatedCandidatePreviewByNoteId\[noteId\];/);
  assert.match(source, /function filterGraphManualRelationTargets\(input = null\) \{/);
  assert.match(source, /return graphIsolatedRelationController\.filterManualRelationTargets\(input\);/);
  assert.match(source, /function pickGraphManualRelationTarget\(button = null\) \{/);
  assert.match(source, /return graphIsolatedRelationController\.pickManualRelationTarget\(button\);/);
  assert.doesNotMatch(source, /if \(relationSelect\) relationSelect\.value = "associated_with";/);
  assert.match(relationControllerSource, /input\.removeAttribute\("data-selected-title"\)/);
  assert.match(relationControllerSource, /rationaleInput\.setAttribute\("data-graph-rationale-source", "manual"\)/);
  assert.match(relationControllerSource, /button\.classList\.remove\("is-selected"\)/);
  assert.match(relationControllerSource, /input\.setAttribute\("data-selected-title", title\)/);
  assert.match(source, /async function saveGraphIsolatedRelationForm\(button = null\) \{/);
  assert.match(source, /return graphIsolatedRelationController\.saveRelationForm\(button\);/);
  assert.match(graphCanvasEventRouterSource, /const rationaleInput = event\.target\.closest\("\[data-graph-isolated-rationale\]"\);/);
  assert.match(graphCanvasEventRouterSource, /markGraphIsolatedRationaleUserEdited\(rationaleInput\);/);
  assert.match(source, /async function saveGraphConfirmedRelation\(\{/);
  assert.match(isolatedDecisionControllerSource, /buildGraphIsolatedDecisionNoteUpdate\(\{ note, mode, text \}/);
  assert.match(isolatedDecisionNoteUpdateSource, /graphUpsertMarkdownSection\(originalBody, thesisHeading, text\)/);
  assert.match(isolatedDecisionNoteUpdateSource, /graphUpsertMarkdownSection\(originalBody, relationNoteHeading,/);
  assert.match(source, /function graphNoteHasSavedIsolationDisposition\(note = \{\}\) \{/);
  assert.match(source, /noteHasSavedIsolationDisposition: graphNoteHasSavedIsolationDisposition/);
  assert.equal(moduleBuildGraphThinkingItemsForGraph({
    nodes: [{ id: "handled-isolated", title: "Handled" }],
    isolatedNotes: [{ noteId: "handled-isolated" }],
    aiAnalysis: { analysis: { isolatedNotes: [{ noteId: "handled-isolated", title: "Handled" }] } }
  }, graphThinkingModelTestDeps({ graphNoteHasSavedIsolationDisposition: () => true })).length, 0);
  assert.doesNotMatch(isolatedWorkflowShellSource, /data-graph-isolated-action="\$\{escapeHtml\(card\.key\)\}" data-open-note=/);
  assert.doesNotMatch(isolatedWorkflowShellSource, /data-graph-isolated-action="\$\{escapeHtml\(card\.key\)\}"/);
  assert.doesNotMatch(isolatedWorkflowShellSource, /data-graph-followup-action="relations">手动建立关系<\/button>/);
  assert.doesNotMatch(isolatedWorkflowShellSource, /暂不处理/);
  assert.doesNotMatch(isolatedWorkflowShellSource, /其它待处理/);
  const isolatedDecisionStart = source.indexOf('function openGraphIsolatedDecisionAction(noteId = "", action = "") {');
  const isolatedDecisionEnd = source.indexOf('function graphAiAnalysisPayload(', isolatedDecisionStart);
  assert.ok(isolatedDecisionStart >= 0 && isolatedDecisionEnd > isolatedDecisionStart, "expected isolated decision action");
  const isolatedDecisionSource = source.slice(isolatedDecisionStart, isolatedDecisionEnd);
  assert.doesNotMatch(isolatedDecisionSource, /openGraphFollowupNote\(cleanNoteId/);
  assert.doesNotMatch(isolatedDecisionSource, /activateModule\("explorer"\)/);
  assert.doesNotMatch(isolatedDecisionSource, /openNoteById\(cleanNoteId/);
  assert.match(source, /createNoteRelation,/);
  assert.doesNotMatch(source, /function openGraphRelationFormInSelection/);
  assert.doesNotMatch(source, /openGraphRelationFormFromAction\(button\)/);
  assert.match(source, /openRelationComposerFromGraphAction/);
  assert.match(source, /graphNormalizeRelationWorkflowSelection\(selection, \{/);
  assert.match(workflowControllerSource, /export function graphRelationWorkflowFormSelectionFromAction/);
  assert.match(workflowControllerSource, /legacy_relation_form_removed/);
  assert.doesNotMatch(workflowControllerSource, /kind: "relationForm"/);
  assert.match(source, /openRelationComposerFromGraphAction/);
  assert.doesNotMatch(workflowControllerSource, /const previousReturnTo = cleanKind\(currentSelection\?\.returnTo\);/);
  assert.doesNotMatch(workflowControllerSource, /rationale,\s*returnTo,\s*entryRoute\s*\}/);
  assert.match(workflowControllerSource, /if \(kind === "relationform"\) return null;/);
  assert.match(appShellSource, /from "\.\/graph-relation-save-controller\.js";/);
  assert.match(source, /createGraphRelationSaveController\(\{/);
  assert.match(source, /saveConfirmedRelation: saveGraphConfirmedRelation/);
  assert.match(source, /openRelationComposerFromGraphAction/);
  assert.match(saveControllerSource, /from "\.\/graph-relation-save-flow\.js";/);
  assert.match(saveControllerSource, /from "\.\/relation-save-transaction\.js";/);
  assert.match(saveControllerSource, /graphRelationSaveSelection\(\{ previousSelection, button, noteId: cleanNoteId \}\)/);
  assert.match(source, /data-graph-ai-candidate-apply/);
  assert.match(source, /const currentNoteId = String\(noteId \|\| ""\)\.trim\(\);/);
  assert.match(source, /const aiTargetNoteId = String\(candidate\.counterpartNoteId \|\| candidate\.actionTargetNoteId \|\| candidate\.targetNoteId \|\| ""\)\.trim\(\);/);
  assert.match(source, /data-open-note="\$\{escapeHtml\(currentNoteId \|\| candidate\.sourceNoteId\)\}"/);
  assert.match(source, /data-graph-target-note="\$\{escapeHtml\(aiTargetNoteId\)\}"/);
  assert.doesNotMatch(source, /data-open-note="\$\{escapeHtml\(candidate\.actionSourceNoteId \|\| candidate\.sourceNoteId\)\}"/);
  assert.match(source, /data-graph-relation-type="\$\{escapeHtml\(candidate\.relationType\)\}"/);
  assert.match(source, /data-graph-rationale-draft="\$\{escapeHtml\(candidate\.rationaleDraft\)\}"/);
  assert.match(source, /data-graph-insight-question-draft="\$\{escapeHtml\(candidate\.insightQuestionDraft\)\}"/);
  assert.match(graphAiConnectRuntimeSource, /async function runGraphAiConnectForNote\(noteId = ""\) \{/);
  assert.match(graphAiConnectModelSource, /relationLimit: 24,/);
  assert.match(graphAiConnectModelSource, /focusNoteId: cleanNoteId,/);
  assert.match(graphAiConnectModelSource, /currentNoteId: cleanNoteId,/);
  assert.match(graphAiConnectRuntimeSource, /if \(candidates\.length && !firstTargetId\) void refineGraphPotentialRelationsForNote\(cleanNoteId, candidates, \{ directoryId \}\);/);
  assert.match(graphAiConnectRuntimeSource, /graphRelationWorkflowController\?\.startAiConnectForNote\?\.\(cleanNoteId\);/);
  assert.match(graphAiConnectRuntimeSource, /graphRelationWorkflowController\?\.applyAiConnectRoute\?\.\(\{/);
  assert.match(graphAiConnectRuntimeSource, /openRelationComposerFromGraphAction\(\{/);
  assert.match(graphAiConnectRuntimeSource, /candidateSource: "graph-ai-connect"/);
  assert.doesNotMatch(graphAiConnectRuntimeSource, /graphState\.selection = \{\s*kind: "relationForm"/);
  assert.match(workflowControllerSource, /const visibleEdgeCount = graphDirectNetworkEdgeCount\(cleanNoteId, edges,/);
  assert.match(workflowControllerSource, /const graphSelectionKind = previousSelectionKind === "isolated" \|\| \(!previousSelectionKind && visibleEdgeCount === 0\) \? "isolated" : "node";/);
  assert.match(graphAiConnectRuntimeSource, /workflowRoute: \{ focus: "graph", source: "graph-ai-connect", graphSelectionKind \}/);
  assert.match(graphRouteSource, /async function saveGraphAiCandidateRelation\(button = null\) \{/);
  assert.match(graphRouteSource, /async function saveGraphCandidateRelation\(button = null\) \{/);
  assert.match(graphRouteSource, /return graphRelationSaveController\.saveAiCandidateRelation\(button\);/);
  assert.match(graphRouteSource, /return graphRelationSaveController\.saveCandidateRelation\(button\);/);
  assert.match(saveControllerSource, /if \(!confirmableRelationTypes\.has\(relationType\) \|\| relationType === "no_relation"\) \{/);
  assert.match(source, /async function saveGraphConfirmedRelation\(\{/);
  assert.match(source, /return graphRelationSaveController\.saveConfirmedRelation\(\{ noteId, targetNoteId, relationType, rationale, insightQuestion, button \}\);/);
  assert.match(saveControllerSource, /if \(!rationaleIsActionable\(cleanRationale\)\) \{/);
  assert.match(saveControllerSource, /const rationale = rationaleIsActionable\(rationaleDraft\) \? rationaleDraft : "";/);
  assert.match(saveControllerSource, /openRelationComposerFromGraphAction\(button\);/);
  assert.doesNotMatch(saveControllerSource, /openRelationFormInSelection\(button\);/);
  assert.match(saveControllerSource, /const transaction = await saveRelationTransaction\(\{/);
  assert.match(saveControllerSource, /const saveResult = \{\s*\.\.\.transaction\.result,\s*nextIsolated: null\s*\};/);
  assert.match(saveControllerSource, /graphState\.isolatedRelationSaveResultByNoteId\[cleanNoteId\] = saveResult;/);
  assert.match(saveControllerSource, /created: transaction\.relation\?\.created !== false/);
  assert.doesNotMatch(saveControllerSource, /await createNoteRelation\(cleanNoteId, \{/);
  assert.match(saveControllerSource, /if \(cleanNoteId === cleanTargetNoteId\) \{/);
  assert.match(saveControllerSource, /await refreshDirectoryGraph\(\);/);
  assert.match(saveControllerSource, /normalizeRelationSaveTransactionInput\(\{ noteId, targetNoteId, relationType, rationale, insightQuestion \}\)/);
  assert.match(graphFollowupDraftTemplatesSource, /rationaleDraft:/);
  assert.match(graphFollowupDraftTemplatesSource, /insightQuestionDraft:/);
  assert.match(nodeSelectionPanelSource, /renderGraphAiConnectCandidates\(normalized\.nodeId, \{[\s\S]*hideEmpty: directEdges\.length > 0[\s\S]*\}\)/);
  assert.match(appShellSource, /runAiConnectForNote: runGraphAiConnectForNote/);
  assert.match(graphCanvasEventRouterSource, /const graphAiConnectButton = event\.target\.closest\("\[data-graph-ai-connect-note\]"\);/);
  assert.match(graphCanvasEventRouterSource, /const graphAiCandidateButton = event\.target\.closest\("\[data-graph-ai-candidate-apply\]"\);/);
  assert.match(graphCanvasEventRouterSource, /const graphAiRefineConfirmButton = event\.target\.closest\("\[data-graph-ai-refine-confirm\]"\);/);
  assert.match(graphCanvasEventRouterSource, /await confirmGraphPotentialRelationRefine\(graphAiRefineConfirmButton\);/);
  assert.match(graphCanvasEventRouterSource, /const graphAiRefineRetryButton = event\.target\.closest\("\[data-graph-ai-refine-retry\]"\);/);
  assert.match(graphCanvasEventRouterSource, /await retryGraphPotentialRelationRefine\(graphAiRefineRetryButton\);/);
  assert.match(relationSaveTransactionSource, /status = "confirmed"/);
  assert.match(saveControllerSource, /graphState\.selection = null;/);
  assert.match(saveControllerSource, /renderGraphPanel\(\);/);
  assert.doesNotMatch(saveControllerSource, /openGraphSelection\(followUpSelection\);/);
  assert.doesNotMatch(saveControllerSource, /const followUpSelection = nextIsolatedSelection/);
  assert.match(source, /function renderGraphIsolatedCompletePanel\(\{ selection = null, isolatedNotes = \[\], nodeMap = new Map\(\), edges = \[\] \} = \{\}\) \{/);
  const isolatedCompleteSource = extractFunctionSource(source, "renderGraphIsolatedCompletePanel");
  assert.doesNotMatch(isolatedCompleteSource, /data-graph-select-node/);
  assert.doesNotMatch(isolatedCompleteSource, /renderGraphAiConnectCandidates/);
  assert.doesNotMatch(isolatedCompleteSource, /继续确认这条笔记的其它可选目标/);
  assert.match(isolatedCompleteSource, /return graphIsolatedWorkflowShell\.renderCompletePanel\(\{/);
  assert.match(isolatedCompleteSource, /saveResult: graphRelationSaveResultForNote\(noteId, graphState\.isolatedRelationSaveResultByNoteId\)/);
  assert.match(isolatedWorkflowShellSource, /const queueItems = isolatedQueueItems\(\{ isolatedNotes, nodeMap, edges, currentNoteId: noteId, limit: 8 \}\);/);
  assert.match(isolatedWorkflowShellSource, /const queuedNextItem = nextIsolatedQueueItem\(queueItems, noteId\);/);
  assert.match(isolatedWorkflowShellSource, /const nextItem = queuedNextItem \|\| \(fallbackNextNode/);
  assert.doesNotMatch(isolatedWorkflowShellSource, /Array\.isArray\(isolatedNotes\) \? isolatedNotes : \[\]/);
  assert.match(saveControllerSource, /graphRelationSavedNextStepStatus/);
  assert.match(fs.readFileSync(path.join(repoRoot, "apps/web/src/graph-relation-save-flow.js"), "utf8"), /下一步可以继续处理下一条未关联笔记/);
  assert.doesNotMatch(source, /继续给这条补关系/);

  assert.match(html, /\.graph-isolated-join \{[\s\S]*display: grid;[\s\S]*border: 1px solid #dbe7ef;[\s\S]*border-left: 4px solid #0f6f48;/);
  assert.match(html, /\.graph-isolated-relation-form \{[\s\S]*display: grid;/);
  assert.doesNotMatch(html, /\.graph-isolated-mode-switch \{[\s\S]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/);
  assert.match(html, /\.graph-isolated-form-grid \{[\s\S]*grid-template-columns: minmax\(0, 1fr\);/);
  assert.match(html, /\.graph-selection-overlay \{[\s\S]*position: absolute;[\s\S]*inset: 0;[\s\S]*z-index: 120;[\s\S]*pointer-events: auto;[\s\S]*overflow: hidden;/);
  assert.match(html, /\.graph-map-stage\.has-selection-overlay \.graph-map-viewport \{[\s\S]*pointer-events: none;/);
  assert.match(html, /\.graph-selection-overlay \.graph-selection-panel\.is-isolated \{[\s\S]*width: min\(1120px, 100%\);[\s\S]*height: min\(720px, calc\(100% - 40px\)\);/);
  assert.match(html, /\.graph-selection-overlay \.graph-selection-panel\.is-isolated \.graph-selection-body \{[\s\S]*overflow: auto;/);
  assert.match(html, /\.graph-isolated-workflow \{[\s\S]*display: grid;[\s\S]*border: 1px solid #d8e7ef;/);
  assert.match(html, /\.graph-isolated-workflow-tab\.is-active \{[\s\S]*background: #ffffff;[\s\S]*color: #0f6f48;/);
  assert.match(html, /\.module-workspace\.graph-mode \.graph-panel \{[\s\S]*padding-top: 14px;[\s\S]*overflow: visible;/);
  assert.match(html, /\.module-workspace\.graph-mode \.graph-inline-notice\.is-info \{[\s\S]*display: none;/);
  assert.match(html, /\.module-workspace\.graph-mode \.graph-map-head \{[\s\S]*position: static;[\s\S]*display: grid;[\s\S]*background: #fff;/);
  assert.match(html, /\.module-workspace\.graph-mode \.graph-reading-lens-row \{[\s\S]*align-items: center;[\s\S]*width: 100%;[\s\S]*flex-wrap: wrap;/);
  assert.match(html, /\.module-workspace\.graph-mode \.graph-reading-lens \{[\s\S]*flex-wrap: nowrap;[\s\S]*overflow-x: auto;[\s\S]*scrollbar-width: none;/);
  assert.match(html, /#moduleWorkspace\.graph-mode \.graph-head \{[\s\S]*display: none;/);
  assert.match(html, /#moduleWorkspace\.graph-mode #graphRefresh \{[\s\S]*display: none;/);
  assert.match(html, /#moduleWorkspace\.graph-mode \.graph-view-tab \{[\s\S]*min-height: 36px;/);
  assert.match(html, /#moduleWorkspace\.graph-mode \.graph-map-stage,[\s\S]*--graph-map-height: clamp\(420px, 62dvh, 640px\);/);
  assert.match(html, /\.graph-ai-connect \{[\s\S]*display: grid;[\s\S]*border: 1px solid #d8e7ef;/);
  assert.match(html, /\.graph-ai-connect-card \{[\s\S]*grid-template-columns: minmax\(0, 1fr\) auto;[\s\S]*border-radius: 12px;/);
  assert.match(html, /\.graph-ai-connect-actions \{[\s\S]*display: flex;[\s\S]*justify-content: flex-end;/);
});

test("graph selection upgrades isolated notes to connected nodes after a saved relation and keeps summary counts scoped instead of filter-limited", () => {
  const panelStateBuilderSource = readGraphPanelStateBuilder();
  const workflowControllerSource = readGraphRelationWorkflowController();
  const normalized = graphNormalizeRelationWorkflowSelection(
    { kind: "isolated", noteId: "note-1" },
    {
      nodes: [{ id: "note-1" }],
      isolatedNotes: [],
      resolveIsolatedSelection: () => null
    }
  );

  assert.deepEqual(normalized, { kind: "isolated", noteId: "note-1" });
  assert.match(workflowControllerSource, /const isolated = resolveIsolatedSelection\(selection, isolatedNotes, \[\]\);/);
  assert.match(workflowControllerSource, /return \{\s*kind: "isolated",\s*noteId,/);
  assert.match(panelStateBuilderSource, /const baseSummary = `\$\{scopedAllNodes\.length\} 条永久笔记，\$\{scoped\.edges\.length\} 条关系`;/);
});

test("graph node clicks without confirmed relations open the large relation workflow", () => {
  const runtimeStateSource = readGraphVisualMapRuntimeState();
  const selectionStateSource = readGraphVisualMapSelectionState();
  const nodeSelectionPanelSource = readGraphNodeSelectionPanel();

  assert.match(runtimeStateSource, /buildGraphVisualMapSelectionState\(/);
  assert.match(selectionStateSource, /selectionNodeNeedsRelationWorkflow =\s*activeSelection\?\.kind === "node" && graphNodeNeedsRelationWorkflow\(activeSelection\.nodeId, contextualSelectionEdges, contextualNodeMap\);/);
  assert.equal(graphSelectionUsesOverlay("isolated"), true);
  assert.equal(graphSelectionUsesOverlay("isolatedComplete"), true);
  assert.equal(graphSelectionUsesOverlay("node", true), true);
  assert.match(nodeSelectionPanelSource, /if \(graphNodeNeedsRelationWorkflow\(normalized\.nodeId, edges, nodeMap\)\) \{[\s\S]*return renderGraphIsolatedSelectionPanel\(\{/);
});

test("graph AI candidates prefill relation forms with a usable rationale draft instead of a review prompt", () => {
  assert.equal(
    moduleGraphPotentialRelationRationaleDraft({
      relationLabel: "支持",
      actionSourceTitle: "甲",
      actionTargetTitle: "乙",
      aiRationale: "乙给甲提供证据。"
    }),
    "我确认“甲”和“乙”可以建立支持，因为乙给甲提供证据。"
  );
  assert.equal(
    moduleGraphPotentialRelationRationaleDraft({
      relationLabel: "相关关系",
      actionSourceTitle: "甲",
      actionTargetTitle: "乙"
    }),
    "“甲”和“乙”在标题、标签或核心判断上出现相近主题，可以先建立相关关系；后续写作时再检查这条关系是否需要改成支持、限定或反方。"
  );
});

test("graph network-edge status handling keeps suggested links in-network but still lets dismissed history re-enter candidates", () => {
  const panelStateBuilderSource = readGraphPanelStateBuilder();

  assert.equal(moduleGraphRelationStatusCountsAsNetworkEdge("suggested"), true);
  assert.equal(moduleGraphRelationStatusCountsAsNetworkEdge("draft"), true);
  assert.equal(moduleGraphRelationStatusCountsAsNetworkEdge("confirmed"), true);
  assert.equal(moduleGraphRelationStatusCountsAsNetworkEdge("dismissed"), false);
  assert.match(panelStateBuilderSource, /const connectedNoteIds = new Set\(\s*allGraphEdges\s*\.filter\(\(edge\) => graphRelationStatusCountsAsNetworkEdge\(edge\?\.status\)\)\s*\.flatMap/);
});

test("graph AI summary treats bridge candidates as a subset instead of double counting them", () => {
  const panelStateBuilderSource = readGraphPanelStateBuilder();

  const bridgeSubset = moduleGraphPendingAiCandidateCount(
    [
      { sourceNoteId: "a", targetNoteId: "b", relationType: "bridges", componentBridge: true },
      { sourceNoteId: "a", targetNoteId: "b", relationType: "bridges", componentBridge: true },
      { sourceNoteId: "a", targetNoteId: "c", relationType: "same_topic" }
    ],
    { bridgeOnly: true }
  );
  const relationSubset = moduleGraphPendingAiCandidateCount(
    [
      { sourceNoteId: "a", targetNoteId: "b", relationType: "bridges", componentBridge: true },
      { sourceNoteId: "a", targetNoteId: "c", relationType: "same_topic" }
    ],
    { excludePairs: bridgeSubset.pairKeys, excludeBridge: true }
  );
  assert.equal(bridgeSubset.count, 1);
  assert.equal(relationSubset.count, 1);

  const summary = moduleGraphAiAnalysisSummaryStateForGraph({
    aiAnalysis: {
      analysis: {
        topicCandidates: [{ noteIds: ["a", "b"] }],
        bridgeCandidates: [{ sourceNoteId: "a", targetNoteId: "b", relationType: "bridges" }],
        relationCandidates: [
          { sourceNoteId: "a", targetNoteId: "b", relationType: "bridges", componentBridge: true },
          { sourceNoteId: "a", targetNoteId: "c", relationType: "same_topic" }
        ],
        isolatedNotes: [{ noteId: "a" }]
      },
      reviewItems: { summary: { topicCandidateCount: 9, relationCandidateCount: 9, bridgeCandidateCount: 9, isolatedNoteCount: 9 } }
    },
    nodes: [{ id: "a" }, { id: "b" }, { id: "c" }],
    edges: []
  }, graphThinkingModelTestDeps());
  const questionSummary = moduleBuildGraphQuestionSpotSummaryForGraph({
    reviewQueueTotal: 8,
    aiAnalysis: {
      analysis: {
        relationCandidates: [{ sourceNoteId: "a", targetNoteId: "c", relationType: "same_topic" }]
      }
    },
    nodes: [{ id: "a" }, { id: "c" }],
    edges: []
  }, graphThinkingModelTestDeps());
  assert.deepEqual(
    {
      topicCount: summary.topicCount,
      bridgeCount: summary.bridgeCount,
      relationCount: summary.relationCount,
      isolatedCount: summary.isolatedCount,
      totalCandidates: summary.totalCandidates
    },
    { topicCount: 1, bridgeCount: 1, relationCount: 1, isolatedCount: 1, totalCandidates: 4 }
  );
  assert.equal(questionSummary.categories.find((item) => item.key === "review")?.count, 8);
  assert.match(panelStateBuilderSource, /graphClueSummaryState\(\{[\s\S]*nodes: scopedAllNodes,[\s\S]*edges: scopedNetworkEdges/);
});

test("graph AI live counts stay scoped and classify component bridges correctly", () => {
  const counts = moduleGraphAiAnalysisSummaryStateForGraph({
    aiAnalysis: {
      analysis: {
        topicCandidates: [
          { noteIds: ["scope-a", "scope-b"] },
          { noteIds: ["outside-a", "outside-b"] }
        ],
        relationCandidates: [
          { fromNoteId: "scope-a", toNoteId: "scope-b", relationType: "bridges", componentBridge: true },
          { fromNoteId: "outside-a", toNoteId: "outside-b", relationType: "same_topic" },
          { fromNoteId: "scope-a", toNoteId: "outside-a", relationType: "same_topic" }
        ],
        bridgeCandidates: [
          { noteIds: ["scope-a"], targetNoteIds: ["outside-b"], relationType: "bridges" }
        ],
        isolatedNotes: [
          { noteId: "scope-a" },
          { noteId: "outside-a" }
        ]
      },
      reviewItems: {
        summary: {
          topicCandidateCount: 9,
          relationCandidateCount: 9,
          bridgeCandidateCount: 9,
          isolatedNoteCount: 9,
          artifactCount: 36
        }
      }
    },
    nodes: [{ id: "scope-a" }, { id: "scope-b" }],
    edges: []
  }, graphThinkingModelTestDeps());

  assert.equal(counts.topicCount, 1);
  assert.equal(counts.bridgeCount, 2);
  assert.equal(counts.relationCount, 1);
  assert.equal(counts.isolatedCount, 1);
  assert.equal(counts.totalCandidates, 5);
});

test("graph thinking relation tasks only expose savable candidates with normalized endpoints", () => {
  const items = moduleBuildGraphThinkingItemsForGraph({
    nodes: [{ id: "source", title: "Source" }, { id: "target", title: "Target" }],
    edges: [],
    aiAnalysis: {
      analysis: {
        relationCandidates: [
          { sourceNoteId: "source", targetNoteId: "target", relationType: "no_relation", rationale: "skip" },
          { sourceNoteId: "source", targetNoteId: "target", relationType: "bridges", componentBridge: true, rationale: "skip bridge" },
          { fromNoteId: "source", toNoteId: "target", relationType: "supports", rationale: "usable" }
        ]
      }
    }
  }, graphThinkingModelTestDeps());

  assert.equal(items.length, 1);
  assert.equal(items[0].title, "Source -> Target");
  assert.match(items[0].actionAttrs, /data-open-note="source"/);
  assert.deepEqual(items[0].highlightNodeIds, ["source", "target"]);
});

test("graph thinking relation tasks use scoped nodes for filtering but lookup map for outside titles", () => {
  const items = moduleBuildGraphThinkingItemsForGraph({
    nodes: [{ id: "scope-a", title: "当前范围笔记" }],
    edges: [],
    aiAnalysis: {
      analysis: {
        relationCandidates: [
          { fromNoteId: "scope-a", toNoteId: "outside-a", relationType: "same_topic", rationale: "跨目录但与当前笔记相关" },
          { fromNoteId: "outside-b", toNoteId: "outside-c", relationType: "same_topic", rationale: "完全不在当前范围" }
        ],
        isolatedNotes: []
      }
    },
    nodeLookupMap: new Map([
      ["scope-a", { id: "scope-a", title: "当前范围笔记" }],
      ["outside-a", { id: "outside-a", title: "目录外目标" }],
      ["outside-b", { id: "outside-b", title: "外部 B" }],
      ["outside-c", { id: "outside-c", title: "外部 C" }]
    ])
  }, graphThinkingModelTestDeps());

  assert.equal(items.length, 1);
  assert.equal(items[0].title, "当前范围笔记 -> 目录外目标");
});

test("directory graph keeps all nodes visible and marks true zero-degree notes as isolated", () => {
  const panelStateBuilderSource = readGraphPanelStateBuilder();
  const runtimeStateSource = readGraphVisualMapRuntimeState();
  const selectionStateSource = readGraphVisualMapSelectionState();
  const html = readPrototypeHtml();
  const nodes = [{ id: "n1" }, { id: "n2" }, { id: "n3", title: "Isolated" }];
  const isolatedNotes = graphComputedIsolatedNotesForGraph(
    nodes,
    [{ fromNoteId: "n1", toNoteId: "n2", status: "accepted" }],
    [{ noteId: "n3", thesis: "Needs one relation" }],
    { relationStatusCountsAsNetworkEdge: (status) => status === "accepted" }
  );
  const markedNodes = graphMarkIsolatedNodesForGraph(nodes, isolatedNotes, {
    selectionKey: (item) => `isolated:${item.noteId}`,
    decisionMeta: () => ({ tone: "bridge" })
  });

  assert.deepEqual(isolatedNotes.map((item) => ({ noteId: item.noteId, title: item.title, thesis: item.thesis })), [
    { noteId: "n3", title: "Isolated", thesis: "Needs one relation" }
  ]);
  assert.equal(markedNodes.find((node) => node.id === "n3")?.graphVisualState, "isolated");
  assert.equal(markedNodes.find((node) => node.id === "n3")?.isolatedKey, "isolated:n3");
  assert.equal(markedNodes.find((node) => node.id === "n1")?.graphVisualState, undefined);
  assert.match(panelStateBuilderSource, /let visibleNodes = !showingFocusedNote\s*\?\s*scopedAllNodes/);
  assert.match(panelStateBuilderSource, /visibleNodes = !showingFocusedNote \? graphMarkIsolatedNodes\(visibleNodes, isolatedNotes\) : visibleNodes;/);
  assert.match(runtimeStateSource, /buildGraphVisualMapSelectionState\(/);
  assert.match(selectionStateSource, /const contextualSelectionEdges = Array\.isArray\(selectionEdges\)/);
  assert.match(selectionStateSource, /const contextualNodeMap = selectionNodeMap instanceof Map \? new Map\(\[\.\.\.layoutNodeMap, \.\.\.selectionNodeMap\]\) : layoutNodeMap;/);
  assert.match(html, /\.graph-map-node\.is-graph-isolated \.graph-map-node-core \{[\s\S]*stroke: #f59e0b;/);
  assert.match(html, /\.graph-local-connect \{[\s\S]*border-color: #fed7aa;/);
});

test("graph isolated notes are organized into a continuous handling queue", () => {
  const panelStateBuilderSource = readGraphPanelStateBuilder();
  const isolatedWorkflowShellSource = readGraphIsolatedWorkflowShell();
  const html = readPrototypeHtml();
  const queueItems = graphIsolatedQueueItemsForGraph({
    isolatedNotes: [
      { noteId: "low", title: "Low priority" },
      { noteId: "current", title: "Current item" },
      { noteId: "high", title: "High priority" }
    ],
    currentNoteId: "current",
    limit: 2,
    aiRelationCandidatesForNote: (noteId) => noteId === "high" ? [{ counterpartTitle: "AI target" }] : [],
    localRelationCandidatesForNote: (noteId) => noteId === "current" ? [{ targetTitle: "Local target" }] : [],
    selectionKey: (item) => `isolated:${item.noteId}`
  });

  assert.deepEqual(queueItems.map((item) => item.noteId), ["high", "current"]);
  assert.equal(queueItems[0].aiCount, 1);
  assert.equal(queueItems[1].localCount, 1);
  assert.equal(graphNextIsolatedQueueItem(queueItems, "high")?.noteId, "current");
  assert.match(isolatedWorkflowShellSource, /const total = queueItems\.length;/);
  assert.doesNotMatch(isolatedWorkflowShellSource, /const total = Array\.isArray\(isolatedNotes\) \? isolatedNotes\.length : queueItems\.length;/);
  assert.match(isolatedWorkflowShellSource, /data-graph-select-isolated="\$\{escapeHtml\(nextItem\.isolatedKey\)\}"/);
  assert.match(isolatedWorkflowShellSource, /data-graph-open-workbench-entry="organize"/);
  assert.match(fs.readFileSync(path.join(repoRoot, "apps/web/src/graph-panel-renderer.js"), "utf8"), /const isolatedQueueStripMarkup = "";/);
  assert.match(isolatedWorkflowShellSource, /const isolatedQueueMarkup = renderQueue\(\{ isolatedNotes, nodeMap, edges, currentNoteId: noteId, compact: true, limit: 6 \}\);/);
  assert.match(panelStateBuilderSource, /const graphRelationTargetNodeMap = graphPotentialRelationNodeMap\(\);/);
  assert.match(panelStateBuilderSource, /nodeMap: graphRelationTargetNodeMap/);
  assert.match(panelStateBuilderSource, /const isolatedQueueItems = !showingFocusedNote[\s\S]*graphIsolatedQueueItems\(\{/);

  assert.doesNotMatch(fs.readFileSync(path.join(repoRoot, "apps/web/src/graph-panel-renderer.js"), "utf8"), /renderGraphIsolatedQueueStrip\(\{/);
  assert.match(html, /\.graph-isolated-queue \{[\s\S]*display: grid;[\s\S]*border: 1px solid #dbe7ef;/);
  assert.match(html, /\.graph-isolated-queue-item \{[\s\S]*grid-template-columns: minmax\(0, 1fr\) minmax\(76px, auto\);[\s\S]*min-height: 58px;/);
  assert.match(html, /\.graph-isolated-queue-item\.is-current \{[\s\S]*box-shadow: inset 4px 0 0 rgba\(217, 119, 6, 0\.65\);/);
  assert.match(html, /\.graph-isolated-queue-main:hover,[\s\S]*\.graph-isolated-queue-main:focus-visible \{/);
});

test("graph isolated workspace offers non-AI relation candidates from tags and titles", () => {
  const source = readGraphResidualViews();
  const appShellSource = readPrototypeApp();
  const joinWorkspaceSource = readGraphIsolatedRelationWorkspace();
  const relationControllerSource = readGraphIsolatedRelationController();
  const isolatedWorkflowShellSource = readGraphIsolatedWorkflowShell();
  const graphCanvasEventRouterSource = readGraphCanvasEventRouter();
  const isolatedSelectionStart = source.indexOf('function renderGraphIsolatedSelectionPanel({ selection = null, isolatedNotes = [], nodeMap = new Map(), edges = [] } = {}) {');
  const isolatedSelectionEnd = source.indexOf('function renderGraphBridgeSelectionPanel(', isolatedSelectionStart);
  const isolatedThinkingItems = moduleBuildGraphThinkingItemsForGraph({
    nodes: [{ id: "isolated-a", title: "孤立笔记" }],
    isolatedNotes: [{ noteId: "isolated-a" }],
    aiAnalysis: { analysis: { isolatedNotes: [{ noteId: "isolated-a", title: "孤立笔记" }] } }
  }, graphThinkingModelTestDeps());
  assert.ok(isolatedSelectionStart >= 0 && isolatedSelectionEnd > isolatedSelectionStart, "expected renderGraphIsolatedSelectionPanel() to exist");

  assert.match(source, /function graphLocalRelationCandidatesForNote\(noteId = "", \{ nodeMap = new Map\(\), edges = \[\], limit = 5 \} = \{\}\) \{/);
  assert.match(source, /return computeGraphLocalRelationCandidatesForNote\(/);
  assert.match(source, /relationStatusCountsAsNetworkEdge: graphRelationStatusCountsAsNetworkEdge/);
  assert.match(source, /function graphManualRelationTargetsForNote\(noteId = "", \{ nodeMap = new Map\(\), edges = \[\], limit = 80 \} = \{\}\) \{/);
  assert.match(joinWorkspaceSource, /manualTargetsForNote\(cleanNoteId, \{ nodeMap, edges, limit: 500 \}\)/);
  assert.match(joinWorkspaceSource, /data-graph-manual-target-search/);
  assert.match(joinWorkspaceSource, /data-graph-pick-manual-target/);
  assert.match(joinWorkspaceSource, /data-graph-manual-target-id/);
  assert.doesNotMatch(joinWorkspaceSource, /renderPreviewPanel\(cleanNoteId, \{ nodeMap, preferredTargetNoteId: previewTargetNoteId \}\)/);
  assert.doesNotMatch(joinWorkspaceSource, /graph-isolated-note-preview-stack/);
  assert.match(source, /data-graph-relation-candidate-apply/);
  assert.match(graphCanvasEventRouterSource, /const graphRelationCandidateButton = event\.target\.closest\("\[data-graph-relation-candidate-apply\]"\);/);
  assert.match(graphCanvasEventRouterSource, /await saveGraphCandidateRelation\(graphRelationCandidateButton\);/);
  assert.doesNotMatch(joinWorkspaceSource, /renderGraphRelationCandidateCards\(localCandidates/);
  assert.match(joinWorkspaceSource, /data-graph-ai-candidate-list/);
  assert.match(joinWorkspaceSource, /data-graph-manual-relation-type/);
  assert.doesNotMatch(joinWorkspaceSource, /data-graph-isolated-tab="ai"/);
  assert.doesNotMatch(joinWorkspaceSource, /data-graph-isolated-tab="manual"/);
  assert.doesNotMatch(joinWorkspaceSource, /role="tab" aria-selected="\$\{activeMode === "ai"\}"/);
  assert.match(source, /relationDraft: graphState\.isolatedRelationDraftByNoteId\?\.\[String\(noteId \|\| ""\)\.trim\(\)\] \|\| \{\}/);
  assert.match(joinWorkspaceSource, /graphIsolatedJoinNetworkFormModel\(/);
  assert.match(joinWorkspaceSource, /data-graph-target-panel="manual"/);
  assert.match(source, /function activateGraphIsolatedWorkflowTab\(tabButton = null, \{ focus = false \} = \{\}\) \{/);
  assert.match(source, /return graphIsolatedRelationController\.activateWorkflowTab\(tabButton, \{ focus \}\);/);
  assert.match(source, /setWorkflowActiveTab: setGraphIsolatedWorkflowActiveTab/);
  assert.match(relationControllerSource, /setWorkflowActiveTab\(noteId, tabKey\)/);
  assert.match(source, /function moveGraphIsolatedWorkflowTab\(currentButton = null, direction = 1\) \{/);
  assert.match(source, /return graphIsolatedRelationController\.moveWorkflowTab\(currentButton, direction\);/);
  assert.match(appShellSource, /isolatedWorkflowTabsByNoteId: \{\},/);
  assert.match(isolatedWorkflowShellSource, /data-graph-select-isolated="\$\{escapeHtml\(nextItem\.isolatedKey\)\}" data-graph-isolated-note="\$\{escapeHtml\(nextItem\.noteId\)\}"/);
  assert.match(isolatedThinkingItems[0]?.actionAttrs || "", /data-graph-select-isolated="isolated-a" data-graph-isolated-note="isolated-a"/);
  assert.match(graphCanvasEventRouterSource, /const isolatedWorkflowTab = event\.target\.closest\("\[data-graph-isolated-tab\]"\);/);
  assert.match(graphCanvasEventRouterSource, /if \(event\.key === "ArrowRight" \|\| event\.key === "ArrowDown"\) \{/);
  assert.match(graphCanvasEventRouterSource, /const graphManualTargetButton = event\.target\.closest\("\[data-graph-pick-manual-target\]"\);/);
  assert.match(graphCanvasEventRouterSource, /await saveGraphIsolatedRelationForm\(graphIsolatedRelationSaveButton\);/);
  assert.match(isolatedWorkflowShellSource, /title: "已保存的关系"/);
  assert.doesNotMatch(isolatedWorkflowShellSource, /孤立笔记接入网络/);
});

test("graph manual relation targets search all known permanent notes but excludes non-permanent and connected notes", () => {
  const targets = moduleGraphManualRelationTargetsForNote(
    "source",
    {
      nodeMap: new Map([
        ["source", { id: "source", title: "Source", noteType: "permanent" }],
        ["outside", { id: "outside", title: "Outside Hub", noteType: "permanent" }],
        ["original", { id: "original", title: "Original Note", noteType: "original" }],
        ["literature", { id: "literature", title: "Literature Note", noteType: "literature" }],
        ["connected", { id: "connected", title: "Already Connected", noteType: "permanent" }]
      ]),
      edges: [{ fromNoteId: "source", toNoteId: "connected", status: "confirmed" }]
    },
    {
      relationStatusCountsAsNetworkEdge: (value = "") => {
        const status = String(value || "confirmed").trim().toLowerCase();
        return status === "suggested" || status === "draft" || status === "confirmed";
      }
    }
  );

  assert.deepEqual(targets.map((item) => item.id).sort(), ["original", "outside"]);
});

test("graph AI relation candidates hide rejected and no-relation candidates before isolated dropdowns", () => {
  const analysis = {
    relationCandidates: [
      { sourceNoteId: "current", targetNoteId: "keep", relationType: "same_topic", aiDecision: "accept", aiRelationType: "same_topic", aiRationale: "Clear reason." },
      { sourceNoteId: "current", targetNoteId: "reject", relationType: "same_topic", aiDecision: "reject", aiRelationType: "same_topic", aiRationale: "Do not connect." },
      { sourceNoteId: "current", targetNoteId: "none", relationType: "associated_with", aiDecision: "uncertain", aiRelationType: "no_relation", aiRationale: "No relation." }
    ],
    bridgeCandidates: []
  };

  const candidates = moduleGraphAiRelationCandidatesForNote("current", {
    analysis,
    nodeMap: new Map([
      ["current", { id: "current", title: "Current" }],
      ["keep", { id: "keep", title: "Keep" }],
      ["reject", { id: "reject", title: "Reject" }],
      ["none", { id: "none", title: "None" }]
    ]),
    edges: [],
    limit: 5
  });

  assert.deepEqual(candidates.map((candidate) => candidate.targetNoteId), ["keep"]);
  assert.deepEqual([...moduleGraphBlockedAiRelationPairKeysForNote("current", analysis)].sort(), ["current::none", "current::reject"]);
});

test("graph relation save rejects placeholder rationales", () => {
  const { graphRelationRationaleIsActionable } = new Function(`
    const graphRelationRationaleIsActionable = ${moduleGraphRelationRationaleIsActionable.toString()};
    return { graphRelationRationaleIsActionable };
  `)();

  assert.equal(graphRelationRationaleIsActionable("我确认“甲”和“乙”应该关联，因为：________。"), false);
  assert.equal(graphRelationRationaleIsActionable("我确认“甲”和“乙”可以建立相关关系，因为它们之间存在需要一起确认的论证或主题联系。"), false);
  assert.equal(graphRelationRationaleIsActionable("因为："), false);
  assert.equal(graphRelationRationaleIsActionable("TODO: 补充关系说明"), false);
  assert.equal(graphRelationRationaleIsActionable("甲能作为乙的边界条件，因为它说明了适用范围。"), true);
});

test("graph relation candidates stay minimal and keep one clear action", () => {
  const source = readGraphResidualViews();
  const html = readPrototypeHtml();
  const connectStart = source.indexOf('function renderGraphAiConnectCandidates(noteId = "", { nodeMap = new Map(), edges = [], hideEmpty = false } = {}) {');
  const connectEnd = source.indexOf('function graphWorkspaceRenderDeps()', connectStart);
  assert.ok(connectStart >= 0 && connectEnd > connectStart, "expected renderGraphAiConnectCandidates() to exist");
  const connectSource = source.slice(connectStart, connectEnd);

  assert.match(source, /function renderGraphCandidateReviewRows\(candidate = \{\}, \{ aiCandidate = true \} = \{\}\) \{/);
  assert.match(source, /function graphCandidateEvidenceText\(candidate = \{\}\) \{/);
  assert.match(source, /function graphCandidateUndirectedPairKey\(candidate = \{\}\) \{/);
  assert.match(source, /function graphBlockedAiRelationPairKeysForNote\(noteId = ""\) \{/);
  assert.match(source, /function graphMergeRelationCandidatesForDisplay\(aiCandidates = \[\], localCandidates = \[\], \{ limit = 6, blockedPairKeys = new Set\(\) \} = \{\}\) \{/);
  assert.match(source, /return computeGraphCandidateUndirectedPairKey\(candidate\);/);
  assert.match(source, /return computeGraphBlockedAiRelationPairKeysForNote\(noteId, graphAiAnalysisPayload\(\)\);/);
  assert.match(source, /return computeGraphMergeRelationCandidatesForDisplay\(aiCandidates, localCandidates, \{ limit, blockedPairKeys \}\);/);
  assert.match(connectSource, /const blockedPairKeys = graphBlockedAiRelationPairKeysForNote\(noteId\);/);
  assert.match(connectSource, /const candidates = graphMergeRelationCandidatesForDisplay\(aiCandidates, localCandidates, \{ limit: 6, blockedPairKeys \}\);/);
  assert.match(connectSource, />关联<\/button>/);
  assert.match(connectSource, /graph-ai-connect-empty-action/);
  assert.match(connectSource, /data-graph-ai-connect-note="\$\{escapeHtml\(noteId\)\}"/);
  assert.doesNotMatch(connectSource, />选择<\/button>/);
  assert.doesNotMatch(connectSource, /选择这条笔记/);
  assert.doesNotMatch(connectSource, /预览目标/);
  assert.doesNotMatch(connectSource, /data-graph-preview-candidate=/);
  assert.doesNotMatch(connectSource, /graph-candidate-details/);
  assert.doesNotMatch(connectSource, /renderGraphCandidateReviewRows\(candidate/);
  assert.doesNotMatch(connectSource, /data-graph-select-node=/);
  assert.doesNotMatch(connectSource, /用这条建立关系/);
  assert.match(source, /<span>为什么推荐<\/span>/);
  assert.match(source, /<span>建议关系<\/span>/);
  assert.match(source, /<span>保存前想一想<\/span>/);
  assert.match(source, /graphCandidateRelationReviewQuestion\(candidate\)/);
  assert.match(html, /\.graph-candidate-review \{[\s\S]*display: grid;[\s\S]*gap: 6px;/);
});

test("graph AI candidate card saves reversed candidates from the current note", () => {
  const source = readGraphResidualViews();
  const { renderGraphAiConnectCandidates } = new Function(`
    const graphState = { aiAnalysisLoading: false };
    function escapeHtml(value = "") {
      return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
    }
    function graphAiRelationCandidatesForNote() {
      return [{
        sourceNoteId: "other",
        targetNoteId: "current",
        actionSourceNoteId: "other",
        actionTargetNoteId: "current",
        counterpartNoteId: "other",
        counterpartTitle: "Other Note",
        targetTitle: "Current Note",
        relationType: "associated_with",
        relationLabel: "相关",
        confidence: 0.72,
        rationaleDraft: "Current can connect to Other because their claims need to be reviewed together.",
        insightQuestionDraft: "How do these two notes relate?"
      }];
    }
    function graphLocalRelationCandidatesForNote() { return []; }
    function graphBlockedAiRelationPairKeysForNote() { return new Set(); }
    function graphMergeRelationCandidatesForDisplay(aiCandidates) {
      return aiCandidates.map((candidate) => ({ ...candidate, candidateSource: "ai" }));
    }
    function graphAiAnalysisPayload() { return { relationCandidates: [{}] }; }
    function graphPotentialRelationNeedsConfirmation() { return false; }
    function graphAiConfidenceLabel() { return "72%"; }
    function graphCandidateEvidenceText(candidate = {}) { return candidate.rationaleDraft || ""; }
    function renderGraphCandidateReviewRows() { return ""; }
    ${extractFunctionSource(source, "renderGraphAiConnectCandidates")}
    return { renderGraphAiConnectCandidates };
  `)();

  const html = renderGraphAiConnectCandidates("current", {
    nodeMap: new Map([
      ["current", { id: "current", title: "Current Note" }],
      ["other", { id: "other", title: "Other Note" }]
    ]),
    edges: []
  });

  assert.match(html, /data-graph-ai-candidate-apply data-open-note="current" data-graph-target-note="other"/);
  assert.doesNotMatch(html, /data-graph-ai-candidate-apply data-open-note="other" data-graph-target-note="current"/);
});

test("graph relation candidate merge deduplicates reversed AI and local pairs", () => {
  const merged = moduleGraphMergeRelationCandidatesForDisplay(
    [{ sourceNoteId: "note-a", targetNoteId: "note-b", targetTitle: "B from AI" }],
    [
      { sourceNoteId: "note-b", targetNoteId: "note-a", targetTitle: "A from local" },
      { sourceNoteId: "note-a", targetNoteId: "note-c", targetTitle: "C from local" }
    ],
    { limit: 6 }
  );

  assert.equal(merged.length, 2);
  assert.deepEqual(merged.map((candidate) => candidate.candidateSource), ["ai", "local"]);
  assert.deepEqual(merged.map((candidate) => candidate.targetNoteId), ["note-b", "note-c"]);

  const rejectedPair = moduleGraphMergeRelationCandidatesForDisplay(
    [{ sourceNoteId: "note-a", targetNoteId: "note-b", aiDecision: "reject", aiRelationType: "no_relation" }],
    [{ sourceNoteId: "note-b", targetNoteId: "note-a", relationType: "same_topic", targetTitle: "A from local" }],
    { limit: 6 }
  );
  assert.deepEqual(rejectedPair, []);

  const blockedByAiAnalysis = moduleGraphMergeRelationCandidatesForDisplay(
    [],
    [{ sourceNoteId: "note-b", targetNoteId: "note-a", relationType: "same_topic", targetTitle: "A from local" }],
    { limit: 6, blockedPairKeys: new Set(["note-a::note-b"]) }
  );
  assert.deepEqual(blockedByAiAnalysis, []);
});

test("isolated note panel gives a continuous next step after confirming a relation", () => {
  const source = readGraphResidualViews();
  const html = readPrototypeHtml();
  const nextStepSource = extractFunctionSource(source, "renderGraphIsolatedNextStepActions");
  const nextStepModuleSource = fs.readFileSync(path.join(repoRoot, "apps/web/src/graph-isolated-next-step.js"), "utf8");
  const isolatedWorkflowShellSource = readGraphIsolatedWorkflowShell();

  assert.match(source, /function renderGraphIsolatedNextStepActions\(noteId = "", \{ isolatedNotes = \[\], nodeMap = new Map\(\), edges = \[\] \} = \{\}\) \{/);
  assert.match(nextStepSource, /return renderGraphIsolatedNextStepActionsHtml\(noteId, \{ isolatedNotes, nodeMap, edges \}, \{/);
  assert.match(nextStepSource, /themeCandidateNoteIdsForNode: graphThemeCandidateNoteIdsForNode/);
  assert.match(nextStepModuleSource, /if \(!directEdges\.length\) return "";/);
  assert.match(nextStepModuleSource, /data-graph-select-isolated/);
  assert.match(nextStepModuleSource, /data-graph-create-theme-index/);
  assert.doesNotMatch(nextStepSource, /data-graph-select-node/);
  assert.match(nextStepModuleSource, /const canCreateTheme = directEdges\.length > 0 && themeNoteIds\.length >= 3;/);
  assert.match(nextStepModuleSource, /const themeNoteIds = themeCandidateNoteIdsForNode\(cleanNoteId, directEdges, \[\]\);/);
  assert.doesNotMatch(nextStepSource, /graphAiRelationCandidatesForNote/);
  assert.match(isolatedWorkflowShellSource, /renderNextStepActions\(noteId, \{ isolatedNotes, nodeMap, edges \}\)/);
  assert.match(html, /\.graph-isolated-next-step \{[\s\S]*border: 1px solid #cfe4d9;/);
});

test("graph node selection keeps the node popup focused on the next action", () => {
  const source = readGraphResidualViews();
  const selectionPanelSource = readGraphSelectionPanel();
  const nodeSelectionPanelSource = readGraphNodeSelectionPanel();
  const html = readPrototypeHtml();

  assert.match(source, /function graphNodeInsightMeta\(node = \{\}, directEdges = \[\], \{ nodeMap = new Map\(\), edges = \[\] \} = \{\}\) \{/);
  assert.match(source, /function renderGraphNodeInsightPanel\(insight = \{\}\) \{/);
  assert.match(source, /function renderGraphSelectionTask\(task = null\) \{/);
  assert.match(selectionPanelSource, /aria-label="[^"]+"/);
  assert.match(nodeSelectionPanelSource, /task: null/);
  assert.doesNotMatch(nodeSelectionPanelSource, /data-open-note="\$\{escapeHtml\(normalized\.nodeId\)\}"/);
  assert.doesNotMatch(nodeSelectionPanelSource, /把它连到一条相关笔记/);
  assert.doesNotMatch(nodeSelectionPanelSource, /data-graph-open-relation-form/);
  assert.doesNotMatch(nodeSelectionPanelSource, /const insight = graphNodeInsightMeta\(node, directEdges, \{ nodeMap, edges \}\);/);
  assert.doesNotMatch(nodeSelectionPanelSource, /renderGraphNodeInsightPanel\(insight\)/);
  assert.match(nodeSelectionPanelSource, /\$\{relationDetails\}[\s\S]*\$\{candidatePanel\}/);
  assert.match(html, /\.graph-ai-connect-card \{[\s\S]*grid-template-columns: minmax\(0, 1fr\) auto;/);
  assert.match(html, /\.graph-selection-details summary \{[\s\S]*min-height: 44px;[\s\S]*cursor: pointer;/);
});

test("graph relation workspace combines AI candidates, manual relation management, and theme index creation", () => {
  const source = readGraphResidualViews();
  const appShellSource = readPrototypeApp();
  const graphRouteSource = readGraphRouteRuntime();
  const nodeSelectionPanelSource = readGraphNodeSelectionPanel();
  const joinWorkspaceSource = readGraphIsolatedRelationWorkspace();
  const systemMessageSource = fs.readFileSync(path.join(repoRoot, "apps/web/src/prototype-system-messages.js"), "utf8");
  const systemMessageWorkflowSource = fs.readFileSync(path.join(repoRoot, "apps/web/src/prototype-system-message-workflow.js"), "utf8");
  const workspaceSource = fs.readFileSync(path.join(repoRoot, "apps/web/src/prototype-graph-workspace.js"), "utf8");
  const html = readPrototypeHtml();

  assert.match(source, /function renderGraphRelationWorkspaceForNote\(noteId = "", \{ nodeMap = new Map\(\), edges = \[\], title = "关联整理" \} = \{\}\) \{/);
  assert.match(workspaceSource, /graphThemeCandidateNoteIdsForNode\(cleanNoteId, directEdges, \[\]\)/);
  assert.match(joinWorkspaceSource, /aiCandidatesForNote\(cleanNoteId, \{ nodeMap, edges, limit: 3 \}\)/);
  assert.doesNotMatch(nodeSelectionPanelSource, /graphThemeCandidateNoteIdsForNode\(normalized\.nodeId, directEdges, \[\]\)/);
  assert.match(workspaceSource, /data-graph-theme-note-ids="\$\{escapeHtml\(themeNoteIds\.join\(","\)\)\}"/);
  assert.match(workspaceSource, /data-graph-select-edge="\$\{escapeHtml\(edgeKey\)\}"/);
  assert.match(workspaceSource, /data-graph-create-theme-index/);
  assert.match(workspaceSource, /function renderGraphThemeIndexWorkspace\(noteIds = \[\], \{ title = "可写主题推荐", relationCount = 0, tone = "", deps = \{\} \} = \{\}\) \{/);
  assert.match(graphRouteSource, /async function createGraphThemeIndexFromNoteIds\(noteIds = \[\], \{ title = "", source = "graph-theme-index" \} = \{\}\) \{/);
  assert.match(graphRouteSource, /buildThemeIndexCreatePayload\(\{/);
  assert.match(graphRouteSource, /noteById: \(id\) => writingNoteById\(id\) \|\| writingKnownNoteById\(id\)/);
  assert.match(graphRouteSource, /const writingEligibleIds = eligibleIds\.filter\(\(id\) => isWritingEligibleNote\(writingKnownNoteById\(id\)\)\);/);
  assert.match(graphRouteSource, /if \(writingEligibleIds\.length >= 2\) \{[\s\S]*continueWritingEntry\(writingEligibleIds,/);
  assert.match(graphRouteSource, /workflowRoute: \{[\s\S]*focus: "writing"[\s\S]*indexCardId: card\.id[\s\S]*basketNoteIds: eligibleIds\.join\(","\)/);
  assert.match(readGraphCanvasEventRouter(), /const graphThemeIndexButton = event\.target\.closest\("\[data-graph-create-theme-index\]"\);/);
  assert.match(appShellSource, /createThemeIndexFromNoteIds: createGraphThemeIndexFromNoteIds/);
  assert.match(systemMessageWorkflowSource, /focus === "writing"/);
  assert.match(systemMessageWorkflowSource, /await selectWritingThemeIndex\(indexCardId\)/);
  assert.match(systemMessageSource, /basketNoteIds: String\(item\.workflowRoute\.basketNoteIds/);

  assert.match(html, /\.graph-ai-connect-actions \{[\s\S]*display: flex;[\s\S]*justify-content: flex-end;/);
  assert.match(html, /\.graph-relation-workspace \{[\s\S]*display: grid;[\s\S]*gap: 10px;/);
  assert.match(html, /\.graph-theme-index-workspace \{[\s\S]*grid-template-columns: minmax\(0, 1fr\) auto;/);
});

test("graph keyboard activation handles workflow actions before generic note opening", () => {
  const source = readGraphCanvasEventRouter();
  const start = source.indexOf('graphCanvas?.addEventListener("keydown", async (event) => {');
  const end = source.indexOf('graphCanvas?.addEventListener("change"', start);
  assert.ok(start >= 0 && end > start, "expected graph keyboard handler");
  const handler = source.slice(start, end);

  assert.match(handler, /const graphAiCandidateButton = event\.target\.closest\("\[data-graph-ai-candidate-apply\]"\);/);
  assert.match(handler, /await saveGraphAiCandidateRelation\(graphAiCandidateButton\);/);
  assert.match(handler, /const graphAiRefineConfirmButton = event\.target\.closest\("\[data-graph-ai-refine-confirm\]"\);/);
  assert.match(handler, /await confirmGraphPotentialRelationRefine\(graphAiRefineConfirmButton\);/);
  assert.match(handler, /const graphAiRefineRetryButton = event\.target\.closest\("\[data-graph-ai-refine-retry\]"\);/);
  assert.match(handler, /await retryGraphPotentialRelationRefine\(graphAiRefineRetryButton\);/);
  assert.match(handler, /const graphThemeIndexButton = event\.target\.closest\("\[data-graph-create-theme-index\]"\);/);
  assert.match(handler, /await createGraphThemeIndexFromButton\(graphThemeIndexButton\);/);
  assert.match(handler, /const graphRelationFormButton = event\.target\.closest\("\[data-graph-open-relation-form\]"\);/);
  assert.match(handler, /openGraphRelationComposerOnly\(graphRelationFormButton\);/);
  assert.doesNotMatch(handler, /openGraphRelationFormInSelection\(graphRelationFormButton\);/);
  assert.match(handler, /const isolatedAction = event\.target\.closest\("\[data-graph-isolated-action\]"\);/);
  assert.match(handler, /const relationAdjustment = event\.target\.closest\("\[data-graph-relation-adjustment\]"\);/);
  assert.match(handler, /focusGraphRelationAdjustmentInPlace\(relationAdjustment\);/);
  assert.doesNotMatch(handler, /openGraphFollowupNote\(noteId, action/);
  assert.ok(
    handler.indexOf("[data-graph-ai-candidate-apply]") < handler.indexOf('const row = event.target.closest("[data-open-note]")'),
    "AI candidate keyboard action should run before generic note opening"
  );
  assert.ok(
    handler.indexOf("[data-graph-ai-refine-confirm]") < handler.indexOf('const row = event.target.closest("[data-open-note]")'),
    "AI refine confirmation keyboard action should run before generic note opening"
  );
  assert.ok(
    handler.indexOf("[data-graph-ai-refine-retry]") < handler.indexOf('const row = event.target.closest("[data-open-note]")'),
    "AI refine retry keyboard action should run before generic note opening"
  );
  assert.ok(
    handler.indexOf("[data-graph-relation-adjustment]") < handler.indexOf('const row = event.target.closest("[data-open-note]")'),
    "relation adjustment keyboard action should run before generic note opening"
  );
});

test("graph click workflow actions consume events before generic note opening", () => {
  const source = readGraphCanvasEventRouter();
  const start = source.indexOf('graphCanvas?.addEventListener("click", async (event) => {');
  const end = source.indexOf('  function handleGraphHoverIntent(event) {', start);
  assert.ok(start >= 0 && end > start, "expected graph click handler");
  const handler = source.slice(start, end);

  assert.match(handler, /const consumeGraphClick = \(\) => \{/);
  assert.match(handler, /event\.preventDefault\(\);/);
  assert.match(handler, /event\.stopImmediatePropagation\(\);/);
  assert.match(handler, /const graphAiCandidateButton = event\.target\.closest\("\[data-graph-ai-candidate-apply\]"\);[\s\S]*consumeGraphClick\(\);[\s\S]*await saveGraphAiCandidateRelation\(graphAiCandidateButton\);/);
  assert.match(handler, /const graphRelationCandidateButton = event\.target\.closest\("\[data-graph-relation-candidate-apply\]"\);[\s\S]*consumeGraphClick\(\);[\s\S]*await saveGraphCandidateRelation\(graphRelationCandidateButton\);/);
  assert.match(handler, /const graphRelationFormButton = event\.target\.closest\("\[data-graph-open-relation-form\]"\);[\s\S]*consumeGraphClick\(\);[\s\S]*openGraphRelationComposerOnly\(graphRelationFormButton\);/);
  assert.doesNotMatch(handler, /openGraphRelationFormInSelection\(graphRelationFormButton\);/);
  assert.match(handler, /const relationAdjustment = event\.target\.closest\("\[data-graph-relation-adjustment\]"\);[\s\S]*consumeGraphClick\(\);[\s\S]*focusGraphRelationAdjustmentInPlace\(relationAdjustment\);/);
  const relationAdjustmentStart = handler.indexOf('const relationAdjustment = event.target.closest("[data-graph-relation-adjustment]");');
  const graphFollowupStart = handler.indexOf('const graphFollowup = event.target.closest("[data-graph-followup-action]");', relationAdjustmentStart);
  assert.ok(relationAdjustmentStart >= 0 && graphFollowupStart > relationAdjustmentStart, "expected relation adjustment branch before followup compatibility branch");
  const relationAdjustmentBranch = handler.slice(relationAdjustmentStart, graphFollowupStart);
  assert.doesNotMatch(relationAdjustmentBranch, /openGraphFollowupNote/);
  assert.ok(
    handler.indexOf("[data-graph-ai-candidate-apply]") < handler.indexOf('const row = event.target.closest("[data-open-note]")'),
    "AI candidate click action should run before generic note opening"
  );
});

test("graph demo startup resets presentation state for a stable first screen", () => {
  const relationFilterCalls = [];
  const graphState = {
    readingLens: "status",
    focusDepth: "3",
    selection: { kind: "node", nodeId: "n1" },
    researchNavigatorHidden: true,
    researchNavigatorTouched: true,
    zoom: "detail",
    expanded: true,
    workbenchPanelOpen: true,
    workbenchPanelTab: "questions",
    thinkingPanelOpen: true,
    thinkingPanelVisible: false,
    thinkingFilter: "theme",
    utilityDrawerOpen: true,
    utilityDrawerVisible: false,
    utilityDrawerPosition: { x: 10, y: 20 },
    sectionOpen: {
      "bridge-gaps": true,
      "weak-relations": true,
      "review-queue": true,
      "ai-analysis": true
    }
  };

  assert.equal(resetGraphDemoPresentationStateForRuntime(graphState, {
    setRelationTypeFilter: (...args) => relationFilterCalls.push(args)
  }), graphState);
  assert.deepEqual(relationFilterCalls, [["all", { persist: false }]]);
  assert.equal(graphState.readingLens, "insight");
  assert.equal(graphState.focusDepth, "1");
  assert.equal(graphState.selection, null);
  assert.equal(Object.prototype.hasOwnProperty.call(graphState, "legendOpen"), false);
  assert.equal(graphState.researchNavigatorHidden, true);
  assert.equal(graphState.researchNavigatorTouched, true);
  assert.equal(graphState.zoom, "detail");
  assert.equal(graphState.expanded, false);
  assert.equal(graphState.workbenchPanelOpen, false);
  assert.equal(graphState.workbenchPanelTab, "clues");
  assert.equal(graphState.thinkingPanelOpen, false);
  assert.equal(graphState.thinkingPanelVisible, true);
  assert.equal(graphState.thinkingFilter, "all");
  assert.equal(graphState.utilityDrawerOpen, false);
  assert.equal(graphState.utilityDrawerVisible, true);
  assert.equal(graphState.utilityDrawerPosition, null);
  assert.deepEqual(graphState.sectionOpen, {
    "bridge-gaps": false,
    "weak-relations": false,
    "review-queue": false,
    "ai-analysis": false
  });
});

test("graph density hint is temporary and does not stay on the map", () => {
  let currentTime = 5000;
  let timeoutCallback = null;
  let timeoutDelay = 0;
  let clearedTimer = null;
  let renderCount = 0;
  const graphState = {
    lastLoadedDirectoryId: "dir-a",
    lastLoadedAt: "loaded-1"
  };
  const deps = {
    graphState,
    now: () => currentTime,
    window: {
      setTimeout: (callback, delay) => {
        timeoutCallback = callback;
        timeoutDelay = delay;
        return 42;
      },
      clearTimeout: (timer) => {
        clearedTimer = timer;
      }
    },
    isGraphModule: () => true,
    renderGraphPanel: () => {
      renderCount += 1;
    }
  };

  assert.equal(GRAPH_DENSITY_HINT_TIMEOUT_MS, 10000);
  assert.equal(shouldShowGraphDensityHintForRuntime({ dense: true, filterActive: false }, deps), true);
  assert.equal(graphState.densityHintVisibleUntil, currentTime + GRAPH_DENSITY_HINT_TIMEOUT_MS);
  assert.equal(graphState.densityHintTimer, 42);
  assert.equal(timeoutDelay, GRAPH_DENSITY_HINT_TIMEOUT_MS);

  currentTime += 2500;
  assert.equal(scheduleGraphDensityHintDismissForRuntime(deps), true);
  assert.equal(clearedTimer, 42);
  assert.equal(timeoutDelay, 7500);

  timeoutCallback();
  assert.equal(graphState.densityHintVisibleUntil, 0);
  assert.equal(graphState.densityHintTimer, 0);
  assert.equal(renderCount, 1);

  graphState.densityHintTimer = 77;
  assert.equal(shouldShowGraphDensityHintForRuntime({ dense: false, filterActive: false }, deps), false);
  assert.equal(graphState.densityHintKey, "");
  assert.equal(clearedTimer, 77);
});

test("graph zoom controls include both stepper directions and preset levels", () => {
  const source = readPrototypeApp();
  const visualMapControllerSource = readGraphVisualMapController();
  const html = readPrototypeHtml();
  const zoomMarkup = renderGraphZoomStepperView({
    zoomKey: "read",
    zoomIndex: 1,
    zoomOptions: {
      fit: { label: "Fit", note: "Fit note", icon: "fit" },
      read: { label: "Read", note: "Read note", icon: "read" }
    }
  }, {
    renderGraphIcon: (name) => `<i>${name}</i>`,
    labels: {
      zoomOut: "缩小图谱",
      zoomIn: "放大图谱",
      zoomLevels: "图谱缩放层级"
    }
  });

  assert.match(zoomMarkup, /data-graph-zoom-step="-1" aria-label="缩小图谱"/);
  assert.match(zoomMarkup, /data-graph-zoom-step="1" aria-label="放大图谱"/);
  assert.match(zoomMarkup, /data-graph-zoom-option="read"/);
  assert.match(renderGraphIconView("hand"), /M6\.2 9\.7V6\.1/);
  assert.match(visualMapControllerSource, /renderGraphVisualMapShellView/);
  assert.doesNotMatch(source, /graph-pan-hint[\s\S]{0,180}<span>拖动<\/span>/);
  assert.match(html, /\.graph-pan-hint \{[\s\S]*width: 36px;[\s\S]*cursor: grab;/);
  assert.equal(moduleGraphZoomStep("read", -1).key, "fit");
  assert.equal(moduleGraphZoomStep("read", 1).key, "detail");
});

test("graph toolbar interactions update zoom, lens, focus depth, and context mode", () => {
  const graphState = {
    zoom: "fit",
    readingLens: "insight",
    focusDepth: "1",
    focusContextMode: "argument"
  };
  const zoomDeps = {
    graphZoomOption: (value = "") => {
      const key = String(value || "fit").trim() || "fit";
      return { key, label: key === "detail" ? "细看" : key === "read" ? "阅读" : "适配" };
    },
    graphZoomStep: (value = "", direction = 0) => {
      const order = ["fit", "read", "detail"];
      const index = Math.max(0, order.indexOf(String(value || "fit")));
      const next = order[Math.max(0, Math.min(order.length - 1, index + Number(direction || 0)))] || "fit";
      return { key: next, label: next === "detail" ? "细看" : next === "read" ? "阅读" : "适配" };
    }
  };

  assert.deepEqual(applyGraphZoomOptionInteraction(graphState, "read", zoomDeps), {
    zoom: "read",
    meta: { key: "read", label: "阅读" },
    changed: true
  });
  assert.equal(graphState.zoom, "read");

  assert.deepEqual(applyGraphZoomStepInteraction(graphState, 1, zoomDeps), {
    zoom: "detail",
    meta: { key: "detail", label: "细看" },
    changed: true
  });
  assert.equal(graphState.zoom, "detail");

  assert.deepEqual(applyGraphZoomStepInteraction(graphState, 1, zoomDeps), {
    zoom: "detail",
    meta: { key: "detail", label: "细看" },
    changed: false
  });

  assert.deepEqual(applyGraphReadingLensInteraction(graphState, "bridge", {
    graphReadingLensMeta: (value = "") => ({ key: String(value || "insight"), label: value === "bridge" ? "缺口" : "下一步" }),
    setGraphRelationTypeFilter: (value) => {
      graphState.filters = { relationType: value };
      return value;
    }
  }), {
    lens: "bridge",
    meta: { key: "bridge", label: "缺口" },
    relationType: "meaningful"
  });
  assert.equal(graphState.readingLens, "bridge");
  assert.equal(graphState.filters.relationType, "meaningful");
  assert.equal(graphState.researchNavigatorHidden, true);
  assert.equal(graphState.researchNavigatorTouched, true);

  assert.deepEqual(applyGraphFocusDepthInteraction(graphState, "all", {
    setGraphFocusDepth: (value) => {
      graphState.focusDepth = value;
    },
    graphFocusDepthMeta: (value) => ({ key: value, label: value === "all" ? "查看整组相关笔记" : "只看直接相关" })
  }), {
    depth: "all",
    meta: { key: "all", label: "查看整组相关笔记" }
  });
  const canvasEventRouterSource = fs.readFileSync(path.join(repoRoot, "apps/web/src/graph-canvas-event-router.js"), "utf8");
  assert.match(canvasEventRouterSource, /graphState\.focusContextCollapsed = true;/);
  assert.match(canvasEventRouterSource, /图谱范围已切换到/);
  const residualViewsSource = fs.readFileSync(path.join(repoRoot, "apps/web/src/graph-residual-views.js"), "utf8");
  assert.match(residualViewsSource, /function openGraphSelection[\s\S]*graphState\.focusContextCollapsed = false;/);

  assert.deepEqual(applyGraphFocusContextModeInteraction(graphState, "writing", {
    setGraphFocusContextMode: (value) => {
      graphState.focusContextMode = value;
    },
    graphFocusContextModeMeta: (value) => ({ key: value, label: value === "writing" ? "写作怎么用" : "观点怎么连" })
  }), {
    mode: "writing",
    meta: { key: "writing", label: "写作怎么用" }
  });

  assert.deepEqual(applyGraphRelationTypeFilterInteraction(graphState, "supports", {
    setGraphRelationTypeFilter: (value) => {
      graphState.filters = { relationType: value };
      return value;
    },
    graphRelationTypeLabel: (value) => value === "supports" ? "支持" : value
  }), {
    relationType: "supports",
    label: "支持"
  });
  assert.equal(graphState.filters.relationType, "supports");

  assert.deepEqual(applyGraphRelationTypeFilterInteraction(graphState, "", {
    setGraphRelationTypeFilter: (value) => {
      graphState.filters = { relationType: value };
      return value;
    }
  }), {
    relationType: "all",
    label: "全部关系"
  });

  const viewModeCalls = [];
  graphState.researchNavigatorHidden = false;
  graphState.researchNavigatorTouched = true;
  assert.deepEqual(applyGraphViewModeInteraction(graphState, "structure", {
    setGraphRelationTypeFilter: (value) => viewModeCalls.push(value),
    graphReadingModeMeta: (value) => ({ key: value, label: value === "structure" ? "主题分布" : "关系图" })
  }), {
    mode: "structure",
    changed: true,
    meta: { key: "structure", label: "主题分布" }
  });
  assert.deepEqual(viewModeCalls, ["index"]);
  assert.equal(graphState.readingLens, "insight");
  assert.equal(graphState.researchNavigatorHidden, true);
  assert.equal(graphState.researchNavigatorTouched, true);

  assert.equal(applyGraphViewModeInteraction(graphState, "unknown", {
    graphReadingModeMeta: (value) => ({ key: value, label: value })
  }).changed, false);

  graphState.zoom = "read";
  assert.deepEqual(applyGraphWheelZoomInteraction(graphState, -1, zoomDeps), {
    zoom: "detail",
    meta: { key: "detail", label: "细看" },
    changed: true
  });
});

test("graph rail entry does not fall through to note explorer during async refresh", () => {
  const prototypeSource = readPrototypeApp();
  const railSource = readAppRailEventBindings();
  const quickActionSource = readQuickActionEventBindings();

  assert.ok(railSource.includes('querySelectorAll?.(".rail-btn[data-module]")?.forEach((btn) => {'));
  assert.ok(railSource.includes('btn.addEventListener("click", async (event) => {'));
  assert.match(railSource, /event\.preventDefault\(\);[\s\S]*event\.stopPropagation\(\);/);
  assert.ok(railSource.includes("const targetModule = btn.dataset.module;"));
  assert.ok(railSource.includes('if (targetModule === "graph") setGraphModuleActivationGuardUntil(now() + 1800);'));
  assert.match(railSource, /if \(targetModule === "graph" && state\.module === "graph"\) \{[\s\S]*await refreshDirectoryGraph\(\);[\s\S]*if \(state\.module === "graph"\) setStatus\(/);
  assert.match(railSource, /if \(state\.module !== "graph" && now\(\) < getGraphModuleActivationGuardUntil\(\)\) \{[\s\S]*activateModule\("graph"\);[\s\S]*\}/);
  assert.match(prototypeSource, /if \(normalizedModule === "graph"\) \{[\s\S]*prepareGraphEntryPresentationState\(\);[\s\S]*\}/);
  assert.ok(quickActionSource.includes('querySelectorAll?.("[data-action^=\'quick-\']")?.forEach((btn) => {'));
  assert.match(quickActionSource, /btn\.addEventListener\("click", async \(event\) => \{[\s\S]*event\.preventDefault\(\);[\s\S]*event\.stopPropagation\(\);/);
  assert.match(quickActionSource, /if \(action === "quick-original" && now\(\) < getGraphModuleActivationGuardUntil\(\)\) \{[\s\S]*setStatus\([\s\S]*return;/);
});
test("note box and graph tree sync all notes under the selected root", async () => {
  const source = readPrototypeApp();
  const settingsEventSource = readSettingsEventBindings();
  const calls = [];

  assert.match(source, /async function syncNotesForDirectoryTree\(rootDirectoryId\) \{/);
  assert.match(source, /const directoryIds = descendantDirectoryIds\(rootId\)\.filter\(\(id\) => folderById\(state, id\)\);[\s\S]*for \(const directoryId of directoryIds\) \{[\s\S]*await syncNotesForDirectory\(directoryId\);/);
  assert.match(settingsEventSource, /await refreshVaultSettings\(\);/);
  assert.match(settingsEventSource, /await syncDirectoriesFromApi\(\);[\s\S]*await syncNotesForDirectory\(state\.selectedFolderId\);/);
  assert.match(readQuickActionEventBindings(), /state\.module = "explorer";[\s\S]*state\.selectedFileId = null;[\s\S]*await syncNotesForDirectoryTree\(state\.browserRootId\);[\s\S]*syncRailSelectionState\(\);/);
  await refreshDirectoryGraphForRuntime({
    graphScopeDirectoryId: () => "selected-dir",
    graphOriginalScopeDirectoryId: "original-root",
    syncNotesForDirectoryTree: async (directoryId) => calls.push(["sync", directoryId]),
    fetchDirectoryGraph: async () => ({ nodes: [], edges: [] }),
    fetchGraphConflicts: async () => null,
    fetchRelationReviewQueue: async () => ({ items: [], total: 0 })
  });
  assert.deepEqual(calls, [["sync", "original-root"]]);
});

test("graph module sidebar is labeled as graph scope instead of permanent-note browser", () => {
  const sidebarSource = readAppShellSidebarController();

  assert.match(sidebarSource, /sidebarTitle\) sidebarTitle\.textContent = "图谱笔记范围";/);
  assert.match(sidebarSource, /这里不是永久笔记页；点目录或笔记是在切换图谱观察范围。/);
  assert.match(sidebarSource, /待关联笔记会使用和永久笔记盒一致的提示样式；点进来可以关联一条笔记。/);
  assert.doesNotMatch(sidebarSource, /永久笔记浏览/);
});


test("graph load failure renders a quiet empty state instead of a red error panel", () => {
  const source = readGraphResidualViews();
  const appShellSource = readPrototypeApp();
  const panelStateBuilderSource = readGraphPanelStateBuilder();
  const panelRendererSource = readGraphPanelRenderer();
  const panelShellSource = readGraphPanelShell();
  const html = readPrototypeHtml();
  const errorState = source.match(/function renderGraphErrorState\(message = ""\) \{([\s\S]*?)\n\}/)?.[1] || "";

  assert.match(errorState, /class="graph-empty graph-error-card"/);
  assert.doesNotMatch(errorState, /graph-empty bad/);
  assert.doesNotMatch(errorState, /\$\{escapeHtml\(text\)\}/);
  assert.match(errorState, /图谱暂时没有读出来/);
  assert.match(errorState, /刷新图谱/);
  assert.doesNotMatch(errorState, /Failed to fetch/);
  assert.match(panelStateBuilderSource, /summaryText: "图谱暂时无法读取，笔记树仍可正常使用。"/);
  assert.match(appShellSource, /renderGraphPanelShell\(\{/);
  assert.match(panelShellSource, /renderGraphPanelForRuntime\(\{ summary, canvas, backButton, panelState \}/);
  assert.match(panelRendererSource, /summary\.textContent = panelState\.summaryText \|\| "";/);
  assert.doesNotMatch(source, /summary\.textContent = `图谱加载失败/);
  assert.match(html, /\.graph-error-card strong \{[\s\S]*color: #17324d;/);
  assert.match(html, /\.graph-error-card span \{[\s\S]*color: #587086;/);
});

test("starfield graph keeps relation lines hairline and arrows quiet", () => {
  const html = readPrototypeHtml();
  const defsMarkup = renderGraphMapSvgDefsView({ markerColors: { support: "#6abfbd" } });

  assert.match(defsMarkup, /markerWidth="4\.2" markerHeight="4\.2"/);
  assert.match(defsMarkup, /stroke-opacity="0\.48" stroke-width="0\.52"/);
  assert.match(html, /\.graph-map-svg \{[\s\S]*border-radius: 28px;[\s\S]*linear-gradient\(135deg, #040912 0%, #07111e 48%, #0b1828 100%\);/);
  assert.match(html, /\.graph-map-edge \{[\s\S]*stroke-width: 0\.3;[\s\S]*opacity: 0\.1;/);
  assert.match(html, /\.graph-map-edge-underlay \{[\s\S]*stroke-width: 0\.82;[\s\S]*opacity: 0\.065;/);
  assert.match(html, /\.graph-map-edge-label \{[\s\S]*display: none;/);
  assert.match(html, /\.graph-map-svg\[data-graph-zoom="fit"\] \.graph-map-edge \{[\s\S]*marker-end: none;/);
});

test("starfield graph uses point-like low-rank nodes in dense fit view", () => {
  const html = readPrototypeHtml();
  const node = {
    id: "low-rank",
    title: "Low rank",
    noteType: "permanent",
    starTier: "minor",
    x: 10,
    y: 12,
    radius: 1.4
  };
  const viewState = graphVisualNodeViewState(
    node,
    8,
    { denseGalaxyMode: true, zoomKey: "fit" },
    { graphNodeShowsAsPoint: () => true, graphNodeStarRank: () => 1 }
  );
  const nodeMarkup = renderGraphVisualNodeView(
    node,
    8,
    { denseGalaxyMode: true, zoomKey: "fit" },
    { graphNodeShowsAsPoint: () => true, graphNodeStarRank: () => 1 }
  );

  assert.equal(viewState.pointLike, true);
  assert.equal(viewState.showLabel, false);
  assert.doesNotMatch(nodeMarkup, /graph-map-node-glint/);
  assert.match(html, /\.graph-map-node\.is-star-dust \.graph-map-node-core \{[\s\S]*opacity: 0\.44;/);
  assert.match(html, /\.graph-map-node\.is-star-major \.graph-map-node-core \{[\s\S]*stroke-width: 0\.84;/);
  assert.match(html, /\.graph-map-node\.is-star-core \.graph-map-node-core,[\s\S]*\.graph-map-node\.is-star-focus \.graph-map-node-core \{[\s\S]*stroke-width: 1\.1;/);
});

test("starfield graph reduces continuous motion when users prefer reduced motion", () => {
  const html = readPrototypeHtml();

  assert.match(html, /@media \(prefers-reduced-motion: reduce\) \{/);
  assert.match(html, /\.graph-map-star,/);
  assert.match(html, /\.graph-map-nebula,/);
  assert.match(html, /\.graph-map-cluster-glow,/);
  assert.match(html, /\.graph-map-node-core,/);
  assert.match(html, /\.graph-map-edge-group\.is-focused-path \.graph-map-edge,/);
});

test("graph thinking cards still highlight anchored graph elements", () => {
  const attrs = graphThinkingHighlightAttrsForItem({
    title: "Bridge",
    kicker: "Relation",
    detail: "Check this edge",
    highlightNodeIds: ["a"],
    highlightEdge: { id: "edge-1", fromNoteId: "a", toNoteId: "b", relationType: "supports" }
  }, {
    edgeSelectionKey: (edge) => `${edge.fromNoteId}->${edge.toNoteId}:${edge.relationType}`
  });
  assert.match(attrs, /data-graph-thinking-highlight="true"/);
  assert.match(attrs, /data-graph-thinking-node-ids="a"/);
  assert.match(attrs, /data-graph-thinking-edge-key="a-&gt;b:supports"/);
  assert.match(attrs, /data-graph-thinking-edge-id="edge-1"/);

  const nodeA = createGraphHoverTestElement({ class: "graph-map-node", "data-node-id": "a" });
  const nodeB = createGraphHoverTestElement({ class: "graph-map-node", "data-node-id": "b" });
  const nodeC = createGraphHoverTestElement({ class: "graph-map-node", "data-node-id": "c" });
  const edge = createGraphHoverTestElement({
    class: "graph-map-edge-group",
    "data-edge-id": "edge-1",
    "data-edge-from": "a",
    "data-edge-to": "b",
    "data-edge-relation-type": "supports"
  });
  const panel = createGraphHoverTestElement({ class: "graph-map-panel" }, {
    ".graph-map-node": [nodeA, nodeB, nodeC],
    ".graph-map-edge-group": [edge]
  });
  const hoverCard = createGraphHoverTestElement();
  const thinking = createGraphHoverTestElement({
    "data-graph-thinking-node-ids": "a",
    "data-graph-thinking-edge-id": "edge-1",
    "data-graph-thinking-edge-from": "a",
    "data-graph-thinking-edge-to": "b",
    "data-graph-thinking-edge-type": "supports",
    "data-graph-thinking-title": "Bridge",
    "data-graph-thinking-kicker": "Relation"
  });

  assert.equal(applyGraphThinkingHoverDomState(thinking, {
    document: { querySelector: () => panel },
    getHoverCard: () => hoverCard
  }), true);
  assert.equal(panel.classList.contains("is-hovering-thinking"), true);
  assert.equal(panel.classList.contains("is-hovering-edge"), true);
  assert.equal(nodeA.classList.contains("is-hovered"), true);
  assert.equal(nodeB.classList.contains("is-hovered"), true);
  assert.equal(nodeC.classList.contains("is-dimmed"), true);
  assert.equal(edge.classList.contains("is-hovered"), true);
  assert.match(hoverCard.innerHTML, /Bridge/);
});
