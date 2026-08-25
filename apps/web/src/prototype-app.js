import { childFolders, createInitialState, folderById, joinFsPath, parseLinks, notesInFolder, parseTags, rootBoxIdFromFolder, typeFromFolder, uid } from "./prototype-store.js";
import { ContextMenu } from "./components-context-menu.js";
import { CreateBoxDialog } from "./components-create-box-dialog.js";
import { PermanentNoteDialog } from "./components-permanent-note-dialog.js";
import { createTextInputDialog } from "./components-text-input-dialog.js";
import { createDesktopFileCommandService } from "./desktop-file-command-service.js";
import { ExplorerPane, explorerNewNoteButtonCopy, resolveExplorerNewNoteFolderId } from "./components-explorer-pane.js";
import { deriveLiteratureSectionLabelsFromTemplate, EditorPane, normalizeFieldText, parseLiteratureWorkspace, validateLiteratureTemplateSource } from "./components-editor-pane.js";
import { renderImportPageMount } from "./import-page-mount.js";
import { importConfirmButtonState, preferredImportDirectoryIdFromOptions } from "./import-toolbar-model.js";
import { createImportToolbarActions } from "./import-toolbar-actions.js";
import { renderImportToolbarMount } from "./import-toolbar-mount.js";
import { createImportWorkspaceShellController } from "./import-workspace-shell.js";
import { renderImportResultMount } from "./import-result-mount.js";
import { createImportResultRuntime } from "./import-result-runtime.js";
import { createImportResultHostRoutes } from "./import-result-host-routes.js";
import { createTodayOrganizingEntryRuntime } from "./today-organizing-entry-runtime.js";
import { renderDistillationPanelView } from "./distillation-panel-view.js";
import { installDistillationEventBindings } from "./distillation-event-bindings.js";
import { openDistillationQueueNoteRoute } from "./distillation-note-route.js";
import { syncRailSelectionDom, todayRailHasTasks } from "./app-shell-rail.js";
import { installAppRailEventBindings } from "./app-rail-event-bindings.js";
import { installQuickActionEventBindings } from "./quick-action-event-bindings.js";
import { installAppGlobalKeyboardEvents } from "./app-global-keyboard-events.js";
import { dismissSafeOverlaysForEscape, dismissSafeOverlaysForNavigation } from "./app-overlay-dismissal-controller.js";
import { installStartupAutoOpenEventBindings } from "./startup-auto-open-event-bindings.js";
import { installDirtyTabsBeforeUnloadEventBindings } from "./dirty-tabs-beforeunload-event-bindings.js";
import { installEditorShellEventBindings } from "./editor-shell-event-bindings.js";
import { installSaveAiSuggestionRouteEventBindings } from "./save-ai-suggestion-route-events.js";
import { editorSelectionAiActionElements } from "./app-shell-editor-elements.js";
import { createExplorerPaneHostDeps } from "./explorer-host-deps.js";
import { createEditorPaneHostDeps } from "./editor-host-deps.js";
import { editorHelperNoteType, editorHelperShouldHide } from "./editor-helper-model.js";
import { createDirectoryOptionRuntime } from "./directory-option-runtime.js";
import { createRenderAppShellController } from "./app-shell-render-all.js";
import { createRenderAppShellPrototypeDepsProvider } from "./app-shell-render-all-host-deps.js";
import { buildWorkspaceStatusHintModel } from "./workspace-status-hint-model.js";
import { syncModuleChromeClassesForRuntime } from "./app-shell-module-ui.js";
import { createModuleWorkspaceHeaderRuntimeRoutes } from "./app-module-header-runtime-routes.js";
import { createSidebarTitleController } from "./app-shell-sidebar-controller.js";
import { createSidebarTitlePrototypeDepsProvider } from "./app-shell-sidebar-host-deps.js";
import { installSidebarFlowEventHandler } from "./app-shell-sidebar-flow.js";
import { buildSmartNotesDemoWalkthrough, renderSmartNotesDemoGuidePanel } from "./beginner-onboarding-flow.js";
import { installMobileNoteEventBindings } from "./mobile-note-event-bindings.js";
import { createAppShellStateChangePrototypeDepsProvider } from "./app-shell-state-change-host-deps.js";
import { handleCreateDirectoryFromDialog } from "./app-shell-state-file-actions.js";
import { routeAppShellStateChange } from "./app-shell-state-change-router.js";
import { bootstrapAppForRuntime } from "./app-startup-controller.js";
import { SMART_NOTES_DEMO_GUIDE_DIRECTORY_ID, smartNotesDemoExistingFolder, smartNotesDemoImportedStatus, smartNotesDemoOpenedExistingGuideStatus, smartNotesDemoStartupNoteId, shouldRefreshHomeAfterSmartNotesDemoImport } from "./smart-notes-demo-startup-note.js";
import { candidatePreviewItemIds, candidatePreviewItems, confirmSkipReasonMap, confirmSkippedCandidateIds, selectionSummary as summarizeCandidateSelection } from "./import-candidate-preview-model.js";
import { renderCandidatePreview, renderConfirmSkipBreakdown } from "./import-candidate-preview-panel.js";
import { selectedCandidateIdsForImportAction } from "./import-selection-actions.js";
import { candidateIdsForSelection as computeCandidateIdsForSelection, candidatePreviewFromPayload, candidateSelectionFromPayload, createdNoteIdsByTypeFromImportPayload, createdNoteIdsByTypeFromImportRecord, defaultSelectedCandidateIds as computeDefaultSelectedCandidateIds, importPayloadRecordId, literatureBatchSummaryForPayload as computeLiteratureBatchSummaryForPayload, renderImportWritingActions as renderImportWritingActionsHtml, renderWritingResultDetails as renderWritingResultDetailsHtml, selectedCandidateIdsForImportState, selectionSummaryForImportState, summarizeLiteratureBatchFromNotes as computeSummarizeLiteratureBatchFromNotes, syncImportSelectionState } from "./prototype-import-result-helpers.js";
import { literatureQueueLaneForNote as computeLiteratureQueueLaneForNote, preferredLiteratureQueueNoteId as computePreferredLiteratureQueueNoteId, rankedLiteratureQueueNotes as computeRankedLiteratureQueueNotes } from "./prototype-literature-queue.js";
import { normalizeAuthorshipItem, normalizeThinkingStatusItem, renderThinkingStatusBadge as renderThinkingStatusBadgeHtml, uniqueStrings } from "./prototype-thinking-status.js";
import { deriveWritingProjectIntent, deriveWritingProjectTakeaway, directoryPathLabel as computeDirectoryPathLabel, displayFolderName, distillationReasonOf, distillationStageLabel, distillationStageOf, distillationStatusLabel, distillationStatusOf, mapDirectoryItem, moduleLabel, mapNoteItem as computeMapNoteItem, noteMatchesSearchQuery, noteTypeLabel, saveAiSuggestionKey, sourceNoteTypeLabel, writingProjectStatusLabel } from "./prototype-note-state-helpers.js";
import { createNotePlaceholderRuntime } from "./note-placeholder-runtime.js";
import { createNoteRuntimeController } from "./note-runtime-controller.js";
import { basenameLocalPath, dirnameLocalPath, joinLocalPath } from "./desktop-file-adapter.js";
import { aiInboxFeedbackFromWorkspace, aiInboxFiltersFromWorkspace, bindAiInboxWorkspaceEvents, renderAiInboxWorkspaceView } from "./ai-inbox-workspace.js";
import { createAiInboxWorkspaceHostDeps } from "./ai-inbox-host-deps.js";
import { dismissSaveAiSuggestionForLater, saveAiSuggestionPrimaryRoute } from "./save-ai-suggestion-model.js";
import { createSaveAiSuggestionWorkflowRoutes } from "./save-ai-suggestion-workflow-routes.js";
import { aiSuggestionFiltersFromWorkspace, aiSuggestionReviewedContentFromWorkspace, bindAiSuggestionsWorkspaceEvents, normalizeVisibleSuggestionFilters, renderAiSuggestionsWorkspaceView } from "./ai-suggestions-workspace.js";
import { createAiSuggestionsWorkspaceHostDeps } from "./ai-suggestions-host-deps.js";
import { applyAiRuntimeModeChangeForRuntime } from "./ai-runtime-mode-controller.js";
import { aiInboxActionLabel, aiArtifactFromCanonical, aiInboxItemFromCanonical, normalizeAiInboxFilters } from "./ai-inbox-model.js";
import { createSettingsAiStateRuntime } from "./settings-ai-state-runtime.js";
import { aiInboxFiltersForSystemMessage, globalPendingAiInboxFilters, markSystemMessageRead, normalizeSystemMessage, noteAnalysisSystemMessageForResult, scheduledTaskSystemMessageForArtifacts, systemMessageSubjectText, upsertSystemMessageList } from "./prototype-system-messages.js";
import { systemMessageActionRoute } from "./system-message-route-model.js";
import { createSystemMessagesShellController } from "./system-messages-shell.js";
import { persistSystemMessagesForRuntime, readStoredSystemMessagesForRuntime } from "./system-message-storage.js";
import { createSystemMessagesPrototypeHostProvider } from "./system-messages-host-deps.js";
import { addSystemMessageForRuntime, markSystemMessagesReadForRuntime, resolveSystemMessageByDedupeKeyForRuntime, upsertSystemMessageForRuntime } from "./system-messages-runtime-controller.js";
import { handleSystemMessageEscapeKey, installSystemMessageEventHandlers } from "./system-message-events.js";
import { createSystemMessagePrototypeDepsProviders } from "./system-message-deps.js";
import { createRecordPermanentWorkflowOpener, createSystemMessageWorkflowOpener } from "./prototype-system-message-workflow.js";
import { LITERATURE_TEMPLATE_SETTINGS_FIELDS, NOTE_TEMPLATE_STORAGE_KEYS, PERMANENT_TEMPLATE_SETTINGS_FIELDS, applyTitleToNoteTemplate as computeApplyTitleToNoteTemplate, composePermanentTemplateDraft as computeComposePermanentTemplateDraft, defaultLiteratureTemplateSource as computeDefaultLiteratureTemplateSource, defaultPermanentTemplateSource as computeDefaultPermanentTemplateSource, defaultTemplateSourceForKind as computeDefaultTemplateSourceForKind, legacyPermanentTemplateSource as computeLegacyPermanentTemplateSource, mergeTemplateFieldText as computeMergeTemplateFieldText, normalizeDraftBuffer as computeNormalizeDraftBuffer, normalizeNoteTemplateHistory as computeNormalizeNoteTemplateHistory, normalizeNoteTemplateSource as computeNormalizeNoteTemplateSource, normalizeStoredNoteTemplateSource as computeNormalizeStoredNoteTemplateSource, noteTemplateHistoryWithPrevious as computeNoteTemplateHistoryWithPrevious } from "./prototype-note-templates.js";
import { aiSuggestionDetailFromResponse as suggestionDetailFromResponse, aiSuggestionFromCanonical, aiSuggestionStatusLabel, aiSuggestionReviewEventFromCanonical as suggestionReviewEventFromCanonical, aiSuggestionTraceFromCanonical as suggestionTraceFromCanonical, normalizeAiSuggestionFilters } from "./ai-suggestions-model.js";
import { loadAiSuggestionDetailForRuntime, refreshAiSuggestionsForRuntime } from "./ai-suggestions-runtime-controller.js";
import { createAiSuggestionsActionRoutes } from "./ai-suggestions-action-routes.js";
import { finalizeAiInboxActionRefreshForRuntime, loadAiInboxDetailForRuntime, refreshAiInboxEvaluationSummaryForRuntime, refreshAiInboxForRuntime, runAiInboxSummaryForRuntime } from "./ai-inbox-runtime-controller.js";
import { createAiInboxActionRoutes } from "./ai-inbox-action-routes.js";
import { renderScheduledTasksPanel } from "./scheduled-tasks-panel.js";
import { mountSettingsAutomationWorkspace } from "./settings-automation-workspace.js";
import { renderSettingsAutomationRunHistory } from "./settings-automation-run-history.js";
import { readableMobileAccessError, renderMobileAccessDesktopPanel } from "./mobile-access-desktop-panel.js";
import { prepareMobileAccessAutoRefreshState, shouldAutoRefreshMobileAccess, shouldPromoteMobileAccessRefreshRender } from "./mobile-access-settings-refresh.js";
import { graphFocusCardActionMeta as computeGraphFocusCardActionMeta, graphIsolatedNodeIds, graphFollowupActionForRelationType, graphNextActionForSummary, graphSelectEdgeActionAttrs as computeGraphSelectEdgeActionAttrs, graphWritingCandidateNoteIds, graphWritingContinuationInput } from "./graph-followup.js";
import { buildThemeIndexCreatePayload, THEME_INDEX_MIN_NOTE_COUNT } from "./theme-index-entry-model.js";
import { resolveWritingProjectFormTitle, syncWritingThemeFormFields } from "./writing-theme-form-sync.js";
import { createGraphFollowupController } from "./graph-followup-controller.js";
import { clearGraphIsolatedRelationDraftForState } from "./graph-relation-drafts.js";
import { createGraphIsolatedRelationController } from "./graph-isolated-relation-controller.js";
import { createGraphIsolatedDecisionController } from "./graph-isolated-decision-controller.js";
import { createGraphRelationSaveController } from "./graph-relation-save-controller.js";
import { createGraphRelationWorkflowController, graphNormalizeRelationWorkflowSelection } from "./graph-relation-workflow-controller.js";
import { createGraphIsolatedWorkflowShellRenderer } from "./graph-isolated-workflow-shell.js";
import { graphBlockedAiRelationPairKeysForNote as computeGraphBlockedAiRelationPairKeysForNote, graphCandidateBlocksFormalRelation as computeGraphCandidateBlocksFormalRelation, graphCandidateCanSaveRelation as computeGraphCandidateCanSaveRelation, graphCandidateCountKey as computeGraphCandidateCountKey, graphCandidateEndpointIds as computeGraphCandidateEndpointIds, graphCandidatePercent as computeGraphCandidatePercent, graphCandidateUndirectedPairKey as computeGraphCandidateUndirectedPairKey, graphAiRelationCandidatesForNote as computeGraphAiRelationCandidatesForNote, graphDecoratePotentialRelationCandidate as computeGraphDecoratePotentialRelationCandidate, graphMergeRelationCandidatesForDisplay as computeGraphMergeRelationCandidatesForDisplay, graphPendingAiCandidateCount as computeGraphPendingAiCandidateCount, graphPotentialRelationActionEndpoints as computeGraphPotentialRelationActionEndpoints, graphPotentialRelationEvidenceText as computeGraphPotentialRelationEvidenceText, graphPotentialRelationRationaleDraft as computeGraphPotentialRelationRationaleDraft, graphPreferredPotentialRelationType as computeGraphPreferredPotentialRelationType, graphRelationCandidateKey as computeGraphRelationCandidateKey, graphRelationRationaleIsActionable as computeGraphRelationRationaleIsActionable } from "./graph-ai-candidates.js";
import { createGraphAiConnectRuntimeController } from "./graph-ai-connect-runtime-controller.js";
import { graphDirectNetworkEdgeCount as computeGraphDirectNetworkEdgeCount, graphExistingRelationKeys as computeGraphExistingRelationKeys, graphExistingRelationPairKeys as computeGraphExistingRelationPairKeys, graphRelationPairKey as computeGraphRelationPairKey, graphRelationSaveResultForNote, graphRelationStatusCountsAsNetworkEdge as computeGraphRelationStatusCountsAsNetworkEdge, graphRelationStatusKey as computeGraphRelationStatusKey } from "./graph-relation-state-query.js";
import { graphComputedIsolatedNotesForGraph, graphIsolatedQueueItemsForGraph, graphMarkIsolatedNodesForGraph, graphNextIsolatedQueueItem as computeGraphNextIsolatedQueueItem, graphNoteIdFromIsolatedItem as computeGraphNoteIdFromIsolatedItem } from "./graph-isolated-queue.js";
import { graphFullNoteByIdFromSources, graphIsolatedPreviewTargetForNote, graphLocalRelationCandidatesForNote as computeGraphLocalRelationCandidatesForNote, graphManualRelationTargetsForNote as computeGraphManualRelationTargetsForNote, graphNotePreviewTextForLocalRelation, graphNoteTagsForLocalRelation, graphTitleCharacterOverlap as computeGraphTitleCharacterOverlap } from "./graph-local-relations.js";
import { renderGraphIsolatedJoinNetworkFlowHtml } from "./graph-isolated-relation-workspace.js";
import { renderGraphIsolatedNextStepActionsHtml } from "./graph-isolated-next-step.js";
import { graphThemeCandidateNoteIdsForNode as computeGraphThemeCandidateNoteIdsForNode, renderGraphRelationWorkspaceForNote as renderGraphRelationWorkspaceMarkup, renderGraphThemeIndexWorkspace as renderGraphThemeIndexWorkspaceMarkup } from "./prototype-graph-workspace.js";
import { renderGraphResearchNavigatorEntryView, renderGraphThinkingItemsView, renderGraphThinkingPanelContentView, renderGraphThinkingPanelView, renderGraphThinkingReviewNoteView, renderGraphWorkbenchEntryPillsView, renderGraphWorkbenchPanelView, renderGraphWorkbenchPriorityQueueView } from "./graph-workbench-panel.js";
import { graphRelationQualityLabel, graphRelationReviewReasonLabel, renderGraphUtilityDrawerView, renderRelationReviewQueueSectionView } from "./graph-review-surface-view.js";
import { applyGraphEmptyCloseInteraction, applyGraphSectionOpenState, applyGraphThinkingFilterInteraction, applyGraphThinkingHideInteraction, applyGraphThinkingToggleInteraction, applyGraphThinkingVisibilityInteraction, applyGraphUtilityDrawerCloseInteraction, applyGraphUtilityDrawerOpenState, applyGraphUtilityVisibilityInteraction, applyGraphWorkbenchCloseInteraction, applyGraphWorkbenchEntryInteraction, applyGraphWorkbenchTabInteraction } from "./graph-workspace-interaction-controller.js";
import { buildGraphQuestionSpotSummaryForGraph, buildGraphQuestionSpotSummaryFromItems as computeGraphQuestionSpotSummaryFromItems, buildGraphThinkingItemsForGraph, graphAiAnalysisSummaryStateForGraph, graphLiveAiAnalysisCountsForGraph, graphThinkingCleanIds as computeGraphThinkingCleanIds, graphThinkingNoteTitle as computeGraphThinkingNoteTitle } from "./graph-thinking-items-model.js";
import { applyGraphEdgeHoverDomState, applyGraphNodeHoverDomState, applyGraphThinkingHoverDomState, graphDataListFromElement, graphThinkingHighlightAttrsForItem, resetGraphHoverDomState } from "./graph-thinking-hover-controller.js";
import { renderGraphPromptDetailsView, renderGraphSelectionMetricsView, renderGraphSelectionShellView, renderGraphSelectionTaskView } from "./graph-selection-panel.js";
import { renderGraphClusterSelectionPanelView } from "./graph-cluster-selection-panel.js";
import { createGraphSelectionPanelRenderer } from "./graph-selection-panel-renderer.js";
import { buildGraphWorkspaceRenderDeps, createGraphThinkingModelRuntimeDepsProvider } from "./graph-workspace-host-deps.js";
import { graphFocusContextCollapsedState, graphFocusContextCollapsedStatus, renderGraphFocusContextPanel as renderGraphFocusContextPanelView } from "./graph-focus-context-panel.js";
import { GRAPH_FOCUS_CONTEXT_MODE_KEY, GRAPH_FOCUS_DEPTH_KEY, graphFocusContextModeMeta, graphFocusDepthMeta, normalizeGraphFocusContextMode, normalizeGraphFocusDepth, setGraphFocusContextModeForRuntime, setGraphFocusDepthForRuntime } from "./graph-focus-controls-state.js";
import { createGraphPresentationController } from "./graph-presentation-controller.js";
import { graphClusterResearchMeta as computeGraphClusterResearchMeta, graphResearchNavigatorState as computeGraphResearchNavigatorState, graphUniqueClusterMeta as computeGraphUniqueClusterMeta, renderGraphResearchNavigatorPanelView } from "./graph-research-navigator.js";
import { buildGraphPanelState } from "./graph-panel-state-builder.js";
import { renderGraphPanelShell } from "./graph-panel-shell.js";
import { createGraphPanelPrototypeRuntimeDepsProvider } from "./graph-panel-host-deps.js";
import { renderGraphPanelForRuntime } from "./graph-panel-renderer.js";
import { renderGraphIconView } from "./graph-icon-view.js";
import { createGraphResidualViews } from "./graph-residual-views.js";
import { graphFilterOptionsForRuntime } from "./graph-filter-options-view.js";
import { renderGraphMapPreviewView } from "./graph-map-preview-view.js";
import { refreshDirectoryGraphForRuntime } from "./graph-refresh-controller.js";
import { createGraphRouteRuntime } from "./graph-route-runtime.js";
import { createGraphVisualMapController } from "./graph-visual-map-controller.js";
import { createGraphVisualMapPrototypeDepsProvider } from "./graph-visual-map-host-deps.js";
import { bindGraphCanvasEvents } from "./graph-canvas-event-router.js";
import { installGraphNodeClickFallbackEvents, installGraphWorkbenchClickFallbackEvents } from "./graph-node-click-fallback-events.js";
import { graphBuildVisualLayout as graphBuildVisualLayoutForRuntime } from "./graph-visual-layout.js";
import { createGraphViewportController } from "./graph-viewport-controller.js";
import { createGraphUtilityDrawerController } from "./graph-utility-drawer-controller.js";
import { GRAPH_VISUAL_ZOOM_OPTIONS, graphZoomOption, graphZoomStep } from "./graph-visual-zoom-model.js";
import { applyGraphFocusContextModeInteraction, applyGraphFocusDepthInteraction, applyGraphReadingLensInteraction, applyGraphRelationTypeFilterInteraction, applyGraphTaskViewInteraction, applyGraphViewModeInteraction, applyGraphWheelZoomInteraction, applyGraphZoomOptionInteraction, applyGraphZoomStepInteraction } from "./graph-toolbar-interaction-controller.js";
import { renderGraphClusterGlowView, renderGraphNebulaFieldView, renderGraphStarfieldView } from "./graph-visual-map-view.js";
import { graphReadingLensMeta as computeGraphReadingLensMeta, renderGraphReadingLensControls as renderGraphReadingLensControlsView } from "./graph-reading-lens-controls.js";
import { createGraphReadingLensStateController } from "./graph-reading-lens-state.js";
import { GRAPH_INDEX_RELATION_TYPES, GRAPH_LINK_CLUE_RELATION_TYPES, GRAPH_MEANINGFUL_RELATION_TYPES, GRAPH_RELATION_TYPE_FILTER_KEY, graphHasMeaningfulStructureEdges, graphReadingModeMeta, graphStructureFallbackEdges as graphStructureFallbackEdgesForRuntime, graphViewModeForRelationType, normalizeGraphRelationTypeFilter, renderGraphRelationTypeFilter as renderGraphRelationTypeFilterForRuntime, renderGraphViewModeSwitcher as renderGraphViewModeSwitcherForRuntime, setGraphRelationTypeFilterForRuntime } from "./graph-view-mode-state.js";
import { GRAPH_RELATION_GROUP_META, GRAPH_RELATION_MARKER_COLORS, graphEdgeSelectionKey, graphRelationGroupMeta, graphRelationVisual } from "./graph-relation-visual-state.js";
import { graphDenseGalaxyMode, graphEdgePath as graphEdgePathForRuntime, graphEdgeShouldRender as graphEdgeShouldRenderForRuntime, graphEdgeVisibleAtFit as graphEdgeVisibleAtFitForRuntime, graphHash, graphNodeAttentionReasons, graphNodeRadiusByTier, graphNodeShowsAsPoint, graphNodeStarRank, graphNodeStarTier, graphShortTitle, graphThemeBoundaryMeta as graphThemeBoundaryMetaForRuntime, renderGraphThemeBoundary as renderGraphThemeBoundaryForRuntime } from "./graph-visual-geometry.js";
import { graphBridgeSelectionKey, graphIsolatedSelectionKey, graphNodeClass, graphThemeNoteIds, graphThemeSelectionKey } from "./graph-visual-selection-state.js";
import { installGraphEntryEventBindings } from "./graph-entry-event-bindings.js";
import { graphBuildFocusedRelationTypeStatsForRuntime, graphFocusedItemsForRuntime, graphLoadedScopeCoversDirectoryForRuntime, graphScopedItemsForRuntime, graphScopeDirectoryIdForRuntime } from "./graph-scope-state.js";
import { renderDraftVersionCardView, renderScaffoldVersionCardView, renderWritingToplineMetricView } from "./writing-workspace-view.js";
import { titleFromBody } from "./editor-template-workspace.js";
import { createWritingPanelShellController } from "./writing-panel-shell.js";
import { createWritingPanelPrototypeHostProvider } from "./writing-panel-host-deps.js";
import { applyWritingTab, installWritingTabEvents } from "./writing-tabs.js";
import { writingDraftMarkdown } from "./writing-workbench-model.js";
import { installWritingRelatedPanelEvents } from "./writing-related-notes-panel.js";
import { installWritingSidebarActionEvents } from "./writing-sidebar-actions.js";
import { handleWritingCreateScaffoldClick, installWritingPanelBasketEventHandlers, installWritingThemeIndexEventHandlers, installWritingThemeDetailEventHandlers, installWritingProjectListEventHandlers, installWritingProjectHistoryEventHandlers, installWritingDraftActionEventHandlers } from "./writing-panel-events.js";
import { writingCandidateNotesForRuntime, writingScopeDirectoryIdsForRuntime } from "./writing-candidate-state.js";
import { addWritingBasketIdsForRuntime, clearWritingBasketForRuntime, parseWritingBasketIdsForRuntime, removeWritingBasketIdForRuntime, setWritingBasketIdsForRuntime } from "./writing-basket-state.js";
import { writingBasketContinuationPlan, writingProjectContinuationRoute } from "./writing-entry-route-model.js";
import { clearWritingFocusedCandidateScopeForRuntime, clearWritingSourceIndexIdsForRuntime, clearWritingThemeRelationCountsForRuntime, resetWritingStrongModelStateForRuntime, setWritingFocusedCandidateScopeForRuntime, setWritingSourceIndexIdsForRuntime } from "./writing-session-state.js";
import { sameUniqueStringSetForRuntime, selectedWritingThemeIndexForRuntime, setSelectedWritingThemeIndexForRuntime, writingThemeIndexByIdForRuntime, writingThemeIndexScopeDirectoryIdForRuntime, writingThemeIndexNoteIdsForRuntime } from "./writing-theme-state.js";
import { graphAssociateNoteRoute, graphFollowupActionRoute, noteDeleteKeyRoute } from "./note-browser-action-router.js";
import { createGraphRelationComposerEntry } from "./graph-relation-composer-entry.js";
import { generatedOriginalNoteIdFromBody, isPersistableRelationNetworkStatus, notePersistenceFieldsForSave, stripGeneratedOriginalMarker, withGeneratedOriginalMarker, withGeneratedOriginalReference } from "./note-persistence-policy.js";
import { createRelationEntryRuntimeController } from "./relation-entry-runtime-controller.js";
import { describeWritingContinuationAction, describeWritingStrongModelStatus, describeWritingBatchAppendStatus, planWritingCandidateFocus, describeWritingThemeProjectEntryState, describeWritingProjectPreflight, planWritingBasketEntry, planWritingThemeIndexEntry, resolveWritingSelectedThemeIndexId, resolveWritingSourceIndexIds, resolveWritingEntryTitle, shouldPreserveWritingThemeContext, writingThemeIndexContinuationRoute, writingCenterContinuationFailureMessage, writingCenterContinuationStatusMessage, isWritingStrongModelReady } from "./writing-center-flow.js";
import { countExplicitSemanticRelations, deriveBasketWritingReadiness, describeProjectPreflight, noteHasBoundarySignal } from "./writing-readiness.js";
import { createWritingProjectRuntimeController } from "./writing-project-runtime-controller.js";
import { findReviewOutlineProjectWithRefresh } from "./review-checklist-outline-entry.js";
import { createWritingEntryRuntimeHost } from "./writing-entry-runtime-host.js";
import { createWritingThemeProjectRuntime } from "./writing-theme-project-runtime.js";
import { normalizeWritingProjectTitleSeed as computeNormalizeWritingProjectTitleSeed, resetWritingLocalBookIdeasState as resetWritingLocalBookIdeasForRuntime, suggestedThemeIndexTitle as computeSuggestedThemeIndexTitle, suggestedWritingProjectTitle as computeSuggestedWritingProjectTitle, syncWritingLocalBookIdeasFromProjectState as syncWritingLocalBookIdeasFromProjectForRuntime, writingSourceIndexSummary as computeWritingSourceIndexSummary, writingThemeLabels as computeWritingThemeLabels, writingThemeSummary as computeWritingThemeSummary } from "./prototype-writing-workspace.js";
import { createWritingBookRuntime } from "./writing-book-runtime.js";
import { createWritableThemeDiscoveryController } from "./writable-theme-discovery-controller.js";
import { scheduledTaskFormDefaults } from "./scheduled-tasks-model.js";
import { createScheduledTasksRuntimeController } from "./scheduled-tasks-runtime-controller.js";
import { aiSettingsSelectionFromPreferences, canonicalizeAiSettingsSelection, isAiLocalFlowActive, isLocalModelPack, isLocalProviderId, localProviderPresetForModelPack, normalizeAiRuntimeMode, providerPresetForModelPack, shouldUseOllamaLocalRuntimeForSelection, supportedAiSettingsModelPack } from "./ai-settings-state.js";
import { renderAiLocalModelControlsForRuntime, renderAiLocalModelRecommendationsForRuntime, renderAiProviderConfigControlsForRuntime } from "./settings-ai-controls-view.js";
import { renderAiSettingsExperienceForRuntime } from "./settings-ai-experience-view.js";
import { renderAiRoutePreviewForRuntime } from "./settings-ai-route-preview-view.js";
import { escapeTemplatePreviewInline, renderTemplateMarkdownPreviewHtmlForRuntime } from "./settings-template-preview-view.js";
import { createSettingsNoteTemplateRuntime } from "./settings-note-template-runtime.js";
import { createSettingsPanelRuntimeRoutes } from "./settings-panel-runtime-routes.js";
import { installSettingsEventBindings } from "./settings-event-bindings.js";
import { renderVaultBackupPanel } from "./settings-vault-backup-panel.js";
import { installSettingsAiEventBindings } from "./settings-ai-event-bindings.js";
import { installSettingsFeedbackEventBindings } from "./settings-feedback-event-bindings.js";
import { aiTestBlockedReasonForState, currentOllamaModelTiersForState, installedLocalModelReadyForState } from "./ai-test-readiness.js";
import { localAiPreviewOptionsForAction, ollamaStopRuntimeUiOutcome } from "./ai-local-runtime-ui-model.js";
import { activateLocalAiSetupSelection } from "./local-ai-setup-activation.js";
import { createLocalAiSetupController } from "./local-ai-setup-controller.js";
import {
  buildSourceNoteDistillDraft,
  buildSourceNoteDistillDraftFromAiResult
} from "./source-note-distill-ai-draft.js";
import { isLocalAdvancedModelRefForSettings } from "./settings-ai-runtime-actions.js";
import { createSettingsAiRuntimeController } from "./settings-ai-runtime-controller.js";
import { buildAiProviderConfigPayload } from "./settings-ai-provider-config-actions.js";
import { remoteApiKeySecretRef } from "./ai-settings-remote-config-model.js";
import { AI_LOCAL_MODEL_TIERS, AI_REMOTE_MODEL_TIERS, OLLAMA_CHAT_ENDPOINT_URL, OLLAMA_HEALTH_ENDPOINT_URL, OLLAMA_RECOMMENDED_MODEL, aiDefaultsForRuntimeMode, defaultProviderEndpointUrl, defaultProviderHealthEndpointUrl, enabledProviderHealthEndpointUrl, isBuiltInOllamaModel, isRemoteConfigurableProviderId, localModelDisplayProfile, modelNameExistsInList, normalizeOllamaSetupGuide, ollamaBootstrapStatusText, ollamaModelRecommendationProfiles, ollamaRecommendationForModel, preferredLocalModelName, remoteRuntimeModelFromMap, runtimeModelMapForRemoteModel, selectedLocalModelNameForInstalledModels } from "./prototype-ai-settings-controller.js";
import { createUpdateState, shouldShowUpdateAttention, updateStateAutoCheckEnabled, updateStateIgnoreLatest, updateStateRemindLater } from "./update-state.js";
import { createPrototypeUpdateController, renderUpdateSettingsCard } from "./prototype-update-controller.js";
import { analyzeDirectoryGraph, analyzePermanentNote, analyzeWritingWithStrongModel, refinePotentialRelationCandidate, bindWritingDraftNote, acceptAiInboxLink, checkAppUpdate, checkAiProviderHealth, confirmMobilePairRequest, confirmPermanentNoteDistillation, confirmImport, createDirectory, createDraftScaffold, createEncryptedVaultBackup, createAiSuggestion, createIndexCard, createNote, createWritingProject, deleteDirectory, deleteNote, exportMarkdown, fetchDraftScaffold, fetchDirectories, fetchGraphConflicts, fetchDirectoryGraph, fetchAiInbox, fetchAiInboxEvaluationSummary, fetchAiInboxItem, fetchAiInboxItemWithOptions, fetchAiSuggestion, fetchAiSuggestions, fetchAiScheduledTasks, fetchAiScheduledTaskTemplates, fetchRelationReviewQueue, fetchIndexCard, updateIndexCard, fetchDirectoryNotes, fetchAiProviderConfigs, fetchAiPreferences, fetchAppVersion, fetchMobileDesktopAccessStatus, fetchOllamaModels, fetchOllamaBootstrapStatus, bootstrapOllamaLocalAi, pullOllamaModel, startOllamaRuntime, stopOllamaRuntime, listIndexCards, fetchNote, fetchNoteRelations, searchNotes, createNoteRelation, fetchWritingProject, listProjectDraftVersions, listProjectScaffolds, listWritingProjects, restoreEncryptedVaultBackup, setWritingCurrentDraftNote, syncWritingProject, updateWritingProjectBookStructure, updateDraftNoteVersionNote, updateDraftScaffold, updateDraftScaffoldVersionNote, fetchVaultInfo, rotateMobilePairingCode, saveAiPreferences, saveAiProviderConfig, runAiTestChat, getApiBase, moveNote, previewAiRoute, previewImport, promoteAiInboxNote, recordAiInboxDecision, revokeMobileDevice, summarizeAiInboxItem, seedSmartNotesProductThinkingDemo, runDueAiScheduledTasks, saveAiScheduledTask, switchVault, updateDirectory, updateAiScheduledTaskStatus, updateAiScheduledTaskStatusWithOptions, updateAiSuggestion, updateNote, updatePermanentNoteDistillation, adoptAiInboxFieldSuggestion, apiConnectionErrorMessage, isApiConnectionError, resetDesktopServiceStatusCache } from "./prototype-api.js";

