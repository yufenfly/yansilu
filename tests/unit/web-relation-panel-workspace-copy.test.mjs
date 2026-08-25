import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { EditorSemanticRelationsView } from "../../apps/web/src/editor-semantic-relations-view.js";
import { editorRelatedNotesSummary } from "../../apps/web/src/editor-related-notes-panel.js";

const sourcePath = new URL("../../apps/web/src/components-editor-pane.js", import.meta.url);
const sidebarViewPath = new URL("../../apps/web/src/permanent-note-sidebar-view.js", import.meta.url);
const sidebarControllerPath = new URL("../../apps/web/src/permanent-note-sidebar-controller.js", import.meta.url);
const semanticRelationsViewPath = new URL("../../apps/web/src/editor-semantic-relations-view.js", import.meta.url);
const semanticRelationsControllerPath = new URL("../../apps/web/src/editor-semantic-relations-controller.js", import.meta.url);
const relationEventsPath = new URL("../../apps/web/src/editor-relation-events.js", import.meta.url);
const distillationControllerPath = new URL("../../apps/web/src/permanent-note-distillation-controller.js", import.meta.url);
const workspaceControllerPath = new URL("../../apps/web/src/permanent-note-workspace-controller.js", import.meta.url);
const workspaceViewPath = new URL("../../apps/web/src/permanent-note-workspace-view.js", import.meta.url);
const actionPanelPath = new URL("../../apps/web/src/permanent-note-action-panel.js", import.meta.url);
const permanentRelationWorkspacePath = new URL("../../apps/web/src/permanent-relation-workspace.js", import.meta.url);
const permanentRelationComposerControllerPath = new URL("../../apps/web/src/permanent-relation-composer-controller.js", import.meta.url);
const shellPath = new URL("../../apps/web/src/prototype.html", import.meta.url);

