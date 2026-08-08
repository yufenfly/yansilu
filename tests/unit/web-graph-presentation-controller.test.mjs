import test from "node:test";
import assert from "node:assert/strict";

import {
  createGraphPresentationController,
  prepareGraphEntryPresentationStateForRuntime,
  resetGraphDemoPresentationStateForRuntime,
  syncGraphDisclosureStateForRuntime
} from "../../apps/web/src/graph-presentation-controller.js";

function createSection(key, open = false) {
  return {
    getAttribute: (name) => (name === "data-graph-section" ? key : ""),
    hasAttribute: (name) => name === "open" && open
  };
}

test("graph presentation controller syncs utility drawer and section disclosure state", () => {
  const graphState = {
    utilityDrawerOpen: false,
    sectionOpen: {}
  };
  const root = {
    querySelector: (selector) => (
      selector === "[data-graph-utility-drawer]"
        ? { hasAttribute: (name) => name === "open" }
        : null
    ),
    querySelectorAll: (selector) => (
      selector === "[data-graph-section]"
        ? [createSection("bridge-gaps", true), createSection("ai-analysis", false)]
        : []
    )
  };

  const synced = syncGraphDisclosureStateForRuntime(root, { graphState });

  assert.equal(synced, true);
  assert.equal(graphState.utilityDrawerOpen, true);
  assert.deepEqual(graphState.sectionOpen, {
    "bridge-gaps": true,
    "ai-analysis": false
  });
});

test("graph presentation controller schedules density hint dismissal with injected host deps", () => {
  const calls = [];
  const graphState = {
    lastLoadedDirectoryId: "dir-1",
    lastLoadedAt: 7
  };
  let timeoutCallback = null;
  const controller = createGraphPresentationController({
    graphState,
    windowRef: {
      setTimeout: (callback, delay) => {
        timeoutCallback = callback;
        calls.push(["timeout", delay]);
        return 42;
      },
      clearTimeout: (timer) => calls.push(["clear", timer])
    },
    isGraphModule: () => true,
    renderGraphPanel: () => calls.push(["render"])
  });

  assert.equal(controller.shouldShowGraphDensityHint({ dense: true, filterActive: false }), true);
  assert.equal(graphState.densityHintTimer, 42);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], "timeout");
  assert.ok(calls[0][1] > 0 && calls[0][1] <= 10000, `expected timeout delay within hint window, got ${calls[0][1]}`);

  timeoutCallback();

  assert.equal(graphState.densityHintTimer, 0);
  assert.equal(graphState.densityHintVisibleUntil, 0);
  assert.deepEqual(calls.at(-1), ["render"]);
});

test("graph presentation controller clears density hint timer", () => {
  const calls = [];
  const graphState = { densityHintTimer: 99 };
  const controller = createGraphPresentationController({
    graphState,
    windowRef: {
      clearTimeout: (timer) => calls.push(timer)
    }
  });

  assert.equal(controller.clearGraphDensityHintTimer(), true);
  assert.deepEqual(calls, [99]);
  assert.equal(graphState.densityHintTimer, 0);
});

test("graph presentation controller resets demo presentation through relation filter host", () => {
  const calls = [];
  const graphState = {
    selection: { kind: "node" },
    utilityDrawerOpen: true,
    sectionOpen: { "ai-analysis": true }
  };
  const controller = createGraphPresentationController({
    graphState,
    setRelationTypeFilter: (...args) => calls.push(args)
  });

  const reset = controller.resetGraphDemoPresentationState();

  assert.equal(reset, graphState);
  assert.deepEqual(calls, [["all", { persist: false }]]);
  assert.equal(graphState.selection, null);
  assert.equal(graphState.utilityDrawerOpen, false);
  assert.equal(graphState.utilityDrawerVisible, true);
  assert.equal(graphState.zoom, "detail");
  assert.deepEqual(graphState.sectionOpen, {
    "bridge-gaps": false,
    "weak-relations": false,
    "review-queue": false,
    "ai-analysis": false
  });
});

test("graph presentation reset stays self-contained after demo module cleanup", () => {
  const calls = [];
  const graphState = {
    selection: { kind: "node", nodeId: "old" },
    utilityDrawerOpen: true,
    sectionOpen: { "ai-analysis": true }
  };

  const result = resetGraphDemoPresentationStateForRuntime(graphState, {
    setRelationTypeFilter: (value, options) => calls.push([value, options])
  });

  assert.equal(result, graphState);
  assert.deepEqual(calls, [["all", { persist: false }]]);
  assert.equal(graphState.selection, null);
  assert.equal(graphState.readingLens, "insight");
  assert.equal(graphState.zoom, "detail");
  assert.equal(graphState.utilityDrawerOpen, false);
  assert.equal(graphState.thinkingPanelVisible, true);
  assert.deepEqual(graphState.sectionOpen, {
    "bridge-gaps": false,
    "weak-relations": false,
    "review-queue": false,
    "ai-analysis": false
  });
});

test("graph entry starts with map only and no floating panels", () => {
  const graphState = {
    selection: { kind: "node", nodeId: "old" },
    focusContextCollapsed: false,
    workbenchPanelOpen: true,
    workbenchPanelTab: "questions",
    thinkingPanelOpen: true,
    utilityDrawerOpen: true,
    researchNavigatorHidden: false,
    researchNavigatorTouched: false
  };

  const result = prepareGraphEntryPresentationStateForRuntime(graphState);

  assert.equal(result, graphState);
  assert.equal(graphState.selection, null);
  assert.equal(graphState.focusContextCollapsed, true);
  assert.equal(graphState.workbenchPanelOpen, false);
  assert.equal(graphState.workbenchPanelTab, "clues");
  assert.equal(graphState.thinkingPanelOpen, false);
  assert.equal(graphState.utilityDrawerOpen, false);
  assert.equal(Object.prototype.hasOwnProperty.call(graphState, "legendOpen"), false);
  assert.equal(graphState.researchNavigatorHidden, true);
  assert.equal(graphState.researchNavigatorTouched, true);
});
