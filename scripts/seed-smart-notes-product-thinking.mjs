import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";

import {
  createDirectory,
  listDirectories,
  createNoteInDirectory,
  createNoteRelation,
  getNoteById,
  getNotePath,
  updateNoteContent,
  updateNoteRelation,
  createIndexCard,
  getIndexCard,
  updateIndexCard,
  initVault,
  syncMarkdownNoteCatalogRelations,
  serializeNote
} from "../packages/domain/src/index.mjs";
import { createDraftScaffold, createWritingProject, getDraftScaffold, syncWritingProject } from "../packages/writing-engine/src/index.mjs";

const REPO_ROOT = path.resolve(import.meta.dirname, "..");
const DEFAULT_FIXTURE_PATH = path.join(REPO_ROOT, "tests", "fixtures", "demo-smart-notes-product-thinking", "demo.json");

const ORIGINAL_DIRECTORY_ID = "dir_demo_smart_notes_product_thinking_original";
const ORIGINAL_FOLDER_NAME = "demo-smart-notes-product-thinking";
const GUIDE_DIRECTORY_ID = "dir_demo_smart_notes_product_thinking_guide";
const GUIDE_FOLDER_NAME = "smart-notes-demo-guide";

function cleanText(input) {
  return String(input || "").trim();
}

function parseArgs(argv = process.argv.slice(2)) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--vault") {
      options.vaultPath = argv[index + 1];
      index += 1;
      continue;
    }
    if (arg === "--fixture") {
      options.fixturePath = argv[index + 1];
      index += 1;
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      options.help = true;
      continue;
    }
    if (!options.vaultPath) {
      options.vaultPath = arg;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }
  return options;
}

function usage() {
  return [
    "Usage:",
    "  node scripts/seed-smart-notes-product-thinking.mjs --vault <vault-path>",
    "",
    "Options:",
    "  --fixture <path>  Override the default demo fixture JSON."
  ].join("\n");
}

function fixtureNoteType(note) {
  const kind = cleanText(note?.note_type || note?.noteType).toLowerCase();
  if (kind === "source") return "source";
  if (kind === "fleeting") return "fleeting";
  if (kind === "literature") return "literature";
  if (kind === "guide" || kind === "final_essay") return "guide";
  return "permanent";
}

function directoryIdForFixtureType(fixtureType) {
  if (fixtureType === "source") return "dir_source_default";
  if (fixtureType === "fleeting") return "dir_fleeting_default";
  if (fixtureType === "literature") return "dir_literature_default";
  if (fixtureType === "guide") return GUIDE_DIRECTORY_ID;
  return ORIGINAL_DIRECTORY_ID;
}

function fixtureStringItems(input) {
  return Array.isArray(input) ? input.map((item) => cleanText(item)).filter(Boolean) : [];
}

function fixtureTagLine(note) {
  const tags = fixtureStringItems(note?.tags).map((tag) => (tag.startsWith("#") ? tag : `#${tag}`));
  return tags.length ? `\n\n${tags.join(" ")}` : "";
}

