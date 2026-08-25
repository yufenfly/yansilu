import { escapeHtml } from "./editor-render-utils.js";
import { parseLinks, parseTags } from "./prototype-store.js";

const UNTITLED_NOTE_TITLE = "未命名笔记";

export function tokenAtCursor(text, cursor) {
  const startChars = [" ", "\n", "\t", "，", "。", ",", ":", "：", "(", ")", "[", "]"];
  let s = cursor;
  let e = cursor;
  while (s > 0 && !startChars.includes(text[s - 1])) s--;
  while (e < text.length && !startChars.includes(text[e])) e++;
  return text.slice(s, e).trim();
}

export function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

export function wikilinkTargetFromRaw(value = "") {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const [targetPart] = raw.split("|");
  const [pathAndHeading] = String(targetPart || "").split("^");
  const [targetRaw] = String(pathAndHeading || "").split("#");
  return String(targetRaw || "").trim();
}

export function wikilinkLabelFromRaw(value = "") {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const parts = raw.split("|");
  const alias = parts.length > 1 ? parts.slice(1).join("|").trim() : "";
  if (alias) return alias;
  const target = wikilinkTargetFromRaw(raw);
  const filename = target.replaceAll("\\", "/").split("/").filter(Boolean).pop() || target;
  return filename.replace(/\.md$/i, "") || target;
}

