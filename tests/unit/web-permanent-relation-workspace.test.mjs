import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import { renderPermanentRelationWorkspace } from "../../apps/web/src/permanent-relation-workspace.js";
import {
  defaultPermanentRelationWorkspaceState,
  normalizePermanentRelationAiCandidates,
  normalizePermanentRelationWorkspaceState,
  permanentRelationWorkspaceCanSave,
  permanentRelationWorkspaceExistingLink,
  permanentRelationWorkspaceNextAiCandidate
} from "../../apps/web/src/permanent-relation-workspace-model.js";

const prototypeCss = fs.readFileSync(new URL("../../apps/web/src/prototype.css", import.meta.url), "utf8");

const note = {
  id: "pn_source",
  title: "当前永久笔记",
  noteType: "permanent",
  folderId: "dir_a",
  thesis: "关系整理只处理笔记之间为什么要连接。"
};

const target = {
  id: "pn_target",
  title: "目标永久笔记",
  noteType: "permanent",
  folderId: "dir_a",
  thesis: "好的连接要写清关系类型和理由。"
};

const deps = {
  folderLabel: () => "永久笔记",
  typeFromFolder: () => "permanent"
};

test("permanent relation workspace renders a large relation-only flow", () => {
  const html = renderPermanentRelationWorkspace({
    note,
    notes: [note, target],
    aiCandidates: [
      {
        targetNoteId: target.id,
        targetTitle: target.title,
        relationType: "supports",
        rationaleDraft: "目标笔记支持当前笔记，因为它说明了连接理由的保存价值。"
      }
    ],
    state: {
      ...defaultPermanentRelationWorkspaceState(note.id),
      open: true,
      selectedTargetNoteId: target.id,
      relationType: "supports",
      rationale: "目标笔记支持当前笔记，因为它说明了连接理由的保存价值。"
    },
    deps
  });

  assert.match(html, /data-permanent-relation-workspace/);
  assert.match(html, />关联</);
  assert.match(html, /目标笔记/);
  assert.match(html, /已选择/);
  assert.match(html, /它和这条笔记是什么关系？/);
  assert.match(html, /支持它/);
  assert.match(html, /不同意它/);
  assert.match(html, /让我想到它/);
  assert.match(html, /更多关系/);
  assert.match(html, /为什么这么想？/);
  assert.match(html, /placeholder="例如：这条笔记补充了前一条判断在什么条件下成立。"/);
  assert.match(html, />关联</);
  assert.doesNotMatch(html, /role="tablist"/);
  assert.doesNotMatch(html, /data-permanent-relation-target-preview-slot/);
  assert.doesNotMatch(html, /data-permanent-relation-ai-target/);
  assert.doesNotMatch(html, />当前笔记</);
  assert.doesNotMatch(html, /data-permanent-relation-ai-select/);
  assert.doesNotMatch(html, /推荐只作为候选；保存前请确认关系类型和理由/);
  assert.doesNotMatch(html, /选目标、写理由、保存/);
  assert.doesNotMatch(html, /观点提纯/);
  assert.doesNotMatch(html, /准备写作/);
  assert.doesNotMatch(html, /进入草稿/);
  assert.doesNotMatch(html, /appears_in_draft/);
});

test("permanent relation workspace blocks duplicate relation saves", () => {
  const relations = {
    outgoingLinks: [
      {
        id: "rel_1",
        fromNoteId: note.id,
        toNoteId: target.id,
        relationType: "supports"
      }
    ],
    backlinks: []
  };
  const state = {
    ...defaultPermanentRelationWorkspaceState(note.id),
    open: true,
    selectedTargetNoteId: target.id,
    relationType: "supports",
    rationale: "这条理由已经够明确。"
  };

  assert.equal(permanentRelationWorkspaceExistingLink(relations, note.id, target.id)?.id, "rel_1");
  const validation = permanentRelationWorkspaceCanSave({ state, relations });
  assert.equal(validation.ok, false);
  assert.equal(validation.reason, "existing_relation");
});

test("permanent relation workspace ignores wikilink-only relations when checking duplicates", () => {
  const relations = {
    outgoingLinks: [
      {
        id: "wiki_1",
        fromNoteId: note.id,
        toNoteId: target.id,
        relationType: "associated_with",
        rationale: "markdown_wikilink"
      }
    ],
    backlinks: []
  };
  const state = {
    ...defaultPermanentRelationWorkspaceState(note.id),
    open: true,
    selectedTargetNoteId: target.id,
    relationType: "supports",
    rationale: "formal reason"
  };

  assert.equal(permanentRelationWorkspaceExistingLink(relations, note.id, target.id), null);
  const validation = permanentRelationWorkspaceCanSave({ state, relations });
  assert.equal(validation.ok, true);
});

