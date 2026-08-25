import { escapeHtml } from "./editor-render-utils.js";
import { relationOtherEndpoint } from "./note-relation-endpoint.js";

function cleanText(value = "") {
  return String(value || "").trim();
}

function eventTimestamp(value = "") {
  const timestamp = Date.parse(cleanText(value));
  return Number.isFinite(timestamp) ? timestamp : null;
}

function sortFormationEvents(events = []) {
  return [...events].sort((left, right) => {
    const leftTime = eventTimestamp(left.occurredAt);
    const rightTime = eventTimestamp(right.occurredAt);
    if (leftTime !== null && rightTime !== null && leftTime !== rightTime) return leftTime - rightTime;
    if (leftTime !== null && rightTime === null) return -1;
    if (leftTime === null && rightTime !== null) return 1;
    return left.sequence - right.sequence;
  });
}

export function permanentNoteFormationSteps(note = {}, relations = {}, options = {}) {
  const relationState = relations && typeof relations === "object" ? relations : {};
  const steps = [];
  const startingQuestion = cleanText(note.startingQuestion);
  if (startingQuestion) steps.push({ kind: "question", label: "最初的问题", text: startingQuestion });

  const events = [];
  const relationTitlesByNoteId = new Map();
  for (const item of Array.isArray(options.notes) ? options.notes : []) {
    const id = cleanText(item?.id);
    const title = cleanText(item?.title);
    if (id && title) relationTitlesByNoteId.set(id, title);
  }
  for (const relation of [...(relationState.outgoingLinks || []), ...(relationState.backlinks || [])]) {
    if (cleanText(relation.status).toLowerCase() === "archived") continue;
    const related = relationOtherEndpoint(relation, note.id);
    const title = related.title;
    const relatedNoteId = related.id;
    if (relatedNoteId && title) relationTitlesByNoteId.set(relatedNoteId, title);
  }

  for (const revision of Array.isArray(note.viewpointHistory) ? note.viewpointHistory : []) {
    const previousThesis = cleanText(revision.previousThesis || revision.previous_thesis);
    const thesis = cleanText(revision.thesis);
    const reason = cleanText(revision.reason);
    if (!previousThesis || !thesis || !reason) continue;
    const sourceNoteIds = Array.isArray(revision.sourceNoteIds || revision.source_note_ids)
      ? revision.sourceNoteIds || revision.source_note_ids
      : [];
    const sourceTitles = sourceNoteIds.map((noteId) => {
      const id = cleanText(noteId);
      return relationTitlesByNoteId.get(id) || id;
    }).filter(Boolean);
    events.push({
      kind: "revision",
      label: "观点发生变化",
      text: thesis,
      detail: [
        `原来认为：${previousThesis}`,
        `改变原因：${reason}`,
        sourceTitles.length ? `依据：${sourceTitles.join("、")}` : ""
      ].filter(Boolean).join("\n"),
      occurredAt: revision.changedAt || revision.changed_at || "",
      sequence: events.length
    });
  }

  steps.push(...sortFormationEvents(events));

  const boundary = cleanText(note.boundaryOrCounterpoint);
  if (boundary) steps.push({ kind: "boundary", label: "还要注意", text: boundary });
  const thesis = cleanText(note.thesis);
  if (thesis) steps.push({ kind: "current", label: "当前观点", text: thesis });
  return steps;
}

export function renderPermanentNoteFormation(note = {}, relations = {}, options = {}) {
  const steps = permanentNoteFormationSteps(note, relations, options);
  return `
    <section class="viewpoint-formation" aria-label="观点形成过程">
      <header class="viewpoint-formation-head">
        <strong>这条观点怎么形成的</strong>
        <span>${steps.length ? `${steps.length} 个线索` : "还没有线索"}</span>
      </header>
      ${steps.length ? `
        <ol class="viewpoint-formation-list">
          ${steps.map((step) => `
            <li class="viewpoint-formation-step is-${escapeHtml(step.kind)}">
              <span>${escapeHtml(step.label)}</span>
              <strong>${escapeHtml(step.text)}</strong>
              ${step.detail ? `<small>${escapeHtml(step.detail).replaceAll("\n", "<br>")}</small>` : ""}
            </li>
          `).join("")}
        </ol>
      ` : `<p class="viewpoint-formation-empty">保存当前观点后，这里会显示结果；以后确认观点变化时，会继续记录原因和依据。</p>`}
    </section>
  `;
}
