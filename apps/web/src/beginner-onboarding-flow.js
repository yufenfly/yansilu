function cleanText(value = "") {
  return String(value || "").trim();
}

function noteIdSet(notes = []) {
  return new Set((Array.isArray(notes) ? notes : []).map((note) => cleanText(note?.id)).filter(Boolean));
}

export const SMART_NOTES_DEMO_WALKTHROUGH_STEPS = [
  {
    key: "first-judgment",
    title: "把记录说成自己的判断",
    note: "先看一条材料怎样经过转述，变成可以长期复用的观点。",
    action: "open-demo-note",
    targetNoteId: "PERM-WRITING-STARTS-BEFORE-DRAFT",
    noteIds: [
      "GUIDE-SMART-NOTES-START",
      "SRC-SMART-NOTES",
      "FN-PHONE-CAPTURE-UNPROCESSED",
      "LN-WRITING-AS-DAILY-PRACTICE",
      "PERM-WRITING-STARTS-BEFORE-DRAFT"
    ]
  },
  {
    key: "first-relation",
    title: "说明两条观点为什么有关",
    note: "选择一条相关笔记，写一句它为什么支持、不同意或让你想到另一条。",
    action: "open-demo-note-relations",
    targetNoteId: "PERM-UNLINKED-PRACTICE",
    noteIds: ["PERM-UNLINKED-PRACTICE"]
  },
  {
    key: "write-from-notes",
    title: "看看观点怎样进入写作",
    note: "从一个问题和已有观点开始组织文章，不必从空白页硬写。",
    action: "open-demo-writing",
    targetNoteId: "WRITE-SMART-NOTES-DEMO",
    noteIds: ["WRITE-SMART-NOTES-DEMO", "DRAFT-SMART-NOTES-DEMO"]
  },
];

export function isSmartNotesDemoScope(notes = []) {
  const ids = noteIdSet(notes);
  return ids.has("GUIDE-SMART-NOTES-START") || ids.has("GUIDE-SN-001") || ids.has("SRC-SMART-NOTES");
}

export function buildSmartNotesDemoWalkthrough({ notes = [], selectedNoteId = "" } = {}) {
  const ids = noteIdSet(notes);
  if (!isSmartNotesDemoScope(notes)) return null;
  const activeNoteId = cleanText(selectedNoteId);
  const availableSteps = SMART_NOTES_DEMO_WALKTHROUGH_STEPS.map((step) => ({
    ...step,
    available: step.noteIds.some((id) => ids.has(id)) || ids.has(step.targetNoteId)
  }));
  const activeIndex = Math.max(
    0,
    availableSteps.findIndex((step) => step.noteIds.includes(activeNoteId) || step.targetNoteId === activeNoteId)
  );
  const steps = availableSteps.map((step, index) => ({
    ...step,
    done: index < activeIndex,
    active: index === activeIndex
  }));
  const active = steps[activeIndex] || steps[0] || null;
  return {
    kind: "smart-notes-demo",
    title: "从记录到写作",
    note: active ? `下一步：${active.title}。${active.note}` : "按三步看完从记录到文章的主路径。",
    activeStepKey: active?.key || "",
    steps
  };
}

export function smartNotesDemoActionLabel(step = {}, index = 0) {
  const action = cleanText(step.action);
  if (action === "open-demo-note-relations") return "打开并关联";
  if (action === "open-demo-writing") return "进入写作中心";
  if (action === "open-demo-review") return "回到首页";
  return `打开第 ${Number(index) + 1 || 1} 步笔记`;
}

function smartNotesDemoActionCanRun(step = {}) {
  const action = cleanText(step.action || "open-demo-note");
  if (action === "open-demo-note" || action === "open-demo-note-relations") {
    return !!cleanText(step.targetNoteId);
  }
  return !!action;
}