const $ = (id) => document.getElementById(id);
const state = createInitialState();
let usingLocalFallbackData = false;
let lastChosenPermanentDirectoryId = "dir_original_default";
let graphModuleActivationGuardUntil = 0;
state.literatureQueueFocusNoteIds = [];
state.literatureQueueFocusLabel = "";
state.graphConnectivityReady = false;
state.graphVisibleNoteIdsReady = false;
const importState = {
  importRecordId: "",
  directoryId: "dir_original_default",
  lastPreview: null,
  lastResultPayload: null,
  activeTab: "import",
  literatureBatchSummary: null,
  selectionImportRecordId: "",
  selectedCandidateIds: new Set(),
  resultFocusReason: ""
};
const graphState = {
  item: null,
  lastLoadedDirectoryId: "",
  lastLoadedAt: "",
  conflicts: null,
  reviewQueue: null,
  aiAnalysis: null,
  aiAnalysisLoading: false,
  aiAnalysisError: "",
  aiReviewSystemMessageId: "",
  loading: false,
  error: "",
  lastErrorAt: "",
  requestSerial: 0,
  filters: {
    relationType: normalizeGraphRelationTypeFilter(readStoredText(GRAPH_RELATION_TYPE_FILTER_KEY, "meaningful"), "meaningful"),
    status: "all"
  },
  focusDepth: normalizeGraphFocusDepth(readStoredText(GRAPH_FOCUS_DEPTH_KEY, "1"), "1"),
  focusContextMode: normalizeGraphFocusContextMode(readStoredText(GRAPH_FOCUS_CONTEXT_MODE_KEY, "argument"), "argument"),
  focusContextCollapsed: false,
  zoom: "fit",
  expanded: false,
  researchNavigatorHidden: true,
  researchNavigatorTouched: true,
  workbenchPanelOpen: false,
  workbenchPanelTab: "clues",
  thinkingPanelOpen: false,
  thinkingPanelVisible: true,
  thinkingFilter: "all",
  readingLens: "insight",
  densityHintKey: "",
  densityHintVisibleUntil: 0,
  densityHintTimer: 0,
  canvasHelpHintDismissed: false,
  canvasHelpHintVisibleUntil: 0,
  canvasHelpHintTimer: 0,
  selection: null,
  isolatedWorkflowTabsByNoteId: {},
  isolatedRelationDraftByNoteId: {},
  isolatedRelationSaveResultByNoteId: {},
  relationAdjustmentFocusById: {},
  utilityDrawerOpen: false,
  utilityDrawerVisible: true,
  utilityDrawerPosition: null,
  sectionOpen: {
    "bridge-gaps": false,
    "review-queue": false,
    "ai-analysis": false
  }
};
function setGraphRelationTypeFilter(value = "", options = {}) {
  return setGraphRelationTypeFilterForRuntime(graphState, value, {
    ...options,
    writeStoredText
  });
}
function graphStructureFallbackEdges(edges = [], filters = {}) { return graphStructureFallbackEdgesForRuntime(edges, filters, { graphEdgeMatchesFilters }); }
function renderGraphRelationTypeFilter(edges = [], selected = "meaningful", compact = false, statsOverride = null) { return renderGraphRelationTypeFilterForRuntime(edges, selected, compact, statsOverride, { escapeHtml, graphFilterOptions, graphRelationTypeLabel }); }
function renderGraphViewModeSwitcher(relationType = "meaningful", activeLens = "insight") { return renderGraphViewModeSwitcherForRuntime(relationType, activeLens, { escapeHtml }); }
setGraphRelationTypeFilter(graphState.filters?.relationType, { persist: false });
const graphViewportController = createGraphViewportController({
  graphState,
  documentRef: document,
  graphZoomOption
});
const {
  graphViewportDragState,
  centerGraphViewportIfZoomed,
  beginGraphViewportDrag,
  updateGraphViewportDrag,
  endGraphViewportDrag
} = graphViewportController;
const graphUtilityDrawerController = createGraphUtilityDrawerController({
  graphState,
  rootProvider: () => $("graphCanvas")
});
const {
  graphUtilityDrawerDragState,
  applyGraphUtilityDrawerPosition,
  beginGraphUtilityDrawerDrag,
  updateGraphUtilityDrawerDrag,
  endGraphUtilityDrawerDrag
} = graphUtilityDrawerController;
const graphPresentationController = createGraphPresentationController({
  graphState,
  windowRef: window,
  isGraphModule: () => state.module === "graph",
  renderGraphPanel,
  setRelationTypeFilter: setGraphRelationTypeFilter
});
const {
  syncGraphDisclosureState,
  clearGraphDensityHintTimer,
  scheduleGraphDensityHintDismiss,
  shouldShowGraphDensityHint,
  shouldShowGraphCanvasHelpHint,
  dismissGraphCanvasHelpHint,
  prepareGraphEntryPresentationState,
  resetGraphDemoPresentationState
} = graphPresentationController;
const distillationState = {
  filter: "all"
};
const aiInboxState = {
  items: [],
  counts: { pending: 0, reviewed: 0, archived: 0, all: 0 },
  views: [],
  filters: {
    view: "pending",
    type: "all",
    sourceNoteId: "",
    limit: 50
  },
  selectedArtifactId: "",
  detail: null,
  detailArtifactId: "",
  loading: false,
  detailLoading: false,
  evaluationLoading: false,
  actionLoading: false,
  error: "",
  detailError: "",
  actionArtifactId: "",
  actionSuggestionId: "",
  actionError: "",
  actionNoticeArtifactId: "",
  actionNoticeSuggestionId: "",
  actionNotice: "",
  actionNoticeTone: "",
  evaluationError: "",
  evaluationSummary: null,
  detailRequestToken: 0,
  evaluationRequestToken: 0,
  aiSummary: "",
  aiSummaryArtifactId: "",
  aiSummarySuggestionId: "",
  aiSummaryMeta: "",
  aiSummaryRecommendedAction: "",
  aiSummaryLoading: false,
  aiSummaryError: "",
  aiSummaryRequestToken: 0
};
const settingsState = {
  activeSection: "workspace",
  activeItem: "mobile-access",
  vault: null,
  noteTemplates: {
    permanent: {
      panelOpen: false,
      scope: "",
      text: "",
      draftText: "",
      draftActive: false,
      history: [],
      feedbackTone: "",
      feedbackText: ""
    },
    literature: {
      panelOpen: false,
      scope: "",
      text: "",
      draftText: "",
      draftActive: false,
      history: [],
      feedbackTone: "",
      feedbackText: ""
    }
  },
  update: createUpdateState(),
  mobileAccess: {
    item: null,
    loading: false,
    actionLoading: "",
    error: "",
    lastLoadedAt: ""
  },
  ai: {
    runtimeMode: "auto",
    userMode: "Auto",
    modelPack: "Starter Auto",
    advancedModelRef: "",
    secretRef: "",
    remoteApiKey: "",
    providerEndpointUrl: "",
    providerHealthEndpointUrl: "",
    remoteRuntimeModel: "",
    providerDraftTouched: {
      secretRef: false,
      providerEndpointUrl: false,
      providerHealthEndpointUrl: false,
      remoteRuntimeModel: false
    },
    localModel: "",
    localRuntimeStatus: "unknown",
    localRuntimeModels: [],
    localRuntimeModelTiers: [],
    localRuntimeReadinessStatus: "unknown",
    localRuntimeDefaultModelInstalled: false,
    localRuntimeApiReachable: false,
    localRuntimeManagedStopPending: false,
    localRuntimeSetupGuide: null,
    localRuntimeChatEndpointUrl: "",
    localRuntimeHealthEndpointUrl: "",
    localRuntimeChecking: false,
    localRuntimeStarting: false,
    localRuntimeStopping: false,
    localRuntimePulling: false,
    localRuntimeError: "",
    localAiSetupSyncPending: false,
    autoPrepareLocalAi: false,
    providerConfigs: [],
    providerConfigSaving: false,
    providerHealthChecking: false,
    providerHealthResult: null,
    providerConfigError: "",
    routePreview: null,
    routePreviewLoading: false,
    routePreviewError: "",
    testPrompt: "",
    testRunning: false,
    testMeta: "",
    testOutput: "",
    testModel: "",
    testProviderId: "",
    testEndpointUrl: "",
    testRemoteModel: "",
    testSecretRef: "",
    suggestions: [],
    suggestionsTotal: 0,
    suggestionFilters: {
      status: "all",
      targetType: "",
      targetId: "",
      scope: "",
      limit: 50
    },
    selectedSuggestionId: "",
    suggestionDetail: null,
    suggestionDetailSuggestionId: "",
    suggestionDetailRequestToken: 0,
    suggestionDetailLoading: false,
    suggestionsLoading: false,
    suggestionActionLoading: false,
    suggestionActionSuggestionId: "",
    suggestionActionNoticeSuggestionId: "",
    suggestionActionNotice: "",
    suggestionActionNoticeTone: "",
    suggestionsError: "",
    suggestionDetailError: "",
    suggestionActionError: "",
    scheduledTasks: [],
    scheduledTasksTotal: 0,
    scheduledTaskTemplates: [],
    scheduledTaskTemplatesLoading: false,
    scheduledTaskTemplatesError: "",
    scheduledTaskForm: scheduledTaskFormDefaults(),
    scheduledTaskFormOpen: false,
    scheduledTaskFilters: {
      status: "all",
      taskType: "all",
      limit: 50
    },
    scheduledTasksLoading: false,
    scheduledTaskActionLoading: false,
    scheduledTasksError: "",
    scheduledTaskRunSummary: null,
    debugSnapshots: {
      inboxList: null,
      inboxDetail: null,
      inboxDecision: null,
      suggestionsList: null,
      suggestionDetail: null,
      suggestionDecision: null,
      scheduledTasksList: null,
      scheduledTaskAction: null
    }
  },
  error: ""
};
const settingsPanelRuntimeRoutes = createSettingsPanelRuntimeRoutes(() => ({
  $,
  document,
  state,
  settingsState,
  appVersion: APP_VERSION,
  syncRailSelectionState,
  mountSettingsAutomationWorkspace,
  renderUpdateSettingsCard,
  renderMobileAccessSettingsCard,
  renderNoteTemplateSettingsCard,
  renderAiLocalModelControls,
  renderAiSettingsExperience,
  renderAiProviderConfigControls,
  renderAiRoutePreview,
  renderScheduledTasksWorkspace,
  renderAiSuggestionsWorkspace,
  aiTestBlockedReason,
  renderAiCanonicalDebugPanel,
  renderImportPageShell,
  renderSidebarTitle,
  renderModuleWorkspaceHeader,
  escapeHtml,
  setStatus
}));

const {
  ensureSettingsWorkbenchLayout,
  filterSettingsSidebarMenu,
  formatSettingsUserError,
  renderSettingsDetailFocus,
  renderSettingsPanel,
  renderSettingsSidebarColumn,
  renderSettingsWorkbenchChrome,
  setSettingsItem,
  setSettingsSection,
  settingsAiAdvancedRuntimeModeLabel,
  settingsAiModelPackDisplayLabel,
  settingsAiOverviewSummary,
  settingsAiProviderDisplayLabel,
  settingsAiRuntimeModeLabel,
  settingsAiUserModeDisplayLabel,
  settingsItemSummary,
  settingsLeafLabel,
  settingsMobileItemOptionsHtml,
  settingsModuleHeaderCopy,
  settingsPanelRuntimeDeps,
  settingsSectionChromeMap,
  settingsSectionGuidanceMap,
  settingsSidebarNavigationHtml,
  settingsVaultPathMissing
} = settingsPanelRuntimeRoutes;

const writingState = {
  project: null,
  scaffold: null,
  scaffoldMarkdown: "",
  outlineSaveQueue: null,
  draftMarkdown: "",
  draftSaveState: "idle",
  relationCounts: {},
  relationCountErrors: {},
  loadingRelationCounts: false,
  relationCountRequestSerial: 0,
  themeNoteDetailIds: [],
  loadingThemeNoteDetails: false,
  themeNoteDetailRequestSerial: 0,
  themeRelationNoteIds: [],
  themeRelationCounts: {},
  themeRelationCountErrors: {},
  loadingThemeRelationCounts: false,
  themeRelationCountRequestSerial: 0,
  sourceIndexIds: [],
  focusedCandidateNoteIds: [],
  focusedCandidateScopeLabel: "",
  selectedThemeIndexId: "",
  themeIndexes: [],
  loadingThemeIndexes: false,
  themeDiscoverySuggestions: [],
  ignoredThemeDiscoverySuggestionKeys: [],
  themeDiscoveryLoading: false,
  projects: [],
  projectFilters: {
    q: "",
    status: "all",
    hasDraft: "all"
  },
  loadingProjects: false,
  scaffoldVersions: [],
  loadingScaffoldVersions: false,
  draftVersions: [],
  loadingDraftVersions: false,
  strongModelEpoch: 0,
  strongModelRunId: 0,
  strongModelLoading: false,
  strongModelResult: null,
  strongModelError: "",
  strongModelRevision: 0,
  localBookIdeas: [],
  localBookIdeasGeneratedAt: ""
};

const todayOrganizingEntryRuntime = createTodayOrganizingEntryRuntime(() => ({
  $,
  state,
  graphState,
  writingState,
  importState,
  currentVaultPath,
  loadWritingThemeIndexes,
  typeFromFolder,
  relationNetworkStatusForNote,
  handleStateChange,
  activateModule,
  openNoteById,
  openWritingModule,
    addWritingBasketIds,
    selectWritingThemeIndex,
    createReviewOutline: createReviewOutlineFromTodayChecklist,
    applyWritingTab: (tab) => applyWritingTab(tab, { root: $("writingPanel")?.querySelector?.(".writing-shell"), documentRef: document }),
    markTodayReturnTarget,
    setStatus
  }));
const todayOrganizingRuntime = todayOrganizingEntryRuntime.runtime;
const desktopCommands = createDesktopFileCommandService({ switchVaultImpl: switchVault });
let statusRevision = 0;
let statusHoldUntil = 0;
let statusHoldPriority = 0;
let editorHelperDismissed = false;
const EDITOR_HELPER_MUTE_KEY = "yansilu:editor-helper-muted";
let editorHelperMuted = readStoredBoolean(EDITOR_HELPER_MUTE_KEY);
let saveAiSuggestion = null;
const dismissedSaveAiSuggestionKeys = new Set();
const SYSTEM_MESSAGES_KEY = "yansilu:system-messages:v1";
const SYSTEM_MESSAGES_LIMIT = 80;
let systemMessages = readStoredSystemMessages();
let selectedSystemMessageId = systemMessages[0]?.id || "";
let todayReturnTarget = null;
let startupAutoOpenSuppressed = false;
const FEEDBACK_EMAIL = "lidiansen58@gmail.com";
const APP_VERSION = "0.1.1-beta.1";
const UPDATE_SETTINGS_KEY = "yansilu:update:settings:v1";
const UPDATE_LAST_RESULT_KEY = "yansilu:update:last-result:v1";
const AI_RUNTIME_MODE_KEY = "yansilu:ai:runtime-mode";
const AI_USER_MODE_KEY = "yansilu:ai:user-mode";
const AI_MODEL_PACK_KEY = "yansilu:ai:model-pack";
const AI_ADVANCED_MODEL_REF_KEY = "yansilu:ai:advanced-model-ref";
const AI_SECRET_REF_KEY = "yansilu:ai:secret-ref";
const AI_REMOTE_API_KEY_KEY = "yansilu:ai:remote-api-key";
const AI_PROVIDER_ENDPOINT_URL_KEY = "yansilu:ai:provider-endpoint-url";
const AI_PROVIDER_HEALTH_ENDPOINT_URL_KEY = "yansilu:ai:provider-health-endpoint-url";
const AI_REMOTE_RUNTIME_MODEL_KEY = "yansilu:ai:remote-runtime-model";
const AI_LOCAL_MODEL_KEY = "yansilu:ai:local-model";
const AI_LOCAL_SETUP_SYNC_PENDING_KEY = "yansilu:ai:local-setup-sync-pending";
const AI_AUTO_PREPARE_LOCAL_KEY = "yansilu:ai:auto-prepare-local";
const AI_TEST_STATUS_KEY = "yansilu:ai:test-status";
const AI_TEST_META_KEY = "yansilu:ai:test-meta";
const AI_TEST_OUTPUT_KEY = "yansilu:ai:test-output";
const AI_TEST_MODEL_KEY = "yansilu:ai:test-model";
const AI_TEST_PROVIDER_ID_KEY = "yansilu:ai:test-provider-id";
const AI_TEST_ENDPOINT_URL_KEY = "yansilu:ai:test-endpoint-url";
const AI_TEST_REMOTE_MODEL_KEY = "yansilu:ai:test-remote-model";
const AI_TEST_SECRET_REF_KEY = "yansilu:ai:test-secret-ref";
const GRAPH_ORIGINAL_SCOPE_DIRECTORY_ID = "dir_original_default";

function markTodayReturnTarget(target = {}) {
  todayReturnTarget = {
    label: String(target.label || "首页").trim() || "首页",
    createdAt: Date.now()
  };
}

function clearTodayReturnTarget() {
  todayReturnTarget = null;
}

function desktopUpdateRestartBlockers() {
  const blockers = [];
  if (graphState.loading || graphState.aiAnalysisLoading) blockers.push("图谱或建联流程仍在处理中");
  if (writingState.strongModelLoading || writingState.loadingProjects || writingState.loadingScaffoldVersions || writingState.loadingDraftVersions) {
    blockers.push("写作流程仍在处理中");
  }
  if (writingState.loadingRelationCounts || writingState.loadingThemeRelationCounts || writingState.loadingThemeNoteDetails) {
    blockers.push("写作素材关系仍在整理中");
  }
  return blockers;
}

const updateController = createPrototypeUpdateController({
  settingsState,
  readStoredText,
  writeStoredText,
  updateSettingsKey: UPDATE_SETTINGS_KEY,
  updateLastResultKey: UPDATE_LAST_RESULT_KEY,
  appVersion: APP_VERSION,
  fetchAppVersion,
  checkAppUpdate,
  renderSettingsPanel,
  renderSystemMessages: (...args) => renderSystemMessages(...args),
  setStatus,
  upsertSystemMessage,
  desktopCommands,
  getDirtyTabCount: () => typeof editor?.dirtyTabs === "function" ? editor.dirtyTabs().length : 0,
  getRestartBlockers: desktopUpdateRestartBlockers
});
updateController.loadUpdateSettingsFromStorage();

let mobileAccessRefreshTimer = 0;
let mobileAccessAutoRefreshQueued = false;
let mobileAccessAutoRefreshAfterErrorAttempted = false;

function mobileAccessErrorMessage(error) {
  return readableMobileAccessError(error?.message || error);
}

function isMobileAccessSettingsActive() {
  return state.module === "settings" && settingsState.activeItem === "mobile-access";
}

function clearMobileAccessRefreshTimer() {
  if (mobileAccessRefreshTimer && typeof window !== "undefined") {
    window.clearTimeout(mobileAccessRefreshTimer);
  }
  mobileAccessRefreshTimer = 0;
}

function scheduleMobileAccessRefresh() {
  clearMobileAccessRefreshTimer();
  if (!isMobileAccessSettingsActive() || typeof window === "undefined") return;
  mobileAccessRefreshTimer = window.setTimeout(() => {
    mobileAccessRefreshTimer = 0;
    refreshMobileAccessStatus({ silent: true });
  }, 2500);
}

function renderMobileAccessSettingsCard() {
  const mount = $("settingsMobileAccessPanel");
  if (!mount) return;
  if (!isMobileAccessSettingsActive()) clearMobileAccessRefreshTimer();
  if (
    shouldAutoRefreshMobileAccess({
      active: isMobileAccessSettingsActive(),
      item: settingsState.mobileAccess.item,
      loading: settingsState.mobileAccess.loading,
      refreshTimer: mobileAccessRefreshTimer,
      autoRefreshQueued: mobileAccessAutoRefreshQueued,
      error: settingsState.mobileAccess.error,
      attemptedAfterError: mobileAccessAutoRefreshAfterErrorAttempted
    })
  ) {
    prepareMobileAccessAutoRefreshState(settingsState.mobileAccess);
    mobileAccessAutoRefreshQueued = true;
    window.setTimeout(() => {
      mobileAccessAutoRefreshQueued = false;
      if (
        isMobileAccessSettingsActive() &&
        !settingsState.mobileAccess.item
      ) {
        refreshMobileAccessStatus({ silent: true });
      }
    }, 0);
  }
  mount.innerHTML = renderMobileAccessDesktopPanel({
    state: settingsState.mobileAccess,
    escapeHtml
  });
}

async function refreshMobileAccessStatus({ silent = false } = {}) {
  const hadItemBeforeRefresh = Boolean(settingsState.mobileAccess.item);
  settingsState.mobileAccess.loading = true;
  settingsState.mobileAccess.error = "";
  if (!silent) renderMobileAccessSettingsCard();
  try {
    const previousAccessUrl = String(settingsState.mobileAccess.item?.accessUrl || "").trim();
    resetDesktopServiceStatusCache();
    const nextItem = await fetchMobileDesktopAccessStatus();
    settingsState.mobileAccess.item = nextItem;
    mobileAccessAutoRefreshAfterErrorAttempted = false;
    const nextAccessUrl = String(nextItem?.accessUrl || "").trim();
    if (previousAccessUrl && nextAccessUrl && previousAccessUrl !== nextAccessUrl) {
      setStatus("网络已切换，二维码已更新，请重新扫描。", "ok");
    }
    settingsState.mobileAccess.lastLoadedAt = new Date().toISOString();
  } catch (error) {
    settingsState.mobileAccess.error = mobileAccessErrorMessage(error);
    mobileAccessAutoRefreshAfterErrorAttempted = true;
  } finally {
    settingsState.mobileAccess.loading = false;
    const activeAfterRefresh = isMobileAccessSettingsActive();
    if (activeAfterRefresh) scheduleMobileAccessRefresh();
    if (shouldPromoteMobileAccessRefreshRender({
      active: activeAfterRefresh,
      hadItemBeforeRefresh,
      item: settingsState.mobileAccess.item
    })) {
      renderSettingsPanel();
    } else if (state.module === "settings") {
      renderMobileAccessSettingsCard();
    }
  }
}

async function rotateMobileAccessPairingCodeFromUi() {
  settingsState.mobileAccess.actionLoading = "rotate";
  settingsState.mobileAccess.error = "";
  renderMobileAccessSettingsCard();
  try {
    await rotateMobilePairingCode();
    await refreshMobileAccessStatus({ silent: true });
    setStatus("已刷新手机访问二维码和配对码。", "ok");
  } catch (error) {
    const message = mobileAccessErrorMessage(error);
    settingsState.mobileAccess.error = message;
    setStatus(`刷新手机配对码失败：${message}`, "bad");
  } finally {
    settingsState.mobileAccess.actionLoading = "";
    renderMobileAccessSettingsCard();
  }
}

async function confirmMobilePairRequestFromUi(requestId = "") {
  const cleanRequestId = String(requestId || "").trim();
  if (!cleanRequestId) return;
  settingsState.mobileAccess.actionLoading = cleanRequestId;
  settingsState.mobileAccess.error = "";
  renderMobileAccessSettingsCard();
  try {
    await confirmMobilePairRequest(cleanRequestId);
    await refreshMobileAccessStatus({ silent: true });
    setStatus("已允许这台手机访问电脑上的研思录。", "ok");
  } catch (error) {
    const message = mobileAccessErrorMessage(error);
    settingsState.mobileAccess.error = message;
    setStatus(`确认手机连接失败：${message}`, "bad");
  } finally {
    settingsState.mobileAccess.actionLoading = "";
    renderMobileAccessSettingsCard();
  }
}

async function revokeMobileDeviceFromUi(deviceId = "") {
  const cleanDeviceId = String(deviceId || "").trim();
  if (!cleanDeviceId) return;
  settingsState.mobileAccess.actionLoading = cleanDeviceId;
  settingsState.mobileAccess.error = "";
  renderMobileAccessSettingsCard();
  try {
    await revokeMobileDevice(cleanDeviceId);
    await refreshMobileAccessStatus({ silent: true });
    setStatus("已撤销这台手机的访问权限。", "ok");
  } catch (error) {
    const message = mobileAccessErrorMessage(error);
    settingsState.mobileAccess.error = message;
    setStatus(`撤销手机访问失败：${message}`, "bad");
  } finally {
    settingsState.mobileAccess.actionLoading = "";
    renderMobileAccessSettingsCard();
  }
}

installStartupAutoOpenEventBindings({
  documentRef: typeof document !== "undefined" ? document : null,
  suppressStartupAutoOpen: () => {
    startupAutoOpenSuppressed = true;
  }
});

function activePrototypeUrl() {
  if (typeof window === "undefined") return "/app";
  return window.location.href || `${window.location.origin}/app`;
}

function feedbackSystemLabel() {
  const userAgent = typeof navigator !== "undefined" ? String(navigator.userAgent || "") : "";
  if (/Windows/i.test(userAgent)) return "Windows";
  if (/Macintosh|Mac OS X/i.test(userAgent)) return "macOS";
  if (/Linux/i.test(userAgent)) return "Linux";
  return typeof navigator !== "undefined" ? String(navigator.platform || "未知系统") : "未知系统";
}

function buildFeedbackMailtoUrl() {
  const bodyLines = [
    "反馈类型：问题",
    `软件版本：${APP_VERSION}`,
    `操作系统：${feedbackSystemLabel()}`,
    `当前模块：${moduleLabel(state.module)}`,
    `当前页面：${activePrototypeUrl()}`,
    "",
    "请描述遇到的情况：",
    "",
    "为保护隐私，请不要附上笔记内容、笔记路径、备份文件或 API 密钥。"
  ];
  const query = new URLSearchParams({
    subject: "[研思录反馈] 问题",
    body: bodyLines.join("\n")
  });
  return `mailto:${FEEDBACK_EMAIL}?${query.toString()}`;
}

async function openFeedbackMailtoUrl(url = "") {
  const result = await desktopCommands.openExternalUrl(url);
  return Boolean(result?.ok);
}

const noteRuntimeController = createNoteRuntimeController(() => ({
  editor,
  ensureEditableNoteBody,
  fetchNote,
  initialBodyForFolder,
  isEmptyUntitledMarkdown,
  isLocalOnlyNote,
  isUntitledTitle,
  mapNoteItem,
  normalizeAuthorshipItem,
  normalizeDraftBuffer,
  normalizeNoteTemplateHistory,
  normalizeOptionalNumber,
  normalizeStoredNoteTemplateSource,
  normalizeThinkingStatusItem,
  normalizedDefaultUntitledBody,
  noteTabFor,
  noteTemplateStorageKey,
  noteTemplateStorageScope,
  parseLinks,
  parseTags,
  readStoredRelationNetworkStatus,
  readStoredText,
  setStatus,
  settingsState,
  state,
  typeFromFolder,
  updateNote,
  writeStoredRelationNetworkStatus,
  writeStoredText
}));
function noteGeneratedOriginalNoteId(note = null) { return noteRuntimeController.noteGeneratedOriginalNoteId(note); }
function noteHasGeneratedOriginal(note = null) { return noteRuntimeController.noteHasGeneratedOriginal(note); }
function relationNetworkStatusForNote(note = null, options = {}) { return noteRuntimeController.relationNetworkStatusForNote(note, options); }
function syncNoteRelationNetworkStatus(note = null, options = {}) { return noteRuntimeController.syncNoteRelationNetworkStatus(note, options); }
function syncAllNoteRelationNetworkStatuses(options = {}) { return noteRuntimeController.syncAllNoteRelationNetworkStatuses(options); }
function isOriginalRecordableSource(note = null) {
  const noteType = String((note?.folderId ? typeFromFolder(state, note.folderId) : "") || note?.noteType || "").trim().toLowerCase();
  return noteType === "fleeting" || noteType === "literature";
}

function setStatus(text, cls = "", options = {}) {
  const requiredRevision = Number(options?.skipIfStaleSince || 0);
  if (requiredRevision && statusRevision !== requiredRevision) return false;
  const requiredModule = String(options?.requireModule || "").trim();
  if (requiredModule && state.module !== requiredModule) return false;
  const now = Date.now();
  const incomingTone = String(cls || "").trim().toLowerCase();
  const incomingPriority = Math.max(
    Number(options?.priority || 0) || 0,
    incomingTone === "bad" ? 4 : incomingTone === "warn" ? 3 : 0
  );
  const force = options?.force === true;
  if (!force && now < statusHoldUntil && incomingPriority < statusHoldPriority) return false;
  statusRevision += 1;
  $("statusText").className = `status-pill ${cls}`.trim();
  $("statusText").textContent = text;
  const statusBar = $("statusBar");
  if (statusBar) statusBar.dataset.tone = cls || "";
  const holdMs = Math.max(0, Number(options?.holdMs || 0) || 0);
  if (holdMs > 0) {
    statusHoldUntil = now + holdMs;
    statusHoldPriority = incomingPriority;
  } else if (force || now >= statusHoldUntil || incomingPriority >= statusHoldPriority) {
    statusHoldUntil = 0;
    statusHoldPriority = 0;
  }
  return true;
}

function readStoredSystemMessages() {
  return readStoredSystemMessagesForRuntime({
    storage: window.localStorage,
    key: SYSTEM_MESSAGES_KEY,
    limit: SYSTEM_MESSAGES_LIMIT,
    normalizeSystemMessage
  });
}

function persistSystemMessages() {
  return persistSystemMessagesForRuntime(systemMessages, {
    storage: window.localStorage,
    key: SYSTEM_MESSAGES_KEY,
    limit: SYSTEM_MESSAGES_LIMIT
  });
}

const systemMessagesShellController = createSystemMessagesShellController({
  hostProvider: createSystemMessagesPrototypeHostProvider(() => ({
    $,
    document,
    getMessagesRef: () => systemMessages,
    getSelectedMessageIdRef: () => selectedSystemMessageId,
    setSelectedMessageIdRef: (messageId = "") => {
      selectedSystemMessageId = messageId;
    },
    notes: state.notes,
    escapeHtml,
    hideEditorHelper,
    renderSystemMessages
  }))
});
const {
  renderSystemMessages,
  openSystemMessages,
  closeSystemMessages,
  isSystemMessageModalOpen
} = systemMessagesShellController;

const systemMessageDepsProviders = createSystemMessagePrototypeDepsProviders(() => ({
  getMessagesRef: () => systemMessages,
  setMessagesRef: (messages = []) => {
    systemMessages = messages;
  },
  getSelectedMessageIdRef: () => selectedSystemMessageId,
  setSelectedMessageIdRef: (messageId = "") => {
    selectedSystemMessageId = messageId;
  },
  markSystemMessageRead,
  persistSystemMessages,
  renderSystemMessages,
  openSystemMessages,
  closeSystemMessages,
  isSystemMessageModalOpen,
  systemMessageActionRoute,
  aiInboxFiltersForSystemMessage,
  globalPendingAiInboxFilters,
  setAiInboxFilters: (filters) => {
    aiInboxState.filters = filters;
  },
  resetAiInboxDetail: () => {
    aiInboxState.detail = null;
    aiInboxState.selectedArtifactId = "";
  },
  activateModule,
  openAiInboxModule,
  setSettingsItem,
  openNoteById,
  openSystemMessageWorkflow,
  setStatus,
  normalizeSystemMessage,
  upsertSystemMessageList,
  limit: SYSTEM_MESSAGES_LIMIT
}));
const {
  eventDeps: systemMessageEventDeps,
  runtimeDeps: systemMessagesRuntimeDeps
} = systemMessageDepsProviders;
function markSystemMessagesRead() { return markSystemMessagesReadForRuntime(systemMessagesRuntimeDeps()); }
function addSystemMessage(message = {}, { interrupt = false } = {}) { return addSystemMessageForRuntime(message, { interrupt }, systemMessagesRuntimeDeps()); }
function upsertSystemMessage(message = {}, { interrupt = false, preserveRead = true } = {}) { return upsertSystemMessageForRuntime(message, { interrupt, preserveRead }, systemMessagesRuntimeDeps()); }
function resolveSystemMessageByDedupeKey(dedupeKey = "") { return resolveSystemMessageByDedupeKeyForRuntime(dedupeKey, systemMessagesRuntimeDeps()); }
function scheduledTaskReviewArtifactCount(summary = {}) {
  return (Array.isArray(summary?.runs) ? summary.runs : []).reduce((total, run) => {
    const result = run?.result || {};
    const artifacts = Array.isArray(result.artifacts) ? result.artifacts.length : 0;
    const storedIds = Array.isArray(result.reviewItems?.storedArtifactIds) ? result.reviewItems.storedArtifactIds.length : 0;
    const reviewArtifacts = Array.isArray(result.reviewItems?.artifacts) ? result.reviewItems.artifacts.length : 0;
    return total + Math.max(artifacts, storedIds, reviewArtifacts);
  }, 0);
}

function readStoredBoolean(key, fallback = false) {
  try {
    const raw = window.localStorage?.getItem(String(key || ""));
    if (raw === "1") return true;
    if (raw === "0") return false;
  } catch {}
  return fallback;
}

function writeStoredBoolean(key, value) {
  try {
    window.localStorage?.setItem(String(key || ""), value ? "1" : "0");
  } catch {}
}

function readStoredText(key, fallback = "") {
  try {
    const raw = window.localStorage?.getItem(String(key || ""));
    if (raw === null || raw === undefined) return fallback;
    return String(raw);
  } catch {}
  return fallback;
}

function writeStoredText(key, value) {
  try {
    const clean = String(value ?? "");
    if (!clean) window.localStorage?.removeItem(String(key || ""));
    else window.localStorage?.setItem(String(key || ""), clean);
  } catch {}
}

function defaultLiteratureTemplateSource(title = "{{title}}") { return computeDefaultLiteratureTemplateSource(title); }

function currentLiteratureTemplateSectionLabels() { return deriveLiteratureSectionLabelsFromTemplate(effectiveSavedNoteTemplateSource("literature")); }

function literatureTemplateSectionLabelCandidates() {
  return [
    currentLiteratureTemplateSectionLabels(),
    ...normalizeNoteTemplateHistory(settingsState.noteTemplates.literature.history, "literature").map((template) =>
      deriveLiteratureSectionLabelsFromTemplate(template)
    )
  ];
}
function defaultPermanentTemplateSource(title = "{{title}}") { return computeDefaultPermanentTemplateSource(title); }
function legacyPermanentTemplateSource(title = "{{title}}") { return computeLegacyPermanentTemplateSource(title); }
function defaultTemplateSourceForKind(kind = "") { return computeDefaultTemplateSourceForKind(kind); }
function normalizeNoteTemplateSource(text = "", kind = "") { return computeNormalizeNoteTemplateSource(text, kind); }
function normalizeStoredNoteTemplateSource(text = "", kind = "") { return computeNormalizeStoredNoteTemplateSource(text, kind); }
function effectiveSavedNoteTemplateSource(kind = "") {
  const cleanKind = String(kind || "").trim().toLowerCase() === "literature" ? "literature" : "permanent";
  const savedSource = normalizeStoredNoteTemplateSource(settingsState.noteTemplates[cleanKind]?.text, cleanKind);
  if (cleanKind !== "literature") return savedSource;
  const validation = validateLiteratureTemplateSource(savedSource);
  return validation.ok ? savedSource : defaultTemplateSourceForKind(cleanKind);
}
function normalizeNoteTemplateHistory(items = [], kind = "") { return computeNormalizeNoteTemplateHistory(items, kind); }
function noteTemplateStorageScope(vaultPath = "") { return settingsNoteTemplateRuntime.noteTemplateStorageScope(vaultPath); }
function noteTemplateStorageKey(kind = "", options = {}) { return settingsNoteTemplateRuntime.noteTemplateStorageKey(kind, options); }
function noteTemplateHistoryWithPrevious(history = [], previousText = "", kind = "") { return computeNoteTemplateHistoryWithPrevious(history, previousText, kind); }
function normalizeDraftBuffer(text = "") { return computeNormalizeDraftBuffer(text); }
function applyTitleToNoteTemplate(templateSource = "", title = "未命名笔记", kind = "") { return computeApplyTitleToNoteTemplate(templateSource, title, kind, { ensureEditableNoteBody }); }
function mergeTemplateFieldText(base = "", addition = "") { return computeMergeTemplateFieldText(base, addition); }
function composePermanentTemplateDraft(fields = {}) { return computeComposePermanentTemplateDraft(fields, { permanentNoteTemplateBody }); }
const settingsNoteTemplateRuntime = createSettingsNoteTemplateRuntime({
  $,
  NOTE_TEMPLATE_STORAGE_KEYS,
  LITERATURE_TEMPLATE_SETTINGS_FIELDS,
  PERMANENT_TEMPLATE_SETTINGS_FIELDS,
  applyTitleToNoteTemplate,
  currentVaultPath,
  defaultTemplateSourceForKind,
  escapeHtml,
  normalizeDraftBuffer,
  normalizeNoteTemplateHistory,
  normalizeNoteTemplateSource,
  normalizeStoredNoteTemplateSource,
  noteTemplateHistoryWithPrevious,
  renderSettingsPanel,
  renderTemplateMarkdownPreviewHtml,
  settingsState,
  setStatus,
  validateLiteratureTemplateSource,
  writeStoredText
});

