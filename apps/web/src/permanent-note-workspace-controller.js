import {
  renderPermanentNoteWorkspace
} from "./permanent-note-workspace-view.js";
import { permanentNoteViewpointState } from "./permanent-note-sidebar-architecture.js";
import { renderPermanentNoteFormation } from "./permanent-note-formation-view.js";

export class PermanentNoteWorkspaceController {
  constructor(host) {
    this.host = host;
    this.activeNoteId = "";
    this.activeTab = "";
  }

  reset(noteId = "") {
    this.activeNoteId = String(noteId || "").trim();
    this.activeTab = "";
  }

  currentTab() {
    return this.activeTab || "viewpoint";
  }

  workspaceElement() {
    return this.host?.els?.result?.querySelector?.("[data-permanent-note-workspace]") || null;
  }

  workspaceMatchesNote(noteId = "") {
    const workspace = this.workspaceElement();
    const cleanNoteId = String(noteId || "").trim();
    return Boolean(workspace && cleanNoteId && String(workspace.getAttribute?.("data-note-id") || "").trim() === cleanNoteId);
  }

  renderDeferredWorkspace(note, tab) {
    if (!note?.id || !tab) return "";
    this.activeNoteId = String(note.id || "").trim();
    if (!this.activeTab) {
      const viewpoint = permanentNoteViewpointState(note);
      const relationCount = Number(this.host.currentExplicitRelationCount?.() || 0);
      this.activeTab = !viewpoint.needsViewpoint && relationCount === 0 ? "relations" : "viewpoint";
    }
    return renderPermanentNoteWorkspace({
      note,
      activeTab: this.currentTab(),
      viewpointHtml: `
        ${this.host.renderPermanentNoteDistillationSection(note)}
      `,
      relationsHtml: `
        ${renderPermanentNoteFormation(note, this.host.currentSemanticRelations, { notes: this.host.state?.notes || [] })}
        ${this.host.renderPermanentNoteRelationAssistSection(note)}
        ${this.host.renderCurrentRelationSection(note.id, {
          relations: this.host.currentSemanticRelations,
          relationState: this.host.semanticRelationsState
        })}
      `
    });
  }

  refreshSnapshot(note, tab = this.host.activeTab?.(), overview = null) {
    if (!note?.id || !tab || !this.workspaceMatchesNote(note.id)) return false;
    const workspace = this.workspaceElement();
    if (workspace) workspace.outerHTML = this.renderDeferredWorkspace(note, tab);
    return true;
  }

  activateTab(tab = "viewpoint") {
    const nextTab = tab === "relations" ? "relations" : "viewpoint";
    this.activeTab = nextTab;
    const note = this.host.activeNote?.();
    const activeEditorTab = this.host.activeTab?.();
    if (note?.id && activeEditorTab && this.workspaceMatchesNote(note.id)) {
      const workspace = this.workspaceElement();
      if (workspace) workspace.outerHTML = this.renderDeferredWorkspace(note, activeEditorTab);
    }
    return this.workspaceMatchesNote(this.activeNoteId);
  }
}
