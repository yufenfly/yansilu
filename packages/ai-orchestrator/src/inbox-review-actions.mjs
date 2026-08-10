import { randomUUID } from "node:crypto";
import { transitionSuggestionStatus } from "./suggestions.mjs";

function cleanText(value) {
  return String(value || "").trim();
}

function latestDecision(artifact = {}) {
  const decisions = Array.isArray(artifact.userDecisions) ? artifact.userDecisions : [];
  return decisions[decisions.length - 1] || null;
}

function hasRelationOverride(body = {}) {
  return [
    body.fromNoteId,
    body.from_note_id,
    body.toNoteId,
    body.to_note_id,
    body.relationType,
    body.relation_type
  ].some((value) => cleanText(value));
}

export function noteRestoreInputFromSnapshot(note = {}) {
  return {
    title: note.title,
    body: note.body,
    status: note.status || "draft",
    thesis: note.thesis ?? "",
    threeLineSummary: Array.isArray(note.threeLineSummary) ? [...note.threeLineSummary] : [],
    startingQuestion: note.startingQuestion ?? "",
    viewpointHistory: Array.isArray(note.viewpointHistory) ? note.viewpointHistory.map((item) => ({ ...item })) : [],
    pendingViewpointRevision: note.pendingViewpointRevision ? { ...note.pendingViewpointRevision } : null,
    distillationStatus: note.distillationStatus ?? "missing",
    authorship: note.authorship ? { ...note.authorship } : { user_confirmed: false, ai_assisted: false },
    boundaryOrCounterpoint: note.boundaryOrCounterpoint ?? ""
  };
}

export function degradedSuggestionTraceFromArtifact(artifact = {}) {
  const payload = artifact.payload && typeof artifact.payload === "object" ? artifact.payload : {};
  const embeddedSuggestion =
    payload.fieldSuggestion && typeof payload.fieldSuggestion === "object"
      ? payload.fieldSuggestion
      : payload.field_suggestion && typeof payload.field_suggestion === "object"
        ? payload.field_suggestion
        : {};
  const target = embeddedSuggestion.target && typeof embeddedSuggestion.target === "object" ? embeddedSuggestion.target : {};
  const sourceNoteIds = Array.isArray(artifact.sources?.noteIds) ? artifact.sources.noteIds.filter(Boolean) : [];
  const suggestionId = cleanText(payload.fieldSuggestionId || payload.field_suggestion_id || embeddedSuggestion.id);
  if (!suggestionId && !cleanText(target.id) && !cleanText(target.field)) return null;
  return {
    suggestionId,
    sourceArtifactId: cleanText(artifact.id),
    primarySourceNoteId: cleanText(sourceNoteIds[0]),
    sourceNoteIds,
    targetNoteId: cleanText(target.id),
    targetField: cleanText(target.field),
    suggestionStatus: "missing"
  };
}

export async function acceptLinkAndRecordArtifactDecisionAtomically({
  artifactStore,
  artifactId,
  body = {},
  createRelation,
  deleteRelation
} = {}) {
  if (!artifactStore || typeof artifactStore.recordDecision !== "function") {
    const error = new Error("artifactStore.recordDecision is required");
    error.code = "AI_LINK_SUGGESTION_DECISION_REQUIRED";
    throw error;
  }
  if (typeof createRelation !== "function") {
    const error = new Error("createRelation is required");
    error.code = "AI_LINK_SUGGESTION_RELATION_REQUIRED";
    throw error;
  }

  const originalArtifact = typeof artifactStore.getArtifact === "function" ? artifactStore.getArtifact(artifactId) : null;
  const relation = await createRelation();
  const priorDecision = latestDecision(originalArtifact);
  if (
    relation?.created === false &&
    !hasRelationOverride(body) &&
    cleanText(priorDecision?.decision) === "linked_to_note" &&
    cleanText(priorDecision?.noteId || priorDecision?.note_id) === cleanText(relation.fromNoteId)
  ) {
    return { relation, artifact: originalArtifact };
  }
  try {
    const artifact = artifactStore.recordDecision(artifactId, {
      decision: "linked_to_note",
      userId: body.userId || body.user_id || "local_user",
      noteId: relation.fromNoteId,
      comment: body.comment || `Accepted LinkSuggestion as ${relation.relationType} relation.`
    });
    return { relation, artifact };
  } catch (error) {
    if (originalArtifact) {
      try {
        if (typeof artifactStore.replaceArtifact === "function") {
          artifactStore.replaceArtifact(originalArtifact);
        } else if (typeof artifactStore.updateArtifact === "function") {
          artifactStore.updateArtifact(artifactId, {
            status: originalArtifact.status,
            payload: originalArtifact.payload,
            provenance: originalArtifact.provenance,
            updatedAt: originalArtifact.updatedAt
          });
        }
      } catch {}
    }
    if (relation?.created === true && relation?.id && typeof deleteRelation === "function") {
      try {
        await deleteRelation(relation.id);
      } catch (rollbackError) {
        error.details = {
          ...(error.details && typeof error.details === "object" ? error.details : {}),
          relationRollbackFailed: true,
          relationRollbackMessage: String(rollbackError?.message || rollbackError),
          relationId: relation.id
        };
      }
    }
    throw error;
  }
}

