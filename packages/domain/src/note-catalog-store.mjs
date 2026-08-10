import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { SQLITE_DB_FILES } from "./sqlite-migrations.mjs";
import { listMarkdownFiles, writeMarkdownIfAbsent } from "./vault.mjs";
import { parseMarkdownWithFrontmatter, serializeMarkdownWithFrontmatter } from "./frontmatter.mjs";
import { relativeMarkdownLinkPath } from "./markdown-asset-links.mjs";
import { rewriteAssetLinksInMarkdownFile } from "./note-file-rewrite.mjs";
import { deriveNoteThinkingStatus } from "./thinking-status.mjs";
import { analyzePermanentNoteDistillation } from "./quality-checks.mjs";
import { originalityGuard } from "../../originality-guard/src/index.mjs";

const QUICK_WIKILINK_ASSOCIATION_MARKER = "__yansilu_quick_wikilink_association__";

function isQuickWikilinkAssociationMarker(value) {
  return String(value || "").trim() === QUICK_WIKILINK_ASSOCIATION_MARKER;
}

function catalogDbPath(vaultPath) {
  return path.join(path.resolve(vaultPath), ".yansilu", SQLITE_DB_FILES.catalog);
}

async function loadDatabaseSync() {
  try {
    const mod = await import("node:sqlite");
    return mod.DatabaseSync;
  } catch {
    throw new Error("Note catalog store requires node:sqlite (Node.js 22+).");
  }
}

