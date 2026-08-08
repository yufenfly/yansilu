import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { buildSmartNotesDemoFixture } from "../../scripts/smart-notes-demo-data.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturePath = path.resolve(__dirname, "..", "fixtures", "demo-smart-notes-product-thinking", "demo.json");
const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf8"));

test("Smart Notes Demo fixture stays synchronized with its source generator", () => {
  assert.deepEqual(fixture, buildSmartNotesDemoFixture());
});

const OLD_VISIBLE_ID_PATTERN = /\b(?:PN-SN|WP-SN|IC-SN)-[A-Z0-9-]*\b/;
const FORBIDDEN_TOPIC_PATTERN = /易经|卦|君子是行动者模型/;
const REQUIRED_INDEX_TITLES = [
  "永久笔记是什么？",
  "为什么要关联笔记？",
  "如何从主题索引进入写作中心？"
];

function allNotes() {
  return [
    ...(fixture.sources || []),
    ...(fixture.fleeting_notes || []),
    ...(fixture.literature_notes || []),
    ...(fixture.permanent_notes || []),
    ...(fixture.index_cards || []),
    ...(fixture.writing_projects || []),
    ...(fixture.draft_scaffolds || []),
    ...(fixture.final_essays || []),
    ...(fixture.guide_notes || [])
  ];
}

function visibleText(value) {
  if (!value || typeof value !== "object") return "";
  return [
    value.title,
    value.body,
    value.summary,
    value.thesis,
    value.goal,
    value.intent,
    value.desired_reader_takeaway,
    value.use_boundary,
    value.reading_purpose,
    value.extraction_scope,
    value.conversion_policy,
    value.next_action,
    value.rationale
  ].filter(Boolean).join("\n");
}

function noteIds() {
  return new Set(allNotes().map((note) => note.id).filter(Boolean));
}

function noteTitles() {
  return new Set(allNotes().map((note) => note.title).filter(Boolean));
}

function wikilinkTargets(value) {
  const text = visibleText(value);
  const targets = [];
  const pattern = /\[\[([^\]]+)\]\]/g;
  let match;
  while ((match = pattern.exec(text))) {
    const target = String(match[1] || "").split("|")[0].split("#")[0].trim();
    if (target) targets.push(target);
  }
  return targets;
}

test("Smart Notes demo fixture has the required teaching surfaces", () => {
  assert.ok(fixture.sources.length >= 1);
  assert.ok(fixture.fleeting_notes.length >= 3);
  assert.ok(fixture.literature_notes.length >= 4);
  assert.ok(fixture.permanent_notes.length >= 12);
  assert.ok(fixture.index_cards.length >= REQUIRED_INDEX_TITLES.length);
  assert.ok(fixture.relations.length >= 12);
  assert.ok(fixture.writing_projects.length >= 1);
  assert.ok(fixture.draft_scaffolds.length >= 1);
  assert.ok(fixture.guide_notes.length >= 6);
});

test("Smart Notes demo fixture exposes accurate counts for import feedback", () => {
  assert.deepEqual(fixture.counts, {
    sources: fixture.sources.length,
    fleeting_notes: fixture.fleeting_notes.length,
    literature_notes: fixture.literature_notes.length,
    permanent_notes: fixture.permanent_notes.length,
    index_cards: fixture.index_cards.length,
    relations: fixture.relations.length,
    writing_projects: fixture.writing_projects.length,
    draft_scaffolds: fixture.draft_scaffolds.length,
    final_essays: fixture.final_essays.length,
    guide_notes: fixture.guide_notes.length
  });
});

test("user-visible demo copy does not expose legacy PN-SN WP-SN IC-SN ids", () => {
  for (const item of allNotes()) {
    assert.doesNotMatch(visibleText(item), OLD_VISIBLE_ID_PATTERN, `${item.id} exposes a legacy id`);
    assert.doesNotMatch(visibleText(item), FORBIDDEN_TOPIC_PATTERN, `${item.id} includes old unrelated demo material`);
  }
});

test("demo includes processed and pending fleeting and literature examples", () => {
  assert.ok(fixture.fleeting_notes.some((note) => note.status === "processed" && note.processed_into?.length), "needs processed fleeting note");
  assert.ok(fixture.fleeting_notes.some((note) => note.status === "needs_processing"), "needs pending fleeting note");
  assert.ok(fixture.literature_notes.some((note) => note.status === "converted"), "needs converted literature note");
  assert.ok(fixture.literature_notes.some((note) => note.status === "needs_processing"), "needs pending literature note");
});