function loadNoteTemplateSettingsFromStorage() { return noteRuntimeController.loadNoteTemplateSettingsFromStorage(); }

function persistNoteTemplateSettingsToStorage() { return settingsNoteTemplateRuntime.persistNoteTemplateSettingsToStorage(); }

const NOTE_RELATION_STATUS_KEY_PREFIX = "yansilu.noteRelationStatus.";

function noteRelationStatusStorageKey(noteId = "") {
  const cleanId = String(noteId || "").trim();
  return cleanId ? `${NOTE_RELATION_STATUS_KEY_PREFIX}${cleanId}` : "";
}

function readStoredRelationNetworkStatus(noteId = "") {
  const key = noteRelationStatusStorageKey(noteId);
  if (!key) return "";
  const value = String(readStoredText(key, "") || "").trim().toLowerCase();
  return isPersistableRelationNetworkStatus(value) ? value : "";
}

function writeStoredRelationNetworkStatus(noteId = "", status = "") {
  const key = noteRelationStatusStorageKey(noteId);
  if (!key) return;
  const cleanStatus = String(status || "").trim().toLowerCase();
  if (!cleanStatus) {
    writeStoredText(key, "");
    return;
  }
  if (!isPersistableRelationNetworkStatus(cleanStatus)) return;
  writeStoredText(key, cleanStatus);
}

function loadAiSettingsFromStorage() {
  const storedRuntimeMode = String(readStoredText(AI_RUNTIME_MODE_KEY, "") || "").trim();
  const storedMode = String(readStoredText(AI_USER_MODE_KEY, "") || "").trim();
  const storedPack = String(readStoredText(AI_MODEL_PACK_KEY, "") || "").trim();
  const storedModelRef = String(readStoredText(AI_ADVANCED_MODEL_REF_KEY, "") || "").trim();
  const storedSecretRef = String(readStoredText(AI_SECRET_REF_KEY, "") || "").trim();
  const storedRemoteApiKey = String(readStoredText(AI_REMOTE_API_KEY_KEY, "") || "").trim();
  const storedEndpointUrl = String(readStoredText(AI_PROVIDER_ENDPOINT_URL_KEY, "") || "").trim();
  const storedHealthEndpointUrl = String(readStoredText(AI_PROVIDER_HEALTH_ENDPOINT_URL_KEY, "") || "").trim();
  const storedRemoteRuntimeModel = String(readStoredText(AI_REMOTE_RUNTIME_MODEL_KEY, "") || "").trim();
  const storedLocalModel = String(readStoredText(AI_LOCAL_MODEL_KEY, "") || "").trim();
  const storedTestStatus = String(readStoredText(AI_TEST_STATUS_KEY, "") || "").trim();
  const storedTestMeta = String(readStoredText(AI_TEST_META_KEY, "") || "").trim();
  const storedTestOutput = String(readStoredText(AI_TEST_OUTPUT_KEY, "") || "").trim();
  const storedTestModel = String(readStoredText(AI_TEST_MODEL_KEY, "") || "").trim();
  const storedTestProviderId = String(readStoredText(AI_TEST_PROVIDER_ID_KEY, "") || "").trim();
  const storedTestEndpointUrl = String(readStoredText(AI_TEST_ENDPOINT_URL_KEY, "") || "").trim();
  const storedTestRemoteModel = String(readStoredText(AI_TEST_REMOTE_MODEL_KEY, "") || "").trim();
  const storedTestSecretRef = String(readStoredText(AI_TEST_SECRET_REF_KEY, "") || "").trim();
  settingsState.ai.localAiSetupSyncPending = readStoredBoolean(AI_LOCAL_SETUP_SYNC_PENDING_KEY, false);
  settingsState.ai.autoPrepareLocalAi = readStoredBoolean(AI_AUTO_PREPARE_LOCAL_KEY, false);
  if (storedRuntimeMode) settingsState.ai.runtimeMode = normalizeAiRuntimeMode(storedRuntimeMode);
  if (storedMode) settingsState.ai.userMode = storedMode;
  if (storedPack) settingsState.ai.modelPack = storedPack;
  settingsState.ai.advancedModelRef = storedModelRef;
  settingsState.ai.remoteApiKey = storedRemoteApiKey;
  settingsState.ai.secretRef = storedRemoteApiKey ? remoteApiKeySecretRef() : storedSecretRef;
  settingsState.ai.providerEndpointUrl = storedEndpointUrl;
  settingsState.ai.providerHealthEndpointUrl = storedHealthEndpointUrl;
  settingsState.ai.remoteRuntimeModel = storedRemoteRuntimeModel;
  settingsState.ai.localModel = storedLocalModel;
  settingsState.ai.testStatus = storedTestStatus;
  settingsState.ai.testMeta = storedTestMeta;
  settingsState.ai.testOutput = storedTestOutput;
  settingsState.ai.testModel = storedTestModel;
  settingsState.ai.testProviderId = storedTestProviderId;
  settingsState.ai.testEndpointUrl = storedTestEndpointUrl;
  settingsState.ai.testRemoteModel = storedTestRemoteModel;
  settingsState.ai.testSecretRef = storedTestSecretRef;
  reconcileAiSelectionState();
}

function persistAiSettingsToStorage() {
  writeStoredText(AI_RUNTIME_MODE_KEY, settingsState.ai.runtimeMode);
  writeStoredText(AI_USER_MODE_KEY, settingsState.ai.userMode);
  writeStoredText(AI_MODEL_PACK_KEY, settingsState.ai.modelPack);
  writeStoredText(AI_ADVANCED_MODEL_REF_KEY, settingsState.ai.advancedModelRef);
  writeStoredText(AI_SECRET_REF_KEY, settingsState.ai.secretRef);
  writeStoredText(AI_REMOTE_API_KEY_KEY, settingsState.ai.remoteApiKey);
  writeStoredText(AI_PROVIDER_ENDPOINT_URL_KEY, settingsState.ai.providerEndpointUrl);
  writeStoredText(AI_PROVIDER_HEALTH_ENDPOINT_URL_KEY, settingsState.ai.providerHealthEndpointUrl);
  writeStoredText(AI_REMOTE_RUNTIME_MODEL_KEY, settingsState.ai.remoteRuntimeModel);
  writeStoredText(AI_LOCAL_MODEL_KEY, settingsState.ai.localModel);
  writeStoredText(AI_TEST_STATUS_KEY, settingsState.ai.testStatus);
  writeStoredText(AI_TEST_META_KEY, settingsState.ai.testMeta);
  writeStoredText(AI_TEST_OUTPUT_KEY, settingsState.ai.testOutput);
  writeStoredText(AI_TEST_MODEL_KEY, settingsState.ai.testModel);
  writeStoredText(AI_TEST_PROVIDER_ID_KEY, settingsState.ai.testProviderId);
  writeStoredText(AI_TEST_ENDPOINT_URL_KEY, settingsState.ai.testEndpointUrl);
  writeStoredText(AI_TEST_REMOTE_MODEL_KEY, settingsState.ai.testRemoteModel);
  writeStoredText(AI_TEST_SECRET_REF_KEY, settingsState.ai.testSecretRef);
  writeStoredBoolean(AI_LOCAL_SETUP_SYNC_PENDING_KEY, settingsState.ai.localAiSetupSyncPending === true);
  writeStoredBoolean(AI_AUTO_PREPARE_LOCAL_KEY, settingsState.ai.autoPrepareLocalAi === true);
}

function settingsSupportedModelPack(modelPack = "") { return supportedAiSettingsModelPack(modelPack); }

function isLocalAdvancedModelRef(value = "") { return isLocalAdvancedModelRefForSettings(value); }

function preferredLocalProviderPresetForSelection() { return localProviderPresetForModelPack(settingsState.ai.modelPack) || "local_private_gateway"; }

function shouldUseOllamaLocalRuntime() {
  return shouldUseOllamaLocalRuntimeForSelection({
    runtimeMode: settingsState.ai.runtimeMode,
    modelPack: settingsState.ai.modelPack,
    providerPreset: preferredLocalProviderPresetForSelection()
  });
}

function resetAiProviderDraftTouched() {
  settingsState.ai.providerDraftTouched = {
    secretRef: false,
    providerEndpointUrl: false,
    providerHealthEndpointUrl: false,
    remoteRuntimeModel: false
  };
}

function markAiProviderDraftTouched(field = "") {
  if (!settingsState.ai.providerDraftTouched || typeof settingsState.ai.providerDraftTouched !== "object") {
    resetAiProviderDraftTouched();
  }
  if (field && Object.hasOwn(settingsState.ai.providerDraftTouched, field)) {
    settingsState.ai.providerDraftTouched[field] = true;
  }
}

function reconcileAiSelectionState(options = {}) {
  const previousModelPack = String(settingsState.ai.modelPack || "").trim();
  const previousProviderPreset = providerPresetForModelPack(previousModelPack);
  const unsupportedLocalProviderPreset = previousProviderPreset === "minicpm_local_gateway" ? previousProviderPreset : "";
  const nextSelection = canonicalizeAiSettingsSelection({
    runtimeMode: settingsState.ai.runtimeMode,
    modelPack: settingsSupportedModelPack(settingsState.ai.modelPack),
    userMode: settingsState.ai.userMode,
    providerPreset: localProviderPresetForModelPack(settingsSupportedModelPack(settingsState.ai.modelPack))
  }, {
    syncUserMode: options.syncUserMode === true
  });

  settingsState.ai.runtimeMode = nextSelection.runtimeMode;
  settingsState.ai.modelPack = nextSelection.modelPack;
  if (unsupportedLocalProviderPreset) {
    settingsState.ai.localModel = "";
    if (String(settingsState.ai.advancedModelRef || "").trim().startsWith(`${unsupportedLocalProviderPreset}:`)) {
      settingsState.ai.advancedModelRef = "";
    }
  }
  if (options.syncUserMode === true || !String(settingsState.ai.userMode || "").trim()) {
    settingsState.ai.userMode = nextSelection.userMode;
  }
  if (options.resetRoutePreview !== false) settingsState.ai.routePreview = null;
  if (options.resetProviderState === true || previousProviderPreset !== nextSelection.providerPreset) {
    settingsState.ai.providerEndpointUrl = "";
    settingsState.ai.providerHealthEndpointUrl = "";
    settingsState.ai.remoteRuntimeModel = "";
    settingsState.ai.secretRef = "";
    resetAiProviderDraftTouched();
  }
  if (nextSelection.providerPreset === "platform_managed_openai") {
    settingsState.ai.providerEndpointUrl = "";
    settingsState.ai.providerHealthEndpointUrl = "";
    settingsState.ai.remoteRuntimeModel = "";
    settingsState.ai.secretRef = "";
    resetAiProviderDraftTouched();
  }
  if (nextSelection.runtimeMode === "local_only" && settingsState.ai.advancedModelRef && !isLocalAdvancedModelRef(settingsState.ai.advancedModelRef)) {
    settingsState.ai.advancedModelRef = "";
  }
  settingsState.ai.providerConfigError = "";
  settingsState.ai.providerHealthResult = null;

  if (nextSelection.localFlowActive) {
    const providerId = preferredLocalProviderPresetForSelection();
    const endpointUrl = defaultProviderEndpointUrl(providerId) || OLLAMA_CHAT_ENDPOINT_URL;
    const healthEndpointUrl = defaultProviderHealthEndpointUrl(providerId, endpointUrl) || OLLAMA_HEALTH_ENDPOINT_URL;
    if (!settingsState.ai.providerEndpointUrl) settingsState.ai.providerEndpointUrl = endpointUrl;
    if (!settingsState.ai.providerHealthEndpointUrl) settingsState.ai.providerHealthEndpointUrl = healthEndpointUrl;
  }

  if (settingsState.ai.localModel) {
    applyOllamaLocalModelDefaults();
  } else if (!nextSelection.localFlowActive && isLocalAdvancedModelRef(settingsState.ai.advancedModelRef)) {
    settingsState.ai.advancedModelRef = "";
  }

  if (options.applyProviderConfig !== false) {
    applyActiveAiProviderConfigToState();
  }
  return nextSelection;
}

function applyOllamaLocalModelDefaults() {
  if (!settingsState.ai.localModel) return;
  const providerId = preferredLocalProviderPresetForSelection();
  const localFlowActive = isAiLocalFlowActive({
    runtimeMode: settingsState.ai.runtimeMode,
    modelPack: settingsState.ai.modelPack,
    providerId: localProviderPresetForModelPack(settingsState.ai.modelPack)
  });
  if (localFlowActive) {
    const endpointUrl = defaultProviderEndpointUrl(providerId) || OLLAMA_CHAT_ENDPOINT_URL;
    const healthEndpointUrl = defaultProviderHealthEndpointUrl(providerId, endpointUrl) || OLLAMA_HEALTH_ENDPOINT_URL;
    settingsState.ai.providerEndpointUrl = endpointUrl;
    settingsState.ai.providerHealthEndpointUrl = healthEndpointUrl;
    settingsState.ai.secretRef = "";
  }
  if (normalizeAiRuntimeMode(settingsState.ai.runtimeMode) === "local_only" || isLocalModelPack(settingsState.ai.modelPack)) {
    settingsState.ai.advancedModelRef = `${providerId}:${settingsState.ai.localModel}`;
  } else if (isLocalAdvancedModelRef(settingsState.ai.advancedModelRef)) {
    settingsState.ai.advancedModelRef = "";
  }
}

function authModeForProvider(providerId = "", preview = null) {
  const authMode = String(preview?.access?.authMode || "").trim();
  if (authMode) return authMode;
  const id = String(providerId || "").trim();
  if (id === "platform_managed_openai") return "platform_managed";
  if (["local_private_gateway", "ollama_local_gateway", "minicpm_local_gateway"].includes(id)) {
    return settingsState.ai.secretRef ? "enterprise_secret" : "local_no_key";
  }
  return "workspace_managed";
}

function providerAuthModeRequiresSecret(authMode = "") { return ["workspace_managed", "byok_advanced", "enterprise_secret"].includes(String(authMode || "").trim()); }

function currentAiProviderId() { return String(settingsState.ai.routePreview?.provider?.providerId || providerPresetForModelPack(settingsState.ai.modelPack)).trim(); }

function remoteAiExplicitlyEnabledForFeatures() {
  return normalizeAiRuntimeMode(settingsState.ai.runtimeMode) === "cloud_only" && !isLocalProviderId(currentAiProviderId());
}

function featureAiProviderId() {
  return remoteAiExplicitlyEnabledForFeatures()
    ? currentAiProviderId()
    : preferredLocalProviderPresetForSelection();
}

function featureAiRuntimeMode() {
  return remoteAiExplicitlyEnabledForFeatures() ? "cloud_only" : "local_only";
}

function featureAiRequestOptions() {
  const providerId = featureAiProviderId();
  const localProvider = !remoteAiExplicitlyEnabledForFeatures();
  return {
    userConfirmedRemoteModel: !localProvider,
    executeModel: true,
    modelPack: settingsState.ai.modelPack,
    userMode: settingsState.ai.userMode,
    providerPreset: providerId,
    authMode: authModeForProvider(providerId, settingsState.ai.routePreview),
    modelTier: localProvider ? "local_private" : "strong_reasoning",
    privacyMode: localProvider ? "local_only" : "remote_after_confirmation"
  };
}

const settingsAiStateRuntime = createSettingsAiStateRuntime({
  applyAiPreferencesToSettingsState,
  activeAiProviderConfig,
  applyOllamaLocalModelDefaults,
  clearLocalOllamaSelectionState,
  currentAiProviderId,
  currentOllamaModelTiers,
  defaultProviderEndpointUrl,
  defaultProviderHealthEndpointUrl,
  enabledProviderHealthEndpointUrl,
  isRemoteConfigurableProviderId,
  modelNameExistsInList,
  normalizeOllamaSetupGuide,
  persistAiSettingsToStorage,
  remoteRuntimeModelFromMap,
  selectedLocalModelNameForInstalledModels,
  settingsState,
  upsertAiProviderConfig
});

function activeAiProviderConfig() {
  const providerId = currentAiProviderId();
  return settingsState.ai.providerConfigs.find((config) => String(config?.providerId || config?.provider_id || "").trim() === providerId) || null;
}

function applyActiveAiProviderConfigToState() { return settingsAiStateRuntime.applyActiveAiProviderConfigToState(); }

function aiTestBlockedReason() {
  const providerId = currentAiProviderId();
  return aiTestBlockedReasonForState(settingsState.ai, {
    providerId,
    shouldUseOllamaLocalRuntime: shouldUseOllamaLocalRuntime(),
    authMode: authModeForProvider(providerId, settingsState.ai.routePreview)
  });
}

const settingsAiRuntimeController = createSettingsAiRuntimeController(() => ({
  aiProviderConfigPayload,
  applyActiveAiProviderConfigToState,
  applyAiPreferencesToSettingsState,
  applyOllamaBootstrapResult,
  applyOllamaLocalModelDefaults,
  applyOllamaRuntimePreview,
  bootstrapOllamaLocalAi,
  checkAiProviderHealth,
  clearLocalOllamaSelectionState,
  currentAiProviderId,
  currentOllamaModelTiers,
  fetchOllamaBootstrapStatus,
  fetchOllamaModels,
  hasLocalModel,
  installedLocalModelReady,
  localOllamaSetupActive,
  ollamaBootstrapStatusText,
  ollamaPullModelName,
  persistAiSettingsToStorage,
  persistOllamaRuntimeSelectionAfterPreview,
  preferredLocalProviderPresetForSelection,
  previewAiRoute,
  primaryRecommendedOllamaModelName,
  pullOllamaModel,
  refreshAiRoutePreview,
  renderSettingsPanel,
  resetAiProviderDraftTouched,
  saveAiProviderConfig,
  saveLocalOllamaProviderConfig,
  selectedLocalModelNameForInstalledModels,
  setStatus,
  settingsState,
  shouldUseOllamaLocalRuntime,
  startOllamaRuntime,
  stopOllamaRuntime,
  syncAiSettingsToApi,
  upsertAiProviderConfig,
  window
}));

const {
  aiSettingsPayload,
  bootstrapOllamaLocalAiFromUi,
  checkCurrentAiProviderHealth,
  detectOllamaModels,
  persistOllamaRuntimeSelectionAfterPreview,
  previewOllamaLocalAiBootstrapFromUi,
  pullRecommendedOllamaModel,
  refreshAiRoutePreview,
  selectInstalledLocalModelFromUi,
  startOllamaRuntimeFromUi,
  stopOllamaRuntimeFromUi,
  syncAiProviderConfigToApi
} = settingsAiRuntimeController;

const localAiSetupController = createLocalAiSetupController(() => ({
  activateLocalAiSetupFlow,
  activateModule,
  currentOllamaModelTiers,
  localAiSetupSyncPending,
  localAiPreviewOptionsForAction,
  localAiFeatureReady,
  localOllamaSetupActive,
  ollamaBootstrapStatusText,
  ollamaRecommendationForModel,
  previewOllamaLocalAiBootstrapFromUi,
  primaryRecommendedOllamaModelName,
  renderSettingsPanel,
  setSettingsItem,
  setStatus,
  shouldGuideLocalAiSetupForFeature,
  shouldUseOllamaLocalRuntime
}));

async function ensureLocalAiReadyForFeature(options = {}) {
  return localAiSetupController.ensureReadyForAiFeature(options);
}

async function ensureAiReadyForFeature(options = {}) {
  const runtimeMode = normalizeAiRuntimeMode(settingsState.ai.runtimeMode);
  if (runtimeMode === "off") {
    setStatus("请先完成 AI 设置并测试通过，再回来使用 AI 推荐。", "warn", { priority: 3, holdMs: 8000 });
    if (options.openSettings !== false) {
      activateModule("settings");
      setSettingsItem("ai-settings", { render: false });
      renderSettingsPanel();
    }
    return { ready: false, reason: "ai_off" };
  }
  if (!remoteAiExplicitlyEnabledForFeatures()) {
    return ensureLocalAiReadyForFeature(options);
  }
  if (settingsState.ai.routePreview?.access?.ready === true) {
    const providerId = currentAiProviderId();
    return { ready: true, mode: "remote", providerId };
  }
  if (options.openSettings !== false) {
    setStatus("请先完成 AI 设置并测试通过，再回来使用 AI 推荐。", "warn", { priority: 3, holdMs: 8000 });
    activateModule("settings");
    setSettingsItem("ai-settings", { render: false });
    renderSettingsPanel();
  }
  return { ready: false, reason: "remote_not_ready" };
}

async function runSourceDistillAi(payload = {}) {
  const requestOptions = featureAiRequestOptions();
  const localProvider = requestOptions.privacyMode === "local_only";
  if (!localProvider && payload.remoteConfirmed !== true) {
    const error = new Error("在线 AI 需要先确认发送当前笔记内容。");
    error.code = "REMOTE_AI_CONFIRMATION_REQUIRED";
    throw error;
  }
  const analysis = await analyzeWritingWithStrongModel({
    userConfirmedRemoteModel: !localProvider,
    executeModel: true,
    persistArtifacts: false,
    projectId: `source_distill_${String(payload.sourceNoteId || payload.noteId || "note").trim() || "note"}`,
    writingGoal: "把当前材料提炼成一条可编辑的永久笔记草稿。",
    audience: "自己",
    notes: [{
      id: String(payload.sourceNoteId || payload.noteId || "").trim(),
      noteId: String(payload.sourceNoteId || payload.noteId || "").trim(),
      title: String(payload.sourceTitle || "").trim(),
      noteType: String(payload.sourceType || "").trim(),
      body: String(payload.sourceBody || "").trim()
    }],
    ...requestOptions
  });
  return buildSourceNoteDistillDraftFromAiResult(analysis, payload) || buildSourceNoteDistillDraft(payload);
}

function shouldGuideLocalAiSetupForFeature() {
  const runtimeMode = normalizeAiRuntimeMode(settingsState.ai.runtimeMode);
  if (runtimeMode !== "auto") return false;
  if (localAiFeatureReady()) return false;
  if (settingsState.ai.routePreview?.access?.ready === true) return false;
  return true;
}

function localAiSetupSyncPending() {
  return settingsState.ai.localAiSetupSyncPending === true;
}

function activateLocalAiSetupFlow(options = {}) {
  return activateLocalAiSetupSelection({
    aiState: settingsState.ai,
    restoreOnFailure: options.restoreOnFailure !== false,
    reconcileAiSelectionState,
    persistAiSettingsToStorage,
    syncAiSettingsToApi
  });
}

function aiProviderConfigPayload(options = {}) {
  const providerId = String(options.providerId || currentAiProviderId()).trim();
  return buildAiProviderConfigPayload({
    ...settingsState.ai,
    ...options
  }, {
    providerId,
    authMode: options.authMode || authModeForProvider(providerId, settingsState.ai.routePreview),
    isRemoteConfigurableProvider: isRemoteConfigurableProviderId,
    providerAuthModeRequiresSecret,
    localModelTiers: AI_LOCAL_MODEL_TIERS
  });
}
function upsertAiProviderConfig(config = null) {
  if (!config) return;
  const providerId = String(config.providerId || config.provider_id || "").trim();
  if (!providerId) return;
  settingsState.ai.providerConfigs = [
    ...settingsState.ai.providerConfigs.filter((item) => String(item?.providerId || item?.provider_id || "").trim() !== providerId),
    config
  ];
}

function applyAiPreferencesToSettingsState(preferences = null, options = {}) {
  const nextAiSelection = aiSettingsSelectionFromPreferences(preferences);
  settingsState.ai.runtimeMode = nextAiSelection.runtimeMode;
  settingsState.ai.userMode = nextAiSelection.userMode;
  settingsState.ai.modelPack = nextAiSelection.modelPack;
  settingsState.ai.localModel = nextAiSelection.localModel;
  settingsState.ai.advancedModelRef = nextAiSelection.advancedModelRef;
  settingsState.ai.secretRef = settingsState.ai.remoteApiKey ? remoteApiKeySecretRef() : nextAiSelection.secretRef;
  settingsState.ai.providerEndpointUrl = "";
  settingsState.ai.providerHealthEndpointUrl = "";
  settingsState.ai.remoteRuntimeModel = "";
  resetAiProviderDraftTouched();
  reconcileAiSelectionState({
    resetRoutePreview: false,
    applyProviderConfig: options.applyProviderConfig
  });
}

async function syncAiSettingsToApi() {
  try {
    await saveAiPreferences(aiSettingsPayload());
    settingsState.ai.localAiSetupSyncPending = false;
    writeStoredBoolean(AI_LOCAL_SETUP_SYNC_PENDING_KEY, false);
    return true;
  } catch {
    return false;
  }
}

async function saveLocalOllamaProviderConfig() {
  if (!shouldUseOllamaLocalRuntime()) return null;
  if (!isBuiltInOllamaModel(settingsState.ai.localModel, currentOllamaModelTiers())) return null;
  const endpointUrl = String(settingsState.ai.localRuntimeChatEndpointUrl || OLLAMA_CHAT_ENDPOINT_URL).trim() || OLLAMA_CHAT_ENDPOINT_URL;
  const healthEndpointUrl = String(settingsState.ai.localRuntimeHealthEndpointUrl || OLLAMA_HEALTH_ENDPOINT_URL).trim() || OLLAMA_HEALTH_ENDPOINT_URL;
  const saved = await saveAiProviderConfig(aiProviderConfigPayload({
    providerId: preferredLocalProviderPresetForSelection(),
    authMode: "local_no_key",
    endpointUrl,
    healthEndpointUrl
  }));
  upsertAiProviderConfig(saved);
  resetAiProviderDraftTouched();
  return saved;
}
function currentOllamaModelTiers() { return currentOllamaModelTiersForState(settingsState.ai); }

function hasLocalModel(modelName = "") { return modelNameExistsInList(modelName, settingsState.ai.localRuntimeModels); }

function installedLocalModelReady(modelName = settingsState.ai.localModel) { return installedLocalModelReadyForState(settingsState.ai, modelName); }

function localAiFeatureReady() {
  const runtimeMode = normalizeAiRuntimeMode(settingsState.ai.runtimeMode);
  if (!["auto", "local_only", "hybrid"].includes(runtimeMode)) return false;
  const localModel = String(settingsState.ai.localModel || "").trim();
  const testStatus = String(settingsState.ai.testStatus || "").trim();
  const testModel = String(settingsState.ai.testModel || "").trim();
  return installedLocalModelReady()
    && Boolean(localModel)
    && testStatus === "success"
    && testModel === localModel;
}

function localOllamaSetupActive() {
  const runtimeMode = normalizeAiRuntimeMode(settingsState.ai.runtimeMode);
  return ["local_only", "hybrid"].includes(runtimeMode) && shouldUseOllamaLocalRuntime();
}

function clearLocalOllamaSelectionState(options = {}) {
  if (options.clearModel !== false) settingsState.ai.localModel = "";
  if (isLocalAdvancedModelRef(settingsState.ai.advancedModelRef)) settingsState.ai.advancedModelRef = "";
  settingsState.ai.routePreview = null;
}

function currentOllamaSetupGuide() { return normalizeOllamaSetupGuide(settingsState.ai.localRuntimeSetupGuide); }

function recommendedOllamaModelName() { return currentOllamaSetupGuide()?.recommendedModel || OLLAMA_RECOMMENDED_MODEL; }

function recommendedOllamaModelNames() {
  const names = [
    recommendedOllamaModelName(),
    OLLAMA_RECOMMENDED_MODEL,
    ...ollamaModelRecommendationProfiles(currentOllamaModelTiers()).map((item) => item.name)
  ].map((name) => String(name || "").trim()).filter(Boolean);
  return [...new Set(names)];
}

function primaryRecommendedOllamaModelName() { return recommendedOllamaModelNames()[0] || OLLAMA_RECOMMENDED_MODEL; }

function nextMissingRecommendedOllamaModelName() { return recommendedOllamaModelNames().find((name) => !hasLocalModel(name)) || ""; }

function ollamaRecommendationHintText() {
  return ollamaModelRecommendationProfiles(currentOllamaModelTiers())
    .map((item) => `${item.name}：${item.label}`)
    .join("；");
}

function ollamaPullModelName() {
  const missingRecommended = nextMissingRecommendedOllamaModelName();
  if (missingRecommended) return missingRecommended;
  const recommended = primaryRecommendedOllamaModelName();
  return String(settingsState.ai.localModel || preferredLocalModelName(settingsState.ai.localRuntimeModels) || recommended).trim();
}

function applyOllamaRuntimePreview(runtime = null) { return settingsAiStateRuntime.applyOllamaRuntimePreview(runtime); }

function applyOllamaBootstrapResult(result = null) { return settingsAiStateRuntime.applyOllamaBootstrapResult(result); }

loadAiSettingsFromStorage();

function ollamaRuntimeStateLabel() {
  if (settingsState.ai.localRuntimePulling) return "模型下载中";
  if (settingsState.ai.localRuntimeChecking) return "正在检测本地 AI";
  const readiness = String(settingsState.ai.localRuntimeReadinessStatus || "").trim();
  if (readiness === "ready") return "本地 AI 已就绪";
  if (readiness === "running_missing_model") return "正在运行但缺少模型";
  if (readiness === "installed_not_running") return "已安装但未运行";
  if (readiness === "not_installed") return "未检测到本地 AI";
  if (readiness === "check_failed") return "检测失败";
  const status = String(settingsState.ai.localRuntimeStatus || "").trim();
  if (status === "available" && installedLocalModelReady()) return "本地 AI 已就绪";
  if (status === "available") return "正在运行但缺少模型";
  if (status === "unavailable") return "未检测到本地 AI";
  return "等待检测本地 AI";
}

function hideEditorHelper() {
  const helper = $("editorHelper");
  if (!helper) return;
  helper.classList.add("hidden");
  helper.hidden = true;
  helper.setAttribute("aria-hidden", "true");
  helper.style.pointerEvents = "none";
  const action = $("btnEditorHelperAction");
  if (action) {
    action.dataset.helperAction = "noop";
    action.dataset.targetNoteId = "";
  }
  if (typeof document !== "undefined" && helper.contains(document.activeElement)) {
    document.activeElement?.blur?.();
  }
}

function setImportRecordId(value) {
  importState.importRecordId = String(value || "").trim();
  const input = $("importRecordId");
  if (input) input.value = importState.importRecordId;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatClockTime(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return "";
  try {
    return date.toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false
    });
  } catch {
    return raw;
  }
}

function primitiveEntries(value = {}) { return Object.entries(value || {}).filter(([, item]) => item === null || ["string", "number", "boolean"].includes(typeof item)); }

function compactValue(value) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "yes" : "no";
  return String(value);
}

const importResultRuntime = createImportResultRuntime({
  $,
  activateModule,
  addWritingBasketIds,
  candidatePreviewFromPayload,
  candidatePreviewItemIds,
  candidateSelectionFromPayload,
  confirmSkipReasonMap,
  confirmSkippedCandidateIds,
  clearWritingSourceIndexIds,
  computeCandidateIdsForSelection,
  computeDefaultSelectedCandidateIds,
  computeLiteratureBatchSummaryForPayload,
  computeSummarizeLiteratureBatchFromNotes,
  createdNoteIdsByTypeFromImportPayload,
  createdNoteIdsByTypeFromImportRecord,
  directoryPathLabel,
  ensureNotesLoaded,
  escapeHtml,
  importConfirmButtonState,
  importPayloadRecordId,
  importState, handleStateChange,
  noteById: (noteId) => state.notes.find((item) => item.id === noteId) || null,
  openNoteById,
  rankedLiteratureQueueNotes,
  renderCandidatePreview,
  renderConfirmSkipBreakdown,
  renderImportResultMount,
  renderImportWritingActionsHtml,
  renderWritingResultDetailsHtml,
  renderWritingPanel: (...args) => renderWritingPanel(...args),
  renderWritingScaffoldPreview: (...args) => renderWritingScaffoldPreview(...args),
  selectedCandidateIdsForImportAction,
  selectedCandidateIdsForImportState,
  selectionSummaryForImportState,
  setLiteratureQueueFocus,
  setStatus,
  summarizeCandidateSelection,
  syncImportSelectionState,
  suggestedWritingProjectTitle,
  beginWritingEntry,
  normalizeWritingProjectTitleSeed,
  updateExportTargetHint: (...args) => updateExportTargetHint(...args),
  writingNoteById,
  writingState
});

const importWorkspaceShellController = createImportWorkspaceShellController({
  getElement: $,
  importState,
  renderImportPageMount,
  renderImportToolbarMount,
  preferredImportDirectoryId: (...args) => preferredImportDirectoryId(...args),
  activeImportPreviewContext: (...args) => activeImportPreviewContext(...args),
  selectionSummary: (...args) => selectionSummary(...args),
  importConfirmButtonState,
  importTargetDirectories: (...args) => importTargetDirectories(...args),
  directoryPathLabel,
  mountExportCardIntoImportShell
});

function currentImportToolbarValues() { return importWorkspaceShellController.currentToolbarValues(); }

function renderImportToolbar() {
  importWorkspaceShellController.renderToolbar();
}

function renderImportPageShell() {
  importWorkspaceShellController.renderPage();
}

function mountExportCardIntoImportShell() {
  const legacyExportCard = $("importPanel")?.querySelector(".export-card");
  const exportMount = $("exportCardMount");
  if (!legacyExportCard || !exportMount) return;
  if (legacyExportCard.parentElement === exportMount) return;
  legacyExportCard.remove();
}

function normalizeImportWorkspaceTab(tab = "import") { return importWorkspaceShellController.normalizeTab(tab); }

function syncImportWorkspaceTabs() {
  importWorkspaceShellController.syncTabs();
}

function setImportWorkspaceTab(tab = "import") {
  importWorkspaceShellController.setTab(tab);
}

function renderAiInboxWorkspace() {
  renderAiInboxWorkspaceView({
    mount: $("aiInboxPanel"),
    state: aiInboxState
  });
}

function clearAiInboxActionNotice() {
  aiInboxState.actionNoticeArtifactId = "";
  aiInboxState.actionNoticeSuggestionId = "";
  aiInboxState.actionNotice = "";
  aiInboxState.actionNoticeTone = "";
}

function setAiInboxActionNotice(message = "", tone = "muted", artifactId = "", suggestionId = "") {
  aiInboxState.actionNoticeArtifactId = String(artifactId || aiInboxState.selectedArtifactId || aiInboxState.detail?.item?.artifactId || aiInboxState.detail?.artifact?.id || "").trim();
  aiInboxState.actionNoticeSuggestionId = String(suggestionId || aiInboxState.detail?.suggestion?.id || "").trim();
  aiInboxState.actionNotice = String(message || "").trim();
  aiInboxState.actionNoticeTone = aiInboxState.actionNotice ? String(tone || "muted").trim() : "";
  if (!aiInboxState.actionNotice) {
    aiInboxState.actionNoticeArtifactId = "";
    aiInboxState.actionNoticeSuggestionId = "";
  }
}