export function normalizeMarkdownReferencePath(value = "") {
  return String(value || "").trim().replaceAll("\\", "/").replace(/^\.?\//, "");
}

export function markdownReferencePathCandidates(value = "") {
  const normalized = normalizeMarkdownReferencePath(value);
  if (!normalized) return [];
  if (!normalized.includes("/") && !/\.md$/i.test(normalized)) return [];
  const withExtension = /\.md$/i.test(normalized) ? normalized : `${normalized}.md`;
  return [...new Set([normalized, withExtension])];
}

export function noteMatchesMarkdownReferencePath(note = {}, candidatePath = "") {
  const notePath = normalizeMarkdownReferencePath(note?.markdownPath || "");
  const candidate = normalizeMarkdownReferencePath(candidatePath);
  if (!notePath || !candidate) return false;
  return notePath === candidate || notePath.endsWith(`/${candidate}`);
}

export function wikilinkTokenForNote(note = {}) {
  const title = String(note?.title || note?.id || UNTITLED_NOTE_TITLE).trim() || UNTITLED_NOTE_TITLE;
  const readableTitle = title.replace(/[\[\]]/g, "").trim() || UNTITLED_NOTE_TITLE;
  return `[[${readableTitle}]]`;
}

export function normalizeKnownWikilinksToReadableTitles(body = "", candidates = []) {
  const notes = Array.isArray(candidates) ? candidates : [];
  if (!notes.length) return String(body || "");
  return String(body || "").replace(/\[\[([^[\]]+)\]\]/g, (match, raw) => {
    const resolved = resolveRelationCandidateToken(raw, notes);
    if (!resolved?.id) return match;
    return wikilinkTokenForNote(resolved);
  });
}

export function looksLikeStableNoteId(value = "") {
  const raw = wikilinkTargetFromRaw(value);
  return /^[a-z]{1,8}_[A-Za-z0-9][A-Za-z0-9_-]*$/.test(raw) || /^local_note_[A-Za-z0-9_-]+$/.test(raw);
}

export function relationCreateDefaultTypeForNote(note = {}) {
  return "associated_with";
}

export function resolveRelationCandidateToken(token = "", candidates = []) {
  const raw = wikilinkTargetFromRaw(token);
  if (!raw) return null;
  const byId = candidates.find((note) => normalizeText(note.id) === normalizeText(raw));
  if (byId) return byId;
  const pathCandidates = markdownReferencePathCandidates(raw);
  for (const candidatePath of pathCandidates) {
    const byPath = candidates.filter((note) => noteMatchesMarkdownReferencePath(note, candidatePath));
    if (byPath.length === 1) return byPath[0];
  }
  const exactTitle = candidates.find((note) => normalizeText(note.title) === normalizeText(raw));
  if (exactTitle) return exactTitle;
  const fuzzy = candidates.find(
    (note) => normalizeText(note.title).includes(normalizeText(raw)) || normalizeText(note.id).includes(normalizeText(raw))
  );
  return fuzzy || null;
}

export function sortRelationTargetCandidatesForNote(candidates = [], note = {}) {
  const current = note || {};
  const scoped = Array.isArray(candidates) ? candidates.slice() : [];
  const resolvedForwardIds = new Set(
    parseLinks(current.body || "")
      .map((token) => resolveRelationCandidateToken(token, scoped))
      .filter((item) => item?.id)
      .map((item) => item.id)
  );
  const currentTags = new Set(parseTags(current.body || "").map((tag) => normalizeText(tag)));
  return scoped.sort((a, b) => {
    const score = (candidate) => {
      let value = 0;
      if (resolvedForwardIds.has(candidate.id)) value += 100;
      const candidateTags = Array.isArray(candidate?.tags) ? candidate.tags : parseTags(candidate?.body || "");
      value += candidateTags.filter((tag) => currentTags.has(normalizeText(tag))).length * 10;
      if (candidate.folderId && candidate.folderId === current.folderId) value += 4;
      if (String(candidate.thesis || "").trim()) value += 2;
      return value;
    };
    const diff = score(b) - score(a);
    if (diff) return diff;
    return String(a.title || a.id || "").localeCompare(String(b.title || b.id || ""), "zh-CN");
  });
}

export function normalizeClickedTag(token) {
  const value = String(token || "")
    .replace(/^#/, "")
    .replace(/[，。！？、；：.!?;:,]+$/u, "")
    .trim();
  const match = value.match(/^[A-Za-z0-9_\-\u4e00-\u9fff]+/u);
  return match ? match[0] : value;
}

export function highlightMatch(text, query) {
  const source = String(text || "");
  const q = String(query || "").trim();
  if (!q) return escapeHtml(source);
  const lowerSource = source.toLowerCase();
  const lowerQuery = q.toLowerCase();
  const index = lowerSource.indexOf(lowerQuery);
  if (index < 0) return escapeHtml(source);
  const before = source.slice(0, index);
  const match = source.slice(index, index + q.length);
  const after = source.slice(index + q.length);
  return `${escapeHtml(before)}<mark class="picker-mark">${escapeHtml(match)}</mark>${escapeHtml(after)}`;
}

export function linkCandidateRank(note, query) {
  const q = normalizeText(query);
  if (!q) return 0;
  const title = normalizeText(note.title);
  const id = normalizeText(note.id);
  if (title === q) return 0;
  if (title.startsWith(q)) return 1;
  if (id.startsWith(q)) return 2;
  if (title.includes(q)) return 3;
  if (id.includes(q)) return 4;
  return 9;
}

export function linkCandidateBadge(note, query) {
  const q = normalizeText(query);
  if (!q) return "";
  const title = normalizeText(note.title);
  const id = normalizeText(note.id);
  if (title === q) return "标题精确";
  if (title.startsWith(q)) return "标题前缀";
  if (id.startsWith(q)) return "ID 前缀";
  if (title.includes(q)) return "标题包含";
  if (id.includes(q)) return "ID 包含";
  return "";
}

export function tagCandidateRank(item, query) {
  const q = normalizeText(query);
  if (!q) return 0;
  const name = normalizeText(item?.name);
  if (name === q) return 0;
  if (name.startsWith(q)) return 1;
  if (name.includes(q)) return 2;
  return 9;
}

export function tagCandidateBadge(item, query) {
  const q = normalizeText(query);
  if (!q) return "";
  const name = normalizeText(item?.name);
  if (name === q) return "标签精确";
  if (name.startsWith(q)) return "标签前缀";
  if (name.includes(q)) return "标签包含";
  return "";
}

export function linkCandidateGroupLabel(note, query) {
  const q = normalizeText(query);
  if (!q) return "同目录笔记";
  const rank = linkCandidateRank(note, q);
  if (rank <= 1) return "最匹配";
  if (rank <= 3) return "其他匹配";
  return "按 ID 匹配";
}

export function tagCandidateGroupLabel(item, query) {
  const q = normalizeText(query);
  if (!q) return "已有标签";
  const rank = tagCandidateRank(item, q);
  if (rank <= 1) return "最匹配";
  return "相关标签";
}

export function renderPickerSections(items = [], groupLabelForItem, renderItem) {
  const groups = [];
  for (const item of items) {
    const label = String(groupLabelForItem(item) || "结果");
    let group = groups.find((entry) => entry.label === label);
    if (!group) {
      group = { label, items: [] };
      groups.push(group);
    }
    group.items.push(item);
  }
  return groups
    .map(
      (group) => `
        <section class="picker-section">
          <div class="picker-section-label">${escapeHtml(group.label)}<span>${group.items.length}</span></div>
          ${group.items.map((item) => renderItem(item)).join("")}
        </section>
      `
    )
    .join("");
}