export function renderSmartNotesDemoWalkthrough(flow = {}, deps = {}) {
  const { escapeHtml = (value) => String(value ?? "") } = deps;
  const steps = Array.isArray(flow.steps) ? flow.steps : [];
  const activeIndex = Math.max(0, steps.findIndex((step) => step.active));
  const active = steps[activeIndex] || steps[0] || {};
  const action = active.action || "open-demo-note";
  const actionLabel = smartNotesDemoActionLabel(active, activeIndex);
  const canRunAction = smartNotesDemoActionCanRun(active);
  return `
    <div class="sidebar-flow-card" data-smart-notes-demo-walkthrough>
      <div>
        <div class="sidebar-flow-kicker">3 分钟示例</div>
        <div class="sidebar-flow-title">${escapeHtml(flow.title || "从记录到写作")}</div>
        <div class="sidebar-flow-note">${escapeHtml(flow.note || "下一步只做一个动作。")}</div>
      </div>
      <div class="sidebar-flow-current" aria-label="Smart Notes demo 当前步骤">
        <span>第 ${escapeHtml(activeIndex + 1)} / ${escapeHtml(steps.length || 3)} 步</span>
        <strong>${escapeHtml(active.title || "继续 Demo 导览")}</strong>
      </div>
      <button
        class="sidebar-flow-action primary"
        type="button"
        data-sidebar-flow-action="${escapeHtml(action)}"
        data-sidebar-flow-note-id="${escapeHtml(active.targetNoteId || "")}"
        ${canRunAction ? "" : "disabled"}
      >${escapeHtml(actionLabel)}</button>
    </div>
  `;
}

export function renderSmartNotesDemoGuidePanel(flow = {}, deps = {}) {
  const { escapeHtml = (value) => String(value ?? "") } = deps;
  const steps = Array.isArray(flow.steps) ? flow.steps : [];
  const activeIndex = Math.max(0, steps.findIndex((step) => step.active));
  const active = steps[activeIndex] || steps[0] || {};
  const action = active.action || "open-demo-note";
  const actionLabel = smartNotesDemoActionLabel(active, activeIndex);
  const canRunAction = smartNotesDemoActionCanRun(active);
  return `
    <section class="demo-guide-panel-card" data-smart-notes-demo-guide>
      <div class="demo-guide-copy">
        <span>3 分钟示例</span>
        <strong>${escapeHtml(flow.title || "从记录到写作")}</strong>
        <p>${escapeHtml(flow.note || "下一步只做一个动作。")}</p>
      </div>
      <div class="demo-guide-current">
        <span>第 ${escapeHtml(activeIndex + 1)} / ${escapeHtml(steps.length || 3)} 步</span>
        <strong>${escapeHtml(active.title || "继续 Demo 导览")}</strong>
      </div>
      <button
        class="demo-guide-action"
        type="button"
        data-sidebar-flow-action="${escapeHtml(action)}"
        data-sidebar-flow-note-id="${escapeHtml(active.targetNoteId || "")}"
        ${canRunAction ? "" : "disabled"}
      >${escapeHtml(actionLabel)}</button>
    </section>
  `;
}

export function writingBeginnerMainline({
  basketCount = 0,
  hasProject = false,
  hasScaffold = false,
  projectEntry = null,
  basketReadiness = null
} = {}) {
  if (Number(basketCount || 0) <= 0) {
    return {
      stage: "material",
      label: "选相关笔记",
      title: "下一步只选能放进同一篇文章的笔记",
      body: "先挑 2-5 条能回答同一个问题的永久笔记，不急着生成提纲。",
      actionLabel: "加入相关笔记"
    };
  }
  if (!hasProject) {
    return {
      stage: "theme",
      label: "确定可写主题",
      title: "这组笔记可以先确定一个可写主题",
      body: basketReadiness?.hint || "确认题目、中心问题和读者后，再保存为可写主题。",
      actionLabel: projectEntry?.actionLabel || "确定可写主题"
    };
  }
  if (!hasScaffold) {
    return {
      stage: "outline",
      label: "生成提纲",
      title: "主题已确定，下一步生成文章提纲",
      body: "先把章节、证据和缺口摊开，再决定是否开始草稿。",
      actionLabel: "生成文章提纲"
    };
  }
  return {
    stage: "draft",
    label: "保存草稿",
    title: "提纲已生成，下一步保存为草稿笔记",
    body: "确认提纲的证据、缺口和反方后，把它保存成可以继续写的草稿。",
    actionLabel: "保存为草稿笔记"
  };
}

export function renderWritingBeginnerMainlineView(mainline = {}, deps = {}) {
  const { escapeHtml = (value) => String(value ?? "") } = deps;
  return `
    <section class="writing-summary" data-writing-beginner-mainline data-stage="${escapeHtml(mainline.stage || "")}">
      <div class="sidebar-flow-kicker">新手四步主线</div>
      <strong>${escapeHtml(mainline.label || "下一步")}</strong>
      <div>${escapeHtml(mainline.title || "下一步只做一件事")}</div>
      <small>${escapeHtml(mainline.body || "")}</small>
      <span class="inspector-chip">${escapeHtml(mainline.actionLabel || "继续")}</span>
    </section>
  `;
}