function richNoteBodyFromFixture(note, fixtureType) {
  const title = cleanText(note?.title) || cleanText(note?.id) || "Untitled";
  const tagLine = fixtureTagLine(note);
  const explicitBody = cleanText(note?.body);

  if (explicitBody) {
    const body = explicitBody.startsWith("# ") ? explicitBody : [`# ${title}`, "", explicitBody].join("\n");
    return `${body.trimEnd()}\n${tagLine}`;
  }

  if (fixtureType === "fleeting") {
    const processedInto = fixtureStringItems(note?.processed_into || note?.processedInto);
    return [
      `# ${title}`,
      "",
      "## 原始闪念",
      cleanText(note?.raw_idea || note?.content),
      "",
      "## 触发场景",
      cleanText(note?.capture_context || note?.source_hint),
      "",
      "## 为什么值得处理",
      cleanText(note?.why_it_matters),
      "",
      "## 下一步处理",
      cleanText(note?.next_action),
      "",
      "## 已转换为",
      ...(processedInto.length ? processedInto.map((id) => `- ${id}`) : ["- 待处理"]),
      tagLine
    ].join("\n");
  }

  if (fixtureType === "literature") {
    const knowledgePoints = fixtureStringItems(note?.knowledge_points);
    const candidateNotes = fixtureStringItems(note?.candidate_permanent_notes || note?.candidatePermanentNotes);
    const questions = fixtureStringItems(note?.questions);
    return [
      `# ${title}`,
      "",
      "## 来源",
      cleanText(note?.source_id || note?.sourceId) || "未标注",
      "",
      "## 引文边界",
      cleanText(note?.quote_text || note?.excerpt) || "本测试数据只保存主题边界和原创转述，不复刻原文。",
      "",
      "## 我的转述",
      cleanText(note?.paraphrase || note?.paraphrase_text),
      "",
      "## 知识点提取",
      ...(knowledgePoints.length ? knowledgePoints.map((item) => `- ${item}`) : ["- 待提取"]),
      "",
      "## 我的收获",
      cleanText(note?.my_takeaway || note?.takeaway),
      "",
      "## 可转换为永久笔记",
      ...(candidateNotes.length ? candidateNotes.map((id) => `- ${id}`) : ["- 待确认"]),
      "",
      "## 待追问问题",
      ...(questions.length ? questions.map((question) => `- ${question}`) : ["- 待补充"]),
      tagLine
    ].join("\n");
  }

  const knowledgePoint = note?.knowledge_point && typeof note.knowledge_point === "object" ? note.knowledge_point : {};
  const summary = fixtureStringItems(note?.threeLineSummary || note?.three_line_summary);
  const sourceIds = fixtureStringItems(note?.from_literature_note_ids || note?.fromLiteratureNoteIds);
  const keyNoteLine = note?.is_key_note
    ? `这是 ${cleanText(knowledgePoint.label) || "该主题"} 的关键笔记。`
    : cleanText(note?.supports_key_note_id)
      ? `这条笔记服务于 ${cleanText(note.supports_key_note_id)} 这条关键笔记。`
      : "这条笔记尚未绑定关键笔记。";

  return [
    `# ${title}`,
    "",
    "## 核心论点",
    cleanText(note?.core_claim || note?.thesis),
    "",
    "## 知识点提取",
    ...(cleanText(knowledgePoint.method_principle)
      ? [
          `- 方法论命题：${cleanText(knowledgePoint.method_principle)}`,
          `- 反面误用：${cleanText(knowledgePoint.misuse_to_avoid)}`,
          `- 产品设计要求：${cleanText(knowledgePoint.product_requirement)}`
        ]
      : ["- 待提取"]),
    "",
    "## 三句话压缩",
    ...(summary.length ? summary.map((item) => `- ${item}`) : ["- 待补充"]),
    "",
    "## 论证理由",
    cleanText(note?.rationale),
    "",
    "## 来源追溯",
    ...(sourceIds.length ? sourceIds.map((id) => `- ${id}`) : ["- 暂无文献笔记追溯"]),
    "",
    "## 产品含义",
    cleanText(note?.productImplication || note?.product_implication),
    "",
    "## 关键笔记定位",
    keyNoteLine,
    "",
    "## 边界或反例",
    cleanText(note?.boundaryOrCounterpoint || note?.boundary_or_counterpoint),
    tagLine
  ].join("\n");
}
function normalizeRelationType(input) {
  const raw = cleanText(input).toLowerCase();
  if (!raw) return "related";
  const map = {
    refines: "qualifies",
    leads_to: "follows",
    tension: "contrasts",
    gap: "asks",
    evidence_for: "supports",
    depends_on: "precedes",
    extends: "extends",
    contrasts: "contrasts",
    duplicates_or_overlaps: "duplicates",
    example_of: "example_of",
    counterexample_to: "counterexample_to",
    source_gap: "asks",
    writing_move: "appears_in_draft"
  };
  return map[raw] || raw;
}

function normalizeIndexType(input) {
  const raw = cleanText(input).toLowerCase();
  if (!raw) return "topic";
  const map = {
    theme: "topic",
    theme_index: "topic",
    topic: "topic",
    topic_index: "topic",
    nearby: "nearby",
    sequence: "sequence",
    logic_chain: "sequence",
    free_link: "free_link"
  };
  return map[raw] || "topic";
}

function normalizeOrderingStrategy(input) {
  const raw = cleanText(input).toLowerCase();
  if (!raw) return "manual";
  const map = {
    manual: "manual",
    chronological: "chronological",
    logical: "logical",
    clustered: "clustered",
    time: "chronological"
  };
  return map[raw] || "manual";
}

async function getExistingNote(vaultPath, noteId) {
  try {
    return await getNoteById(vaultPath, noteId);
  } catch {
    return null;
  }
}