test("permanent relation workspace keeps saved-relation counts out of the focused overlay", () => {
  const relations = {
    outgoingLinks: [
      {
        id: "wiki_1",
        fromNoteId: note.id,
        toNoteId: target.id,
        relationType: "associated_with",
        rationale: "markdown_wikilink"
      },
      {
        id: "archived_1",
        fromNoteId: note.id,
        toNoteId: "pn_archived",
        relationType: "supports",
        rationale: "archived relation",
        status: "archived"
      }
    ],
    backlinks: [
      {
        id: "rel_1",
        fromNoteId: "pn_backlink",
        toNoteId: note.id,
        relationType: "supports",
        rationale: "explicit relation"
      }
    ]
  };
  const html = renderPermanentRelationWorkspace({
    note,
    notes: [note, target],
    relations,
    state: {
      ...defaultPermanentRelationWorkspaceState(note.id),
      open: true
    },
    deps
  });

  assert.match(html, /目标笔记/);
  assert.match(html, /为什么这么想？/);
  assert.doesNotMatch(html, /permanent-relation-source-status/);
  assert.doesNotMatch(html, />1 条已保存关系</);
  assert.doesNotMatch(html, />3 条已保存关系</);
});

test("permanent relation workspace keeps non-writing relation types available", () => {
  const html = renderPermanentRelationWorkspace({
    note,
    notes: [note, target],
    state: {
      ...defaultPermanentRelationWorkspaceState(note.id),
      open: true,
      selectedTargetNoteId: target.id,
      relationType: "reframes",
      rationale: "formal reason"
    },
    deps
  });

  assert.match(html, /<option value="reframes" selected>/);
  assert.match(html, /<option value="restates"/);
  assert.doesNotMatch(html, /value="appears_in_draft"/);
});

test("permanent relation workspace keeps save reachable but validates missing rationale", () => {
  const html = renderPermanentRelationWorkspace({
    note,
    notes: [note, target],
    state: {
      ...defaultPermanentRelationWorkspaceState(note.id),
      open: true,
      selectedTargetNoteId: target.id,
      relationType: "associated_with",
      rationale: ""
    },
    deps
  });

  assert.match(html, /type="submit"[^>]*>[^<]*<\/button>/);
  const validation = permanentRelationWorkspaceCanSave({
    state: {
      ...defaultPermanentRelationWorkspaceState(note.id),
      open: true,
      selectedTargetNoteId: target.id,
      relationType: "associated_with",
      rationale: ""
    }
  });
  assert.equal(validation.ok, false);
  assert.equal(validation.reason, "missing_rationale");
});

test("permanent relation workspace edits existing relations in the overlay", () => {
  const relations = {
    outgoingLinks: [
      {
        id: "rel_existing",
        fromNoteId: note.id,
        toNoteId: target.id,
        relationType: "supports",
        rationale: "old reason"
      }
    ],
    backlinks: []
  };
  const state = {
    ...defaultPermanentRelationWorkspaceState(note.id),
    open: true,
    selectedTargetNoteId: target.id,
    relationType: "qualifies",
    rationale: "新的理由已经写清楚。"
  };
  const html = renderPermanentRelationWorkspace({
    note,
    notes: [note, target],
    relations,
    state,
    deps
  });

  assert.match(html, />保存修改</);
  assert.doesNotMatch(html, /编辑现有关系/);
  assert.match(html, /data-relation-action="delete"/);
  assert.match(html, /data-relation-id="rel_existing"/);
  assert.match(html, /<option value="qualifies" selected>/);
  assert.match(html, /is-editing-existing/);
  assert.doesNotMatch(html, /data-relation-action="open-edit"/);
  assert.doesNotMatch(html, /data-permanent-relation-target-search/);
  assert.doesNotMatch(html, /data-permanent-relation-manual-results/);
  assert.doesNotMatch(html, /data-permanent-relation-recommendations/);
  assert.doesNotMatch(html, /data-permanent-relation-target-preview-slot/);
  assert.doesNotMatch(html, /data-permanent-relation-action="run-ai"/);
  assert.doesNotMatch(html, /data-permanent-relation-action="preview-target"/);
  const validation = permanentRelationWorkspaceCanSave({ state, relations, allowExistingUpdate: true });
  assert.equal(validation.ok, true);
  assert.equal(validation.reason, "update_existing");
  assert.equal(validation.existing.id, "rel_existing");
});