test("key permanent notes contain clickable internal links by readable title or alias", () => {
  const required = [
    "PERM-WRITING-STARTS-BEFORE-DRAFT",
    "PERM-PERMANENT-NOTE-IS-JUDGMENT",
    "PERM-THEME-INDEX-IS-ENTRY",
    "PERM-WRITING-CENTER-FROM-CONFIRMED-NOTES"
  ];
  for (const id of required) {
    const note = fixture.permanent_notes.find((item) => item.id === id);
    assert.ok(note, `missing ${id}`);
    assert.match(note.body, /\[\[[^\]]+\]\]/, `${id} should include a clickable wikilink`);
    assert.doesNotMatch(note.body, /\[\[(?:PN-SN|WP-SN|IC-SN)-/, `${id} should not link with legacy visible ids`);
  }
});

test("all visible wikilinks point to existing demo notes", () => {
  const ids = noteIds();
  const titles = noteTitles();
  for (const note of allNotes()) {
    for (const target of wikilinkTargets(note)) {
      assert.ok(ids.has(target) || titles.has(target), `${note.id} links to missing note ${target}`);
    }
  }
});

test("relations point to existing notes and carry readable reasons", () => {
  const ids = noteIds();
  const types = new Set();
  for (const relation of fixture.relations) {
    assert.ok(ids.has(relation.from), `${relation.id} has missing from note ${relation.from}`);
    assert.ok(ids.has(relation.to), `${relation.id} has missing to note ${relation.to}`);
    assert.notEqual(relation.from, relation.to, `${relation.id} links a note to itself`);
    assert.ok(String(relation.rationale || "").length >= 12, `${relation.id} needs a readable rationale`);
    assert.ok(String(relation.insight_question || "").length >= 12, `${relation.id} needs an insight question`);
    types.add(relation.relationType);
  }
  for (const type of ["supports", "qualifies", "contradicts", "precedes", "bridges", "associated_with"]) {
    assert.ok(types.has(type), `missing relation type ${type}`);
  }
});

test("demo teaches the relation choices needed for the first knowledge chain", () => {
  const requiredPermanentNotes = [
    "PERM-SUPPORT-RELATION-BECOMES-EVIDENCE",
    "PERM-CONTRAST-RELATION-CREATES-ARGUMENT",
    "PERM-BOUNDARY-MAKES-NOTE-RELIABLE",
    "PERM-RELATION-REASON-MATTERS"
  ];
  const permanentIds = new Set(fixture.permanent_notes.map((note) => note.id));
  for (const id of requiredPermanentNotes) assert.ok(permanentIds.has(id), `missing relation teaching note ${id}`);

  assert.ok(fixture.relations.some((relation) => relation.relationType === "supports"));
  assert.ok(fixture.relations.some((relation) => relation.relationType === "contradicts"));
  assert.ok(fixture.relations.some((relation) => relation.relationType === "qualifies"));
});

test("demo groups the real knowledge chain into readable graph clusters", () => {
  const clusters = new Set(fixture.permanent_notes.map((note) => note.cluster_label));
  assert.deepEqual(clusters, new Set(["材料到判断", "关系与复利", "主题到写作"]));
  assert.ok(fixture.relations.some((relation) => (
    relation.from === "PERM-COMPOUND-INTEREST-FROM-REUSE" && relation.to === "PERM-THEME-INDEX-IS-ENTRY"
  )));
  assert.ok(fixture.relations.some((relation) => (
    relation.from === "PERM-THEME-INDEX-IS-ENTRY" && relation.to === "PERM-WRITING-CENTER-FROM-CONFIRMED-NOTES"
  )));
});

test("theme indexes include the required beginner questions and valid note links", () => {
  const permanentIds = new Set(fixture.permanent_notes.map((note) => note.id));
  const titles = new Set(fixture.index_cards.map((card) => card.title));
  for (const title of REQUIRED_INDEX_TITLES) assert.ok(titles.has(title), `missing theme index ${title}`);

  for (const card of fixture.index_cards) {
    assert.equal(card.index_type, "topic");
    assert.ok(card.central_question, `${card.id} needs a central question`);
    assert.ok(card.noteIds.length > 0, `${card.id} needs noteIds`);
    for (const noteId of card.noteIds) assert.ok(permanentIds.has(noteId), `${card.id} references missing note ${noteId}`);
    assert.match(card.body, /\[\[[^\]]+\]\]/, `${card.id} should expose clickable note links`);
  }
});

test("writing project starts from theme indexes and key permanent notes", () => {
  const project = fixture.writing_projects[0];
  const scaffold = fixture.draft_scaffolds[0];
  const permanentIds = new Set(fixture.permanent_notes.map((note) => note.id));
  const indexIds = new Set(fixture.index_cards.map((card) => card.id));

  assert.equal(project.id, "WRITE-SMART-NOTES-DEMO");
  assert.match(project.title, /已有笔记变成清晰观点和写作结构/);
  assert.match(project.desired_reader_takeaway, /可追溯提纲/);
  assert.ok(project.basketNoteIds.length >= 5);
  assert.ok(project.indexCardIds.length >= 3);
  for (const id of project.basketNoteIds) assert.ok(permanentIds.has(id), `${id} should be a permanent note`);
  for (const id of project.indexCardIds) assert.ok(indexIds.has(id), `${id} should be an index card`);
  assert.equal(scaffold.writing_project_id, project.id);
  assert.ok(scaffold.sections.length >= 3);
});

test("guide note is beginner friendly and opens the complete workflow", () => {
  const guide = fixture.guide_notes.find((note) => note.id === "GUIDE-SMART-NOTES-START");
  assert.ok(guide, "missing starting guide");
  assert.match(guide.body, /记录材料 -> 用自己的话转述 -> 形成一条判断 -> 写清关系理由 -> 组织主题 -> 查看提纲/);
  assert.match(guide.body, /\[\[手机上先记一句/);
  assert.match(guide.body, /\[\[用自己的话重说，才能检查理解\]\]/);
  assert.match(guide.body, /\[\[关系理由练习：给已有笔记补一条说明\]\]/);
  assert.match(guide.body, /\[\[为什么要关联笔记？\]\]/);
  assert.doesNotMatch(guide.body, OLD_VISIBLE_ID_PATTERN);
});