async function ensureOriginalDirectory(vaultPath) {
  const root = path.resolve(vaultPath);
  const directories = await listDirectories(root, { includeHidden: true });
  const existing = directories.find((item) => item.id === ORIGINAL_DIRECTORY_ID);
  if (existing) return existing;
  return createDirectory(root, {
    id: ORIGINAL_DIRECTORY_ID,
    title: "写作 Demo（卡片笔记写作法 x 产品思考）",
    parentDirectoryId: "dir_original_default",
    directoryType: "custom",
    fsPath: path.join(root, "notes", "original", ORIGINAL_FOLDER_NAME),
    maxNotes: 260
  });
}

async function ensureGuideDirectory(vaultPath) {
  const root = path.resolve(vaultPath);
  const directories = await listDirectories(root, { includeHidden: true });
  const existing = directories.find((item) => item.id === GUIDE_DIRECTORY_ID);
  if (existing) return existing;
  return createDirectory(root, {
    id: GUIDE_DIRECTORY_ID,
    title: "Demo 导览",
    directoryType: "custom",
    fsPath: path.join(root, "notes", GUIDE_FOLDER_NAME),
    maxNotes: 32
  });
}

async function upsertSource(vaultPath, note, counters) {
  const payload = {
    id: cleanText(note?.id) || `src_${randomUUID().slice(0, 8)}`,
    title: cleanText(note?.title) || cleanText(note?.id) || "Untitled Source",
    source_type: cleanText(note?.source_type || note?.sourceType || note?.source_kind || note?.sourceKind) || "reference",
    imported_from: cleanText(note?.imported_from || note?.importedFrom || "fixture"),
    description: cleanText(note?.body || note?.description || note?.use_boundary || note?.purpose || ""),
    note_type: "source"
  };
  const filePath = getNotePath(vaultPath, "source", payload.id);
  const content = serializeNote("source", payload);
  try {
    await fs.access(filePath);
    await fs.writeFile(filePath, content, "utf8");
    counters.updatedSources += 1;
  } catch {
    await fs.writeFile(filePath, content, "utf8");
    counters.createdSources += 1;
  }
  return payload.id;
}

async function upsertNote(vaultPath, note, counters) {
  const fixtureType = fixtureNoteType(note);
  if (fixtureType === "source") return upsertSource(vaultPath, note, counters);
  const directoryId = directoryIdForFixtureType(fixtureType);
  const payload = {
    id: cleanText(note?.id) || `note_${randomUUID().slice(0, 8)}`,
    directoryId,
    title: cleanText(note?.title) || cleanText(note?.id) || "Untitled",
    body: richNoteBodyFromFixture(note, fixtureType),
    status: cleanText(note?.status) || "draft"
  };

  if (fixtureType === "permanent") {
    payload.thesis = cleanText(note?.thesis);
    payload.threeLineSummary = note?.threeLineSummary || note?.three_line_summary || [];
    payload.distillationStatus = cleanText(note?.distillation_status || note?.distillationStatus) || "draft";
    payload.originalityStatus = cleanText(note?.originality_status || note?.originalityStatus) || "pass";
    payload.authorship = note?.authorship || { user_confirmed: true, ai_assisted: false };
    payload.boundaryOrCounterpoint = cleanText(note?.boundary_or_counterpoint || note?.boundaryOrCounterpoint);
  }

  const existing = await getExistingNote(vaultPath, payload.id);
  if (existing) {
    await updateNoteContent(vaultPath, payload.id, payload);
    counters.updatedNotes += 1;
    return payload.id;
  }
  await createNoteInDirectory(vaultPath, payload);
  counters.createdNotes += 1;
  return payload.id;
}

async function upsertRelation(vaultPath, relation, counters, noteIdSet) {
  const payload = {
    id: cleanText(relation?.id) || `rel_${randomUUID().slice(0, 8)}`,
    fromNoteId: cleanText(relation?.from),
    toNoteId: cleanText(relation?.to),
    relationType: normalizeRelationType(relation?.relationType || relation?.relation_type || "related"),
    status: cleanText(relation?.status || "confirmed"),
    rationale: cleanText(relation?.rationale || ""),
    insightQuestion: cleanText(relation?.insight_question || relation?.insightQuestion || ""),
    confidence: relation?.confidence
  };
  if (!payload.fromNoteId || !payload.toNoteId) return null;
  if (noteIdSet && (!noteIdSet.has(payload.fromNoteId) || !noteIdSet.has(payload.toNoteId))) return null;

  try {
    await updateNoteRelation(vaultPath, payload.id, payload);
    counters.updatedRelations += 1;
    return payload.id;
  } catch (error) {
    if (error?.code !== "RELATION_NOT_FOUND") throw error;
  }

  const created = await createNoteRelation(vaultPath, payload.fromNoteId, payload);
  if (created?.created) {
    counters.createdRelations += 1;
  } else {
    await updateNoteRelation(vaultPath, created?.id || payload.id, payload);
    counters.updatedRelations += 1;
  }
  return created?.id || payload.id;
}