test("permanent relation workspace labels updated relation results clearly", () => {
  const html = renderPermanentRelationWorkspace({
    note,
    notes: [note, target],
    state: {
      ...defaultPermanentRelationWorkspaceState(note.id),
      open: true,
      selectedTargetNoteId: target.id,
      relationType: "supports",
      rationale: "更新后的理由。",
      result: {
        targetNoteId: target.id,
        targetTitle: target.title,
        relationType: "supports",
        updated: true
      }
    },
    deps
  });

  assert.match(html, /关系已更新/);
  assert.doesNotMatch(html, /关系已存在，已复用/);
});

test("permanent relation workspace renders manual candidates as a title-only dropdown", () => {
  const html = renderPermanentRelationWorkspace({
    note,
    state: {
      ...defaultPermanentRelationWorkspaceState(note.id),
      open: true,
      mode: "manual",
      manualQuery: "目标",
      manualTargets: [target]
    },
    deps: {
      ...deps,
      folderLabel: () => "未知目录"
    }
  });

  assert.match(html, /permanent-relation-dropdown/);
  assert.match(html, /permanent-relation-candidate-list is-dropdown/);
  assert.match(html, new RegExp(target.title));
  assert.doesNotMatch(html, />永久笔记</);
  assert.doesNotMatch(html, /未知目录/);
  assert.doesNotMatch(html, /选中后写理由/);
});

test("permanent relation workspace places AI recommendation before manual search", () => {
  const html = renderPermanentRelationWorkspace({
    note,
    state: {
      ...defaultPermanentRelationWorkspaceState(note.id),
      open: true,
      mode: "manual"
    },
    deps
  });

  const recommendIndex = html.indexOf('data-permanent-relation-action="recommend"');
  const searchIndex = html.indexOf("data-permanent-relation-target-search");
  assert.ok(recommendIndex >= 0, "expected AI recommendation action");
  assert.ok(searchIndex >= 0, "expected manual target search");
  assert.ok(recommendIndex < searchIndex, "AI recommendation should appear before the search input");
});

test("permanent relation manual search shows search errors inside the results area", () => {
  const html = renderPermanentRelationWorkspace({
    note,
    state: {
      ...defaultPermanentRelationWorkspaceState(note.id),
      open: true,
      mode: "manual",
      manualQuery: "目标",
      searchState: "error",
      error: "搜索失败：网络不可用"
    },
    deps
  });

  assert.match(html, /搜索暂时失败/);
  assert.match(html, /permanent-relation-dropdown-empty is-error/);
  assert.match(html, /搜索失败：网络不可用/);
  assert.doesNotMatch(html, /没有匹配笔记/);
});

test("permanent relation workspace shows AI recommendations only in recommendation mode", () => {
  const html = renderPermanentRelationWorkspace({
    note,
    notes: [note, target],
    aiCandidates: [
      {
        targetNoteId: target.id,
        targetTitle: "YJ-D09",
        relationType: "contrasts",
        coarseScore: 0.46,
        rationaleDraft: "local candidate reason"
      }
    ],
    state: {
      ...defaultPermanentRelationWorkspaceState(note.id),
      open: true,
      mode: "ai"
    },
    deps
  });

  assert.match(html, /AI推荐/);
  assert.match(html, /data-permanent-relation-ai-target="pn_target"/);
  assert.match(html, new RegExp(target.title));
  assert.doesNotMatch(html, /YJ-D09/);
  assert.match(html, /local candidate reason/);
  assert.doesNotMatch(html, /46%/);
  assert.doesNotMatch(html, /data-permanent-relation-ai-select/);
  assert.match(html, /data-permanent-relation-form hidden/);
});

