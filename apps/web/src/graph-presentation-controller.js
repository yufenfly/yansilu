import {
  clearGraphDensityHintTimerForRuntime,
  scheduleGraphDensityHintDismissForRuntime,
  shouldShowGraphDensityHintForRuntime
} from "./graph-density-hint-controller.js";
import {
  clearGraphCanvasHelpHintTimerForRuntime,
  dismissGraphCanvasHelpHintForRuntime,
  scheduleGraphCanvasHelpHintDismissForRuntime,
  shouldShowGraphCanvasHelpHintForRuntime
} from "./graph-canvas-help-hint-controller.js";

export function resetGraphDemoPresentationStateForRuntime(graphState = {}, deps = {}) {
  const setRelationTypeFilter = deps.setRelationTypeFilter || (() => {});
  setRelationTypeFilter("all", { persist: false });
  graphState.readingLens = "insight";
  graphState.focusDepth = "1";
  graphState.selection = null;
  graphState.researchNavigatorHidden = true;
  graphState.researchNavigatorTouched = true;
  graphState.zoom = "detail";
  graphState.expanded = false;
  graphState.workbenchPanelOpen = false;
  graphState.workbenchPanelTab = "clues";
  graphState.thinkingPanelOpen = false;
  graphState.thinkingPanelVisible = true;
  graphState.thinkingFilter = "all";
  graphState.utilityDrawerOpen = false;
  graphState.utilityDrawerVisible = true;
  graphState.utilityDrawerPosition = null;
  graphState.sectionOpen = {
    "bridge-gaps": false,
    "weak-relations": false,
    "review-queue": false,
    "ai-analysis": false
  };
  return graphState;
}

export function prepareGraphEntryPresentationStateForRuntime(graphState = {}) {
  graphState.selection = null;
  graphState.focusContextCollapsed = true;
  graphState.workbenchPanelOpen = false;
  graphState.workbenchPanelTab = "clues";
  graphState.thinkingPanelOpen = false;
  graphState.utilityDrawerOpen = false;
  graphState.researchNavigatorHidden = true;
  graphState.researchNavigatorTouched = true;
  return graphState;
}

export function syncGraphDisclosureStateForRuntime(root = null, deps = {}) {
  const { graphState = {} } = deps;
  if (!root) return false;
  const utilityDrawer = root.querySelector?.("[data-graph-utility-drawer]");
  if (utilityDrawer) {
    graphState.utilityDrawerOpen = utilityDrawer.hasAttribute("open");
  }
  root.querySelectorAll?.("[data-graph-section]")?.forEach((section) => {
    const key = String(section.getAttribute?.("data-graph-section") || "").trim();
    if (!key) return;
    graphState.sectionOpen ||= {};
    graphState.sectionOpen[key] = section.hasAttribute("open");
  });
  return true;
}

export function createGraphPresentationController(deps = {}) {
  const {
    graphState = {},
    windowRef = globalThis.window,
    isGraphModule = () => false,
    renderGraphPanel = () => {},
    setRelationTypeFilter = () => {}
  } = deps;
  const densityDeps = () => ({
    graphState,
    window: windowRef,
    isGraphModule,
    renderGraphPanel
  });

  return {
    syncGraphDisclosureState: (root) => syncGraphDisclosureStateForRuntime(root, { graphState }),
    clearGraphDensityHintTimer: () => clearGraphDensityHintTimerForRuntime(densityDeps()),
    scheduleGraphDensityHintDismiss: () => scheduleGraphDensityHintDismissForRuntime(densityDeps()),
    shouldShowGraphDensityHint: (options = {}) => shouldShowGraphDensityHintForRuntime(options, densityDeps()),
    clearGraphCanvasHelpHintTimer: () => clearGraphCanvasHelpHintTimerForRuntime(densityDeps()),
    scheduleGraphCanvasHelpHintDismiss: () => scheduleGraphCanvasHelpHintDismissForRuntime(densityDeps()),
    shouldShowGraphCanvasHelpHint: (options = {}) => shouldShowGraphCanvasHelpHintForRuntime(options, densityDeps()),
    dismissGraphCanvasHelpHint: () => dismissGraphCanvasHelpHintForRuntime(densityDeps()),
    prepareGraphEntryPresentationState: () => prepareGraphEntryPresentationStateForRuntime(graphState),
    resetGraphDemoPresentationState: () => resetGraphDemoPresentationStateForRuntime(graphState, {
      setRelationTypeFilter
    })
  };
}
