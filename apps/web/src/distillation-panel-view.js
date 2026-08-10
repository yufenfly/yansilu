export function distillationQueueFilters(counts = {}) {
  return [
    ["all", "全部", counts.all || 0],
    ["needs_thesis", "待一句话判断", counts.needs_thesis || 0],
    ["needs_confirm", "待确认", counts.needs_confirm || 0],
    ["confirmed", "已确认", counts.confirmed || 0]
  ];
}

function distillationWritingReady(note = {}, status = "") {
  return status === "confirmed" && Boolean(String(note.thesis || "").trim());
}

export function buildDistillationPanelModel({ items = [], activeFilter = "all" } = {}) {
  const safeItems = Array.isArray(items) ? items : [];
  const stageCounts = safeItems.reduce(
    (acc, item) => {
      acc.all += 1;
      acc[item.stage] = (acc[item.stage] || 0) + 1;
      return acc;
    },
    { all: 0, needs_thesis: 0, needs_confirm: 0, confirmed: 0 }
  );
  const counts = safeItems.reduce(
    (acc, item) => {
      acc[item.status] = (acc[item.status] || 0) + 1;
      return acc;
    },
    { missing: 0, draft: 0, confirmed: 0 }
  );
  const activeCount = (counts.missing || 0) + (counts.draft || 0);
  const writingReadyCount = safeItems.filter(({ note, status }) => distillationWritingReady(note, status)).length;
  const normalizedFilter = String(activeFilter || "all").trim() || "all";
  const filteredItems = normalizedFilter === "all" ? safeItems : safeItems.filter((item) => item.stage === normalizedFilter);
  const gapChips = [
    stageCounts.needs_thesis ? `缺一句话判断 ${stageCounts.needs_thesis}` : "",
    stageCounts.needs_confirm ? `待确认观点 ${stageCounts.needs_confirm}` : ""
  ].filter(Boolean);
  const nextActiveItem = safeItems.find((item) => item.stage !== "confirmed") || null;
  const primaryAction = nextActiveItem ? "open-next" : writingReadyCount > 0 ? "open-writing" : "create-permanent";
  return {
    items: safeItems,
    stageCounts,
    counts,
    activeCount,
    writingReadyCount,
    activeFilter: normalizedFilter,
    filteredItems,
    gapChips,
    nextActiveItem,
    primaryAction,
    primaryActionLabel: primaryAction === "open-writing" ? "进入写作中心" : primaryAction === "create-permanent" ? "新建永久笔记" : "继续整理观点"
  };
}

export function renderDistillationPanelView(input = {}, deps = {}) {
  const escapeHtml = deps.escapeHtml || ((value) => String(value ?? ""));
  const titleFromBody = deps.titleFromBody || (() => "");
  const distillationStatusLabel = deps.distillationStatusLabel || ((status) => status);
  const model = buildDistillationPanelModel(input);
  const filtersHtml = distillationQueueFilters(model.stageCounts)
    .map(([key, label, value]) => {
      const active = model.activeFilter === key;
      return `<button class="distillation-filter ${active ? "active" : ""}" type="button" data-distillation-filter="${escapeHtml(key)}" aria-pressed="${active ? "true" : "false"}">${escapeHtml(label)} <span>${Number(value) || 0}</span></button>`;
    })
    .join("");
  const rows = model.filteredItems.length
    ? model.filteredItems
        .map(({ note, status, reason }) => {
          const title = note.title || titleFromBody(note.body || "") || "未命名笔记";
          const summary = Array.isArray(note.threeLineSummary) ? note.threeLineSummary.filter(Boolean).slice(0, 3).join(" / ") : "";
          return `
            <button class="distillation-queue-item" type="button" data-distillation-open-note="${escapeHtml(note.id)}" data-status="${escapeHtml(status)}">
              <span class="distillation-queue-main">
                <strong>${escapeHtml(title)}</strong>
                <small>${escapeHtml(reason)}</small>
                ${note.thesis ? `<em>${escapeHtml(note.thesis)}</em>` : ""}
                ${summary ? `<em>${escapeHtml(summary)}</em>` : ""}
              </span>
              <span class="inspector-chip">${escapeHtml(distillationStatusLabel(status))}</span>
            </button>
          `;
        })
        .join("")
    : model.activeFilter !== "all"
      ? `<div class="distillation-empty">当前筛选下没有条目。可以切回“全部”，或继续进入写作中心。</div>`
      : model.activeCount === 0 && model.writingReadyCount > 0
        ? `<div class="distillation-empty">当前没有待提纯条目。已确认观点可以进入写作中心。</div>`
        : `<div class="distillation-empty">还没有可整理的永久笔记。先新建或导入一条永久笔记。</div>`;
  const primaryActionAttrs = model.primaryAction === "open-next"
    ? `data-distillation-open-note="${escapeHtml(model.nextActiveItem.note.id)}"`
    : `data-distillation-action="${escapeHtml(model.primaryAction)}"`;
  return `
    <div class="distillation-shell">
      <section class="distillation-card distillation-home">
        <div>
          <div class="import-card-kicker">观点整理</div>
          <strong>先把材料整理成你愿意确认的观点</strong>
          <p>${escapeHtml(model.gapChips.length ? `优先处理：${model.gapChips.join("，")}。` : model.writingReadyCount ? "当前观点已经准备进入写作中心。" : "从第一条永久笔记开始写一句判断。")}</p>
        </div>
        <button class="mini-btn primary" type="button" ${primaryActionAttrs}>${escapeHtml(model.primaryActionLabel)}</button>
      </section>
      <section class="distillation-overview">
        <div><span>待提纯</span><strong>${model.activeCount}</strong></div>
        <div><span>已确认观点</span><strong>${model.counts.confirmed || 0}</strong></div>
        <div><span>可进入写作中心</span><strong>${model.writingReadyCount}</strong></div>
        <div><span>缺口提醒</span><strong>${model.gapChips.length}</strong></div>
      </section>
      <section class="distillation-card">
        <div class="distillation-card-head">
          <div>
            <div class="import-card-kicker">Queue</div>
            <strong>观点整理待处理</strong>
          </div>
          <button class="mini-btn is-ghost" id="btnDistillationRefresh" type="button">刷新</button>
        </div>
        <div class="distillation-filters" role="group" aria-label="观点整理待处理筛选">${filtersHtml}</div>
        <div class="distillation-queue">${rows}</div>
      </section>
    </div>
  `;
}