function recommendedAiInboxActionFromText(text = "") {
  const raw = String(text || "").toLowerCase();
  const match = raw.match(/(?:recommended\s+action|recommendedaction)\s*[=:：]\s*([a-z_ -]+)/i);
  const candidate = String(match?.[1] || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
    .replace(/[^a-z_].*$/, "");
  const aliases = {
    accept: "accept_link",
    accept_link: "accept_link",
    create_link: "accept_link",
    promote: "promote_note",
    promote_note: "promote_note",
    create_note: "promote_note",
    ignore: "ignore",
    ignored: "ignore",
    archive: "ignore",
    needs_more_context: "needs_more_context",
    more_context: "needs_more_context"
  };
  return aliases[candidate] || "";
}

function resetAiInboxSummaryState(options = {}) {
  if (options.invalidate === true) aiInboxState.aiSummaryRequestToken += 1;
  aiInboxState.aiSummary = "";
  aiInboxState.aiSummaryArtifactId = "";
  aiInboxState.aiSummarySuggestionId = "";
  aiInboxState.aiSummaryMeta = "";
  aiInboxState.aiSummaryRecommendedAction = "";
  aiInboxState.aiSummaryError = "";
  aiInboxState.aiSummaryLoading = false;
}

function resetAiInboxEvaluationState(options = {}) {
  if (options.invalidate === true) aiInboxState.evaluationRequestToken += 1;
  if (options.clearSummary === true) aiInboxState.evaluationSummary = null;
  aiInboxState.evaluationError = "";
  aiInboxState.evaluationLoading = false;
}

function syncAiInboxSummaryFromDetail(detail = null) {
  const decisions = Array.isArray(detail?.artifact?.userDecisions || detail?.item?.userDecisions)
    ? detail?.artifact?.userDecisions || detail?.item?.userDecisions
    : [];
  const summaryDecision = decisions
    .slice()
    .reverse()
    .find((decision) => String(decision?.comment || "").includes("[AI Summary]"));
  if (!summaryDecision) {
    resetAiInboxSummaryState({ invalidate: false });
    return;
  }
  const comment = String(summaryDecision.comment || "").trim();
  const provider = comment.match(/^provider=(.+)$/m)?.[1]?.trim() || "";
  const model = comment.match(/^model=(.+)$/m)?.[1]?.trim() || "";
  const body = comment
    .replace(/^\[AI Summary]\s*/m, "")
    .replace(/^provider=.*$/m, "")
    .replace(/^model=.*$/m, "")
    .replace(/^recommendedAction=.*$/m, "")
    .trim();
  aiInboxState.aiSummary = body;
  aiInboxState.aiSummaryArtifactId = cleanText(detail?.item?.artifactId || detail?.artifact?.id);
  aiInboxState.aiSummarySuggestionId = cleanText(detail?.suggestion?.id);
  aiInboxState.aiSummaryMeta = [provider, model].filter(Boolean).join(" / ") || "persisted";
  aiInboxState.aiSummaryRecommendedAction = recommendedAiInboxActionFromText(comment);
  aiInboxState.aiSummaryError = "";
}

async function runAiInboxSummary(artifactId) {
  const localAiReady = await ensureLocalAiReadyForFeature({
    feature: "ai_summary"
  });
  if (localAiReady?.ready === false) return false;
  return runAiInboxSummaryForRuntime({
    aiInboxState,
    summarizeAiInboxItem,
    summaryRequestOptions: () => ({
      userMode: settingsState.ai.userMode,
      modelPack: settingsState.ai.modelPack,
      modelTier: "cheap_fast",
      privacyMode: settingsState.ai.routePreview?.privacy?.mode || ""
    }),
    recommendedAiInboxActionFromText,
    resetAiInboxSummaryState,
    loadAiInboxDetail,
    render: renderAiInboxWorkspace,
    setStatus,
    messages: {
      summarySucceededStatusMessage: () => "AI 摘要已生成",
      summaryFailedStatusMessage: (error) => `AI 摘要失败：${String(error?.message || error)}`
    }
  }, artifactId);
}

function renderScheduledTasksWorkspace() {
  const el = $("settingsScheduledTasksPanel");
  if (!el) return;
  const currentNoteId = state.selectedFileId || state.activeTabId || "";
  const currentDirectoryId = state.selectedFolderId || "";
  const currentNote = (Array.isArray(state.notes) ? state.notes : []).find((note) => note?.id === currentNoteId) || null;
  const currentDirectory = (Array.isArray(state.folders) ? state.folders : []).find((folder) => folder?.id === currentDirectoryId) || null;
  el.innerHTML = renderScheduledTasksPanel({
    items: settingsState.ai.scheduledTasks,
    total: settingsState.ai.scheduledTasksTotal,
    templates: settingsState.ai.scheduledTaskTemplates,
    templatesLoading: settingsState.ai.scheduledTaskTemplatesLoading,
    templatesError: settingsState.ai.scheduledTaskTemplatesError,
    form: settingsState.ai.scheduledTaskForm,
    currentNoteId,
    currentNoteLabel: currentNote?.title || currentNote?.name || "",
    currentDirectoryId,
    currentDirectoryLabel: currentDirectory?.name || currentDirectory?.title || "",
    filters: settingsState.ai.scheduledTaskFilters,
    loading: settingsState.ai.scheduledTasksLoading,
    actionLoading: settingsState.ai.scheduledTaskActionLoading,
    error: settingsState.ai.scheduledTasksError,
    runSummary: settingsState.ai.scheduledTaskRunSummary,
    compact: true,
    formOpen: settingsState.ai.scheduledTaskFormOpen
  });
}

function renderAiSuggestionsWorkspace() {
  renderAiSuggestionsWorkspaceView({
    mount: $("settingsAiSuggestionsPanel"),
    state: settingsState.ai,
    notes: state.notes
  });
}

function aiSuggestionFiltersFromUi() {
  return aiSuggestionFiltersFromWorkspace({
    getElement: $,
    state: settingsState.ai
  });
}

async function loadAiSuggestionDetail(suggestionId) {
  return loadAiSuggestionDetailForRuntime({
    aiState: settingsState.ai,
    fetchAiSuggestion,
    suggestionDetailFromResponse,
    rememberAiDebugSnapshot,
    render: renderAiSuggestionsWorkspace,
    setStatus
  }, suggestionId);
}

async function refreshAiSuggestions(options = {}) {
  return refreshAiSuggestionsForRuntime({
    aiState: settingsState.ai,
    fetchAiSuggestions,
    normalizeAiSuggestionFilters: normalizeVisibleSuggestionFilters,
    rememberAiDebugSnapshot,
    render: renderAiSuggestionsWorkspace,
    setStatus,
    loadDetail: loadAiSuggestionDetail
  }, options);
}

function aiSuggestionReviewedContentFromUi(current = {}) {
  return aiSuggestionReviewedContentFromWorkspace({
    getElement: $,
    current
  });
}

function aiInboxSuggestionReviewedContentFromUi(current = {}) {
  const editorValue = $("aiInboxSuggestionContentEditor")?.value;
  if (editorValue === undefined) return current.content;
  const raw = String(editorValue || "");
  if (typeof current.content === "string") {
    const trimmed = raw.trim();
    if (
      (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
      (trimmed.startsWith("[") && trimmed.endsWith("]"))
    ) {
      try {
        return JSON.parse(trimmed);
      } catch {}
    }
    return raw;
  }
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error("Reviewed suggestion content in AI inbox must be valid JSON before it can be marked edited or confirmed");
  }
}

const aiSuggestionsActionRoutes = createAiSuggestionsActionRoutes(() => ({
  aiState: settingsState.ai,
  suggestionDetailFromResponse,
  aiSuggestionReviewedContent: aiSuggestionReviewedContentFromUi,
  updateAiSuggestion,
  refreshAiSuggestions,
  loadAiSuggestionDetail,
  rememberAiDebugSnapshot,
  setStatus,
  render: renderAiSuggestionsWorkspace,
  aiSuggestionStatusLabel
}));

function aiSuggestionAlreadyAppliedNotice(status = "") { return aiSuggestionsActionRoutes.aiSuggestionAlreadyAppliedNotice(status); }

async function applyAiSuggestionStatus(suggestionId, status) { return aiSuggestionsActionRoutes.applyAiSuggestionStatus(suggestionId, status); }

const scheduledTasksRuntimeController = createScheduledTasksRuntimeController(() => ({
  addSystemMessage,
  aiInboxState,
  fetchAiScheduledTasks,
  fetchAiScheduledTaskTemplates,
  getElement: $,
  globalPendingAiInboxFilters,
  normalizeAiInboxFilters,
  refreshAiInbox,
  refreshAiInboxEvaluationSummary,
  refreshScheduledTasks,
  rememberAiDebugSnapshot,
  render: renderScheduledTasksWorkspace,
  runDueAiScheduledTasks,
  saveAiScheduledTask,
  scheduledTaskReviewArtifactCount,
  scheduledTaskSystemMessageForArtifacts,
  setStatus,
  settingsState,
  state,
  updateAiScheduledTaskStatusWithOptions,
  window
}));

function scheduledTaskFiltersFromUi() { return scheduledTasksRuntimeController.filtersFromUi(); }

function scheduledTaskTemplateById(templateId = "") { return scheduledTasksRuntimeController.templateById(templateId); }

function scheduledTaskFormFromUi() { return scheduledTasksRuntimeController.formFromUi(); }

function resetScheduledTaskForm(overrides = {}) { return scheduledTasksRuntimeController.resetForm(overrides); }

function applyScheduledTaskTemplateToForm(templateId = "") { return scheduledTasksRuntimeController.applyTemplateToForm(templateId); }

async function refreshScheduledTaskTemplates(options = {}) { return scheduledTasksRuntimeController.refreshTemplates(options); }

async function saveScheduledTaskFromUi() { return scheduledTasksRuntimeController.saveFromUi(); }

function editScheduledTaskFromList(scheduledTaskId = "") { return scheduledTasksRuntimeController.editFromList(scheduledTaskId); }

async function refreshScheduledTasks(options = {}) { return scheduledTasksRuntimeController.refreshTasks(options); }

async function setScheduledTaskStatus(scheduledTaskId, status) { return scheduledTasksRuntimeController.setTaskStatus(scheduledTaskId, status); }

async function runDueScheduledTasksFromUi() { return scheduledTasksRuntimeController.runDueFromUi(); }

function aiInboxFiltersFromUi() {
  return aiInboxFiltersFromWorkspace({
    getElement: $,
    state: aiInboxState
  });
}

function aiInboxFeedbackFromUi() { return aiInboxFeedbackFromWorkspace(document); }

function cloneJson(value) { return JSON.parse(JSON.stringify(value ?? null)); }

function rememberAiDebugSnapshot(key, response) {
  if (!settingsState.ai.debugSnapshots || !Object.prototype.hasOwnProperty.call(settingsState.ai.debugSnapshots, key)) return;
  const runtime = cloneJson(response);
  if (runtime && typeof runtime === "object" && !Array.isArray(runtime) && Object.prototype.hasOwnProperty.call(runtime, "canonical")) {
    delete runtime.canonical;
  }
  settingsState.ai.debugSnapshots[key] = {
    capturedAt: new Date().toISOString(),
    runtime,
    canonical: cloneJson(response?.canonical || null)
  };
  if (state.module === "settings") renderSettingsPanel();
}

function aiAdoptionEventFromCanonical(event = {}) {
  return {
    adoptionEventId: String(event.adoption_event_id || "").trim(),
    subjectKind: String(event.subject_kind || "").trim(),
    subjectId: String(event.subject_id || "").trim(),
    eventType: String(event.event_type || "").trim(),
    actorType: String(event.actor_type || "").trim(),
    actorId: String(event.actor_id || "").trim(),
    target: {
      kind: String(event.target?.kind || "").trim(),
      id: String(event.target?.id || "").trim(),
      field: String(event.target?.field || "").trim()
    },
    comment: String(event.comment || "").trim(),
    feedback: {
      useful: event.feedback?.useful === true,
      noisy: event.feedback?.noisy === true,
      wrong: event.feedback?.wrong === true,
      alreadyKnown: event.feedback?.already_known === true,
      privacyConcern: event.feedback?.privacy_concern === true
    },
    metadata: {
      fromStatus: String(event.metadata?.from_status || "").trim(),
      toStatus: String(event.metadata?.to_status || "").trim(),
      noteId: String(event.metadata?.note_id || "").trim()
    },
    createdAt: String(event.created_at || "").trim()
  };
}

function aiSuggestionTraceFromCanonical(trace = {}) {
  return {
    suggestionId: String(trace.suggestion_id || "").trim(),
    sourceArtifactId: String(trace.source_artifact_id || "").trim(),
    primarySourceNoteId: String(trace.primary_source_note_id || "").trim(),
    sourceNoteIds: Array.isArray(trace.source_note_ids) ? [...trace.source_note_ids] : [],
    targetNoteId: String(trace.target_note_id || "").trim(),
    targetField: String(trace.target_field || "").trim(),
    suggestionStatus: String(trace.suggestion_status || "").trim()
  };
}

function aiInboxDetailFromResponse(response = {}) {
  const canonical = response?.canonical || {};
  const item = canonical.item ? aiInboxItemFromCanonical(canonical.item) : response?.item || null;
  const artifact = canonical.artifact ? aiArtifactFromCanonical(canonical.artifact) : response?.artifact || null;
  const suggestion = canonical.suggestion ? aiSuggestionFromCanonical(canonical.suggestion) : response?.suggestion || null;
  const suggestionReviewEvents =
      Array.isArray(canonical.suggestion_review_events)
        ? canonical.suggestion_review_events.map((event) => suggestionReviewEventFromCanonical(event))
        : Array.isArray(response?.suggestionReviewEvents)
          ? response.suggestionReviewEvents
          : [];
  const latestSuggestionReviewEvent = canonical.latest_suggestion_review_event
      ? suggestionReviewEventFromCanonical(canonical.latest_suggestion_review_event)
      : response?.latestSuggestionReviewEvent || null;
  const trace = canonical.trace ? suggestionTraceFromCanonical(canonical.trace) : response?.trace || null;
  return { item, artifact, suggestion, suggestionReviewEvents, latestSuggestionReviewEvent, trace };
}

function aiInboxDetailMatchesSelection() {
  const selectedArtifactId = String(aiInboxState.selectedArtifactId || "").trim();
  const detailArtifactId = String(aiInboxState.detail?.item?.artifactId || aiInboxState.detail?.artifact?.id || "").trim();
  return Boolean(selectedArtifactId) && detailArtifactId === selectedArtifactId;
}

function currentAiInboxArtifactForSelection(artifactId = "") {
  const cleanArtifactId = String(artifactId || aiInboxState.selectedArtifactId || "").trim();
  if (!cleanArtifactId) return null;
  if (aiInboxDetailMatchesSelection()) {
    const detailArtifact = aiInboxState.detail?.artifact || null;
    if (String(detailArtifact?.id || "").trim() === cleanArtifactId) return detailArtifact;
  }
  return null;
}

function currentAiInboxSuggestionForSelection(artifactId = "") {
  const cleanArtifactId = String(artifactId || aiInboxState.selectedArtifactId || "").trim();
  if (!cleanArtifactId || !aiInboxDetailMatchesSelection()) return null;
  const detailArtifactId = String(aiInboxState.detail?.item?.artifactId || aiInboxState.detail?.artifact?.id || "").trim();
  if (detailArtifactId !== cleanArtifactId) return null;
  return aiInboxState.detail?.suggestion || null;
}

function latestArtifactDecision(artifact = null) {
  const decisions = Array.isArray(artifact?.userDecisions) ? artifact.userDecisions : [];
  return decisions.length ? decisions[decisions.length - 1] : null;
}

async function loadAiInboxDetail(artifactId) {
  return loadAiInboxDetailForRuntime({
    aiInboxState,
    fetchAiInboxItemWithOptions,
    aiInboxDetailFromResponse,
    rememberAiDebugSnapshot,
    syncAiInboxSummaryFromDetail,
    resetAiInboxSummaryState,
    clearAiInboxActionNotice,
    render: renderAiInboxWorkspace,
    setStatus
  }, artifactId);
}

async function refreshAiInbox({ silent = false, preserveDetail = false } = {}) {
  return refreshAiInboxForRuntime({
    aiInboxState,
    fetchAiInbox,
    normalizeAiInboxFilters,
    aiInboxItemFromCanonical,
    rememberAiDebugSnapshot,
    clearAiInboxActionNotice,
    resetAiInboxSummaryState,
    render: renderAiInboxWorkspace,
    setStatus,
    loadDetail: loadAiInboxDetail
  }, { silent, preserveDetail });
}

async function refreshAiInboxEvaluationSummary({ silent = false } = {}) {
  return refreshAiInboxEvaluationSummaryForRuntime({
    aiInboxState,
    fetchAiInboxEvaluationSummary,
    normalizeAiInboxFilters,
    render: renderAiInboxWorkspace,
    setStatus,
    messages: {
      evaluationFailedStatusMessage: (error) => `AI 建议处理统计加载失败：${String(error?.message || error)}`
    }
  }, { silent });
}

async function openAiInboxModule() {
  await Promise.all([
    refreshAiInbox(),
    refreshAiInboxEvaluationSummary()
  ]);
  if (aiInboxState.selectedArtifactId && !aiInboxState.detail) {
    await loadAiInboxDetail(aiInboxState.selectedArtifactId);
  }
}

async function applyAiInboxFiltersFromUi() {
  aiInboxState.filters = aiInboxFiltersFromUi();
  aiInboxState.detail = null;
  aiInboxState.selectedArtifactId = "";
  await openAiInboxModule();
  setStatus("AI 建议已刷新", "ok");
}

async function openAiInboxNote(noteId = "") {
  const cleanNoteId = String(noteId || "").trim();
  if (!cleanNoteId) return false;
  try {
    if (!state.notes.some((item) => item.id === cleanNoteId)) {
      const fetched = await fetchNote(cleanNoteId);
      if (fetched) state.notes = [mapNoteItem(fetched), ...state.notes.filter((item) => item.id !== cleanNoteId)];
    }
    activateModule("explorer");
    openNoteById(cleanNoteId, { focusDistillation: true, preferTitleSelection: false });
    setStatus(`已回到笔记 ${cleanNoteId}，请在编辑器内继续处理这条建议`, "ok");
    return true;
  } catch (error) {
    setStatus(`打开来源笔记失败：${String(error?.message || error)}`, "warn");
    return false;
  }
}

async function finalizeAiInboxActionRefresh({ preserveDetail = false } = {}) {
  return finalizeAiInboxActionRefreshForRuntime({
    aiInboxState,
    refreshAiInbox,
    refreshAiInboxEvaluationSummary,
    loadAiInboxDetail
  }, { preserveDetail });
}

const aiInboxActionRoutes = createAiInboxActionRoutes(() => ({
  aiInboxState,
  recordAiInboxDecision,
  aiInboxFeedback: aiInboxFeedbackFromUi,
  decisionCommentText: () => $("aiInboxDecisionComment")?.value || "",
  appendDecisionComment: (comment) => {
    const commentEl = $("aiInboxDecisionComment");
    const nextComment = `${commentEl?.value || ""}\n\n${comment}`.trim();
    if (commentEl) commentEl.value = nextComment;
  },
  confirm: (message) => window.confirm(message),
  aiInboxDetailFromResponse,
  loadAiInboxDetail,
  rememberAiDebugSnapshot,
  finalizeAiInboxActionRefresh,
  aiInboxActionLabel,
  setStatus,
  setAiInboxActionNotice,
  clearAiInboxActionNotice,
  render: renderAiInboxWorkspace,
  currentAiInboxArtifactForSelection,
  latestArtifactDecision,
  acceptAiInboxLink,
  promoteAiInboxNote,
  adoptAiInboxFieldSuggestion,
  currentAiInboxSuggestionForSelection,
  aiSuggestionStatusLabel,
  aiInboxSuggestionReviewedContent: aiInboxSuggestionReviewedContentFromUi,
  updateAiSuggestion,
  aiSuggestionAlreadyAppliedNotice,
  afterAcceptFinalize: async () => {
    if (state.module === "graph") await refreshDirectoryGraph();
  },
  beforeNoteResultFinalize: async (result) => {
    if (result.note?.id) {
      state.notes = [mapNoteItem(result.note), ...state.notes.filter((item) => item.id !== result.note.id)];
    }
  },
  afterPromoteFinalize: async (result, context) => {
    if (result.note?.id && !context.selectionChangedDuringAction) {
      activateModule("explorer");
      openNoteById(result.note.id);
    }
  },
  afterAdoptFinalize: async (result, context) => {
    if (result.note?.id && !context.selectionChangedDuringAction) {
      activateModule("explorer");
      openNoteById(result.note.id, { focusDistillation: true });
    }
  }
}));

const {
  acceptAiInboxLinkSuggestion,
  adoptAiInboxFieldSuggestionDraft,
  applyAiInboxRecommendedAction,
  applyAiInboxSuggestionStatus,
  promoteAiInboxArtifactToNote,
  recordAiInboxReviewDecision
} = aiInboxActionRoutes;

function normalizeOptionalNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

const NOTE_SAVE_REFLECTION_PROMPTS = [
  "这段材料你真正理解成什么？",
  "你为什么要保留它？",
  "它会支持什么判断？"
];

const ORIGINALITY_REASON_LABELS = {
  similarity_above_block_threshold: "它仍然过于贴近关联文献的原句",
  similarity_above_warn_threshold: "它还没有完全转成你自己的判断语言",
  citation_locator_missing: "它缺少可追溯的引用定位",
  core_claim_empty: "它的核心判断还不够清楚"
};

function noteSaveReflectionHint(prefix = "") {
  const head = String(prefix || "").trim();
  return `${head ? `${head} ` : ""}${NOTE_SAVE_REFLECTION_PROMPTS.join("  ")}`.trim();
}

function originalityReasonSummary(reasons = []) {
  const labels = [...new Set((reasons || []).map((reason) => ORIGINALITY_REASON_LABELS[String(reason || "").trim()] || "").filter(Boolean))];
  return labels.join("；");
}

function noteSaveFailureFeedback(error) {
  const code = String(error?.code || "").trim();
  if (code === "LITERATURE_PARAPHRASE_REQUIRED") {
    return {
      ok: false,
      saveMode: "blocked",
      saveMessage: noteSaveReflectionHint("当前文件：缺少转述，暂不能标记完成。"),
      statusTone: "warn",
      statusMessage: "保存被拦下：先写出你真正理解后的转述，再把文献笔记标记为已完成。"
    };
  }

  if (code === "PERMANENT_ORIGINALITY_BLOCKED") {
    const originality = error?.details?.originality || {};
    const similarity = Math.round((Number(originality.similarity) || 0) * 100);
    const reasons = originalityReasonSummary(originality.reasons);
    const reasonSuffix = reasons ? ` ${reasons}。` : "";
    return {
      ok: false,
      saveMode: "blocked",
      saveMessage: noteSaveReflectionHint(
        `当前文件：原创性检测阻止落盘。相似度约 ${similarity}%。先把外部语言改写成你自己的判断，再继续保存。`
      ),
      statusTone: "warn",
      statusMessage: `保存被拦下：这条永久笔记仍然过于贴近关联文献原文（相似度 ${similarity}%）。${reasonSuffix}`.trim()
    };
  }

  return {
    ok: false,
    saveMode: "error",
    saveMessage: "当前文件：保存失败，修改仍保留在编辑器中。",
    statusTone: "warn",
    statusMessage: `保存失败（修改已保留在编辑器中）：${String(error?.message || error)}`
  };
}

function renderThinkingStatusBadge(value, className = "thinking-status-badge") { return renderThinkingStatusBadgeHtml(value, { className, escapeHtml }); }

function suggestedWritingProjectTitle(noteIds = []) { return computeSuggestedWritingProjectTitle(noteIds, { noteById: writingNoteById }); }

function normalizeWritingProjectTitleSeed(title = "") { return computeNormalizeWritingProjectTitleSeed(title); }

async function ensureNotesLoaded(noteIds, { force = false } = {}) {
  const uniqueIds = [...new Set((noteIds || []).map((item) => String(item || "").trim()).filter(Boolean))];
  for (const noteId of uniqueIds) {
    const existing = writingNoteById(noteId);
    if (existing) {
      if (force && !isLocalOnlyNote(existing)) {
        try {
          const fetched = await fetchNote(noteId);
          if (!fetched) continue;
          const mapped = mapNoteItem(fetched);
          state.notes = [mapped, ...state.notes.filter((item) => item.id !== mapped.id)];
        } catch {}
        continue;
      }
      if (!existing.bodyLoaded && !isLocalOnlyNote(existing)) {
        await ensureNoteBodyLoaded(noteId);
      }
      continue;
    }
    try {
      const fetched = await fetchNote(noteId);
      if (!fetched) continue;
      const mapped = mapNoteItem(fetched);
      state.notes = [mapped, ...state.notes.filter((item) => item.id !== mapped.id)];
    } catch {}
  }
}

function literatureQueueLaneForNote(note) {
  return computeLiteratureQueueLaneForNote(note, {
    literatureTemplateSectionLabelCandidates,
    normalizeFieldText,
    parseLiteratureWorkspace
  });
}

function rankedLiteratureQueueNotes(notes = []) {
  return computeRankedLiteratureQueueNotes(notes, {
    literatureTemplateSectionLabelCandidates,
    normalizeFieldText,
    parseLiteratureWorkspace
  });
}

function preferredLiteratureQueueNoteId(noteIds = [], { targetLane = "" } = {}) { return computePreferredLiteratureQueueNoteId(noteIds, { targetLane }, { rankedLiteratureQueueNotes, writingNoteById }); }

function setLiteratureQueueFocus(noteIds = [], label = "") {
  state.literatureQueueFocusNoteIds = [...new Set((noteIds || []).map((item) => String(item || "").trim()).filter(Boolean))];
  state.literatureQueueFocusLabel = state.literatureQueueFocusNoteIds.length ? String(label || "").trim() : "";
}

function clearLiteratureQueueFocus() {
  setLiteratureQueueFocus([], "");
}

const writingEntryRuntime = createWritingEntryRuntimeHost(() => ({
  $,
  activateModule,
  applyWritingTab: (tab) => applyWritingTab(tab, { root: $("writingPanel")?.querySelector?.(".writing-shell"), documentRef: document }),
  clearWritingFocusedCandidateScope,
  clearWritingSourceIndexIds,
  ensureNotesLoaded,
  fetchWritingProject,
  listIndexCards,
  listProjectDraftVersions,
  listProjectScaffolds,
  listWritingProjects,
  parseWritingBasketIds,
  refreshWritingRelationCounts,
  renderWritingPanel,
  resetWritingLocalBookIdeas,
  resetWritingProjectContext,
  setSelectedWritingThemeIndex,
  setStatus,
  setWritingBasketIds,
  setWritingFocusedCandidateScope,
  setWritingSourceIndexIds,
  showWritingResult,
  statusRevision,
  syncWritingResultFromCurrentState,
  writingState,
  writingThemeIndexScopeDirectoryId
}));

async function openWritingModule(options = {}) { return writingEntryRuntime.openWritingModule(options); }

function beginWritingEntry(noteIds = [], options = {}) { return writingEntryRuntime.beginWritingEntry(noteIds, options); }

function continueWritingEntry(noteIds = [], options = {}) { return writingEntryRuntime.continueWritingEntry(noteIds, options); }

const writingProjectRuntimeController = createWritingProjectRuntimeController(() => ({
  $,
  activateModule,
  aiFeatureRequestOptions: featureAiRequestOptions,
  aiAvailable: settingsState.ai.routePreview?.access?.ready === true,
  aiRuntimeMode: featureAiRuntimeMode(),
  analyzeWritingWithStrongModel,
  beginWritingEntry,
  createWritingProject,
  currentWritingBookStructure,
  ensureLocalAiReadyForFeature,
  ensureNotesLoaded,
  importState,
  loadWritingDraftVersions,
  loadWritingProjectsList,
  loadWritingScaffoldVersions,
  openWritingModule,
  parseWritingBasketIds,
  populateWritingFormFromProject,
  refreshAiRoutePreview,
  renderSettingsPanel,
  renderWritingPanel,
  setSettingsItem,
  setStatus,
  showWritingResult,
  suggestedWritingProjectTitle,
  syncWritingLocalBookIdeasFromProject,
  window,
  writingKnownNoteById,
  writingState
}));

const importResultHostRoutes = createImportResultHostRoutes(() => ({
  importResultRuntime,
  writingProjectRuntimeController
}));

const {
  activeImportPreviewContext,
  addImportedPermanentNotesToWritingBasket,
  applyCandidateSelection,
  candidateIdsForSelection,
  createWritingProjectFromImportedPermanentNotes,
  defaultSelectedCandidateIds,
  enrichImportHistoryItemsWithLiteratureProgress,
  hideImportOperationResultModal,
  literatureBatchSummaryForPayload,
  openFirstImportedPermanentNote, openImportedLiteratureQueue,
  refreshImportLiteratureBatchSummary,
  renderImportWritingActions,
  renderResult,
  renderWritingResultDetails,
  rerenderImportResult,
  selectedCandidateIdsFor,
  selectionSummary,
  setImportResultFocus,
  showExportResult,
  showImportOperationResultModal,
  showImportResult,
  showWritingResult,
  summarizeLiteratureBatchFromNotes,
  syncImportSelection,
  syncWritingResultFromCurrentState,
  updateImportConfirmButton
} = importResultHostRoutes;

async function createWritingProjectFromCurrentBasket() { return writingProjectRuntimeController.createWritingProjectFromCurrentBasket(); }

async function createReviewOutlineFromTodayChecklist({ themeId = "", noteIds = [] } = {}) {
  const cleanThemeId = String(themeId || "").trim();
  const cleanNoteIds = uniqueStrings(noteIds);
  await openWritingModule({
    statusMessage: "",
    entryReason: "这组主题已经有足够相关笔记，可以先生成提纲再决定是否起草。",
    entrySourceLabel: "定期回顾清单"
  });
  let selectedTheme = null;
  let outlineNoteIds = cleanNoteIds;
  if (cleanThemeId) {
    selectedTheme = await selectWritingThemeIndex(cleanThemeId);
    outlineNoteIds = writingThemeIndexNoteIds(selectedTheme);
  }
  const existingProject = cleanThemeId
    ? await findReviewOutlineProjectWithRefresh({
        indexCard: selectedTheme,
        noteIds: outlineNoteIds,
        writingState,
        listWritingProjects
      })
    : writingEntryProjectForContext({ basketNoteIds: outlineNoteIds, sourceIndexIds: [writingState.selectedThemeIndexId, ...writingState.sourceIndexIds] });
  if (existingProject?.id) {
    const project = await continueWritingProjectEntry(existingProject.id, {
      openDraft: false,
      statusMessage: existingProject.scaffold_id ? "已打开已有写作主题和文章提纲。" : "已打开已有写作主题，继续生成文章提纲。"
    });
    const scaffoldId = project?.scaffold_id || existingProject.scaffold_id || "";
    if (scaffoldId) {
      await openScaffoldVersion(scaffoldId);
      setStatus("已打开已有文章提纲。", "ok");
      return project;
    }
  } else if (cleanThemeId) {
    await createWritingProjectFromThemeIndex(cleanThemeId);
  } else if (!writingState.project?.id) {
    if (outlineNoteIds.length) addWritingBasketIds(outlineNoteIds);
    await createWritingProjectFromCurrentBasket();
  } else if (outlineNoteIds.length) {
    addWritingBasketIds(outlineNoteIds);
  }
  return handleWritingCreateScaffoldClick({
    $,
    writingState,
    currentWritingContinuationEntry,
    continueWritingProjectEntry,
    writingCenterContinuationStatusMessage,
    writingCenterContinuationFailureMessage,
    createDraftScaffold,
    currentWritingVersionNote,
    showWritingResult,
    loadWritingProjectsList,
    loadWritingScaffoldVersions,
    loadWritingDraftVersions,
    renderWritingPanel,
    setStatus
  });
}

async function useThemeIndexAsWritingEntry(indexCardId, { replaceBasket = false, resetContext = false, source = "writing_theme_index" } = {}) {
  const id = String(indexCardId || "").trim();
  if (!id) throw new Error("indexCardId is required");
  const previousSelectedThemeIndexId = String(writingState.selectedThemeIndexId || "").trim();
  const indexCard = writingThemeIndexById(id) || (await fetchIndexCard(id));
  const noteIds = uniqueStrings(indexCard?.item_note_ids || indexCard?.items?.map((item) => item.note_id) || []);
  if (!noteIds.length) throw new Error("theme index is empty");
  await ensureNotesLoaded(noteIds);
  const entryPlan = planWritingThemeIndexEntry({
    existingNoteIds: parseWritingBasketIds(),
    themeNoteIds: noteIds,
    resetContext,
    replaceBasket
  });
  if (entryPlan.action === "begin-entry") {
    beginWritingEntry(noteIds, {
      title: normalizeWritingProjectTitleSeed(indexCard.title || suggestedWritingProjectTitle(noteIds)),
      source
    });
    setWritingSourceIndexIds([id]);
  } else if (entryPlan.action === "replace-entry") {
    continueWritingEntry(noteIds, {
      title: normalizeWritingProjectTitleSeed(indexCard.title || suggestedWritingProjectTitle(noteIds)),
      source,
      sourceIndexIds: [id],
      preserveSourceIndexIds: entryPlan.preserveSourceIndexIds
    });
  } else {
    if (entryPlan.action === "append-entry") {
      continueWritingEntry(noteIds, {
        title: normalizeWritingProjectTitleSeed(indexCard.title || suggestedWritingProjectTitle(noteIds)),
        source,
        sourceIndexIds: [id]
      });
    } else {
      const nextSourceIndexIds = resolveWritingSourceIndexIds({
        existingSourceIndexIds: writingState.sourceIndexIds,
        incomingSourceIndexIds: [id],
        preserveExisting: true
      });
      setWritingSourceIndexIds(nextSourceIndexIds);
      setSelectedWritingThemeIndex(
        resolveWritingSelectedThemeIndexId({
          currentSelectedThemeIndexId: writingState.selectedThemeIndexId,
          nextSourceIndexIds
        })
      );
    }
  }
  // “开始写” must leave one concrete topic selected for the next action.
  setSelectedWritingThemeIndex(id);
  syncWritingThemeFormFields({
    $,
    indexCard,
    noteIds,
    previousSelectedThemeIndexId,
    selectedThemeIndexId: id,
    normalizeWritingProjectTitleSeed,
    suggestedWritingProjectTitle
  });
  renderWritingPanel();
  return {
    indexCard,
    noteIds,
    addedNoteIds: entryPlan.addedNoteIds,
    addedCount: entryPlan.addedNoteIds.length
  };
}

async function saveWritingBasketAsThemeIndex() {
  const basketNoteIds = parseWritingBasketIds();
  if (!basketNoteIds.length) throw new Error("writing basket is empty");
  if (basketNoteIds.length < THEME_INDEX_MIN_NOTE_COUNT) {
    throw new Error(`至少需要 ${THEME_INDEX_MIN_NOTE_COUNT} 条相关永久笔记，才适合保存为可写主题`);
  }
  await ensureNotesLoaded(basketNoteIds);
  const suggestedTitle = suggestedThemeIndexTitle(basketNoteIds);
  const title = window.prompt("可写主题标题", suggestedTitle);
  if (title === null) return null;
  const cleanTitle = String(title || "").trim();
  if (!cleanTitle) throw new Error("title is required");
  const summarySeed = String($("writingGoal")?.value || "").trim() || "把这一组成熟永久笔记保留为后续可续接的写作入口。";
  const summary = window.prompt("可写主题说明", summarySeed);
  if (summary === null) return null;
  const themePayload = buildThemeIndexCreatePayload({
    directoryId: writingThemeIndexScopeDirectoryId(),
    noteIds: basketNoteIds,
    title: cleanTitle,
    noteById: writingNoteById
  });
  const customSummary = String(summary || "").trim();
  const card = await createIndexCard({
    ...themePayload,
    summary: customSummary ? `${themePayload.summary}\n\n${customSummary}` : themePayload.summary
  });
  setWritingSourceIndexIds([card.id]);
  await loadWritingThemeIndexes();
  renderWritingPanel();
  return card;
}

const writableThemeDiscoveryController = createWritableThemeDiscoveryController(() => ({
  writingState,
  candidateNotes: writingCandidateNotes,
  relations: () => graphState.item?.edges || [],
  existingThemeIndexes: () => writingState.themeIndexes,
  ignoredSuggestionKeys: () => writingState.ignoredThemeDiscoverySuggestionKeys,
  aiTopicCandidates: () => graphState.aiAnalysis?.topicCandidates || [],
  parseTags,
  noteById: writingNoteById,
  createIndexCard,
  writingThemeIndexScopeDirectoryId,
  upsertWritingThemeIndex,
  setWritingSourceIndexIds,
  setSelectedWritingThemeIndex,
  useThemeIndexAsWritingEntry,
  openWritingModule,
  renderWritingPanel,
  setStatus
}));

function refreshWritableThemeDiscoverySuggestions() { return writableThemeDiscoveryController.refreshSuggestions(); }

function ignoreWritableThemeDiscoverySuggestion(suggestionId = "") { return writableThemeDiscoveryController.ignoreSuggestion(suggestionId); }

async function saveWritableThemeDiscoverySuggestion(suggestionId = "", draft = {}) {
  return writableThemeDiscoveryController.saveSuggestion(suggestionId, draft);
}

const writingThemeProjectRuntime = createWritingThemeProjectRuntime({
  $,
  createWritingProject,
  currentWritingBookStructure: (...args) => currentWritingBookStructure(...args),
  deriveBasketWritingReadiness,
  deriveWritingProjectIntent,
  deriveWritingProjectTakeaway,
  describeWritingContinuationAction,
  describeWritingThemeProjectEntryState,
  findExistingWritingProjectForTheme,
  isDirectoryUnderOriginalRoot,
  loadWritingDraftVersions,
  loadWritingProjectsList,
  loadWritingScaffoldVersions,
  normalizeAuthorshipItem,
  normalizeWritingProjectTitleSeed,
  populateWritingFormFromProject,
  renderWritingPanel: (...args) => renderWritingPanel(...args),
  sameUniqueStringSet,
  showWritingResult,
  syncWritingLocalBookIdeasFromProject,
  useThemeIndexAsWritingEntry,
  writingKnownNoteById,
  writingState,
  writingThemeIndexNoteIds,
  writingRelationCountsErrored,
  writingRelationCountsReady,
  writingThemeNotesLoaded
});

async function refreshWritingProjectState() {
  const writingProjectId = String(writingState.project?.id || "").trim();
  if (!writingProjectId) return null;
  try {
    const project = await fetchWritingProject(writingProjectId);
    writingState.project = project;
    renderWritingPanel();
    return project;
  } catch {
    return writingState.project;
  }
}

async function refreshImportedNotesView() {
  try {
    await syncDirectoriesFromApi();
    await syncNotesForDirectory(state.selectedFolderId);
    renderAll();
  } catch (error) {
    if (isApiConnectionError(error)) setStatus(apiConnectionErrorMessage(error), "bad", { force: true, holdMs: 10000, priority: 5 });
  }
}

function mapNoteItem(item) {
  return computeMapNoteItem(item, {
    generatedOriginalNoteIdFromBody,
    normalizeAuthorshipItem,
    normalizeOptionalNumber,
    normalizeThinkingStatusItem,
    relationNetworkStatusForNote,
    state,
    typeFromFolder
  });
}

function isLocalOnlyNote(note) { return Boolean(note?.isLocalOnly); }

const UNTITLED_NOTE_TITLE = "未命名笔记";
const STARTUP_NOTE_FOLDER_ID = "dir_original_default";

const notePlaceholderRuntime = createNotePlaceholderRuntime(() => ({
  applyTitleToNoteTemplate,
  deleteNote,
  ensureEditableNoteBody,
  fetchNote,
  generatedOriginalNoteIdFromBody,
  initialBodyForFolder,
  isLocalOnlyNote,
  mapNoteItem,
  normalizeNoteTemplateHistory,
  normalizeNoteTemplateSource,
  noteTabFor,
  parseWritingBasketIds,
  relationNetworkStatusForNote,
  setWritingBasketIds,
  settingsState,
  state,
  typeFromFolder,
  uid,
  untitledNoteTitle: UNTITLED_NOTE_TITLE,
  validateLiteratureTemplateSource
}));

function createLocalDraftNote({ folderId, body }) { return notePlaceholderRuntime.createLocalDraftNote({ folderId, body }); }

function isUntitledTitle(title = "") { return notePlaceholderRuntime.isUntitledTitle(title); }

function normalizedDefaultUntitledBody(folderId = "") { return notePlaceholderRuntime.normalizedDefaultUntitledBody(folderId); }

function historicalUntitledTemplateBodies(folderId = "") { return notePlaceholderRuntime.historicalUntitledTemplateBodies(folderId); }

function isEmptyUntitledMarkdown(body = "", folderId = "") { return notePlaceholderRuntime.isEmptyUntitledMarkdown(body, folderId); }

async function refreshUntitledPlaceholderForCurrentTemplate(note) { return noteRuntimeController.refreshUntitledPlaceholderForCurrentTemplate(note); }

function noteTabFor(noteId = "") { return state.tabs.find((item) => item.noteId === noteId) || null; }

function isUntitledPlaceholderNote(note) { return notePlaceholderRuntime.isUntitledPlaceholderNote(note); }

async function ensureNoteLoadedForPlaceholderCheck(note) { return notePlaceholderRuntime.ensureNoteLoadedForPlaceholderCheck(note); }

async function cleanupDuplicateUntitledPlaceholders(folderId) { return notePlaceholderRuntime.cleanupDuplicateUntitledPlaceholders(folderId); }

function replaceLocalNoteIdentity(previousNoteId, savedItem) { return notePlaceholderRuntime.replaceLocalNoteIdentity(previousNoteId, savedItem); }

function upsertNotesForDirectory(folderId, mappedNotes) {
  const keep = state.notes.filter((n) => n.folderId !== folderId);
  const localOnly = state.notes.filter((n) => n.folderId === folderId && isLocalOnlyNote(n));
  state.notes = [...localOnly, ...mappedNotes, ...keep];
}

function upsertGraphNodeSummaries(nodes = []) {
  const mapped = nodes.map(mapNoteItem);
  const byId = new Map(state.notes.map((note) => [note.id, note]));
  for (const node of mapped) {
    const existing = byId.get(node.id);
    if (existing?.bodyLoaded) {
      Object.assign(existing, {
        title: node.title,
        folderId: node.folderId,
        noteType: node.noteType,
        status: node.status,
        markdownPath: node.markdownPath,
        updatedAt: node.updatedAt
      });
    } else {
      byId.set(node.id, { ...(existing || {}), ...node });
    }
  }
  state.notes = Array.from(byId.values());
}

function replaceFirstMarkdownTitle(body, title) {
  const cleanTitle = String(title || "未命名笔记").trim() || "未命名笔记";
  const lines = String(body || "").replace(/\r\n/g, "\n").split("\n");
  if (!lines.length || !String(lines[0] || "").trim()) return `# ${cleanTitle}\n`;
  if (/^#{1,6}\s+/.test(lines[0])) {
    lines[0] = `# ${cleanTitle}`;
    return lines.join("\n");
  }
  lines[0] = `# ${cleanTitle}`;
  return lines.join("\n");
}

function titleFromSeedText(text, fallback = "未命名笔记") {
  const clean = String(text || "")
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)[0] || "";
  const singleLine = clean.replace(/^#+\s*/, "").replace(/\s+/g, " ").trim();
  return (singleLine || String(fallback || "").trim() || "未命名笔记").slice(0, 48);
}

function citationSummaryLines(citation = {}) {
  const fields = citation && typeof citation === "object" ? citation : {};
  const lines = [
    fields.sourceTitle ? `- 文献标题：${fields.sourceTitle}` : "",
    fields.authors ? `- 作者：${fields.authors}` : "",
    fields.year ? `- 年份：${fields.year}` : "",
    fields.container ? `- 容器：${fields.container}` : "",
    fields.publisher ? `- 出版社 / 来源：${fields.publisher}` : "",
    fields.locator ? `- 页码 / 定位：${fields.locator}` : "",
    fields.identifier ? `- DOI / ISBN / arXiv / URL / PDF：${fields.identifier}` : ""
  ].filter(Boolean);
  return lines.length ? lines : ["- 引用信息：尚未补齐"];
}

function originalDraftBodyFromSource(payload = {}) {
  const sourceType = String(payload.sourceType || "").trim().toLowerCase();
  if (sourceType === "literature") {
    const parsed = parseLiteratureWorkspace(payload.sourceBody || payload.body || "", {
      sectionLabelCandidates: literatureTemplateSectionLabelCandidates()
    });
    const sourceTitle = String(payload.sourceTitle || "").trim() || "未命名文献笔记";
    const claim = String(payload.paraphrase || parsed.paraphrase || "").trim();
    const whyKeep = String(payload.whyKeep || parsed.whyKeep || "").trim();
    const supportsJudgment = String(payload.supportsJudgment || parsed.supportsJudgment || "").trim();
    const question = String(payload.question || parsed.question || "").trim();
    const boundary = String(payload.boundary || parsed.boundary || "").trim();
    const originalText = String(payload.originalText || parsed.originalText || "").trim();
    const citation = payload.citation && typeof payload.citation === "object" ? payload.citation : parsed.citation;
    const titleSeed =
      sourceTitle === "未命名文献笔记"
        ? titleFromSeedText(citation?.sourceTitle || supportsJudgment || question || claim || originalText, "未命名永久笔记")
        : sourceTitle;
    const relatedClues = [
      `- 来自文献笔记：[[${sourceTitle}]]`,
      payload.sourceNoteId ? `- 来源笔记 ID：${payload.sourceNoteId}` : "",
      ...citationSummaryLines(citation)
    ]
      .filter(Boolean)
      .join("\n");
    const supplement = [
      claim ? "- 已有用户转述仍保留在来源文献笔记中，写永久笔记时请继续改写，不要直接复述。" : "",
      whyKeep ? `- 来源文献里的保留原因：${whyKeep}` : "",
      question ? `- 还待回答的追问：${question}` : "",
      originalText ? "- 原文摘录与证据链仍以来源文献笔记为准，永久笔记里不重复复制。" : "",
      supportsJudgment ? `- 来源里的判断种子：${supportsJudgment}` : ""
    ]
      .filter(Boolean)
      .join("\n");
    return composePermanentTemplateDraft({
      title: titleSeed,
      coreClaim: supportsJudgment
        ? "从来源文献里的判断种子继续改写成一句你自己的原创判断，不要直接复述摘录或文献笔记原句。"
        : "把这条文献转述继续改写成一句你自己的原创判断，不要直接复述摘录或文献笔记原句。",
      whyTrue: question
        ? "先回答来源文献里留下的追问，再说明这条判断为什么成立，以及它依赖哪些证据或观察。"
        : "用你自己的理由说明这条判断为什么成立，以及它依赖哪些证据或观察。",
      boundary: boundary ? "把来源文献里的边界或反例改写成这条判断的适用条件，不要只复制原句。" : "写出这条判断在哪些条件下不成立，或最容易被什么反例推翻。",
      relatedClues,
      supplement
    });
  }
  const sourceTitle = String(payload.sourceTitle || "").trim() || "未命名随笔笔记";
  const sourceBody = stripGeneratedOriginalMarker(String(payload.sourceBody || payload.body || "").trim());
  const excerpt = sourceBody
    .replace(/^#\s+[^\n]*\n?/m, "")
    .trim();
  const titleSeed = titleFromSeedText(excerpt || sourceTitle, sourceTitle === "未命名随笔笔记" ? "未命名永久笔记" : sourceTitle);
  return composePermanentTemplateDraft({
    title: titleSeed,
    coreClaim: "把这条随笔里已经开始成形的判断，改写成一句更清楚、可复用的原创观点。",
    whyTrue: "补上这条判断为什么值得成立、依赖了哪些观察或经验。",
    boundary: "写出它在哪些条件下不成立，或还有哪些地方需要继续验证。",
    relatedClues: [`- 来自随笔笔记：[[${sourceTitle}]]`, payload.sourceNoteId ? `- 来源笔记 ID：${payload.sourceNoteId}` : ""]
      .filter(Boolean)
      .join("\n"),
    supplement: excerpt ? `- 原始材料摘录：${excerpt}` : ""
  });
}

async function syncDirectoriesFromApi() {
  const items = await fetchDirectories(true);
  if (!items.length) return;
  state.folders = items.map(mapDirectoryItem);
  const selectedExists = state.folders.some((f) => f.id === state.selectedFolderId);
  if (!selectedExists) {
    state.selectedFolderId = state.browserRootId;
  }
}

async function syncNotesForDirectory(folderId) {
  if (!folderId) return;
  const items = await fetchDirectoryNotes(folderId);
  const mapped = items.map(mapNoteItem);
  upsertNotesForDirectory(folderId, mapped);
}

async function syncLoadedNotesForDirectories(directoryIds = []) {
  const ids = [...new Set(directoryIds.map((item) => String(item || "").trim()).filter(Boolean))];
  for (const directoryId of ids) {
    if (!state.notes.some((note) => note.folderId === directoryId)) continue;
    await syncNotesForDirectory(directoryId);
  }
}

async function syncNotesForDirectoryTree(rootDirectoryId) {
  const rootId = String(rootDirectoryId || "").trim();
  if (!rootId) return;
  const directoryIds = descendantDirectoryIds(rootId).filter((id) => folderById(state, id));
  for (const directoryId of directoryIds) {
    await syncNotesForDirectory(directoryId);
  }
}

function descendantDirectoryIds(directoryId) {
  const result = [];
  const queue = [directoryId];
  const seen = new Set();
  while (queue.length) {
    const currentId = queue.shift();
    if (!currentId || seen.has(currentId)) continue;
    seen.add(currentId);
    result.push(currentId);
    for (const folder of state.folders) {
      if (folder.parentId === currentId) queue.push(folder.id);
    }
  }
  return result;
}

function renamedDirectoryFsPath(folder, nextTitle) {
  if (!folder?.fsPath) return "";
  return joinLocalPath(dirnameLocalPath(folder.fsPath), nextTitle);
}

function movedDirectoryFsPath(folder, targetParentFolder) {
  if (!folder?.fsPath || !targetParentFolder?.fsPath) return "";
  const baseName = basenameLocalPath(folder.fsPath) || folder.name || "folder";
  return joinLocalPath(targetParentFolder.fsPath, baseName);
}

function ensureSelection() {
  const visible = state.folders.filter((f) => !f.hidden);
  const scoped = visible.filter((f) => rootBoxIdFromFolder(state, f.id) === state.browserRootId);
  const source = scoped.length ? scoped : visible;
  if (!folderById(state, state.selectedFolderId) || folderById(state, state.selectedFolderId)?.hidden) {
    state.selectedFolderId = source[0]?.id || state.browserRootId;
  }
  createBoxDialog.setOptions(source);
}

function renderExplorerSidebarFlow(rootId = state.browserRootId) {
  const element = $("sidebarFlow");
  if (element) {
    element.innerHTML = "";
    element.classList.add("hidden");
  }
  return null;
}

function renderSmartNotesDemoGuide() {
  const element = $("demoGuidePanel");
  if (!element) return null;
  const flow = buildSmartNotesDemoWalkthrough({
    notes: state.notes,
    completedSteps: state.smartNotesDemoCompletedSteps
  });
  if (!flow) {
    element.classList.add("hidden");
    element.innerHTML = "";
    return null;
  }
  element.innerHTML = renderSmartNotesDemoGuidePanel(flow, { escapeHtml });
  element.classList.remove("hidden");
  return flow;
}

function syncNewNoteButtons() {
  const copy = explorerNewNoteButtonCopy(state);
  const label = copy.title || copy.label;
  const sidebarNew = $("btnNewNote");
  const mobileNew = $("btnMobileNewNote");
  for (const button of [sidebarNew, mobileNew].filter(Boolean)) {
    button.title = label;
    button.setAttribute("aria-label", label);
    button.dataset.tip = label;
    button.dataset.noteEntryKind = copy.entryKind || "permanent";
  }
  const mobileLabel = mobileNew?.querySelector("span");
  if (mobileLabel) mobileLabel.textContent = "";
}

const sidebarTitleController = createSidebarTitleController({
  depsProvider: createSidebarTitlePrototypeDepsProvider(() => ({
    state,
    folderById,
    $,
    documentRef: document,
    windowRef: typeof window !== "undefined" ? window : null,
    displayFolderName,
    currentModuleUi,
    syncNewNoteButtons
  }))
});
const {
  renderSidebarTitle
} = sidebarTitleController;

const moduleWorkspaceHeaderRuntimeRoutes = createModuleWorkspaceHeaderRuntimeRoutes(() => ({
  $,
  activateModule,
  applyAiModelPackChange,
  currentAiProviderId,
  escapeHtml,
  folderById,
  refreshAiRoutePreview,
  renderSettingsPanel,
  settingsModuleHeaderCopy,
  settingsSidebarNavigationHtml,
  settingsState,
  setStatus,
  todayReturnTarget,
  state
}));

const { currentModuleUi, renderModuleWorkspaceHeader } = moduleWorkspaceHeaderRuntimeRoutes;

function isPermanentLikeNote(note = null) {
  const noteType = String((note?.folderId ? typeFromFolder(state, note.folderId) : "") || note?.noteType || "").trim().toLowerCase();
  return noteType === "permanent" || noteType === "original";
}

const saveAiSuggestionWorkflowRoutes = createSaveAiSuggestionWorkflowRoutes(() => ({
  $,
  activeEditorBody,
  activeEditorNote,
  dismissedSaveAiSuggestionKeys,
  distillationStatusOf,
  getSaveAiSuggestion: () => saveAiSuggestion,
  isOriginalRecordableSource,
  isEmptyUntitledMarkdown,
  isPermanentLikeNote,
  noteHasGeneratedOriginal,
  saveAiSuggestionKey,
  setSaveAiSuggestion: (suggestion) => {
    saveAiSuggestion = suggestion;
  },
  state,
  typeFromFolder,
  resolveSystemMessageByDedupeKey,
  upsertSystemMessage: (message) => upsertSystemMessage(message, { preserveRead: true })
}));

const {
  clearSaveAiSuggestion,
  relationNetworkWorkflowMessageForNote,
  renderSaveAiSuggestion,
  saveAiSuggestionForNote,
  showSaveAiSuggestionForNote,
  sourcePromotionWorkflowMessageForNote,
  syncRelationNetworkSystemMessageForNote,
  syncSourcePromotionSystemMessageForNote
} = saveAiSuggestionWorkflowRoutes;

function distillationQueueItems() {
  const rank = { needs_thesis: 0, needs_summary: 1, needs_confirm: 2, confirmed: 3 };
  return state.notes
    .filter((note) => isPermanentLikeNote(note))
    .map((note) => {
      const status = distillationStatusOf(note);
      const stage = distillationStageOf(note);
      return {
        note,
        status,
        stage,
        reason: distillationReasonOf(note),
        rank: rank[stage] ?? 9
      };
    })
    .sort((a, b) => a.rank - b.rank || String(b.note.updatedAt || "").localeCompare(String(a.note.updatedAt || "")));
}

function directoryPathLabel(directoryId) { return computeDirectoryPathLabel(directoryId, { folderById, state }); }

const directoryOptionRuntime = createDirectoryOptionRuntime(() => ({
  $,
  directoryPathLabel,
  displayFolderName,
  escapeHtml,
  folderById,
  isDirectoryUnderOriginalRoot,
  lastChosenPermanentDirectoryId: () => lastChosenPermanentDirectoryId,
  preferredImportDirectoryIdFromOptions,
  rootBoxIdFromFolder,
  state
}));

const {
  confirmedImportTargetDirectoryId,
  defaultPermanentDirectoryId,
  importTargetDirectories,
  noteMoveDirectoryOptions,
  permanentDirectoryDialogOptions,
  permanentExportDirectories,
  preferredImportDirectoryId,
  selectedExportDirectoryLabel,
  syncExportDirectoryOptions,
  updateExportTargetHint
} = directoryOptionRuntime;

function activeEditorNote() {
  const activeTab = state.tabs.find((tab) => tab.id === state.activeTabId);
  if (!activeTab) return null;
  return state.notes.find((note) => note.id === activeTab.noteId) || null;
}

function activeEditorBody() {
  const activeTab = state.tabs.find((tab) => tab.id === state.activeTabId);
  return String(activeTab?.body || activeEditorNote()?.body || "");
}

function applyExplorerSelectionContext({
  note = null,
  noteId = "",
  folderId = "",
  clearSelectedFile = false,
  syncSearch = false,
  expandFolder = true
} = {}) {
  const resolvedNote =
    note?.id
      ? note
      : noteId
        ? state.notes.find((item) => item.id === String(noteId || "").trim()) || null
        : null;
  if (resolvedNote?.id) {
    const folder = folderById(state, resolvedNote.folderId);
    if (!folder) return false;
    state.selectedFileId = resolvedNote.id;
    state.selectedFolderId = folder.id;
    state.browserRootId = rootBoxIdFromFolder(state, folder.id);
    if (syncSearch && !noteMatchesSearchQuery(resolvedNote, state.searchQuery)) {
      state.searchQuery = "";
      const searchInput = $("searchInput");
      if (searchInput) searchInput.value = "";
    }
    if (expandFolder) explorer?.expandFolderPath?.(folder.id);
    return true;
  }

  const cleanFolderId = String(folderId || "").trim();
  const folder = cleanFolderId ? folderById(state, cleanFolderId) : null;
  if (folder) {
    state.selectedFolderId = folder.id;
    state.browserRootId = rootBoxIdFromFolder(state, folder.id);
    if (clearSelectedFile) state.selectedFileId = null;
    if (expandFolder) explorer?.expandFolderPath?.(folder.id);
    return true;
  }

  if (clearSelectedFile) state.selectedFileId = null;
  return false;
}

function syncExplorerContextToNote(note = null) { return applyExplorerSelectionContext({ note, syncSearch: true, expandFolder: true }); }

function syncExplorerContextToActiveTab() {
  const activeTab = state.tabs.find((tab) => tab.id === state.activeTabId);
  return activeTab?.noteId
    ? applyExplorerSelectionContext({ noteId: activeTab.noteId, syncSearch: true, expandFolder: true })
    : applyExplorerSelectionContext({ clearSelectedFile: true, expandFolder: false });
}

function noteGrowthStage(note, body = "") {
  const noteType = String((note?.folderId ? typeFromFolder(state, note.folderId) : "") || note?.noteType || "").toLowerCase();
  const text = String(body || note?.body || "");
  const tagCount = parseTags(text).length;
  const linkCount = parseLinks(text).length;
  const bodyLength = text.replace(/\s+/g, "").length;

  if (noteType === "fleeting") return "捕捉中";
  if (noteType === "literature") return "转述中";
  if (linkCount >= 2 || (linkCount >= 1 && tagCount >= 2)) return "已有关系";
  if (bodyLength >= 140 || tagCount >= 2) return "正在成形";
  return "提炼中";
}

function renderStatusMeta() {
  return;
}

function renderWorkspaceStatusHint() {
  const helper = $("editorHelper");
  if (!helper) return;
  const kicker = $("editorHelperKicker");
  const title = $("editorHelperTitle");
  const body = $("editorHelperBody");
  const action = $("btnEditorHelperAction");
  const visibility = editorHelperShouldHide({
    elementsReady: Boolean(kicker && title && body && action),
    dismissed: editorHelperDismissed,
    muted: editorHelperMuted,
    module: state.module
  });
  if (visibility.hide) {
    hideEditorHelper();
    return;
  }
  const activeNote = activeEditorNote();
  const activeBody = activeEditorBody();
  const model = buildWorkspaceStatusHintModel({
    activeNote,
    activeBody,
    noteType: editorHelperNoteType(activeNote, { typeFromFolder: (folderId) => typeFromFolder(state, folderId) }),
    focusMode: state.focusMode,
    growthStage: activeNote ? noteGrowthStage(activeNote, activeBody) : "",
    hasGeneratedOriginal: activeNote ? noteHasGeneratedOriginal(activeNote) : false,
    generatedOriginalNoteId: activeNote ? noteGeneratedOriginalNoteId(activeNote) : "",
    isPermanentLike: activeNote ? isPermanentLikeNote(activeNote) : false
  });
  if (!model.visible) {
    hideEditorHelper();
    return;
  }
  action.dataset.helperAction = model.helperAction || "noop";
  action.dataset.targetNoteId = model.targetNoteId || "";
  helper.hidden = false;
  helper.setAttribute("aria-hidden", "false");
  helper.style.pointerEvents = "";
  helper.classList.remove("hidden");
  kicker.textContent = model.kicker || "";
  title.textContent = model.title || "";
  body.textContent = model.body || "";
  action.textContent = model.actionText || "";
}

function applyFocusModeChrome() {
  const focusActive = state.module === "explorer" && Boolean(state.focusMode);
  document.querySelector(".app")?.setAttribute("data-focus-mode", focusActive ? "true" : "false");
  if (focusActive) editor?.setInspectorVisible?.(false);
  const focusButton = $("btnFocusMode");
  if (focusButton) {
    focusButton.classList.toggle("active", focusActive);
    focusButton.setAttribute("aria-pressed", focusActive ? "true" : "false");
    focusButton.title = focusActive ? "退出专注模式" : "专注模式：收起导航和关联，只保留当前笔记";
    focusButton.dataset.tip = focusActive ? "退出专注模式" : "专注模式：收起导航和关联，只保留当前笔记";
    const label = focusButton.querySelector("span");
    if (label) label.textContent = focusActive ? "退出专注" : "专注模式";
  }
  const intentNote = $("editorIntentNote");
  if (intentNote) {
    intentNote.textContent = focusActive
      ? "你现在处在低干扰视图里，先把核心判断写清楚，再决定是否补连接与标签。"
      : "这里不强调更快完成，而强调更清楚地形成观点、边界与连接。";
  }
}

function renderDistillationPanel() {
  const panel = $("distillationPanel");
  if (!panel) return;
  panel.innerHTML = renderDistillationPanelView({
    items: distillationQueueItems(),
    activeFilter: distillationState.filter || "all"
  }, {
    escapeHtml,
    titleFromBody,
    distillationStatusLabel
  });
}

async function refreshDistillationNotes() {
  const rootId = "dir_original_default";
  const directoryIds = descendantDirectoryIds(rootId).filter((id) => folderById(state, id));
  for (const directoryId of directoryIds) {
    await syncNotesForDirectory(directoryId);
  }
  renderDistillationPanel();
}

async function openDistillationModule() {
  try {
    await refreshDistillationNotes();
    setStatus("已打开观点整理", "ok");
  } catch (error) {
    renderDistillationPanel();
    setStatus(`观点整理待处理列表刷新失败：${String(error?.message || error)}`, "warn");
  }
}

async function openDistillationQueueNote(noteId = "") {
  return openDistillationQueueNoteRoute(noteId, {
    documentRef: document,
    queueMicrotaskRef: queueMicrotask,
    state,
    editor,
    ensureNoteBodyLoaded,
    openNoteById,
    distillationStageOf,
    renderAll,
    setStatus
  });
}

const renderAppShellController = createRenderAppShellController({
  depsProvider: createRenderAppShellPrototypeDepsProvider(() => ({
    state,
    explorer,
    editor,
    ensureSelection,
    syncRailSelectionState,
    renderSidebarTitle,
    renderModulePanels,
    syncExportDirectoryOptions,
    renderAiInboxWorkspace,
    renderDistillationPanel,
    renderGraphPanel,
    renderSettingsPanel,
    renderExplorerSidebarFlow,
    renderSmartNotesDemoGuide,
    renderWritingPanel,
    applyFocusModeChrome,
    renderStatusMeta,
    renderWorkspaceStatusHint,
    renderSaveAiSuggestion,
    renderSystemMessages
  }))
});
const {
  renderAll
} = renderAppShellController;

function explorerQuickAction(rootId = state.browserRootId) {
  if (rootId === "dir_fleeting_default") return "quick-fleeting";
  if (rootId === "dir_literature_default") return "quick-literature";
  return "quick-original";
}

function syncRailSelectionState() {
  const todayState = todayOrganizingRuntime.currentState();
  const todayHasTasks = todayRailHasTasks(todayState);
  syncRailSelectionDom({
    document,
    currentQuickAction: explorerQuickAction(),
    currentModule: state.module,
    updateAvailable: shouldShowUpdateAttention(settingsState.update),
    todayHasTasks
  });
}

function currentVaultPath() { return settingsState.vault?.vaultPath || ""; }

function resolveNotePath(note) {
  if (!note) return "";
  if (note.markdownPath && currentVaultPath()) return joinLocalPath(currentVaultPath(), note.markdownPath);
  const folder = folderById(state, note.folderId);
  if (!folder?.fsPath) return "";
  const fileName = `${note.id}.md`;
  return joinLocalPath(folder.fsPath, fileName);
}

function standaloneEditorUrl(noteId = "") {
  const baseUrl = `${window.location.origin}/app/editor`;
  const id = String(noteId || "").trim();
  return id ? `${baseUrl}?note=${encodeURIComponent(id)}` : baseUrl;
}

function openStandaloneEditorWindow(noteId = "") {
  const url = standaloneEditorUrl(noteId);
  window.open(url, "_blank", "noopener,noreferrer");
  return url;
}

function ensureEditableNoteBody(body = "") {
  const value = String(body || "").replace(/\r\n/g, "\n");
  if (!value.trim()) return "# 未命名笔记\n\n";
  return /\n\s*\n\s*$/.test(value) ? value : `${value}\n\n`;
}

function literatureNoteTemplateBody(title = "未命名笔记") { return applyTitleToNoteTemplate(effectiveSavedNoteTemplateSource("literature"), title, "literature"); }

function permanentNoteTemplateBody(title = "未命名笔记") { return applyTitleToNoteTemplate(effectiveSavedNoteTemplateSource("permanent"), title, "permanent"); }

function initialBodyForFolder(folderId = "") {
  const noteType = typeFromFolder(state, folderId);
  if (noteType === "literature") return literatureNoteTemplateBody();
  if (noteType === "original" || noteType === "permanent") return permanentNoteTemplateBody();
  return "# 未命名笔记\n\n";
}

async function createNoteInSelectedFolder(options = {}) {
  const folderId = state.selectedFolderId;
  const preferTitleSelection = options.preferTitleSelection !== false;
  const openInStandalone = options.openInStandalone === true;
  const reuseUntitled = options.reuseUntitled !== false;
  const preferPlainEditor = options.preferPlainEditor === true;
  try {
    const cleanup = await cleanupDuplicateUntitledPlaceholders(folderId);
    if (reuseUntitled && cleanup.kept) {
      await refreshUntitledPlaceholderForCurrentTemplate(cleanup.kept);
      if (openInStandalone) {
        openStandaloneEditorWindow(cleanup.kept.id);
      } else {
        openNoteById(cleanup.kept.id, { preferTitleSelection, preferPlainEditor });
      }
      return { note: cleanup.kept, remote: !isLocalOnlyNote(cleanup.kept), reused: true, cleanedCount: cleanup.removed };
    }
    const initialBody = initialBodyForFolder(folderId);
    const created = await createNote({
      directoryId: folderId,
      body: initialBody
    });
    if (!created) throw new Error("创建笔记失败");
    const note = mapNoteItem({
      ...created,
      body: ensureEditableNoteBody(typeof created?.body === "string" ? created.body : initialBody)
    });
    state.notes.unshift(note);
    if (openInStandalone) {
      openStandaloneEditorWindow(note.id);
    } else {
      openNoteById(note.id, { preferTitleSelection, preferPlainEditor });
    }
    return { note, remote: true, cleanedCount: cleanup.removed };
  } catch (error) {
    const fallback = {
      id: uid("pn"),
      title: "未命名笔记",
      folderId,
      noteType: typeFromFolder(state, folderId),
      status: "draft",
      body: ensureEditableNoteBody(initialBodyForFolder(folderId)),
      tags: [],
      links: [],
      updatedAt: new Date().toISOString(),
      bodyLoaded: true,
      isLocalOnly: true
    };
    state.notes.unshift(fallback);
    if (openInStandalone) {
      openStandaloneEditorWindow(fallback.id);
    } else {
      openNoteById(fallback.id, { preferTitleSelection, preferPlainEditor });
    }
    return { note: fallback, remote: false, error };
  }
}

async function createPrimaryOriginalNote(options = {}) {
  const previousRootId = state.browserRootId;
  const previousFolderId = state.selectedFolderId;
  const originalRootId = "dir_original_default";
  const currentRootId = rootBoxIdFromFolder(state, state.selectedFolderId);
  const switchedToOriginal = currentRootId !== originalRootId;

  if (folderById(state, originalRootId) && switchedToOriginal) {
    state.browserRootId = originalRootId;
    state.selectedFolderId = originalRootId;
    state.selectedFileId = null;
  } else if (folderById(state, originalRootId) && !folderById(state, state.selectedFolderId)) {
    state.browserRootId = originalRootId;
    state.selectedFolderId = originalRootId;
  }

  try {
    const result = await createNoteInSelectedFolder({ ...options, preferPlainEditor: true });
    return { ...result, switchedToOriginal, previousRootId, previousFolderId };
  } catch (error) {
    state.browserRootId = previousRootId;
    state.selectedFolderId = previousFolderId;
    throw error;
  }
}

async function openStartupUntitledNote() {
  if (folderById(state, STARTUP_NOTE_FOLDER_ID)) {
    state.browserRootId = rootBoxIdFromFolder(state, STARTUP_NOTE_FOLDER_ID);
    state.selectedFolderId = STARTUP_NOTE_FOLDER_ID;
  }
  const result = await createNoteInSelectedFolder({ preferTitleSelection: true });
  if (result.reused) {
    setStatus(
      result.cleanedCount
        ? `已打开未命名笔记，并清理 ${result.cleanedCount} 条空白占位`
        : "已打开未命名笔记",
      result.cleanedCount ? "warn" : "ok"
    );
  } else if (result.remote) {
    setStatus("已打开新的未命名笔记", "ok");
  } else {
    setStatus(`API 不可用，已打开本地未命名笔记：${String(result.error?.message || result.error)}`, "warn");
  }
  return result;
}

function resetWritingProjectContext({ title = "", goal = "", audience = "", tone = "" } = {}) {
  writingState.project = null;
  writingState.scaffold = null;
  writingState.scaffoldMarkdown = "";
  writingState.draftMarkdown = "";
  writingState.draftSaveState = "idle";
  writingState.scaffoldVersions = [];
  writingState.draftVersions = [];
  if ($("writingTitle")) $("writingTitle").value = title;
  if ($("writingGoal")) $("writingGoal").value = goal;
  if ($("writingAudience")) $("writingAudience").value = audience;
  if ($("writingTone")) $("writingTone").value = tone;
}

function resetWritingProjectContextForBasketChange() {
  resetWritingStrongModelState();
  resetWritingProjectContext({
    title: String($("writingTitle")?.value || "").trim(),
    goal: String($("writingGoal")?.value || "").trim(),
    audience: String($("writingAudience")?.value || "").trim(),
    tone: String($("writingTone")?.value || "").trim()
  });
  resetWritingLocalBookIdeas();
}

function preferredLocalFallbackNote() {
  return (
    state.notes.find((note) => rootBoxIdFromFolder(state, note.folderId) === "dir_original_default") ||
    state.notes[0] ||
    null
  );
}

function applyAiModelPackChange(nextPack = "Starter Auto", options = {}) {
  const next = String(nextPack || "Starter Auto").trim() || "Starter Auto";
  const currentRuntimeMode = normalizeAiRuntimeMode(settingsState.ai.runtimeMode);
  settingsState.ai.runtimeMode = isLocalModelPack(next)
    ? "local_only"
    : currentRuntimeMode === "local_only"
      ? "auto"
      : currentRuntimeMode;
  settingsState.ai.modelPack = next;
  reconcileAiSelectionState({ syncUserMode: true, resetProviderState: true });
  persistAiSettingsToStorage();
  syncAiSettingsToApi();
  refreshAiRoutePreview({ render: false });

  const settingsPack = $("settingsAiModelPack");
  if (settingsPack && settingsPack.value !== settingsState.ai.modelPack) settingsPack.value = settingsState.ai.modelPack;
  const modulePack = $("moduleAiModelPack");
  if (modulePack && modulePack.value !== settingsState.ai.modelPack) modulePack.value = settingsState.ai.modelPack;

  renderModuleWorkspaceHeader();
  renderSettingsPanel();

  const source = String(options.source || "").trim();
  setStatus(`AI model pack switched: ${settingsState.ai.modelPack}${source ? ` (${source})` : ""}`, "ok");
}

function syncMobileNewNoteButton() {
  const button = $("btnMobileNewNote");
  if (!button) return;
  const copy = explorerNewNoteButtonCopy(state);
  button.title = copy.title;
  const folderId = resolveExplorerNewNoteFolderId(state);
  const noteType = typeFromFolder(state, folderId);
  const permanentLike = noteType === "permanent" || noteType === "original";
  button.setAttribute("aria-label", noteType === "literature" ? `${copy.ariaLabel}（文摘）` : permanentLike ? `${copy.ariaLabel}（永久）` : copy.ariaLabel);
  const label = button.querySelector("span");
  if (label) label.textContent = "";
}

function renderModulePanels() {
  const todayMode = state.module === "today";
  const graphMode = state.module === "graph";
  const aiInboxMode = state.module === "aiInbox";
  const settingsMode = state.module === "settings";
  const backupMode = state.module === "backup";
  const writingMode = state.module === "writing";
  const importsMode = state.module === "imports";
  const distillationMode = state.module === "distillation";
  const editorMode = !todayMode && !graphMode && !aiInboxMode && !settingsMode && !backupMode && !writingMode && !importsMode && !distillationMode;
  $("editorWorkspace")?.classList.toggle("hidden", !editorMode);
  const moduleWorkspace = $("moduleWorkspace");
  moduleWorkspace?.classList.toggle("hidden", editorMode);
  syncModuleChromeClassesForRuntime({
    module: state.module,
    moduleWorkspace,
    appShell: document.querySelector(".app")
  });
  $("aiInboxPanel")?.classList.toggle("hidden", !aiInboxMode);
  $("todayOrganizingPanel")?.classList.toggle("hidden", !todayMode);
  $("graphPanel")?.classList.toggle("hidden", !graphMode);
  $("settingsPanel")?.classList.toggle("hidden", !settingsMode);
  $("backupPanel")?.classList.toggle("hidden", !backupMode);
  $("writingPanel")?.classList.toggle("hidden", !writingMode);
  $("importPanel")?.classList.toggle("hidden", !importsMode);
  $("distillationPanel")?.classList.toggle("hidden", !distillationMode);
  $("markdownPanel")?.classList.toggle("hidden", !editorMode);
  $("relatedPanel")?.classList.toggle("hidden", !editorMode || !state.inspectorVisible);
  $("btnMobileNewNote")?.classList.toggle("hidden", !editorMode);
  syncMobileNewNoteButton();
  if (todayMode) todayOrganizingRuntime.render();
  if (backupMode) renderBackupPanel();
  renderModuleWorkspaceHeader();
}

function renderBackupPanel() {
  renderVaultBackupPanel({
    $,
    settingsState,
    escapeHtml
  });
}

function settingsAiRoutePreviewRuntimeDeps() {
  return {
    $,
    escapeHtml,
    settingsState,
    normalizeAiRuntimeMode,
    installedLocalModelReady,
    currentAiProviderId,
    activeAiProviderConfig,
    isRemoteConfigurableProviderId,
    remoteRuntimeModelFromMap
  };
}

function renderAiRoutePreview() {
  renderAiRoutePreviewForRuntime(settingsAiRoutePreviewRuntimeDeps());
}

function settingsAiExperienceRuntimeDeps() {
  return {
    $,
    escapeHtml,
    settingsState,
    normalizeAiRuntimeMode,
    currentOllamaSetupGuide,
    primaryRecommendedOllamaModelName,
    currentAiProviderId,
    isRemoteConfigurableProviderId,
    isAiLocalFlowActive,
    preferredLocalProviderPresetForSelection,
    defaultProviderEndpointUrl,
    OLLAMA_CHAT_ENDPOINT_URL,
    defaultProviderHealthEndpointUrl,
    OLLAMA_HEALTH_ENDPOINT_URL,
    isLocalModelPack,
    ollamaRuntimeStateLabel,
    installedLocalModelReady,
    ollamaRecommendationHintText
  };
}

function renderAiSettingsExperience() {
  renderAiSettingsExperienceForRuntime(settingsAiExperienceRuntimeDeps());
}

function settingsAiControlsRuntimeDeps() {
  return {
    $,
    escapeHtml,
    settingsState,
    normalizeAiRuntimeMode,
    isAiLocalFlowActive,
    currentAiProviderId,
    isLocalModelPack,
    ollamaModelRecommendationProfiles,
    currentOllamaModelTiers,
    localModelDisplayProfile,
    hasLocalModel,
    primaryRecommendedOllamaModelName,
    currentOllamaSetupGuide,
    ollamaPullModelName,
    ollamaRecommendationForModel,
    isRemoteConfigurableProviderId,
    activeAiProviderConfig,
    remoteRuntimeModelFromMap,
    defaultProviderEndpointUrl,
    defaultProviderHealthEndpointUrl
  };
}

function renderAiLocalModelRecommendations() {
  renderAiLocalModelRecommendationsForRuntime(settingsAiControlsRuntimeDeps());
}

function renderAiLocalModelControls() {
  renderAiLocalModelControlsForRuntime(settingsAiControlsRuntimeDeps());
}

function renderAiProviderConfigControls() {
  renderAiProviderConfigControlsForRuntime(settingsAiControlsRuntimeDeps());
}

function settingsAiDialogByName(name = "") {
  const normalized = String(name || "").trim();
  const map = {
    test: "settingsAiTestDialog"
  };
  return $(map[normalized] || "");
}

function closeSettingsAiDialogs() {
  ["settingsAiTestDialog"].forEach((id) => {
    $(id)?.classList.add("hidden");
  });
}

function openSettingsAiDialog(name = "") {
  if (String(name || "").trim() === "remote") {
    const section = $("settingsAiRemoteSection");
    if (section instanceof HTMLDetailsElement) section.open = true;
    section?.scrollIntoView?.({ behavior: "smooth", block: "start" });
    const firstField = $("settingsAiProviderEndpointUrl");
    if (firstField instanceof HTMLElement) firstField.focus({ preventScroll: true });
    return;
  }
  const dialog = settingsAiDialogByName(name);
  if (!dialog) return;
  closeSettingsAiDialogs();
  dialog.classList.remove("hidden");
  const firstField = dialog.querySelector("select, input, textarea, button");
  if (firstField instanceof HTMLElement) firstField.focus({ preventScroll: true });
}

async function applySettingsAiQuickSetup(kind = "") {
  const normalized = String(kind || "").trim();
  if (normalized === "local") {
    settingsState.ai.runtimeMode = "local_only";
    settingsState.ai.modelPack = "Ollama Local";
    settingsState.ai.userMode = "Local / Private";
  } else if (normalized === "remote") {
    settingsState.ai.runtimeMode = "cloud_only";
    settingsState.ai.modelPack = "Global Optimized";
    settingsState.ai.userMode = "Balanced";
  } else {
    return;
  }
  reconcileAiSelectionState({ syncUserMode: true, resetProviderState: true });
  persistAiSettingsToStorage();
  await syncAiSettingsToApi();
  if (normalized === "local") {
    await previewOllamaLocalAiBootstrapFromUi(localAiPreviewOptionsForAction("settings_quick_setup"));
  }
  await refreshAiRoutePreview();
  renderSettingsPanel();
  openSettingsAiDialog(normalized);
  if (normalized === "local") {
    setStatus("已进入本地 AI 设置。下载模型前会先等待你确认。", "ok");
    return;
  }
  setStatus(normalized === "local" ? "已切换为本机 AI 设置" : "已切换为在线 AI 设置", "ok");
}

function confirmRemoteAiUse() {
  if (typeof window?.confirm !== "function") return true;
  return window.confirm("远程 AI 会把相关内容发送到你填写的服务。确认继续吗？");
}

async function autoPrepareLocalAiOnStartup() {
  if (settingsState.ai.autoPrepareLocalAi !== true) return;
  if (!localOllamaSetupActive() || !shouldUseOllamaLocalRuntime()) return;
  await bootstrapOllamaLocalAiFromUi({
    ...localAiPreviewOptionsForAction("settings_refresh"),
    autoStart: true,
    pullModel: false,
    silent: true,
    render: false
  });
}

function activateModule(moduleName) {
  const normalizedModule = moduleName === "search" ? "imports" : moduleName;
  if (state.module === "today" && normalizedModule !== "today") {
    state.todayNoticeMessage = "";
  }
  if (normalizedModule === "today") clearTodayReturnTarget();
  if (normalizedModule === "imports") {
    state.module = "settings";
    settingsState.activeSection = "workspace";
    settingsState.activeItem = "import-export";
    syncRailSelectionState();
    renderAll();
    renderImportPageShell();
    return;
  }
  if (normalizedModule === "graph") {
    state.browserRootId = "dir_original_default";
    if (!isDirectoryUnderOriginalRoot(state.selectedFolderId)) {
      state.selectedFolderId = "dir_original_default";
    }
    state.selectedFileId = null;
    prepareGraphEntryPresentationState();
  }
  state.module = normalizedModule;
  if (normalizedModule === "graph") expandGraphBrowserTree();
  syncRailSelectionState();
  renderAll();
  if (normalizedModule === "graph") {
    window.requestAnimationFrame(() => {
      centerGraphViewportIfZoomed();
      window.setTimeout(() => centerGraphViewportIfZoomed(), 0);
    });
  }
}

const {
  closeNoteTemplatePreview,
  noteTemplateCardCopy,
  noteTemplateDraftValidation,
  noteTemplateEditorElementId,
  noteTemplateFeedbackElementId,
  noteTemplateFeedbackTextElementId,
  noteTemplateFieldMeta,
  noteTemplateSaveButtonElementId,
  openNoteTemplatePreview,
  renderNoteTemplateSettingsCard,
  resetNoteTemplateToDefault,
  saveNoteTemplateFromEditor,
  updateNoteTemplatePreviewFromEditor
} = settingsNoteTemplateRuntime;

function escapePreviewInline(text = "") { return escapeTemplatePreviewInline(text, { escapeHtml }); }

function renderTemplateMarkdownPreviewHtml(source = "") { return renderTemplateMarkdownPreviewHtmlForRuntime(source, { escapeHtml }); }

function renderAiCanonicalDebugPanel() {
  const panel = $("settingsAiCanonicalDebug");
  if (!panel) return;
  panel.innerHTML = renderSettingsAutomationRunHistory({
    snapshots: settingsState.ai.debugSnapshots || {}
  });
}

function isWritingEligibleNote(note) { return writingNoteEligibility(note).ok; }

function writingScopeDirectoryIds() { return writingScopeDirectoryIdsForRuntime(state, { descendantDirectoryIds }); }

function writingCandidateNotes() {
  return writingCandidateNotesForRuntime(state, {
    writingScopeDirectoryIds,
    isWritingEligibleNote
  });
}

function writingThemeLabels(notes) { return computeWritingThemeLabels(notes, { parseTags }); }

function writingThemeSummary(notes) { return computeWritingThemeSummary(notes, { parseTags }); }

function writingThemeIndexById(indexId) { return writingThemeIndexByIdForRuntime(writingState, indexId); }

function writingThemeIndexNoteIds(indexCard) { return writingThemeIndexNoteIdsForRuntime(indexCard); }

function sameUniqueStringSet(left = [], right = []) { return sameUniqueStringSetForRuntime(left, right); }

function selectedWritingThemeIndex() { return selectedWritingThemeIndexForRuntime(writingState, { themeIndexById: writingThemeIndexById }); }

function setSelectedWritingThemeIndex(indexId = "") { return setSelectedWritingThemeIndexForRuntime(writingState, indexId); }

function clearWritingThemeRelationCounts(noteIds = []) { return clearWritingThemeRelationCountsForRuntime(writingState, noteIds); }

function setWritingFocusedCandidateScope(noteIds = [], scopeLabel = "") { return setWritingFocusedCandidateScopeForRuntime(writingState, noteIds, scopeLabel); }

function clearWritingFocusedCandidateScope() { return clearWritingFocusedCandidateScopeForRuntime(writingState); }

function writingThemeNotesLoaded(noteIds = []) { return uniqueStrings(noteIds).every((noteId) => Boolean(writingKnownNoteById(noteId)?.bodyLoaded)); }

async function hydrateWritingThemeNotes(noteIds = [], { render = true } = {}) {
  const ids = uniqueStrings(noteIds);
  const requestSerial = ++writingState.themeNoteDetailRequestSerial;
  writingState.themeNoteDetailIds = ids;
  writingState.loadingThemeNoteDetails = ids.length > 0;
  if (render && state.module === "writing") renderWritingPanel();
  try {
    await ensureNotesLoaded(ids);
  } finally {
    if (requestSerial === writingState.themeNoteDetailRequestSerial && sameUniqueStringSet(ids, writingState.themeNoteDetailIds)) {
      writingState.loadingThemeNoteDetails = false;
      if (render && state.module === "writing") renderWritingPanel();
    }
  }
}

function shouldHydrateWritingThemeNotes(noteIds = []) {
  const ids = uniqueStrings(noteIds);
  if (!ids.length) return false;
  if (writingThemeNotesLoaded(ids)) return false;
  if (writingState.loadingThemeNoteDetails && sameUniqueStringSet(ids, writingState.themeNoteDetailIds)) return false;
  return true;
}

function upsertWritingThemeIndex(indexCard) {
  if (!indexCard?.id) return;
  writingState.themeIndexes = [
    indexCard,
    ...writingState.themeIndexes.filter((item) => item.id !== indexCard.id)
  ];
}

async function selectWritingThemeIndex(indexId) {
  const id = String(indexId || "").trim();
  if (!id) return null;
  const fetched = await fetchIndexCard(id);
  if (!fetched?.id) return null;
  const noteIds = writingThemeIndexNoteIds(fetched);
  const preservingExistingThemeContext = shouldPreserveWritingThemeContext({
    noteIds,
    loadedThemeNoteIds: writingState.themeNoteDetailIds,
    relationThemeNoteIds: writingState.themeRelationNoteIds,
    sameSet: sameUniqueStringSet
  });
  await ensureNotesLoaded(noteIds);
  upsertWritingThemeIndex(fetched);
  setSelectedWritingThemeIndex(fetched.id);
  writingState.themeNoteDetailIds = noteIds;
  writingState.loadingThemeNoteDetails = false;
  if (!preservingExistingThemeContext) clearWritingThemeRelationCounts(noteIds);
  renderWritingPanel();
  return fetched;
}

function buildThemeIndexItemsFromIds(indexCard, noteIds = []) {
  const existingById = new Map((Array.isArray(indexCard?.items) ? indexCard.items : []).map((item) => [item.note_id, item]));
  return uniqueStrings(noteIds).map((noteId, index) => {
    const existing = existingById.get(noteId);
    const note = writingNoteById(noteId) || existing?.note || null;
    return {
      noteId,
      shortLabel: existing?.short_label || note?.title || "",
      rationale: existing?.rationale || "",
      order: index + 1
    };
  });
}

async function saveSelectedThemeIndexDetail() {
  const selected = selectedWritingThemeIndex();
  if (!selected?.id) throw new Error("theme index is required");
  const title = String($("writingThemeDetailTitle")?.value || "").trim();
  if (!title) throw new Error("title is required");
  const item = await updateIndexCard(selected.id, {
    title,
    summary: String($("writingThemeDetailSummary")?.value || "").trim(),
    thesis: String($("writingThemeDetailThesis")?.value || "").trim(),
    threeLineSummary: [1, 2, 3].map((idx) => String($(`writingThemeDetailSummary${idx}`)?.value || "").trim()),
    centralQuestion: String($("writingThemeDetailCentralQuestion")?.value || "").trim()
  });
  upsertWritingThemeIndex(item);
  setSelectedWritingThemeIndex(item.id);
  renderWritingPanel();
  return item;
}

async function syncSelectedThemeIndexWithBasket(mode = "replace") {
  const selected = selectedWritingThemeIndex();
  if (!selected?.id) throw new Error("theme index is required");
  const basketIds = parseWritingBasketIds();
  if (!basketIds.length) throw new Error("writing basket is empty");
  await ensureNotesLoaded(basketIds);
  const mergedIds =
    mode === "append"
      ? uniqueStrings([...(selected.item_note_ids || []), ...basketIds])
      : uniqueStrings(basketIds);
  await ensureNotesLoaded(mergedIds);
  const item = await updateIndexCard(selected.id, {
    items: buildThemeIndexItemsFromIds(selected, mergedIds)
  });
  upsertWritingThemeIndex(item);
  setSelectedWritingThemeIndex(item.id);
  writingState.themeNoteDetailIds = mergedIds;
  writingState.loadingThemeNoteDetails = false;
  clearWritingThemeRelationCounts(mergedIds);
  renderWritingPanel();
  return item;
}

async function removeNoteFromSelectedThemeIndex(noteId) {
  const selected = selectedWritingThemeIndex();
  if (!selected?.id) throw new Error("theme index is required");
  const nextIds = (selected.item_note_ids || []).filter((id) => id !== noteId);
  if (!nextIds.length) throw new Error("theme index must keep at least one permanent note");
  await ensureNotesLoaded(nextIds);
  const item = await updateIndexCard(selected.id, {
    items: buildThemeIndexItemsFromIds(selected, nextIds)
  });
  upsertWritingThemeIndex(item);
  setSelectedWritingThemeIndex(item.id);
  writingState.themeNoteDetailIds = nextIds;
  writingState.loadingThemeNoteDetails = false;
  clearWritingThemeRelationCounts(nextIds);
  renderWritingPanel();
  return item;
}

async function createWritingProjectFromThemeIndex(indexCardId) { return writingThemeProjectRuntime.createWritingProjectFromThemeIndex(indexCardId); }

function writingSourceIndexSummary() { return computeWritingSourceIndexSummary(writingState.sourceIndexIds, { themeIndexById: writingThemeIndexById }); }

function suggestedThemeIndexTitle(noteIds = []) { return computeSuggestedThemeIndexTitle(noteIds, { noteById: writingNoteById, parseTags }); }

function clearWritingSourceIndexIds() { return clearWritingSourceIndexIdsForRuntime(writingState); }

function setWritingSourceIndexIds(indexIds = []) { return setWritingSourceIndexIdsForRuntime(writingState, indexIds); }

function resetWritingStrongModelState() { return resetWritingStrongModelStateForRuntime(writingState); }

function resetWritingLocalBookIdeas() { return resetWritingLocalBookIdeasForRuntime(writingState); }

function syncWritingLocalBookIdeasFromProject(project = null) { return syncWritingLocalBookIdeasFromProjectForRuntime(writingState, project); }

function resetWritingProjectForm({ keepTitle = false } = {}) {
  if (!keepTitle && $("writingTitle")) $("writingTitle").value = "";
  if ($("writingGoal")) $("writingGoal").value = "";
  if ($("writingAudience")) $("writingAudience").value = "";
  if ($("writingTone")) $("writingTone").value = "";
}

function writingNoteById(noteId) { return state.notes.find((item) => item.id === noteId) || null; }

function writingCachedNoteById(noteId) { return (writingState.project?.basket_notes || []).find((item) => item?.id === noteId) || null; }

function isDirectoryUnderOriginalRoot(directoryId) { return rootBoxIdFromFolder(state, directoryId) === "dir_original_default"; }

function writingNoteEligibility(note) { return writingThemeProjectRuntime.writingNoteEligibility(note); }

function parseWritingBasketIds() { return parseWritingBasketIdsForRuntime({ $ }); }

function setWritingBasketIds(noteIds) { return setWritingBasketIdsForRuntime(noteIds, { $ }); }

function addWritingBasketIds(noteIds) {
  return addWritingBasketIdsForRuntime(noteIds, {
    parseWritingBasketIds,
    setWritingBasketIds,
    resetWritingProjectContextForBasketChange,
    refreshWritingRelationCounts
  });
}

function removeWritingBasketId(noteId) {
  return removeWritingBasketIdForRuntime(noteId, {
    writingState,
    parseWritingBasketIds,
    setWritingBasketIds,
    resetWritingProjectContextForBasketChange,
    refreshWritingRelationCounts
  });
}

function clearWritingBasket() {
  return clearWritingBasketForRuntime({
    writingState,
    setWritingBasketIds,
    resetWritingLocalBookIdeas
  });
}

let writingBasketManualRefreshTimer = 0;

function handleWritingBasketManualInput() {
  const basketIds = parseWritingBasketIds();
  const title = String($("writingTitle")?.value || "").trim();
  const goal = String($("writingGoal")?.value || "").trim();
  const audience = String($("writingAudience")?.value || "").trim();
  const tone = String($("writingTone")?.value || "").trim();
  resetWritingStrongModelState();
  resetWritingLocalBookIdeas();
  clearWritingSourceIndexIds();
  resetWritingProjectContext({ title, goal, audience, tone });
  writingState.relationCounts = {};
  writingState.relationCountErrors = {};
  writingState.loadingRelationCounts = basketIds.length > 0;
  renderWritingPanel();
  window.clearTimeout(writingBasketManualRefreshTimer);
  writingBasketManualRefreshTimer = window.setTimeout(() => {
    void refreshWritingRelationCounts(parseWritingBasketIds());
  }, 250);
}

function writingKnownNoteById(noteId) { return writingNoteById(noteId) || writingCachedNoteById(noteId) || null; }

function partitionWritingEligibleNoteIds(noteIds = [], { noteLookup = writingKnownNoteById } = {}) {
  const eligibleIds = [];
  const ineligible = [];
  for (const noteId of uniqueStrings(noteIds)) {
    const note = noteLookup(noteId);
    const eligibility = writingNoteEligibility(note || { id: noteId });
    if (eligibility.ok) eligibleIds.push(noteId);
    else {
      ineligible.push({
        id: noteId,
        note,
        ...eligibility
      });
    }
  }
  return { eligibleIds, ineligible };
}

function writingIneligibleSummary(items = []) {
  const counts = items.reduce(
    (acc, item) => {
      const key = ["authorship", "draft", "type", "missing"].includes(item?.key) ? item.key : "other";
      acc[key] += 1;
      return acc;
    },
    { authorship: 0, draft: 0, type: 0, missing: 0, other: 0 }
  );
  return uniqueStrings([
    counts.authorship ? `${counts.authorship} 条未完成作者确认` : "",
    counts.draft ? `${counts.draft} 条仍是 draft` : "",
    counts.type ? `${counts.type} 条不属于永久笔记` : "",
    counts.missing ? `${counts.missing} 条暂未读取完整信息` : "",
    counts.other ? `${counts.other} 条暂不可进入写作` : ""
  ]).join("，");
}

function currentWritingBasketEligibility() { return partitionWritingEligibleNoteIds(parseWritingBasketIds()); }

function currentWritingBasketReadiness() {
  const noteIds = parseWritingBasketIds();
  const relationCounts = writingState.relationCounts || {};
  const relationCountErrors = writingState.relationCountErrors || {};
  const relationCountsReady = writingRelationCountsReady(noteIds, relationCounts) && !writingState.loadingRelationCounts;
  const relationCountsErrored = writingRelationCountsErrored(noteIds, relationCountErrors);
  const relationState = relationCountsErrored ? "error" : relationCountsReady ? "loaded" : "loading";
  return deriveBasketWritingReadiness(noteIds, writingKnownNoteById, relationCounts, { relationState });
}

function countExplicitRelationsForWriting(relations = null) { return countExplicitSemanticRelations(relations); }

async function loadWritingRelationCounts(noteIds = []) {
  const ids = uniqueStrings(noteIds);
  if (!ids.length) return { counts: {}, errors: {} };
  const results = await Promise.all(
    ids.map(async (noteId) => {
      try {
        const relations = await fetchNoteRelations(noteId);
        return [noteId, { count: countExplicitRelationsForWriting(relations), error: false }];
      } catch {
        return [noteId, { count: 0, error: true }];
      }
    })
  );
  return results.reduce(
    (acc, [noteId, value]) => {
      acc.counts[noteId] = value.count;
      acc.errors[noteId] = value.error;
      return acc;
    },
    { counts: {}, errors: {} }
  );
}

async function refreshWritingRelationCounts(noteIds = parseWritingBasketIds(), { render = true } = {}) {
  const ids = uniqueStrings(noteIds);
  const requestSerial = ++writingState.relationCountRequestSerial;
  writingState.loadingRelationCounts = ids.length > 0;
  if (!ids.length) {
    writingState.relationCounts = {};
    writingState.relationCountErrors = {};
    if (render && state.module === "writing") renderWritingPanel();
    return { counts: {}, errors: {} };
  }
  if (render && state.module === "writing") renderWritingPanel();
  try {
    const payload = await loadWritingRelationCounts(ids);
    if (requestSerial !== writingState.relationCountRequestSerial) {
      return { counts: writingState.relationCounts, errors: writingState.relationCountErrors };
    }
    writingState.relationCounts = payload.counts;
    writingState.relationCountErrors = payload.errors;
    return payload;
  } finally {
    if (requestSerial === writingState.relationCountRequestSerial) {
      writingState.loadingRelationCounts = false;
      if (render && state.module === "writing") renderWritingPanel();
    }
  }
}

async function refreshWritingThemeRelationCounts(noteIds = [], { render = true } = {}) {
  const ids = uniqueStrings(noteIds);
  const requestSerial = ++writingState.themeRelationCountRequestSerial;
  writingState.themeRelationNoteIds = ids;
  writingState.loadingThemeRelationCounts = ids.length > 0;
  if (!ids.length) {
    writingState.themeRelationCounts = {};
    writingState.themeRelationCountErrors = {};
    if (render && state.module === "writing") renderWritingPanel();
    return { counts: {}, errors: {} };
  }
  if (render && state.module === "writing") renderWritingPanel();
  try {
    const payload = await loadWritingRelationCounts(ids);
    if (requestSerial !== writingState.themeRelationCountRequestSerial || !sameUniqueStringSet(ids, writingState.themeRelationNoteIds)) {
      return { counts: writingState.themeRelationCounts, errors: writingState.themeRelationCountErrors };
    }
    writingState.themeRelationCounts = payload.counts;
    writingState.themeRelationCountErrors = payload.errors;
    return payload;
  } finally {
    if (requestSerial === writingState.themeRelationCountRequestSerial && sameUniqueStringSet(ids, writingState.themeRelationNoteIds)) {
      writingState.loadingThemeRelationCounts = false;
      if (render && state.module === "writing") renderWritingPanel();
    }
  }
}

function writingRelationCountsReady(noteIds = [], relationCounts = {}) {
  const ids = uniqueStrings(noteIds);
  if (!ids.length) return true;
  return ids.every((noteId) => Object.prototype.hasOwnProperty.call(relationCounts || {}, noteId));
}

function writingRelationCountsErrored(noteIds = [], relationCountErrors = {}) {
  const ids = uniqueStrings(noteIds);
  if (!ids.length) return false;
  return ids.some((noteId) => Boolean(relationCountErrors?.[noteId]));
}

function shouldRefreshWritingThemeRelationCounts(noteIds = []) {
  const ids = uniqueStrings(noteIds);
  if (!ids.length) return false;
  if (!writingThemeNotesLoaded(ids)) return false;
  if (!sameUniqueStringSet(ids, writingState.themeRelationNoteIds)) return true;
  if (writingState.loadingThemeRelationCounts) return false;
  return !writingRelationCountsReady(ids, writingState.themeRelationCounts);
}

function writingThemeProjectEntry(indexCard) { return writingThemeProjectRuntime.writingThemeProjectEntry(indexCard); }

function findExistingWritingProjectForTheme(indexCard, noteIds = []) {
  const themeId = String(indexCard?.id || "").trim();
  const normalizedNoteIds = uniqueStrings(noteIds);
  if (!themeId && !normalizedNoteIds.length) return null;

  const projects = [writingState.project, ...(Array.isArray(writingState.projects) ? writingState.projects : [])]
    .filter(Boolean)
    .filter((project, index, items) => items.findIndex((item) => item?.id === project?.id) === index);

  return (
    projects.find((project) => {
      const relatedIndexIds = uniqueStrings(project?.related_index_ids || project?.relatedIndexIds || []);
      const basketNoteIds = uniqueStrings(project?.basket_note_ids || project?.basketNoteIds || []);
      if (themeId) return relatedIndexIds.includes(themeId);
      return normalizedNoteIds.length > 0 && sameUniqueStringSet(basketNoteIds, normalizedNoteIds);
    }) || null
  );
}

function writingProjectMatchesContext(project, { themeId = "", noteIds = [] } = {}) {
  const normalizedThemeId = String(themeId || "").trim();
  const normalizedNoteIds = uniqueStrings(noteIds);
  if (!project?.id) return false;

  const relatedIndexIds = uniqueStrings(project?.related_index_ids || project?.relatedIndexIds || []);
  const basketNoteIds = uniqueStrings(project?.basket_note_ids || project?.basketNoteIds || []);

  if (normalizedThemeId) return relatedIndexIds.includes(normalizedThemeId);
  return normalizedNoteIds.length > 0 && sameUniqueStringSet(basketNoteIds, normalizedNoteIds);
}

function writingEntryProjectForContext({ basketNoteIds = [], sourceIndexIds = [] } = {}) {
  const normalizedBasketNoteIds = uniqueStrings(basketNoteIds);
  if (!normalizedBasketNoteIds.length) return null;
  const normalizedSourceIndexIds = uniqueStrings(sourceIndexIds);
  const activeSourceIndexIds = normalizedSourceIndexIds.length
    ? normalizedSourceIndexIds
    : uniqueStrings([writingState.selectedThemeIndexId, ...writingState.sourceIndexIds]);
  const sourceIndexId = activeSourceIndexIds[0] || "";
  const sourceTheme = sourceIndexId ? writingThemeIndexById(sourceIndexId) : null;
  if (
    writingProjectMatchesContext(writingState.project, {
      themeId: sourceIndexId,
      noteIds: normalizedBasketNoteIds
    })
  ) {
    return writingState.project;
  }
  return findExistingWritingProjectForTheme(sourceTheme, normalizedBasketNoteIds);
}

function writingContinuationEntryForContext({ basketNoteIds = [], sourceIndexIds = [], scopeLabel = "当前材料" } = {}) {
  const existingProject = writingEntryProjectForContext({ basketNoteIds, sourceIndexIds });
  return describeWritingContinuationAction({
    existingProjectId: existingProject?.id || "",
    existingProjectHasScaffold: Boolean(existingProject?.scaffold_id),
    existingProjectHasDraft: Boolean(existingProject?.draft_note_id),
    scopeLabel
  });
}

function noteMainPathWritingContinuationEntry(noteId, scopeLabel = "当前笔记") {
  const cleanNoteId = String(noteId || "").trim();
  if (!cleanNoteId) return null;
  const plan = planWritingBasketEntry({
    existingNoteIds: parseWritingBasketIds(),
    incomingNoteIds: [cleanNoteId]
  });
  return writingContinuationEntryForContext({
    basketNoteIds: plan.basketNoteIds,
    sourceIndexIds: [writingState.selectedThemeIndexId, ...writingState.sourceIndexIds],
    scopeLabel
  });
}

function graphWritingContinuationEntry(candidateNoteIds = [], scopeLabel = "当前图谱范围") {
  const projectedEntry = graphWritingContinuationInput({
    basketNoteIds: parseWritingBasketIds(),
    candidateNoteIds,
    selectedThemeIndexId: writingState.selectedThemeIndexId,
    sourceIndexIds: writingState.sourceIndexIds
  });
  return writingContinuationEntryForContext({
    basketNoteIds: projectedEntry.basketNoteIds,
    sourceIndexIds: projectedEntry.sourceIndexIds,
    scopeLabel
  });
}

function currentWritingEntryProject() {
  const basketNoteIds = parseWritingBasketIds();
  if (!basketNoteIds.length) return null;
  return writingEntryProjectForContext({
    basketNoteIds,
    sourceIndexIds: [writingState.selectedThemeIndexId, ...writingState.sourceIndexIds]
  });
}

function currentWritingContinuationEntry(scopeLabel = "当前材料") {
  return writingContinuationEntryForContext({
    basketNoteIds: parseWritingBasketIds(),
    sourceIndexIds: [writingState.selectedThemeIndexId, ...writingState.sourceIndexIds],
    scopeLabel
  });
}

function writingBasketEntries() { return parseWritingBasketIds().map((noteId) => writingKnownNoteById(noteId) || { id: noteId, title: noteId, folderId: "", noteType: "permanent", body: "" }); }

function writingDraftDirectoryId() {
  if (state.selectedFolderId && isDirectoryUnderOriginalRoot(state.selectedFolderId)) return state.selectedFolderId;
  const basketDirectoryId = writingBasketEntries().find((note) => note?.folderId && isDirectoryUnderOriginalRoot(note.folderId))?.folderId;
  return basketDirectoryId || "dir_original_default";
}

function writingDraftTitle() {
  return String($("writingTitle")?.value || writingState.project?.title || "").trim() || "未命名文章";
}

function writingDraftBody() {
  const headingTitle = writingDraftTitle();
  const projectId = writingState.project?.id || "";
  const scaffoldId = writingState.scaffold?.id || "";
  const references = uniqueStrings([
    projectId ? `可写主题：${projectId}` : "",
    scaffoldId ? `文章提纲：${scaffoldId}` : ""
  ]);
  return writingDraftMarkdown({
    markdown: writingState.draftMarkdown || writingState.project?.draft_note?.body || writingState.scaffoldMarkdown,
    title: headingTitle,
    references
  });
}

function writingScaffoldFileName(title = "") {
  const base = String(title || "writing-project")
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return `${base || "writing-project"}_scaffold.md`;
}

async function copyTextToClipboard(text) {
  const value = String(text || "");
  if (navigator?.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }
  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "readonly");
  textarea.style.position = "fixed";
  textarea.style.left = "-10000px";
  textarea.style.top = "0";
  document.body.appendChild(textarea);
  textarea.select();
  const success = document.execCommand("copy");
  document.body.removeChild(textarea);
  if (!success) throw new Error("clipboard unavailable");
}

function downloadTextFile(fileName, text) {
  const blob = new Blob([String(text || "")], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
  window.__lastWritingExport__ = {
    fileName,
    bytes: blob.size,
    downloadedAt: new Date().toISOString()
  };
  return blob.size;
}

function writingNoteExcerpt(note) {
  const text = String(note?.body || "")
    .replace(/\r\n/g, "\n")
    .replace(/^#.*$/m, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return "";
  return text.length > 120 ? `${text.slice(0, 120)}...` : text;
}

function writingNoteMeta(note) {
  const folder = folderById(state, note?.folderId);
  return uniqueStrings([
    note?.id,
    folder?.name,
    note?.noteType === "permanent" || rootBoxIdFromFolder(state, note?.folderId) === "dir_original_default" ? "永久笔记" : note?.noteType
  ]).join(" · ");
}
function writingThemeIndexScopeDirectoryId() {
  return writingThemeIndexScopeDirectoryIdForRuntime(state, {
    isDirectoryUnderOriginalRoot,
    writingDraftDirectoryId
  });
}

async function loadWritingThemeIndexes() {
  const directoryId = writingThemeIndexScopeDirectoryId();
  writingState.loadingThemeIndexes = true;
  renderWritingPanel();
  try {
    writingState.themeIndexes = await listIndexCards({
      directoryId,
      includeDescendants: true,
      indexType: "topic",
      limit: 12
    });
    return writingState.themeIndexes;
  } finally {
    writingState.loadingThemeIndexes = false;
    renderWritingPanel();
  }
}

function writingThemeDetailHintText(indexCard) {
  return indexCard?.id ? "确认题目和问题，然后生成提纲。" : "写下题目和你想回答的问题。";
}

function populateWritingFormFromProject(project) {
  if (!project) return;
  const relatedIndexIds = uniqueStrings(project.related_index_ids || []);
  const selectedTheme = relatedIndexIds.map((indexId) => writingThemeIndexById(indexId)).find(Boolean) || null;
  if ($("writingTitle")) $("writingTitle").value = resolveWritingProjectFormTitle({ project, indexCard: selectedTheme });
  if ($("writingGoal")) $("writingGoal").value = project.goal || "";
  if ($("writingAudience")) $("writingAudience").value = project.audience || "";
  if ($("writingTone")) $("writingTone").value = project.tone || "";
  setWritingSourceIndexIds(relatedIndexIds);
  setSelectedWritingThemeIndex(relatedIndexIds[0] || "");
  setWritingBasketIds(project.basket_note_ids || []);
  syncWritingLocalBookIdeasFromProject(project);
}

function currentWritingVersionNote() { return String($("writingVersionNote")?.value || "").trim(); }

function promptVersionNoteEdit(currentValue, label) {
  const next = window.prompt(`${label}说明`, String(currentValue || ""));
  if (next === null) return null;
  return String(next).trim();
}

function renderScaffoldVersionCard(version) { return renderScaffoldVersionCardView(version, { activeScaffoldId: writingState.scaffold?.id || "" }, { escapeHtml }); }

function renderDraftVersionCard(version) {
  return renderDraftVersionCardView(version, {
    escapeHtml,
    writingProjectStatusLabel
  });
}

async function loadWritingProjectsList() {
  writingState.loadingProjects = true;
  renderWritingPanel();
  try {
    writingState.projects = await listWritingProjects({
      limit: 8,
      q: writingState.projectFilters.q,
      status: writingState.projectFilters.status,
      hasDraft: writingState.projectFilters.hasDraft
    });
  } finally {
    writingState.loadingProjects = false;
    renderWritingPanel();
  }
}

function syncWritingProjectFiltersFromUi() {
  writingState.projectFilters.q = String($("writingProjectsSearch")?.value || "").trim();
  writingState.projectFilters.status = String($("writingProjectsStatusFilter")?.value || "all").trim() || "all";
  writingState.projectFilters.hasDraft = String($("writingProjectsDraftFilter")?.value || "all").trim() || "all";
}

async function loadWritingScaffoldVersions() {
  const writingProjectId = String(writingState.project?.id || "").trim();
  if (!writingProjectId) {
    writingState.scaffoldVersions = [];
    renderWritingPanel();
    return [];
  }
  writingState.loadingScaffoldVersions = true;
  renderWritingPanel();
  try {
    writingState.scaffoldVersions = await listProjectScaffolds(writingProjectId, 12);
    return writingState.scaffoldVersions;
  } finally {
    writingState.loadingScaffoldVersions = false;
    renderWritingPanel();
  }
}

async function loadWritingDraftVersions() {
  const writingProjectId = String(writingState.project?.id || "").trim();
  if (!writingProjectId) {
    writingState.draftVersions = [];
    renderWritingPanel();
    return [];
  }
  writingState.loadingDraftVersions = true;
  renderWritingPanel();
  try {
    writingState.draftVersions = await listProjectDraftVersions(writingProjectId, 12);
    return writingState.draftVersions;
  } finally {
    writingState.loadingDraftVersions = false;
    renderWritingPanel();
  }
}

async function openWritingProject(projectId) {
  resetWritingStrongModelState();
  writingState.draftSaveState = "idle";
  const project = await fetchWritingProject(projectId);
  writingState.project = project;
  setWritingBasketIds(project?.basket_note_ids || []);
  populateWritingFormFromProject(project);
  if (project?.scaffold_id) {
    try {
      const scaffold = await fetchDraftScaffold(project.scaffold_id);
      writingState.scaffold = scaffold.item || null;
      writingState.scaffoldMarkdown = scaffold.export?.markdown || scaffold.item?.markdown || "";
    } catch {
      writingState.scaffold = null;
      writingState.scaffoldMarkdown = "";
    }
  } else {
    writingState.scaffold = null;
    writingState.scaffoldMarkdown = "";
  }
  await refreshWritingRelationCounts(parseWritingBasketIds(), { render: false });
  const refreshedProject = await refreshWritingProjectState();
  const draftNoteId = String(refreshedProject?.draft_note_id || writingState.project?.draft_note_id || "").trim();
  if (draftNoteId) {
    try {
      const draftNote = await fetchNote(draftNoteId);
      writingState.draftMarkdown = String(draftNote?.body || refreshedProject?.draft_note?.body || writingState.project?.draft_note?.body || "");
    } catch {
      writingState.draftMarkdown = String(refreshedProject?.draft_note?.body || writingState.project?.draft_note?.body || "");
    }
  } else {
    writingState.draftMarkdown = "";
  }
  await loadWritingScaffoldVersions();
  await loadWritingDraftVersions();
  renderWritingPanel();
  return project;
}

async function openWritingDraftNoteById(draftNoteId) {
  const id = String(draftNoteId || "").trim();
  if (!id) throw new Error("draftNoteId is required");
  if (!writingNoteById(id)) {
    const fetched = await fetchNote(id);
    if (fetched) state.notes = [mapNoteItem(fetched), ...state.notes.filter((item) => item.id !== id)];
  }
  activateModule("explorer");
  openNoteById(id);
  return id;
}

async function continueWritingProjectEntry(projectId, { openDraft = false, statusMessage = "" } = {}) {
  activateModule("writing");
  const project = await openWritingProject(projectId);
  const route = writingProjectContinuationRoute({ projectId, project, openDraft, statusMessage });
  if (route.kind === "missing-draft" || route.kind === "invalid-project") throw new Error(route.errorMessage);
  const continuationTab = route.kind === "open-draft" ? "draft" : (project?.scaffold_id ? "outline" : "theme");
  applyWritingTab(continuationTab, {
    root: $("writingPanel")?.querySelector?.(".writing-shell"),
    documentRef: document
  });
  setStatus(route.statusMessage, "ok");
  return project;
}

async function prepareWritingStrongModelAnalysis(options = {}) { return writingProjectRuntimeController.prepareWritingStrongModelAnalysis(options); }

async function scaffoldBundleForProject(projectLike = null) {
  const project = projectLike || writingState.project;
  if (!project?.id) throw new Error("writingProjectId is required");
  if (!project?.scaffold_id) throw new Error("scaffold is not available for this project");
  if (writingState.project?.id === project.id && writingState.scaffold?.id === project.scaffold_id && String(writingState.scaffoldMarkdown || "").trim()) {
    return {
      project: writingState.project,
      scaffold: writingState.scaffold,
      markdown: writingState.scaffoldMarkdown
    };
  }
  const fetchedProject = writingState.project?.id === project.id ? writingState.project : await fetchWritingProject(project.id);
  const scaffold = await fetchDraftScaffold(project.scaffold_id);
  if (writingState.project?.id === project.id) {
    writingState.project = fetchedProject;
    writingState.scaffold = scaffold.item || null;
    writingState.scaffoldMarkdown = scaffold.export?.markdown || scaffold.item?.markdown || "";
    renderWritingPanel();
  }
  return {
    project: fetchedProject,
    scaffold: scaffold.item || null,
    markdown: scaffold.export?.markdown || scaffold.item?.markdown || ""
  };
}

async function openScaffoldVersion(scaffoldId) {
  const id = String(scaffoldId || "").trim();
  if (!id) throw new Error("draftScaffoldId is required");
  const scaffold = await fetchDraftScaffold(id);
  writingState.scaffold = scaffold.item || null;
  writingState.scaffoldMarkdown = scaffold.export?.markdown || scaffold.item?.markdown || "";
  renderWritingPanel();
  return scaffold;
}

async function copyWritingScaffold(projectLike = null) {
  const bundle = await scaffoldBundleForProject(projectLike);
  const markdown = String(bundle.markdown || "").trim();
  if (!markdown) throw new Error("scaffold markdown is empty");
  await copyTextToClipboard(markdown);
  const fileName = writingScaffoldFileName(bundle.project?.title);
  showWritingResult({
    stage: "writing_copy_scaffold",
    writingProjectId: bundle.project?.id,
    draftScaffoldId: bundle.scaffold?.id,
    fileName,
    characters: markdown.length
  });
  return { ...bundle, fileName, characters: markdown.length };
}

async function exportWritingScaffold(projectLike = null) {
  const bundle = await scaffoldBundleForProject(projectLike);
  const markdown = String(bundle.markdown || "").trim();
  if (!markdown) throw new Error("scaffold markdown is empty");
  const fileName = writingScaffoldFileName(bundle.project?.title);
  const bytes = downloadTextFile(fileName, `${markdown}\n`);
  showWritingResult({
    stage: "writing_export_scaffold",
    writingProjectId: bundle.project?.id,
    draftScaffoldId: bundle.scaffold?.id,
    fileName,
    characters: markdown.length,
    bytes
  });
  return { ...bundle, fileName, characters: markdown.length, bytes };
}

function renderWritingToplineMetric(label, value, note, tone = "") { return renderWritingToplineMetricView(label, value, note, tone, { escapeHtml }); }

const writingBookRuntime = createWritingBookRuntime({
  $,
  writingState,
  writingBasketEntries
});
const {
  currentWritingBookStructure,
  deriveWritingBookDesign,
  deriveWritingLocalBookIdeas,
  normalizeWritingBookStructure,
  uniqueWritingBookPoolItems,
  writingBookMatchesAny,
  writingBookPlainText,
  writingBookProjectAudience,
  writingBookProjectGoal,
  writingBookSectionFromNote,
  writingBookShortText,
  writingBookStructureStats
} = writingBookRuntime;

const writingPanelController = createWritingPanelShellController({
  hostProvider: createWritingPanelPrototypeHostProvider(() => ({
    $,
    state,
    writingState,
    folderById,
    rootBoxIdFromFolder,
    writingCandidateNotes,
    writingSourceIndexSummary,
    writingBasketEntries,
    normalizeWritingBookStructure,
    deriveWritingBookDesign,
    writingBookStructureStats,
    parseWritingBasketIds,
    writingKnownNoteById,
    isWritingEligibleNote,
    writingRelationCountsReady,
    writingRelationCountsErrored,
    currentWritingBasketEligibility,
    writingIneligibleSummary,
    writingDraftDirectoryId,
    currentWritingContinuationEntry,
    selectedWritingThemeIndex,
    writingThemeIndexNoteIds,
    findExistingWritingProjectForTheme,
    renderThinkingStatusBadge,
    writingNoteMeta,
    writingNoteExcerpt,
    writingProjectStatusLabel,
    writingThemeProjectEntry,
    shouldHydrateWritingThemeNotes,
    hydrateWritingThemeNotes,
    shouldRefreshWritingThemeRelationCounts,
    refreshWritingThemeRelationCounts,
    clearWritingThemeRelationCounts,
    writingThemeDetailHintText,
    renderWritingToplineMetric,
    writingThemeSummary,
    renderScaffoldVersionCard,
    renderDraftVersionCard,
    writingBookProjectGoal,
    writingBookProjectAudience,
    isWritingCandidateDetailsExpanded: () => Boolean($("writingCandidateDetails")?.open),
    escapeHtml
  }))
});
const {
  renderWritingPanel,
  renderWritingScaffoldPreview
} = writingPanelController;

async function refreshVaultSettings() {
  try {
    settingsState.vault = await fetchVaultInfo();
    loadNoteTemplateSettingsFromStorage();
    const prefs = await fetchAiPreferences().catch(() => null);
    applyAiPreferencesToSettingsState(prefs, { applyProviderConfig: false });
    persistAiSettingsToStorage();
    settingsState.ai.providerConfigs = await fetchAiProviderConfigs().catch(() => []);
    applyActiveAiProviderConfigToState();
    persistAiSettingsToStorage();
    if (isAiLocalFlowActive({
      runtimeMode: settingsState.ai.runtimeMode,
      modelPack: settingsState.ai.modelPack,
      providerId: currentAiProviderId()
    }) && shouldUseOllamaLocalRuntime()) {
      await previewOllamaLocalAiBootstrapFromUi(localAiPreviewOptionsForAction("settings_refresh"));
    }
    await refreshAiRoutePreview({ render: false });
    await refreshScheduledTaskTemplates({ silent: true });
    await refreshScheduledTasks({ silent: true });
    await refreshAiSuggestions({ silent: true });
    settingsState.error = "";
    renderSettingsPanel();
    return settingsState.vault;
  } catch (error) {
    settingsState.error = String(error?.message || error);
    renderSettingsPanel();
    throw error;
  }
}

const GRAPH_RELATION_TYPE_LABELS = {
  associated_with: "相关",
  free_link: "自由链接",
  asks: "追问",
  duplicates: "重复重叠",
  belongs_to_topic: "归属主题",
  supports: "支持",
  complements: "补充",
  contrasts: "对比",
  contradicts: "反驳",
  extends: "推进",
  precedes: "前提",
  follows: "后续",
  qualifies: "限定",
  example_of: "例子",
  counterexample_to: "反例",
  same_topic: "同主题",
  unexpected_connection: "意外相关",
  bridges: "桥接",
  restates: "重述",
  reframes: "改写问题",
  appears_in_draft: "进入草稿"
};

const GRAPH_RELATION_STATUS_LABELS = {
  confirmed: "已确认",
  draft: "草稿",
  suggested: "建议",
  dismissed: "已忽略",
  archived: "已归档"
};

const GRAPH_CONFLICT_RELATION_TYPES = new Set(["contradicts", "counterexample_to", "contrasts", "qualifies"]);

function graphRelationTypeLabel(type) {
  const key = String(type || "associated_with").trim().toLowerCase();
  if (key === "meaningful") return "有解释力的关系";
  if (key === "noisy") return "链接提醒";
  if (key === "index") return "主题归属";
  return GRAPH_RELATION_TYPE_LABELS[key] || key || "关联";
}

function graphRelationSourceLabel(value = "") {
  const key = String(value || "").trim().toLowerCase();
  if (key === "ai" || key === "ai_suggestion") return "AI";
  if (key === "team") return "团队";
  if (key === "import") return "导入";
  return "自己";
}

function graphRelationStatusLabel(status) {
  const key = String(status || "confirmed").trim().toLowerCase();
  return GRAPH_RELATION_STATUS_LABELS[key] || key || "已确认";
}

const graphResidualViews = createGraphResidualViews({
  $,
  GRAPH_CONFLICT_RELATION_TYPES, GRAPH_INDEX_RELATION_TYPES, GRAPH_LINK_CLUE_RELATION_TYPES, GRAPH_MEANINGFUL_RELATION_TYPES,
  GRAPH_ORIGINAL_SCOPE_DIRECTORY_ID, GRAPH_RELATION_GROUP_META, GRAPH_RELATION_MARKER_COLORS, GRAPH_VISUAL_ZOOM_OPTIONS,
  addSystemMessage, analyzeDirectoryGraph, applyGraphEdgeHoverDomState, applyGraphNodeHoverDomState, applyGraphThinkingHoverDomState,
  graphBuildFocusedRelationTypeStatsForRuntime, graphBuildVisualLayoutForRuntime, graphDenseGalaxyMode,
  graphEdgePathForRuntime, graphEdgeShouldRenderForRuntime, graphEdgeVisibleAtFitForRuntime, graphFocusContextModeMeta, graphFocusDepthMeta,
  graphFocusedItemsForRuntime, graphHash,
  graphLoadedScopeCoversDirectoryForRuntime, graphNodeAttentionReasons, graphNodeClass, graphNodeRadiusByTier, graphNodeShowsAsPoint, graphNodeStarTier,
  graphReadingModeMeta, graphScopedItemsForRuntime, graphScopeDirectoryIdForRuntime, graphShortTitle, graphThemeBoundaryMetaForRuntime,
  graphViewModeForRelationType, graphZoomOption,
  normalizeGraphFocusDepth, descendantDirectoryIds, buildGraphQuestionSpotSummaryForGraph, buildGraphThinkingItemsForGraph,
  buildGraphWorkspaceRenderDeps, clearGraphIsolatedRelationDraftForState, computeGraphAiRelationCandidatesForNote,
  computeGraphBlockedAiRelationPairKeysForNote, computeGraphCandidateBlocksFormalRelation, computeGraphCandidateCanSaveRelation,
  computeGraphCandidateCountKey, computeGraphCandidateEndpointIds, computeGraphCandidatePercent, computeGraphCandidateUndirectedPairKey,
  computeGraphDecoratePotentialRelationCandidate, computeGraphMergeRelationCandidatesForDisplay, computeGraphLocalRelationCandidatesForNote, computeGraphClusterResearchMeta,
  computeGraphPotentialRelationActionEndpoints, computeGraphPotentialRelationEvidenceText, computeGraphPotentialRelationRationaleDraft,
  computeGraphPreferredPotentialRelationType, computeGraphReadingLensMeta, computeGraphRelationCandidateKey, computeGraphDirectNetworkEdgeCount, computeGraphExistingRelationKeys, computeGraphExistingRelationPairKeys, computeGraphFocusCardActionMeta,
  computeGraphRelationPairKey, computeGraphRelationRationaleIsActionable, computeGraphRelationStatusCountsAsNetworkEdge, computeGraphRelationStatusKey,
  computeGraphManualRelationTargetsForNote, computeGraphNextIsolatedQueueItem,
  computeGraphNoteIdFromIsolatedItem, computeGraphPendingAiCandidateCount, computeGraphQuestionSpotSummaryFromItems, computeGraphSelectEdgeActionAttrs,
  computeGraphResearchNavigatorState, computeGraphThemeCandidateNoteIdsForNode, computeGraphThinkingCleanIds, computeGraphThinkingNoteTitle,
  computeGraphTitleCharacterOverlap, computeGraphUniqueClusterMeta, createGraphIsolatedDecisionController, createGraphIsolatedRelationController, createGraphIsolatedWorkflowShellRenderer,
  createGraphAiConnectRuntimeController, createGraphReadingLensStateController, createGraphRelationSaveController, createGraphRelationWorkflowController,
  createGraphVisualMapController, createGraphVisualMapPrototypeDepsProvider, createGraphSelectionPanelRenderer, createGraphThinkingModelRuntimeDepsProvider,
  createNoteRelation, escapeHtml,
  ensureGraphLocalAiReadyForAnalysis: (...args) => ensureGraphLocalAiReadyForAnalysis(...args),
  isDirectoryUnderOriginalRoot,
  parseTags,
  graphAiAnalysisSummaryStateForGraph,
  graphBridgeSelectionKey,
  graphComputedIsolatedNotesForGraph,
  graphEdgeSelectionKey,
  graphFilterOptionsForRuntime,
  graphFullNoteByIdFromSources,
  graphIsolatedPreviewTargetForNote,
  graphIsolatedQueueItemsForGraph,
  graphIsolatedSelectionKey,
  openRelationComposerFromGraphAction: (...args) => openRelationComposerFromGraphAction(...args),
  graphLiveAiAnalysisCountsForGraph,
  graphLocalRelationCandidatesForNote: computeGraphLocalRelationCandidatesForNote,
  graphManualRelationTargetsForNote: computeGraphManualRelationTargetsForNote,
  graphMarkIsolatedNodesForGraph,
  graphNotePreviewTextForLocalRelation,
  graphNoteTagsForLocalRelation,
  graphRelationQualityLabel,
  graphRelationReviewReasonLabel,
  graphNodeStarRank,
  graphNormalizeRelationWorkflowSelection,
  graphRelationGroupMeta,
  graphRelationSourceLabel,
  graphRelationStatusLabel,
  graphRelationSaveResultForNote,
  graphRelationTypeLabel,
  graphRelationVisual,
  graphState,
  graphStructureFallbackEdges,
  graphStructureFallbackEdgesForRuntime,
  graphThemeNoteIds,
  graphThemeSelectionKey,
  graphThinkingHighlightAttrsForItem,
  normalizeGraphRelationTypeFilter,
  noteTypeLabel,
  refreshDirectoryGraph,
  renderGraphClusterSelectionPanelView,
  renderGraphIconView,
  renderGraphIsolatedJoinNetworkFlowHtml,
  renderGraphIsolatedNextStepActionsHtml,
  renderGraphMapPreviewView,
  renderGraphPanel,
  renderGraphReadingLensControlsView,
  renderGraphRelationTypeFilter,
  renderGraphRelationTypeFilterForRuntime,
  renderGraphRelationWorkspaceMarkup,
  renderGraphResearchNavigatorEntryView,
  renderGraphResearchNavigatorPanelView,
  renderGraphSelectionMetricsView,
  renderGraphSelectionShellView,
  renderGraphStarfieldView,
  renderGraphNebulaFieldView,
  renderGraphClusterGlowView,
  renderGraphFocusContextPanelView,
  renderGraphThemeBoundaryForRuntime,
  renderGraphThemeIndexWorkspaceMarkup,
  shouldShowGraphDensityHint,
  shouldShowGraphCanvasHelpHint,
  renderGraphThinkingItemsView,
  renderGraphThinkingPanelContentView,
  renderGraphThinkingPanelView,
  renderGraphThinkingReviewNoteView,
  renderGraphViewModeSwitcher,
  renderGraphViewModeSwitcherForRuntime,
  renderGraphWorkbenchEntryPillsView,
  renderGraphWorkbenchPanelView,
  renderGraphWorkbenchPriorityQueueView,
  renderGraphUtilityDrawerView,
  renderRelationReviewQueueSectionView,
  resetGraphHoverDomState,
  refinePotentialRelationCandidate,
  setStatus,
  state,
  suggestedThemeIndexTitle,
  titleFromBody,
  uniqueStrings,
  writeStoredText,
  setGraphFocusContextModeForRuntime,
  setGraphFocusDepthForRuntime
});
const {
  renderGraphIcon,
  setGraphFocusDepth,
  setGraphFocusContextMode,
  renderGraphOrientation,
  graphNodeTitle,
  graphEdgeTitle,
  buildGraphInsightCoach,
  renderGraphInsightCoach,
  renderGraphBridgeGapSection,
  graphWeakRelationClues,
  renderGraphWeakRelationClueSection,
  graphRelationFilterOptionsDepsForRuntime,
  graphFilterOptions,
  graphLocalizedActionText,
  graphReadingLensMeta,
  renderGraphReadingLensControls,
  graphWorkbenchTabMeta,
  graphClueSummaryState,
  renderGraphWorkbenchEntryPills,
  renderGraphResearchNavigatorEntry,
  graphLoadErrorMessage,
  renderGraphErrorState,
  renderGraphInlineNotice,
  graphEdgeMatchesFilters,
  graphThemeTitleLooksGeneric,
  graphThemeBreadthMeta,
  resolveGraphThemeSelection,
  resolveGraphIsolatedSelection,
  resolveGraphBridgeSelection,
  graphBuildIsolatedVisualNodes,
  normalizeGraphSelectionForVisibleItems,
  graphRelationGroupCounts,
  graphNodeRoleMeta,
  graphNodeInsightMeta,
  renderGraphNodeInsightPanel,
  graphEdgeReviewMeta,
  graphEdgeRationaleLooksComplex,
  graphEdgeAdjustmentPlan,
  renderGraphSelectionMetrics,
  graphSafeActionAttrs,
  renderGraphSelectionTask,
  renderGraphPromptDetails,
  renderGraphSelectionShell,
  graphThemeMaturityMeta,
  graphThemeCandidateQualityMeta,
  graphRankThemeCandidates,
  renderGraphThemeSelectionPanel,
  graphIsolatedDecisionMeta,
  openGraphIsolatedDecisionAction,
  loadGraphEditableNote,
  saveGraphIsolatedDecision,
  graphRelationSaveController,
  graphRelationWorkflowController,
  graphAiAnalysisPayload,
  graphAiConfidenceLabel,
  graphNoteIdFromIsolatedItem,
  graphComputedIsolatedNotes,
  graphMarkIsolatedNodes,
  graphIsolatedQueueItems,
  graphNextIsolatedQueueItem,
  renderGraphIsolatedQueue,
  renderGraphIsolatedQueueStrip,
  graphRelationCandidateKey,
  graphRelationPairKey,
  graphCandidateEndpointIds,
  graphCandidateCountKey,
  graphRelationStatusKey,
  graphRelationStatusCountsAsNetworkEdge,
  graphRelationStatusCountsAsConfirmedEdge,
  graphDirectConfirmedRelationCount,
  graphNodeNeedsRelationWorkflow,
  graphNodeNeedsRelationWorkflowFromCurrentGraph,
  graphExistingRelationKeys,
  graphExistingRelationPairKeys,
  graphPreferredPotentialRelationType,
  graphCandidateBlocksFormalRelation,
  graphCandidateCanSaveRelation,
  graphRelationRationaleIsActionable,
  graphPotentialRelationNodeMap,
  graphPotentialRelationActionEndpoints,
  graphPotentialRelationEvidenceText,
  graphPotentialRelationRationaleDraft,
  graphDecoratePotentialRelationCandidate,
  graphCandidateRelationReviewQuestion,
  graphCandidateRelationVerdict,
  graphCandidateLocalReason,
  renderGraphCandidateReviewRows,
  graphPotentialRelationMatchKey,
  graphPotentialRelationNeedsConfirmation,
  graphFindPotentialRelationCandidate,
  graphAiRelationCandidatesForNote,
  graphReviewSummaryFromAnalysis,
  mergePotentialRelationCandidateIntoGraphAnalysis,
  removePotentialRelationCandidateFromGraphAnalysis,
  graphAiConnectRuntimeController,
  refineGraphPotentialRelationsForNote,
  refineGraphPotentialRelationCandidate,
  graphNoteTags,
  graphTitleCharacterOverlap,
  graphLocalRelationCandidatesForNote,
  graphCandidateSourceLabel,
  graphCandidateUndirectedPairKey,
  graphBlockedAiRelationPairKeysForNote,
  graphCandidateEvidenceText,
  graphMergeRelationCandidatesForDisplay,
  graphNotePreviewText,
  graphFullNoteById,
  graphIsolatedPreviewTarget,
  renderGraphIsolatedPreviewPanel,
  renderGraphRelationCandidateCards,
  renderGraphAiConnectCandidates,
  graphWorkspaceRenderDeps,
  graphThemeCandidateNoteIdsForNode,
  renderGraphRelationWorkspaceForNote,
  renderGraphThemeIndexWorkspace,
  graphRelationFormTypeOptions,
  graphCandidatePercent,
  graphManualRelationTargetsForNote,
  clearGraphIsolatedRelationDraft,
  graphIsolatedRelationDraftForNote,
  captureGraphIsolatedRelationDraftFromForm,
  renderGraphIsolatedJoinNetworkFlow,
  renderGraphIsolatedNextStepActions,
  graphIsolatedWorkflowTabKey,
  graphIsolatedDecisionMode,
  graphIsolatedDecisionTitle,
  graphExtractMarkdownSection,
  graphUpsertMarkdownSection,
  graphIsolatedDecisionDefaultText,
  graphNoteHasSavedIsolationDisposition,
  renderGraphIsolatedDecisionForm,
  graphIsolatedWorkflowActiveTab,
  setGraphIsolatedWorkflowActiveTab,
  renderGraphIsolatedWorkflowTabs,
  activateGraphIsolatedWorkflowTab,
  moveGraphIsolatedWorkflowTab,
  previewGraphCandidateInOverlay,
  clearGraphCandidatePreviewInOverlay,
  graphIsolatedFormError,
  markGraphIsolatedRationaleUserEdited,
  updateGraphIsolatedInlinePreview,
  syncGraphIsolatedAiCandidateForm,
  filterGraphManualRelationTargets,
  pickGraphManualRelationTarget,
  saveGraphIsolatedRelationForm,
  saveGraphConfirmedRelation,
  focusGraphRelationAdjustmentInPlace,
  renderGraphIsolatedSelectionPanel,
  renderGraphIsolatedCompletePanel,
  renderGraphBridgeSelectionPanel,
  graphUniqueClusterMeta,
  graphClusterResearchMeta,
  renderGraphClusterSelectionPanel,
  graphResearchNavigatorState,
  renderGraphResearchNavigatorPanel: renderGraphResearchNavigatorPanelForGraph,
  graphEdgeVisibleAtFit,
  graphEdgeShouldRender,
  renderGraphStarfield,
  renderGraphNebulaField,
  renderGraphClusterGlow,
  graphBuildVisualLayout,
  graphEdgePath,
  graphThemeBoundaryMeta,
  renderGraphThemeBoundary,
  graphScopeDirectoryId,
  graphLoadedScopeCoversDirectory,
  expandGraphBrowserTree,
  graphScopedItems,
  graphFocusedItems,
  graphBuildFocusedRelationTypeStats,
  graphFocusedEdgeDirection,
  graphFocusedCounterpartTitle,
  graphFocusCardActionMeta,
  renderGraphFocusContextPanel,
  resetGraphHoverState,
  openGraphSelection,
  openGraphNodeSelectionFromElement,
  applyGraphThinkingHoverState,
  applyGraphNodeHoverState,
  applyGraphEdgeHoverState,
  renderRelationReviewQueueSection,
  renderGraphMetricCard,
  graphPendingAiCandidateCount,
  graphLiveAiAnalysisCounts,
  graphAiAnalysisSummaryState,
  currentGraphVisibleNodeIds,
  currentGraphWritingCandidateNoteIds,
  renderGraphMapPreview,
  renderGraphAiAnalysisCard,
  renderGraphVisualMap,
  buildGraphQuestionSpotSummary,
  buildGraphQuestionSpotSummaryFromItems,
  renderGraphQuestionSpotChip,
  graphThinkingFilterMeta,
  graphCompactActionLabel,
  graphThinkingNoteTitle,
  graphThinkingCleanIds,
  graphThinkingHighlightAttrs,
  graphSelectEdgeActionAttrs,
  buildGraphThinkingItems,
  graphNodeIdsInScope,
  graphRelationInNodeScope,
  graphRelationTouchesNodeScope,
  graphCandidateTouchesNodeScope,
  graphBridgeGapInNodeScope,
  graphConflictItemInNodeScope,
  graphReviewQueueInNodeScope,
  graphMergeRelationsByKey,
  renderGraphThinkingItems,
  renderGraphWorkbenchPriorityQueue,
  renderGraphThinkingReviewNote,
  renderGraphThinkingPanelContent,
  renderGraphThinkingPanel,
  renderGraphWorkbenchPanel,
  renderGraphUtilityDrawer,
  graphSummaryModeNote
} = graphResidualViews;

const graphPanelRuntimeDeps = createGraphPanelPrototypeRuntimeDepsProvider(() => ({
    syncGraphDisclosureState,
    syncAllNoteRelationNetworkStatuses,
    buildGraphPanelState,
    renderGraphPanelForRuntime,
    graphRelationStatusCountsAsNetworkEdge,
    graphScopedItems,
    normalizeGraphRelationTypeFilter,
    graphEdgeMatchesFilters,
    graphFocusedItems,
    graphNodeIdsInScope,
    graphRelationTouchesNodeScope,
    graphRelationInNodeScope,
    graphRelationVisual,
    graphMergeRelationsByKey,
    graphConflictItemInNodeScope,
    graphReviewQueueInNodeScope,
    graphBridgeGapInNodeScope,
    graphHasMeaningfulStructureEdges,
    graphStructureFallbackEdges,
    graphComputedIsolatedNotes,
    graphMarkIsolatedNodes,
    graphBuildIsolatedVisualNodes,
    graphBuildFocusedRelationTypeStats,
    normalizeGraphSelectionForVisibleItems,
    formatClockTime,
    graphPotentialRelationNodeMap,
    graphWeakRelationClues,
    graphClueSummaryState,
    buildGraphThinkingItems,
    buildGraphQuestionSpotSummaryFromItems,
    graphIsolatedQueueItems,
    escapeHtml,
    renderGraphErrorState,
    renderGraphIsolatedQueue,
    renderGraphIsolatedQueueStrip,
    renderGraphBridgeGapSection,
    renderGraphWeakRelationClueSection,
    renderRelationReviewQueueSection,
    renderGraphAiAnalysisCard,
    renderGraphWorkbenchEntryPills,
    renderGraphWorkbenchPanel,
    renderGraphRelationTypeFilter,
    renderGraphInlineNotice,
    renderGraphVisualMap
}));

function renderGraphPanel() {
  const summary = $("graphSummary");
  const canvas = $("graphCanvas");
  const backButton = $("graphBackToDirectory");
  const folder = folderById(state, GRAPH_ORIGINAL_SCOPE_DIRECTORY_ID);
  const scopeDirectoryId = graphScopeDirectoryId();
  return renderGraphPanelShell({
    appState: state,
    graphState,
    dom: { summary, canvas, backButton },
    folder,
    scopeDirectoryId,
    canReuseScopedGraph: graphLoadedScopeCoversDirectory(scopeDirectoryId)
  }, graphPanelRuntimeDeps());
}

async function refreshDirectoryGraph() {
  const refreshed = await refreshDirectoryGraphForRuntime({
    graphState,
    graphScopeDirectoryId,
    graphOriginalScopeDirectoryId: GRAPH_ORIGINAL_SCOPE_DIRECTORY_ID,
    graphLoadedScopeCoversDirectory,
    syncNotesForDirectoryTree,
    fetchDirectoryGraph,
    fetchGraphConflicts,
    fetchRelationReviewQueue,
    upsertGraphNodeSummaries,
    graphLoadErrorMessage,
    renderGraphPanel,
    renderAll
  });
  window.requestAnimationFrame(() => centerGraphViewportIfZoomed());
  return refreshed;
}

const graphRouteRuntime = createGraphRouteRuntime({
  addSystemMessage,
  analyzeDirectoryGraph,
  createIndexCard,
  graphAiConnectRuntimeController,
  graphDataList: graphDataListFromElement,
  graphFindPotentialRelationCandidate,
  graphRelationSaveController,
  graphScopeDirectoryId,
  graphState,
  ensureLocalAiReadyForFeature,
  isDirectoryUnderOriginalRoot,
  isWritingEligibleNote,
  localAiPreviewOptionsForAction,
  localOllamaSetupActive,
  normalizeWritingProjectTitleSeed,
  ollamaBootstrapStatusText,
  openWritingModule,
  previewOllamaLocalAiBootstrapFromUi,
  refineGraphPotentialRelationCandidate,
  renderGraphPanel,
  setStatus,
  setWritingSourceIndexIds,
  suggestedThemeIndexTitle,
  uniqueStrings,
  ensureNotesLoaded,
  writingKnownNoteById,
  writingNoteById,
  writingThemeIndexScopeDirectoryId,
  upsertWritingThemeIndex,
  continueWritingEntry
});
const {
  runGraphAiAnalysis,
  ensureGraphLocalAiReadyForAnalysis,
  runGraphAiConnectForNote,
  saveGraphCandidateRelation,
  saveGraphAiCandidateRelation,
  triggerGraphPotentialRelationRefine,
  confirmGraphPotentialRelationRefine,
  retryGraphPotentialRelationRefine,
  isGraphThemeIndexEligibleNote,
  createGraphThemeIndexFromNoteIds,
  createGraphThemeIndexFromButton
} = graphRouteRuntime;
const SMART_NOTES_DEMO_IMPORT_RETRY_DELAYS_MS = [1000, 1500, 2000, 2500, 3000];

function waitForSmartNotesDemoImportRetry(delayMs = 0) {
  return new Promise((resolve) => {
    const timerHost = typeof window !== "undefined" ? window : globalThis;
    timerHost.setTimeout(resolve, Math.max(0, Number(delayMs || 0) || 0));
  });
}

function shouldRetrySmartNotesDemoImport(error = null) {
  const code = String(error?.code || "").trim();
  return code === "api_unavailable" || code === "desktop_api_unavailable";
}

async function seedSmartNotesProductThinkingDemoWithStartupRetry() {
  let lastError = null;
  for (let attempt = 0; attempt <= SMART_NOTES_DEMO_IMPORT_RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      resetDesktopServiceStatusCache();
      return await seedSmartNotesProductThinkingDemo();
    } catch (error) {
      lastError = error;
      const retryDelay = SMART_NOTES_DEMO_IMPORT_RETRY_DELAYS_MS[attempt];
      if (!shouldRetrySmartNotesDemoImport(error) || retryDelay === undefined) throw error;
      setStatus("本地服务正在启动，正在自动重试导入 Demo...", "busy");
      await waitForSmartNotesDemoImportRetry(retryDelay);
    }
  }
  throw lastError;
}

async function importSmartNotesProductThinkingDemo(options = {}) {
  const { startup = false } = options;
  const shouldRefreshHome = shouldRefreshHomeAfterSmartNotesDemoImport(options);
  setStatus("正在导入 Smart Notes Demo...", "");
  try {
    const result = await seedSmartNotesProductThinkingDemoWithStartupRetry();
    const directoryId = String(result?.directoryId || result?.directory?.id || "").trim();
    if (!directoryId) throw new Error("Demo 导入结果缺少目录 ID");
    await syncDirectoriesFromApi();
    state.browserRootId = rootBoxIdFromFolder(state, directoryId);
    state.selectedFolderId = directoryId;
    await syncNotesForDirectoryTree(directoryId);
    await syncNotesForDirectory(SMART_NOTES_DEMO_GUIDE_DIRECTORY_ID);
    await syncNotesForDirectory("dir_fleeting_default");
    await syncNotesForDirectory("dir_literature_default");
    await loadWritingThemeIndexes();
    const firstNoteId = smartNotesDemoStartupNoteId({ result, notes: state.notes });
    const shouldOpenGuide = Boolean(firstNoteId) && (startup || !shouldRefreshHome);
    if (shouldOpenGuide) {
      state.selectedFileId = firstNoteId;
      openNoteById(firstNoteId, { preferTitleSelection: false });
    }
    const writingProjectId = String(result?.writingProjectId || "").trim();
    if (writingProjectId) {
      try {
        const project = await fetchWritingProject(writingProjectId);
        writingState.project = project;
        populateWritingFormFromProject(project);
        const draftScaffoldId = String(result?.draftScaffoldId || project?.scaffold_id || "").trim();
        if (draftScaffoldId) {
          const scaffold = await fetchDraftScaffold(draftScaffoldId);
          writingState.scaffold = scaffold.item || null;
          writingState.scaffoldMarkdown = scaffold.export?.markdown || scaffold.item?.markdown || "";
        }
      } catch {}
    }
    if (startup) {
      // Demo routes should always reopen into a readable, stable first-screen
      // graph state instead of inheriting stale filters or expanded UI state
      // from a previous session.
      resetGraphDemoPresentationState();
    }
    await refreshDirectoryGraph();
    if (shouldOpenGuide) activateModule("explorer");
    else if (shouldRefreshHome) activateModule("today");
    renderAll();
    if (shouldOpenGuide) {
      state.selectedFileId = firstNoteId;
      openNoteById(firstNoteId, { preferTitleSelection: false });
      editor?.resetEditorViewportToStart?.();
    }
    const refreshedHome = shouldRefreshHome && !shouldOpenGuide;
    const importedStatus = smartNotesDemoImportedStatus(result, { openedGuide: shouldOpenGuide, refreshedHome });
    if (refreshedHome) {
      state.todayNoticeMessage = importedStatus;
      renderAll();
    }
    setStatus(importedStatus, "ok");
    return true;
  } catch (error) {
    if (startup) {
      if (!state.notes.length) {
        try {
          await syncDirectoriesFromApi();
          const demoFolder = smartNotesDemoExistingFolder(state.folders);
          if (demoFolder?.id) {
            state.browserRootId = rootBoxIdFromFolder(state, demoFolder.id);
            state.selectedFolderId = demoFolder.id;
            await syncNotesForDirectory(demoFolder.id);
            await syncNotesForDirectory(SMART_NOTES_DEMO_GUIDE_DIRECTORY_ID);
          }
        } catch {}
      }
      const fallbackNoteId = smartNotesDemoStartupNoteId({ result: {}, notes: state.notes });
      if (fallbackNoteId) {
        state.selectedFileId = fallbackNoteId;
        activateModule("explorer");
        openNoteById(fallbackNoteId, { preferTitleSelection: false });
        editor?.resetEditorViewportToStart?.();
        setStatus(smartNotesDemoOpenedExistingGuideStatus(), "ok");
        return true;
      }
    }
    setStatus(`Smart Notes Demo 导入失败：${String(error?.message || error)}`, "bad");
    throw error;
  }
}
function openImportModule() {
  activateModule("imports");
  setStatus("先选择 Obsidian 文件夹，生成预览后再确认导入。", "ok");
  return true;
}

async function ensureNoteBodyLoaded(noteId) { return noteRuntimeController.ensureNoteBodyLoaded(noteId); }

function openNoteById(id, options = {}) {
  const note = state.notes.find((n) => n.id === id);
  if (!note) return false;
  const activeTab = state.tabs.find((t) => t.id === state.activeTabId);
  if (activeTab?.dirty && activeTab.noteId !== id) {
    editor.updateActiveTabFromEditor();
    void editor.autoSaveTabById(activeTab.id, "switch-note");
  }
  const focusedIds = Array.isArray(state.literatureQueueFocusNoteIds) ? state.literatureQueueFocusNoteIds : [];
  if (focusedIds.length) {
    const keepFocus =
      String((note?.folderId ? typeFromFolder(state, note.folderId) : "") || note?.noteType || "").trim() === "literature" &&
      focusedIds.includes(String(id || "").trim());
    if (!keepFocus) clearLiteratureQueueFocus();
  }
  if (note) applyExplorerSelectionContext({ note, syncSearch: true, expandFolder: true });
  editor.openNoteTab(id, options);
  renderAll();
  if (options.focusDistillation) {
    state.inspectorVisible = false;
    editor?.setInspectorVisible?.(false);
    window.setTimeout(() => {
      editor?.jumpToInspectorSection?.("[data-note-distillation-section]");
    }, 80);
  }
  ensureNoteBodyLoaded(id);
  return true;
}

const relationEntryRuntimeController = createRelationEntryRuntimeController(() => ({
  state,
  editor,
  activateModule,
  openNoteById,
  windowRef: window
}));

function openNoteRelationEditor(noteId = "", options = {}) {
  return relationEntryRuntimeController.openNoteRelationEditor(noteId, options);
}

const openRecordPermanentWorkflowFromCurrentNote = createRecordPermanentWorkflowOpener({
  getRecordPermanentButton: () => editor?.els?.recordPermanent,
  setStatus,
  setTimeout: (callback, delay) => window.setTimeout(callback, delay),
  now: () => Date.now()
});

const openSystemMessageWorkflow = createSystemMessageWorkflowOpener({
  getNotes: () => state.notes,
  setNotes: (notes) => {
    state.notes = Array.isArray(notes) ? notes : state.notes;
  },
  ensureNotesLoaded,
  searchNotes,
  mapNoteItem,
  systemMessageSubjectText,
  closeSystemMessages,
  selectWritingThemeIndex,
  isWritingEligibleNote,
  writingKnownNoteById,
  continueWritingEntry,
  suggestedWritingProjectTitle,
  openWritingModule,
  setStatus,
  handleStateChange,
  getGraphEdges: () => graphState.item?.edges,
  setGraphSelection: (selection) => {
    graphState.selection = selection;
  },
  renderGraphPanel,
  openNoteRelationEditor,
  openGraphFollowupNote,
  activateModule,
  openNoteById,
  openRecordPermanentWorkflowFromCurrentNote
});

const graphFollowupController = createGraphFollowupController(() => ({
  activateModule,
  continueWritingEntry,
  continueWritingProjectEntry,
  currentGraphVisibleNodeIds,
  document,
  editor,
  graphRelationTypeLabel,
  graphWritingContinuationEntry,
  isWritingEligibleNote,
  openNoteById,
  openWritingModule,
  parseWritingBasketIds,
  setStatus,
  state,
  suggestedWritingProjectTitle,
  window,
  writingKnownNoteById
}));

function openGraphFollowupNote(noteId = "", action = "", options = {}) { return graphFollowupController.openGraphFollowupNote(noteId, action, options); }

function removeNoteFromClientState(noteId = "") {
  const cleanNoteId = String(noteId || "").trim();
  if (!cleanNoteId) return false;
  state.notes = state.notes.filter((note) => note.id !== cleanNoteId);
  state.tabs = state.tabs.filter((tab) => tab.noteId !== cleanNoteId);
  if (state.selectedFileId === cleanNoteId) state.selectedFileId = null;
  if (state.activeTabId && !state.tabs.find((tab) => tab.id === state.activeTabId)) {
    state.activeTabId = state.tabs[0]?.id || null;
  }
  return true;
}

function moveNoteInClientState(noteId = "", directoryId = "", moved = null) {
  const cleanNoteId = String(noteId || "").trim();
  const cleanDirectoryId = String(directoryId || "").trim();
  if (!cleanNoteId || !cleanDirectoryId) return false;
  const note = state.notes.find((item) => item.id === cleanNoteId);
  if (!note) return false;
  note.folderId = String(moved?.directoryId || cleanDirectoryId).trim() || cleanDirectoryId;
  note.noteType = typeFromFolder(state, note.folderId);
  note.markdownPath = moved?.markdownPath || note.markdownPath;
  note.updatedAt = moved?.updatedAt || new Date().toISOString();
  state.selectedFolderId = note.folderId;
  state.selectedFileId = note.id;
  return true;
}

const appShellStateChangeDeps = createAppShellStateChangePrototypeDepsProvider(() => ({
    GRAPH_ORIGINAL_SCOPE_DIRECTORY_ID,
    activateModule,
    addSystemMessage,
    aiInboxState,
    analyzePermanentNote,
    applyExplorerSelectionContext,
    clearSaveAiSuggestion,
    confirmPermanentNoteDistillation,
    continueWritingEntry,
    continueWritingProjectEntry,
    createNote,
    createNoteInSelectedFolder,
    createPrimaryOriginalNote,
    createWritingProjectFromCurrentBasket,
    deleteDirectory,
    deleteNote,
    descendantDirectoryIds,
    editor,
    ensureAiReadyForFeature,
    ensureLocalAiReadyForFeature,
    ensureNoteBodyLoaded,
    expandGraphBrowserTree,
    explorer,
    folderById,
    generatedOriginalNoteIdFromBody,
    graphAssociateNoteRoute,
    graphNodeNeedsRelationWorkflowFromCurrentGraph,
    graphRelationWorkflowController,
    graphState,
    handleStateChange,
    confirm: window.confirm.bind(window),
    importSmartNotesDemo: importSmartNotesProductThinkingDemo,
    isOriginalRecordableSource,
    isPermanentLikeNote,
    mapNoteItem,
    moveNote,
    moveNoteInClientState,
    movedDirectoryFsPath,
    noteGeneratedOriginalNoteId,
    noteMainPathWritingContinuationEntry,
    notePersistenceFieldsForSave,
    noteSaveFailureFeedback,
    normalizeAiInboxFilters,
    normalizeAuthorshipItem,
    normalizeOptionalNumber,
    normalizeThinkingStatusItem,
    normalizeWritingProjectTitleSeed,
    noteAnalysisSystemMessageForResult,
    openAiInboxModule,
    openGraphSelection,
    openRelationComposerFromGraphAction,
    openImportModule,
    openNoteById,
    openNoteRelationEditor,
    openSystemMessages,
    openWritingModule,
    originalDraftBodyFromSource,
    parseLinks,
    parseTags,
    refreshDirectoryGraph,
    removeNoteFromClientState,
    renamedDirectoryFsPath,
    renderAll,
    renderDistillationPanel,
    replaceFirstMarkdownTitle,
    rootBoxIdFromFolder,
    runSourceDistillAi,
    saveAiSuggestion,
    setGraphIsolatedWorkflowActiveTab,
    setStatus,
    showSaveAiSuggestionForNote,
    state,
    syncExplorerContextToActiveTab,
    syncExplorerContextToNote,
    syncDirectoriesFromApi,
    syncLoadedNotesForDirectories,
    syncNoteRelationNetworkStatus,
    syncNotesForDirectory,
    syncSourcePromotionSystemMessageForNote,
    titleFromSeedText,
    typeFromFolder,
    updateDirectory,
    updateNote,
    updatePermanentNoteDistillation,
    usingLocalFallbackData,
    windowRef: window,
    withGeneratedOriginalMarker,
    withGeneratedOriginalReference,
    writingCenterContinuationFailureMessage,
    writingCenterContinuationStatusMessage
  }));

async function handleStateChange(reason, payload = {}) { return routeAppShellStateChange(reason, payload, appShellStateChangeDeps()); }

const contextMenu = new ContextMenu($("contextMenu"));
const createBoxDialog = new CreateBoxDialog({
  maskEl: $("newBoxModal"),
  nameEl: $("modalBoxName"),
  parentEl: $("modalParentFolder"),
  fsPathEl: $("modalFsPath"),
  browseEl: $("modalBrowsePath"),
  maxEl: $("modalMaxCards"),
  cancelEl: $("modalCancel"),
  createEl: $("modalCreate"),
  onStatus: setStatus,
  pickDirectory: desktopCommands.browseDirectory
});
const permanentNoteDialog = new PermanentNoteDialog({
  maskEl: $("permanentNoteModal"),
  modalTitleEl: $("permanentNoteModalTitle"),
  modalNoteEl: $("permanentNoteModalNote"),
  sourceCardEl: $("permanentNoteSourceCard"),
  sourceTypeEl: $("permanentNoteSourceType"),
  sourceTitleEl: $("permanentNoteSourceTitle"),
  sourceHintEl: $("permanentNoteSourceHint"),
  directoryLabelEl: $("permanentNoteTargetFolderLabel"),
  directorySelectEl: $("permanentNoteTargetFolder"),
  directoryHintEl: $("permanentNoteTargetHint"),
  cancelEl: $("permanentNoteCancel"),
  createEl: $("permanentNoteCreate")
});
const requestTextInput = createTextInputDialog({ documentRef: document });

createBoxDialog.onCreate = async ({ name, parentId, fsPath, maxCards }) => {
  await handleCreateDirectoryFromDialog({ name, parentId, fsPath, maxCards }, {
    state,
    folderById,
    joinFsPath,
    createDirectory,
    mapDirectoryItem,
    rootBoxIdFromFolder,
    explorer,
    dialog: createBoxDialog,
    setStatus,
    renderAll
  });
};

async function selectPermanentDirectory({
  sourceNoteId = "",
  sourceType = "",
  sourceTitle = "",
  sourceHint = ""
} = {}) {
  const options = permanentDirectoryDialogOptions();
  if (!options.length) {
    setStatus("当前还没有可用的永久笔记盒目录", "warn");
    return "";
  }
  const directoryId = await permanentNoteDialog.open({
    sourceType,
    sourceTypeLabel: sourceNoteTypeLabel(sourceType),
    sourceTitle: sourceTitle || sourceNoteId || "未命名笔记",
    sourceHint: sourceHint || "选择保存位置，然后创建永久笔记。",
    directoryOptions: options,
    defaultDirectoryId: defaultPermanentDirectoryId(),
    actionLabel: "在这个目录创建"
  });
  if (directoryId) lastChosenPermanentDirectoryId = directoryId;
  return directoryId;
}

async function selectNoteMoveDirectory({
  noteId = "",
  noteTitle = "",
  currentDirectoryId = ""
} = {}) {
  const options = noteMoveDirectoryOptions(currentDirectoryId);
  if (!options.length) {
    setStatus("当前文件盒里没有其他可移动目录", "warn");
    return "";
  }
  return permanentNoteDialog.open({
    modalTitle: "移动笔记",
    modalNote: "选择要移动到的目录。这里只显示当前文件盒里可用的目录。",
    sourceCardVisible: false,
    directoryLabel: "目标目录",
    directoryOptions: options,
    defaultDirectoryId: options[0]?.id || "",
    actionLabel: "移动到这个目录",
    sourceTitle: noteTitle || noteId || "未命名笔记"
  });
}

const explorer = new ExplorerPane(createExplorerPaneHostDeps({
  $,
  state,
  contextMenu,
  createBoxDialog,
  desktopCommands,
  openNoteById,
  setStatus,
  handleStateChange,
  selectPermanentDirectory,
  selectNoteMoveDirectory,
  requestTextInput,
  resolveNotePath
}));

const editor = new EditorPane(createEditorPaneHostDeps({
  $,
  state,
  desktopCommands,
  editorSelectionAiActionElements,
  setStatus,
  handleStateChange,
  openNoteById,
  noteMainPathWritingContinuationEntry,
  syncRelationNetworkSystemMessageForNote,
  selectPermanentDirectory,
  currentLiteratureTemplateSectionLabels,
  literatureTemplateSectionLabelCandidates,
  currentVaultPath,
  renderStatusMeta,
  renderWorkspaceStatusHint,
  refreshDirectoryGraph,
  renderAll
}));
const openRelationComposerFromGraphAction = createGraphRelationComposerEntry({ editor, graphState });
loadNoteTemplateSettingsFromStorage();
window.__prototypeEditor = editor;
window.__prototypeState = state;
window.__prototypeImport = {
  showResult: showImportResult, renderPage: renderImportPageShell
};
window.__prototypeGraph = {
  openFollowupNote: openGraphFollowupNote, openNoteById,
  runAiAnalysis: runGraphAiAnalysis, runAiConnectForNote: runGraphAiConnectForNote, createThemeIndexFromNoteIds: createGraphThemeIndexFromNoteIds,
  getSelectedFileId: () => state.selectedFileId,
  getActiveModule: () => state.module
};

installEditorShellEventBindings({
  $,
  state,
  editor,
  getSaveAiSuggestion: () => saveAiSuggestion,
  setEditorHelperDismissed: (value) => {
    editorHelperDismissed = value;
  },
  setEditorHelperMuted: (value) => {
    editorHelperMuted = value;
  },
  writeStoredBoolean,
  editorHelperMuteKey: EDITOR_HELPER_MUTE_KEY,
  hideEditorHelper,
  openNoteById,
  dismissSaveAiSuggestionForLater,
  dismissedSaveAiSuggestionKeys,
  clearSaveAiSuggestion,
  renderWorkspaceStatusHint,
  applyFocusModeChrome,
  setStatus
});

installSaveAiSuggestionRouteEventBindings({
  $,
  windowRef: window,
  state,
  editor,
  getSaveAiSuggestion: () => saveAiSuggestion,
  clearSaveAiSuggestion,
  saveAiSuggestionPrimaryRoute,
  activateModule,
  openNoteById,
  handleStateChange,
  setStatus
});

installSettingsEventBindings({
  $,
  state,
  settingsState,
  desktopCommands,
  editor,
  updateController,
  setSettingsSection,
  setSettingsItem,
  activateModule,
  refreshVaultSettings,
  refreshMobileAccessStatus,
  rotateMobileAccessPairingCodeFromUi,
  confirmMobilePairRequestFromUi,
  revokeMobileDeviceFromUi,
  loadNoteTemplateSettingsFromStorage,
  syncDirectoriesFromApi,
  syncNotesForDirectory,
  createEncryptedVaultBackup,
  restoreEncryptedVaultBackup,
  renderAll,
  renderSettingsPanel,
  renderScheduledTasksWorkspace,
  handleStateChange,
  openWritingModule,
  applyWritingTab: (tab) => applyWritingTab(tab, { root: $("writingPanel")?.querySelector?.(".writing-shell"), documentRef: document }),
  loadWritingThemeIndexes,
  setStatus,
  updateStateRemindLater,
  updateStateIgnoreLatest,
  updateStateAutoCheckEnabled,
  openNoteTemplatePreview,
  saveNoteTemplateFromEditor,
  resetNoteTemplateToDefault,
  updateNoteTemplatePreviewFromEditor,
  closeNoteTemplatePreview,
  scheduledTaskFiltersFromUi,
  scheduledTaskFormFromUi,
  resetScheduledTaskForm,
  refreshScheduledTasks,
  runDueScheduledTasksFromUi,
  saveScheduledTaskFromUi,
  editScheduledTaskFromList,
  setScheduledTaskStatus,
  applyScheduledTaskTemplateToForm
});
async function applyAiRuntimeModeChange(nextMode = "auto") {
  return applyAiRuntimeModeChangeForRuntime(nextMode, {
    settingsState,
    normalizeAiRuntimeMode,
    aiDefaultsForRuntimeMode,
    reconcileAiSelectionState,
    persistAiSettingsToStorage,
    syncAiSettingsToApi,
    isAiLocalFlowActive,
    shouldUseOllamaLocalRuntime,
    previewOllamaLocalAiBootstrapFromUi,
    localAiPreviewOptionsForAction,
    refreshAiRoutePreview,
    renderSettingsPanel,
    setStatus,
    currentAiProviderId,
    settingsAiAdvancedRuntimeModeLabel
  });
}

async function resumePendingAiSettingsAction(...args) {
  if (await writingProjectRuntimeController.resumePendingContextualAiAction(...args)) return true;
  return editor.resumePendingContextualAiAction?.(...args) || false;
}

installSettingsAiEventBindings({
  $,
  settingsState,
  normalizeAiRuntimeMode,
  applyAiRuntimeModeChange,
  persistAiSettingsToStorage,
  syncAiSettingsToApi,
  refreshAiRoutePreview,
  renderSettingsPanel,
  setStatus,
  applyAiModelPackChange,
  selectInstalledLocalModelFromUi,
  markAiProviderDraftTouched,
  syncAiProviderConfigToApi,
  aiTestBlockedReason,
  currentAiProviderId,
  aiSettingsPayload,
  authModeForProvider,
  runAiTestChat,
  checkCurrentAiProviderHealth,
  detectOllamaModels,
  startOllamaRuntimeFromUi,
  stopOllamaRuntimeFromUi,
  pullRecommendedOllamaModel,
  copyTextToClipboard,
  applySettingsAiQuickSetup,
  openSettingsAiDialog,
  closeSettingsAiDialogs,
  confirmRemoteAiUse,
  onAiSettingsReady: resumePendingAiSettingsAction
});
void autoPrepareLocalAiOnStartup();
bindAiSuggestionsWorkspaceEvents(document, createAiSuggestionsWorkspaceHostDeps({
  settingsState,
  aiSuggestionFiltersFromUi,
  refreshAiSuggestions,
  loadAiSuggestionDetail,
  applyAiSuggestionStatus,
  render: renderAiSuggestionsWorkspace,
  activateModule,
  openNoteById,
  setStatus
}));
installSettingsFeedbackEventBindings({
  $,
  buildFeedbackMailtoUrl,
  openFeedbackMailtoUrl,
  setStatus
});

installDirtyTabsBeforeUnloadEventBindings({
  windowRef: window,
  editor
});

installWritingPanelBasketEventHandlers({
  $,
  depsProvider: () => ({
    state,
    writingState,
    writingNoteEligibility,
    continueWritingEntry,
    parseWritingBasketIds,
    setWritingBasketIds,
    syncWritingProject,
    normalizeWritingProjectTitleSeed: computeNormalizeWritingProjectTitleSeed,
    writingCandidateNotes,
    uniqueStrings,
    planWritingCandidateFocus,
    writingKnownNoteById,
    isWritingEligibleNote,
    isWritingCandidateDetailsExpanded: () => Boolean($("writingCandidateDetails")?.open),
    suggestedWritingProjectTitle,
    describeWritingBatchAppendStatus,
    resetWritingStrongModelState,
    clearWritingBasket,
    clearWritingSourceIndexIds,
    resetWritingProjectContext,
    renderWritingPanel,
    showWritingResult,
    handleWritingBasketManualInput,
    prepareWritingStrongModelAnalysis,
    contextualAiController: writingProjectRuntimeController.contextualAiController,
    writingBasketEntries,
    deriveWritingLocalBookIdeas,
    currentWritingBookStructure,
    normalizeWritingBookStructure,
    updateWritingProjectBookStructure,
    writingNoteById,
    removeWritingBasketId,
    openNoteById,
    setStatus
  })
});

installWritingTabEvents({
  root: $("writingPanel")?.querySelector?.(".writing-shell"),
  documentRef: document
});
installWritingRelatedPanelEvents({
  root: $("writingPanel")?.querySelector?.(".writing-shell"),
  documentRef: document
});
installWritingSidebarActionEvents({
  root: $("moduleSidebar"),
  documentRef: document,
  applyWritingTab: (tab) => applyWritingTab(tab, { root: $("writingPanel")?.querySelector?.(".writing-shell"), documentRef: document })
});

installWritingThemeIndexEventHandlers({
  $,
  depsProvider: () => ({
    loadWritingThemeIndexes,
    refreshWritableThemeDiscoverySuggestions,
    saveWritingBasketAsThemeIndex,
    ignoreWritableThemeDiscoverySuggestion,
    saveWritableThemeDiscoverySuggestion,
    selectWritingThemeIndex,
    writingThemeIndexContinuationRoute,
    continueWritingProjectEntry,
    useThemeIndexAsWritingEntry,
    setStatus
  })
});

installWritingThemeDetailEventHandlers({
  $,
  depsProvider: () => ({
    saveSelectedThemeIndexDetail,
    useThemeIndexAsWritingEntry,
    continueWritingProjectEntry,
    writingThemeIndexById,
    fetchIndexCard,
    findExistingWritingProjectForTheme,
    writingThemeIndexNoteIds,
    createWritingProjectFromThemeIndex,
    syncSelectedThemeIndexWithBasket,
    activateModule,
    openNoteById,
    removeNoteFromSelectedThemeIndex,
    setStatus
  })
});

installWritingProjectListEventHandlers({
  $,
  depsProvider: () => ({
    writingState,
    continueWritingProjectEntry,
    openWritingProject,
    copyWritingScaffold,
    exportWritingScaffold,
    setStatus
  })
});

installWritingProjectHistoryEventHandlers({
  $,
  depsProvider: () => ({
    state,
    writingState,
    openScaffoldVersion,
    copyWritingScaffold,
    exportWritingScaffold,
    promptVersionNoteEdit,
    updateDraftScaffoldVersionNote,
    updateDraftNoteVersionNote,
    setWritingCurrentDraftNote,
    loadWritingProjectsList,
    loadWritingDraftVersions,
    loadWritingScaffoldVersions,
    renderWritingPanel,
    writingNoteById,
    fetchNote,
    mapNoteItem,
    activateModule,
    openNoteById,
    syncWritingProjectFiltersFromUi,
    setStatus
  })
});

installWritingDraftActionEventHandlers({
  $,
  depsProvider: () => ({
    $,
    state,
    writingState,
    createWritingProjectFromCurrentBasket,
    createWritingProjectFromThemeIndex,
    currentWritingContinuationEntry,
    continueWritingProjectEntry,
    writingCenterContinuationStatusMessage,
    writingCenterContinuationFailureMessage,
    createDraftScaffold,
    updateDraftScaffold,
    syncWritingProject,
    currentWritingVersionNote,
    showWritingResult,
    loadWritingProjectsList,
    loadWritingScaffoldVersions,
    loadWritingDraftVersions,
    prepareWritingStrongModelAnalysis,
    renderWritingPanel,
    applyWritingTab: (tab) => applyWritingTab(tab, { root: $("writingPanel")?.querySelector?.(".writing-shell"), documentRef: document }),
    copyWritingScaffold,
    exportWritingScaffold,
    writingDraftDirectoryId,
    writingDraftTitle,
    writingDraftBody,
    parseWritingBasketIds,
    setWritingBasketIds,
    uniqueStrings,
    createNote,
    updateNote,
    bindWritingDraftNote,
    mapNoteItem,
    openWritingDraftNoteById,
    setStatus
  })
});

installGraphEntryEventBindings({
  $,
  state,
  explorer,
  graphState,
  refreshDirectoryGraph,
  renderAll,
  setStatus
});

bindAiInboxWorkspaceEvents($("aiInboxPanel"), createAiInboxWorkspaceHostDeps({
  aiInboxState,
  openAiInboxModule,
  applyAiInboxFiltersFromUi,
  loadAiInboxDetail,
  openAiInboxNote,
  recordAiInboxReviewDecision,
  acceptAiInboxLinkSuggestion,
  promoteAiInboxArtifactToNote,
  adoptAiInboxFieldSuggestionDraft,
  applyAiInboxSuggestionStatus,
  runAiInboxSummary,
  applyAiInboxRecommendedAction,
  setStatus
}));
todayOrganizingEntryRuntime.installEvents();
installGraphNodeClickFallbackEvents(document, { graphState, renderGraphPanel, openGraphSelection, openRelationComposerFromGraphAction, setStatus, openGraphNodeSelectionFromElement });
installGraphWorkbenchClickFallbackEvents(document, {
  graphState,
  graphWorkbenchTabMeta,
  applyGraphWorkbenchEntryInteraction,
  applyGraphWorkbenchTabInteraction,
  applyGraphWorkbenchCloseInteraction,
  renderGraphPanel,
  runGraphAiAnalysis,
  setStatus
});
bindGraphCanvasEvents($("graphPanel"), {
  appState: state,
  graphState,
  graphViewportDragState,
  graphUtilityDrawerDragState,
  aiInboxState,
  systemMessages,
  normalizeAiInboxFilters,
  setSelectedSystemMessageId: (messageId) => {
    selectedSystemMessageId = String(messageId || "").trim();
  },
  openSystemMessages,
  refreshDirectoryGraph,
  resetGraphHoverState,
  applyGraphThinkingHoverState,
  applyGraphNodeHoverState,
  applyGraphEdgeHoverState,
  beginGraphUtilityDrawerDrag,
  beginGraphViewportDrag,
  updateGraphUtilityDrawerDrag,
  updateGraphViewportDrag,
  endGraphUtilityDrawerDrag,
  endGraphViewportDrag,
  renderGraphPanel,
  dismissSafeOverlaysForEscape: (event) => dismissSafeOverlaysForEscape(event, {
    graphState,
    closeSystemMessages,
    isSystemMessageModalOpen,
    renderGraphPanel,
    setStatus,
    confirm: window.confirm.bind(window)
  }),
  setStatus,
  moveGraphIsolatedWorkflowTab,
  activateGraphIsolatedWorkflowTab,
  pickGraphManualRelationTarget,
  saveGraphIsolatedRelationForm,
  graphWorkbenchTabMeta,
  applyGraphWorkbenchEntryInteraction,
  applyGraphWorkbenchTabInteraction,
  applyGraphWorkbenchCloseInteraction,
  applyGraphEmptyCloseInteraction,
  applyGraphUtilityDrawerCloseInteraction,
  applyGraphUtilityDrawerOpenState,
  applyGraphSectionOpenState,
  runGraphAiAnalysis,
  captureGraphIsolatedRelationDraftFromForm,
  runGraphAiConnectForNote,
  openRelationComposerFromGraphAction,
  graphRelationWorkflowController,
  saveGraphAiCandidateRelation,
  confirmGraphPotentialRelationRefine,
  retryGraphPotentialRelationRefine,
  saveGraphCandidateRelation,
  previewGraphCandidateInOverlay,
  clearGraphCandidatePreviewInOverlay,
  saveGraphIsolatedDecision,
  createGraphThemeIndexFromButton,
  openGraphIsolatedDecisionAction,
  focusGraphRelationAdjustmentInPlace,
  openGraphFollowupNote,
  openGraphSelection,
  openGraphNodeSelectionFromElement,
  openNoteById: (noteId) => { const opened = openNoteById(noteId, { preferTitleSelection: false }); state.module = "graph"; renderGraphPanel(); return opened; },
  syncGraphIsolatedAiCandidateForm,
  graphIsolatedFormError,
  applyGraphRelationTypeFilterInteraction,
  setGraphRelationTypeFilter,
  graphRelationTypeLabel,
  markGraphIsolatedRationaleUserEdited,
  filterGraphManualRelationTargets,
  applyGraphViewModeInteraction,
  applyGraphTaskViewInteraction,
  graphReadingModeMeta,
  applyGraphWheelZoomInteraction,
  graphZoomOption,
  graphZoomStep,
  applyGraphThinkingToggleInteraction,
  applyGraphThinkingHideInteraction,
  applyGraphUtilityVisibilityInteraction,
  applyGraphThinkingVisibilityInteraction,
  applyGraphThinkingFilterInteraction,
  graphThinkingFilterMeta,
  applyGraphZoomOptionInteraction,
  applyGraphZoomStepInteraction,
  applyGraphReadingLensInteraction,
  graphReadingLensMeta,
  applyGraphFocusDepthInteraction,
  setGraphFocusDepth,
  graphFocusDepthMeta,
  graphFocusContextCollapsedState,
  graphFocusContextCollapsedStatus,
  applyGraphFocusContextModeInteraction,
  setGraphFocusContextMode,
  graphFocusContextModeMeta,
  centerGraphViewportIfZoomed,
  dismissGraphCanvasHelpHint,
  requestAnimationFrame: window.requestAnimationFrame.bind(window)
});
installAppRailEventBindings({
  documentRef: document,
  state,
  getGraphModuleActivationGuardUntil: () => graphModuleActivationGuardUntil,
  setGraphModuleActivationGuardUntil: (value) => {
    graphModuleActivationGuardUntil = value;
  },
  activateModule,
  previewOllamaLocalAiBootstrapFromUi,
  localAiPreviewOptionsForAction,
  refreshDirectoryGraph,
  openAiInboxModule,
  refreshVaultSettings,
  openWritingModule,
  openDistillationModule,
  dismissSafeOverlaysForNavigation: () => dismissSafeOverlaysForNavigation({
    graphState,
    permanentRelationWorkspaceState: editor.permanentRelationWorkspaceState,
    closePermanentRelationWorkspace: () => editor.closePermanentRelationWorkspace(),
    closeSystemMessages,
    isSystemMessageModalOpen,
    renderGraphPanel,
    setStatus,
    confirm: window.confirm.bind(window)
  }),
  setStatus
});

installSystemMessageEventHandlers({
  $,
  depsProvider: systemMessageEventDeps
});

installDistillationEventBindings({
  $,
  state,
  distillationState,
  openDistillationModule,
  renderDistillationPanel,
  activateModule,
  openWritingModule,
  handleStateChange,
  renderAll,
  openDistillationQueueNote
});

installSidebarFlowEventHandler({
  $,
  depsProvider: () => ({
    state,
    activateModule,
    openDistillationModule,
    openWritingModule,
    continueWritingProjectEntry,
    handleStateChange,
    openNoteById,
    renderAll,
    setStatus,
    dismissSafeOverlaysForNavigation: () => dismissSafeOverlaysForNavigation({
      graphState,
      permanentRelationWorkspaceState: editor.permanentRelationWorkspaceState,
      closePermanentRelationWorkspace: () => editor.closePermanentRelationWorkspace(),
      closeSystemMessages,
      isSystemMessageModalOpen,
      renderGraphPanel,
      setStatus,
      confirm: window.confirm.bind(window)
    })
  })
});

installMobileNoteEventBindings({
  $,
  state,
  resolveExplorerNewNoteFolderId,
  folderById,
  rootBoxIdFromFolder,
  handleStateChange
});

installQuickActionEventBindings({
  documentRef: document,
  windowRef: window,
  state,
  editor,
  getGraphModuleActivationGuardUntil: () => graphModuleActivationGuardUntil,
  folderById,
  displayFolderName,
  syncNotesForDirectoryTree,
  syncRailSelectionState,
  renderAll,
  setStatus
});

installAppGlobalKeyboardEvents({
  documentRef: document,
  state,
  explorer,
  editor,
  handleSystemMessageEscapeKey,
  systemMessageEventDeps,
  dismissSafeOverlaysForEscape: (event) => dismissSafeOverlaysForEscape(event, {
    graphState,
    permanentRelationWorkspaceState: editor.permanentRelationWorkspaceState,
    closePermanentRelationWorkspace: () => editor.closePermanentRelationWorkspace(),
    closeSystemMessages,
    isSystemMessageModalOpen,
    renderGraphPanel,
    setStatus,
    confirm: window.confirm.bind(window)
  }),
  noteDeleteKeyRoute,
  syncExplorerContextToActiveTab,
  folderById,
  childFolders,
  notesInFolder,
  openNoteById,
  renderAll,
  setStatus
});
function appStartupDeps() {
  return {
    $,
    state,
    importState,
    desktopCommands,
    windowRef: typeof window !== "undefined" ? window : undefined,
    setUsingLocalFallbackData: (value) => { usingLocalFallbackData = value === true; },
    getUsingLocalFallbackData: () => usingLocalFallbackData,
    getStartupAutoOpenSuppressed: () => startupAutoOpenSuppressed,
    renderImportPageShell,
    createImportToolbarActions,
    currentImportToolbarValues,
    activeImportPreviewContext,
    selectionSummary,
    rootBoxIdFromFolder,
    previewImport,
    confirmImport,
    defaultSelectedCandidateIds,
    setImportRecordId,
    showImportResult,
    syncImportSelection,
    confirmedImportTargetDirectoryId,
    preferredImportDirectoryId,
    folderById,
    syncNotesForDirectory,
    refreshImportedNotesView,
    renderImportToolbar,
    normalizeImportWorkspaceTab,
    setImportWorkspaceTab,
    hideImportOperationResultModal,
    openFirstImportedPermanentNote, openImportedLiteratureQueue,
    addImportedPermanentNotesToWritingBasket,
    createWritingProjectFromImportedPermanentNotes,
    setImportResultFocus,
    applyCandidateSelection,
    rerenderImportResult,
    directoryPathLabel,
    updateExportTargetHint,
    exportMarkdown,
    showExportResult,
    refreshVaultSettings,
    syncDirectoriesFromApi,
    syncNotesForDirectoryTree,
    getApiBase,
    isApiConnectionError,
    apiConnectionErrorMessage,
    activateModule,
    renderAll,
    confirm: window.confirm.bind(window),
    importSmartNotesProductThinkingDemo,
    preferredLocalFallbackNote,
    openNoteById,
    openStartupUntitledNote,
    updateController,
    setStatus
  };
}

async function bootstrap() { return bootstrapAppForRuntime(appStartupDeps()); }

bootstrap();
