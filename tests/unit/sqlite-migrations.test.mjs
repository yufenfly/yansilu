import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import fs from "node:fs/promises";
import os from "node:os";
import crypto from "node:crypto";
import { initVault, SQLITE_DB_FILES, applySqliteMigrations } from "../../packages/domain/src/index.mjs";

async function makeTempVault() {
  return fs.mkdtemp(path.join(os.tmpdir(), "yansilu-sqlite-"));
}

async function hasNodeSqlite() {
  try {
    await import("node:sqlite");
    return true;
  } catch {
    return false;
  }
}

test("applySqliteMigrations creates three database files when node:sqlite is available", async (t) => {
  if (!(await hasNodeSqlite())) {
    t.skip("node:sqlite is not available in current runtime");
    return;
  }

  const vaultPath = await makeTempVault();
  await initVault(vaultPath);

  const result = await applySqliteMigrations(vaultPath);
  assert.ok(result.catalogPath.endsWith(SQLITE_DB_FILES.catalog));
  assert.ok(result.graphCachePath.endsWith(SQLITE_DB_FILES.graphCache));
  assert.ok(result.vectorsPath.endsWith(SQLITE_DB_FILES.vectors));

  const files = [result.catalogPath, result.graphCachePath, result.vectorsPath];
  for (const filePath of files) {
    const stat = await fs.stat(filePath);
    assert.equal(stat.isFile(), true);
  }

  const { DatabaseSync } = await import("node:sqlite");
  const db = new DatabaseSync(result.catalogPath);
  try {
    const permanentColumns = db.prepare("PRAGMA table_info('permanent_note_meta')").all().map((row) => row.name);
    const indexCardColumns = db.prepare("PRAGMA table_info('index_cards')").all().map((row) => row.name);
    const projectColumns = db.prepare("PRAGMA table_info('writing_projects')").all().map((row) => row.name);
    const linkColumns = db.prepare("PRAGMA table_info('links')").all().map((row) => row.name);

    assert.equal(permanentColumns.includes("thesis"), true);
    assert.equal(permanentColumns.includes("three_line_summary_json"), true);
    assert.equal(permanentColumns.includes("distillation_status"), true);
    assert.equal(permanentColumns.includes("starting_question"), true);
    assert.equal(permanentColumns.includes("viewpoint_history_json"), true);
    assert.equal(permanentColumns.includes("pending_viewpoint_revision_json"), true);

    assert.equal(indexCardColumns.includes("thesis"), true);
    assert.equal(indexCardColumns.includes("three_line_summary_json"), true);
    assert.equal(indexCardColumns.includes("central_question"), true);

    assert.equal(projectColumns.includes("intent"), true);
    assert.equal(projectColumns.includes("desired_reader_takeaway"), true);

    assert.equal(linkColumns.includes("insight_question"), true);
    assert.equal(linkColumns.includes("status"), true);
    assert.equal(linkColumns.includes("updated_at"), true);
    assert.equal(linkColumns.includes("rationale_quality_score"), true);
    assert.equal(linkColumns.includes("rationale_quality_level"), true);
  } finally {
    db.close();
  }
});