export async function promoteNoteAndRecordArtifactDecisionAtomically({
  artifactStore,
  artifactId,
  body = {},
  createDraftNote,
  deleteDraftNote
} = {}) {
  if (!artifactStore || typeof artifactStore.recordDecision !== "function") {
    const error = new Error("artifactStore.recordDecision is required");
    error.code = "AI_NOTE_PROMOTION_DECISION_REQUIRED";
    throw error;
  }
  if (typeof createDraftNote !== "function") {
    const error = new Error("createDraftNote is required");
    error.code = "AI_NOTE_PROMOTION_NOTE_REQUIRED";
    throw error;
  }

  const originalArtifact = typeof artifactStore.getArtifact === "function" ? artifactStore.getArtifact(artifactId) : null;
  const note = await createDraftNote();
  try {
    const artifact = artifactStore.recordDecision(artifactId, {
      decision: "promoted_to_note",
      userId: body.userId || body.user_id || "local_user",
      noteId: note.id,
      comment: body.comment || `Promoted note artifact into draft note ${note.id}.`
    });
    return { note, artifact };
  } catch (error) {
    if (originalArtifact) {
      try {
        if (typeof artifactStore.replaceArtifact === "function") {
          artifactStore.replaceArtifact(originalArtifact);
        } else if (typeof artifactStore.updateArtifact === "function") {
          artifactStore.updateArtifact(artifactId, {
            status: originalArtifact.status,
            payload: originalArtifact.payload,
            provenance: originalArtifact.provenance,
            updatedAt: originalArtifact.updatedAt
          });
        }
      } catch {}
    }
    if (note?.id && typeof deleteDraftNote === "function") {
      try {
        await deleteDraftNote(note.id);
      } catch (rollbackError) {
        error.details = {
          ...(error.details && typeof error.details === "object" ? error.details : {}),
          noteRollbackFailed: true,
          noteRollbackMessage: String(rollbackError?.message || rollbackError),
          noteId: note.id
        };
      }
    }
    throw error;
  }
}

