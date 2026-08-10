import test from "node:test";
import assert from "node:assert/strict";

import {
  buildSmartNotesDemoWalkthrough,
  completeSmartNotesDemoStep,
  isSmartNotesDemoScope,
  renderSmartNotesDemoWalkthrough,
  smartNotesDemoActionLabel,
  renderWritingBeginnerMainlineView,
  writingBeginnerMainline
} from "../../apps/web/src/beginner-onboarding-flow.js";

test("beginner flow detects Smart Notes demo and renders one focused next step", () => {
  const notes = [
    { id: "GUIDE-SMART-NOTES-START" },
    { id: "PERM-WRITING-STARTS-BEFORE-DRAFT" },
    { id: "PERM-UNLINKED-PRACTICE" },
    { id: "THEME-WHY-LINK-NOTES" },
    { id: "WRITE-SMART-NOTES-DEMO" }
  ];
  const flow = buildSmartNotesDemoWalkthrough({ notes, completedSteps: ["first-judgment"] });
  const html = renderSmartNotesDemoWalkthrough(flow);

  assert.equal(isSmartNotesDemoScope(notes), true);
  assert.equal(flow.steps.length, 3);
  assert.equal(flow.activeStepKey, "first-relation");
  assert.equal(flow.steps[0].done, true);
  assert.equal(flow.steps[1].active, true);
  assert.match(html, /data-smart-notes-demo-walkthrough/);
  assert.match(html, /从记录到写作/);
  assert.match(html, /sidebar-flow-current/);
  assert.match(html, /第 2 \/ 3 步/);
  assert.match(html, /把关系变成以后看得懂的线索/);
  assert.match(html, /打开并关联/);
  assert.doesNotMatch(html, /打开“为什么要关联笔记？”/);
  assert.match(html, /data-sidebar-flow-action="open-demo-note-relations"/);
  assert.doesNotMatch(html, /打开写作中心/);
  assert.doesNotMatch(html, /\b(?:PN-SN|WP-SN|IC-SN)-/);
});

test("beginner demo walkthrough keeps note title separate from the action button", () => {
  const notes = [
    { id: "GUIDE-SMART-NOTES-START" },
    { id: "PERM-WRITING-STARTS-BEFORE-DRAFT" }
  ];
  const flow = buildSmartNotesDemoWalkthrough({ notes });
  const html = renderSmartNotesDemoWalkthrough(flow);

  assert.equal(smartNotesDemoActionLabel(flow.steps[0], 0), "打开第 1 步笔记");
  assert.match(html, /看看当前观点怎样形成/);
  assert.match(html, /打开第 1 步笔记/);
  assert.doesNotMatch(html, /打开“写作不是最后一步”/);
  assert.match(html, /data-sidebar-flow-note-id="PERM-PERMANENT-NOTE-IS-JUDGMENT"/);
});

test("beginner demo walkthrough advances only after explicit completed actions", () => {
  const notes = [
    { id: "GUIDE-SMART-NOTES-START" },
    { id: "PERM-WRITING-STARTS-BEFORE-DRAFT" },
    { id: "PERM-UNLINKED-PRACTICE" },
    { id: "WRITE-SMART-NOTES-DEMO" }
  ];
  const initial = buildSmartNotesDemoWalkthrough({ notes });
  const afterJudgment = completeSmartNotesDemoStep([], "first-judgment");
  const relation = buildSmartNotesDemoWalkthrough({ notes, completedSteps: afterJudgment });
  const complete = buildSmartNotesDemoWalkthrough({
    notes,
    completedSteps: completeSmartNotesDemoStep(completeSmartNotesDemoStep(afterJudgment, "first-relation"), "write-from-notes")
  });

  assert.equal(initial.activeStepKey, "first-judgment");
  assert.equal(relation.activeStepKey, "first-relation");
  assert.equal(complete.finished, true);
  assert.match(renderSmartNotesDemoWalkthrough(complete), /已完成/);
  assert.match(renderSmartNotesDemoWalkthrough(complete), /回到首页/);
});

test("beginner flow does not treat arbitrary SN-looking notes as the Smart Notes demo", () => {
  assert.equal(isSmartNotesDemoScope([
    { id: "MEETING-SN-001" },
    { id: "PERSONAL-SN-002" }
  ]), false);
});

test("writing beginner mainline exposes one stage and one action", () => {
  const material = writingBeginnerMainline({ basketCount: 0 });
  const theme = writingBeginnerMainline({
    basketCount: 3,
    hasProject: false,
    projectEntry: { actionLabel: "确定可写主题" }
  });
  const draft = writingBeginnerMainline({
    basketCount: 3,
    hasProject: true,
    hasScaffold: true
  });

  assert.equal(material.label, "选相关笔记");
  assert.equal(theme.label, "确定可写主题");
  assert.equal(draft.label, "保存草稿");
  assert.match(renderWritingBeginnerMainlineView(theme), /data-writing-beginner-mainline/);
  assert.match(renderWritingBeginnerMainlineView(theme), /确定可写主题/);
});
