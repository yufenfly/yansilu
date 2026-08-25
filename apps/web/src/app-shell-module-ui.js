export function currentModuleSidebarUi({
  module = "",
  rootName = "",
  escapeHtml = (value) => String(value ?? ""),
  settingsSidebarNavigationHtml = () => ""
} = {}) {
  const resolvedRootName = rootName || "当前目录";
  const configs = {
    today: {
      sidebarTitle: "首页",
      sidebarSubtitle: "让笔记生长为思想",
      sidebarFoot: "今日小提示：先把一条记录加工成判断，再补清它和其他笔记的关系。",
      title: "今日整理",
      summary: "先做最重要的一步。",
      sidebarHtml: ""
    },
    distillation: {
      sidebarTitle: "观点整理",
      sidebarSubtitle: "把永久笔记推进成清晰观点。",
      sidebarFoot: "观点整理只给出建议；你确认后才会写入笔记。",
      title: "观点整理",
      summary: "写下并确认当前观点，再用关系检验它、补充它。",
      sidebarHtml: `
        <div class="module-sidebar-card">
          <h3>当前目标</h3>
          <p>从 <strong>${escapeHtml(resolvedRootName)}</strong> 中找出还没有当前观点或尚未确认的永久笔记。</p>
        </div>
        <div class="module-sidebar-card">
          <h3>处理顺序</h3>
          <ol class="module-sidebar-list">
            <li>写下当前观点</li>
            <li>需要时补充说明</li>
            <li>保存后继续建立关系</li>
          </ol>
        </div>
      `
    },
    imports: {
      sidebarTitle: "导入与导出",
      sidebarSubtitle: "切换标签后直接操作。",
      sidebarFoot: "",
      title: "导入与导出",
      summary: `把外部资料带入 ${escapeHtml(resolvedRootName)}，或者把永久笔记导出到目标目录。`,
      sidebarHtml: ""
    },
    backup: {
      sidebarTitle: "备份与恢复",
      sidebarSubtitle: "先保护整个笔记库，再考虑导入导出。",
      sidebarFoot: "备份文件已加密，请保存到当前笔记库之外，并牢记密码。",
      title: "备份与恢复",
      summary: "把整个笔记库加密打包，或者恢复到一个新文件夹。适合迁移电脑、保存版本和发布前留底。",
      sidebarHtml: `
        <div class="module-sidebar-card">
          <h3>推荐顺序</h3>
          <ol class="module-sidebar-list">
            <li>选择笔记库外的保存位置</li>
            <li>设置并记住备份密码</li>
            <li>创建加密备份后复制到可靠位置</li>
          </ol>
        </div>
      `
    },
    aiInbox: {
      sidebarTitle: "待确认建议",
      sidebarSubtitle: "确认后才会写入。",
      sidebarFoot: "",
      title: "待确认建议",
      summary: "先看来源和理由，再决定采纳、忽略或归档。",
      sidebarHtml: ""
    },
    graph: {
      sidebarTitle: "永久笔记关系图谱",
      sidebarSubtitle: "看永久笔记之间的观点结构。",
      sidebarFoot: "直接看关系，判断哪些观点在支撑、对照、限定或桥接。",
      title: "永久笔记关系图谱",
      summary: "把永久笔记和它们之间的“支持、反驳、限定、连接”等关系放到一张图里，快速看出中心观点、孤立观点、冲突和缺失连接。",
      sidebarHtml: ""
    },
    writing: {
      sidebarTitle: "写作",
      sidebarSubtitle: "完成一篇文章",
      sidebarFoot: "",
      title: "写作",
      summary: "选择一个可写主题，沿着主题、提纲、草稿完成一篇文章。",
      sidebarHtml: `
        <div class="writing-sidebar-actions" aria-label="写作操作">
          <button class="writing-sidebar-action" type="button" data-writing-sidebar-action="topics">
            主题库
          </button>
          <button class="writing-sidebar-action" type="button" data-writing-sidebar-action="related">
            相关笔记 <span id="writingSidebarRelatedCount">0</span>
          </button>
        </div>
      `
    },
    settings: {
      sidebarTitle: "设置",
      sidebarSubtitle: "左侧切换，右侧设置。",
      sidebarFoot: "",
      title: "设置",
      summary: "当前设置项",
      sidebarHtml: settingsSidebarNavigationHtml()
    }
  };
  return configs[module] || {
    sidebarTitle: "功能页",
    sidebarSubtitle: "当前功能页。",
    sidebarFoot: "当前功能页。",
    title: "功能页",
    summary: "当前模块说明。",
    sidebarHtml: ""
  };
}

export function syncModuleChromeClassesForRuntime({
  module = "",
  moduleWorkspace = null,
  appShell = null
} = {}) {
  const graphMode = module === "graph";
  const todayMode = module === "today";
  const writingMode = module === "writing";
  const importsMode = module === "imports";
  const settingsMode = module === "settings";
  const backupMode = module === "backup";
  moduleWorkspace?.classList?.toggle?.("today-mode", todayMode);
  moduleWorkspace?.classList?.toggle?.("writing-mode", writingMode);
  moduleWorkspace?.classList?.toggle?.("graph-mode", graphMode);
  moduleWorkspace?.classList?.toggle?.("imports-mode", importsMode);
  moduleWorkspace?.classList?.toggle?.("backup-mode", backupMode);
  moduleWorkspace?.classList?.toggle?.("settings-mode", settingsMode);
  appShell?.classList?.toggle?.("graph-mode", graphMode);
  appShell?.classList?.toggle?.("settings-desktop-lock", settingsMode);
  return { todayMode, writingMode, graphMode, importsMode, backupMode, settingsMode };
}
