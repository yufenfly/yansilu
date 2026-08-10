function cleanText(value = "") {
  return String(value || "").trim();
}

function relationEndpoint(relation = {}, direction = "target") {
  const embedded = relation?.[direction] || null;
  const isTarget = direction === "target";
  return {
    id: cleanText(
      embedded?.id ||
        relation?.[isTarget ? "toNoteId" : "fromNoteId"] ||
        relation?.[isTarget ? "to_note_id" : "from_note_id"]
    ),
    title: cleanText(
      embedded?.title ||
        relation?.[isTarget ? "toNoteTitle" : "fromNoteTitle"] ||
        relation?.[isTarget ? "targetTitle" : "sourceTitle"] ||
        relation?.[isTarget ? "target_title" : "source_title"]
    )
  };
}

export function relationOtherEndpoint(relation = {}, currentNoteId = "") {
  const currentId = cleanText(currentNoteId);
  const target = relationEndpoint(relation, "target");
  const source = relationEndpoint(relation, "source");
  if (target.id && target.id !== currentId) return target;
  if (source.id && source.id !== currentId) return source;
  return target.id || target.title ? target : source;
}