function sanitizeFileName(input) {
  const text = String(input || "").trim();
  const clean = text.replace(/[<>:"/\\|?*\x00-\x1f]/g, "_").replace(/\s+/g, " ").trim();
  return clean || "note";
}

const MIME_EXTENSION_MAP = new Map([
  ["image/png", ".png"],
  ["image/jpeg", ".jpg"],
  ["image/jpg", ".jpg"],
  ["image/gif", ".gif"],
  ["image/webp", ".webp"],
  ["image/svg+xml", ".svg"],
  ["image/bmp", ".bmp"],
  ["image/x-icon", ".ico"],
  ["application/pdf", ".pdf"],
  ["text/plain", ".txt"],
  ["text/markdown", ".md"]
]);

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function toTitleLine(raw) {
  return String(raw || "").replace(/^#+\s*/, "").replace(/\r?\n/g, " ").trim();
}

function fileStemFromTitle(title, fallbackStem = "note") {
  return sanitizeFileName(toTitleLine(title) || fallbackStem);
}

async function resolveUniqueMarkdownPath(directoryPath, title, options = {}) {
  const root = path.resolve(directoryPath);
  const fallbackStem = String(options.fallbackStem || "note").trim() || "note";
  const stem = fileStemFromTitle(title, fallbackStem);
  const excludePath = options.excludePath ? path.resolve(options.excludePath) : null;
  for (let index = 0; index < 10000; index += 1) {
    const suffix = index === 0 ? "" : ` ${index + 1}`;
    const candidate = path.join(root, `${stem}${suffix}.md`);
    if (excludePath && path.resolve(candidate) === excludePath) return candidate;
    if (!(await fileExists(candidate))) return candidate;
  }
  throw new Error(`Unable to allocate markdown file path for title: ${title}`);
}

async function createUniqueMarkdownFile(directoryPath, title, content, options = {}) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const candidate = await resolveUniqueMarkdownPath(directoryPath, title, options);
    const result = await writeMarkdownIfAbsent(candidate, content);
    if (result.written) return candidate;
  }
  throw new Error(`Unable to create markdown file for title: ${title}`);
}

function extensionFromAsset(fileName, mimeType, assetKind = "file") {
  const existing = path.extname(String(fileName || "").trim());
  if (existing) return existing.toLowerCase();
  const normalizedMime = String(mimeType || "").trim().toLowerCase();
  if (MIME_EXTENSION_MAP.has(normalizedMime)) return MIME_EXTENSION_MAP.get(normalizedMime);
  if (normalizedMime.startsWith("image/")) {
    const suffix = normalizedMime.slice("image/".length).replace(/[^a-z0-9]+/g, "");
    return `.${suffix || "img"}`;
  }
  return assetKind === "image" ? ".png" : ".bin";
}

function normalizeAssetKind(inputKind, fileName, mimeType) {
  const explicit = String(inputKind || "").trim().toLowerCase();
  if (explicit === "image" || explicit === "file") return explicit;
  if (String(mimeType || "").trim().toLowerCase().startsWith("image/")) return "image";
  const ext = path.extname(String(fileName || "").trim()).toLowerCase();
  if ([".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".bmp", ".ico"].includes(ext)) return "image";
  return "file";
}

function normalizeAssetFileName(fileName, mimeType, assetKind = "file") {
  const rawName = String(fileName || "").trim();
  const ext = extensionFromAsset(rawName, mimeType, assetKind);
  const withoutExt = rawName ? rawName.slice(0, rawName.length - path.extname(rawName).length) : "";
  const fallbackStem = assetKind === "image" ? "image" : "attachment";
  return `${sanitizeFileName(withoutExt || fallbackStem)}${ext}`;
}

async function resolveUniqueAssetPath(directoryPath, fileName) {
  const root = path.resolve(directoryPath);
  const baseName = String(fileName || "").trim() || "asset.bin";
  const ext = path.extname(baseName);
  const stem = baseName.slice(0, baseName.length - ext.length) || "asset";
  for (let index = 0; index < 10000; index += 1) {
    const suffix = index === 0 ? "" : ` ${index + 1}`;
    const candidate = path.join(root, `${stem}${suffix}${ext}`);
    if (!(await fileExists(candidate))) return candidate;
  }
  throw new Error(`Unable to allocate asset file path for: ${fileName}`);
}

function normalizeMarkdown(inputTitle, inputBody) {
  const body = String(inputBody || "").replace(/\r\n/g, "\n").trim();
  const fallback = toTitleLine(inputTitle) || "Untitled note";
  if (!body) return { title: fallback, markdownBody: `# ${fallback}\n` };

  const lines = body.split("\n");
  const first = String(lines[0] || "").trim();
  const headingMatch = first.match(/^#{1,6}\s+(.+)$/);
  if (headingMatch) {
    return { title: toTitleLine(headingMatch[1]) || fallback, markdownBody: body.endsWith("\n") ? body : `${body}\n` };
  }

  const title = toTitleLine(first) || fallback;
  const rest = lines.slice(1).join("\n").replace(/^\n+/, "");
  const markdownBody = rest ? `# ${title}\n\n${rest}\n` : `# ${title}\n`;
  return { title, markdownBody };
}

function cleanDistillationBlockText(input) {
  return String(input || "").replace(/\r\n/g, "\n").replace(/\n+/g, " ").replace(/\s+/g, " ").trim();
}

function renderConfirmedDistillationSection(note = {}) {
  const thesis = cleanDistillationBlockText(note.thesis);
  const summary = Array.isArray(note.threeLineSummary) ? note.threeLineSummary.map(cleanDistillationBlockText).filter(Boolean).slice(0, 3) : [];
  const boundaryOrCounterpoint = cleanDistillationBlockText(note.boundaryOrCounterpoint);
  const lines = ["## 提炼观点", "", "### 当前观点", "", thesis];
  if (summary.length) {
    lines.push("", "### 补充说明", "");
    summary.forEach((item, index) => {
      lines.push(`${index + 1}. ${item}`);
    });
  }
  if (boundaryOrCounterpoint) {
    lines.push("", "### 边界", "", boundaryOrCounterpoint);
  }
  return lines.join("\n").trim();
}

function upsertConfirmedDistillationSection(markdownBody, note = {}) {
  const section = renderConfirmedDistillationSection(note);
  const source = String(markdownBody || "").replace(/\r\n/g, "\n").trim();
  const lines = source ? source.split("\n") : [];
  const existingStart = lines.findIndex((line) => /^##\s+提炼观点\s*$/.test(String(line || "").trim()));
  if (existingStart >= 0) {
    let existingEnd = lines.length;
    for (let index = existingStart + 1; index < lines.length; index += 1) {
      if (/^##\s+\S/.test(String(lines[index] || "").trim())) {
        existingEnd = index;
        break;
      }
    }
    const nextLines = [
      ...lines.slice(0, existingStart),
      ...section.split("\n"),
      "",
      ...lines.slice(existingEnd).filter((line, index) => index > 0 || String(line || "").trim())
    ];
    return `${nextLines.join("\n").replace(/\n{3,}/g, "\n\n").trim()}\n`;
  }

  const firstHeadingIndex = lines.findIndex((line) => /^#\s+\S/.test(String(line || "").trim()));
  if (firstHeadingIndex >= 0) {
    let insertIndex = firstHeadingIndex + 1;
    while (insertIndex < lines.length && !String(lines[insertIndex] || "").trim()) insertIndex += 1;
    const nextLines = [
      ...lines.slice(0, firstHeadingIndex + 1),
      "",
      ...section.split("\n"),
      "",
      ...lines.slice(insertIndex)
    ];
    return `${nextLines.join("\n").replace(/\n{3,}/g, "\n\n").trim()}\n`;
  }

  return `${section}\n\n${source}`.trim() + "\n";
}

function extractLiteratureSection(markdownBody, sectionLabels = []) {
  const labels = new Set(sectionLabels.map((label) => String(label || "").trim().toLowerCase()).filter(Boolean));
  if (labels.size === 0) return "";

  const lines = String(markdownBody || "").replace(/\r\n/g, "\n").split("\n");
  const collected = [];
  let inSection = false;

  for (const line of lines) {
    const headingMatch = line.match(/^#{2,6}\s+(.+?)\s*$/);
    if (headingMatch) {
      const heading = headingMatch[1].trim().toLowerCase();
      if (labels.has(heading)) {
        inSection = true;
        collected.length = 0;
        continue;
      }
      if (inSection) break;
    }
    if (inSection) collected.push(line);
  }

  return collected.join("\n").trim();
}

function literatureHasParaphrase(markdownBody) {
  const paraphrase = extractLiteratureSection(markdownBody, ["转述", "paraphrase"]);
  return normalizeOptionalText(paraphrase).length > 0;
}

function extractCoreClaimFromMarkdown(markdownBody) {
  const lines = String(markdownBody || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/^#+\s*/, "").trim())
    .filter(Boolean);
  return lines.join(" ").slice(0, 4000);
}

function noteValidationError(code, message, details = undefined) {
  const error = new Error(message);
  error.code = code;
  if (details) error.details = details;
  return error;
}

function assertLiteratureCompletionAllowed(noteType, status, markdownBody) {
  if (noteType !== "literature") return;
  if (String(status || "").trim().toLowerCase() !== "active") return;
  if (literatureHasParaphrase(markdownBody)) return;
  throw noteValidationError(
    "LITERATURE_PARAPHRASE_REQUIRED",
    "Literature notes require a paraphrase before they can be marked active.",
    {
      noteType,
      requestedStatus: String(status || "").trim().toLowerCase() || "draft",
      requirement: "paraphrase"
    }
  );
}

function normalizeOptionalText(value) {
  return String(value ?? "").trim();
}

function normalizeOptionalNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function boundaryValueFromInput(input = {}, fallback = "") {
  if (input.boundaryOrCounterpoint !== undefined) return normalizeOptionalText(input.boundaryOrCounterpoint);
  if (input.boundary_or_counterpoint !== undefined) return normalizeOptionalText(input.boundary_or_counterpoint);
  return normalizeOptionalText(fallback);
}

function normalizeOriginalityStatus(value, fallback = "warning") {
  const allowed = new Set(["pass", "warning", "blocked"]);
  const normalized = String(value || "").trim().toLowerCase();
  if (allowed.has(normalized)) return normalized;
  const fallbackValue = String(fallback || "").trim().toLowerCase();
  return allowed.has(fallbackValue) ? fallbackValue : "warning";
}

function normalizeBooleanFlag(value, fallback = false) {
  if (typeof value === "boolean") return value;
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  return Boolean(fallback);
}

function parseInlineJsonObject(value) {
  if (value && typeof value === "object" && !Array.isArray(value)) return value;
  const text = String(value || "").trim();
  if (!text.startsWith("{") || !text.endsWith("}")) return null;
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function parseInlineJsonArray(value) {
  if (Array.isArray(value)) return value;
  const text = String(value || "").trim();
  if (!text.startsWith("[") || !text.endsWith("]")) return null;
  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function normalizeAuthorshipInput(input, fallback = {}) {
  const source = (input && typeof input === "object" && !Array.isArray(input)) ? input : parseInlineJsonObject(input) || {};
  return {
    user_confirmed: normalizeBooleanFlag(source.user_confirmed, fallback.user_confirmed),
    ai_assisted: normalizeBooleanFlag(source.ai_assisted, fallback.ai_assisted)
  };
}

function normalizeStringArray(items, { exactLength = null } = {}) {
  const values = (Array.isArray(items) ? items : [])
    .map((item) => normalizeOptionalText(item))
    .filter(Boolean);
  if (exactLength !== null && values.length > 0 && values.length !== exactLength) {
    throw new Error(`Expected exactly ${exactLength} non-empty items.`);
  }
  return values;
}

function normalizeDistillationStatus(value, fallback = "missing") {
  const allowed = new Set(["missing", "draft", "confirmed"]);
  const normalized = String(value || "").trim().toLowerCase();
  if (allowed.has(normalized)) return normalized;
  const fallbackValue = String(fallback || "").trim().toLowerCase();
  return allowed.has(fallbackValue) ? fallbackValue : "missing";
}

function distillationFieldsFromFrontmatter(frontmatter = {}) {
  const thesis = normalizeOptionalText(frontmatter.thesis);
  const summaryInput = frontmatter.three_line_summary ?? frontmatter.threeLineSummary ?? parseInlineJsonArray(frontmatter.three_line_summary);
  const threeLineSummary = normalizeStringArray(summaryInput).slice(0, 3);
  const fallbackStatus = thesis || threeLineSummary.length ? "draft" : "missing";
  return {
    thesis,
    threeLineSummary,
    distillationStatus: normalizeDistillationStatus(frontmatter.distillation_status, fallbackStatus)
  };
}

function distillationFieldsFromInput(input = {}, fallbackFrontmatter = {}) {
  const fallback = distillationFieldsFromFrontmatter(fallbackFrontmatter);
  const thesisExplicit = input.thesis !== undefined;
  const summaryExplicit = input.threeLineSummary !== undefined || input.three_line_summary !== undefined;
  const statusExplicit = input.distillationStatus !== undefined || input.distillation_status !== undefined;
  const thesis = thesisExplicit ? normalizeOptionalText(input.thesis) : fallback.thesis;
  const summaryInput = summaryExplicit
    ? input.threeLineSummary ?? input.three_line_summary ?? parseInlineJsonArray(input.threeLineSummary)
    : fallback.threeLineSummary;
  const threeLineSummary = normalizeStringArray(summaryInput).slice(0, 3);
  const fallbackStatus = thesis || threeLineSummary.length ? "draft" : "missing";
  const distillationStatus = statusExplicit
    ? normalizeDistillationStatus(input.distillationStatus ?? input.distillation_status, fallbackStatus)
    : normalizeDistillationStatus(fallback.distillationStatus, fallbackStatus);
  return {
    thesis,
    threeLineSummary,
    distillationStatus
  };
}

function normalizeViewpointHistory(value) {
  const source = Array.isArray(value) ? value : parseInlineJsonArray(value) || [];
  return source
    .map((item) => {
      if (item && typeof item === "object" && !Array.isArray(item)) return item;
      try {
        const parsed = JSON.parse(String(item || ""));
        return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
      } catch {
        return null;
      }
    })
    .map((item) => ({
      previousThesis: normalizeOptionalText(item?.previousThesis ?? item?.previous_thesis),
      thesis: normalizeOptionalText(item?.thesis),
      reason: normalizeOptionalText(item?.reason),
      changedAt: normalizeOptionalText(item?.changedAt ?? item?.changed_at),
      sourceNoteIds: normalizeStringArray(item?.sourceNoteIds ?? item?.source_note_ids)
    }))
    .filter((item) => item.previousThesis && item.thesis && item.reason);
}

function normalizePendingViewpointRevision(value) {
  const source = parseInlineJsonObject(value);
  if (!source || typeof source !== "object" || Array.isArray(source)) return null;
  const previousThesis = normalizeOptionalText(source.previousThesis ?? source.previous_thesis);
  const thesis = normalizeOptionalText(source.thesis);
  if (!previousThesis || !thesis || previousThesis === thesis) return null;
  return {
    previousThesis,
    thesis,
    reason: normalizeOptionalText(source.reason),
    changedAt: normalizeOptionalText(source.changedAt ?? source.changed_at),
    sourceNoteIds: normalizeStringArray(source.sourceNoteIds ?? source.source_note_ids)
  };
}

function viewpointFieldsFromFrontmatter(frontmatter = {}) {
  return {
    startingQuestion: normalizeOptionalText(frontmatter.starting_question ?? frontmatter.startingQuestion),
    viewpointHistory: normalizeViewpointHistory(frontmatter.viewpoint_history ?? frontmatter.viewpointHistory),
    pendingViewpointRevision: normalizePendingViewpointRevision(
      frontmatter.pending_viewpoint_revision ?? frontmatter.pendingViewpointRevision
    )
  };
}

function viewpointFieldsFromInput(input = {}, fallbackFrontmatter = {}) {
  const fallback = viewpointFieldsFromFrontmatter(fallbackFrontmatter);
  const startingQuestion = input.startingQuestion !== undefined || input.starting_question !== undefined
    ? normalizeOptionalText(input.startingQuestion ?? input.starting_question)
    : fallback.startingQuestion;
  const currentThesis = normalizeOptionalText(fallbackFrontmatter.thesis);
  const nextThesis = input.thesis === undefined ? currentThesis : normalizeOptionalText(input.thesis);
  const changeReason = normalizeOptionalText(input.thesisChangeReason ?? input.thesis_change_reason);
  const sourceNoteIdsExplicit = input.viewpointChangeSourceNoteIds !== undefined || input.viewpoint_change_source_note_ids !== undefined;
  const sourceNoteIds = normalizeStringArray(input.viewpointChangeSourceNoteIds ?? input.viewpoint_change_source_note_ids);
  const changeStatus = normalizeOptionalText(input.viewpointChangeStatus ?? input.viewpoint_change_status).toLowerCase();
  const commitChange = input.commitViewpointChange === true || input.commit_viewpoint_change === true;
  const historyExplicit = input.viewpointHistory !== undefined || input.viewpoint_history !== undefined;
  const pendingExplicit = input.pendingViewpointRevision !== undefined || input.pending_viewpoint_revision !== undefined;
  const viewpointHistory = historyExplicit
    ? normalizeViewpointHistory(input.viewpointHistory ?? input.viewpoint_history)
    : [...fallback.viewpointHistory];
  let pendingViewpointRevision = pendingExplicit
    ? normalizePendingViewpointRevision(input.pendingViewpointRevision ?? input.pending_viewpoint_revision)
    : normalizePendingViewpointRevision(fallback.pendingViewpointRevision);

  if (!historyExplicit && commitChange && pendingViewpointRevision) {
    const previousThesis = pendingViewpointRevision.previousThesis;
    if (nextThesis === previousThesis) {
      pendingViewpointRevision = null;
    } else {
      if (!changeReason) {
        throw noteValidationError(
          "VIEWPOINT_CHANGE_REASON_REQUIRED",
          "当前观点发生变化时，需要说明这次为什么改变。",
          { previousThesis, thesis: nextThesis }
        );
      }
      viewpointHistory.push({
        previousThesis,
        thesis: nextThesis,
        reason: changeReason,
        changedAt: new Date().toISOString(),
        sourceNoteIds: sourceNoteIdsExplicit ? sourceNoteIds : pendingViewpointRevision.sourceNoteIds
      });
      pendingViewpointRevision = null;
    }
  } else if (!historyExplicit && currentThesis && nextThesis && currentThesis !== nextThesis) {
    if (!changeReason) {
      throw noteValidationError(
        "VIEWPOINT_CHANGE_REASON_REQUIRED",
        "当前观点发生变化时，需要说明这次为什么改变。",
        { previousThesis: currentThesis, thesis: nextThesis }
      );
    }
    const revision = {
      previousThesis: pendingViewpointRevision?.previousThesis || currentThesis,
      thesis: nextThesis,
      reason: changeReason,
      changedAt: new Date().toISOString(),
      sourceNoteIds
    };
    if (changeStatus === "draft") pendingViewpointRevision = revision;
    else viewpointHistory.push(revision);
  }
  return { startingQuestion, viewpointHistory, pendingViewpointRevision };
}

function inputRequestsConfirmedDistillation(input = {}) {
  const explicitValue = input.distillationStatus ?? input.distillation_status;
  return explicitValue !== undefined && normalizeDistillationStatus(explicitValue) === "confirmed";
}

function assertConfirmedDistillationAllowed(noteType, input = {}, permanentMeta = null) {
  if (noteType !== "permanent") return;
  if (!inputRequestsConfirmedDistillation(input)) return;
  if (permanentMeta?.authorship?.user_confirmed === true) return;
  throw noteValidationError(
    "PERMANENT_DISTILLATION_CONFIRMATION_REQUIRED",
    "Confirmed permanent-note distillation requires explicit user authorship confirmation.",
    {
      noteType,
      requestedDistillationStatus: "confirmed",
      requirement: "authorshipConfirmed"
    }
  );
}

function permanentMetadataFromFrontmatter(frontmatter = {}) {
  const authorship = normalizeAuthorshipInput(frontmatter.authorship, {
    user_confirmed: frontmatter.user_confirmed,
    ai_assisted: frontmatter.ai_assisted
  });
  const distillation = distillationFieldsFromFrontmatter(frontmatter);
  const viewpoint = viewpointFieldsFromFrontmatter(frontmatter);
  return {
    originalityStatus: normalizeOriginalityStatus(frontmatter.originality_status, "warning"),
    originalitySimilarity: normalizeOptionalNumber(frontmatter.originality_similarity),
    authorship,
    ...viewpoint,
    ...distillation
  };
}

function permanentMetadataFromInput(input = {}, fallbackFrontmatter = {}) {
  const fallbackMeta = permanentMetadataFromFrontmatter(fallbackFrontmatter);
  const distillation = distillationFieldsFromInput(input, fallbackFrontmatter);
  const viewpoint = viewpointFieldsFromInput(input, fallbackFrontmatter);
  return {
    originalityStatus: normalizeOriginalityStatus(
      input.originalityStatus ?? input.originality_status,
      fallbackMeta.originalityStatus
    ),
    originalitySimilarity:
      input.originalitySimilarity === undefined && input.originality_similarity === undefined
        ? fallbackMeta.originalitySimilarity
        : normalizeOptionalNumber(input.originalitySimilarity ?? input.originality_similarity),
    authorship: normalizeAuthorshipInput(input.authorship, {
      user_confirmed: input.authorshipConfirmed ?? fallbackMeta.authorship.user_confirmed,
      ai_assisted: input.authorshipAiAssisted ?? fallbackMeta.authorship.ai_assisted
    }),
    ...viewpoint,
    ...distillation
  };
}

function upsertPermanentNoteMeta(db, noteId, meta = {}, boundaryOrCounterpoint = "") {
  if (!db || !noteId || !meta) return;
  const authorship = meta.authorship || {};
  db.prepare(
    `INSERT INTO permanent_note_meta
     (note_id, core_claim, rationale, boundary_or_counterpoint, originality_status,
      originality_similarity, user_confirmed, ai_assisted, thesis,
      three_line_summary_json, distillation_status, starting_question, viewpoint_history_json,
      pending_viewpoint_revision_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(note_id) DO UPDATE SET
       core_claim = excluded.core_claim,
       rationale = excluded.rationale,
       boundary_or_counterpoint = excluded.boundary_or_counterpoint,
       originality_status = excluded.originality_status,
       originality_similarity = excluded.originality_similarity,
       user_confirmed = excluded.user_confirmed,
       ai_assisted = excluded.ai_assisted,
       thesis = excluded.thesis,
       three_line_summary_json = excluded.three_line_summary_json,
       distillation_status = excluded.distillation_status,
       starting_question = excluded.starting_question,
       viewpoint_history_json = excluded.viewpoint_history_json,
       pending_viewpoint_revision_json = excluded.pending_viewpoint_revision_json`
  ).run(
    noteId,
    String(meta.coreClaim || meta.core_claim || meta.thesis || "").trim(),
    String(meta.rationale || "").trim(),
    String(boundaryOrCounterpoint || meta.boundaryOrCounterpoint || meta.boundary_or_counterpoint || "").trim() || null,
    normalizeOriginalityStatus(meta.originalityStatus ?? meta.originality_status, "warning"),
    meta.originalitySimilarity ?? meta.originality_similarity ?? null,
    authorship.user_confirmed === true ? 1 : 0,
    authorship.ai_assisted === true ? 1 : 0,
    String(meta.thesis || "").trim() || null,
    JSON.stringify(Array.isArray(meta.threeLineSummary) ? meta.threeLineSummary : []),
    normalizeDistillationStatus(meta.distillationStatus ?? meta.distillation_status, "missing"),
    String(meta.startingQuestion || meta.starting_question || "").trim() || null,
    JSON.stringify(normalizeViewpointHistory(meta.viewpointHistory ?? meta.viewpoint_history)),
    JSON.stringify(normalizePendingViewpointRevision(meta.pendingViewpointRevision ?? meta.pending_viewpoint_revision))
  );
}

function noteTypeFromDirectoryType(directoryType) {
  if (directoryType === "source_default") return "source";
  if (directoryType === "fleeting_default") return "fleeting";
  if (directoryType === "literature_default") return "literature";
  if (directoryType === "original_default") return "permanent";
  return "";
}

function resolveNoteTypeFromDirectory(db, directoryId) {
  const rows = db
    .prepare(
      `WITH RECURSIVE directory_ancestry(id, parent_directory_id, directory_type) AS (
         SELECT id, parent_directory_id, directory_type
         FROM directories
         WHERE id = ?
         UNION ALL
         SELECT d.id, d.parent_directory_id, d.directory_type
         FROM directories d
         JOIN directory_ancestry ancestry ON ancestry.parent_directory_id = d.id
       )
       SELECT directory_type
       FROM directory_ancestry`
    )
    .all(directoryId);
  for (const row of rows) {
    const noteType = noteTypeFromDirectoryType(row.directory_type);
    if (noteType) return noteType;
  }
  return "permanent";
}

function makeNoteId(noteType) {
  const prefix =
    noteType === "source" ? "src" : noteType === "fleeting" ? "fn" : noteType === "literature" ? "ln" : "pn";
  return `${prefix}_${randomUUID().slice(0, 8)}`;
}

function defaultDirectoryIdForNoteType(noteType) {
  if (noteType === "source") return "dir_source_default";
  if (noteType === "fleeting") return "dir_fleeting_default";
  if (noteType === "literature") return "dir_literature_default";
  return "dir_original_default";
}

function normalizeTagName(input) {
  return String(input || "").trim().replace(/^#/, "");
}

function extractMarkdownTags(text) {
  const tags = new Set();
  const source = String(text || "");
  for (const match of source.matchAll(/(^|[\s([{])#([^\s#,[\]()`'"，。！？、；：.!?;:]+)/gu)) {
    const tag = normalizeTagName(match[2]);
    if (tag) tags.add(tag);
  }
  return [...tags];
}

function parseMarkdownWikilinkTargets(text) {
  const targets = new Set();
  const source = String(text || "");
  for (const match of source.matchAll(/(!)?\[\[([^\]]+)\]\]/g)) {
    const raw = String(match[2] || "").trim();
    if (!raw) continue;
    const [targetPart] = raw.split("|");
    const [pathAndHeading] = String(targetPart || "").split("^");
    const [targetRaw] = String(pathAndHeading || "").split("#");
    const target = String(targetRaw || "").trim();
    if (target) targets.add(target);
  }
  return [...targets];
}

function titleCandidatesForWikilinkTarget(target) {
  const normalized = String(target || "").trim().replaceAll("\\", "/");
  const baseName = path.basename(normalized);
  const withoutMarkdown = baseName.replace(/\.md$/i, "");
  return [...new Set([normalized, baseName, withoutMarkdown].filter(Boolean))];
}

function pathCandidatesForWikilinkTarget(target) {
  const normalized = String(target || "").trim().replaceAll("\\", "/").replace(/^\.?\//, "");
  if (!normalized) return [];
  if (!normalized.includes("/") && !/\.md$/i.test(normalized)) return [];
  const withExtension = /\.md$/i.test(normalized) ? normalized : `${normalized}.md`;
  return [...new Set([normalized, withExtension].filter(Boolean))];
}

function escapeSqlLikePattern(value) {
  return String(value || "").replace(/[\\%_]/g, (char) => `\\${char}`);
}

function mapNoteRow(row) {
  return {
    id: row.id,
    noteType: row.note_type,
    title: row.title,
    status: row.status,
    markdownPath: row.markdown_path,
    directoryId: row.directory_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

const NOTE_TYPE_MARKDOWN_DIRS = {
  source: path.join("notes", "sources"),
  literature: path.join("notes", "literature"),
  permanent: path.join("notes", "permanent")
};

function noteFilenameFromId(noteId) {
  const filename = String(noteId || "").trim().replace(/[^a-zA-Z0-9_-]/g, "_");
  if (!filename) throw new Error("noteId is required");
  return `${filename}.md`;
}

async function locateUniqueMarkdownPathForNote(vaultPath, noteType, noteId) {
  const typeDir = NOTE_TYPE_MARKDOWN_DIRS[String(noteType || "").trim()];
  if (!typeDir) return null;
  const root = path.join(path.resolve(vaultPath), typeDir);
  let files = [];
  try {
    files = await listMarkdownFiles(root);
  } catch {
    return null;
  }
  const filename = noteFilenameFromId(noteId);
  const matches = files
    .filter((filePath) => path.basename(filePath) === filename)
    .map((filePath) => path.resolve(filePath))
    .sort((a, b) => a.localeCompare(b));
  if (matches.length === 0) return null;
  if (matches.length > 1) {
    const error = new Error(`Multiple ${noteType} note files found for ${noteId}`);
    error.code = "NOTE_PATH_AMBIGUOUS";
    error.paths = matches;
    throw error;
  }
  return matches[0];
}

function isPathInside(basePath, candidatePath) {
  const rel = path.relative(path.resolve(basePath), path.resolve(candidatePath));
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}

function bestDirectoryForMarkdownPath(db, noteType, fallbackDirectoryId, markdownFullPath) {
  const rows = db.prepare("SELECT id, fs_path FROM directories").all();
  const matches = rows
    .filter((row) => row?.fs_path && isPathInside(row.fs_path, markdownFullPath))
    .sort((a, b) => String(b.fs_path || "").length - String(a.fs_path || "").length);
  if (matches.length > 0) {
    return {
      id: String(matches[0].id || "").trim(),
      fsPath: String(matches[0].fs_path || "").trim() || null
    };
  }
  const fallbackId = String(fallbackDirectoryId || "").trim() || defaultDirectoryIdForNoteType(noteType);
  const fallbackRow = rows.find((row) => String(row?.id || "").trim() === fallbackId);
  return {
    id: fallbackId,
    fsPath: String(fallbackRow?.fs_path || "").trim() || null
  };
}

function healedCatalogTitle(parsed, row) {
  const title = toTitleLine(parsed?.frontmatter?.title);
  return title || String(row?.title || row?.id || "Untitled").trim();
}

function healedCatalogStatus(parsed, row) {
  return String(parsed?.frontmatter?.status || row?.status || "draft").trim() || "draft";
}

async function recoverCatalogMarkdownPath(vaultPath, db, row) {
  const fullPath = await locateUniqueMarkdownPathForNote(vaultPath, row.note_type, row.id);
  if (!fullPath) return null;
  const markdownPath = path.relative(path.resolve(vaultPath), fullPath).replaceAll("\\", "/");
  const markdown = await fs.readFile(fullPath, "utf8");
  const parsed = parseMarkdownWithFrontmatter(markdown);
  const directory = bestDirectoryForMarkdownPath(db, row.note_type, row.directory_id, fullPath);
  const title = healedCatalogTitle(parsed, row);
  const status = healedCatalogStatus(parsed, row);
  const now = new Date().toISOString();
  db.exec("BEGIN IMMEDIATE;");
  try {
    db.prepare("UPDATE notes SET title = ?, status = ?, markdown_path = ?, updated_at = ? WHERE id = ?").run(
      title,
      status,
      markdownPath,
      now,
      row.id
    );
    ensureSingleDirectoryMembership(db, row.id, directory.id);
    syncMarkdownRelations(db, row.id, parsed.body);
    db.exec("COMMIT;");
  } catch (error) {
    db.exec("ROLLBACK;");
    throw error;
  }
  return {
    fullPath,
    markdownPath,
    directoryId: directory.id,
    directoryFsPath: directory.fsPath,
    title,
    status,
    markdown,
    parsed
  };
}

async function resolveCatalogRowState(vaultPath, db, row, options = {}) {
  const root = path.resolve(vaultPath);
  const hydrateMarkdown = options.hydrateMarkdown === true;
  const tolerateMissing = options.tolerateMissing === true;

  async function loadFromRow(targetRow) {
    const markdownPath = String(targetRow?.markdown_path || "").trim();
    if (!markdownPath) {
      const error = new Error(`markdownPath missing for noteId: ${targetRow?.id || "unknown"}`);
      error.code = "MARKDOWN_PATH_MISSING";
      throw error;
    }
    const fullPath = path.join(root, markdownPath);
    if (!hydrateMarkdown) {
      await fs.access(fullPath);
      return { fullPath, markdown: null, parsed: null };
    }
    const markdown = await fs.readFile(fullPath, "utf8");
    return { fullPath, markdown, parsed: parseMarkdownWithFrontmatter(markdown) };
  }

  try {
    const loaded = await loadFromRow(row);
    return { row, ...loaded, recovered: false, missing: false };
  } catch (error) {
    if (String(error?.code || "").trim() !== "ENOENT") {
      if (tolerateMissing) return { row, fullPath: null, markdown: null, parsed: null, recovered: false, missing: true };
      throw error;
    }
    const recovered = await recoverCatalogMarkdownPath(vaultPath, db, row);
    if (!recovered) {
      if (tolerateMissing) return { row, fullPath: null, markdown: null, parsed: null, recovered: false, missing: true };
      throw error;
    }
    return {
      row: {
        ...row,
        title: recovered.title,
        status: recovered.status,
        markdown_path: recovered.markdownPath,
        directory_id: recovered.directoryId,
        directory_fs_path: recovered.directoryFsPath
      },
      fullPath: recovered.fullPath,
      markdown: hydrateMarkdown ? recovered.markdown : null,
      parsed: hydrateMarkdown ? recovered.parsed : null,
      recovered: true,
      missing: false
    };
  }
}

async function normalizeCatalogRows(vaultPath, db, rows = [], options = {}) {
  return Promise.all((Array.isArray(rows) ? rows : []).map((row) => resolveCatalogRowState(vaultPath, db, row, options)));
}

async function normalizeCatalogRowsForMetadata(vaultPath, db, rows = []) {
  const resolved = await normalizeCatalogRows(vaultPath, db, rows, { tolerateMissing: true });
  return resolved.map((item) => item.row);
}

async function healCatalogScope(vaultPath, db, options = {}) {
  const rootDirectoryId = String(options.rootDirectoryId || "").trim();
  const rows = rootDirectoryId
    ? db
        .prepare(
          `${directoryScopeClause("heal_scope")}
           SELECT n.id, n.note_type, n.title, n.status, n.markdown_path, n.created_at, n.updated_at,
                  ndm.directory_id, d.fs_path AS directory_fs_path
           FROM note_directory_membership ndm
           JOIN heal_scope ON heal_scope.id = ndm.directory_id
           JOIN notes n ON n.id = ndm.note_id
           LEFT JOIN directories d ON d.id = ndm.directory_id
           WHERE n.deleted_at IS NULL`
        )
        .all(rootDirectoryId)
    : db
        .prepare(
          `SELECT n.id, n.note_type, n.title, n.status, n.markdown_path, n.created_at, n.updated_at,
                  ndm.directory_id, d.fs_path AS directory_fs_path
           FROM notes n
           LEFT JOIN note_directory_membership ndm ON ndm.note_id = n.id
           LEFT JOIN directories d ON d.id = ndm.directory_id
           WHERE n.deleted_at IS NULL`
        )
        .all();
  await normalizeCatalogRowsForMetadata(vaultPath, db, rows);
}

function explicitRelationCountForNote(db, noteId) {
  if (!db || !noteId) return 0;
  const row = db.prepare(
    `SELECT COUNT(*) AS relation_count
     FROM links l
     JOIN notes from_note ON from_note.id = l.from_note_id
     JOIN notes to_note ON to_note.id = l.to_note_id
     WHERE (l.from_note_id = ? OR l.to_note_id = ?)
       AND from_note.deleted_at IS NULL
       AND to_note.deleted_at IS NULL
       AND COALESCE(l.status, 'confirmed') NOT IN ('dismissed', 'archived')`
  ).get(noteId, noteId);
  return Number(row?.relation_count || 0);
}

function explicitRelationCountsForNotes(db, noteIds = []) {
  const includedIds = new Set(noteIds.filter(Boolean));
  const counts = new Map([...includedIds].map((noteId) => [noteId, 0]));
  if (!db || includedIds.size === 0) return counts;
  const rows = db.prepare(
    `SELECT l.from_note_id, l.to_note_id
     FROM links l
     JOIN notes from_note ON from_note.id = l.from_note_id
     JOIN notes to_note ON to_note.id = l.to_note_id
     WHERE from_note.deleted_at IS NULL
       AND to_note.deleted_at IS NULL
       AND COALESCE(l.status, 'confirmed') NOT IN ('dismissed', 'archived')`
  ).all();
  for (const row of rows) {
    if (includedIds.has(row.from_note_id)) {
      counts.set(row.from_note_id, (counts.get(row.from_note_id) || 0) + 1);
    }
    if (row.to_note_id !== row.from_note_id && includedIds.has(row.to_note_id)) {
      counts.set(row.to_note_id, (counts.get(row.to_note_id) || 0) + 1);
    }
  }
  return counts;
}

function attachNoteThinkingStatus(note, db = null, knownExplicitRelationCount = null) {
  const explicitRelationCount = note?.noteType === "permanent"
    ? knownExplicitRelationCount ?? explicitRelationCountForNote(db, note.id)
    : 0;
  return {
    ...note,
    thinkingStatus: deriveNoteThinkingStatus({ ...note, explicitRelationCount })
  };
}

async function mapNoteRowsWithThinkingStatus(vaultPath, db, rows = []) {
  const resolvedRows = await normalizeCatalogRows(vaultPath, db, rows, {
    hydrateMarkdown: true,
    tolerateMissing: true
  });
  const explicitRelationCounts = explicitRelationCountsForNotes(
    db,
    resolvedRows.filter((item) => item.row.note_type === "permanent").map((item) => item.row.id)
  );
  return resolvedRows.map((item) => {
    const note = mapNoteRow(item.row);
    const explicitRelationCount = explicitRelationCounts.get(note.id) || 0;
    if (!["permanent", "literature"].includes(note.noteType) || !item.parsed) {
      return attachNoteThinkingStatus(note, db, explicitRelationCount);
    }
    const boundaryOrCounterpoint = boundaryValueFromInput(item.parsed.frontmatter || {});
    const permanentMeta = item.row.note_type === "permanent" ? permanentMetadataFromFrontmatter(item.parsed.frontmatter || {}) : null;
    return attachNoteThinkingStatus({
      ...note,
      body: item.parsed.body,
      ...(permanentMeta
        ? {
            thesis: permanentMeta.thesis,
            threeLineSummary: permanentMeta.threeLineSummary,
            distillationStatus: permanentMeta.distillationStatus,
            startingQuestion: permanentMeta.startingQuestion,
            viewpointHistory: permanentMeta.viewpointHistory,
            pendingViewpointRevision: permanentMeta.pendingViewpointRevision,
            authorship: permanentMeta.authorship
          }
        : {}),
      ...(boundaryOrCounterpoint ? { boundaryOrCounterpoint } : {})
    }, db, explicitRelationCount);
  });
}

const NOTE_SEARCH_RANKING_PRIORITY = [
  "exact_title",
  "exact_id",
  "title_prefix",
  "id_prefix",
  "title_contains",
  "path_prefix",
  "id_contains",
  "path_contains",
  "recent"
];

function noteSearchMatchKind(row, query) {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return "recent";
  const title = String(row?.title || "").trim().toLowerCase();
  const id = String(row?.id || "").trim().toLowerCase();
  const markdownPath = String(row?.markdown_path || row?.markdownPath || "").trim().toLowerCase();
  if (title === q) return "exact_title";
  if (id === q) return "exact_id";
  if (title.startsWith(q)) return "title_prefix";
  if (id.startsWith(q)) return "id_prefix";
  if (title.includes(q)) return "title_contains";
  if (markdownPath.startsWith(q)) return "path_prefix";
  if (id.includes(q)) return "id_contains";
  if (markdownPath.includes(q)) return "path_contains";
  return "recent";
}

function mapNoteSearchRow(row, query) {
  const item = mapNoteRow(row);
  const matchKind = noteSearchMatchKind(row, query);
  return {
    ...item,
    matchKind,
    rank: NOTE_SEARCH_RANKING_PRIORITY.indexOf(matchKind)
  };
}

function mapRelationLinkRow(row) {
  return {
    id: row.id,
    fromNoteId: row.from_note_id,
    toNoteId: row.to_note_id,
    relationType: row.relation_type,
    rationale: row.rationale,
    insightQuestion: isQuickWikilinkAssociationMarker(row.insight_question) ? null : row.insight_question || null,
    rationaleQualityScore: Number(row.rationale_quality_score || 0),
    rationaleQualityLevel: row.rationale_quality_level || "empty",
    createdBy: row.created_by,
    confidence: row.confidence,
    createdAt: row.created_at,
    status: row.status || "confirmed",
    updatedAt: row.updated_at || row.created_at,
    target: row.target_id
      ? {
          id: row.target_id,
          noteType: row.target_note_type,
          title: row.target_title,
          status: row.target_status,
          markdownPath: row.target_markdown_path
        }
      : null,
    source: row.source_id
      ? {
          id: row.source_id,
          noteType: row.source_note_type,
          title: row.source_title,
          status: row.source_status,
          markdownPath: row.source_markdown_path
        }
      : null
  };
}

async function normalizeRelationRowMetadata(vaultPath, db, row) {
  const nextRow = { ...row };
  if (row?.target_id) {
    const targetResolved = await resolveCatalogRowState(
      vaultPath,
      db,
      {
        id: row.target_id,
        note_type: row.target_note_type,
        title: row.target_title,
        status: row.target_status,
        markdown_path: row.target_markdown_path,
        directory_id: row.target_directory_id || null,
        directory_fs_path: row.target_directory_fs_path || null
      },
      { tolerateMissing: true }
    );
    nextRow.target_note_type = targetResolved.row.note_type;
    nextRow.target_title = targetResolved.row.title;
    nextRow.target_status = targetResolved.row.status;
    nextRow.target_markdown_path = targetResolved.row.markdown_path;
  }
  if (row?.source_id) {
    const sourceResolved = await resolveCatalogRowState(
      vaultPath,
      db,
      {
        id: row.source_id,
        note_type: row.source_note_type,
        title: row.source_title,
        status: row.source_status,
        markdown_path: row.source_markdown_path,
        directory_id: row.source_directory_id || null,
        directory_fs_path: row.source_directory_fs_path || null
      },
      { tolerateMissing: true }
    );
    nextRow.source_note_type = sourceResolved.row.note_type;
    nextRow.source_title = sourceResolved.row.title;
    nextRow.source_status = sourceResolved.row.status;
    nextRow.source_markdown_path = sourceResolved.row.markdown_path;
  }
  return nextRow;
}

async function mapRelationLinkRows(vaultPath, db, rows = []) {
  const normalized = [];
  for (const row of Array.isArray(rows) ? rows : []) {
    normalized.push(mapRelationLinkRow(await normalizeRelationRowMetadata(vaultPath, db, row)));
  }
  return normalized;
}

async function mapSingleRelationLinkRow(vaultPath, db, row) {
  if (!row) return null;
  return mapRelationLinkRow(await normalizeRelationRowMetadata(vaultPath, db, row));
}

async function normalizeGraphEdgeRowMetadata(vaultPath, db, row) {
  const nextRow = { ...row };
  if (row?.from_note_id) {
    const fromResolved = await resolveCatalogRowState(
      vaultPath,
      db,
      {
        id: row.from_note_id,
        note_type: row.from_note_type,
        title: row.from_title,
        status: row.from_status,
        markdown_path: row.from_markdown_path,
        directory_id: row.from_directory_id || null,
        directory_fs_path: row.from_directory_fs_path || null
      },
      { tolerateMissing: true }
    );
    nextRow.from_title = fromResolved.row.title;
  }
  if (row?.to_note_id) {
    const toResolved = await resolveCatalogRowState(
      vaultPath,
      db,
      {
        id: row.to_note_id,
        note_type: row.to_note_type,
        title: row.to_title,
        status: row.to_status,
        markdown_path: row.to_markdown_path,
        directory_id: row.to_directory_id || null,
        directory_fs_path: row.to_directory_fs_path || null
      },
      { tolerateMissing: true }
    );
    nextRow.to_title = toResolved.row.title;
  }
  return nextRow;
}

function mapGraphEdgeRow(row) {
  return {
    id: row.id,
    fromNoteId: row.from_note_id,
    toNoteId: row.to_note_id,
    fromTitle: row.from_title,
    toTitle: row.to_title,
    relationType: row.relation_type,
    rationale: row.rationale,
    insightQuestion: isQuickWikilinkAssociationMarker(row.insight_question) ? null : row.insight_question || null,
    rationaleQualityScore: Number(row.rationale_quality_score || 0),
    rationaleQualityLevel: row.rationale_quality_level || "empty",
    createdBy: row.created_by,
    confidence: row.confidence,
    createdAt: row.created_at,
    status: row.status || "confirmed",
    updatedAt: row.updated_at || row.created_at
  };
}

async function mapGraphEdgeRows(vaultPath, db, rows = []) {
  const normalized = [];
  for (const row of Array.isArray(rows) ? rows : []) {
    normalized.push(mapGraphEdgeRow(await normalizeGraphEdgeRowMetadata(vaultPath, db, row)));
  }
  return normalized;
}

const EXPLICIT_SUPPORT_RELATION_TYPES = new Set(["supports"]);
const EXPLICIT_CONFLICT_RELATION_TYPES = new Set(["contradicts"]);
const LINK_RELATION_TYPES = new Set([
  "supports",
  "related",
  "asks",
  "complements",
  "contrasts",
  "contradicts",
  "duplicates",
  "cites",
  "extends",
  "precedes",
  "follows",
  "qualifies",
  "example_of",
  "counterexample_to",
  "same_topic",
  "unexpected_connection",
  "bridges",
  "restates",
  "reframes",
  "appears_in_draft",
  "belongs_to_topic",
  "associated_with",
  "free_link"
]);
const LINK_CREATED_BY = new Set(["user", "ai_suggestion", "import"]);
const LINK_STATUSES = new Set(["suggested", "draft", "confirmed", "dismissed", "archived"]);
const RELATION_RATIONALE_QUALITY_LEVELS = new Set(["empty", "basic", "good", "strong"]);
const RELATION_RATIONALE_ACTION_PATTERN =
  /support|contradict|qualif|extend|bridge|reframe|example|counterexample|because|therefore|however|evidence|boundary|tension|conflict|支持|反驳|限定|补充|推进|前提|后续|例子|反例|桥接|重述|改写|因为|所以|但是|然而|边界|证据|张力|冲突/i;

function evaluateRelationRationaleQuality(rationale = "", insightQuestion = "") {
  const reason = String(rationale || "").trim();
  const question = String(insightQuestion || "").trim();
  const hasReason = reason.length >= 12;
  const namesRelationAction = RELATION_RATIONALE_ACTION_PATTERN.test(reason);
  const hasQuestion = question.length >= 8 && /[?？]/.test(question);
  const signalCount = [hasReason, namesRelationAction, hasQuestion].filter(Boolean).length;
  const score = Math.round((signalCount / 3) * 100) / 100;
  const level = signalCount >= 3 ? "strong" : signalCount === 2 ? "good" : signalCount === 1 ? "basic" : "empty";
  return { score, level };
}

function normalizeRelationType(value) {
  const relationType = String(value || "").trim().toLowerCase();
  if (!relationType) {
    throw noteValidationError("RELATION_TYPE_REQUIRED", "relationType is required.");
  }
  if (!LINK_RELATION_TYPES.has(relationType)) {
    throw noteValidationError("RELATION_TYPE_UNSUPPORTED", `Unsupported relationType: ${relationType}`, {
      relationType,
      supportedRelationTypes: [...LINK_RELATION_TYPES]
    });
  }
  return relationType;
}

function normalizeRelationStatus(value, createdBy = "user") {
  const status = String(value || (createdBy === "ai_suggestion" ? "suggested" : "confirmed")).trim().toLowerCase();
  if (!LINK_STATUSES.has(status)) {
    throw noteValidationError("RELATION_STATUS_UNSUPPORTED", `Unsupported relation status: ${status}`, {
      status,
      supportedStatuses: [...LINK_STATUSES]
    });
  }
  return status;
}

function normalizeRelationQualityLevels(value, fallback = ["empty", "basic"]) {
  const rawLevels = Array.isArray(value)
    ? value
    : String(value || "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
  const levels = rawLevels.length ? rawLevels : fallback;
  const normalized = [...new Set(levels.map((level) => String(level || "").trim().toLowerCase()).filter(Boolean))];
  const unsupported = normalized.filter((level) => !RELATION_RATIONALE_QUALITY_LEVELS.has(level));
  if (unsupported.length) {
    throw noteValidationError("RELATION_QUALITY_LEVEL_UNSUPPORTED", `Unsupported relation quality level: ${unsupported[0]}`, {
      qualityLevel: unsupported[0],
      supportedQualityLevels: [...RELATION_RATIONALE_QUALITY_LEVELS]
    });
  }
  return normalized.length ? normalized : fallback;
}

function normalizeRelationCreatedBy(value) {
  const createdBy = String(value || "user").trim().toLowerCase();
  if (!LINK_CREATED_BY.has(createdBy)) {
    throw noteValidationError("RELATION_CREATED_BY_UNSUPPORTED", `Unsupported relation createdBy: ${createdBy}`, {
      createdBy,
      supportedCreatedBy: [...LINK_CREATED_BY]
    });
  }
  return createdBy;
}

function normalizeRelationPayload(input = {}, options = {}) {
  const createdBy = normalizeRelationCreatedBy(input.createdBy ?? input.created_by);
  const status = normalizeRelationStatus(input.status, createdBy);
  if (createdBy === "ai_suggestion" && status === "confirmed") {
    throw noteValidationError(
      "RELATION_AI_CONFIRMATION_FORBIDDEN",
      "AI-suggested relations cannot be created as confirmed."
    );
  }

  const fromNoteId = String(options.fromNoteId || input.fromNoteId || input.from_note_id || "").trim();
  const toNoteId = String(input.toNoteId || input.to_note_id || "").trim();
  const relationType = normalizeRelationType(input.relationType ?? input.relation_type);
  const rationale = String(input.rationale || "").trim();
  const insightQuestion = String(input.insightQuestion ?? input.insight_question ?? "").trim();
  const confidenceInput = input.confidence;
  const confidence =
    confidenceInput === undefined || confidenceInput === null || confidenceInput === ""
      ? null
      : Math.max(0, Math.min(1, Number(confidenceInput)));

  if (!fromNoteId) throw noteValidationError("RELATION_FROM_NOTE_REQUIRED", "fromNoteId is required.");
  if (!toNoteId) throw noteValidationError("RELATION_TO_NOTE_REQUIRED", "toNoteId is required.");
  if (fromNoteId === toNoteId) {
    throw noteValidationError("RELATION_SELF_LINK_FORBIDDEN", "A note cannot relate to itself.", { fromNoteId, toNoteId });
  }
  if (!rationale) throw noteValidationError("RELATION_RATIONALE_REQUIRED", "rationale is required.");
  if (confidence !== null && !Number.isFinite(confidence)) {
    throw noteValidationError("RELATION_CONFIDENCE_INVALID", "confidence must be a number between 0 and 1.");
  }

  return {
    fromNoteId,
    toNoteId,
    relationType,
    rationale,
    insightQuestion: insightQuestion || null,
    createdBy,
    status,
    confidence,
    rationaleQuality: evaluateRelationRationaleQuality(rationale, insightQuestion)
  };
}

function getRelationByIdRow(db, relationId) {
  return db
    .prepare(
      `SELECT l.*, to_note.id AS target_id, to_note.note_type AS target_note_type, to_note.title AS target_title,
              to_note.status AS target_status, to_note.markdown_path AS target_markdown_path,
              target_member.directory_id AS target_directory_id, target_directory.fs_path AS target_directory_fs_path,
              from_note.id AS source_id, from_note.note_type AS source_note_type, from_note.title AS source_title,
              from_note.status AS source_status, from_note.markdown_path AS source_markdown_path,
              source_member.directory_id AS source_directory_id, source_directory.fs_path AS source_directory_fs_path
       FROM links l
       JOIN notes from_note ON from_note.id = l.from_note_id
       JOIN notes to_note ON to_note.id = l.to_note_id
       LEFT JOIN note_directory_membership source_member ON source_member.note_id = from_note.id
       LEFT JOIN directories source_directory ON source_directory.id = source_member.directory_id
       LEFT JOIN note_directory_membership target_member ON target_member.note_id = to_note.id
       LEFT JOIN directories target_directory ON target_directory.id = target_member.directory_id
       WHERE l.id = ? AND from_note.deleted_at IS NULL AND to_note.deleted_at IS NULL
       LIMIT 1`
    )
    .get(relationId);
}

function assertNoteExistsForRelation(db, noteId, label) {
  const row = db.prepare("SELECT id FROM notes WHERE id = ? AND deleted_at IS NULL LIMIT 1").get(noteId);
  if (!row) throw noteValidationError("RELATION_NOTE_NOT_FOUND", `${label} not found: ${noteId}`, { noteId, label });
}

function buildGraphInsights(nodes, edges) {
  const nodeById = new Map((nodes || []).map((node) => [node.id, node]));
  const supportingRelations = [];
  const conflictingRelations = [];
  const untypedRelations = [];

  for (const edge of edges || []) {
    const relationType = String(edge.relationType || "associated_with").trim().toLowerCase();
    const rationale = String(edge.rationale || "").trim().toLowerCase();

    if (EXPLICIT_SUPPORT_RELATION_TYPES.has(relationType)) {
      supportingRelations.push(edge);
      continue;
    }

    if (EXPLICIT_CONFLICT_RELATION_TYPES.has(relationType)) {
      conflictingRelations.push(edge);
      continue;
    }

    if (relationType === "associated_with" || (relationType === "free_link" && (!rationale || rationale === "markdown_wikilink"))) {
      untypedRelations.push(edge);
    }
  }

  const adjacency = new Map((nodes || []).map((node) => [node.id, new Set()]));
  for (const edge of edges || []) {
    if (!adjacency.has(edge.fromNoteId) || !adjacency.has(edge.toNoteId)) continue;
    adjacency.get(edge.fromNoteId).add(edge.toNoteId);
    adjacency.get(edge.toNoteId).add(edge.fromNoteId);
  }

  const visited = new Set();
  const components = [];
  for (const node of nodes || []) {
    if (!node?.id || visited.has(node.id)) continue;
    const queue = [node.id];
    const noteIds = [];
    visited.add(node.id);
    while (queue.length) {
      const currentId = queue.shift();
      noteIds.push(currentId);
      for (const neighborId of adjacency.get(currentId) || []) {
        if (visited.has(neighborId)) continue;
        visited.add(neighborId);
        queue.push(neighborId);
      }
    }
    components.push({
      noteIds,
      noteTitles: noteIds.map((id) => nodeById.get(id)?.title || id).filter(Boolean),
      size: noteIds.length
    });
  }

  components.sort((a, b) => b.size - a.size || a.noteTitles.join(" ").localeCompare(b.noteTitles.join(" ")));

  const bridgeGaps = [];
  const primaryComponent = components[0] || null;
  const totalNodes = (nodes || []).length;

  components.forEach((component, index) => {
    if (!component.noteIds.length) return;
    if (component.size === 1) {
      if (totalNodes <= 1) return;
      const onlyId = component.noteIds[0];
      const onlyTitle = component.noteTitles[0] || onlyId;
      bridgeGaps.push({
        id: `bridge_gap_isolated_${onlyId}`,
        gapType: "isolated_note",
        noteIds: [onlyId],
        noteTitles: [onlyTitle],
        rationale: "这条笔记暂时游离在当前目录图谱之外。",
        suggestedAction: "补一条中间判断，或建立一条能说清理由的关系，把它接回现有论证。"
      });
      return;
    }

    if (index > 0 && primaryComponent) {
      bridgeGaps.push({
        id: `bridge_gap_cluster_${index + 1}`,
        gapType: "disconnected_cluster",
        noteIds: component.noteIds,
        noteTitles: component.noteTitles,
        rationale: "这个聚集暂时没有接回当前目录的主星系。",
        suggestedAction: "补一条桥接笔记，或建立一条能把这个星系接回主结构的明确关系。",
        targetNoteIds: primaryComponent.noteIds,
        targetNoteTitles: primaryComponent.noteTitles
      });
    }
  });

  return {
    supportingRelations,
    conflictingRelations,
    untypedRelations,
    bridgeGaps,
    connectedComponentCount: components.length
  };
}

function ensureSingleDirectoryMembership(db, noteId, directoryId) {
  const existing = db
    .prepare("SELECT id FROM note_directory_membership WHERE note_id = ? AND directory_id = ? LIMIT 1")
    .get(noteId, directoryId);
  if (existing) {
    db.prepare("DELETE FROM note_directory_membership WHERE note_id = ? AND directory_id != ?").run(noteId, directoryId);
    return;
  }
  db.prepare("DELETE FROM note_directory_membership WHERE note_id = ?").run(noteId);
  db.prepare(`INSERT INTO note_directory_membership (id, note_id, directory_id, created_at) VALUES (?, ?, ?, ?)`).run(
    `ndm_${randomUUID().slice(0, 8)}`,
    noteId,
    directoryId,
    new Date().toISOString()
  );
}

function directoryScopeClause(scopeTable = "directory_scope") {
  return `WITH RECURSIVE ${scopeTable}(id) AS (
            SELECT id FROM directories WHERE id = ?
            UNION ALL
            SELECT d.id
            FROM directories d
            JOIN ${scopeTable} s ON d.parent_directory_id = s.id
          )`;
}

function findNoteByWikilinkTarget(db, target, excludeNoteId, options = {}) {
  const preferredNoteType = String(options.preferredNoteType || "").trim().toLowerCase();
  const uniqueRow = (rows = []) => {
    const byId = new Map((Array.isArray(rows) ? rows : []).map((row) => [row.id, row]));
    return byId.size === 1 ? [...byId.values()][0] : null;
  };
  const pathRowsForCandidate = (candidatePath, noteType = "") => {
    const likePattern = `%/${escapeSqlLikePattern(candidatePath)}`;
    return noteType
      ? db
          .prepare(
            `SELECT id, note_type, title, markdown_path
             FROM notes
             WHERE id != ? AND note_type = ? AND deleted_at IS NULL
               AND (REPLACE(markdown_path, '\\', '/') = ? OR REPLACE(markdown_path, '\\', '/') LIKE ? ESCAPE '\\')
             ORDER BY updated_at DESC`
          )
          .all(excludeNoteId, noteType, candidatePath, likePattern)
      : db
          .prepare(
            `SELECT id, note_type, title, markdown_path
             FROM notes
             WHERE id != ? AND deleted_at IS NULL
               AND (REPLACE(markdown_path, '\\', '/') = ? OR REPLACE(markdown_path, '\\', '/') LIKE ? ESCAPE '\\')
             ORDER BY updated_at DESC`
          )
          .all(excludeNoteId, candidatePath, likePattern);
  };
  const pathCandidates = pathCandidatesForWikilinkTarget(target);
  for (const candidatePath of pathCandidates) {
    if (preferredNoteType) {
      const preferredPathRows = pathRowsForCandidate(candidatePath, preferredNoteType);
      const preferredPathRow = uniqueRow(preferredPathRows);
      if (preferredPathRow) return preferredPathRow;
      if (preferredPathRows.length > 1) return null;
    }
    const pathRows = pathRowsForCandidate(candidatePath);
    const pathRow = uniqueRow(pathRows);
    if (pathRow) return pathRow;
    if (pathRows.length > 1) return null;
  }
  const idTarget = String(target || "").trim();
  if (idTarget) {
    const idRow = preferredNoteType
      ? db
          .prepare(
            `SELECT id, note_type, title, markdown_path
             FROM notes
             WHERE id = ? AND id != ? AND note_type = ? AND deleted_at IS NULL
             LIMIT 1`
          )
          .get(idTarget, excludeNoteId, preferredNoteType)
      : null;
    if (idRow) return idRow;
    const fallbackIdRow = db
      .prepare(
        `SELECT id, note_type, title, markdown_path
         FROM notes
         WHERE id = ? AND id != ? AND deleted_at IS NULL
         LIMIT 1`
      )
      .get(idTarget, excludeNoteId);
    if (fallbackIdRow) return fallbackIdRow;
  }
  for (const title of titleCandidatesForWikilinkTarget(target)) {
    if (preferredNoteType) {
      const preferredRows = db
        .prepare(
          `SELECT id, note_type, title, markdown_path
           FROM notes
           WHERE title = ? AND id != ? AND note_type = ? AND deleted_at IS NULL
           ORDER BY updated_at DESC
           LIMIT 2`
        )
        .all(title, excludeNoteId, preferredNoteType);
      const preferredRow = uniqueRow(preferredRows);
      if (preferredRow) return preferredRow;
      if (preferredRows.length > 1) return null;
    }
    const rows = db
      .prepare(
        `SELECT id, note_type, title, markdown_path
         FROM notes
         WHERE title = ? AND id != ? AND deleted_at IS NULL
         ORDER BY updated_at DESC
         LIMIT 2`
      )
      .all(title, excludeNoteId);
    const row = uniqueRow(rows);
    if (row) return row;
    if (rows.length > 1) return null;
  }
  return null;
}

async function evaluatePermanentOriginality(db, vaultPath, noteId, markdownBody) {
  const wikilinkTargets = parseMarkdownWikilinkTargets(markdownBody);
  const linkedLiterature = [];
  const seenNoteIds = new Set();
  for (const target of wikilinkTargets) {
    const linked = findNoteByWikilinkTarget(db, target, noteId || "", { preferredNoteType: "literature" });
    if (!linked || linked.note_type !== "literature" || seenNoteIds.has(linked.id)) continue;
    seenNoteIds.add(linked.id);
    linkedLiterature.push(linked);
  }

  if (!linkedLiterature.length) return null;

  const literature = [];
  for (const note of linkedLiterature) {
    const resolved = await resolveCatalogRowState(vaultPath, db, note, {
      hydrateMarkdown: true,
      tolerateMissing: true
    });
    if (!resolved.markdown || !resolved.parsed) continue;
    const parsed = resolved.parsed;
    literature.push({
      id: note.id,
      source_id: `src_from_${note.id}`,
      quote_text: normalizeOptionalText(extractLiteratureSection(parsed.body, ["原文", "original text", "originalText"]) || parsed.body || "")
    });
  }

  const result = originalityGuard(
    {
      literature,
      permanent: [
        {
          id: noteId || "pending_permanent_note",
          core_claim: extractCoreClaimFromMarkdown(markdownBody),
          citations: linkedLiterature.map((note) => ({ source_id: `src_from_${note.id}` }))
        }
      ]
    },
    { requireCitationLocator: false }
  );
  const evaluation = result?.evaluations?.[0] || null;
  return evaluation
    ? {
        status: evaluation.status,
        similarity: Number(evaluation.similarity || 0),
        reasons: Array.isArray(evaluation.reasons) ? evaluation.reasons : []
      }
    : null;
}

function resolvePermanentSaveStatus(requestedStatus, originality, authorship) {
  const wantsActive = String(requestedStatus || "").trim().toLowerCase() === "active";
  if (!wantsActive) return String(requestedStatus || "draft").trim() || "draft";
  if (originality?.status !== "pass") return "draft";
  if (!authorship?.user_confirmed) return "draft";
  return "active";
}

function syncMarkdownRelations(db, noteId, markdownBody) {
  const now = new Date().toISOString();
  const tags = extractMarkdownTags(markdownBody);
  const wikilinkTargets = parseMarkdownWikilinkTargets(markdownBody);
  const sourceNote = db.prepare("SELECT note_type FROM notes WHERE id = ? LIMIT 1").get(noteId);
  const preferredNoteType = String(sourceNote?.note_type || "").trim().toLowerCase();
  const linkedNotesById = new Map();
  const linkedNoteIds = new Set();
  const unresolved = [];

  for (const target of wikilinkTargets) {
    const linkedNote = findNoteByWikilinkTarget(db, target, noteId, { preferredNoteType });
    if (!linkedNote) {
      unresolved.push(target);
      continue;
    }
    linkedNotesById.set(linkedNote.id, linkedNote);
    linkedNoteIds.add(linkedNote.id);
  }

  db.prepare("DELETE FROM note_tags WHERE note_id = ? AND source = 'markdown_body'").run(noteId);
  for (const tagName of tags) {
    db.prepare("INSERT OR IGNORE INTO tags (id, name, created_at) VALUES (?, ?, ?)").run(
      `tag_${randomUUID().slice(0, 8)}`,
      tagName,
      now
    );
    const tag = db.prepare("SELECT id FROM tags WHERE name = ? LIMIT 1").get(tagName);
    db.prepare(
      `INSERT OR IGNORE INTO note_tags (id, note_id, tag_id, source, created_at)
       VALUES (?, ?, ?, 'markdown_body', ?)`
    ).run(`nt_${randomUUID().slice(0, 8)}`, noteId, tag.id, now);
  }

  db.prepare(
    "DELETE FROM links WHERE from_note_id = ? AND created_by = 'user' AND rationale = 'markdown_wikilink'"
  ).run(noteId);

  const quickAssociations = db
    .prepare(
      `SELECT id, to_note_id
       FROM links
       WHERE from_note_id = ? AND created_by = 'user' AND insight_question = ?`
    )
    .all(noteId, QUICK_WIKILINK_ASSOCIATION_MARKER);
  for (const relation of quickAssociations) {
    if (linkedNoteIds.has(relation.to_note_id)) continue;
    db.prepare("DELETE FROM links WHERE id = ?").run(relation.id);
  }

  for (const linkedNote of linkedNotesById.values()) {
    const existingRelation = db
      .prepare(
        `SELECT id
         FROM links
         WHERE (from_note_id = ? AND to_note_id = ?)
            OR (from_note_id = ? AND to_note_id = ?)
         LIMIT 1`
      )
      .get(noteId, linkedNote.id, linkedNote.id, noteId);
    if (existingRelation) continue;
    db.prepare(
      `INSERT OR IGNORE INTO links
       (id, from_note_id, to_note_id, relation_type, rationale, created_by, confidence, created_at, status, updated_at)
       VALUES (?, ?, ?, 'associated_with', 'markdown_wikilink', 'user', 1, ?, 'confirmed', ?)`
    ).run(`lnk_${randomUUID().slice(0, 8)}`, noteId, linkedNote.id, now, now);
  }

  return { tags, wikilinkTargets, unresolvedWikilinks: unresolved };
}

export async function createNoteInDirectory(vaultPath, input = {}) {
  if (!vaultPath) throw new Error("vaultPath is required");
  const directoryId = String(input.directoryId || "").trim();
  if (!directoryId) throw new Error("directoryId is required");

  const requestedStatus = String(input.status || "draft").trim() || "draft";
  const now = new Date().toISOString();
  const DatabaseSync = await loadDatabaseSync();
  const db = new DatabaseSync(catalogDbPath(vaultPath));
  try {
    const dir = db
      .prepare("SELECT id, directory_type, fs_path FROM directories WHERE id = ? LIMIT 1")
      .get(directoryId);
    if (!dir) throw new Error(`directoryId not found: ${directoryId}`);

    const noteType = resolveNoteTypeFromDirectory(db, directoryId);
    const normalized = normalizeMarkdown(input.title, input.body);
    assertLiteratureCompletionAllowed(noteType, requestedStatus, normalized.markdownBody);
    const noteId = String(input.id || makeNoteId(noteType));
    const boundaryOrCounterpoint = noteType === "permanent" ? boundaryValueFromInput(input) : "";
    const permanentMeta = noteType === "permanent" ? permanentMetadataFromInput(input, {}) : null;
    assertConfirmedDistillationAllowed(noteType, input, permanentMeta);
    let status = requestedStatus;
    if (noteType === "permanent") {
      const originality = await evaluatePermanentOriginality(db, vaultPath, noteId, normalized.markdownBody);
      if (originality) {
        permanentMeta.originalityStatus = originality.status;
        permanentMeta.originalitySimilarity = originality.similarity;
        if (originality.status === "blocked") {
          throw noteValidationError(
            "PERMANENT_ORIGINALITY_BLOCKED",
            "Permanent note save blocked: rewrite this note in your own words before saving.",
            {
              noteType,
              requestedStatus,
              originality
            }
          );
        }
      }
      status = resolvePermanentSaveStatus(
        status,
        originality || { status: permanentMeta.originalityStatus, similarity: permanentMeta.originalitySimilarity },
        permanentMeta.authorship
      );
    }
    const frontmatter = {
      id: noteId,
      note_type: noteType,
      title: normalized.title,
      status,
      created_at: now,
      updated_at: now
    };
    if (noteType === "permanent") {
      if (boundaryOrCounterpoint) frontmatter.boundary_or_counterpoint = boundaryOrCounterpoint;
      frontmatter.originality_status = permanentMeta.originalityStatus;
      if (permanentMeta.originalitySimilarity !== null) frontmatter.originality_similarity = permanentMeta.originalitySimilarity;
      frontmatter.authorship = permanentMeta.authorship;
      if (permanentMeta.thesis) frontmatter.thesis = permanentMeta.thesis;
      if (permanentMeta.threeLineSummary.length) frontmatter.three_line_summary = permanentMeta.threeLineSummary;
      if (permanentMeta.startingQuestion) frontmatter.starting_question = permanentMeta.startingQuestion;
      if (permanentMeta.viewpointHistory.length) {
        frontmatter.viewpoint_history = permanentMeta.viewpointHistory.map((item) => JSON.stringify(item));
      }
      if (permanentMeta.pendingViewpointRevision) {
        frontmatter.pending_viewpoint_revision = permanentMeta.pendingViewpointRevision;
      }
      if (permanentMeta.distillationStatus !== "missing" || permanentMeta.thesis || permanentMeta.threeLineSummary.length) {
        frontmatter.distillation_status = permanentMeta.distillationStatus;
      }
    }
    const markdown = serializeMarkdownWithFrontmatter(frontmatter, normalized.markdownBody);
    const absMarkdownPath = await createUniqueMarkdownFile(dir.fs_path, normalized.title, markdown, {
      fallbackStem: noteId
    });

    const relPath = path.relative(path.resolve(vaultPath), absMarkdownPath).replaceAll("\\", "/");
    db.exec("BEGIN IMMEDIATE;");
    try {
      db.prepare(
        `INSERT INTO notes (id, note_type, title, status, markdown_path, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(noteId, noteType, normalized.title, status, relPath, now, now);
      db.prepare(
        `INSERT INTO note_directory_membership (id, note_id, directory_id, created_at)
         VALUES (?, ?, ?, ?)`
      ).run(`ndm_${randomUUID().slice(0, 8)}`, noteId, directoryId, now);
      if (noteType === "permanent") {
        upsertPermanentNoteMeta(db, noteId, {
          ...permanentMeta,
          coreClaim: normalized.markdownBody,
          rationale: input.rationale || ""
        }, boundaryOrCounterpoint);
      }
      syncMarkdownRelations(db, noteId, normalized.markdownBody);
      db.exec("COMMIT;");
    } catch (error) {
      db.exec("ROLLBACK;");
      throw error;
    }

    return attachNoteThinkingStatus({
      id: noteId,
      noteType,
      title: normalized.title,
      status,
      directoryId,
      markdownPath: relPath,
      body: normalized.markdownBody,
      markdown,
      ...(noteType === "permanent"
        ? {
            thesis: permanentMeta.thesis,
            threeLineSummary: permanentMeta.threeLineSummary,
            distillationStatus: permanentMeta.distillationStatus,
            startingQuestion: permanentMeta.startingQuestion,
            viewpointHistory: permanentMeta.viewpointHistory,
            pendingViewpointRevision: permanentMeta.pendingViewpointRevision,
            originalityStatus: permanentMeta.originalityStatus,
            ...(permanentMeta.originalitySimilarity !== null
              ? { originalitySimilarity: permanentMeta.originalitySimilarity }
              : {}),
            authorship: permanentMeta.authorship
          }
        : {}),
      ...(boundaryOrCounterpoint ? { boundaryOrCounterpoint } : {}),
      createdAt: now,
      updatedAt: now
    }, db);
  } finally {
    db.close();
  }
}

export async function registerMarkdownNoteInCatalog(vaultPath, input = {}) {
  if (!vaultPath) throw new Error("vaultPath is required");
  const noteId = String(input.noteId || "").trim();
  if (!noteId) throw new Error("noteId is required");
  const noteType = String(input.noteType || "permanent").trim();
  const title = String(input.title || noteId).trim() || noteId;
  const status = String(input.status || "draft").trim() || "draft";
  const markdownPath = String(input.markdownPath || "").replaceAll("\\", "/").trim();
  if (!markdownPath) throw new Error("markdownPath is required");
  const directoryId = String(input.directoryId || defaultDirectoryIdForNoteType(noteType)).trim();
  const now = new Date().toISOString();

  const DatabaseSync = await loadDatabaseSync();
  const db = new DatabaseSync(catalogDbPath(vaultPath));
  try {
    const directory = db.prepare("SELECT id FROM directories WHERE id = ? LIMIT 1").get(directoryId);
    if (!directory) throw new Error(`directoryId not found: ${directoryId}`);

    db.exec("BEGIN IMMEDIATE;");
    try {
      db.prepare(
        `INSERT INTO notes (id, note_type, title, status, markdown_path, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           note_type = excluded.note_type,
           title = excluded.title,
           status = excluded.status,
           markdown_path = excluded.markdown_path,
           updated_at = excluded.updated_at,
           deleted_at = NULL`
      ).run(noteId, noteType, title, status, markdownPath, now, now);
      ensureSingleDirectoryMembership(db, noteId, directoryId);
      const absMarkdownPath = path.join(path.resolve(vaultPath), markdownPath);
      const markdown = await fs.readFile(absMarkdownPath, "utf8");
      const parsed = parseMarkdownWithFrontmatter(markdown);
      if (noteType === "permanent") {
        const permanentMeta = permanentMetadataFromFrontmatter(parsed.frontmatter || {});
        const boundaryOrCounterpoint = boundaryValueFromInput(parsed.frontmatter || {});
        upsertPermanentNoteMeta(db, noteId, {
          ...permanentMeta,
          coreClaim: parsed.body,
          rationale: input.rationale || ""
        }, boundaryOrCounterpoint);
      }
      syncMarkdownRelations(db, noteId, parsed.body);
      db.exec("COMMIT;");
    } catch (error) {
      db.exec("ROLLBACK;");
      throw error;
    }

    const row = db
      .prepare(
        `SELECT n.id, n.note_type, n.title, n.status, n.markdown_path, n.created_at, n.updated_at, ndm.directory_id
         FROM notes n
         LEFT JOIN note_directory_membership ndm ON ndm.note_id = n.id
         WHERE n.id = ?
         LIMIT 1`
      )
      .get(noteId);
    return mapNoteRow(row);
  } finally {
    db.close();
  }
}

export async function syncMarkdownNoteCatalogRelations(vaultPath, noteId) {
  if (!vaultPath) throw new Error("vaultPath is required");
  const id = String(noteId || "").trim();
  if (!id) throw new Error("noteId is required");

  const DatabaseSync = await loadDatabaseSync();
  const db = new DatabaseSync(catalogDbPath(vaultPath));
  try {
    const row = db.prepare("SELECT markdown_path FROM notes WHERE id = ? AND deleted_at IS NULL LIMIT 1").get(id);
    if (!row?.markdown_path) {
      const error = new Error(`noteId not found: ${id}`);
      error.code = "NOTE_NOT_FOUND";
      throw error;
    }

    const markdownPath = String(row.markdown_path || "").replaceAll("\\", "/").trim();
    const absMarkdownPath = path.join(path.resolve(vaultPath), markdownPath);
    const markdown = await fs.readFile(absMarkdownPath, "utf8");
    const parsed = parseMarkdownWithFrontmatter(markdown);

    db.exec("BEGIN IMMEDIATE;");
    try {
      const result = syncMarkdownRelations(db, id, parsed.body);
      db.exec("COMMIT;");
      return result;
    } catch (error) {
      db.exec("ROLLBACK;");
      throw error;
    }
  } finally {
    db.close();
  }
}

export async function listNotesInDirectory(vaultPath, directoryId) {
  if (!vaultPath) throw new Error("vaultPath is required");
  const id = String(directoryId || "").trim();
  if (!id) throw new Error("directoryId is required");
  const DatabaseSync = await loadDatabaseSync();
  const db = new DatabaseSync(catalogDbPath(vaultPath));
  try {
    const rows = db
      .prepare(
        `SELECT n.id, n.note_type, n.title, n.status, n.markdown_path, n.created_at, n.updated_at, ndm.directory_id
         FROM note_directory_membership ndm
         JOIN notes n ON n.id = ndm.note_id
         WHERE ndm.directory_id = ? AND n.deleted_at IS NULL
         ORDER BY n.updated_at DESC`
      )
      .all(id);
    return await mapNoteRowsWithThinkingStatus(vaultPath, db, rows);
  } finally {
    db.close();
  }
}

export async function listNotesInDirectoryScope(vaultPath, directoryId, options = {}) {
  if (!vaultPath) throw new Error("vaultPath is required");
  const id = String(directoryId || "").trim();
  if (!id) throw new Error("directoryId is required");
  const includeDescendants = options.includeDescendants !== false;
  const DatabaseSync = await loadDatabaseSync();
  const db = new DatabaseSync(catalogDbPath(vaultPath));
  try {
    const directory = db.prepare("SELECT id FROM directories WHERE id = ? LIMIT 1").get(id);
    if (!directory) throw new Error(`directoryId not found: ${id}`);

    const rows = includeDescendants
      ? db
          .prepare(
            `${directoryScopeClause("scope")}
             SELECT n.id, n.note_type, n.title, n.status, n.markdown_path, n.created_at, n.updated_at, ndm.directory_id
             FROM note_directory_membership ndm
             JOIN scope ON scope.id = ndm.directory_id
             JOIN notes n ON n.id = ndm.note_id
             WHERE n.deleted_at IS NULL
             ORDER BY lower(n.title), n.updated_at DESC`
          )
          .all(id)
      : db
          .prepare(
            `SELECT n.id, n.note_type, n.title, n.status, n.markdown_path, n.created_at, n.updated_at, ndm.directory_id
             FROM note_directory_membership ndm
             JOIN notes n ON n.id = ndm.note_id
             WHERE ndm.directory_id = ? AND n.deleted_at IS NULL
             ORDER BY lower(n.title), n.updated_at DESC`
          )
          .all(id);
    return await mapNoteRowsWithThinkingStatus(vaultPath, db, rows);
  } finally {
    db.close();
  }
}

function distillationQueueNote(note = {}) {
  const thesis = String(note.thesis || "").trim();
  const threeLineSummary = Array.isArray(note.threeLineSummary) ? note.threeLineSummary.filter((item) => String(item || "").trim()) : [];
  const status = String(note.distillationStatus || "").trim().toLowerCase();
  const effectiveStatus = status === "confirmed" ? "confirmed" : thesis || threeLineSummary.length ? "draft" : "missing";
  const missingThesis = !thesis;
  const missingThreeLineSummary = threeLineSummary.length !== 3;

  return {
    note: {
      id: note.id,
      noteType: note.noteType,
      title: note.title,
      status: note.status,
      directoryId: note.directoryId,
      markdownPath: note.markdownPath,
      thesis,
      threeLineSummary,
      distillationStatus: effectiveStatus,
      thinkingStatus: note.thinkingStatus || null,
      updatedAt: note.updatedAt,
      createdAt: note.createdAt
    },
    status: effectiveStatus,
    missingThesis,
    missingThreeLineSummary,
    qualityChecks: analyzePermanentNoteDistillation(note)
  };
}

export async function listDistillationQueue(vaultPath, input = {}) {
  const directoryId = String(input.directoryId || input.directory_id || "dir_original_default").trim();
  const includeDescendants = input.includeDescendants !== false && input.include_descendants !== false;
  const limit = Math.max(1, Math.min(200, Number(input.limit || 50) || 50));
  const statusFilter = String(input.status || "").trim().toLowerCase();
  const notes = await listNotesInDirectoryScope(vaultPath, directoryId, { includeDescendants });
  const permanentNotes = notes.filter((note) => String(note.noteType || "").trim().toLowerCase() === "permanent");
  const mapped = permanentNotes.map(distillationQueueNote);
  const filteredItems = statusFilter && statusFilter !== "all"
    ? mapped.filter((item) => item.status === statusFilter)
    : mapped;
  const allPendingThesis = mapped.filter((item) => item.missingThesis);
  const allPendingThreeLineSummary = mapped.filter((item) => item.missingThreeLineSummary);
  const allRecentConfirmed = mapped
    .filter((item) => item.status === "confirmed")
    .sort((a, b) => String(b.note.updatedAt || "").localeCompare(String(a.note.updatedAt || "")));
  const pendingThesis = allPendingThesis.slice(0, limit);
  const pendingThreeLineSummary = allPendingThreeLineSummary.slice(0, limit);
  const recentConfirmed = allRecentConfirmed.slice(0, limit);
  const readyForWriting = mapped.filter((item) => !item.missingThesis && !item.missingThreeLineSummary);

  return {
    directoryId,
    includeDescendants,
    counts: {
      permanentNotes: mapped.length,
      pendingThesis: allPendingThesis.length,
      pendingThreeLineSummary: allPendingThreeLineSummary.length,
      recentConfirmed: allRecentConfirmed.length,
      readyForWriting: readyForWriting.length,
      pendingTotal: new Set(
        [...allPendingThesis, ...allPendingThreeLineSummary].map((item) => item.note.id)
      ).size
    },
    pendingThesis,
    pendingThreeLineSummary,
    recentConfirmed,
    items: filteredItems
      .sort((a, b) => {
        const rank = { missing: 0, draft: 1, confirmed: 2 };
        return (rank[a.status] ?? 9) - (rank[b.status] ?? 9) || String(b.note.updatedAt || "").localeCompare(String(a.note.updatedAt || ""));
      })
      .slice(0, limit)
  };
}

export async function searchNotes(vaultPath, options = {}) {
  if (!vaultPath) throw new Error("vaultPath is required");
  const query = String(options.q || options.query || "").trim().toLowerCase();
  const rootDirectoryId = String(options.rootDirectoryId || options.directoryId || "").trim();
  const excludeNoteId = String(options.excludeNoteId || "").trim();
  const limit = Math.max(1, Math.min(100, Number(options.limit || 20) || 20));

  const DatabaseSync = await loadDatabaseSync();
  const db = new DatabaseSync(catalogDbPath(vaultPath));
  try {
    if (rootDirectoryId) {
      const directory = db.prepare("SELECT id FROM directories WHERE id = ? LIMIT 1").get(rootDirectoryId);
      if (!directory) throw new Error(`rootDirectoryId not found: ${rootDirectoryId}`);
    }
    await healCatalogScope(vaultPath, db, { rootDirectoryId });

    const matchClause =
      "(? = '' OR LOWER(n.title) LIKE '%' || ? || '%' OR LOWER(n.id) LIKE '%' || ? || '%' OR LOWER(n.markdown_path) LIKE '%' || ? || '%')";
    const orderClause = `CASE
        WHEN ? = '' THEN 8
        WHEN LOWER(n.title) = ? THEN 0
        WHEN LOWER(n.id) = ? THEN 1
        WHEN LOWER(n.title) LIKE ? || '%' THEN 2
        WHEN LOWER(n.id) LIKE ? || '%' THEN 3
        WHEN LOWER(n.title) LIKE '%' || ? || '%' THEN 4
        WHEN LOWER(n.markdown_path) LIKE ? || '%' THEN 5
        WHEN LOWER(n.id) LIKE '%' || ? || '%' THEN 6
        WHEN LOWER(n.markdown_path) LIKE '%' || ? || '%' THEN 7
        ELSE 8
      END,
      n.updated_at DESC,
      LOWER(n.title) ASC`;
    const queryArgs = [query, query, query, query, query, query, query, query, query, query, query, query, query];

    const rows = rootDirectoryId
      ? db
          .prepare(
            `${directoryScopeClause("scope")}
             SELECT n.id, n.note_type, n.title, n.status, n.markdown_path,
                    n.created_at, n.updated_at, ndm.directory_id
             FROM note_directory_membership ndm
             JOIN scope ON scope.id = ndm.directory_id
             JOIN notes n ON n.id = ndm.note_id
             WHERE n.deleted_at IS NULL
               AND (? = '' OR n.id != ?)
               AND ${matchClause}
             ORDER BY ${orderClause}
             LIMIT ?`
          )
          .all(rootDirectoryId, excludeNoteId, excludeNoteId, ...queryArgs, limit)
      : db
          .prepare(
            `SELECT n.id, n.note_type, n.title, n.status, n.markdown_path,
                    n.created_at, n.updated_at, ndm.directory_id
             FROM notes n
             LEFT JOIN note_directory_membership ndm ON ndm.note_id = n.id
             WHERE n.deleted_at IS NULL
               AND (? = '' OR n.id != ?)
               AND ${matchClause}
             ORDER BY ${orderClause}
             LIMIT ?`
          )
          .all(excludeNoteId, excludeNoteId, ...queryArgs, limit);

    const normalizedRows = await normalizeCatalogRowsForMetadata(vaultPath, db, rows);
    const items = normalizedRows.map((row) => mapNoteSearchRow(row, query));
    return {
      rootDirectoryId: rootDirectoryId || null,
      query,
      ranking: {
        method: "sqlite_catalog_note_search_v1",
        priority: NOTE_SEARCH_RANKING_PRIORITY
      },
      items,
      total: items.length
    };
  } finally {
    db.close();
  }
}

export async function getDirectoryGraph(vaultPath, directoryId, options = {}) {
  if (!vaultPath) throw new Error("vaultPath is required");
  const id = String(directoryId || "").trim();
  if (!id) throw new Error("directoryId is required");
  const includeDescendants = options.includeDescendants === true || String(options.includeDescendants || "") === "true";

  const DatabaseSync = await loadDatabaseSync();
  const db = new DatabaseSync(catalogDbPath(vaultPath));
  try {
    const directory = db.prepare("SELECT id, title FROM directories WHERE id = ? LIMIT 1").get(id);
    if (!directory) throw new Error(`directoryId not found: ${id}`);

    const nodeRows = includeDescendants
      ? db
          .prepare(
            `${directoryScopeClause("graph_scope")}
             SELECT n.id, n.note_type, n.title, n.status, n.markdown_path, n.created_at, n.updated_at, ndm.directory_id
             FROM note_directory_membership ndm
             JOIN graph_scope ON graph_scope.id = ndm.directory_id
             JOIN notes n ON n.id = ndm.note_id
             WHERE n.deleted_at IS NULL
             ORDER BY n.title ASC, n.updated_at DESC`
          )
          .all(id)
      : db
          .prepare(
            `SELECT n.id, n.note_type, n.title, n.status, n.markdown_path, n.created_at, n.updated_at, ndm.directory_id
             FROM note_directory_membership ndm
             JOIN notes n ON n.id = ndm.note_id
             WHERE ndm.directory_id = ? AND n.deleted_at IS NULL
             ORDER BY n.title ASC, n.updated_at DESC`
          )
          .all(id);
    const nodes = (await normalizeCatalogRowsForMetadata(vaultPath, db, nodeRows)).map(mapNoteRow);

    const edgeRows = includeDescendants
      ? db
          .prepare(
            `${directoryScopeClause("graph_scope")}
             SELECT l.id, l.from_note_id, l.to_note_id, l.relation_type, l.rationale, l.created_by,
                    l.insight_question, l.rationale_quality_score, l.rationale_quality_level,
                    l.confidence, l.status, l.created_at, l.updated_at,
                    from_note.note_type AS from_note_type, from_note.title AS from_title,
                    from_note.status AS from_status, from_note.markdown_path AS from_markdown_path,
                    from_member.directory_id AS from_directory_id, from_directory.fs_path AS from_directory_fs_path,
                    to_note.note_type AS to_note_type, to_note.title AS to_title,
                    to_note.status AS to_status, to_note.markdown_path AS to_markdown_path,
                    to_member.directory_id AS to_directory_id, to_directory.fs_path AS to_directory_fs_path
             FROM links l
             JOIN note_directory_membership from_member ON from_member.note_id = l.from_note_id
             JOIN note_directory_membership to_member ON to_member.note_id = l.to_note_id
             JOIN graph_scope from_scope ON from_scope.id = from_member.directory_id
             JOIN graph_scope to_scope ON to_scope.id = to_member.directory_id
             JOIN notes from_note ON from_note.id = l.from_note_id
             JOIN notes to_note ON to_note.id = l.to_note_id
             LEFT JOIN directories from_directory ON from_directory.id = from_member.directory_id
             LEFT JOIN directories to_directory ON to_directory.id = to_member.directory_id
             WHERE from_note.deleted_at IS NULL
               AND to_note.deleted_at IS NULL
               AND COALESCE(l.status, 'confirmed') NOT IN ('dismissed', 'archived')
             ORDER BY l.created_at DESC`
          )
          .all(id)
      : db
          .prepare(
            `SELECT l.id, l.from_note_id, l.to_note_id, l.relation_type, l.rationale, l.created_by,
                    l.insight_question, l.rationale_quality_score, l.rationale_quality_level,
                    l.confidence, l.status, l.created_at, l.updated_at,
                    from_note.note_type AS from_note_type, from_note.title AS from_title,
                    from_note.status AS from_status, from_note.markdown_path AS from_markdown_path,
                    from_member.directory_id AS from_directory_id, from_directory.fs_path AS from_directory_fs_path,
                    to_note.note_type AS to_note_type, to_note.title AS to_title,
                    to_note.status AS to_status, to_note.markdown_path AS to_markdown_path,
                    to_member.directory_id AS to_directory_id, to_directory.fs_path AS to_directory_fs_path
             FROM links l
             JOIN note_directory_membership from_member ON from_member.note_id = l.from_note_id
             JOIN note_directory_membership to_member ON to_member.note_id = l.to_note_id
             JOIN notes from_note ON from_note.id = l.from_note_id
             JOIN notes to_note ON to_note.id = l.to_note_id
             LEFT JOIN directories from_directory ON from_directory.id = from_member.directory_id
             LEFT JOIN directories to_directory ON to_directory.id = to_member.directory_id
             WHERE from_member.directory_id = ?
               AND to_member.directory_id = ?
               AND from_note.deleted_at IS NULL
               AND to_note.deleted_at IS NULL
               AND COALESCE(l.status, 'confirmed') NOT IN ('dismissed', 'archived')
             ORDER BY l.created_at DESC`
          )
          .all(id, id);

    const edges = await mapGraphEdgeRows(vaultPath, db, edgeRows);

    return {
      directoryId: id,
      directoryTitle: directory.title,
      includeDescendants,
      scope: includeDescendants ? "directory_tree" : "directory",
      nodes,
      edges,
      insights: buildGraphInsights(nodes, edges),
      totalNodes: nodes.length,
      totalEdges: edges.length
    };
  } finally {
    db.close();
  }
}

function relationReviewReason(relation) {
  const level = String(relation?.rationaleQualityLevel || "empty").trim().toLowerCase();
  if (level === "empty") return "missing_rationale";
  if (level === "basic") return "thin_rationale";
  return "needs_review";
}

function summarizeRelationReviewQueue(items) {
  const byQualityLevel = {};
  const byStatus = {};
  const byRelationType = {};
  for (const item of items) {
    const qualityLevel = String(item.rationaleQualityLevel || "empty").trim().toLowerCase();
    const status = String(item.status || "confirmed").trim().toLowerCase();
    const relationType = String(item.relationType || "associated_with").trim().toLowerCase();
    byQualityLevel[qualityLevel] = (byQualityLevel[qualityLevel] || 0) + 1;
    byStatus[status] = (byStatus[status] || 0) + 1;
    byRelationType[relationType] = (byRelationType[relationType] || 0) + 1;
  }
  return { byQualityLevel, byStatus, byRelationType };
}

export async function listRelationReviewQueue(vaultPath, options = {}) {
  if (!vaultPath) throw new Error("vaultPath is required");
  const directoryId = String(options.directoryId || "").trim();
  if (!directoryId) throw new Error("directoryId is required");
  const includeDescendants = options.includeDescendants === true || String(options.includeDescendants || "") === "true";
  const qualityLevels = normalizeRelationQualityLevels(options.qualityLevels ?? options.qualityLevel);
  const relationTypeInput = String(options.relationType || "all").trim().toLowerCase();
  const relationType = relationTypeInput && relationTypeInput !== "all" ? normalizeRelationType(relationTypeInput) : "all";
  const statusInput = String(options.status || "all").trim().toLowerCase();
  const status = statusInput && statusInput !== "all" ? normalizeRelationStatus(statusInput, "user") : "all";
  const limit = Math.max(1, Math.min(100, Number(options.limit || 20) || 20));

  const DatabaseSync = await loadDatabaseSync();
  const db = new DatabaseSync(catalogDbPath(vaultPath));
  try {
    const directory = db.prepare("SELECT id, title FROM directories WHERE id = ? LIMIT 1").get(directoryId);
    if (!directory) throw new Error(`directoryId not found: ${directoryId}`);

    const scopeClause = includeDescendants
      ? directoryScopeClause("scope")
      : "WITH scope(id) AS (SELECT id FROM directories WHERE id = ?)";
    const qualityPlaceholders = qualityLevels.map(() => "?").join(", ");
    const statusClause =
      status === "all" ? "AND COALESCE(l.status, 'confirmed') NOT IN ('dismissed', 'archived')" : "AND COALESCE(l.status, 'confirmed') = ?";
    const relationTypeClause = relationType === "all" ? "" : "AND l.relation_type = ?";
    const args = [directoryId, ...qualityLevels];
    if (status !== "all") args.push(status);
    if (relationType !== "all") args.push(relationType);
    args.push(limit);

    const rows = db
      .prepare(
        `${scopeClause}
         SELECT l.*,
                to_note.id AS target_id, to_note.note_type AS target_note_type, to_note.title AS target_title,
                to_note.status AS target_status, to_note.markdown_path AS target_markdown_path,
                to_member.directory_id AS target_directory_id, to_directory.fs_path AS target_directory_fs_path,
                from_note.id AS source_id, from_note.note_type AS source_note_type, from_note.title AS source_title,
                from_note.status AS source_status, from_note.markdown_path AS source_markdown_path,
                from_member.directory_id AS source_directory_id, from_directory.fs_path AS source_directory_fs_path
         FROM links l
         JOIN notes from_note ON from_note.id = l.from_note_id
         JOIN notes to_note ON to_note.id = l.to_note_id
         LEFT JOIN note_directory_membership from_member ON from_member.note_id = from_note.id
         LEFT JOIN directories from_directory ON from_directory.id = from_member.directory_id
         LEFT JOIN note_directory_membership to_member ON to_member.note_id = to_note.id
         LEFT JOIN directories to_directory ON to_directory.id = to_member.directory_id
         WHERE from_note.deleted_at IS NULL
           AND to_note.deleted_at IS NULL
           AND COALESCE(l.rationale_quality_level, 'empty') IN (${qualityPlaceholders})
           ${statusClause}
           ${relationTypeClause}
           AND (
             EXISTS (
               SELECT 1
               FROM note_directory_membership from_member
               JOIN scope ON scope.id = from_member.directory_id
               WHERE from_member.note_id = l.from_note_id
             )
             OR EXISTS (
               SELECT 1
               FROM note_directory_membership to_member
               JOIN scope ON scope.id = to_member.directory_id
               WHERE to_member.note_id = l.to_note_id
             )
           )
         ORDER BY
           CASE COALESCE(l.rationale_quality_level, 'empty')
             WHEN 'empty' THEN 0
             WHEN 'basic' THEN 1
             WHEN 'good' THEN 2
             WHEN 'strong' THEN 3
             ELSE 4
           END ASC,
           CASE COALESCE(l.status, 'confirmed')
             WHEN 'suggested' THEN 0
             WHEN 'draft' THEN 1
             WHEN 'confirmed' THEN 2
             ELSE 3
           END ASC,
           COALESCE(l.updated_at, l.created_at) ASC
         LIMIT ?`
      )
      .all(...args);

    const normalizedRelations = await mapRelationLinkRows(vaultPath, db, rows);
    const items = normalizedRelations.map((relation) => {
      const reviewReason = relationReviewReason(relation);
      return {
        ...relation,
        reviewReason,
        reviewPriority: reviewReason === "missing_rationale" ? 0 : reviewReason === "thin_rationale" ? 1 : 2
      };
    });

    return {
      directoryId,
      directoryTitle: directory.title,
      includeDescendants,
      qualityLevels,
      relationType,
      status,
      limit,
      total: items.length,
      items,
      summary: summarizeRelationReviewQueue(items)
    };
  } finally {
    db.close();
  }
}

export async function findNotePath(vaultPath, input = {}) {
  if (!vaultPath) throw new Error("vaultPath is required");
  const fromNoteId = String(input.fromNoteId || "").trim();
  const toNoteId = String(input.toNoteId || "").trim();
  if (!fromNoteId) throw new Error("fromNoteId is required");
  if (!toNoteId) throw new Error("toNoteId is required");
  const maxDepth = Math.max(1, Math.min(8, Number(input.maxDepth || 4)));
  const direction = String(input.direction || "outgoing").trim() === "any" ? "any" : "outgoing";
  const directoryId = String(input.directoryId || "").trim();

  const DatabaseSync = await loadDatabaseSync();
  const db = new DatabaseSync(catalogDbPath(vaultPath));
  try {
    const endpointRows = db
      .prepare(
        `SELECT id, note_type, title, status, markdown_path, created_at, updated_at, NULL AS directory_id
         FROM notes
         WHERE id IN (?, ?) AND deleted_at IS NULL`
      )
      .all(fromNoteId, toNoteId);
    const endpoints = (await normalizeCatalogRowsForMetadata(vaultPath, db, endpointRows)).map(mapNoteRow);
    if (!endpoints.find((note) => note.id === fromNoteId)) throw new Error(`fromNoteId not found: ${fromNoteId}`);
    if (!endpoints.find((note) => note.id === toNoteId)) throw new Error(`toNoteId not found: ${toNoteId}`);

    const edgeRows = directoryId
      ? db
          .prepare(
            `${directoryScopeClause("scope")}
             SELECT l.id, l.from_note_id, l.to_note_id, l.relation_type, l.rationale, l.created_by,
                    l.insight_question, l.rationale_quality_score, l.rationale_quality_level,
                    l.confidence, l.status, l.created_at, l.updated_at,
                    from_note.note_type AS from_note_type, from_note.title AS from_title,
                    from_note.status AS from_status, from_note.markdown_path AS from_markdown_path,
                    from_member.directory_id AS from_directory_id, from_directory.fs_path AS from_directory_fs_path,
                    to_note.note_type AS to_note_type, to_note.title AS to_title,
                    to_note.status AS to_status, to_note.markdown_path AS to_markdown_path,
                    to_member.directory_id AS to_directory_id, to_directory.fs_path AS to_directory_fs_path
             FROM links l
             JOIN notes from_note ON from_note.id = l.from_note_id
             JOIN notes to_note ON to_note.id = l.to_note_id
             JOIN note_directory_membership from_member ON from_member.note_id = l.from_note_id
             JOIN note_directory_membership to_member ON to_member.note_id = l.to_note_id
             JOIN scope from_scope ON from_scope.id = from_member.directory_id
             JOIN scope to_scope ON to_scope.id = to_member.directory_id
             LEFT JOIN directories from_directory ON from_directory.id = from_member.directory_id
             LEFT JOIN directories to_directory ON to_directory.id = to_member.directory_id
             WHERE from_note.deleted_at IS NULL AND to_note.deleted_at IS NULL
               AND COALESCE(l.status, 'confirmed') NOT IN ('dismissed', 'archived')`
          )
          .all(directoryId)
      : db
          .prepare(
            `SELECT l.id, l.from_note_id, l.to_note_id, l.relation_type, l.rationale, l.created_by,
                    l.insight_question, l.rationale_quality_score, l.rationale_quality_level,
                    l.confidence, l.status, l.created_at, l.updated_at,
                    from_note.note_type AS from_note_type, from_note.title AS from_title,
                    from_note.status AS from_status, from_note.markdown_path AS from_markdown_path,
                    from_member.directory_id AS from_directory_id, from_directory.fs_path AS from_directory_fs_path,
                    to_note.note_type AS to_note_type, to_note.title AS to_title,
                    to_note.status AS to_status, to_note.markdown_path AS to_markdown_path,
                    to_member.directory_id AS to_directory_id, to_directory.fs_path AS to_directory_fs_path
             FROM links l
             JOIN notes from_note ON from_note.id = l.from_note_id
             JOIN notes to_note ON to_note.id = l.to_note_id
             LEFT JOIN note_directory_membership from_member ON from_member.note_id = l.from_note_id
             LEFT JOIN directories from_directory ON from_directory.id = from_member.directory_id
             LEFT JOIN note_directory_membership to_member ON to_member.note_id = l.to_note_id
             LEFT JOIN directories to_directory ON to_directory.id = to_member.directory_id
             WHERE from_note.deleted_at IS NULL AND to_note.deleted_at IS NULL
               AND COALESCE(l.status, 'confirmed') NOT IN ('dismissed', 'archived')`
          )
          .all();

    const edges = await mapGraphEdgeRows(vaultPath, db, edgeRows);
    const adjacency = new Map();
    for (const edge of edges) {
      if (!adjacency.has(edge.fromNoteId)) adjacency.set(edge.fromNoteId, []);
      adjacency.get(edge.fromNoteId).push(edge);
      if (direction === "any") {
        if (!adjacency.has(edge.toNoteId)) adjacency.set(edge.toNoteId, []);
        adjacency.get(edge.toNoteId).push({ ...edge, fromNoteId: edge.toNoteId, toNoteId: edge.fromNoteId, reversed: true });
      }
    }

    const queue = [{ noteId: fromNoteId, pathEdges: [] }];
    const visited = new Set([fromNoteId]);
    let foundEdges = null;
    while (queue.length) {
      const current = queue.shift();
      if (current.noteId === toNoteId) {
        foundEdges = current.pathEdges;
        break;
      }
      if (current.pathEdges.length >= maxDepth) continue;
      for (const edge of adjacency.get(current.noteId) || []) {
        if (visited.has(edge.toNoteId)) continue;
        visited.add(edge.toNoteId);
        queue.push({ noteId: edge.toNoteId, pathEdges: [...current.pathEdges, edge] });
      }
    }

    const pathNoteIds = foundEdges
      ? [fromNoteId, ...foundEdges.map((edge) => edge.toNoteId)]
      : [];
    const pathNodeRows = pathNoteIds.length
      ? db
          .prepare(
            `SELECT n.id, n.note_type, n.title, n.status, n.markdown_path, n.created_at, n.updated_at, ndm.directory_id
             FROM notes n
             LEFT JOIN note_directory_membership ndm ON ndm.note_id = n.id
             WHERE n.id IN (${pathNoteIds.map(() => "?").join(",")}) AND n.deleted_at IS NULL`
          )
          .all(...pathNoteIds)
      : [];
    const pathNodes = (await normalizeCatalogRowsForMetadata(vaultPath, db, pathNodeRows)).map(mapNoteRow);
    const nodeById = new Map(pathNodes.map((node) => [node.id, node]));

    return {
      fromNoteId,
      toNoteId,
      directoryId: directoryId || null,
      direction,
      maxDepth,
      found: Boolean(foundEdges),
      hops: foundEdges ? foundEdges.length : null,
      path: pathNoteIds,
      nodes: pathNoteIds.map((id) => nodeById.get(id)).filter(Boolean),
      edges: foundEdges || []
    };
  } finally {
    db.close();
  }
}

export async function detectGraphConflicts(vaultPath, input = {}) {
  if (!vaultPath) throw new Error("vaultPath is required");
  const directoryId = String(input.directoryId || "").trim();
  if (!directoryId) throw new Error("directoryId is required");
  const includeDescendants = input.includeDescendants !== false;

  const DatabaseSync = await loadDatabaseSync();
  const db = new DatabaseSync(catalogDbPath(vaultPath));
  try {
    const directory = db.prepare("SELECT id, title FROM directories WHERE id = ? LIMIT 1").get(directoryId);
    if (!directory) throw new Error(`directoryId not found: ${directoryId}`);

    const rows = includeDescendants
      ? db
          .prepare(
            `${directoryScopeClause("scope")}
             SELECT n.id, n.note_type, n.title, n.status, n.markdown_path,
                    n.created_at, n.updated_at, ndm.directory_id
             FROM note_directory_membership ndm
             JOIN scope ON scope.id = ndm.directory_id
             JOIN notes n ON n.id = ndm.note_id
             WHERE n.deleted_at IS NULL
             ORDER BY lower(n.title), n.updated_at DESC`
          )
          .all(directoryId)
      : db
          .prepare(
            `SELECT n.id, n.note_type, n.title, n.status, n.markdown_path,
                    n.created_at, n.updated_at, ndm.directory_id
             FROM note_directory_membership ndm
             JOIN notes n ON n.id = ndm.note_id
             WHERE ndm.directory_id = ? AND n.deleted_at IS NULL
             ORDER BY lower(n.title), n.updated_at DESC`
          )
          .all(directoryId);

    const normalizedRows = await normalizeCatalogRowsForMetadata(vaultPath, db, rows);
    const groups = new Map();
    for (const row of normalizedRows) {
      const key = String(row.title || "").trim().toLowerCase();
      if (!key) continue;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(mapNoteRow(row));
    }

    const conflicts = [...groups.entries()]
      .filter(([, notes]) => notes.length > 1)
      .map(([key, notes]) => ({
        id: `conflict_duplicate_title_${key.replace(/[^a-z0-9_-]+/gi, "_").slice(0, 48)}`,
        conflictType: "duplicate_title",
        severity: "warning",
        title: `Duplicate note title: ${notes[0].title}`,
        rationale: "Multiple active notes in this graph scope use the same title, which can make wikilinks ambiguous.",
        noteIds: notes.map((note) => note.id),
        notes
      }));

    return {
      scope: includeDescendants ? "directory_tree" : "directory",
      directoryId,
      directoryTitle: directory.title,
      conflicts,
      total: conflicts.length
    };
  } finally {
    db.close();
  }
}

export async function listNotesByTag(vaultPath, tagName, options = {}) {
  if (!vaultPath) throw new Error("vaultPath is required");
  const name = normalizeTagName(tagName);
  if (!name) throw new Error("tagName is required");
  const rootDirectoryId = String(options.rootDirectoryId || "").trim();

  const DatabaseSync = await loadDatabaseSync();
  const db = new DatabaseSync(catalogDbPath(vaultPath));
  try {
    await healCatalogScope(vaultPath, db, { rootDirectoryId });
    const tag = db.prepare("SELECT id, name FROM tags WHERE name = ? LIMIT 1").get(name);
    if (!tag) {
      return {
        tag: name,
        rootDirectoryId: rootDirectoryId || null,
        items: [],
        total: 0
      };
    }

    const rows = rootDirectoryId
      ? db
          .prepare(
            `WITH RECURSIVE directory_scope(id) AS (
               SELECT id FROM directories WHERE id = ?
               UNION ALL
               SELECT d.id
               FROM directories d
               JOIN directory_scope s ON d.parent_directory_id = s.id
             )
             SELECT DISTINCT n.id, n.note_type, n.title, n.status, n.markdown_path,
                    n.created_at, n.updated_at, ndm.directory_id
             FROM note_tags nt
             JOIN notes n ON n.id = nt.note_id
             JOIN note_directory_membership ndm ON ndm.note_id = n.id
             JOIN directory_scope scope ON scope.id = ndm.directory_id
             WHERE nt.tag_id = ? AND n.deleted_at IS NULL
             ORDER BY n.updated_at DESC`
          )
          .all(rootDirectoryId, tag.id)
      : db
          .prepare(
            `SELECT DISTINCT n.id, n.note_type, n.title, n.status, n.markdown_path,
                    n.created_at, n.updated_at, ndm.directory_id
             FROM note_tags nt
             JOIN notes n ON n.id = nt.note_id
             LEFT JOIN note_directory_membership ndm ON ndm.note_id = n.id
             WHERE nt.tag_id = ? AND n.deleted_at IS NULL
             ORDER BY n.updated_at DESC`
          )
          .all(tag.id);

    const normalizedRows = await normalizeCatalogRowsForMetadata(vaultPath, db, rows);
    const items = normalizedRows.map(mapNoteRow);
    return {
      tag: tag.name,
      rootDirectoryId: rootDirectoryId || null,
      items,
      total: items.length
    };
  } finally {
    db.close();
  }
}

export async function listTags(vaultPath, options = {}) {
  if (!vaultPath) throw new Error("vaultPath is required");
  const rootDirectoryId = String(options.rootDirectoryId || "").trim();
  const query = normalizeTagName(options.query || "").toLowerCase();
  const limit = Math.max(1, Math.min(100, Number(options.limit || 20) || 20));

  const DatabaseSync = await loadDatabaseSync();
  const db = new DatabaseSync(catalogDbPath(vaultPath));
  try {
    await healCatalogScope(vaultPath, db, { rootDirectoryId });
    const scopedRows = rootDirectoryId
      ? db
          .prepare(
            `WITH RECURSIVE directory_scope(id) AS (
               SELECT id FROM directories WHERE id = ?
               UNION ALL
               SELECT d.id
               FROM directories d
               JOIN directory_scope s ON d.parent_directory_id = s.id
             )
             SELECT t.id, t.name, COUNT(DISTINCT n.id) AS note_count, MAX(n.updated_at) AS last_used_at
             FROM tags t
             JOIN note_tags nt ON nt.tag_id = t.id
             JOIN notes n ON n.id = nt.note_id
             JOIN note_directory_membership ndm ON ndm.note_id = n.id
             JOIN directory_scope scope ON scope.id = ndm.directory_id
             WHERE n.deleted_at IS NULL
               AND (? = '' OR LOWER(t.name) LIKE '%' || ? || '%')
             GROUP BY t.id, t.name
             ORDER BY note_count DESC, last_used_at DESC, t.name ASC
             LIMIT ?`
          )
          .all(rootDirectoryId, query, query, limit)
      : db
          .prepare(
            `SELECT t.id, t.name, COUNT(DISTINCT n.id) AS note_count, MAX(n.updated_at) AS last_used_at
             FROM tags t
             JOIN note_tags nt ON nt.tag_id = t.id
             JOIN notes n ON n.id = nt.note_id
             WHERE n.deleted_at IS NULL
               AND (? = '' OR LOWER(t.name) LIKE '%' || ? || '%')
             GROUP BY t.id, t.name
             ORDER BY note_count DESC, last_used_at DESC, t.name ASC
             LIMIT ?`
          )
          .all(query, query, limit);

    const items = scopedRows.map((row) => ({
      id: row.id,
      name: row.name,
      noteCount: Number(row.note_count || 0),
      lastUsedAt: row.last_used_at || null
    }));

    return {
      rootDirectoryId: rootDirectoryId || null,
      query: query || "",
      items,
      total: items.length
    };
  } finally {
    db.close();
  }
}

export async function getNoteById(vaultPath, noteId) {
  if (!vaultPath) throw new Error("vaultPath is required");
  const id = String(noteId || "").trim();
  if (!id) throw new Error("noteId is required");
  const DatabaseSync = await loadDatabaseSync();
  const db = new DatabaseSync(catalogDbPath(vaultPath));
  try {
    const row = db
      .prepare(
        `SELECT n.id, n.note_type, n.title, n.status, n.markdown_path, n.created_at, n.updated_at,
                ndm.directory_id, d.fs_path AS directory_fs_path
         FROM notes n
         LEFT JOIN note_directory_membership ndm ON ndm.note_id = n.id
         LEFT JOIN directories d ON d.id = ndm.directory_id
         WHERE n.id = ? AND n.deleted_at IS NULL
         LIMIT 1`
      )
      .get(id);
    if (!row) throw new Error(`noteId not found: ${id}`);
    const resolved = await resolveCatalogRowState(vaultPath, db, row, { hydrateMarkdown: true });
    const effectiveRow = resolved.row;
    const parsed = resolved.parsed || parseMarkdownWithFrontmatter(String(resolved.markdown || ""));
    const boundaryOrCounterpoint = boundaryValueFromInput(parsed.frontmatter || {});
    const permanentMeta = effectiveRow.note_type === "permanent" ? permanentMetadataFromFrontmatter(parsed.frontmatter || {}) : null;
    return attachNoteThinkingStatus({
      ...mapNoteRow(effectiveRow),
      body: parsed.body,
      markdown: resolved.markdown,
      ...(permanentMeta
        ? {
            thesis: permanentMeta.thesis,
            threeLineSummary: permanentMeta.threeLineSummary,
            distillationStatus: permanentMeta.distillationStatus,
            startingQuestion: permanentMeta.startingQuestion,
            viewpointHistory: permanentMeta.viewpointHistory,
            pendingViewpointRevision: permanentMeta.pendingViewpointRevision,
            originalityStatus: permanentMeta.originalityStatus,
            ...(permanentMeta.originalitySimilarity !== null
              ? { originalitySimilarity: permanentMeta.originalitySimilarity }
              : {}),
            authorship: permanentMeta.authorship
          }
        : {}),
      ...(boundaryOrCounterpoint ? { boundaryOrCounterpoint } : {})
    }, db);
  } finally {
    db.close();
  }
}

export async function getNoteCatalogEntryById(vaultPath, noteId) {
  if (!vaultPath) throw new Error("vaultPath is required");
  const id = String(noteId || "").trim();
  if (!id) throw new Error("noteId is required");
  const DatabaseSync = await loadDatabaseSync();
  const db = new DatabaseSync(catalogDbPath(vaultPath));
  try {
    const row = db
      .prepare(
        `SELECT n.id, n.note_type, n.title, n.status, n.markdown_path, n.created_at, n.updated_at,
                ndm.directory_id, d.fs_path AS directory_fs_path
         FROM notes n
         LEFT JOIN note_directory_membership ndm ON ndm.note_id = n.id
         LEFT JOIN directories d ON d.id = ndm.directory_id
         WHERE n.id = ? AND n.deleted_at IS NULL
         LIMIT 1`
      )
      .get(id);
    if (!row) throw new Error(`noteId not found: ${id}`);
    const resolved = await resolveCatalogRowState(vaultPath, db, row, { tolerateMissing: true });
    return {
      ...mapNoteRow(resolved.row),
      directoryFsPath: resolved.row.directory_fs_path || null
    };
  } finally {
    db.close();
  }
}

export async function listNoteCatalogEntriesByType(vaultPath, noteType) {
  if (!vaultPath) throw new Error("vaultPath is required");
  const normalizedType = String(noteType || "").trim();
  if (!normalizedType) throw new Error("noteType is required");
  const DatabaseSync = await loadDatabaseSync();
  const db = new DatabaseSync(catalogDbPath(vaultPath));
  try {
    const rows = db
      .prepare(
        `SELECT n.id, n.note_type, n.title, n.status, n.markdown_path, n.created_at, n.updated_at,
                ndm.directory_id, d.fs_path AS directory_fs_path
         FROM notes n
         LEFT JOIN note_directory_membership ndm ON ndm.note_id = n.id
         LEFT JOIN directories d ON d.id = ndm.directory_id
         WHERE n.note_type = ? AND n.deleted_at IS NULL
         ORDER BY n.updated_at DESC`
      )
      .all(normalizedType);
    const normalizedRows = await normalizeCatalogRowsForMetadata(vaultPath, db, rows);
    return normalizedRows.map((row) => ({
      ...mapNoteRow(row),
      directoryFsPath: row.directory_fs_path || null
    }));
  } finally {
    db.close();
  }
}

export async function updatePermanentNoteDistillation(vaultPath, noteId, input = {}) {
  const note = await getNoteById(vaultPath, noteId);
  if (note.noteType !== "permanent") {
    throw noteValidationError("PERMANENT_NOTE_REQUIRED", "Distillation fields can only be updated on permanent notes.", {
      noteId,
      noteType: note.noteType
    });
  }
  return updateNoteContent(vaultPath, noteId, {
    thesis: input.thesis,
    threeLineSummary: input.threeLineSummary ?? input.three_line_summary,
    startingQuestion: input.startingQuestion ?? input.starting_question,
    thesisChangeReason: input.thesisChangeReason ?? input.thesis_change_reason,
    viewpointChangeSourceNoteIds: input.viewpointChangeSourceNoteIds ?? input.viewpoint_change_source_note_ids,
    viewpointChangeStatus: input.viewpointChangeStatus ?? input.viewpoint_change_status,
    commitViewpointChange: input.commitViewpointChange ?? input.commit_viewpoint_change,
    distillationStatus: input.distillationStatus ?? input.distillation_status ?? "draft",
    authorship: note.authorship,
    originalityStatus: note.originalityStatus,
    originalitySimilarity: note.originalitySimilarity,
    boundaryOrCounterpoint: input.boundaryOrCounterpoint ?? input.boundary_or_counterpoint ?? note.boundaryOrCounterpoint
  });
}

export async function confirmPermanentNoteDistillation(vaultPath, noteId, input = {}) {
  const note = await getNoteById(vaultPath, noteId);
  if (note.noteType !== "permanent") {
    throw noteValidationError("PERMANENT_NOTE_REQUIRED", "Distillation can only be confirmed on permanent notes.", {
      noteId,
      noteType: note.noteType
    });
  }
  if (!note.thesis) {
    throw noteValidationError(
      "PERMANENT_DISTILLATION_INCOMPLETE",
      "Permanent-note confirmation requires a current viewpoint.",
      {
        noteId,
        missing: ["thesis"]
      }
    );
  }
  return updateNoteContent(vaultPath, noteId, {
    body: upsertConfirmedDistillationSection(note.body, note),
    thesis: note.thesis,
    threeLineSummary: note.threeLineSummary,
    startingQuestion: note.startingQuestion,
    distillationStatus: "confirmed",
    authorship: {
      user_confirmed: true,
      ai_assisted: Boolean(input.aiAssisted ?? input.ai_assisted ?? note.authorship?.ai_assisted)
    },
    originalityStatus: note.originalityStatus,
    originalitySimilarity: note.originalitySimilarity,
    boundaryOrCounterpoint: note.boundaryOrCounterpoint
  });
}

export async function saveNoteAsset(vaultPath, noteId, input = {}) {
  if (!vaultPath) throw new Error("vaultPath is required");
  const id = String(noteId || "").trim();
  if (!id) throw new Error("noteId is required");

  const contentBase64 = String(input.contentBase64 || input.base64 || "").trim();
  if (!contentBase64) throw new Error("contentBase64 is required");

  const assetKind = normalizeAssetKind(input.kind, input.fileName, input.mimeType);
  const mimeType = String(input.mimeType || "").trim().toLowerCase() || "application/octet-stream";
  const normalizedFileName = normalizeAssetFileName(input.fileName, mimeType, assetKind);
  const buffer = Buffer.from(contentBase64, "base64");
  if (!buffer.length) throw new Error("asset content is empty");

  const root = path.resolve(vaultPath);
  const DatabaseSync = await loadDatabaseSync();
  const db = new DatabaseSync(catalogDbPath(vaultPath));
  try {
    const row = db
      .prepare(
        `SELECT markdown_path
         FROM notes
         WHERE id = ? AND deleted_at IS NULL
         LIMIT 1`
      )
      .get(id);
    if (!row) throw new Error(`noteId not found: ${id}`);

    const bucket = assetKind === "image" ? "images" : "files";
    const assetDirectory = path.join(root, "assets", bucket, id);
    await fs.mkdir(assetDirectory, { recursive: true });
    const assetAbsolutePath = await resolveUniqueAssetPath(assetDirectory, normalizedFileName);
    await fs.writeFile(assetAbsolutePath, buffer);

    const assetPath = path.relative(root, assetAbsolutePath).replaceAll("\\", "/");
    const markdownLinkPath = relativeMarkdownLinkPath(row.markdown_path, assetPath);
    return {
      noteId: id,
      assetKind,
      mimeType,
      fileName: path.basename(assetAbsolutePath),
      assetPath,
      markdownLinkPath,
      size: buffer.length,
      createdAt: new Date().toISOString()
    };
  } finally {
    db.close();
  }
}

export async function createNoteRelation(vaultPath, fromNoteIdOrInput, input = {}) {
  if (!vaultPath) throw new Error("vaultPath is required");
  const relationInput =
    fromNoteIdOrInput && typeof fromNoteIdOrInput === "object" && !Array.isArray(fromNoteIdOrInput)
      ? fromNoteIdOrInput
      : input;
  const fromNoteId =
    fromNoteIdOrInput && typeof fromNoteIdOrInput === "object" && !Array.isArray(fromNoteIdOrInput)
      ? relationInput.fromNoteId ?? relationInput.from_note_id
      : fromNoteIdOrInput;
  const payload = normalizeRelationPayload(relationInput, { fromNoteId });
  const now = new Date().toISOString();
  const relationId = String(input.id || `lnk_${randomUUID().slice(0, 8)}`).trim();

  const DatabaseSync = await loadDatabaseSync();
  const db = new DatabaseSync(catalogDbPath(vaultPath));
  try {
    assertNoteExistsForRelation(db, payload.fromNoteId, "fromNoteId");
    assertNoteExistsForRelation(db, payload.toNoteId, "toNoteId");

    const duplicate = db
      .prepare(
        `SELECT id FROM links
         WHERE from_note_id = ? AND to_note_id = ? AND relation_type = ?
         LIMIT 1`
      )
      .get(payload.fromNoteId, payload.toNoteId, payload.relationType);
    if (duplicate) {
      return {
        ...(await mapSingleRelationLinkRow(vaultPath, db, getRelationByIdRow(db, duplicate.id))),
        created: false
      };
    }

    db.prepare(
      `INSERT INTO links
       (id, from_note_id, to_note_id, relation_type, rationale, insight_question, rationale_quality_score,
        rationale_quality_level, created_by, confidence, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      relationId,
      payload.fromNoteId,
      payload.toNoteId,
      payload.relationType,
      payload.rationale,
      payload.insightQuestion,
      payload.rationaleQuality.score,
      payload.rationaleQuality.level,
      payload.createdBy,
      payload.confidence,
      payload.status,
      now,
      now
    );

    return {
      ...(await mapSingleRelationLinkRow(vaultPath, db, getRelationByIdRow(db, relationId))),
      created: true
    };
  } finally {
    db.close();
  }
}

export async function updateNoteRelation(vaultPath, relationId, input = {}) {
  if (!vaultPath) throw new Error("vaultPath is required");
  const id = String(relationId || "").trim();
  if (!id) throw new Error("relationId is required");

  const DatabaseSync = await loadDatabaseSync();
  const db = new DatabaseSync(catalogDbPath(vaultPath));
  try {
    const existing = getRelationByIdRow(db, id);
    if (!existing) throw noteValidationError("RELATION_NOT_FOUND", `relationId not found: ${id}`, { relationId: id });

    const relationType =
      input.relationType !== undefined || input.relation_type !== undefined
        ? normalizeRelationType(input.relationType ?? input.relation_type)
        : existing.relation_type;
    const rationale =
      input.rationale !== undefined ? String(input.rationale || "").trim() : String(existing.rationale || "").trim();
    const insightQuestion =
      input.insightQuestion !== undefined || input.insight_question !== undefined
        ? String(input.insightQuestion ?? input.insight_question ?? "").trim() || null
        : existing.insight_question || null;
    const status = input.status !== undefined ? normalizeRelationStatus(input.status, existing.created_by) : existing.status || "confirmed";
    const confidence =
      input.confidence === undefined
        ? existing.confidence
        : input.confidence === null || input.confidence === ""
          ? null
          : Math.max(0, Math.min(1, Number(input.confidence)));

    if (!rationale) throw noteValidationError("RELATION_RATIONALE_REQUIRED", "rationale is required.");
    if (confidence !== null && !Number.isFinite(confidence)) {
      throw noteValidationError("RELATION_CONFIDENCE_INVALID", "confidence must be a number between 0 and 1.");
    }
    const rationaleQuality = evaluateRelationRationaleQuality(rationale, insightQuestion);

    if (relationType !== existing.relation_type) {
      const duplicate = db
        .prepare(
          `SELECT id FROM links
           WHERE from_note_id = ? AND to_note_id = ? AND relation_type = ? AND id != ?
           LIMIT 1`
        )
        .get(existing.from_note_id, existing.to_note_id, relationType, id);
      if (duplicate) {
        throw noteValidationError("RELATION_DUPLICATE", "A relation of this type already exists between these notes.", {
          relationId: duplicate.id,
          fromNoteId: existing.from_note_id,
          toNoteId: existing.to_note_id,
          relationType
        });
      }
    }

    const now = new Date().toISOString();
    db.prepare(
      `UPDATE links
       SET relation_type = ?, rationale = ?, insight_question = ?, rationale_quality_score = ?,
           rationale_quality_level = ?, status = ?, confidence = ?, updated_at = ?
       WHERE id = ?`
    ).run(relationType, rationale, insightQuestion, rationaleQuality.score, rationaleQuality.level, status, confidence, now, id);

    return await mapSingleRelationLinkRow(vaultPath, db, getRelationByIdRow(db, id));
  } finally {
    db.close();
  }
}

export async function deleteNoteRelation(vaultPath, relationId) {
  if (!vaultPath) throw new Error("vaultPath is required");
  const id = String(relationId || "").trim();
  if (!id) throw new Error("relationId is required");

  const DatabaseSync = await loadDatabaseSync();
  const db = new DatabaseSync(catalogDbPath(vaultPath));
  try {
    const existing = getRelationByIdRow(db, id);
    if (!existing) throw noteValidationError("RELATION_NOT_FOUND", `relationId not found: ${id}`, { relationId: id });
    db.prepare("DELETE FROM links WHERE id = ?").run(id);
    return { ok: true, deleted: true, relationId: id, item: await mapSingleRelationLinkRow(vaultPath, db, existing) };
  } finally {
    db.close();
  }
}

export async function listNoteRelations(vaultPath, noteId) {
  if (!vaultPath) throw new Error("vaultPath is required");
  const id = String(noteId || "").trim();
  if (!id) throw new Error("noteId is required");

  const DatabaseSync = await loadDatabaseSync();
  const db = new DatabaseSync(catalogDbPath(vaultPath));
  try {
    const note = db.prepare("SELECT id FROM notes WHERE id = ? AND deleted_at IS NULL LIMIT 1").get(id);
    if (!note) throw new Error(`noteId not found: ${id}`);

    const tags = db
      .prepare(
        `SELECT t.id, t.name, nt.source, nt.created_at
         FROM note_tags nt
         JOIN tags t ON t.id = nt.tag_id
         WHERE nt.note_id = ?
         ORDER BY t.name ASC`
      )
      .all(id)
      .map((row) => ({
        id: row.id,
        name: row.name,
        source: row.source,
        createdAt: row.created_at
      }));

    const outgoingRows = db
      .prepare(
        `SELECT l.*, n.id AS target_id, n.note_type AS target_note_type, n.title AS target_title,
                n.status AS target_status, n.markdown_path AS target_markdown_path,
                target_member.directory_id AS target_directory_id, target_directory.fs_path AS target_directory_fs_path,
                NULL AS source_id, NULL AS source_note_type, NULL AS source_title,
                NULL AS source_status, NULL AS source_markdown_path,
                NULL AS source_directory_id, NULL AS source_directory_fs_path
         FROM links l
         JOIN notes n ON n.id = l.to_note_id
         LEFT JOIN note_directory_membership target_member ON target_member.note_id = n.id
         LEFT JOIN directories target_directory ON target_directory.id = target_member.directory_id
         WHERE l.from_note_id = ? AND n.deleted_at IS NULL
         ORDER BY l.created_at DESC`
      )
      .all(id);

    const backlinkRows = db
      .prepare(
        `SELECT l.*, NULL AS target_id, NULL AS target_note_type, NULL AS target_title,
                NULL AS target_status, NULL AS target_markdown_path,
                NULL AS target_directory_id, NULL AS target_directory_fs_path,
                n.id AS source_id, n.note_type AS source_note_type, n.title AS source_title,
                n.status AS source_status, n.markdown_path AS source_markdown_path,
                source_member.directory_id AS source_directory_id, source_directory.fs_path AS source_directory_fs_path
         FROM links l
         JOIN notes n ON n.id = l.from_note_id
         LEFT JOIN note_directory_membership source_member ON source_member.note_id = n.id
         LEFT JOIN directories source_directory ON source_directory.id = source_member.directory_id
         WHERE l.to_note_id = ? AND n.deleted_at IS NULL
         ORDER BY l.created_at DESC`
      )
      .all(id);

    const outgoingLinks = await mapRelationLinkRows(vaultPath, db, outgoingRows);
    const backlinks = await mapRelationLinkRows(vaultPath, db, backlinkRows);

    return {
      noteId: id,
      tags,
      outgoingLinks,
      backlinks
    };
  } finally {
    db.close();
  }
}

export async function updateNoteContent(vaultPath, noteId, input = {}) {
  if (!vaultPath) throw new Error("vaultPath is required");
  const id = String(noteId || "").trim();
  if (!id) throw new Error("noteId is required");
  const DatabaseSync = await loadDatabaseSync();
  const db = new DatabaseSync(catalogDbPath(vaultPath));
  try {
    const row = db
      .prepare(
        `SELECT n.id, n.note_type, n.title, n.status, n.markdown_path, n.created_at, n.updated_at,
                ndm.directory_id, d.fs_path AS directory_fs_path
         FROM notes n
         LEFT JOIN note_directory_membership ndm ON ndm.note_id = n.id
         LEFT JOIN directories d ON d.id = ndm.directory_id
         WHERE n.id = ? AND n.deleted_at IS NULL
         LIMIT 1`
      )
      .get(id);
    if (!row) throw new Error(`noteId not found: ${id}`);
    const resolved = await resolveCatalogRowState(vaultPath, db, row, { hydrateMarkdown: true });
    const effectiveRow = resolved.row;
    const currentMarkdownPath = resolved.fullPath;
    const currentMarkdown = resolved.markdown;
    const currentParsed = resolved.parsed || parseMarkdownWithFrontmatter(currentMarkdown);
    const preservedFrontmatter = currentParsed.frontmatter && typeof currentParsed.frontmatter === "object" ? { ...currentParsed.frontmatter } : {};
    const requestedStatus = String(input.status || effectiveRow.status || "draft");
    const normalized = normalizeMarkdown(
      input.title === undefined ? effectiveRow.title : input.title,
      input.body === undefined ? currentParsed.body : input.body
    );
    assertLiteratureCompletionAllowed(effectiveRow.note_type, requestedStatus, normalized.markdownBody);
    const now = new Date().toISOString();
    const permanentMeta = effectiveRow.note_type === "permanent" ? permanentMetadataFromInput(input, preservedFrontmatter) : null;
    assertConfirmedDistillationAllowed(effectiveRow.note_type, input, permanentMeta);
    let status = requestedStatus;
    if (effectiveRow.note_type === "permanent") {
      const originality = await evaluatePermanentOriginality(db, vaultPath, effectiveRow.id, normalized.markdownBody);
      if (originality) {
        permanentMeta.originalityStatus = originality.status;
        permanentMeta.originalitySimilarity = originality.similarity;
        if (originality.status === "blocked") {
          throw noteValidationError(
            "PERMANENT_ORIGINALITY_BLOCKED",
            "Permanent note save blocked: rewrite this note in your own words before saving.",
            {
              noteType: effectiveRow.note_type,
              requestedStatus,
              originality
            }
          );
        }
      }
      status = resolvePermanentSaveStatus(
        status,
        originality || { status: permanentMeta.originalityStatus, similarity: permanentMeta.originalitySimilarity },
        permanentMeta.authorship
      );
    }
    const nextFrontmatter = {
      ...preservedFrontmatter,
      id: effectiveRow.id,
      note_type: effectiveRow.note_type,
      title: normalized.title,
      status,
      created_at: effectiveRow.created_at,
      updated_at: now
    };
    delete nextFrontmatter.boundaryOrCounterpoint;
    delete nextFrontmatter.threeLineSummary;
    delete nextFrontmatter.distillationStatus;
    delete nextFrontmatter.startingQuestion;
    delete nextFrontmatter.viewpointHistory;
    delete nextFrontmatter.pendingViewpointRevision;
    if (effectiveRow.note_type === "permanent") {
      const boundaryOrCounterpoint = boundaryValueFromInput(input, preservedFrontmatter.boundary_or_counterpoint || preservedFrontmatter.boundaryOrCounterpoint);
      if (boundaryOrCounterpoint) nextFrontmatter.boundary_or_counterpoint = boundaryOrCounterpoint;
      else delete nextFrontmatter.boundary_or_counterpoint;
      nextFrontmatter.originality_status = permanentMeta.originalityStatus;
      if (permanentMeta.originalitySimilarity !== null) nextFrontmatter.originality_similarity = permanentMeta.originalitySimilarity;
      else delete nextFrontmatter.originality_similarity;
      nextFrontmatter.authorship = permanentMeta.authorship;
      if (permanentMeta.thesis) nextFrontmatter.thesis = permanentMeta.thesis;
      else delete nextFrontmatter.thesis;
      if (permanentMeta.threeLineSummary.length) nextFrontmatter.three_line_summary = permanentMeta.threeLineSummary;
      else delete nextFrontmatter.three_line_summary;
      if (permanentMeta.startingQuestion) nextFrontmatter.starting_question = permanentMeta.startingQuestion;
      else delete nextFrontmatter.starting_question;
      if (permanentMeta.viewpointHistory.length) {
        nextFrontmatter.viewpoint_history = permanentMeta.viewpointHistory.map((item) => JSON.stringify(item));
      } else {
        delete nextFrontmatter.viewpoint_history;
      }
      if (permanentMeta.pendingViewpointRevision) {
        nextFrontmatter.pending_viewpoint_revision = permanentMeta.pendingViewpointRevision;
      } else {
        delete nextFrontmatter.pending_viewpoint_revision;
      }
      if (permanentMeta.distillationStatus !== "missing" || permanentMeta.thesis || permanentMeta.threeLineSummary.length) {
        nextFrontmatter.distillation_status = permanentMeta.distillationStatus;
      } else {
        delete nextFrontmatter.distillation_status;
      }
    } else {
      delete nextFrontmatter.boundary_or_counterpoint;
    }
    const markdown = serializeMarkdownWithFrontmatter(nextFrontmatter, normalized.markdownBody);
    const nextMarkdownPath = await resolveUniqueMarkdownPath(effectiveRow.directory_fs_path, normalized.title, {
      fallbackStem: effectiveRow.id,
      excludePath: currentMarkdownPath
    });
    const hasRenamedFile = path.resolve(nextMarkdownPath) !== path.resolve(currentMarkdownPath);
    let activeMarkdownPath = currentMarkdownPath;
    try {
      if (hasRenamedFile) {
        await fs.mkdir(path.dirname(nextMarkdownPath), { recursive: true });
        await fs.rename(currentMarkdownPath, nextMarkdownPath);
        activeMarkdownPath = nextMarkdownPath;
      }
      await fs.writeFile(activeMarkdownPath, markdown, "utf8");
    } catch (error) {
      if (hasRenamedFile) {
        try {
          if (await fileExists(activeMarkdownPath)) await fs.rename(activeMarkdownPath, currentMarkdownPath);
        } catch {}
      } else {
        try {
          await fs.writeFile(currentMarkdownPath, currentMarkdown, "utf8");
        } catch {}
      }
      throw error;
    }
    const nextRelPath = path.relative(path.resolve(vaultPath), activeMarkdownPath).replaceAll("\\", "/");
    db.exec("BEGIN IMMEDIATE;");
    try {
      db.prepare("UPDATE notes SET title = ?, status = ?, markdown_path = ?, updated_at = ? WHERE id = ?").run(
        normalized.title,
        status,
        nextRelPath,
        now,
        effectiveRow.id
      );
      ensureSingleDirectoryMembership(db, effectiveRow.id, effectiveRow.directory_id);
      if (effectiveRow.note_type === "permanent") {
        upsertPermanentNoteMeta(db, effectiveRow.id, {
          ...permanentMeta,
          coreClaim: normalized.markdownBody,
          rationale: input.rationale || ""
        }, nextFrontmatter.boundary_or_counterpoint || "");
      }
      syncMarkdownRelations(db, effectiveRow.id, normalized.markdownBody);
      db.exec("COMMIT;");
    } catch (error) {
      db.exec("ROLLBACK;");
      try {
        await fs.writeFile(activeMarkdownPath, currentMarkdown, "utf8");
        if (hasRenamedFile && (await fileExists(activeMarkdownPath))) {
          await fs.rename(activeMarkdownPath, currentMarkdownPath);
        }
      } catch {}
      throw error;
    }

    const refreshed = db
      .prepare(
        `SELECT n.id, n.note_type, n.title, n.status, n.markdown_path, n.created_at, n.updated_at,
                ndm.directory_id, d.fs_path AS directory_fs_path
         FROM notes n
         LEFT JOIN note_directory_membership ndm ON ndm.note_id = n.id
         LEFT JOIN directories d ON d.id = ndm.directory_id
         WHERE n.id = ?
         LIMIT 1`
      )
      .get(effectiveRow.id);
    return attachNoteThinkingStatus({
      ...mapNoteRow(refreshed),
      body: normalized.markdownBody,
      markdown,
      ...(effectiveRow.note_type === "permanent"
        ? {
            thesis: permanentMeta.thesis,
            threeLineSummary: permanentMeta.threeLineSummary,
            distillationStatus: permanentMeta.distillationStatus,
            startingQuestion: permanentMeta.startingQuestion,
            viewpointHistory: permanentMeta.viewpointHistory,
            pendingViewpointRevision: permanentMeta.pendingViewpointRevision,
            originalityStatus: permanentMeta.originalityStatus,
            ...(permanentMeta.originalitySimilarity !== null
              ? { originalitySimilarity: permanentMeta.originalitySimilarity }
              : {}),
            authorship: permanentMeta.authorship
          }
        : {}),
      ...(nextFrontmatter.boundary_or_counterpoint ? { boundaryOrCounterpoint: nextFrontmatter.boundary_or_counterpoint } : {})
    }, db);
  } finally {
    db.close();
  }
}

export async function moveNoteToDirectory(vaultPath, noteId, directoryId) {
  if (!vaultPath) throw new Error("vaultPath is required");
  const id = String(noteId || "").trim();
  const targetDirectoryId = String(directoryId || "").trim();
  if (!id) throw new Error("noteId is required");
  if (!targetDirectoryId) throw new Error("directoryId is required");

  const DatabaseSync = await loadDatabaseSync();
  const db = new DatabaseSync(catalogDbPath(vaultPath));
  try {
    const row = db
      .prepare(
        `SELECT n.id, n.note_type, n.title, n.status, n.markdown_path, n.created_at, n.updated_at,
                ndm.directory_id, d.fs_path AS directory_fs_path
         FROM notes n
         LEFT JOIN note_directory_membership ndm ON ndm.note_id = n.id
         LEFT JOIN directories d ON d.id = ndm.directory_id
         WHERE n.id = ? AND n.deleted_at IS NULL
         LIMIT 1`
      )
      .get(id);
    if (!row) throw new Error(`noteId not found: ${id}`);
    const resolved = await resolveCatalogRowState(vaultPath, db, row, { tolerateMissing: false });
    const effectiveRow = resolved.row;

    const targetDir = db
      .prepare("SELECT id, fs_path FROM directories WHERE id = ? LIMIT 1")
      .get(targetDirectoryId);
    if (!targetDir) throw new Error(`directoryId not found: ${targetDirectoryId}`);

    if (effectiveRow.directory_id === targetDirectoryId) {
      return mapNoteRow({ ...effectiveRow, directory_id: targetDirectoryId });
    }

    const oldAbsPath = resolved.fullPath;
    const newAbsPath = await resolveUniqueMarkdownPath(targetDir.fs_path, effectiveRow.title, {
      fallbackStem: effectiveRow.id
    });
    await fs.mkdir(path.dirname(newAbsPath), { recursive: true });
    await fs.rename(oldAbsPath, newAbsPath);
    const relPath = path.relative(path.resolve(vaultPath), newAbsPath).replaceAll("\\", "/");
    const now = new Date().toISOString();

    db.exec("BEGIN IMMEDIATE;");
    try {
      await rewriteAssetLinksInMarkdownFile(newAbsPath, effectiveRow.markdown_path, relPath, now);
      db.prepare("UPDATE notes SET markdown_path = ?, updated_at = ? WHERE id = ?").run(relPath, now, id);
      ensureSingleDirectoryMembership(db, id, targetDirectoryId);
      db.exec("COMMIT;");
    } catch (error) {
      db.exec("ROLLBACK;");
      try {
        await fs.rename(newAbsPath, oldAbsPath);
      } catch {}
      throw error;
    }

    const refreshed = db
      .prepare(
        `SELECT n.id, n.note_type, n.title, n.status, n.markdown_path, n.created_at, n.updated_at, ndm.directory_id
         FROM notes n
         LEFT JOIN note_directory_membership ndm ON ndm.note_id = n.id
         WHERE n.id = ? AND n.deleted_at IS NULL
         LIMIT 1`
      )
      .get(id);
    return mapNoteRow(refreshed);
  } finally {
    db.close();
  }
}

export async function deleteNoteById(vaultPath, noteId, options = {}) {
  if (!vaultPath) throw new Error("vaultPath is required");
  const id = String(noteId || "").trim();
  if (!id) throw new Error("noteId is required");
  const deleteFile = options.deleteFile !== false;

  const DatabaseSync = await loadDatabaseSync();
  const db = new DatabaseSync(catalogDbPath(vaultPath));
  try {
    const row = db
      .prepare(
        `SELECT n.id, n.note_type, n.title, n.status, n.markdown_path, n.created_at, n.updated_at,
                ndm.directory_id, d.fs_path AS directory_fs_path, n.deleted_at
         FROM notes n
         LEFT JOIN note_directory_membership ndm ON ndm.note_id = n.id
         LEFT JOIN directories d ON d.id = ndm.directory_id
         WHERE n.id = ?
         LIMIT 1`
      )
      .get(id);
    if (!row) throw new Error(`noteId not found: ${id}`);
    if (row.deleted_at) return { id, deleted: true };
    const resolved = await resolveCatalogRowState(vaultPath, db, row, { tolerateMissing: true });

    if (deleteFile && resolved.fullPath) {
      try {
        await fs.unlink(resolved.fullPath);
      } catch {}
    }
    const now = new Date().toISOString();
    db.prepare("UPDATE notes SET deleted_at = ?, updated_at = ? WHERE id = ?").run(now, now, id);
    db.prepare("DELETE FROM note_directory_membership WHERE note_id = ?").run(id);
    return { id, deleted: true };
  } finally {
    db.close();
  }
}
