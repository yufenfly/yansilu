import { escapeHtml } from "./editor-render-utils.js";

export function renderPermanentNoteWorkspace({
  note = {},
  activeTab = "viewpoint",
  viewpointHtml = "",
  relationsHtml = ""
} = {}) {
  if (!note?.id || (!viewpointHtml && !relationsHtml)) return "";
  const currentTab = activeTab === "relations" ? "relations" : "viewpoint";
  const tab = (key, label) => `
    <button
      class="permanent-note-workspace-tab ${currentTab === key ? "is-active" : ""}"
      type="button"
      data-permanent-workspace-tab="${escapeHtml(key)}"
      aria-selected="${currentTab === key ? "true" : "false"}"
    >${escapeHtml(label)}</button>
  `;
  return `
    <section class="inspector-deferred-workspace permanent-note-workspace" data-deferred-workspace data-permanent-note-workspace data-note-id="${escapeHtml(note.id)}">
      <div class="permanent-note-workspace-tabs" role="tablist" aria-label="打磨笔记">
        ${tab("viewpoint", "当前观点")}
        ${tab("relations", "怎么形成的")}
      </div>
      <div class="inspector-deferred-body">
        <div data-permanent-workspace-pane="viewpoint" ${currentTab === "viewpoint" ? "" : "hidden"}>
          ${viewpointHtml}
        </div>
        <div data-permanent-workspace-pane="relations" ${currentTab === "relations" ? "" : "hidden"}>
          ${relationsHtml}
        </div>
      </div>
    </section>
  `;
}
