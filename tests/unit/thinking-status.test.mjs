import test from "node:test";
import assert from "node:assert/strict";
import {
  deriveIndexCardThinkingStatus,
  deriveNoteThinkingStatus,
  deriveWritingProjectThinkingStatus
} from "../../packages/domain/src/thinking-status.mjs";

test("deriveNoteThinkingStatus maps permanent note distillation progress", () => {
  assert.deepEqual(
    deriveNoteThinkingStatus({ noteType: "permanent", title: "Draft" }),
    {
      status: "needs_thesis",
      label: "待写论点",
      nextAction: "写一句话看法",
      targetField: "thesis",
      severity: "next"
    }
  );

  assert.equal(
    deriveNoteThinkingStatus({
      noteType: "permanent",
      thesis: "Writing starts from compressed claims."
    }).status,
    "needs_confirmation"
  );

  assert.equal(
    deriveNoteThinkingStatus({
      noteType: "permanent",
      thesis: "Writing starts from compressed claims.",
      distillationStatus: "confirmed"
    }).status,
    "needs_relation"
  );

  assert.equal(
    deriveNoteThinkingStatus({
      noteType: "permanent",
      thesis: "Writing starts from compressed claims.",
      distillationStatus: "confirmed",
      explicitRelationCount: 1
    }).status,
    "ready_for_index"
  );
});

test("deriveNoteThinkingStatus detects literature paraphrase state", () => {
  assert.equal(
    deriveNoteThinkingStatus({
      noteType: "literature",
      body: "# Source\n\n## 原文\n\nOnly source text.\n"
    }).status,
    "needs_paraphrase"
  );

  assert.equal(
    deriveNoteThinkingStatus({
      noteType: "literature",
      body: "# Source\n\n## 转述\n\n我用自己的话说清楚了这一段。\n"
    }).status,
    "paraphrased"
  );
});

test("deriveIndexCardThinkingStatus maps theme readiness", () => {
  assert.equal(deriveIndexCardThinkingStatus({ items: [{}, {}] }).status, "needs_central_question");
  assert.equal(
    deriveIndexCardThinkingStatus({
      items: [{}, {}],
      central_question: "How can notes become writing?"
    }).status,
    "needs_theme_thesis"
  );
  assert.equal(
    deriveIndexCardThinkingStatus({
      items: [{}, {}],
      central_question: "How can notes become writing?",
      thesis: "Notes become writing when claims are compressed first.",
      three_line_summary: ["Claim", "Reason", "Use"]
    }).status,
    "ready_for_writing"
  );
});

test("deriveWritingProjectThinkingStatus maps writing prep progress", () => {
  assert.equal(deriveWritingProjectThinkingStatus({}).status, "needs_basket");
  assert.equal(
    deriveWritingProjectThinkingStatus({
      basket_note_ids: ["pn_1"]
    }).status,
    "needs_intent"
  );
  assert.equal(
    deriveWritingProjectThinkingStatus({
      basket_note_ids: ["pn_1"],
      intent: "Explain why distilled notes help drafting."
    }).status,
    "needs_scaffold"
  );
  assert.equal(
    deriveWritingProjectThinkingStatus({
      basket_note_ids: ["pn_1"],
      intent: "Explain why distilled notes help drafting.",
      scaffold_id: "ds_1"
    }).status,
    "ready_for_review"
  );
});