async function upsertIndexCard(vaultPath, card, counters) {
  const fallbackItemNoteIds = Array.isArray(card?.item_note_ids) ? card.item_note_ids : [];
  const fallbackNoteIds = Array.isArray(card?.itemNoteIds) ? card.itemNoteIds : fallbackItemNoteIds;
  const payload = {
    id: cleanText(card?.id) || `idx_${randomUUID().slice(0, 8)}`,
    directoryId: ORIGINAL_DIRECTORY_ID,
    title: cleanText(card?.title) || cleanText(card?.id) || "Untitled Index",
    indexType: normalizeIndexType(card?.indexType || card?.index_type || "theme_index"),
    orderingStrategy: normalizeOrderingStrategy(card?.orderingStrategy || card?.ordering_strategy || "manual"),
    summary: cleanText(card?.summary || ""),
    thesis: cleanText(card?.thesis || ""),
    threeLineSummary: card?.threeLineSummary || card?.three_line_summary || [],
    centralQuestion: cleanText(card?.centralQuestion || card?.central_question || ""),
    items: Array.isArray(card?.items) ? card.items : null,
    noteIds: Array.isArray(card?.noteIds || card?.note_ids)
      ? (card.noteIds || card.note_ids)
      : fallbackNoteIds.length
        ? fallbackNoteIds
        : null
  };

  try {
    await getIndexCard(vaultPath, payload.id);
    await updateIndexCard(vaultPath, payload.id, payload);
    counters.updatedIndexCards += 1;
    return payload.id;
  } catch {
    await createIndexCard(vaultPath, payload);
    counters.createdIndexCards += 1;
    return payload.id;
  }
}

async function upsertWritingProjectAndScaffold(vaultPath, fixture, counters) {
  const projects = Array.isArray(fixture?.writing_projects) ? fixture.writing_projects : [];
  if (!projects.length) return [];

  const results = [];
  for (const project of projects) {
    const projectId = cleanText(project?.id);
    const title = cleanText(project?.title);
    const basketNoteIds = Array.isArray(project?.basketNoteIds) ? project.basketNoteIds : [];
    const relatedIndexIds = Array.isArray(project?.indexCardIds) ? project.indexCardIds : [];

    let writingProject = null;
    try {
      writingProject = await syncWritingProject(vaultPath, projectId, {
        title,
        goal: cleanText(project?.goal || project?.writing_goal || project?.writingGoal),
        intent: cleanText(project?.intent),
        audience: cleanText(project?.target_reader || project?.targetReader),
        desiredReaderTakeaway: cleanText(project?.desired_reader_takeaway || project?.desiredReaderTakeaway),
        basketNoteIds,
        relatedIndexIds,
        status: "draft"
      });
      counters.updatedWritingProjects += 1;
    } catch {
      writingProject = await createWritingProject(vaultPath, {
        id: projectId,
        title,
        goal: cleanText(project?.goal || project?.writing_goal || project?.writingGoal),
        intent: cleanText(project?.intent),
        audience: cleanText(project?.target_reader || project?.targetReader),
        desiredReaderTakeaway: cleanText(project?.desired_reader_takeaway || project?.desiredReaderTakeaway),
        basketNoteIds,
        relatedIndexIds,
        status: "draft"
      });
      counters.createdWritingProjects += 1;
    }

    const scaffoldFixture = Array.isArray(fixture?.draft_scaffolds)
      ? fixture.draft_scaffolds.find((item) => cleanText(item?.writing_project_id) === cleanText(writingProject?.id))
      : null;
    const scaffoldId = cleanText(scaffoldFixture?.id) || `ds_${cleanText(writingProject.id)}`;
    const versionNote = cleanText(scaffoldFixture?.version_note);

    try {
      await getDraftScaffold(vaultPath, scaffoldId);
      counters.updatedDraftScaffolds += 1;
    } catch {
      await createDraftScaffold(vaultPath, {
        id: scaffoldId,
        writingProjectId: writingProject.id,
        ...(versionNote ? { versionNote } : {})
      });
      counters.createdDraftScaffolds += 1;
    }

    results.push({ writingProjectId: writingProject.id, scaffoldId });
  }

  return results;
}