test("applySqliteMigrations accepts legacy checksums for shipped databases", async (t) => {
  if (!(await hasNodeSqlite())) {
    t.skip("node:sqlite is not available in current runtime");
    return;
  }

  const vaultPath = await makeTempVault();
  await initVault(vaultPath);

  const { DatabaseSync } = await import("node:sqlite");
  const cases = [
    {
      dbFile: SQLITE_DB_FILES.catalog,
      migrationId: "001_catalog_v1_2",
      legacyChecksum: "7b7f6ae49be8ecd9bf681d3e97f7a2572f795a3f5f4b1868a6b0e83ee13c3e4b",
      sqlFile: "001_catalog_v1_2.sql"
    },
    {
      dbFile: SQLITE_DB_FILES.catalog,
      migrationId: "002_catalog_v1_3",
      legacyChecksum: "7699fd52c2ea0f0214be2fdb61ba04210d7153b0262f547b363e382851a6f266",
      sqlFile: "002_catalog_v1_3.sql"
    },
    {
      dbFile: SQLITE_DB_FILES.catalog,
      migrationId: "003_catalog_v1_4",
      legacyChecksum: "aa90f262cc5c896e88727a1cd14f1f86449106a92f90ae47510c7a77dc073566",
      sqlFile: "003_catalog_v1_4.sql"
    },
    {
      dbFile: SQLITE_DB_FILES.catalog,
      migrationId: "004_catalog_v1_5",
      legacyChecksum: "f7ae1d1ceebe3a3d6f04218bab60df3552e0656f840165ad17db83e2dc825295",
      sqlFile: "004_catalog_v1_5.sql"
    },
    {
      dbFile: SQLITE_DB_FILES.catalog,
      migrationId: "005_catalog_v1_6",
      legacyChecksum: "937a23655070b8b00ee93af19a74df08beeea90b21c8038caab5dd6959d4a5c1",
      sqlFile: "005_catalog_v1_6.sql"
    },
    {
      dbFile: SQLITE_DB_FILES.catalog,
      migrationId: "006_catalog_v1_7",
      legacyChecksum: "74d599f3f576c44ad258a09114c893b97fccd603eaa77c4f43b2a74d148699ab",
      sqlFile: "006_catalog_v1_7.sql"
    },
    {
      dbFile: SQLITE_DB_FILES.catalog,
      migrationId: "007_catalog_v1_8",
      legacyChecksum: "95642c88c3516d3092933ac2d16dcf61aa4d9a76f6df8f028576f389f185eb48",
      sqlFile: "007_catalog_v1_8.sql"
    },
    {
      dbFile: SQLITE_DB_FILES.catalog,
      migrationId: "008_catalog_v1_9",
      legacyChecksum: "c889a368f67e924eb7134e7895f971a868deec4deed2d3965f4d6394a0fd1904",
      sqlFile: "008_catalog_v1_9.sql"
    },
    {
      dbFile: SQLITE_DB_FILES.graphCache,
      migrationId: "001_graph_cache_v1_2",
      legacyChecksum: "9f5c1811883b7917e529cfa895d3c3640c5bc8c7c64027a007c5586721d53ddb",
      sqlFile: "001_graph_cache_v1_2.sql"
    },
    {
      dbFile: SQLITE_DB_FILES.vectors,
      migrationId: "001_vectors_v1_2",
      legacyChecksum: "a4e8a99048c075caba3dfbcc3fcbdffb1b6fb37c846375563a97113a5df5429f",
      sqlFile: "001_vectors_v1_2.sql"
    }
  ];

  for (const item of cases) {
    const dbPath = path.join(vaultPath, ".yansilu", item.dbFile);
    const db = new DatabaseSync(dbPath);
    try {
      db.prepare("UPDATE schema_migrations SET checksum = ? WHERE id = ?").run(item.legacyChecksum, item.migrationId);
    } finally {
      db.close();
    }
  }

  const result = await applySqliteMigrations(vaultPath);
  assert.ok(result.catalogPath.endsWith(SQLITE_DB_FILES.catalog));

  for (const item of cases) {
    const sql = await fs.readFile(path.resolve("packages/domain/src/sqlite", item.sqlFile), "utf8");
    const currentChecksum = crypto.createHash("sha256").update(sql).digest("hex");
    const dbPath = path.join(vaultPath, ".yansilu", item.dbFile);
    const verifyDb = new DatabaseSync(dbPath, { readonly: true });
    try {
      const row = verifyDb.prepare("SELECT checksum FROM schema_migrations WHERE id = ?").get(item.migrationId);
      assert.equal(row.checksum, item.legacyChecksum);
      if (item.legacyChecksum !== currentChecksum) {
        assert.notEqual(row.checksum, currentChecksum);
      }
    } finally {
      verifyDb.close();
    }
  }
});
