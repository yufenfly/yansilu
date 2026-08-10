import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import fs from "node:fs/promises";
import os from "node:os";
import {
  buildNotePathIndex,
  createDirectory,
  createNoteInDirectory,
  createNoteRelation,
  deleteNoteById,
  getDirectoryGraph,
  getNoteById,
  initVault,
  listDirectories,
  listNotesByTag,
  listNotesInDirectory,
  listNoteRelations,
  listTags,
  moveNoteToDirectory,
  parseMarkdownWithFrontmatter,
  readNote,
  registerMarkdownNoteInCatalog,
  searchNotes,
  serializeMarkdownWithFrontmatter,
  confirmPermanentNoteDistillation,
  updatePermanentNoteDistillation,
  updateNoteRelation,
  updateNoteContent,
  writeLiteratureNoteIfAbsent,
  writePermanentNoteIfAbsent,
  writeSourceIfAbsent
} from "../../packages/domain/src/index.mjs";

async function makeTempVault() {
  return fs.mkdtemp(path.join(os.tmpdir(), "yansilu-vault-"));
}

test("initVault creates the core vault layout", async () => {
  const vaultPath = await makeTempVault();
  await initVault(vaultPath);

  const expectedDirs = [
    ".yansilu",
    "imports",
    "exports",
    "assets",
    path.join("notes", "fleeting"),
    path.join("notes", "sources"),
    path.join("notes", "literature"),
    path.join("notes", "permanent"),
    path.join("notes", "original")
  ];

  for (const dir of expectedDirs) {
    const stat = await fs.stat(path.join(vaultPath, dir));
    assert.equal(stat.isDirectory(), true);
  }
});

test("initVault heals directory fs paths after moving a packed vault to a new machine", async () => {
  const oldVaultPath = await makeTempVault();
  await initVault(oldVaultPath);
  const customDir = await createDirectory(oldVaultPath, {
    id: "dir_custom_migration",
    title: "Migration Child",
    directoryType: "custom",
    fsPath: path.join(oldVaultPath, "notes", "original", "migration-child"),
    parentDirectoryId: "dir_original_default"
  });
  await createNoteInDirectory(oldVaultPath, {
    directoryId: customDir.id,
    id: "perm_migration",
    title: "Migrated relation note",
    body: "# Migrated relation note\n\nPortable body",
    noteType: "permanent"
  });
  await createNoteInDirectory(oldVaultPath, {
    directoryId: "dir_original_default",
    id: "perm_migration_target",
    title: "Migrated target note",
    body: "# Migrated target note\n\nTarget body",
    noteType: "permanent"
  });
  await createNoteRelation(oldVaultPath, "perm_migration", {
    toNoteId: "perm_migration_target",
    relationType: "supports",
    rationale: "Migration keeps relation records inside the catalog."
  });

  const packedVaultPath = await makeTempVault();
  await fs.rm(packedVaultPath, { recursive: true, force: true });
  await fs.cp(oldVaultPath, packedVaultPath, { recursive: true });

  await initVault(packedVaultPath);
  const directories = await listDirectories(packedVaultPath, { includeHidden: true });
  const original = directories.find((item) => item.id === "dir_original_default");
  const custom = directories.find((item) => item.id === "dir_custom_migration");

  assert.equal(path.resolve(original.fsPath), path.join(path.resolve(packedVaultPath), "notes", "original"));
  assert.equal(path.resolve(custom.fsPath), path.join(path.resolve(packedVaultPath), "notes", "original", "migration-child"));
  const notes = await listNotesInDirectory(packedVaultPath, custom.id);
  assert.equal(notes[0].id, "perm_migration");
  const relations = await listNoteRelations(packedVaultPath, "perm_migration");
  assert.equal(relations.outgoingLinks.length, 1);
  assert.equal(relations.outgoingLinks[0].target.id, "perm_migration_target");
});

test("frontmatter parse and serialize preserve unknown fields", () => {
  const markdown = serializeMarkdownWithFrontmatter(
    {
      id: "ln_test",
      title: "A note",
      tags: ["reading", "method"],
      custom_field: "kept"
    },
    "Body text"
  );

  const parsed = parseMarkdownWithFrontmatter(markdown);
  assert.equal(parsed.frontmatter.id, "ln_test");
  assert.equal(parsed.frontmatter.title, "A note");
  assert.deepEqual(parsed.frontmatter.tags, ["reading", "method"]);
  assert.equal(parsed.frontmatter.custom_field, "kept");
  assert.equal(parsed.body, "Body text");
});

test("frontmatter inline arrays preserve commas inside quoted items", () => {
  const markdown = serializeMarkdownWithFrontmatter(
    {
      three_line_summary: [
        "Claim, reason, and use are separate.",
        "Commas inside a line should not split items.",
        "The parser should restore exactly three lines."
      ]
    },
    "# Body"
  );

  const parsed = parseMarkdownWithFrontmatter(markdown);
  assert.deepEqual(parsed.frontmatter.three_line_summary, [
    "Claim, reason, and use are separate.",
    "Commas inside a line should not split items.",
    "The parser should restore exactly three lines."
  ]);
});

