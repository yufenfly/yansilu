import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { getDirectoryGraph, getNoteById } from "../../packages/domain/src/index.mjs";
import { seedSmartNotesProductThinking } from "../../scripts/seed-smart-notes-product-thinking.mjs";

test("Smart Notes Demo seed preserves the traceable viewpoint example", async (t) => {
  const vaultPath = await fs.mkdtemp(path.join(os.tmpdir(), "yansilu-smart-notes-demo-"));
  t.after(() => fs.rm(vaultPath, { recursive: true, force: true }));

  const seeded = await seedSmartNotesProductThinking(vaultPath);
  const note = await getNoteById(vaultPath, "PERM-PERMANENT-NOTE-IS-JUDGMENT");
  const graph = await getDirectoryGraph(vaultPath, seeded.directoryId);

  assert.match(note.startingQuestion, /材料变成/);
  assert.equal(note.viewpointHistory.length, 1);
  assert.equal(note.viewpointHistory.at(-1)?.thesis, note.thesis);
  assert.deepEqual(note.viewpointHistory[0]?.sourceNoteIds, [
    "PERM-PARAPHRASE-BEFORE-JUDGMENT",
    "PERM-FLEETING-NOTE-IS-CAPTURE"
  ]);
  const formationRelations = graph.edges.filter((relation) => (
    note.viewpointHistory[0].sourceNoteIds.includes(relation.fromNoteId)
  ));
  assert.ok(
    formationRelations.some((relation) => (
      relation.fromNoteId === "PERM-PARAPHRASE-BEFORE-JUDGMENT"
      && relation.toNoteId === note.id
      && relation.relationType === "supports"
    )),
    "the paraphrase should directly support the current viewpoint"
  );
  assert.equal(
    formationRelations.find((relation) => relation.fromNoteId === "PERM-FLEETING-NOTE-IS-CAPTURE")?.relationType,
    "precedes"
  );
  assert.equal(
    formationRelations.find((relation) => relation.fromNoteId === "PERM-FLEETING-NOTE-IS-CAPTURE")?.toNoteId,
    "PERM-PARAPHRASE-BEFORE-JUDGMENT"
  );

  const nextByNoteId = new Map();
  for (const relation of graph.edges) {
    const next = nextByNoteId.get(relation.fromNoteId) || [];
    next.push(relation.toNoteId);
    nextByNoteId.set(relation.fromNoteId, next);
  }
  for (const sourceNoteId of note.viewpointHistory[0].sourceNoteIds) {
    const queue = [sourceNoteId];
    const seen = new Set(queue);
    while (queue.length) {
      const current = queue.shift();
      for (const next of nextByNoteId.get(current) || []) {
        if (seen.has(next)) continue;
        seen.add(next);
        queue.push(next);
      }
    }
    assert.ok(seen.has(note.id), `${sourceNoteId} should reach the current viewpoint in the graph`);
  }

  const formationEdgeSnapshot = graph.edges
    .filter((relation) => note.viewpointHistory[0].sourceNoteIds.includes(relation.fromNoteId))
    .map((relation) => `${relation.id}:${relation.fromNoteId}:${relation.toNoteId}:${relation.relationType}`)
    .sort();
  await seedSmartNotesProductThinking(vaultPath);
  const refreshedGraph = await getDirectoryGraph(vaultPath, seeded.directoryId);
  const refreshedFormationEdgeSnapshot = refreshedGraph.edges
    .filter((relation) => note.viewpointHistory[0].sourceNoteIds.includes(relation.fromNoteId))
    .map((relation) => `${relation.id}:${relation.fromNoteId}:${relation.toNoteId}:${relation.relationType}`)
    .sort();

  assert.equal(refreshedGraph.totalEdges, graph.totalEdges);
  assert.deepEqual(refreshedFormationEdgeSnapshot, formationEdgeSnapshot);
});
