import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";

const DB_FILES = {
  catalog: "catalog.db",
  graphCache: "graph-cache.db",
  vectors: "vectors.db"
};

const MIGRATION_PLAN = {
  catalog: [
    { id: "001_catalog_v1_2", file: "001_catalog_v1_2.sql" },
    { id: "002_catalog_v1_3", file: "002_catalog_v1_3.sql" },
    { id: "003_catalog_v1_4", file: "003_catalog_v1_4.sql" },
    { id: "004_catalog_v1_5", file: "004_catalog_v1_5.sql" },
    { id: "005_catalog_v1_6", file: "005_catalog_v1_6.sql" },
    { id: "006_catalog_v1_7", file: "006_catalog_v1_7.sql" },
    { id: "007_catalog_v1_8", file: "007_catalog_v1_8.sql" },
    { id: "008_catalog_v1_9", file: "008_catalog_v1_9.sql" },
    { id: "009_catalog_v1_10", file: "009_catalog_v1_10.sql" },
    { id: "010_catalog_v1_11", file: "010_catalog_v1_11.sql" }
  ],
  graphCache: [{ id: "001_graph_cache_v1_2", file: "001_graph_cache_v1_2.sql" }],
  vectors: [{ id: "001_vectors_v1_2", file: "001_vectors_v1_2.sql" }]
};

const LEGACY_MIGRATION_CHECKSUMS = {
  // 001_catalog_v1_2 shipped before draft_scaffolds moved into later schema revisions.
  // Existing vaults may already record the original checksum, so we accept both.
  "001_catalog_v1_2": new Set(["7b7f6ae49be8ecd9bf681d3e97f7a2572f795a3f5f4b1868a6b0e83ee13c3e4b"]),
  "002_catalog_v1_3": new Set(["7699fd52c2ea0f0214be2fdb61ba04210d7153b0262f547b363e382851a6f266"]),
  "003_catalog_v1_4": new Set(["aa90f262cc5c896e88727a1cd14f1f86449106a92f90ae47510c7a77dc073566"]),
  "004_catalog_v1_5": new Set(["f7ae1d1ceebe3a3d6f04218bab60df3552e0656f840165ad17db83e2dc825295"]),
  "005_catalog_v1_6": new Set(["937a23655070b8b00ee93af19a74df08beeea90b21c8038caab5dd6959d4a5c1"]),
  "006_catalog_v1_7": new Set(["74d599f3f576c44ad258a09114c893b97fccd603eaa77c4f43b2a74d148699ab"]),
  "001_graph_cache_v1_2": new Set(["9f5c1811883b7917e529cfa895d3c3640c5bc8c7c64027a007c5586721d53ddb"]),
  "001_vectors_v1_2": new Set(["a4e8a99048c075caba3dfbcc3fcbdffb1b6fb37c846375563a97113a5df5429f"])
};

function normalizeSqlForChecksum(sql) {
  return String(sql ?? "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function hashSql(sql) {
  return createHash("sha256").update(normalizeSqlForChecksum(sql)).digest("hex");
}

function acceptedChecksumsForMigration(migrationId, sql) {
  const normalized = normalizeSqlForChecksum(sql);
  const accepted = new Set([
    createHash("sha256").update(normalized).digest("hex"),
    createHash("sha256").update(normalized.replace(/\n/g, "\r\n")).digest("hex")
  ]);
  const legacyChecksums = LEGACY_MIGRATION_CHECKSUMS[migrationId];
  if (legacyChecksums) {
    for (const checksum of legacyChecksums) accepted.add(checksum);
  }
  return accepted;
}

async function readMigrationSql(fileName) {
  const fileUrl = new URL(`./sqlite/${fileName}`, import.meta.url);
  return fs.readFile(fileUrl, "utf8");
}

async function loadDatabaseSync() {
  try {
    const mod = await import("node:sqlite");
    return mod.DatabaseSync;
  } catch {
    throw new Error(
      "SQLite migrations require node:sqlite (Node.js 22+). Current runtime does not provide it."
    );
  }
}

function ensureMigrationTable(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      checksum TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);
}

function hasMigration(db, id) {
  const row = db
    .prepare("SELECT id, checksum FROM schema_migrations WHERE id = ? LIMIT 1")
    .get(id);
  return row || null;
}

function applySingleMigration(db, migrationId, sql) {
  const checksum = hashSql(sql);
  const existing = hasMigration(db, migrationId);
  if (existing) {
    const acceptedChecksums = acceptedChecksumsForMigration(migrationId, sql);
    if (!acceptedChecksums.has(existing.checksum)) {
      throw new Error(`Migration checksum mismatch for ${migrationId}`);
    }
    return { id: migrationId, applied: false, skipped: true };
  }

  db.exec("BEGIN IMMEDIATE;");
  try {
    db.exec(sql);
    db.prepare(
      "INSERT INTO schema_migrations (id, checksum, applied_at) VALUES (?, ?, ?)"
    ).run(migrationId, checksum, new Date().toISOString());
    db.exec("COMMIT;");
    return { id: migrationId, applied: true, skipped: false };
  } catch (error) {
    db.exec("ROLLBACK;");
    throw error;
  }
}

async function applyPlanToDatabase(dbPath, plan) {
  const DatabaseSync = await loadDatabaseSync();
  const db = new DatabaseSync(dbPath);
  try {
    db.exec("PRAGMA journal_mode = WAL;");
    db.exec("PRAGMA foreign_keys = ON;");
    ensureMigrationTable(db);

    const results = [];
    for (const migration of plan) {
      const sql = await readMigrationSql(migration.file);
      const result = applySingleMigration(db, migration.id, sql);
      results.push(result);
    }
    return results;
  } finally {
    db.close();
  }
}

export async function applySqliteMigrations(vaultPath) {
  if (!vaultPath) throw new Error("vaultPath is required");

  const root = path.resolve(vaultPath);
  const metaDir = path.join(root, ".yansilu");
  await fs.mkdir(metaDir, { recursive: true });

  const catalogPath = path.join(metaDir, DB_FILES.catalog);
  const graphCachePath = path.join(metaDir, DB_FILES.graphCache);
  const vectorsPath = path.join(metaDir, DB_FILES.vectors);

  const [catalog, graphCache, vectors] = await Promise.all([
    applyPlanToDatabase(catalogPath, MIGRATION_PLAN.catalog),
    applyPlanToDatabase(graphCachePath, MIGRATION_PLAN.graphCache),
    applyPlanToDatabase(vectorsPath, MIGRATION_PLAN.vectors)
  ]);

  return {
    catalogPath,
    graphCachePath,
    vectorsPath,
    results: { catalog, graphCache, vectors }
  };
}

export const SQLITE_DB_FILES = DB_FILES;
