import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { SQLITE_DB_FILES } from "../packages/domain/src/index.mjs";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_VAULT_PATH = path.join(REPO_ROOT, "vault-example", "yansilu-vault");
const DEMO_DIRECTORY_ID = "dir_demo_smart_notes_product_thinking_original";
const DEMO_GUIDE_DIRECTORY_ID = "dir_demo_smart_notes_product_thinking_guide";
const DEMO_DIRECTORY_IDS = [DEMO_DIRECTORY_ID, DEMO_GUIDE_DIRECTORY_ID];
const DEMO_TAG = "Smart Notes Demo";
const DEMO_PROJECT_IDS = ["WRITE-SMART-NOTES-DEMO", "WRITE-RELATION-TO-WRITING-PRACTICE"];
const DEMO_NOTE_ID_GLOBS = ["FN-*", "LN-*", "PERM-*", "GUIDE-*", "ESSAY-*"];

function parseArgs(argv = process.argv.slice(2)) {
  const options = { vaultPath: DEFAULT_VAULT_PATH, apply: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--vault") {
      options.vaultPath = path.resolve(argv[index + 1] || "");
      index += 1;
    } else if (arg === "--apply") {
      options.apply = true;
    } else if (arg === "--help" || arg === "-h") {
      options.help = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return options;
}

function usage() {
  return [
    "Usage:",
    "  node scripts/reset-smart-notes-demo.mjs [--vault <vault-path>] [--apply]",
    "",
    "Without --apply, only prints the Demo data that would be removed."
  ].join("\n");
}

function placeholders(values = []) {
  return values.map(() => "?").join(", ");
}

function ids(rows = []) {
  return rows.map((row) => String(row?.id || "").trim()).filter(Boolean);
}

async function loadDatabaseSync() {
  const mod = await import("node:sqlite");
  return mod.DatabaseSync;
}

async function removeMarkdownFile(vaultPath, markdownPath = "") {
  const absolutePath = path.resolve(vaultPath, String(markdownPath || "").replaceAll("\\", "/"));
  const relativePath = path.relative(vaultPath, absolutePath);
  if (!markdownPath || relativePath.startsWith("..") || path.isAbsolute(relativePath)) return false;
  await fs.rm(absolutePath, { force: true });
  return true;
}

export async function resetSmartNotesDemo({ vaultPath = DEFAULT_VAULT_PATH, apply = false } = {}) {
  const resolvedVaultPath = path.resolve(vaultPath);
  const dbPath = path.join(resolvedVaultPath, ".yansilu", SQLITE_DB_FILES.catalog);
  const DatabaseSync = await loadDatabaseSync();
  const db = new DatabaseSync(dbPath);
  try {
    const demoNoteIdConditions = DEMO_NOTE_ID_GLOBS.map(() => "n.id GLOB ?").join(" OR ");
    const directorySlots = placeholders(DEMO_DIRECTORY_IDS);
    const demoNotes = db.prepare(
      `SELECT DISTINCT n.id, n.markdown_path
       FROM notes n
       LEFT JOIN note_tags nt ON nt.note_id = n.id
       LEFT JOIN tags t ON t.id = nt.tag_id
       LEFT JOIN note_directory_membership ndm ON ndm.note_id = n.id
       WHERE n.deleted_at IS NULL
         AND (t.name = ? OR ndm.directory_id IN (${directorySlots}) OR n.id = ? OR ${demoNoteIdConditions})`
    ).all(DEMO_TAG, ...DEMO_DIRECTORY_IDS, "SRC-SMART-NOTES", ...DEMO_NOTE_ID_GLOBS);
    const noteIds = ids(demoNotes);
    const demoIndexCards = db.prepare("SELECT id FROM index_cards WHERE directory_id = ?").all(DEMO_DIRECTORY_ID);
    const indexCardIds = ids(demoIndexCards);
    const demoProjects = db.prepare(
      `SELECT id FROM writing_projects WHERE id IN (${placeholders(DEMO_PROJECT_IDS)})`
    ).all(...DEMO_PROJECT_IDS);
    const projectIds = ids(demoProjects);
    const summary = {
      vaultPath: resolvedVaultPath,
      apply,
      notes: noteIds.length,
      indexCards: indexCardIds.length,
      writingProjects: projectIds.length,
      directories: db.prepare(`SELECT id FROM directories WHERE id IN (${directorySlots})`).all(...DEMO_DIRECTORY_IDS).length
    };
    if (!apply) return summary;

    db.exec("BEGIN IMMEDIATE;");
    try {
      if (noteIds.length) {
        const noteSlots = placeholders(noteIds);
        db.prepare(`DELETE FROM links WHERE from_note_id IN (${noteSlots}) OR to_note_id IN (${noteSlots})`).run(...noteIds, ...noteIds);
        db.prepare(`DELETE FROM index_items WHERE note_id IN (${noteSlots})`).run(...noteIds);
        db.prepare(`DELETE FROM writing_basket_items WHERE note_id IN (${noteSlots})`).run(...noteIds);
        db.prepare(`DELETE FROM draft_note_versions WHERE draft_note_id IN (${noteSlots})`).run(...noteIds);
        db.prepare(`UPDATE writing_projects SET draft_note_id = NULL WHERE draft_note_id IN (${noteSlots})`).run(...noteIds);
        db.prepare(`DELETE FROM note_tags WHERE note_id IN (${noteSlots})`).run(...noteIds);
        db.prepare(`DELETE FROM permanent_note_meta WHERE note_id IN (${noteSlots})`).run(...noteIds);
        db.prepare(`DELETE FROM literature_note_meta WHERE note_id IN (${noteSlots})`).run(...noteIds);
        db.prepare(`DELETE FROM fleeting_note_meta WHERE note_id IN (${noteSlots})`).run(...noteIds);
        db.prepare(`DELETE FROM note_directory_membership WHERE note_id IN (${noteSlots})`).run(...noteIds);
        db.prepare(`DELETE FROM notes WHERE id IN (${noteSlots})`).run(...noteIds);
      }
      if (indexCardIds.length) {
        const indexSlots = placeholders(indexCardIds);
        db.prepare(`DELETE FROM index_items WHERE index_id IN (${indexSlots})`).run(...indexCardIds);
        db.prepare(`DELETE FROM index_cards WHERE id IN (${indexSlots})`).run(...indexCardIds);
      }
      if (projectIds.length) {
        const projectSlots = placeholders(projectIds);
        db.prepare(`DELETE FROM draft_note_versions WHERE writing_project_id IN (${projectSlots})`).run(...projectIds);
        db.prepare(`DELETE FROM draft_scaffolds WHERE writing_project_id IN (${projectSlots})`).run(...projectIds);
        db.prepare(`DELETE FROM writing_basket_items WHERE project_id IN (${projectSlots})`).run(...projectIds);
        db.prepare(`DELETE FROM writing_projects WHERE id IN (${projectSlots})`).run(...projectIds);
      }
      db.prepare(`DELETE FROM directories WHERE id IN (${directorySlots})`).run(...DEMO_DIRECTORY_IDS);
      db.exec("COMMIT;");
    } catch (error) {
      db.exec("ROLLBACK;");
      throw error;
    }

    for (const note of demoNotes) await removeMarkdownFile(resolvedVaultPath, note.markdown_path);
    await fs.rm(path.join(resolvedVaultPath, "notes", "original", "demo-smart-notes-product-thinking"), { recursive: true, force: true });
    await fs.rm(path.join(resolvedVaultPath, "notes", "smart-notes-demo-guide"), { recursive: true, force: true });
    return { ...summary, deleted: true };
  } finally {
    db.close();
  }
}

async function main() {
  const options = parseArgs();
  if (options.help) {
    console.log(usage());
    return;
  }
  console.log(JSON.stringify(await resetSmartNotesDemo(options), null, 2));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