async function loadFixture(fixturePath) {
  const resolved = path.resolve(fixturePath || DEFAULT_FIXTURE_PATH);
  const raw = await fs.readFile(resolved, "utf8");
  const json = JSON.parse(raw);
  return { fixturePath: resolved, fixture: json };
}

export async function seedSmartNotesProductThinking(vaultPath, options = {}) {
  if (!vaultPath) throw new Error("vaultPath is required");
  await initVault(vaultPath);
  await ensureOriginalDirectory(vaultPath);
  await ensureGuideDirectory(vaultPath);

  const { fixturePath, fixture } = await loadFixture(options.fixturePath);
  const counts = fixture?.counts && typeof fixture.counts === "object" ? fixture.counts : {};
  const counters = {
    createdSources: 0,
    updatedSources: 0,
    createdNotes: 0,
    updatedNotes: 0,
    createdRelations: 0,
    updatedRelations: 0,
    createdIndexCards: 0,
    updatedIndexCards: 0,
    createdWritingProjects: 0,
    updatedWritingProjects: 0,
    createdDraftScaffolds: 0,
    updatedDraftScaffolds: 0
  };

  const noteIds = [];
  const batches = [
    ...(Array.isArray(fixture?.sources) ? fixture.sources : []),
    ...(Array.isArray(fixture?.guide_notes) ? fixture.guide_notes : []),
    ...(Array.isArray(fixture?.fleeting_notes) ? fixture.fleeting_notes : []),
    ...(Array.isArray(fixture?.literature_notes) ? fixture.literature_notes : []),
    ...(Array.isArray(fixture?.permanent_notes) ? fixture.permanent_notes : []),
    ...(Array.isArray(fixture?.final_essays) ? fixture.final_essays : [])
  ];
  for (const note of batches) noteIds.push(await upsertNote(vaultPath, note, counters));
  const relationSyncNoteIds = batches
    .filter((note) => fixtureNoteType(note) !== "source")
    .map((note) => cleanText(note?.id))
    .filter(Boolean);
  const noteIdSet = new Set(noteIds.filter(Boolean).map(String));

  if (Array.isArray(fixture?.relations)) {
    for (const relation of fixture.relations) {
      const relationSource = cleanText(relation?.relationSource || relation?.source).toLowerCase();
      // Markdown links are reconciled from the saved note bodies. Importing the fixture copy too would duplicate them.
      if (relationSource === "body_wikilink") continue;
      await upsertRelation(vaultPath, relation, counters, noteIdSet);
    }
  }
  // Reconcile body links after manual relations are present, so one note pair is never duplicated.
  for (const noteId of relationSyncNoteIds) {
    await syncMarkdownNoteCatalogRelations(vaultPath, noteId);
  }

  if (Array.isArray(fixture?.index_cards)) {
    for (const card of fixture.index_cards) await upsertIndexCard(vaultPath, card, counters);
  }

  const writingEntries = await upsertWritingProjectAndScaffold(vaultPath, fixture, counters);
  const primaryWritingEntry = writingEntries[0] || null;
  const preferredFirstNoteId = cleanText(fixture?.guide_notes?.[0]?.id) || noteIds.find(Boolean) || null;

  return {
    kind: "smart_notes_product_thinking_seed",
    demoOnly: true,
    sourceKind: "bundled_fixture",
    fixtureId: cleanText(fixture?.id) || "demo-smart-notes-product-thinking",
    fixturePath,
    directoryId: ORIGINAL_DIRECTORY_ID,
    firstNoteId: preferredFirstNoteId,
    writingProjectId: primaryWritingEntry?.writingProjectId || null,
    draftScaffoldId: primaryWritingEntry?.scaffoldId || null,
    writingProjectIds: writingEntries.map((entry) => entry.writingProjectId).filter(Boolean),
    draftScaffoldIds: writingEntries.map((entry) => entry.scaffoldId).filter(Boolean),
    counts: counts && typeof counts === "object" ? counts : {},
    summary: counters
  };
}

async function main() {
  const options = parseArgs();
  if (options.help || !options.vaultPath) {
    // eslint-disable-next-line no-console
    console.log(usage());
    process.exit(0);
  }
  const result = await seedSmartNotesProductThinking(options.vaultPath, { fixturePath: options.fixturePath });
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(result, null, 2));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch((error) => {
    // eslint-disable-next-line no-console
    console.error(error);
    process.exit(1);
  });
}
