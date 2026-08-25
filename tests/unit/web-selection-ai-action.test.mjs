import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  editorSelectionAiActionElements
} from "../../apps/web/src/app-shell-editor-elements.js";

const currentFile = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(currentFile), "../..");

function readRepoFile(...segments) {
  return fs.readFileSync(path.join(repoRoot, ...segments), "utf8");
}

test("editor renders a lightweight selection AI action near the writing surface", () => {
  const html = readRepoFile("apps/web/src/prototype.html");
  const css = readRepoFile("apps/web/src/prototype.css");

  assert.match(html, /id="selectionAiAction"/);
  assert.match(html, /id="selectionAiActionText"/);
  assert.match(html, /id="btnSelectionAiDistill"[\s\S]*data-selection-ai-action="distill-claim"[\s\S]*>帮我提炼<\/button>/);
  assert.match(css, /\.selection-ai-action\s*\{[\s\S]*?position: fixed;/);
  assert.match(css, /\.selection-ai-action-button\s*\{[\s\S]*?background: #ecfeff;/);
});

test("app shell passes selection AI action elements into the editor pane", () => {
  const calls = [];
  const elements = editorSelectionAiActionElements((id) => {
    calls.push(id);
    return { id };
  });

  assert.deepEqual(calls, ["selectionAiAction", "selectionAiActionText", "btnSelectionAiDistill"]);
  assert.deepEqual(elements, {
    selectionAiAction: { id: "selectionAiAction" },
    selectionAiActionText: { id: "selectionAiActionText" },
    selectionAiDistill: { id: "btnSelectionAiDistill" }
  });
});

test("selection AI action only appears for selected permanent-note text", () => {
  const source = readRepoFile("apps/web/src/components-editor-pane.js");
  const start = source.indexOf("  selectionAiActionCandidate() {");
  const end = source.indexOf("  hideSelectionAiAction() {", start);

  assert.ok(start >= 0 && end > start, "expected selectionAiActionCandidate() to exist");
  const candidateSource = source.slice(start, end);

  assert.match(candidateSource, /this\.activeNote\(\)/);
  assert.match(candidateSource, /noteType !== "permanent" && noteType !== "original"/);
  assert.match(candidateSource, /range\.to <= range\.from/);
  assert.match(candidateSource, /selectedText\.replace\(\/\\s\+\/g, ""\)\.length < 6/);
});

test("selection AI action applies the selected text as an editable distillation draft", () => {
  const source = readRepoFile("apps/web/src/components-editor-pane.js");
  const start = source.indexOf("  applySelectionDistillationDraft() {");
  const end = source.indexOf("  refreshDistillationQuality(form) {", start);

  assert.ok(start >= 0 && end > start, "expected applySelectionDistillationDraft() to exist");
  const actionSource = source.slice(start, end);

  assert.match(actionSource, /selectionDistillationDraft\(selectedText\)/);
  assert.match(actionSource, /this\.setInspectorVisible\(true\)/);
  assert.match(actionSource, /this\.renderRelated\("提炼这段文字"\)/);
  assert.match(actionSource, /textarea\[name="thesis"\]/);
  assert.match(actionSource, /textarea\[name="summary\$\{idx\}"\]/);
  assert.match(actionSource, /details\.viewpoint-optional-details/);
  assert.match(actionSource, /optionalDetails\.open = true/);
  assert.match(actionSource, /target\.dispatchEvent\(new Event\("input", \{ bubbles: true \}\)\)/);
  assert.match(actionSource, /this\.jumpToInspectorSection\("\[data-note-distillation-section\]"/);
  assert.doesNotMatch(actionSource, /save-note-distillation|onStateChange\("save-note/);
});

test("selection AI action preserves the selection while clicking and hides during typing", () => {
  const source = readRepoFile("apps/web/src/components-editor-pane.js");

  assert.match(
    source,
    /selectionAiAction\?\.addEventListener\("mousedown", \(event\) => \{\s*event\.preventDefault\(\);/
  );
  assert.match(
    source,
    /selectionAiDistill\?\.addEventListener\("click", \(event\) => \{[\s\S]*?this\.applySelectionDistillationDraft\(\);/
  );
  assert.match(source, /handleEditorInput\(\) \{[\s\S]*?this\.hideSelectionAiAction\(\);/);
  assert.match(source, /updateToolbarFormattingState\(\) \{[\s\S]*?this\.updateSelectionAiAction\(\);/);
});
