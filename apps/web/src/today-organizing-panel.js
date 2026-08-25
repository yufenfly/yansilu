import { renderReviewChecklistPanel } from "./review-checklist-panel.js";

function escape(value = "") {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function buildTodayActions(state = {}) {
  const firstMaterial = state.firstPendingMaterial || null;
  const materialTitles = Array.isArray(state.pendingMaterialItems)
    ? state.pendingMaterialItems.map((item) => item?.title).filter(Boolean).slice(0, 3)
    : [];
  const firstIsolated = state.firstIsolated || null;
  const firstTheme = state.firstTheme || null;
  const firstWriting = state.firstWritingReady || null;
  return [
    {
      key: "material",
      title: "说清一条记录",
      objectTitle: firstMaterial?.title || "随笔和文献暂时都已处理",
      summary: firstMaterial
        ? `用自己的话说清楚它对你意味着什么。${materialTitles.length ? `待处理：${materialTitles.join("、")}` : ""}`
        : "记录都已说清楚，可以检查关联。",
      meta: firstMaterial ? `${state.pendingMaterialCount || 0} 条待处理` : "已处理",
      action: "review-material",
      actionLabel: firstMaterial ? "说清这条记录" : "已完成",
      disabled: !firstMaterial,
      tone: "material"
    },
    {
      key: "connect",
      title: "说明为什么有关",
      objectTitle: firstIsolated?.title || "暂无待关联笔记",
      summary: firstIsolated
        ? "找一条相关笔记，写一句它们为什么有关。"
        : "笔记之间已经有清楚的关联。",
      meta: firstIsolated ? `${state.isolatedCount || 0} 条待关联` : "已关联",
      action: "connect-first-isolated",
      actionLabel: firstIsolated ? "去关联" : "已完成",
      disabled: !firstIsolated,
      tone: "connect"
    },
    {
      key: "theme",
      title: "围绕问题整理",
      objectTitle: firstTheme?.title || "还没有可直接整理的主题",
      summary: firstTheme
        ? "看看这些笔记能不能一起回答一个问题。"
        : "先积累几条彼此相关的笔记。",
      meta: firstTheme ? `${firstTheme.noteCount || 0} 条相关` : "待积累",
      action: "open-first-theme",
      actionLabel: firstTheme ? "打开这组笔记" : "先去关联",
      disabled: !firstTheme,
      tone: "theme"
    },
    {
      key: "writing",
      title: "用笔记开始写作",
      objectTitle: firstTheme?.title || firstWriting?.title || "暂无可写主题",
      summary: firstTheme
        ? "先生成提纲，再决定是否起草。"
        : firstWriting
          ? "放入写作中心继续组织。"
          : "先整理观点、关系和主题。",
      meta: firstWriting ? `${state.writingReadyCount || 0} 条可用` : "先整理",
      action: "open-writing",
      actionLabel: firstTheme || firstWriting ? "进入写作" : "先整理主题",
      disabled: !firstTheme && !firstWriting,
      tone: "writing"
    }
  ];
}

function primaryAction(actions = []) {
  return actions.find((item) => !item.disabled) || {
    title: "轻量回顾",
    objectTitle: "暂无必做任务",
    summary: "可检查标签、关系或提纲。",
    meta: "状态良好",
    action: "",
    actionLabel: "无需处理",
    disabled: true,
    tone: "calm"
  };
}

function actionCard({
  title = "",
  summary = "",
  objectTitle = "",
  meta = "",
  action = "",
  actionLabel = "",
  disabled = false,
  tone = ""
} = {}) {
  return `
    <article class="today-action-card ${tone ? `tone-${escape(tone)}` : ""}">
      <div>
        <span class="today-action-kicker">${escape(title)}</span>
        <strong>${escape(objectTitle || "暂时没有需要处理的对象")}</strong>
        <p>${escape(summary)}</p>
        ${meta ? `<small>${escape(meta)}</small>` : ""}
      </div>
      <button class="mini-btn today-action-button" type="button" data-today-action="${escape(action)}"${disabled ? " disabled" : ""}>
        ${escape(actionLabel)}
      </button>
    </article>
  `;
}

function renderOverview(state = {}) {
  return `
    <section class="today-overview-compact" aria-label="当前笔记库状态">
      <div class="today-overview-counts">
        <span><strong>${escape(state.pendingMaterialCount || 0)}</strong><small>待说清</small></span>
        <span><strong>${escape(state.permanentCount || 0)}</strong><small>已沉淀观点</small></span>
        <span><strong>${escape(state.isolatedCount || 0)}</strong><small>未关联</small></span>
        <span><strong>${escape(state.themeCount || 0)}</strong><small>可继续整理</small></span>
      </div>
      <div class="today-overview-note">
        先完成上方推荐任务。
      </div>
    </section>
  `;
}

function renderBeginnerGuide() {
  return `
    <section class="today-beginner-guide" aria-label="新用户使用步骤">
      <div class="today-beginner-copy">
        <span class="today-action-kicker">推荐路径</span>
        <strong>记录 -> 判断 -> 关联 -> 写作</strong>
      </div>
      <ol>
        <li><span>1</span><strong>说清记录</strong></li>
        <li><span>2</span><strong>留下判断</strong></li>
        <li><span>3</span><strong>说明关联</strong></li>
        <li><span>4</span><strong>开始写作</strong></li>
      </ol>
    </section>
  `;
}

function renderEmptyLibraryHome(state = {}) {
  const startupPending = state.startupPending === true;
  return `
    <section class="today-empty-home" aria-label="第一次使用引导">
      <div class="today-empty-home-copy">
        <span class="today-action-kicker">第一次打开</span>
        <h3>先写下一条你想留下的记录</h3>
        <p>不必先学方法。写下一个想法、读到的内容，或一个正在困扰你的问题；下一步再用自己的话把它说清楚。</p>
      </div>
      <div class="today-empty-home-actions">
        <button class="mini-btn primary" type="button" data-today-action="start-first-note"${startupPending ? ` disabled aria-busy="true"` : ""}>
          ${startupPending ? "正在准备..." : "写下第一条记录"}
        </button>
        <small>${startupPending ? "正在启动本地服务，准备好后就能开始。" : "先完成一条自己的判断，再考虑关系、主题和写作。"}</small>
      </div>
      <div class="today-empty-home-secondary" aria-label="其他开始方式">
        <button class="mini-btn" type="button" data-today-action="open-import"${startupPending ? " disabled" : ""}>导入已有 Markdown 笔记</button>
        <button class="mini-btn" type="button" data-today-action="seed-demo"${startupPending ? " disabled" : ""}>体验 3 分钟示例</button>
        <small data-today-demo-status aria-live="polite">示例只用于练习，不会替代你的笔记。</small>
        <div class="today-demo-progress" data-today-demo-progress role="progressbar" aria-label="Demo 导入进度" hidden>
          <span></span>
        </div>
      </div>
    </section>
  `;
}

function renderTodaySummary(state = {}) {
  return `
    <section class="today-quick-summary" aria-label="首页概览">
      <div class="today-path-inline">
        <span>路径</span>
        <strong>记录 -> 判断 -> 关联 -> 写作</strong>
      </div>
      <div class="today-overview-counts">
        <span><strong>${escape(state.pendingMaterialCount || 0)}</strong><small>待说清</small></span>
        <span><strong>${escape(state.isolatedCount || 0)}</strong><small>未关联</small></span>
        <span><strong>${escape(state.themeCount || 0)}</strong><small>可整理</small></span>
      </div>
    </section>
  `;
}

function renderTodayNotice(message = "") {
  const text = String(message || "").trim();
  if (!text) return "";
  return `
    <section class="today-import-notice" aria-live="polite">
      <strong>导入完成</strong>
      <span>${escape(text)}</span>
    </section>
  `;
}

export function renderTodayOrganizingPanel(state = {}) {
  const actions = buildTodayActions(state);
  const recommended = primaryAction(actions);
  if (state.isEmptyLibrary) {
    return `
      <div class="today-organizing-shell is-empty">
        ${renderEmptyLibraryHome(state)}
        <section class="today-empty-next" aria-label="你会学到什么">
          <article><strong>说清楚</strong><span>留下自己的判断。</span></article>
          <article><strong>连起来</strong><span>说明为什么有关。</span></article>
          <article><strong>写出来</strong><span>把观点组织成文章。</span></article>
        </section>
      </div>
    `;
  }
  return `
    <div class="today-organizing-shell">
      ${renderTodayNotice(state.noticeMessage)}
      <section class="today-primary-step tone-${escape(recommended.tone || "")}" aria-label="推荐下一步">
        <div>
          <strong>${escape(recommended.objectTitle)}</strong>
          <p>${escape(recommended.summary)}</p>
          ${recommended.meta ? `<small>${escape(recommended.meta)}</small>` : ""}
        </div>
        <button class="mini-btn primary" type="button" data-today-action="${escape(recommended.action)}"${recommended.disabled ? " disabled" : ""}>
          ${escape(recommended.actionLabel)}
        </button>
      </section>
      ${renderTodaySummary(state)}
      <section class="today-secondary-tabs" aria-label="辅助信息">
        <div class="today-secondary-tablist" role="tablist" aria-label="辅助信息切换">
          <button class="today-secondary-tab" type="button" role="tab" aria-selected="false" data-today-secondary-tab="path">路径和状态 <span>展开</span></button>
          <button class="today-secondary-tab" type="button" role="tab" aria-selected="false" data-today-secondary-tab="check">今日提醒 <span>展开</span></button>
        </div>
        <div class="today-secondary-panel" role="tabpanel" data-today-secondary-panel="path" hidden>
          <div class="today-secondary-body">
            ${renderBeginnerGuide()}
            ${renderOverview(state)}
          </div>
        </div>
        <div class="today-secondary-panel" role="tabpanel" data-today-secondary-panel="check" hidden>
          <div class="today-secondary-body">
            ${renderReviewChecklistPanel(state.reviewChecklist)}
          </div>
        </div>
      </section>
      <section class="today-action-grid" aria-label="其他可做">
        ${actions.filter((item) => item.key !== recommended.key).map(actionCard).join("")}
      </section>
    </div>
  `;
}