test("Source, LiteratureNote, and PermanentNote write and read back", async () => {
  const vaultPath = await makeTempVault();
  const now = new Date().toISOString();

  await writeSourceIfAbsent(vaultPath, {
    id: "src_test",
    source_type: "markdown",
    title: "Source title",
    imported_from: "local",
    created_at: now,
    updated_at: now,
    description: "Source body"
  });

  await writeLiteratureNoteIfAbsent(vaultPath, {
    id: "ln_test",
    source_id: "src_test",
    title: "Literature title",
    quote_text: "Quoted passage",
    paraphrase_text: "",
    status: "draft",
    created_at: now,
    updated_at: now
  });

  await writePermanentNoteIfAbsent(vaultPath, {
    id: "pn_test",
    title: "Permanent title",
    core_claim: "My own claim",
    rationale: "Why this claim matters",
    authorship: { user_confirmed: true, ai_assisted: false },
    originality_status: "pass",
    status: "draft",
    created_at: now,
    updated_at: now
  });

  const source = await readNote(vaultPath, "source", "src_test");
  const literature = await readNote(vaultPath, "literature", "ln_test");
  const permanent = await readNote(vaultPath, "permanent", "pn_test");

  assert.equal(source.note.title, "Source title");
  assert.equal(source.note.body, "Source body");
  assert.match(source.markdown, /^---[\s\S]*\n# Source title\n\nSource body$/);
  assert.equal(literature.note.source_id, "src_test");
  assert.equal(literature.note.body, "Quoted passage");
  assert.match(literature.markdown, /^---[\s\S]*\n# Literature title\n\nQuoted passage$/);
  assert.equal(permanent.note.title, "Permanent title");
  assert.equal(permanent.note.body, "My own claim");
  assert.match(permanent.markdown, /^---[\s\S]*\n# Permanent title\n\nMy own claim$/);
});

test("writeNoteIfAbsent skips existing files", async () => {
  const vaultPath = await makeTempVault();
  const now = new Date().toISOString();
  const first = await writeSourceIfAbsent(vaultPath, {
    id: "src_test",
    source_type: "markdown",
    title: "First",
    imported_from: "local",
    created_at: now,
    updated_at: now,
    description: "First body"
  });

  const second = await writeSourceIfAbsent(vaultPath, {
    id: "src_test",
    source_type: "markdown",
    title: "Second",
    imported_from: "local",
    created_at: now,
    updated_at: now,
    description: "Second body"
  });

  const source = await readNote(vaultPath, "source", "src_test");
  assert.equal(first.written, true);
  assert.equal(second.written, false);
  assert.equal(second.reason, "exists");
  assert.equal(source.note.title, "First");
  assert.equal(source.note.body, "First body");
});

test("writeLiteratureNoteIfAbsent can target a specific directory fs path", async () => {
  const vaultPath = await makeTempVault();
  const now = new Date().toISOString();
  const targetDir = path.join(vaultPath, "notes", "literature", "custom-import-box");
  await fs.mkdir(targetDir, { recursive: true });

  const result = await writeLiteratureNoteIfAbsent(
    vaultPath,
    {
      id: "ln_targeted",
      source_id: "src_targeted",
      title: "Targeted literature",
      quote_text: "Quote in targeted directory",
      paraphrase_text: "",
      status: "draft",
      created_at: now,
      updated_at: now
    },
    {
      directoryFsPath: targetDir
    }
  );

  assert.equal(result.written, true);
  assert.equal(result.path, path.join(targetDir, "ln_targeted.md"));
  const markdown = await fs.readFile(result.path, "utf8");
  assert.match(markdown, /# Targeted literature/);

  const targeted = await readNote(vaultPath, "literature", "ln_targeted");
  assert.equal(targeted.path, path.join(targetDir, "ln_targeted.md"));
  assert.equal(targeted.note.title, "Targeted literature");
  assert.equal(targeted.note.body, "Quote in targeted directory");
});

test("writeLiteratureNoteIfAbsent blocks duplicate ids across different directories", async () => {
  const vaultPath = await makeTempVault();
  const now = new Date().toISOString();
  const firstDir = path.join(vaultPath, "notes", "literature", "batch-a");
  const secondDir = path.join(vaultPath, "notes", "literature", "batch-b");
  await fs.mkdir(firstDir, { recursive: true });
  await fs.mkdir(secondDir, { recursive: true });

  const first = await writeLiteratureNoteIfAbsent(
    vaultPath,
    {
      id: "ln_duplicate",
      source_id: "src_duplicate",
      title: "First duplicate",
      quote_text: "First body",
      paraphrase_text: "",
      status: "draft",
      created_at: now,
      updated_at: now
    },
    { directoryFsPath: firstDir }
  );
  const second = await writeLiteratureNoteIfAbsent(
    vaultPath,
    {
      id: "ln_duplicate",
      source_id: "src_duplicate",
      title: "Second duplicate",
      quote_text: "Second body",
      paraphrase_text: "",
      status: "draft",
      created_at: now,
      updated_at: now
    },
    { directoryFsPath: secondDir }
  );
  const note = await readNote(vaultPath, "literature", "ln_duplicate");
  assert.equal(first.written, true);
  assert.equal(second.written, false);
  assert.equal(second.reason, "exists");
  assert.equal(second.path, first.path);
  assert.equal(note.path, first.path);
  assert.equal(note.note.title, "First duplicate");
  assert.equal(note.note.body, "First body");
});

test("writeLiteratureNoteIfAbsent with a prebuilt path index does not rescan unmatched files", async () => {
  const vaultPath = await makeTempVault();
  const now = new Date().toISOString();
  const targetDir = path.join(vaultPath, "notes", "literature", "batch-indexed");
  await fs.mkdir(targetDir, { recursive: true });
  const notePathIndex = await buildNotePathIndex(vaultPath, "literature");

  const result = await writeLiteratureNoteIfAbsent(
    vaultPath,
    {
      id: "ln_indexed",
      source_id: "src_indexed",
      title: "Indexed literature",
      quote_text: "Indexed body",
      paraphrase_text: "",
      status: "draft",
      created_at: now,
      updated_at: now
    },
    {
      directoryFsPath: targetDir,
      notePathIndex,
      skipInit: true
    }
  );

  assert.equal(result.written, true);
  assert.equal(result.path, path.join(targetDir, "ln_indexed.md"));
  assert.deepEqual(notePathIndex.get("ln_indexed.md"), [path.join(targetDir, "ln_indexed.md")]);
});

test("readNote reports ambiguous paths when legacy duplicate files exist without catalog metadata", async () => {
  const vaultPath = await makeTempVault();
  const firstDir = path.join(vaultPath, "notes", "literature", "legacy-a");
  const secondDir = path.join(vaultPath, "notes", "literature", "legacy-b");
  await fs.mkdir(firstDir, { recursive: true });
  await fs.mkdir(secondDir, { recursive: true });
  const filename = "ln_legacy_dup.md";
  const markdown = [
    "---",
    "id: ln_legacy_dup",
    "title: Legacy duplicate",
    "note_type: literature",
    "---",
    "",
    "# Legacy duplicate",
    "",
    "Duplicate body"
  ].join("\n");
  await fs.writeFile(path.join(firstDir, filename), markdown, "utf8");
  await fs.writeFile(path.join(secondDir, filename), markdown, "utf8");

  await assert.rejects(() => readNote(vaultPath, "literature", "ln_legacy_dup"), {
    code: "NOTE_PATH_AMBIGUOUS"
  });
});

test("readNote ignores stale catalog paths when the markdown file is missing", async () => {
  const vaultPath = await makeTempVault();
  await initVault(vaultPath);
  const liveDir = path.join(vaultPath, "notes", "literature", "live");
  const staleDir = path.join(vaultPath, "notes", "literature", "stale");
  await fs.mkdir(liveDir, { recursive: true });
  await fs.mkdir(staleDir, { recursive: true });
  const filename = "ln_stale_catalog.md";
  const markdown = [
    "---",
    "id: ln_stale_catalog",
    "title: Live copy",
    "note_type: literature",
    "---",
    "",
    "# Live copy",
    "",
    "Live body"
  ].join("\n");
  const livePath = path.join(liveDir, filename);
  const stalePath = path.join(staleDir, filename);
  await fs.writeFile(stalePath, markdown, "utf8");
  await registerMarkdownNoteInCatalog(vaultPath, {
    noteId: "ln_stale_catalog",
    noteType: "literature",
    title: "Stale copy",
    status: "draft",
    markdownPath: path.relative(vaultPath, stalePath).replaceAll("\\", "/"),
    directoryId: "dir_literature_default"
  });
  await fs.unlink(stalePath);
  await fs.writeFile(livePath, markdown, "utf8");

  const note = await readNote(vaultPath, "literature", "ln_stale_catalog");
  assert.equal(note.path, livePath);
  assert.equal(note.note.title, "Live copy");
  const catalogNote = await getNoteById(vaultPath, "ln_stale_catalog");
  assert.equal(catalogNote.markdownPath, path.relative(vaultPath, livePath).replaceAll("\\", "/"));
});

test("searchNotes heals stale catalog paths for metadata-only queries", async () => {
  const vaultPath = await makeTempVault();
  await initVault(vaultPath);
  const staleDir = path.join(vaultPath, "notes", "literature", "stale-search");
  const liveDir = path.join(vaultPath, "notes", "literature", "live-search");
  await fs.mkdir(staleDir, { recursive: true });
  await fs.mkdir(liveDir, { recursive: true });
  const now = new Date().toISOString();
  const staleWrite = await writeLiteratureNoteIfAbsent(
    vaultPath,
    {
      id: "ln_search_heal",
      source_id: "src_search_heal",
      title: "Search stale",
      quote_text: "Old body #oldtag",
      paraphrase_text: "",
      status: "draft",
      created_at: now,
      updated_at: now
    },
    { directoryFsPath: staleDir }
  );
  await registerMarkdownNoteInCatalog(vaultPath, {
    noteId: "ln_search_heal",
    noteType: "literature",
    title: "Search stale",
    status: "draft",
    markdownPath: path.relative(vaultPath, staleWrite.path).replaceAll("\\", "/"),
    directoryId: "dir_literature_default"
  });
  await fs.unlink(staleWrite.path);
  const liveWrite = await writeLiteratureNoteIfAbsent(
    vaultPath,
    {
      id: "ln_search_heal",
      source_id: "src_search_heal",
      title: "Search live",
      quote_text: "Fresh body #freshtag",
      paraphrase_text: "",
      status: "active",
      created_at: now,
      updated_at: now
    },
    { directoryFsPath: liveDir }
  );

  const result = await searchNotes(vaultPath, { query: "search live" });
  const item = result.items.find((entry) => entry.id === "ln_search_heal");
  assert.ok(item);
  assert.equal(item.title, "Search live");
  assert.equal(item.status, "active");
  assert.equal(item.markdownPath, path.relative(vaultPath, liveWrite.path).replaceAll("\\", "/"));
});

test("writeLiteratureNoteIfAbsent recreates a note when catalog points at a missing file", async () => {
  const vaultPath = await makeTempVault();
  await initVault(vaultPath);
  const staleDir = path.join(vaultPath, "notes", "literature", "stale-write");
  const targetDir = path.join(vaultPath, "notes", "literature", "restored");
  await fs.mkdir(staleDir, { recursive: true });
  await fs.mkdir(targetDir, { recursive: true });
  const stalePath = path.join(staleDir, "ln_restore.md");
  const now = new Date().toISOString();

  await fs.writeFile(stalePath, "# Stale copy\n\nOld body", "utf8");
  await registerMarkdownNoteInCatalog(vaultPath, {
    noteId: "ln_restore",
    noteType: "literature",
    title: "Stale copy",
    status: "draft",
    markdownPath: path.relative(vaultPath, stalePath).replaceAll("\\", "/"),
    directoryId: "dir_literature_default"
  });
  await fs.unlink(stalePath);

  const result = await writeLiteratureNoteIfAbsent(
    vaultPath,
    {
      id: "ln_restore",
      source_id: "src_restore",
      title: "Restored copy",
      quote_text: "Fresh body",
      paraphrase_text: "",
      status: "draft",
      created_at: now,
      updated_at: now
    },
    { directoryFsPath: targetDir }
  );

  assert.equal(result.written, true);
  assert.equal(result.path, path.join(targetDir, "ln_restore.md"));
  const note = await readNote(vaultPath, "literature", "ln_restore");
  assert.equal(note.path, result.path);
  assert.equal(note.note.title, "Restored copy");
  const catalogNote = await getNoteById(vaultPath, "ln_restore");
  assert.equal(catalogNote.markdownPath, path.relative(vaultPath, result.path).replaceAll("\\", "/"));
});

test("tag queries heal stale notes and refresh markdown-body tag relations", async () => {
  const vaultPath = await makeTempVault();
  await initVault(vaultPath);
  const staleDir = path.join(vaultPath, "notes", "literature", "stale-list");
  const liveDir = path.join(vaultPath, "notes", "literature", "live-list");
  await fs.mkdir(staleDir, { recursive: true });
  await fs.mkdir(liveDir, { recursive: true });
  const now = new Date().toISOString();
  const staleWrite = await writeLiteratureNoteIfAbsent(
    vaultPath,
    {
      id: "ln_list_heal",
      source_id: "src_list_heal",
      title: "List heal",
      quote_text: "Old body #oldtag",
      paraphrase_text: "",
      status: "draft",
      created_at: now,
      updated_at: now
    },
    { directoryFsPath: staleDir }
  );
  await registerMarkdownNoteInCatalog(vaultPath, {
    noteId: "ln_list_heal",
    noteType: "literature",
    title: "List heal",
    status: "draft",
    markdownPath: path.relative(vaultPath, staleWrite.path).replaceAll("\\", "/"),
    directoryId: "dir_literature_default"
  });
  await fs.unlink(staleWrite.path);
  const liveWrite = await writeLiteratureNoteIfAbsent(
    vaultPath,
    {
      id: "ln_list_heal",
      source_id: "src_list_heal",
      title: "List heal",
      quote_text: "Fresh body #freshtag",
      paraphrase_text: "",
      status: "draft",
      created_at: now,
      updated_at: now
    },
    { directoryFsPath: liveDir }
  );

  const freshTag = await listNotesByTag(vaultPath, "freshtag");
  assert.equal(freshTag.total, 1);
  assert.equal(freshTag.items[0].id, "ln_list_heal");
  assert.equal(freshTag.items[0].markdownPath, path.relative(vaultPath, liveWrite.path).replaceAll("\\", "/"));

  const oldTag = await listNotesByTag(vaultPath, "oldtag");
  assert.equal(oldTag.total, 0);

  const tags = await listTags(vaultPath);
  assert.ok(tags.items.find((item) => item.name === "freshtag"));
  assert.ok(!tags.items.find((item) => item.name === "oldtag"));

  const notes = await listNotesInDirectory(vaultPath, "dir_literature_default");
  const healed = notes.find((note) => note.id === "ln_list_heal");
  assert.ok(healed);
  assert.equal(healed.markdownPath, path.relative(vaultPath, liveWrite.path).replaceAll("\\", "/"));
});

test("relation queries heal stale endpoint metadata without a warm-up read", async () => {
  const vaultPath = await makeTempVault();
  await initVault(vaultPath);
  const staleDir = path.join(vaultPath, "notes", "literature", "stale-relations");
  const liveDir = path.join(vaultPath, "notes", "literature", "live-relations");
  await fs.mkdir(staleDir, { recursive: true });
  await fs.mkdir(liveDir, { recursive: true });
  const now = new Date().toISOString();

  const staleSource = await writeLiteratureNoteIfAbsent(
    vaultPath,
    {
      id: "ln_relation_source",
      source_id: "src_relation_source",
      title: "Old source title",
      quote_text: "Old source body",
      paraphrase_text: "",
      status: "draft",
      created_at: now,
      updated_at: now
    },
    { directoryFsPath: staleDir }
  );
  await registerMarkdownNoteInCatalog(vaultPath, {
    noteId: "ln_relation_source",
    noteType: "literature",
    title: "Old source title",
    status: "draft",
    markdownPath: path.relative(vaultPath, staleSource.path).replaceAll("\\", "/"),
    directoryId: "dir_literature_default"
  });

  const staleTarget = await writeLiteratureNoteIfAbsent(
    vaultPath,
    {
      id: "ln_relation_target",
      source_id: "src_relation_target",
      title: "Old target title",
      quote_text: "Old target body",
      paraphrase_text: "",
      status: "draft",
      created_at: now,
      updated_at: now
    },
    { directoryFsPath: staleDir }
  );
  await registerMarkdownNoteInCatalog(vaultPath, {
    noteId: "ln_relation_target",
    noteType: "literature",
    title: "Old target title",
    status: "draft",
    markdownPath: path.relative(vaultPath, staleTarget.path).replaceAll("\\", "/"),
    directoryId: "dir_literature_default"
  });

  await createNoteRelation(vaultPath, {
    fromNoteId: "ln_relation_source",
    toNoteId: "ln_relation_target",
    relationType: "supports",
    rationale: "The source note directly supports the target claim.",
    status: "confirmed",
    createdBy: "user"
  });

  await fs.unlink(staleSource.path);
  await fs.unlink(staleTarget.path);

  const liveSource = await writeLiteratureNoteIfAbsent(
    vaultPath,
    {
      id: "ln_relation_source",
      source_id: "src_relation_source",
      title: "Live source title",
      quote_text: "Live source body",
      paraphrase_text: "",
      status: "active",
      created_at: now,
      updated_at: now
    },
    { directoryFsPath: liveDir }
  );
  const liveTarget = await writeLiteratureNoteIfAbsent(
    vaultPath,
    {
      id: "ln_relation_target",
      source_id: "src_relation_target",
      title: "Live target title",
      quote_text: "Live target body",
      paraphrase_text: "",
      status: "active",
      created_at: now,
      updated_at: now
    },
    { directoryFsPath: liveDir }
  );

  const sourceRelations = await listNoteRelations(vaultPath, "ln_relation_source");
  assert.equal(sourceRelations.outgoingLinks.length, 1);
  assert.equal(sourceRelations.outgoingLinks[0].target.title, "Live target title");
  assert.equal(
    sourceRelations.outgoingLinks[0].target.markdownPath,
    path.relative(vaultPath, liveTarget.path).replaceAll("\\", "/")
  );

  const targetRelations = await listNoteRelations(vaultPath, "ln_relation_target");
  assert.equal(targetRelations.backlinks.length, 1);
  assert.equal(targetRelations.backlinks[0].source.title, "Live source title");
  assert.equal(
    targetRelations.backlinks[0].source.markdownPath,
    path.relative(vaultPath, liveSource.path).replaceAll("\\", "/")
  );
});

test("wikilink relation sync skips ambiguous same-type duplicate titles", async () => {
  const vaultPath = await makeTempVault();
  await initVault(vaultPath);
  const now = new Date().toISOString();

  const duplicateTargetA = await writeLiteratureNoteIfAbsent(vaultPath, {
    id: "ln_duplicate_target_a",
    source_id: "src_duplicate_target_a",
    title: "Duplicate Target",
    quote_text: "First possible target.",
    paraphrase_text: "",
    status: "draft",
    created_at: now,
    updated_at: now
  });
  await registerMarkdownNoteInCatalog(vaultPath, {
    noteId: "ln_duplicate_target_a",
    noteType: "literature",
    title: "Duplicate Target",
    status: "draft",
    markdownPath: path.relative(vaultPath, duplicateTargetA.path).replaceAll("\\", "/"),
    directoryId: "dir_literature_default"
  });
  const duplicateTargetB = await writeLiteratureNoteIfAbsent(vaultPath, {
    id: "ln_duplicate_target_b",
    source_id: "src_duplicate_target_b",
    title: "Duplicate Target",
    quote_text: "Second possible target.",
    paraphrase_text: "",
    status: "draft",
    created_at: now,
    updated_at: now
  });
  await registerMarkdownNoteInCatalog(vaultPath, {
    noteId: "ln_duplicate_target_b",
    noteType: "literature",
    title: "Duplicate Target",
    status: "draft",
    markdownPath: path.relative(vaultPath, duplicateTargetB.path).replaceAll("\\", "/"),
    directoryId: "dir_literature_default"
  });
  const duplicateSource = await writeLiteratureNoteIfAbsent(vaultPath, {
    id: "ln_duplicate_source",
    source_id: "src_duplicate_source",
    title: "Duplicate source",
    quote_text: "This should not auto-link [[Duplicate Target]] because the title is ambiguous.",
    paraphrase_text: "",
    status: "draft",
    created_at: now,
    updated_at: now
  });
  await registerMarkdownNoteInCatalog(vaultPath, {
    noteId: "ln_duplicate_source",
    noteType: "literature",
    title: "Duplicate source",
    status: "draft",
    markdownPath: path.relative(vaultPath, duplicateSource.path).replaceAll("\\", "/"),
    directoryId: "dir_literature_default"
  });

  const sourceRelations = await listNoteRelations(vaultPath, "ln_duplicate_source");
  assert.deepEqual(sourceRelations.outgoingLinks, []);
});

test("wikilink relation sync can disambiguate duplicate titles by markdown path", async () => {
  const vaultPath = await makeTempVault();
  await initVault(vaultPath);
  const specialDir = path.join(vaultPath, "notes", "literature", "special");
  const otherDir = path.join(vaultPath, "notes", "literature", "other");
  await fs.mkdir(specialDir, { recursive: true });
  await fs.mkdir(otherDir, { recursive: true });

  const specialTargetPath = path.join(specialDir, "Path Target.md");
  const otherTargetPath = path.join(otherDir, "Path Target.md");
  const sourcePath = path.join(vaultPath, "notes", "literature", "path-source.md");
  await fs.writeFile(
    specialTargetPath,
    serializeMarkdownWithFrontmatter({ title: "Path Target", note_type: "literature" }, "Special target body."),
    "utf8"
  );
  await fs.writeFile(
    otherTargetPath,
    serializeMarkdownWithFrontmatter({ title: "Path Target", note_type: "literature" }, "Other target body."),
    "utf8"
  );
  await fs.writeFile(
    sourcePath,
    serializeMarkdownWithFrontmatter(
      { title: "Path source", note_type: "literature" },
      "This path link should resolve [[special/Path Target]]."
    ),
    "utf8"
  );

  await registerMarkdownNoteInCatalog(vaultPath, {
    noteId: "ln_path_target_special",
    noteType: "literature",
    title: "Path Target",
    status: "draft",
    markdownPath: path.relative(vaultPath, specialTargetPath).replaceAll("\\", "/"),
    directoryId: "dir_literature_default"
  });
  await registerMarkdownNoteInCatalog(vaultPath, {
    noteId: "ln_path_target_other",
    noteType: "literature",
    title: "Path Target",
    status: "draft",
    markdownPath: path.relative(vaultPath, otherTargetPath).replaceAll("\\", "/"),
    directoryId: "dir_literature_default"
  });
  await registerMarkdownNoteInCatalog(vaultPath, {
    noteId: "ln_path_source",
    noteType: "literature",
    title: "Path source",
    status: "draft",
    markdownPath: path.relative(vaultPath, sourcePath).replaceAll("\\", "/"),
    directoryId: "dir_literature_default"
  });

  const sourceRelations = await listNoteRelations(vaultPath, "ln_path_source");
  assert.equal(sourceRelations.outgoingLinks.length, 1);
  assert.equal(sourceRelations.outgoingLinks[0].toNoteId, "ln_path_target_special");
});

test("wikilink relation sync deduplicates different targets that resolve to the same note", async () => {
  const vaultPath = await makeTempVault();
  await initVault(vaultPath);
  const dedupDir = path.join(vaultPath, "notes", "literature", "dedup");
  await fs.mkdir(dedupDir, { recursive: true });

  const targetPath = path.join(dedupDir, "Dedup Target.md");
  const sourcePath = path.join(vaultPath, "notes", "literature", "dedup-source.md");
  await fs.writeFile(
    targetPath,
    serializeMarkdownWithFrontmatter({ title: "Dedup Target", note_type: "literature" }, "Target body."),
    "utf8"
  );
  await fs.writeFile(
    sourcePath,
    serializeMarkdownWithFrontmatter(
      { title: "Dedup source", note_type: "literature" },
      [
        "These all point to the same note:",
        "[[Dedup Target]]",
        "[[ln_dedup_target|same target by id]]",
        "[[dedup/Dedup Target.md|same target by path]]."
      ].join("\n")
    ),
    "utf8"
  );

  await registerMarkdownNoteInCatalog(vaultPath, {
    noteId: "ln_dedup_target",
    noteType: "literature",
    title: "Dedup Target",
    status: "draft",
    markdownPath: path.relative(vaultPath, targetPath).replaceAll("\\", "/"),
    directoryId: "dir_literature_default"
  });
  await registerMarkdownNoteInCatalog(vaultPath, {
    noteId: "ln_dedup_source",
    noteType: "literature",
    title: "Dedup source",
    status: "draft",
    markdownPath: path.relative(vaultPath, sourcePath).replaceAll("\\", "/"),
    directoryId: "dir_literature_default"
  });

  const sourceRelations = await listNoteRelations(vaultPath, "ln_dedup_source");
  assert.equal(sourceRelations.outgoingLinks.length, 1);
  assert.equal(sourceRelations.outgoingLinks[0].toNoteId, "ln_dedup_target");
  assert.equal(sourceRelations.outgoingLinks[0].relationType, "associated_with");
  assert.equal(sourceRelations.outgoingLinks[0].rationale, "markdown_wikilink");

  const graph = await getDirectoryGraph(vaultPath, "dir_literature_default");
  assert.equal(graph.totalEdges, 1);
  assert.equal(graph.edges[0].fromNoteId, "ln_dedup_source");
  assert.equal(graph.edges[0].toNoteId, "ln_dedup_target");
});

test("wikilink relation sync treats path wildcard characters as literal text", async () => {
  const vaultPath = await makeTempVault();
  await initVault(vaultPath);
  const specialDir = path.join(vaultPath, "notes", "literature", "special");
  await fs.mkdir(specialDir, { recursive: true });

  const wildcardLookalikePath = path.join(specialDir, "PathXTarget.md");
  const sourcePath = path.join(vaultPath, "notes", "literature", "wildcard-source.md");
  await fs.writeFile(
    wildcardLookalikePath,
    serializeMarkdownWithFrontmatter({ title: "PathXTarget", note_type: "literature" }, "Lookalike target body."),
    "utf8"
  );
  await fs.writeFile(
    sourcePath,
    serializeMarkdownWithFrontmatter(
      { title: "Wildcard source", note_type: "literature" },
      "This path link should not treat the underscore as SQL wildcard [[special/Path_Target]]."
    ),
    "utf8"
  );

  await registerMarkdownNoteInCatalog(vaultPath, {
    noteId: "ln_path_target_x",
    noteType: "literature",
    title: "PathXTarget",
    status: "draft",
    markdownPath: path.relative(vaultPath, wildcardLookalikePath).replaceAll("\\", "/"),
    directoryId: "dir_literature_default"
  });
  await registerMarkdownNoteInCatalog(vaultPath, {
    noteId: "ln_wildcard_source",
    noteType: "literature",
    title: "Wildcard source",
    status: "draft",
    markdownPath: path.relative(vaultPath, sourcePath).replaceAll("\\", "/"),
    directoryId: "dir_literature_default"
  });

  const sourceRelations = await listNoteRelations(vaultPath, "ln_wildcard_source");
  assert.deepEqual(sourceRelations.outgoingLinks, []);
});

test("quick wikilink relations stay attached when duplicate titles use a path alias", async () => {
  const vaultPath = await makeTempVault();
  await initVault(vaultPath);
  const specialDir = path.join(vaultPath, "notes", "literature", "special");
  const otherDir = path.join(vaultPath, "notes", "literature", "other");
  await fs.mkdir(specialDir, { recursive: true });
  await fs.mkdir(otherDir, { recursive: true });

  const specialTargetPath = path.join(specialDir, "Alias Target.md");
  const otherTargetPath = path.join(otherDir, "Alias Target.md");
  const sourcePath = path.join(vaultPath, "notes", "literature", "alias-source.md");
  const sourceBody = "This path alias should keep pointing to [[special/Alias Target|Alias Target]].";
  await fs.writeFile(
    specialTargetPath,
    serializeMarkdownWithFrontmatter({ title: "Alias Target", note_type: "literature" }, "Special alias target body."),
    "utf8"
  );
  await fs.writeFile(
    otherTargetPath,
    serializeMarkdownWithFrontmatter({ title: "Alias Target", note_type: "literature" }, "Other alias target body."),
    "utf8"
  );
  await fs.writeFile(
    sourcePath,
    serializeMarkdownWithFrontmatter({ title: "Alias source", note_type: "literature" }, sourceBody),
    "utf8"
  );

  await registerMarkdownNoteInCatalog(vaultPath, {
    noteId: "ln_alias_target_special",
    noteType: "literature",
    title: "Alias Target",
    status: "draft",
    markdownPath: path.relative(vaultPath, specialTargetPath).replaceAll("\\", "/"),
    directoryId: "dir_literature_default"
  });
  await registerMarkdownNoteInCatalog(vaultPath, {
    noteId: "ln_alias_target_other",
    noteType: "literature",
    title: "Alias Target",
    status: "draft",
    markdownPath: path.relative(vaultPath, otherTargetPath).replaceAll("\\", "/"),
    directoryId: "dir_literature_default"
  });
  await registerMarkdownNoteInCatalog(vaultPath, {
    noteId: "ln_alias_source",
    noteType: "literature",
    title: "Alias source",
    status: "draft",
    markdownPath: path.relative(vaultPath, sourcePath).replaceAll("\\", "/"),
    directoryId: "dir_literature_default"
  });

  const initialRelations = await listNoteRelations(vaultPath, "ln_alias_source");
  assert.equal(initialRelations.outgoingLinks.length, 1);
  assert.equal(initialRelations.outgoingLinks[0].toNoteId, "ln_alias_target_special");

  await updateNoteRelation(vaultPath, initialRelations.outgoingLinks[0].id, {
    relationType: "associated_with",
    rationale: "手动确认关联。",
    insightQuestion: "__yansilu_quick_wikilink_association__",
    confidence: 1,
    status: "confirmed"
  });
  await updateNoteContent(vaultPath, "ln_alias_source", {
    body: `# Alias source\n\n${sourceBody}\n\nSaved again.`
  });

  const sourceRelations = await listNoteRelations(vaultPath, "ln_alias_source");
  assert.equal(sourceRelations.outgoingLinks.length, 1);
  assert.equal(sourceRelations.outgoingLinks[0].toNoteId, "ln_alias_target_special");
  assert.equal(sourceRelations.outgoingLinks[0].rationale, "手动确认关联。");
});

test("quick wikilink relations stay attached when id aliases survive target rename and move", async () => {
  const vaultPath = await makeTempVault();
  await initVault(vaultPath);
  const now = new Date().toISOString();
  const sourceBody = "A stable manual association points to [[ln_id_alias_target|Stable Target]].";

  const targetWrite = await writeLiteratureNoteIfAbsent(vaultPath, {
    id: "ln_id_alias_target",
    source_id: "src_id_alias_target",
    title: "Stable Target",
    quote_text: "Target body before moving.",
    paraphrase_text: "",
    status: "draft",
    created_at: now,
    updated_at: now
  });
  await registerMarkdownNoteInCatalog(vaultPath, {
    noteId: "ln_id_alias_target",
    noteType: "literature",
    title: "Stable Target",
    status: "draft",
    markdownPath: path.relative(vaultPath, targetWrite.path).replaceAll("\\", "/"),
    directoryId: "dir_literature_default"
  });

  const sourceWrite = await writeLiteratureNoteIfAbsent(vaultPath, {
    id: "ln_id_alias_source",
    source_id: "src_id_alias_source",
    title: "ID alias source",
    quote_text: sourceBody,
    paraphrase_text: "",
    status: "draft",
    created_at: now,
    updated_at: now
  });
  await registerMarkdownNoteInCatalog(vaultPath, {
    noteId: "ln_id_alias_source",
    noteType: "literature",
    title: "ID alias source",
    status: "draft",
    markdownPath: path.relative(vaultPath, sourceWrite.path).replaceAll("\\", "/"),
    directoryId: "dir_literature_default"
  });

  const initialRelations = await listNoteRelations(vaultPath, "ln_id_alias_source");
  assert.equal(initialRelations.outgoingLinks.length, 1);
  assert.equal(initialRelations.outgoingLinks[0].toNoteId, "ln_id_alias_target");

  await updateNoteRelation(vaultPath, initialRelations.outgoingLinks[0].id, {
    relationType: "associated_with",
    rationale: "Manual association.",
    insightQuestion: "__yansilu_quick_wikilink_association__",
    confidence: 1,
    status: "confirmed"
  });

  await updateNoteContent(vaultPath, "ln_id_alias_target", {
    title: "Renamed Stable Target",
    body: "# Renamed Stable Target\n\nTarget body after renaming."
  });
  const movedDirectory = await createDirectory(vaultPath, {
    title: "Moved ID Alias Targets",
    parentDirectoryId: "dir_literature_default",
    directoryType: "custom",
    fsPath: path.join(vaultPath, "notes", "literature", "moved-id-alias-targets")
  });
  await moveNoteToDirectory(vaultPath, "ln_id_alias_target", movedDirectory.id);

  await updateNoteContent(vaultPath, "ln_id_alias_source", {
    body: `# ID alias source\n\n${sourceBody}\n\nSaved after target rename and move.`
  });

  const sourceRelations = await listNoteRelations(vaultPath, "ln_id_alias_source");
  assert.equal(sourceRelations.outgoingLinks.length, 1);
  assert.equal(sourceRelations.outgoingLinks[0].toNoteId, "ln_id_alias_target");
  assert.equal(sourceRelations.outgoingLinks[0].target.title, "Renamed Stable Target");
  assert.equal(sourceRelations.outgoingLinks[0].rationale, "Manual association.");
});

test("directory graph heals stale edge titles before building insights", async () => {
  const vaultPath = await makeTempVault();
  await initVault(vaultPath);
  const staleDir = path.join(vaultPath, "notes", "literature", "stale-graph");
  const liveDir = path.join(vaultPath, "notes", "literature", "live-graph");
  await fs.mkdir(staleDir, { recursive: true });
  await fs.mkdir(liveDir, { recursive: true });
  const now = new Date().toISOString();

  const staleFrom = await writeLiteratureNoteIfAbsent(
    vaultPath,
    {
      id: "ln_graph_from",
      source_id: "src_graph_from",
      title: "Old graph from",
      quote_text: "Old graph source",
      paraphrase_text: "",
      status: "draft",
      created_at: now,
      updated_at: now
    },
    { directoryFsPath: staleDir }
  );
  await registerMarkdownNoteInCatalog(vaultPath, {
    noteId: "ln_graph_from",
    noteType: "literature",
    title: "Old graph from",
    status: "draft",
    markdownPath: path.relative(vaultPath, staleFrom.path).replaceAll("\\", "/"),
    directoryId: "dir_literature_default"
  });

  const staleTo = await writeLiteratureNoteIfAbsent(
    vaultPath,
    {
      id: "ln_graph_to",
      source_id: "src_graph_to",
      title: "Old graph to",
      quote_text: "Old graph target",
      paraphrase_text: "",
      status: "draft",
      created_at: now,
      updated_at: now
    },
    { directoryFsPath: staleDir }
  );
  await registerMarkdownNoteInCatalog(vaultPath, {
    noteId: "ln_graph_to",
    noteType: "literature",
    title: "Old graph to",
    status: "draft",
    markdownPath: path.relative(vaultPath, staleTo.path).replaceAll("\\", "/"),
    directoryId: "dir_literature_default"
  });

  await createNoteRelation(vaultPath, {
    fromNoteId: "ln_graph_from",
    toNoteId: "ln_graph_to",
    relationType: "supports",
    rationale: "This source-to-target relation should stay readable after healing.",
    status: "confirmed",
    createdBy: "user"
  });

  await fs.unlink(staleFrom.path);
  await fs.unlink(staleTo.path);

  await writeLiteratureNoteIfAbsent(
    vaultPath,
    {
      id: "ln_graph_from",
      source_id: "src_graph_from",
      title: "Live graph from",
      quote_text: "Live graph source",
      paraphrase_text: "",
      status: "active",
      created_at: now,
      updated_at: now
    },
    { directoryFsPath: liveDir }
  );
  await writeLiteratureNoteIfAbsent(
    vaultPath,
    {
      id: "ln_graph_to",
      source_id: "src_graph_to",
      title: "Live graph to",
      quote_text: "Live graph target",
      paraphrase_text: "",
      status: "active",
      created_at: now,
      updated_at: now
    },
    { directoryFsPath: liveDir }
  );

  const graph = await getDirectoryGraph(vaultPath, "dir_literature_default");
  assert.equal(graph.edges.length, 1);
  assert.equal(graph.edges[0].fromTitle, "Live graph from");
  assert.equal(graph.edges[0].toTitle, "Live graph to");
});

test("updateNoteContent edits the recovered markdown file when catalog path is stale", async () => {
  const vaultPath = await makeTempVault();
  await initVault(vaultPath);
  const staleDir = path.join(vaultPath, "notes", "literature", "stale-update");
  const liveDir = path.join(vaultPath, "notes", "literature", "live-update");
  await fs.mkdir(staleDir, { recursive: true });
  await fs.mkdir(liveDir, { recursive: true });
  const now = new Date().toISOString();

  const staleWrite = await writeLiteratureNoteIfAbsent(
    vaultPath,
    {
      id: "ln_update_heal",
      source_id: "src_update_heal",
      title: "Old update title",
      quote_text: "Old update body",
      paraphrase_text: "",
      status: "draft",
      created_at: now,
      updated_at: now
    },
    { directoryFsPath: staleDir }
  );
  await registerMarkdownNoteInCatalog(vaultPath, {
    noteId: "ln_update_heal",
    noteType: "literature",
    title: "Old update title",
    status: "draft",
    markdownPath: path.relative(vaultPath, staleWrite.path).replaceAll("\\", "/"),
    directoryId: "dir_literature_default"
  });
  await fs.unlink(staleWrite.path);

  const liveWrite = await writeLiteratureNoteIfAbsent(
    vaultPath,
    {
      id: "ln_update_heal",
      source_id: "src_update_heal",
      title: "Live update title",
      quote_text: "Live update body",
      paraphrase_text: "",
      status: "draft",
      created_at: now,
      updated_at: now
    },
    { directoryFsPath: liveDir }
  );

  const updated = await updateNoteContent(vaultPath, "ln_update_heal", {
    body: "# Updated live title\n\nUpdated live body"
  });
  assert.equal(updated.title, "Updated live title");
  assert.equal(updated.body, "# Updated live title\n\nUpdated live body\n");
  const updatedAbsPath = path.join(vaultPath, updated.markdownPath);
  const liveMarkdown = await fs.readFile(updatedAbsPath, "utf8");
  assert.match(liveMarkdown, /Updated live title/);
  assert.match(liveMarkdown, /Updated live body/);
  const catalogNote = await getNoteById(vaultPath, "ln_update_heal");
  assert.equal(catalogNote.title, "Updated live title");
  assert.equal(catalogNote.markdownPath, updated.markdownPath);
  await assert.rejects(() => fs.access(liveWrite.path));
});

test("moveNoteToDirectory relocates the recovered markdown file when catalog path is stale", async () => {
  const vaultPath = await makeTempVault();
  await initVault(vaultPath);
  const staleDir = path.join(vaultPath, "notes", "literature", "stale-move");
  const liveDir = path.join(vaultPath, "notes", "literature", "live-move");
  await fs.mkdir(staleDir, { recursive: true });
  await fs.mkdir(liveDir, { recursive: true });
  const targetDirectory = await createDirectory(vaultPath, {
    title: "Moved notes",
    parentDirectoryId: "dir_literature_default",
    fsPath: path.join(vaultPath, "notes", "literature", "moved-notes")
  });
  const now = new Date().toISOString();

  const staleWrite = await writeLiteratureNoteIfAbsent(
    vaultPath,
    {
      id: "ln_move_heal",
      source_id: "src_move_heal",
      title: "Move heal title",
      quote_text: "Move heal body",
      paraphrase_text: "",
      status: "draft",
      created_at: now,
      updated_at: now
    },
    { directoryFsPath: staleDir }
  );
  await registerMarkdownNoteInCatalog(vaultPath, {
    noteId: "ln_move_heal",
    noteType: "literature",
    title: "Move heal title",
    status: "draft",
    markdownPath: path.relative(vaultPath, staleWrite.path).replaceAll("\\", "/"),
    directoryId: "dir_literature_default"
  });
  await fs.unlink(staleWrite.path);

  const liveWrite = await writeLiteratureNoteIfAbsent(
    vaultPath,
    {
      id: "ln_move_heal",
      source_id: "src_move_heal",
      title: "Move heal title",
      quote_text: "Move heal body",
      paraphrase_text: "",
      status: "draft",
      created_at: now,
      updated_at: now
    },
    { directoryFsPath: liveDir }
  );

  const moved = await moveNoteToDirectory(vaultPath, "ln_move_heal", targetDirectory.id);
  assert.equal(moved.directoryId, targetDirectory.id);
  const expectedMovedPath = path.join(vaultPath, moved.markdownPath);
  const movedMarkdown = await fs.readFile(expectedMovedPath, "utf8");
  assert.match(movedMarkdown, /Move heal title/);
  await assert.rejects(() => fs.access(liveWrite.path));
  const catalogNote = await getNoteById(vaultPath, "ln_move_heal");
  assert.equal(catalogNote.directoryId, targetDirectory.id);
  assert.equal(catalogNote.markdownPath, moved.markdownPath);
});

test("deleteNoteById removes the recovered markdown file when catalog path is stale", async () => {
  const vaultPath = await makeTempVault();
  await initVault(vaultPath);
  const staleDir = path.join(vaultPath, "notes", "literature", "stale-delete");
  const liveDir = path.join(vaultPath, "notes", "literature", "live-delete");
  await fs.mkdir(staleDir, { recursive: true });
  await fs.mkdir(liveDir, { recursive: true });
  const now = new Date().toISOString();

  const staleWrite = await writeLiteratureNoteIfAbsent(
    vaultPath,
    {
      id: "ln_delete_heal",
      source_id: "src_delete_heal",
      title: "Delete heal title",
      quote_text: "Delete heal body",
      paraphrase_text: "",
      status: "draft",
      created_at: now,
      updated_at: now
    },
    { directoryFsPath: staleDir }
  );
  await registerMarkdownNoteInCatalog(vaultPath, {
    noteId: "ln_delete_heal",
    noteType: "literature",
    title: "Delete heal title",
    status: "draft",
    markdownPath: path.relative(vaultPath, staleWrite.path).replaceAll("\\", "/"),
    directoryId: "dir_literature_default"
  });
  await fs.unlink(staleWrite.path);

  const liveWrite = await writeLiteratureNoteIfAbsent(
    vaultPath,
    {
      id: "ln_delete_heal",
      source_id: "src_delete_heal",
      title: "Delete heal title",
      quote_text: "Delete heal body",
      paraphrase_text: "",
      status: "draft",
      created_at: now,
      updated_at: now
    },
    { directoryFsPath: liveDir }
  );

  const result = await deleteNoteById(vaultPath, "ln_delete_heal");
  assert.equal(result.deleted, true);
  await assert.rejects(() => fs.access(liveWrite.path));
  await assert.rejects(() => getNoteById(vaultPath, "ln_delete_heal"), /noteId not found/);
});

test("updateNoteContent recomputes originality through healed linked literature notes", async () => {
  const vaultPath = await makeTempVault();
  await initVault(vaultPath);
  const staleDir = path.join(vaultPath, "notes", "literature", "stale-originality");
  const liveDir = path.join(vaultPath, "notes", "literature", "live-originality");
  await fs.mkdir(staleDir, { recursive: true });
  await fs.mkdir(liveDir, { recursive: true });
  const now = new Date().toISOString();

  const staleLiterature = await writeLiteratureNoteIfAbsent(
    vaultPath,
    {
      id: "ln_originality_heal",
      source_id: "src_originality_heal",
      title: "Linked evidence",
      quote_text: "Quoted evidence that should still be reachable.",
      paraphrase_text: "",
      status: "draft",
      created_at: now,
      updated_at: now
    },
    { directoryFsPath: staleDir }
  );
  await registerMarkdownNoteInCatalog(vaultPath, {
    noteId: "ln_originality_heal",
    noteType: "literature",
    title: "Linked evidence",
    status: "draft",
    markdownPath: path.relative(vaultPath, staleLiterature.path).replaceAll("\\", "/"),
    directoryId: "dir_literature_default"
  });
  await fs.unlink(staleLiterature.path);

  const liveLiterature = await writeLiteratureNoteIfAbsent(
    vaultPath,
    {
      id: "ln_originality_heal",
      source_id: "src_originality_heal",
      title: "Linked evidence",
      quote_text: "Quoted evidence that should still be reachable.",
      paraphrase_text: "",
      status: "draft",
      created_at: now,
      updated_at: now
    },
    { directoryFsPath: liveDir }
  );

  const permanentWrite = await writePermanentNoteIfAbsent(vaultPath, {
    id: "pn_originality_heal",
    title: "Originality heal note",
    core_claim: "Initial distinct claim",
    rationale: "Initial rationale",
    authorship: { user_confirmed: true, ai_assisted: false },
    originality_status: "pass",
    status: "draft",
    created_at: now,
    updated_at: now
  });
  await registerMarkdownNoteInCatalog(vaultPath, {
    noteId: "pn_originality_heal",
    noteType: "permanent",
    title: "Originality heal note",
    status: "draft",
    markdownPath: path.relative(vaultPath, permanentWrite.path).replaceAll("\\", "/"),
    directoryId: "dir_original_default"
  });

  const updated = await updateNoteContent(vaultPath, "pn_originality_heal", {
    body: "# Distinct originality claim\n\nThis claim is distinct from the source and cites [[Linked evidence]].",
    status: "draft",
    authorship: { user_confirmed: true, ai_assisted: false }
  });

  assert.equal(updated.title, "Distinct originality claim");
  assert.match(updated.body, /Linked evidence/);
  const healedLiterature = await getNoteById(vaultPath, "ln_originality_heal");
  assert.equal(healedLiterature.markdownPath, path.relative(vaultPath, liveLiterature.path).replaceAll("\\", "/"));
});

test("confirmPermanentNoteDistillation writes the distilled viewpoint into the visible note body", async () => {
  const vaultPath = await makeTempVault();
  await initVault(vaultPath);
  const now = new Date().toISOString();
  const permanentWrite = await writePermanentNoteIfAbsent(vaultPath, {
    id: "pn_distillation_body",
    title: "Distillation body note",
    core_claim: "Original body stays below the distilled viewpoint.",
    rationale: "Rationale",
    authorship: { user_confirmed: false, ai_assisted: false },
    originality_status: "pass",
    status: "draft",
    created_at: now,
    updated_at: now
  });
  await registerMarkdownNoteInCatalog(vaultPath, {
    noteId: "pn_distillation_body",
    noteType: "permanent",
    title: "Distillation body note",
    status: "draft",
    markdownPath: path.relative(vaultPath, permanentWrite.path).replaceAll("\\", "/"),
    directoryId: "dir_original_default"
  });

  await updatePermanentNoteDistillation(vaultPath, "pn_distillation_body", {
    thesis: "Confirmed viewpoint should be visible in the note.",
    startingQuestion: "How should a saved viewpoint remain traceable?",
    threeLineSummary: ["It clarifies the claim.", "It keeps the original body.", "It supports later writing."],
    boundaryOrCounterpoint: "It should not replace the user's original prose."
  });
  const confirmed = await confirmPermanentNoteDistillation(vaultPath, "pn_distillation_body");

  assert.match(confirmed.body, /^# Distillation body note\n\n## 提炼观点/);
  assert.match(confirmed.body, /### 当前观点\n\nConfirmed viewpoint should be visible in the note\./);
  assert.match(confirmed.body, /1\. It clarifies the claim\.\n2\. It keeps the original body\.\n3\. It supports later writing\./);
  assert.match(confirmed.body, /### 边界\n\nIt should not replace the user's original prose\./);
  assert.match(confirmed.body, /Original body stays below the distilled viewpoint\./);
  assert.equal((confirmed.body.match(/## 提炼观点/g) || []).length, 1);

  await assert.rejects(
    updatePermanentNoteDistillation(vaultPath, "pn_distillation_body", {
      thesis: "Updated viewpoint replaces the old visible block."
    }),
    (error) => error?.code === "VIEWPOINT_CHANGE_REASON_REQUIRED"
  );
  await updatePermanentNoteDistillation(vaultPath, "pn_distillation_body", {
    thesis: "Updated viewpoint replaces the old visible block.",
    thesisChangeReason: "A counterexample changed the scope of the claim.",
    threeLineSummary: ["Updated one.", "Updated two.", "Updated three."],
    boundaryOrCounterpoint: ""
  });
  const reconfirmed = await confirmPermanentNoteDistillation(vaultPath, "pn_distillation_body");

  assert.match(reconfirmed.body, /Updated viewpoint replaces the old visible block\./);
  assert.doesNotMatch(reconfirmed.body, /Confirmed viewpoint should be visible in the note\./);
  assert.equal((reconfirmed.body.match(/## 提炼观点/g) || []).length, 1);
  assert.equal(reconfirmed.startingQuestion, "How should a saved viewpoint remain traceable?");
  assert.equal(reconfirmed.viewpointHistory.length, 1);
  assert.equal(reconfirmed.viewpointHistory[0].previousThesis, "Confirmed viewpoint should be visible in the note.");
  assert.equal(reconfirmed.viewpointHistory[0].reason, "A counterexample changed the scope of the claim.");
});

test("permanent note can confirm a current viewpoint without a three-line summary", async () => {
  const vaultPath = await makeTempVault();
  await initVault(vaultPath);
  const created = await createNoteInDirectory(vaultPath, {
    directoryId: "dir_original_default",
    id: "pn_viewpoint_only",
    title: "Viewpoint only",
    body: "# Viewpoint only\n\nOriginal note body.",
    originalityStatus: "pass",
    authorship: { user_confirmed: false, ai_assisted: false }
  });
  assert.equal(created.id, "pn_viewpoint_only");

  await updatePermanentNoteDistillation(vaultPath, created.id, {
    thesis: "A clear current viewpoint is enough to complete the first step.",
    startingQuestion: "What is the smallest useful first step?"
  });
  const confirmed = await confirmPermanentNoteDistillation(vaultPath, created.id);

  assert.equal(confirmed.distillationStatus, "confirmed");
  assert.deepEqual(confirmed.threeLineSummary, []);
  assert.match(confirmed.body, /### 当前观点/);
  assert.doesNotMatch(confirmed.body, /### 补充说明/);
});

test("AI viewpoint draft becomes history only after the user confirms the change", async () => {
  const vaultPath = await makeTempVault();
  await initVault(vaultPath);
  const created = await createNoteInDirectory(vaultPath, {
    directoryId: "dir_original_default",
    id: "pn_pending_viewpoint",
    title: "Pending viewpoint",
    body: "# Pending viewpoint\n\nOriginal body.",
    thesis: "Confirmed viewpoint"
  });

  const drafted = await updatePermanentNoteDistillation(vaultPath, created.id, {
    thesis: "AI draft viewpoint",
    thesisChangeReason: "Adopted as an AI draft.",
    viewpointChangeSourceNoteIds: ["source-1"],
    viewpointChangeStatus: "draft"
  });
  assert.deepEqual(drafted.viewpointHistory, []);
  assert.equal(drafted.pendingViewpointRevision.previousThesis, "Confirmed viewpoint");

  const committed = await updatePermanentNoteDistillation(vaultPath, created.id, {
    thesis: "AI draft viewpoint",
    thesisChangeReason: "The source provides a stronger counterexample.",
    viewpointChangeSourceNoteIds: ["source-1"],
    commitViewpointChange: true
  });
  assert.equal(committed.pendingViewpointRevision, null);
  assert.equal(committed.viewpointHistory.length, 1);
  assert.equal(committed.viewpointHistory[0].reason, "The source provides a stronger counterexample.");
  assert.deepEqual(committed.viewpointHistory[0].sourceNoteIds, ["source-1"]);
});

test("body wikilinks count as relations only while both notes are active", async () => {
  const vaultPath = await makeTempVault();
  await initVault(vaultPath);
  const target = await createNoteInDirectory(vaultPath, {
    directoryId: "dir_original_default",
    id: "pn_relation_target",
    title: "Relation target",
    body: "# Relation target\n\nTarget body.",
    thesis: "The target has a current viewpoint.",
    distillationStatus: "confirmed",
    authorship: { user_confirmed: true, ai_assisted: false }
  });
  const source = await createNoteInDirectory(vaultPath, {
    directoryId: "dir_original_default",
    id: "pn_relation_source",
    title: "Relation source",
    body: "# Relation source\n\nThis note links to [[Relation target]].",
    thesis: "A body link is a real relation.",
    distillationStatus: "confirmed",
    authorship: { user_confirmed: true, ai_assisted: false }
  });

  assert.equal((await getNoteById(vaultPath, source.id)).thinkingStatus.status, "ready_for_index");

  await deleteNoteById(vaultPath, target.id);
  assert.equal((await getNoteById(vaultPath, source.id)).thinkingStatus.status, "needs_relation");
});

test("title is derived from first markdown line when title field is absent", async () => {
  const vaultPath = await makeTempVault();
  const now = new Date().toISOString();

  await writePermanentNoteIfAbsent(vaultPath, {
    id: "pn_without_title",
    core_claim: "第一行作为标题\n这里是正文第二行",
    rationale: "Rationale",
    authorship: { user_confirmed: true, ai_assisted: false },
    originality_status: "pass",
    status: "draft",
    created_at: now,
    updated_at: now
  });

  const permanent = await readNote(vaultPath, "permanent", "pn_without_title");
  assert.equal(permanent.note.title, "第一行作为标题");
  assert.equal(permanent.note.body, "这里是正文第二行");
  assert.match(permanent.markdown, /^---[\s\S]*\n# 第一行作为标题\n\n这里是正文第二行$/);
});