test("permanent relation workspace CSS hides the form while AI recommendations are shown", () => {
  assert.match(prototypeCss, /\.permanent-relation-confirm\[hidden\]\s*\{[\s\S]*display:\s*none;/);
});

test("permanent relation workspace shows active wait state while AI recommendations prepare", () => {
  const html = renderPermanentRelationWorkspace({
    note,
    notes: [note, target],
    aiCandidates: [],
    state: {
      ...defaultPermanentRelationWorkspaceState(note.id),
      open: true,
      mode: "ai"
    },
    deps
  });

  assert.match(html, /permanent-relation-empty is-loading/);
  assert.match(html, /正在分析当前笔记，可能需要等一下/);
  assert.match(html, /permanent-relation-loading-dots/);
  assert.match(html, /aria-live="polite"/);
});

test("permanent relation workspace tells the user when AI finds no recommendations", () => {
  const html = renderPermanentRelationWorkspace({
    note,
    notes: [note, target],
    aiCandidates: [],
    state: {
      ...defaultPermanentRelationWorkspaceState(note.id),
      open: true,
      mode: "ai",
      notice: "这条笔记暂时没有可推荐的关联，可以改用搜索笔记。"
    },
    deps
  });

  assert.match(html, /暂时没有推荐/);
  assert.match(html, /这条笔记暂时没有可推荐的关联/);
  assert.match(html, /data-permanent-relation-mode="manual"/);
  assert.doesNotMatch(html, /正在准备推荐/);
  assert.doesNotMatch(html, /permanent-relation-loading-dots/);
});


test("AI relation candidates normalize target, type and rationale for the workspace", () => {
  const candidates = normalizePermanentRelationAiCandidates(
    {
      analysis: {
        relationCandidates: [
          {
            actionSourceNoteId: note.id,
            counterpartNoteId: target.id,
            counterpartTitle: target.title,
            relationType: "qualifies",
            rationaleDraft: "目标笔记限定当前笔记，因为它补充了适用条件。"
          },
          {
            actionSourceNoteId: note.id,
            counterpartNoteId: "pn_reject",
            aiDecision: "reject",
            relationType: "no_relation"
          },
          {
            actionSourceNoteId: note.id,
            counterpartNoteId: "pn_draft",
            relationType: "appears_in_draft"
          }
        ]
      }
    },
    note.id
  );

  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].targetNoteId, target.id);
  assert.equal(candidates[0].targetTitle, target.title);
  assert.equal(candidates[0].relationType, "qualifies");
  assert.match(candidates[0].rationaleDraft, /适用条件/);
});

test("AI relation candidates normalize snake_case artifact payload fields", () => {
  const candidates = normalizePermanentRelationAiCandidates(
    {
      analysis: {
        bridgeCandidates: [
          {
            source_note_id: note.id,
            target_note_id: target.id,
            target_title: "snake case target",
            relation_type: "supports",
            ai_relation_type: "qualifies",
            ai_confidence: 0.73,
            ai_rationale: "目标笔记给当前判断补充了边界条件。",
            review_question: "这个边界是否只适用于当前场景？",
            ai_decision: "accept"
          }
        ]
      }
    },
    note.id
  );

  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].targetNoteId, target.id);
  assert.equal(candidates[0].targetTitle, "snake case target");
  assert.equal(candidates[0].relationType, "qualifies");
  assert.equal(candidates[0].aiConfidence, 0.73);
  assert.equal(candidates[0].rationaleDraft, "目标笔记给当前判断补充了边界条件。");
  assert.equal(candidates[0].insightQuestionDraft, "这个边界是否只适用于当前场景？");
});

test("permanent relation AI recommendations normalize confidence without showing it in the simple flow", () => {
  const candidates = normalizePermanentRelationAiCandidates(
    {
      analysis: {
        bridgeCandidates: [
          {
            source_note_id: note.id,
            target_note_id: target.id,
            target_title: target.title,
            ai_relation_type: "supports",
            ai_confidence: 0.73,
            ai_rationale: "目标笔记可以支持当前判断。"
          }
        ]
      }
    },
    note.id
  );
  const html = renderPermanentRelationWorkspace({
    note,
    notes: [note, target],
    aiCandidates: candidates,
    state: {
      ...defaultPermanentRelationWorkspaceState(note.id),
      open: true,
      mode: "ai"
    },
    deps
  });

  assert.equal(candidates[0].aiConfidence, 0.73);
  assert.doesNotMatch(html, /73%/);
  assert.match(html, /data-permanent-relation-ai-target="pn_target"/);
  assert.match(html, /目标笔记可以支持当前判断。/);
});

test("permanent relation workspace continues with the next unsaved AI candidate", () => {
  const candidates = [
    {
      targetNoteId: "pn_done",
      targetTitle: "Done",
      relationType: "supports",
      rationaleDraft: "already saved"
    },
    {
      targetNoteId: "pn_next",
      targetTitle: "Next",
      relationType: "qualifies",
      rationaleDraft: "next relation"
    }
  ];
  const relations = {
    outgoingLinks: [
      {
        fromNoteId: note.id,
        toNoteId: "pn_done",
        relationType: "supports",
        rationale: "already saved"
      }
    ],
    backlinks: []
  };

  const next = permanentRelationWorkspaceNextAiCandidate(candidates, relations, note.id);

  assert.equal(next.targetNoteId, "pn_next");
  assert.equal(next.relationType, "qualifies");
  assert.equal(permanentRelationWorkspaceNextAiCandidate(candidates, relations, note.id, ["pn_next"]), null);
});

test("workspace state normalization follows the currently rendered note", () => {
  const normalized = normalizePermanentRelationWorkspaceState({
    open: true,
    noteId: "old-note",
    selectedTargetNoteId: target.id,
    relationType: "supports",
    rationale: "because"
  }, "current-note");

  assert.equal(normalized.noteId, "current-note");
});