test("relation and viewpoint polish entry stay separated", async () => {
  const source = [
    await readFile(sourcePath, "utf8"),
    await readFile(semanticRelationsViewPath, "utf8"),
    await readFile(semanticRelationsControllerPath, "utf8"),
    await readFile(relationEventsPath, "utf8"),
    await readFile(actionPanelPath, "utf8"),
    await readFile(workspaceControllerPath, "utf8"),
    await readFile(workspaceViewPath, "utf8"),
    await readFile(permanentRelationWorkspacePath, "utf8")
  ].join("\n");
  const sidebarView = await readFile(sidebarViewPath, "utf8");
  const sidebarController = await readFile(sidebarControllerPath, "utf8");
  const shell = await readFile(shellPath, "utf8");
  const relationWorkspaceSource = await readFile(permanentRelationWorkspacePath, "utf8");
  const relationComposerController = await readFile(permanentRelationComposerControllerPath, "utf8");
  const workspaceControllerSource = await readFile(workspaceControllerPath, "utf8");

  assert.match(shell, /<div class="panel-title">打磨笔记<\/div>/);
  assert.match(shell, /aria-label="打磨笔记"/);
  assert.match(source, /renderPermanentRelationWorkspace/);
  assert.match(source, /renderPermanentNoteRelationAssistSectionView\(\{/);
  assert.match(source, /data-permanent-relation-workspace/);
  assert.match(source, /syncPermanentRelationManualResults\(\)/);
  assert.match(source, /permanentRelationComposer\(\)\.submit\(form\)/);
  assert.match(relationComposerController, /const latestRelations = await fetchNoteRelations\(sourceNote\.id\)/);
  assert.match(source, /permanentSidebarController\(\)\.continueRelationWorkspace\(\)/);
  assert.doesNotMatch(sidebarController, /permanentRelationWorkspaceNextAiCandidate\(/);
  assert.match(source, /data-permanent-relation-workspace/);

  assert.match(source, /data-deferred-workspace/);
  assert.match(source, /data-permanent-note-workspace data-note-id="\$\{escapeHtml\(note\.id\)\}"/);
  assert.match(workspaceControllerSource, /this\.host\.renderPermanentNoteDistillationSection\(note\)/);
  assert.match(source, /data-permanent-workspace-tab="\$\{escapeHtml\(key\)\}"/);
  assert.match(source, /data-permanent-workspace-pane="relations"/);
  assert.doesNotMatch(source, /data-permanent-workspace-pane="writing"/);
  assert.doesNotMatch(workspaceControllerSource, /renderPermanentNoteWritingPrepSection\(note\)/);
  assert.doesNotMatch(workspaceControllerSource, /renderPermanentNoteRelationAssistSection\(note, overview\)/);

  assert.match(source, /role="tablist" aria-label="打磨笔记"/);
  assert.doesNotMatch(source, /renderRelated\("当前笔记关联总览"\)/);
  assert.doesNotMatch(shell, /关联 \/ 写作/);
  assert.match(shell, /打磨笔记/);
});

test("permanent relation manual search keeps the search input mounted while updating results", async () => {
  const source = await readFile(sourcePath, "utf8");
  const workspaceSource = await readFile(new URL("../../apps/web/src/permanent-relation-workspace.js", import.meta.url), "utf8");
  const relationComposerController = await readFile(permanentRelationComposerControllerPath, "utf8");
  const refreshStart = source.indexOf("  async refreshPermanentRelationManualSearch(query = \"\") {");
  const refreshEnd = source.indexOf("  queuePermanentRelationManualSearch(input) {", refreshStart);
  assert.ok(refreshStart >= 0 && refreshEnd > refreshStart, "expected refreshPermanentRelationManualSearch() to exist");
  const refreshSource = source.slice(refreshStart, refreshEnd);

  assert.match(workspaceSource, /data-permanent-relation-manual-results/);
  assert.match(source, /renderPermanentRelationManualTargets/);
  assert.match(refreshSource, /permanentRelationComposer\(\)\.refreshManualSearch\(query\)/);
  assert.match(relationComposerController, /host\.syncPermanentRelationManualResults\(\)/);
  assert.match(relationComposerController, /selectedTargetNoteId:\s*cleanQuery \? "" : host\.permanentRelationWorkspaceState\.selectedTargetNoteId/);
  assert.doesNotMatch(relationComposerController, /syncPermanentRelationTargetPreview\(\)/);
  assert.doesNotMatch(refreshSource, /querySelector\?\.\("\[data-permanent-relation-target-search\]"\)\?\.focus/);
});

test("permanent-note async workflows guard UI refreshes by active note id", async () => {
  const source = await readFile(sourcePath, "utf8");
  const semanticRelationsController = await readFile(semanticRelationsControllerPath, "utf8");
  const distillationController = await readFile(distillationControllerPath, "utf8");
  const relationComposerController = await readFile(permanentRelationComposerControllerPath, "utf8");

  const distillationStart = distillationController.indexOf("  async handleForm(form) {");
  const distillationEnd = distillationController.indexOf("  async confirm()", distillationStart);
  assert.ok(distillationStart >= 0 && distillationEnd > distillationStart, "expected distillation handleForm() to exist");
  const distillationSource = distillationController.slice(distillationStart, distillationEnd);
  assert.match(distillationSource, /const noteId = String\(note\?\.id \|\| ""\)\.trim\(\)/);
  assert.match(distillationSource, /if \(!host\.isActiveNoteId\(noteId\)\) return/);

  const createStart = semanticRelationsController.indexOf("  async handleCreateForm(form) {");
  const createEnd = semanticRelationsController.indexOf("  async promoteInlineDraft", createStart);
  assert.ok(createStart >= 0 && createEnd > createStart, "expected handleCreateForm() to exist");
  const createSource = semanticRelationsController.slice(createStart, createEnd);
  assert.match(createSource, /if \(!host\.isActiveNoteId\(formNoteId\)\) return/);
  assert.match(createSource, /if \(submit && host\.isActiveNoteId\(formNoteId\)\) submit\.disabled = false/);

  const editStart = semanticRelationsController.indexOf("  async handleEditForm(form) {");
  const editEnd = semanticRelationsController.indexOf("  async deleteRelation", editStart);
  assert.ok(editStart >= 0 && editEnd > editStart, "expected handleEditForm() to exist");
  const editSource = semanticRelationsController.slice(editStart, editEnd);
  assert.match(editSource, /if \(!host\.isActiveNoteId\(formNoteId\)\) return/);
  assert.match(editSource, /if \(submit && host\.isActiveNoteId\(formNoteId\)\) submit\.disabled = false/);

  const promoteStart = semanticRelationsController.indexOf("  async promoteInlineDraft");
  const promoteEnd = semanticRelationsController.indexOf("  async handleEditForm", promoteStart);
  assert.ok(promoteStart >= 0 && promoteEnd > promoteStart, "expected promoteInlineDraft() to exist");
  const promoteSource = semanticRelationsController.slice(promoteStart, promoteEnd);
  assert.match(promoteSource, /host\.syncRelationNetworkConnected\(note\.id, target\.id\);\s*if \(!host\.isActiveNoteId\(noteId\)\) return;/);

  const deleteStart = semanticRelationsController.indexOf("  async deleteRelation(relationId) {");
  const deleteEnd = semanticRelationsController.indexOf("\n}", deleteStart);
  assert.ok(deleteStart >= 0 && deleteEnd > deleteStart, "expected deleteRelation() to exist");
  const deleteSource = semanticRelationsController.slice(deleteStart, deleteEnd);
  assert.match(deleteSource, /if \(!host\.isActiveNoteId\(activeNoteId\)\) return/);
  assert.match(deleteSource, /host\.closePermanentRelationWorkspace\?\.\(\)/);

  assert.match(relationComposerController, /const sourceIsActive = host\.isActiveNoteId\?\.\(sourceNote\.id\) === true/);
  assert.match(relationComposerController, /const sourceStillActive = \(\) => host\.isActiveNoteId\?\.\(sourceNote\.id\) === true/);
  assert.match(relationComposerController, /const submitSessionId = cleanText\(state\.relationComposerSessionId \|\| stateSessionId\(host\)\)/);
  assert.match(relationComposerController, /stateSessionId\(host\) === submitSessionId/);
  assert.match(relationComposerController, /const currentRelations = sourceIsActive \? host\.currentSemanticRelations : null/);
  assert.match(relationComposerController, /if \(sourceStillActive\(\)\) \{\s*host\.currentSemanticRelations = latestRelations;/);
  assert.match(relationComposerController, /if \(savedRelations && sourceStillActive\(\)\) \{/);
  assert.match(relationComposerController, /const linkInserted = await this\.insertLinkIfRequested\(state\);\s*if \(!draftStillCurrent\(\)\) return;/);
  assert.match(relationComposerController, /const requestSessionId = stateSessionId\(host\)/);
  assert.match(relationComposerController, /stateSessionId\(host\) === requestSessionId/);
});

test("relation workspace separates body links and external relations with user-facing actions", () => {
  const view = new EditorSemanticRelationsView({
    state: {
      notes: [
        { id: "current", title: "当前笔记", noteType: "permanent" },
        { id: "target", title: "目标笔记", noteType: "permanent" },
        { id: "source", title: "来源笔记", noteType: "permanent" },
        { id: "body-only", title: "正文里的笔记", noteType: "permanent" }
      ]
    },
    noteAiAnalysisByNoteId: new Map([
      ["current", { analysis: { relationCandidates: [{ targetNoteId: "target" }, { targetNoteId: "source" }] } }]
    ]),
    folderLabel() {
      return "永久笔记";
    }
  });

  const html = view.renderSemanticRelationsSection({
    outgoingLinks: [
      {
        id: "rel-out",
        fromNoteId: "current",
        toNoteId: "target",
        relationType: "supports",
        rationale: "目标笔记支持当前判断。"
      },
      {
        id: "wiki-same",
        fromNoteId: "current",
        toNoteId: "target",
        relationType: "associated_with",
        rationale: "markdown_wikilink"
      },
      {
        id: "wiki-only",
        fromNoteId: "current",
        toNoteId: "body-only",
        relationType: "associated_with",
        rationale: "markdown_wikilink"
      }
    ],
    backlinks: [
      {
        id: "rel-in",
        fromNoteId: "source",
        toNoteId: "current",
        relationType: "qualifies",
        rationale: "来源笔记限定当前判断。"
      }
    ]
  }, "current");

  assert.match(html, /data-relation-tab="external"/);
  assert.match(html, /data-relation-tab="body"/);
  assert.match(html, />AI推荐 2<\/button>/);
  assert.match(html, /semantic-relation-add-btn[^>]*data-permanent-relation-mode="manual"[^>]*>搜索笔记<\/button>/);
  assert.match(html, /外部关联/);
  assert.match(html, /正文链接/);
  assert.match(html, /取消外部关联/);
  assert.match(html, />打开<\/button>/);
  assert.doesNotMatch(html, /正文链接可以补充为关联|补充为关联/);
  assert.doesNotMatch(html, /正式关系|正式关联|升级为正式|删除/);
  assert.doesNotMatch(html, /正文链接<\/span>\s*<span class="related-item-badge">相关<\/span>/);
  assert.equal((html.match(/目标笔记/g) || []).length, 2);
});

test("relation button count matches relation workspace tab counts", () => {
  const notes = [
    { id: "current", title: "当前笔记", noteType: "permanent" },
    { id: "target", title: "目标笔记", noteType: "permanent" },
    { id: "source", title: "来源笔记", noteType: "permanent" },
    { id: "body-only", title: "正文里的笔记", noteType: "permanent" }
  ];
  const relations = {
    outgoingLinks: [
      {
        id: "rel-out",
        fromNoteId: "current",
        toNoteId: "target",
        relationType: "supports",
        rationale: "目标笔记支持当前判断。"
      },
      {
        id: "wiki-same",
        fromNoteId: "current",
        toNoteId: "target",
        relationType: "associated_with",
        rationale: "markdown_wikilink"
      },
      {
        id: "wiki-only",
        fromNoteId: "current",
        toNoteId: "body-only",
        relationType: "associated_with",
        rationale: "markdown_wikilink"
      }
    ],
    backlinks: [
      {
        id: "rel-in",
        fromNoteId: "source",
        toNoteId: "current",
        relationType: "qualifies",
        rationale: "来源笔记限定当前判断。"
      }
    ]
  };
  const view = new EditorSemanticRelationsView({
    state: { notes },
    folderLabel() {
      return "永久笔记";
    }
  });
  const html = view.renderSemanticRelationsSection(relations, "current");
  const summary = editorRelatedNotesSummary({
    relationState: "loaded",
    notes,
    relations
  });

  assert.equal(summary.externalRelationCount, 2);
  assert.equal(summary.bodyRelationCount, 2);
  assert.equal(summary.totalRelationCount, 4);
  assert.match(html, /外部关联[\s\S]*?<small>2<\/small>/);
  assert.match(html, /正文链接[\s\S]*?<small>2<\/small>/);
});
