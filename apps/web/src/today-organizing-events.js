export function installTodayOrganizingEvents(panel = null, depsProvider = () => ({})) {
  if (!panel?.addEventListener) return null;
  const themeNoteIds = (theme = null) => (Array.isArray(theme?.noteIds) ? theme.noteIds : [])
    .map((item) => String(item || "").trim())
    .filter(Boolean);
  const parseNoteIds = (value = "") => String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const themeEntryReason = (theme = null) => {
    const title = String(theme?.title || "这个可写主题").trim();
    const count = Number(theme?.noteCount || 0);
    return count > 0
      ? `${title} 已经聚合了 ${count} 条相关笔记，适合先续接这个主题。`
      : `${title} 已经在当前主题列表里，适合先从这里续接。`;
  };
  const noteEntryReason = (note = null) => {
    const title = String(note?.title || "这条永久笔记").trim();
    return `${title} 已经有明确观点和三句摘要，适合先放入相关笔记继续组织。`;
  };
  const markReturnToToday = (deps) => deps.markTodayReturnTarget?.({ label: "首页" });
  const selectSecondaryTab = (key = "") => {
    const selected = String(key || "path").trim() || "path";
    const selectedTab = panel.querySelector?.(`[data-today-secondary-tab="${selected}"]`);
    const shouldCollapse = selectedTab?.getAttribute("aria-selected") === "true";
    panel.querySelectorAll?.("[data-today-secondary-tab]")?.forEach((tab) => {
      const active = !shouldCollapse && tab.getAttribute("data-today-secondary-tab") === selected;
      tab.classList.toggle("is-active", active);
      tab.setAttribute("aria-selected", active ? "true" : "false");
      const stateText = tab.querySelector("span");
      if (stateText) stateText.textContent = active ? "收起" : "展开";
    });
    panel.querySelectorAll?.("[data-today-secondary-panel]")?.forEach((content) => {
      content.hidden = shouldCollapse || content.getAttribute("data-today-secondary-panel") !== selected;
    });
  };

  const openThemeIndex = async (theme = null, deps = {}) => {
    const themeId = String(theme?.id || "").trim();
    const noteIds = themeId ? [] : themeNoteIds(theme);
    markReturnToToday(deps);
    deps.activateModule?.("writing");
    await deps.openWritingModule?.({
      entryReason: themeId
        ? "已打开主题索引详情。先看中心问题、关键笔记和缺口，再决定是否进入写作。"
        : themeEntryReason(theme),
      entrySourceLabel: "首页"
    });
    if (themeId) await deps.selectWritingThemeIndex?.(themeId);
    if (!themeId && noteIds.length) deps.addWritingBasketIds?.(noteIds);
    deps.applyWritingTab?.("themes");
    deps.setStatus?.(themeId ? "已打开主题索引详情" : "已打开这组主题材料", "ok");
  };

  const openThemeForWriting = async (theme = null, note = null, deps = {}) => {
    const themeId = String(theme?.id || "").trim();
    const themeIds = themeId ? [] : themeNoteIds(theme);
    const noteId = themeId || themeIds.length ? "" : note?.id || "";
    if (themeIds.length) deps.addWritingBasketIds?.(themeIds);
    if (noteId) deps.addWritingBasketIds?.([noteId]);
    markReturnToToday(deps);
    deps.activateModule?.("writing");
    await deps.openWritingModule?.({
      ...(themeIds.length ? { statusMessage: `已把 ${themeIds.length} 条主题笔记加入写作中心` } : noteId ? { statusMessage: "已把这条笔记加入写作中心" } : {}),
      entryReason: themeId || themeIds.length ? themeEntryReason(theme) : noteEntryReason(note),
      entrySourceLabel: "首页"
    });
    if (themeId) await deps.selectWritingThemeIndex?.(themeId);
    deps.applyWritingTab?.("write");
  };

  const handler = async (event) => {
    const secondaryTab = event.target?.closest?.("[data-today-secondary-tab]");
    if (secondaryTab) {
      event.preventDefault();
      selectSecondaryTab(secondaryTab.getAttribute("data-today-secondary-tab"));
      return;
    }
    const button = event.target?.closest?.("[data-today-action]");
    if (!button) return;
    const action = String(button.getAttribute("data-today-action") || "").trim();
    if (!action || button.disabled) return;
    event.preventDefault();
    const deps = depsProvider() || {};

    if (action === "start-first-note") {
      button.disabled = true;
      button.setAttribute("aria-busy", "true");
      try {
        await deps.openStartupUntitledNote?.();
        deps.activateModule?.("explorer");
      } catch (error) {
        deps.setStatus?.(`无法新建第一条记录：${String(error?.message || error)}`, "bad");
      } finally {
        button.disabled = false;
        button.removeAttribute("aria-busy");
      }
      return;
    }
    if (action === "open-import") {
      await deps.handleStateChange?.("open-import", { source: "today-empty-start" });
      return;
    }

    if (action === "seed-demo") {
      const originalText = button.textContent;
      const hint = panel.querySelector?.("[data-today-demo-status]");
      const progress = panel.querySelector?.("[data-today-demo-progress]");
      const originalHint = hint?.textContent || "";
      button.disabled = true;
      button.setAttribute("aria-busy", "true");
      button.textContent = "正在导入...";
      const startedAt = Date.now();
      const timerHost = typeof window !== "undefined" ? window : globalThis;
      let importProgressTimer = 0;
      const updateImportProgressHint = () => {
        if (!hint) return;
        const elapsedSeconds = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
        const message = elapsedSeconds < 8
          ? "正在连接本地服务并准备 Demo"
          : elapsedSeconds < 25
            ? "本地服务可能还在启动，正在自动等待"
            : elapsedSeconds < 55
              ? "正在导入示例笔记，完成后会刷新首页"
              : "仍在导入；如果超过 1 分钟没有完成，会提示失败";
        hint.textContent = `${message}（已等待 ${elapsedSeconds} 秒）`;
        hint.setAttribute("aria-live", "polite");
      };
      if (hint) {
        hint.textContent = "正在连接本地服务并准备 Demo，完成后会自动刷新首页。";
        hint.setAttribute("aria-live", "polite");
      }
      updateImportProgressHint();
      if (hint && typeof timerHost.setInterval === "function") {
        importProgressTimer = timerHost.setInterval(updateImportProgressHint, 3000);
      }
      if (progress) {
        progress.hidden = false;
        progress.setAttribute?.("aria-valuetext", "正在导入 Demo");
      }
      deps.setStatus?.("正在导入 Smart Notes Demo，完成后会刷新首页。", "busy");
      let shouldRestoreHint = true;
      try {
        const result = await deps.handleStateChange?.("seed-smart-notes-demo", { source: "today-empty-start" });
        if (result === false) {
          shouldRestoreHint = false;
          if (hint) {
            hint.textContent = "导入没有完成。如果本地服务还在启动，请稍后再试。";
            hint.setAttribute("aria-live", "polite");
          }
        } else {
          deps.activateModule?.("today");
        }
      } catch (error) {
        shouldRestoreHint = false;
        deps.setStatus?.(`导入 Demo 失败：${String(error?.message || error)}`, "bad");
        if (hint) {
          hint.textContent = "导入没有完成。如果本地服务还在启动，请稍后再试。";
          hint.setAttribute("aria-live", "polite");
        }
      } finally {
        if (importProgressTimer && typeof timerHost.clearInterval === "function") {
          timerHost.clearInterval(importProgressTimer);
        }
        button.disabled = false;
        button.removeAttribute("aria-busy");
        button.textContent = originalText;
        if (hint && shouldRestoreHint) hint.textContent = originalHint;
        if (progress) {
          progress.hidden = true;
          progress.removeAttribute?.("aria-valuetext");
        }
      }
      return;
    }
    if (action === "review-connect-isolated") {
      const noteId = String(button.dataset?.reviewNoteId || "").trim();
      if (!noteId) return;
      markReturnToToday(deps);
      deps.activateModule?.("graph");
      await deps.handleStateChange?.("graph-associate-note", { noteId, source: "review-checklist" });
      return;
    }
    if (action === "review-refine-tag") {
      const noteId = String(button.dataset?.reviewNoteId || "").trim();
      if (!noteId) return;
      markReturnToToday(deps);
      deps.activateModule?.("explorer");
      deps.openNoteById?.(noteId, { preferTitleSelection: false });
      deps.setStatus?.(`已打开带 #${String(button.dataset?.reviewTag || "").trim() || "宽标签"} 的笔记，请把标签改得更具体。`, "ok");
      return;
    }
    if (action === "review-complete-rationale") {
      const noteId = String(button.dataset?.reviewNoteId || "").trim();
      const targetNoteId = String(button.dataset?.reviewTargetNoteId || "").trim();
      if (!noteId) return;
      markReturnToToday(deps);
      deps.activateModule?.("graph");
      await deps.handleStateChange?.("open-note-relations", { noteId, targetNoteId, source: "review-checklist" });
      return;
    }
    if (action === "review-generate-outline") {
      const themeId = String(button.dataset?.reviewThemeId || "").trim();
      const noteIds = parseNoteIds(button.dataset?.reviewNoteIds);
      if (typeof deps.createReviewOutline === "function") {
        markReturnToToday(deps);
        try {
          await deps.createReviewOutline({ themeId, noteIds, source: "review-checklist" });
        } catch (error) {
          deps.setStatus?.(`从定期回顾生成提纲失败：${String(error?.message || error)}`, "bad");
        }
        return;
      }
      if (noteIds.length) deps.addWritingBasketIds?.(noteIds);
      markReturnToToday(deps);
      deps.activateModule?.("writing");
      await deps.openWritingModule?.({
        ...(noteIds.length ? { statusMessage: `已把 ${noteIds.length} 条主题笔记加入写作中心` } : {}),
        entryReason: "这组主题已经有足够相关笔记，可以先生成提纲再决定是否起草。",
        entrySourceLabel: "定期回顾清单"
      });
      if (themeId) await deps.selectWritingThemeIndex?.(themeId);
      deps.applyWritingTab?.("write");
      return;
    }
    if (action === "review-material") {
      const noteId = String(deps.todayState?.firstPendingMaterial?.id || "").trim();
      if (!noteId) return;
      markReturnToToday(deps);
      deps.activateModule?.("explorer");
      deps.openNoteById?.(noteId, { preferTitleSelection: false });
      return;
    }
    if (action === "connect-first-isolated") {
      const noteId = deps.todayState?.firstIsolated?.id || "";
      if (!noteId) return;
      markReturnToToday(deps);
      deps.activateModule?.("graph");
      await deps.handleStateChange?.("graph-associate-note", { noteId, source: "today-organizing" });
      return;
    }
    if (action === "open-first-theme") {
      await openThemeIndex(deps.todayState?.firstTheme || null, deps);
      return;
    }
    if (action === "open-writing") {
      await openThemeForWriting(deps.todayState?.firstTheme || null, deps.todayState?.firstWritingReady || null, deps);
    }
  };
  panel.addEventListener("click", handler);
  return handler;
}
