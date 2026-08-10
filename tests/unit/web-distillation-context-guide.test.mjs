import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { EditorPane } from "../../apps/web/src/components-editor-pane.js";
import { distillationNextStepGuide } from "../../apps/web/src/editor-template-workspace.js";

const currentFile = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(currentFile), "../..");

function createPane() {
  return Object.assign(Object.create(EditorPane.prototype), {
    resolvedNoteType: () => "permanent",
    currentDistillationPrefill: () => ({
      draftVariants: [],
      selectedTemplateVariant: "",
      rememberedTemplateVariantLabel: "",
      boundaryDraft: ""
    }),
    renderRelationNetworkPrompt: () => "",
    noteAiSuggestionsSummaryLabel: () => "0",
    noteAiSuggestionsStateForNote: () => ({ items: [], loading: false, error: "" })
  });
}

test("permanent-note distillation renders only the compact editing form", () => {
  const pane = createPane();
  const html = pane.renderPermanentNoteDistillationSection({
    id: "pn_missing_thesis",
    title: "Needs viewpoint",
    body: "# Needs viewpoint",
    status: "active",
    distillationStatus: "missing"
  });

  assert.match(html, /name="thesis"/);
  assert.match(html, /你现在认为是什么？/);
  assert.match(html, /name="startingQuestion"/);
  assert.match(html, /data-viewpoint-change-reason hidden/);
  assert.match(html, /name="summary1"/);
  assert.match(html, /name="summary2"/);
  assert.match(html, /name="summary3"/);
  assert.match(html, /name="boundaryOrCounterpoint"/);
  assert.match(html, /name="distillationStatus" value="confirmed"/);
  assert.doesNotMatch(html, /data-note-distillation-close/);
  assert.match(html, />保存当前观点</);
  assert.match(html, /补充说明和边界（可选）/);
  assert.doesNotMatch(html, /data-note-distillation-confirm/);
  assert.doesNotMatch(html, /data-note-distillation-next/);
  assert.doesNotMatch(html, /data-note-distillation-focus=/);
  assert.doesNotMatch(html, /inspector-section-head-compact/);
  assert.doesNotMatch(html, /data-note-distillation-readiness/);
  assert.doesNotMatch(html, /data-permanent-note-readiness-card/);
  assert.doesNotMatch(html, /data-note-embedded-ai-workspace/);
  assert.doesNotMatch(html, /data-note-distillation-quality/);
  assert.doesNotMatch(html, /distillation-path-strip/);
  assert.doesNotMatch(html, /证据 \/ 来源/);
  assert.doesNotMatch(html, /写作可用性/);
  assert.doesNotMatch(html, />missing</);
});

test("distillation form stays compact across distillation states", () => {
  const pane = createPane();
  const summaryHtml = pane.renderPermanentNoteDistillationSection({
    id: "pn_needs_summary",
    title: "Needs summary",
    body: "# Needs summary",
    status: "active",
    thesis: "稳定观点需要知道自己的反例。",
    threeLineSummary: ["观点要能被复用。"],
    distillationStatus: "draft"
  });
  const boundaryHtml = pane.renderPermanentNoteDistillationSection({
    id: "pn_needs_boundary",
    title: "Needs boundary",
    body: "# Needs boundary",
    status: "active",
    thesis: "稳定观点需要知道自己的反例。",
    threeLineSummary: ["观点要能被复用。", "边界能防止误用。", "写作时可以提前处理反方。"],
    distillationStatus: "draft"
  });
  const confirmHtml = pane.renderPermanentNoteDistillationSection({
    id: "pn_needs_confirm",
    title: "Needs confirm",
    body: "# Needs confirm",
    status: "active",
    thesis: "稳定观点需要知道自己的反例。",
    threeLineSummary: ["观点要能被复用。", "边界能防止误用。", "写作时可以提前处理反方。"],
    boundaryOrCounterpoint: "如果只是临时观察，就不能直接当作稳定判断。",
    distillationStatus: "draft"
  });
  const relationsHtml = pane.renderPermanentNoteDistillationSection({
    id: "pn_confirmed",
    title: "Confirmed",
    body: "# Confirmed",
    status: "active",
    thesis: "稳定观点需要知道自己的反例。",
    threeLineSummary: ["观点要能被复用。", "边界能防止误用。", "写作时可以提前处理反方。"],
    boundaryOrCounterpoint: "如果只是临时观察，就不能直接当作稳定判断。",
    distillationStatus: "confirmed"
  });

  assert.doesNotMatch(summaryHtml, /data-note-distillation-next/);
  assert.doesNotMatch(boundaryHtml, /data-note-distillation-next/);
  assert.doesNotMatch(confirmHtml, /data-note-distillation-next/);
  assert.doesNotMatch(relationsHtml, /data-note-distillation-next/);
  assert.doesNotMatch(relationsHtml, /data-note-distillation-focus=/);
  assert.doesNotMatch(relationsHtml, /data-note-distillation-readiness/);
  assert.doesNotMatch(relationsHtml, /data-permanent-note-readiness-card/);
});

test("distillation next action points connected confirmed notes toward themes", () => {
  const guide = distillationNextStepGuide({
    thesis: "稳定观点需要进入关系网络。",
    threeLineSummary: ["观点要能被复用。", "关系会显示它服务的问题。", "主题从关系里长出来。"],
    boundaryOrCounterpoint: "如果没有共同问题，就先不要写成文章。",
    distillationStatus: "confirmed",
    explicitRelationCount: 2
  });

  assert.equal(guide.key, "relations");
  assert.match(guide.title, /已有关系/);
  assert.match(guide.body, /共同指向哪个问题/);
  assert.match(guide.body, /主题或写作中心/);
  assert.equal(guide.actionLabel, "看关系和主题线索");
});

test("distillation focus action opens the relation workspace instead of jumping inside the side panel", () => {
  const source = fs.readFileSync(path.join(repoRoot, "apps/web/src/components-editor-pane.js"), "utf8");
  const start = source.indexOf('const distillationFocusButton = e.target.closest("[data-note-distillation-focus]")');
  const end = source.indexOf('const distillationConfirmButton = e.target.closest("[data-note-distillation-confirm]")', start);

  assert.ok(start >= 0 && end > start, "expected distillation focus handler");
  const handler = source.slice(start, end);

  assert.match(handler, /target === "confirm"/);
  assert.match(handler, /void this\.confirmDistillation\(\)/);
  assert.match(handler, /target === "relations"/);
  assert.match(handler, /this\.activatePermanentWorkspaceTab\("relations"\)/);
  assert.doesNotMatch(handler, /target === "writing"/);
  assert.doesNotMatch(handler, /jumpToInspectorSection\("\[data-note-relations-section\]"\)/);
  assert.match(handler, /textarea\[name="boundaryOrCounterpoint"\]/);
  assert.match(handler, /textarea\[name="\$\{target\}"\]/);
  assert.match(handler, /textarea\[name="thesis"\]/);
});

test("distillation form does not add a second close action", () => {
  const source = fs.readFileSync(path.join(repoRoot, "apps/web/src/components-editor-pane.js"), "utf8");
  assert.doesNotMatch(source, /data-note-distillation-close/);
});