export async function adoptSuggestionAndLinkedArtifactAtomically({
  suggestionStore,
  artifactStore,
  sourceArtifact,
  fieldSuggestion,
  body = {},
  originalNote = null,
  applyNoteUpdate,
  restoreNote,
  buildAdoptedArtifactPayload,
  getSuggestionIdFromArtifact,
  loadSqliteDatabaseSync
} = {}) {
  if (typeof applyNoteUpdate !== "function") {
    const error = new Error("applyNoteUpdate is required");
    error.code = "AI_FIELD_SUGGESTION_UPDATE_REQUIRED";
    throw error;
  }
  if (!sourceArtifact?.id) {
    const error = new Error("sourceArtifact is required");
    error.code = "AI_ARTIFACT_NOT_FOUND";
    throw error;
  }
  if (typeof buildAdoptedArtifactPayload !== "function") {
    const error = new Error("buildAdoptedArtifactPayload is required");
    error.code = "AI_FIELD_SUGGESTION_PAYLOAD_REQUIRED";
    throw error;
  }
  if (typeof getSuggestionIdFromArtifact !== "function") {
    const error = new Error("getSuggestionIdFromArtifact is required");
    error.code = "AI_FIELD_SUGGESTION_ID_REQUIRED";
    throw error;
  }

  const updatedNote = await applyNoteUpdate();
  try {
    const suggestionId = getSuggestionIdFromArtifact(sourceArtifact);
    const now = new Date().toISOString();
    const comment = body.comment || `Adopted ${fieldSuggestion.field} suggestion as a draft field.`;
    const decisionInput = {
      decision: "adopted_as_draft",
      userId: body.userId || body.user_id || "local_user",
      noteId: updatedNote.id,
      comment,
      feedback: body.feedback,
      createdAt: now
    };
    let nextSuggestion = null;
    if (suggestionId && suggestionStore) {
      const currentSuggestion = suggestionStore.get(suggestionId);
      if (!currentSuggestion) {
        const error = new Error(`suggestionId not found: ${suggestionId}`);
        error.code = "AI_SUGGESTION_NOT_FOUND";
        throw error;
      }
      nextSuggestion = transitionSuggestionStatus(currentSuggestion, "adopted_as_draft", {
        action: "adopt_as_draft",
        actor: "user",
        userId: decisionInput.userId,
        noteId: updatedNote.id,
        comment,
        feedback: body.feedback,
        createdAt: now
      });
    }

    const nextArtifactPayload = buildAdoptedArtifactPayload(sourceArtifact, fieldSuggestion, updatedNote, nextSuggestion);
    const nextArtifactProvenance = {
      ...(sourceArtifact.provenance || {}),
      humanAccepted: true,
      humanRewritten: sourceArtifact.provenance?.humanRewritten === true
    };

    if (
      suggestionStore?.dbPath &&
      artifactStore?.dbPath &&
      suggestionStore.dbPath === artifactStore.dbPath &&
      typeof loadSqliteDatabaseSync === "function"
    ) {
      const DatabaseSync = await loadSqliteDatabaseSync();
      const db = new DatabaseSync(artifactStore.dbPath);
      db.exec("PRAGMA journal_mode = WAL;");
      db.exec("PRAGMA foreign_keys = ON;");
      db.exec("BEGIN IMMEDIATE;");
      try {
        db.prepare(
          `UPDATE ai_artifacts
           SET status = ?, updated_at = ?, provenance_json = ?, payload_json = ?
           WHERE id = ?`
        ).run(
          "adopted_as_draft",
          now,
          JSON.stringify(nextArtifactProvenance),
          JSON.stringify(nextArtifactPayload),
          sourceArtifact.id
        );

        db.prepare(
          `INSERT INTO ai_artifact_decisions
            (id, artifact_id, user_id, decision, note_id, comment, feedback_json, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(
          `decision_${randomUUID().slice(0, 8)}`,
          sourceArtifact.id,
          decisionInput.userId,
          "adopted_as_draft",
          updatedNote.id,
          comment,
          JSON.stringify(decisionInput.feedback || {}),
          now
        );

        if (nextSuggestion) {
          db.prepare(
            `INSERT OR REPLACE INTO ai_suggestions
              (id, target_type, target_id, target_field, source_artifact_id, target_json, scope, content_json, status, origin, model_json, provenance_json, history_json, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          ).run(
            nextSuggestion.id,
            nextSuggestion.target.type,
            nextSuggestion.target.id,
            nextSuggestion.target.field || "",
            nextSuggestion.sourceArtifactId || "",
            JSON.stringify(nextSuggestion.target),
            nextSuggestion.scope,
            JSON.stringify(nextSuggestion.content),
            nextSuggestion.status,
            nextSuggestion.origin,
            JSON.stringify(nextSuggestion.model),
            JSON.stringify(nextSuggestion.provenance),
            JSON.stringify(nextSuggestion.history),
            nextSuggestion.createdAt,
            nextSuggestion.updatedAt
          );
        }

        db.exec("COMMIT;");
      } catch (error) {
        db.exec("ROLLBACK;");
        throw error;
      } finally {
        db.close();
      }

      return {
        note: updatedNote,
        artifact: artifactStore.getArtifact(sourceArtifact.id),
        suggestion: suggestionId && suggestionStore ? suggestionStore.get(suggestionId) : null
      };
    }

    const originalArtifact = artifactStore.getArtifact(sourceArtifact.id);
    const originalSuggestion = suggestionId && suggestionStore ? suggestionStore.get(suggestionId) : null;
    try {
      artifactStore.updateArtifact(sourceArtifact.id, {
        status: "adopted_as_draft",
        payload: nextArtifactPayload,
        provenance: nextArtifactProvenance,
        updatedAt: now
      });
      const artifact = artifactStore.recordDecision(sourceArtifact.id, decisionInput);
      const suggestion = nextSuggestion && suggestionStore
        ? suggestionStore.transition(suggestionId, "adopted_as_draft", {
            action: "adopt_as_draft",
            actor: "user",
            userId: decisionInput.userId,
            noteId: updatedNote.id,
            comment,
            feedback: body.feedback,
            createdAt: now
          })
        : null;
      return {
        note: updatedNote,
        artifact,
        suggestion
      };
    } catch (error) {
      if (originalSuggestion && suggestionStore && typeof suggestionStore.replace === "function") {
        try {
          suggestionStore.replace(originalSuggestion, { allowReviewedCreate: true });
        } catch {}
      }
      if (originalArtifact) {
        try {
          if (typeof artifactStore.replaceArtifact === "function") {
            artifactStore.replaceArtifact(originalArtifact);
          } else {
            artifactStore.updateArtifact(sourceArtifact.id, {
              status: originalArtifact.status,
              payload: originalArtifact.payload,
              provenance: originalArtifact.provenance,
              updatedAt: originalArtifact.updatedAt
            });
          }
        } catch {}
      }
      throw error;
    }
  } catch (error) {
    if (typeof restoreNote === "function" && originalNote) {
      try {
        await restoreNote(noteRestoreInputFromSnapshot(originalNote));
      } catch (rollbackError) {
        error.details = {
          ...(error.details && typeof error.details === "object" ? error.details : {}),
          noteRollbackFailed: true,
          noteRollbackMessage: String(rollbackError?.message || rollbackError)
        };
      }
    }
    throw error;
  }
}
