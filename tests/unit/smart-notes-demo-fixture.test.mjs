import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const fixturePath = path.resolve("tests", "fixtures", "demo-smart-notes-product-thinking", "demo.json");

async function readFixture() {
  return JSON.parse(await fs.readFile(fixturePath, "utf8"));
}

function wikilinkTargets(body = "") {
  const targets = [];
  for (const match of String(body || "").matchAll(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g)) {
    const target = String(match[1] || "").trim();
    if (target) targets.push(target);
  }
  return targets;
}

function relationPairKey(from = "", to = "") {
  return [String(from || "").trim(), String(to || "").trim()].sort().join("::");
}

test("Smart Notes Demo fixture teaches one complete beginner knowledge chain", async () => {
  const fixture = await readFixture();
  const allText = JSON.stringify(fixture);

  assert.doesNotMatch(allText, /PN-SN|WP-SN|IC-SN/);
  assert.doesNotMatch(allText, /今日整理/);
  assert.match(allText, /记录材料 -> 用自己的话转述 -> 形成一条判断/);

  for (const id of [
    "PERM-FLEETING-NOTE-IS-CAPTURE",
    "PERM-PARAPHRASE-BEFORE-JUDGMENT",
    "PERM-PERMANENT-NOTE-IS-JUDGMENT",
    "PERM-RELATION-REASON-MATTERS",
    "PERM-THEME-INDEX-IS-ENTRY",
    "PERM-WRITING-CENTER-FROM-CONFIRMED-NOTES"
  ]) assert.ok(fixture.permanent_notes.some((note) => note.id === id), `missing ${id}`);
  assert.ok(fixture.index_cards.some((card) => card.id === "THEME-WHY-LINK-NOTES"));
  assert.ok(fixture.guide_notes.some((note) => note.id === "GUIDE-SMART-NOTES-START"));
  assert.ok(fixture.fleeting_notes.some((note) => note.status === "needs_processing"));
  assert.ok(fixture.literature_notes.some((note) => note.status === "needs_processing"));
  assert.ok(fixture.relations.some((relation) => relation.from === "PERM-PERMANENT-NOTE-IS-JUDGMENT"));
  assert.ok(fixture.relations.some((relation) => relation.from === "PERM-THEME-INDEX-IS-ENTRY"));
  assert.ok(fixture.writing_projects.length > 0);
  assert.ok(fixture.draft_scaffolds.length > 0);
  const demoProject = fixture.writing_projects.find((project) => project.id === "WRITE-SMART-NOTES-DEMO");
  const demoScaffold = fixture.draft_scaffolds.find((scaffold) => scaffold.id === "DRAFT-SMART-NOTES-DEMO");
  assert.equal(demoScaffold?.writing_project_id, demoProject?.id);
});

test("Smart Notes Demo turns permanent-note wikilinks into lightweight body relations", async () => {
  const fixture = await readFixture();
  const permanentByTitle = new Map(fixture.permanent_notes.map((note) => [note.title, note]));
  const relationPairs = new Set(fixture.relations.map((relation) => relationPairKey(relation.from, relation.to)));
  const bodyRelations = fixture.relations.filter((relation) => relation.relationSource === "body_wikilink");
  const manualRelations = fixture.relations.filter((relation) => relation.relationSource === "manual");
  const missing = [];

  for (const note of fixture.permanent_notes || []) {
    for (const target of wikilinkTargets(note.body)) {
      const targetNote = permanentByTitle.get(target);
      if (!targetNote || targetNote.id === note.id) continue;
      const pairKey = relationPairKey(note.id, targetNote.id);
      if (!relationPairs.has(pairKey)) missing.push(`${note.id} -> ${targetNote.id}`);
    }
  }

  assert.deepEqual(missing, []);
  assert.ok(bodyRelations.length > 0);
  assert.ok(bodyRelations.every((relation) => relation.relationType === "associated_with"));
  assert.ok(bodyRelations.every((relation) => relation.rationale === "markdown_wikilink"));
  assert.ok(manualRelations.length >= 8);
  assert.ok(manualRelations.every((relation) => relation.rationale && relation.rationale !== "markdown_wikilink"));
});

test("Smart Notes Demo keeps a named permanent note for relation practice", async () => {
  const fixture = await readFixture();
  const practiceNote = fixture.permanent_notes.find((note) => note.id === "PERM-UNLINKED-PRACTICE");

  assert.match(practiceNote?.title || "", /关系理由练习/);
  assert.match(practiceNote?.body || "", /正文链接和人工关系/);
  assert.match(practiceNote?.body || "", /选择关系类型并写清为什么相关/);
});

test("Smart Notes Demo keeps optional product explanations out of the first practice path", async () => {
  const fixture = await readFixture();
  const allText = JSON.stringify(fixture);

  assert.doesNotMatch(allText, /候选队列|复核队列|模型配置/);
  assert.ok(fixture.writing_projects.every((project) => project.basketNoteIds.length > 0));
  assert.equal(fixture.writing_projects.length, 1);
});
