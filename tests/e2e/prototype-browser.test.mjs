import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import fs from "node:fs/promises";
import os from "node:os";
import net from "node:net";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");

async function makeTempDir(prefix) {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

async function findFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.on("error", reject);
    server.listen(0, () => {
      const address = server.address();
      const port = typeof address === "object" ? address.port : 0;
      server.close(() => resolve(port));
    });
  });
}

async function waitForJsonHealth(url) {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.ok) return await res.json();
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 80));
  }
  throw new Error(`Service did not become healthy: ${url}`);
}

async function waitFor(assertFn, timeoutMs = 6000, intervalMs = 120) {
  const deadline = Date.now() + timeoutMs;
  let lastError = null;
  while (Date.now() < deadline) {
    try {
      return await assertFn();
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw lastError || new Error("waitFor timeout");
}

async function expandEditorHelper(page) {
  await page.locator("#editorHelper").hover();
  await waitFor(async () => {
    assert.equal(await page.locator("#btnEditorHelperAction").isVisible(), true);
    assert.equal(await page.locator("#btnEditorHelperMute").isVisible(), true);
  }, 4000);
}

async function openOriginalNoteBox(page) {
  await page.locator('[data-action="quick-original"]').click();
  await page.locator("#editorWorkspace").waitFor({ state: "visible", timeout: 3000 });
}

async function waitForWritingThemeProjectActionReady(page) {
  await waitFor(async () => {
    const state = await page.evaluate(() => {
      const summary = document.querySelector('[data-writing-theme-project-summary]')?.textContent || "";
      const detailText = document.querySelector(".writing-theme-detail-card")?.textContent || "";
      const button = document.querySelector('[data-writing-theme-action="create-project"]');
      return {
        summary,
        buttonText: button?.textContent || "",
        disabled: Boolean(button?.hasAttribute("disabled")),
        detailText
      };
    });
    assert.match(state.detailText, /写作助手|为什么这组笔记值得写/);
    assert.match(state.detailText, /先写什么提纲|下一步可以写什么/);
    assert.match(state.summary, /下一步|为什么值得写|已达到/);
    assert.doesNotMatch(state.summary, /写作状态/);
    assert.match(state.buttonText, /确定可写主题|创建写作项目/);
    assert.equal(state.disabled, false, JSON.stringify(state));
  }, 10000);
}

async function fetchJson(baseUrl, pathname) {
  const res = await fetch(`${baseUrl}${pathname}`);
  const json = await res.json();
  return { status: res.status, json };
}

async function postJson(baseUrl, pathname, body) {
  const res = await fetch(`${baseUrl}${pathname}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const json = await res.json();
  return { status: res.status, json };
}

async function patchJson(baseUrl, pathname, body) {
  const res = await fetch(`${baseUrl}${pathname}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const json = await res.json();
  return { status: res.status, json };
}

async function putJson(baseUrl, pathname, body) {
  const res = await fetch(`${baseUrl}${pathname}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const json = await res.json();
  return { status: res.status, json };
}

async function createWritingReadyPermanentNote(baseUrl, payload = {}) {
  const authorship = payload.authorship || { user_confirmed: true, ai_assisted: false };
  const created = await postJson(baseUrl, "/api/v1/notes", {
    directoryId: payload.directoryId || "dir_original_default",
    title: payload.title,
    body: payload.body,
    thesis: payload.thesis,
    threeLineSummary: payload.threeLineSummary,
    distillationStatus: "draft",
    boundaryOrCounterpoint: payload.boundaryOrCounterpoint
  });
  assert.equal(created.status, 201, JSON.stringify(created.json));
  const noteId = created.json.item.id;
  const updated = await putJson(baseUrl, `/api/v1/notes/${encodeURIComponent(noteId)}`, {
    title: payload.title || created.json.item.title,
    body: payload.body || created.json.item.body,
    status: "active",
    thesis: payload.thesis,
    threeLineSummary: payload.threeLineSummary,
    distillationStatus: payload.distillationStatus || "confirmed",
    originalityStatus: "pass",
    authorship,
    authorshipConfirmed: true,
    authorshipAiAssisted: Boolean(authorship.ai_assisted),
    boundaryOrCounterpoint: payload.boundaryOrCounterpoint
  });
  assert.equal(updated.status, 200, JSON.stringify(updated.json));
  return updated;
}

async function listMarkdownFiles(rootPath) {
  const result = [];
  const entries = await fs.readdir(rootPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(rootPath, entry.name);
    if (entry.isDirectory()) {
      result.push(...(await listMarkdownFiles(fullPath)));
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) {
      result.push(fullPath);
    }
  }
  return result;
}

async function expectChecked(locator, checked) {
  const isChecked = await locator.isChecked();
  assert.equal(isChecked, checked);
}

function escapeRegExp(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function confirmAuthorshipIfVisible(page, options = {}) {
  const panel = page.locator("#authorshipPanel");
  const visible = await panel.isVisible().catch(() => false);
  if (!visible) return false;
  const claimInput = page.locator("#authorshipClaimInput");
  const existingClaim = await claimInput.inputValue();
  const claim = String(options.claim || existingClaim || "这是一条用于验收的中心判断").trim();
  if (!existingClaim.trim() || options.forceClaim === true) {
    await claimInput.fill(claim);
  }
  await page.waitForFunction(() => {
    const checkbox = document.querySelector("#authorshipConfirm");
    return Boolean(checkbox && !checkbox.disabled);
  });
  const checkbox = page.locator("#authorshipConfirm");
  if (!(await checkbox.isChecked())) await checkbox.check();
  await waitFor(async () => {
    assert.equal(await checkbox.isChecked(), true);
  }, 4000);
  return true;
}

async function currentStatusText(page) {
  return page.locator("#statusText").textContent().catch(() => "");
}

async function waitForPrototypeReady(page) {
  await waitFor(async () => {
    assert.equal(await page.locator("#statusText").count(), 1);
    assert.equal(
      await page.evaluate(() => Boolean(window.__prototypeState && typeof window.__prototypeState === "object")),
      true
    );
  }, 10000);
}

async function chooseToolbarCommand(page, command) {
  const item = page.locator(`[data-toolbar-command="${command}"]`);
  await waitFor(async () => {
    assert.equal(await item.isVisible(), true);
  }, 4000);
  await item.click();
}

async function optionalPlaywright(t) {
  try {
    return await import("playwright");
  } catch {
    t.skip("Playwright is not installed; run npm install -D playwright and playwright install chromium to enable browser e2e.");
    return null;
  }
}

async function launchPlaywrightBrowser(playwright) {
  const attempts = [{ label: "playwright chromium", options: { headless: true } }];

  if (process.platform === "win32") {
    attempts.push({ label: "system chrome channel", options: { channel: "chrome", headless: true } });
    attempts.push({
      label: "system chrome executable",
      options: {
        executablePath: "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
        headless: true
      }
    });
  }

  const errors = [];
  for (const attempt of attempts) {
    try {
      return await playwright.chromium.launch(attempt.options);
    } catch (error) {
      errors.push(`${attempt.label}: ${String(error?.message || error)}`);
    }
  }

  throw new Error(errors.join("\n\n"));
}

async function startPrototypeStack(t, playwright, options = {}) {
  const vaultPath = await makeTempDir("yansilu-browser-e2e-vault-");
  const apiPort = await findFreePort();
  const webPort = await findFreePort();
  const apiBase = `http://127.0.0.1:${apiPort}`;
  const webBase = `http://127.0.0.1:${webPort}`;

  const api = spawn(process.execPath, ["apps/api/src/server.mjs"], {
    cwd: REPO_ROOT,
    env: {
      ...process.env,
      API_PORT: String(apiPort),
      VAULT_PATH: vaultPath
    },
    stdio: ["ignore", "pipe", "pipe"]
  });

  const web = spawn(process.execPath, ["apps/web/src/dev-server.mjs"], {
    cwd: REPO_ROOT,
    env: {
      ...process.env,
      WEB_PORT: String(webPort),
      API_BASE: apiBase
    },
    stdio: ["ignore", "pipe", "pipe"]
  });

  t.after(() => {
    api.kill();
    web.kill();
  });

  await waitForJsonHealth(`${apiBase}/health`);
  await waitForJsonHealth(`${webBase}/health`);

  let browser;
  try {
    browser = await launchPlaywrightBrowser(playwright);
  } catch (error) {
    t.skip(`No reusable Playwright browser runtime is available: ${String(error?.message || error)}`);
    return null;
  }

  t.after(async () => {
      if (browser) await browser.close();
    });

  const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
  if (typeof options.beforeGoto === "function") await options.beforeGoto(page);
  await page.goto(`${webBase}/prototype`, { waitUntil: "domcontentloaded" });
  await waitForPrototypeReady(page);

  return { apiBase, webBase, vaultPath, browser, page };
}

async function reloadPrototype(page, webBase) {
  await page.goto(`${webBase}/prototype`, { waitUntil: "domcontentloaded" });
  await waitForPrototypeReady(page);
}

async function openPaperWorkspace(page, webBase) {
  await page.goto(`${webBase}/paper-workspace`, { waitUntil: "networkidle" });
}

function paperWorkspaceSelectionStorageKey(paperId) {
  return `yansilu:paper-workspace:selection:${String(paperId || "").trim()}`;
}

async function currentPaperWorkspaceStatusText(page) {
  return page.locator(".paper-status").textContent().catch(() => "");
}

async function createAiFieldSuggestionFixture(baseUrl, options = {}) {
  const title = String(options.title || "AI review fixture").trim();
  const body =
    String(options.body || "This note should produce a reviewable thesis suggestion for browser coverage.").trim();
  const created = await postJson(baseUrl, "/api/v1/notes", {
    directoryId: "dir_original_default",
    title,
    noteType: "permanent",
    body: `# ${title}\n\n${body}`
  });
  assert.equal(created.status, 201, JSON.stringify(created.json));

  const analysis = await postJson(baseUrl, `/api/v1/notes/${encodeURIComponent(created.json.item.id)}/ai-analysis`, {});
  assert.equal(analysis.status, 200, JSON.stringify(analysis.json));

  const suggestionId = analysis.json.item.reviewItems.storedSuggestionIds[0];
  assert.ok(suggestionId, "expected a stored suggestion id");

  const artifact = analysis.json.item.reviewItems.artifacts.find(
    (item) =>
      item.type === "InsightCard" &&
      (item.payload?.fieldSuggestionId === suggestionId || item.payload?.fieldSuggestion?.id === suggestionId)
  );
  assert.ok(artifact, "expected an InsightCard artifact linked to the stored suggestion");

  return {
    noteId: created.json.item.id,
    noteTitle: title,
    artifactId: artifact.id,
    suggestionId,
    targetField: artifact.payload?.fieldSuggestion?.target?.field || "thesis",
    suggestedContent: artifact.payload?.fieldSuggestion?.content || {}
  };
}

async function adoptSuggestionAsDraftViaApi(baseUrl, fixture, options = {}) {
  const adopted = await postJson(
    baseUrl,
    `/api/v1/ai/inbox/${encodeURIComponent(fixture.artifactId)}/adopt-field-suggestion`,
    {
      confirm: true,
      comment: String(options.comment || "Adopted through test setup.")
    }
  );
  assert.equal(adopted.status, 200, JSON.stringify(adopted.json));
  assert.equal(adopted.json.item.status, "adopted_as_draft");
  return adopted.json;
}

async function markSuggestionEditedViaApi(baseUrl, fixture, thesis, options = {}) {
  const edited = await patchJson(
    baseUrl,
    `/api/v1/ai-suggestions/${encodeURIComponent(fixture.suggestionId)}?canonical=true`,
    {
      status: "edited",
      action: "edit",
      actor: "user",
      userId: "user_1",
      comment: String(options.comment || "Edited through test setup."),
      content: {
        [fixture.targetField]: thesis
      }
    }
  );
  assert.equal(edited.status, 200, JSON.stringify(edited.json));
  assert.equal(edited.json.item.status, "edited");
  return edited.json;
}

async function openAiInboxModule(page) {
  const railButton = page.locator('.rail-btn[data-module="aiInbox"]');
  if (await railButton.count()) {
    await railButton.click();
  } else {
    await page.locator("#systemMessagesButton").click();
    await page.locator("#btnSystemMessageOpenAiInbox").click();
  }
  await waitFor(async () => {
    assert.equal(await page.evaluate(() => window.__prototypeState?.module || ""), "aiInbox");
    assert.equal(await page.locator("#aiInboxPanel").isVisible(), true);
  }, 5000);
}

function settingsPaneId(section = "workspace") {
  const normalized = String(section || "workspace").trim() || "workspace";
  return `#settingsPane${normalized.slice(0, 1).toUpperCase()}${normalized.slice(1)}`;
}

async function openSettingsModule(page, section = "workspace") {
  await page.locator('.rail-btn[data-module="settings"]').click();
  await waitFor(async () => {
    assert.equal(await page.evaluate(() => window.__prototypeState?.module || ""), "settings");
    assert.equal(await page.locator("#settingsPanel").isVisible(), true);
  }, 5000);
  const normalizedSection = String(section || "workspace").trim() || "workspace";
  const navButton = page.locator(`#settingsSectionNav [data-settings-section="${normalizedSection}"]`);
  try {
    await navButton.click({ timeout: 1200 });
  } catch {
    await page.evaluate((targetSection) => {
      document.querySelector(`#settingsSectionNav [data-settings-section="${targetSection}"]`)?.click();
    }, normalizedSection);
  }
  await waitFor(async () => {
    assert.equal(await navButton.getAttribute("aria-pressed"), "true");
    assert.equal(await page.locator(settingsPaneId(normalizedSection)).isVisible(), true);
  }, 5000);
}

function noteFieldKey(field = "") {
  return String(field || "").trim() === "three_line_summary" ? "threeLineSummary" : String(field || "").trim() || "thesis";
}

function suggestionFieldValue(content = {}, field = "") {
  const direct = content?.[field];
  if (direct !== undefined) return direct;
  const normalizedField = noteFieldKey(field);
  return content?.[normalizedField];
}

async function filterAiInboxBySourceNote(page, sourceNoteId) {
  await waitFor(async () => {
    const input = page.locator("#aiInboxSourceNoteFilter");
    await input.fill(sourceNoteId);
    assert.equal(await input.inputValue(), sourceNoteId);
  }, 8000);
  await page.locator("#btnAiInboxApplyFilters").click();
}

async function filterAiSuggestionsByTarget(page, targetId) {
  await waitFor(async () => {
    const input = page.locator("#aiSuggestionTargetIdFilter");
    await input.fill(targetId);
    assert.equal(await input.inputValue(), targetId);
  }, 8000);
  await page.locator("#btnAiSuggestionsApplyFilters").click();
}

async function filterAiSuggestionsByStatus(page, status) {
  await waitFor(async () => {
    await page.locator("#aiSuggestionStatusFilter").selectOption(status);
    assert.equal(await page.locator("#aiSuggestionStatusFilter").inputValue(), status);
  }, 8000);
  await page.locator("#btnAiSuggestionsApplyFilters").click();
}

test("prototype desktop updater check no-ops cleanly when no update is available", async (t) => {
  if (process.env.RUN_BROWSER_E2E !== "1") {
    t.skip("Set RUN_BROWSER_E2E=1 to enable browser e2e in local runs.");
    return;
  }

  const playwright = await optionalPlaywright(t);
  if (!playwright) return;

  const stack = await startPrototypeStack(t, playwright, {
    beforeGoto: async (page) => {
      await page.addInitScript(() => {
        window.__updaterCommands = [];
        window.__confirmMessages = [];
        window.confirm = (message) => {
          window.__confirmMessages.push(message);
          return false;
        };
        window.__TAURI__ = {
          core: {
            async invoke(command, args) {
              window.__updaterCommands.push({ command, args });
              if (command === "plugin:updater|check") return { available: false };
              throw new Error(`unexpected updater command: ${command}`);
            }
          }
        };
      });
    }
  });
  if (!stack) return;

  const { page } = stack;
  await waitFor(async () => {
    const commands = await page.evaluate(() => window.__updaterCommands || []);
    assert.deepEqual(commands.map((item) => item.command), ["plugin:updater|check"]);
    const confirms = await page.evaluate(() => window.__confirmMessages || []);
    assert.deepEqual(confirms, []);
  }, 7000);
});

async function createAndSaveNoteViaEditor(page, markdown, options = {}) {
  const confirmAuthorship = options.confirmAuthorship !== false;
  const saveWithShortcut = Boolean(options.saveWithShortcut);
  const source = String(markdown || "").replace(/\r\n/g, "\n");
  const [firstLine = "", ...restLines] = source.split("\n");
  const expectedTitle = firstLine.replace(/^#+\s*/, "").trim();
  const expectedBody = restLines.join("\n").replace(/^\n+/, "");
  await page.evaluate(() => {
    if (window.__saveRequestMonitorInstalled) return;
    window.__saveRequestMonitorInstalled = true;
    window.__lastSaveRequestPayload = null;
    window.__lastSaveResponsePayload = null;
    const originalFetch = window.fetch.bind(window);
    window.fetch = async (...args) => {
      try {
        const [input, init] = args;
        const url = String(typeof input === "string" ? input : input?.url || "");
        const method = String(init?.method || "GET").toUpperCase();
        if (method === "PUT" && url.includes("/api/v1/notes/") && typeof init?.body === "string") {
          window.__lastSaveRequestPayload = JSON.parse(init.body);
        }
      } catch {}
      const response = await originalFetch(...args);
      try {
        const [input, init] = args;
        const url = String(typeof input === "string" ? input : input?.url || "");
        const method = String(init?.method || "GET").toUpperCase();
        if (method === "PUT" && url.includes("/api/v1/notes/")) {
          window.__lastSaveResponsePayload = await response.clone().json();
        }
      } catch {}
      return response;
    };
  });
  await page.locator("#btnNewNote").click();
  await page.waitForFunction(() => {
    const value = document.querySelector("#editorBody")?.value || "";
    const title = document.querySelector(".tab.active .tab-title")?.textContent || "";
    return value.startsWith("# 未命名笔记") && String(title).includes("未命名笔记");
  });
  await page.waitForFunction(() => !window.__prototypeEditor?.savingPromise);
  await ensureSourceMode(page);
  await waitForEditableNoteSurface(page);
  await page.evaluate((value) => {
    const editor = window.__prototypeEditor;
    const markdownEditor = document.querySelector("#editorHost")?.__markdownEditor;
    if (editor?.setEditorValue) {
      editor.setEditorValue(value);
      editor.focusEditor?.();
    } else if (markdownEditor?.setValue) {
      markdownEditor.setValue(value);
      markdownEditor.focus?.();
    } else {
      const textarea = document.querySelector("#editorBody");
      if (textarea) textarea.value = value;
    }
    editor?.handleEditorInput?.();
    editor?.updateActiveTabFromEditor?.();
  }, source);
  await page.waitForFunction(
    ({ title, body }) => {
      const editor = document.querySelector("#editorHost")?.__markdownEditor;
      const value = String(editor?.getValue?.() || document.querySelector("#editorBody")?.value || "");
      const activeTab = window.__prototypeEditor?.activeTab?.() || null;
      const activeTitle = String(activeTab?.title || "");
      const activeBody = String(activeTab?.body || "");
      return (
        value.includes(`# ${title}`) &&
        (!body || value.includes(body)) &&
        activeTitle === title &&
        activeBody.includes(`# ${title}`) &&
        (!body || activeBody.includes(body))
      );
    },
    { title: expectedTitle, body: expectedBody.trim() ? expectedBody : "" }
  );
  await page.waitForFunction(() => !window.__prototypeEditor?.savingPromise);
  await page.evaluate((value) => {
    const activeBody = String(window.__prototypeEditor?.activeTab?.()?.body || "");
    if (activeBody === value) return;
    const editor = window.__prototypeEditor;
    editor?.setEditorValue?.(value);
    editor?.handleEditorInput?.();
    editor?.updateActiveTabFromEditor?.();
  }, source);
  if (confirmAuthorship) {
    await confirmAuthorshipIfVisible(page, {
      claim: options.authorshipClaim || `${expectedTitle} 这是一条用于验收的中心判断`
    });
  }
  await waitFor(async () => {
    const snapshot = await page.evaluate(() => {
      const editor = document.querySelector("#editorHost")?.__markdownEditor;
      return {
        editorValue: String(editor?.getValue?.() || ""),
        bodyValue: String(document.querySelector("#editorBody")?.value || ""),
        activeTabBody: String(window.__prototypeEditor?.activeTab?.()?.body || "")
      };
    });
    const combinedValue = snapshot.editorValue || snapshot.bodyValue || snapshot.activeTabBody;
    assert.match(combinedValue, new RegExp(escapeRegExp(expectedTitle)), `before-save ${JSON.stringify(snapshot)}`);
  }, 4000);
  await page.evaluate((value) => {
    const editor = window.__prototypeEditor;
    editor?.setEditorValue?.(value);
    editor?.handleEditorInput?.();
    editor?.updateActiveTabFromEditor?.();
  }, source);
  const editorValueBeforeSave = await page.locator("#editorBody").inputValue();
  if (saveWithShortcut) {
    await page.keyboard.press(process.platform === "darwin" ? "Meta+S" : "Control+S");
  } else {
    await page.evaluate(() => window.__prototypeEditor?.saveActiveNote?.());
  }
  await waitFor(async () => {
    const snapshot = await page.evaluate(() => {
      const editor = document.querySelector("#editorHost")?.__markdownEditor;
      const editorValue = String(editor?.getValue?.() || "");
      const bodyValue = String(document.querySelector("#editorBody")?.value || "");
      const activeTabBody = String(window.__prototypeEditor?.activeTab?.()?.body || "");
      const saveRequestPayload = window.__lastSaveRequestPayload || null;
      const saveResponsePayload = window.__lastSaveResponsePayload || null;
      return { editorValue, bodyValue, activeTabBody, saveRequestPayload, saveResponsePayload };
    });
    const statusText = await currentStatusText(page);
    const combinedValue = snapshot.editorValue || snapshot.bodyValue || snapshot.activeTabBody;
    const savedBody = String(snapshot.saveResponsePayload?.item?.body || "");
    const savedTitle = String(snapshot.saveResponsePayload?.item?.title || "");
    assert.match(combinedValue, new RegExp(escapeRegExp(expectedTitle)), JSON.stringify(snapshot));
    assert.ok(
      /已同步到 Markdown|已同步到 Markdown，永久笔记已完成作者确认|已同步到 Markdown，但当前永久笔记仍按 draft 处理/.test(String(statusText || "")) ||
        (savedTitle === expectedTitle && (!expectedBody || savedBody.includes(expectedBody))),
      JSON.stringify({ statusText, saveResponsePayload: snapshot.saveResponsePayload })
    );
  }, 10000);
  return editorValueBeforeSave;
}

async function ensureSourceMode(page) {
  const alreadySource = await page.evaluate(() =>
    document.querySelector("#markdownSplit")?.classList.contains("editor-mode-source")
  ).catch(() => false);
  if (alreadySource) return;
  const sourceButton = page.locator("#btnModeToggle");
  if (!(await sourceButton.isVisible().catch(() => false))) return;
  await sourceButton.click();
  await page.waitForFunction(() => {
    const split = document.querySelector("#markdownSplit");
    const content = document.querySelector("#editorHost .cm-content");
    if (!split || !content) return false;
    return split.classList.contains("editor-mode-source") && window.getComputedStyle(content).display !== "none";
  });
}

async function ensureNoteMode(page) {
  const alreadyNoteMode = await page.evaluate(() =>
    document.querySelector("#markdownSplit")?.classList.contains("editor-mode-wysiwyg")
  ).catch(() => false);
  if (alreadyNoteMode) return;
  const modeButton = page.locator("#btnModeToggle");
  if (!(await modeButton.isVisible().catch(() => false))) return;
  await modeButton.click();
  await page.waitForFunction(() => {
    const split = document.querySelector("#markdownSplit");
    const host = document.querySelector("#wysiwygHost");
    if (!split || !host) return false;
    return split.classList.contains("editor-mode-wysiwyg") && window.getComputedStyle(host).display !== "none";
  });
}

async function focusEditorContent(page) {
  await ensureSourceMode(page);
  await page.evaluate(() => {
    document.querySelector("#editorHost")?.__markdownEditor?.focus?.();
  });
}

async function waitForEditableNoteSurface(page) {
  await page.waitForFunction(() => {
    const source = document.querySelector("#editorHost .cm-content");
    const rich = document.querySelector("#wysiwygHost .ProseMirror.toastui-editor-contents");
    const isVisible = (node) =>
      Boolean(
        node &&
        window.getComputedStyle(node).display !== "none" &&
        node.getBoundingClientRect().width > 0 &&
        node.getBoundingClientRect().height > 0
      );
    return isVisible(source) || isVisible(rich);
  });
}

async function waitForActiveNoteBodyLoaded(page) {
  await page.waitForFunction(() => Boolean(window.__prototypeEditor?.activeNote?.()?.bodyLoaded));
}

async function ensurePlaceholderTitleSelection(page) {
  await focusEditorContent(page);
  await page.evaluate(() => {
    const editor = document.querySelector("#editorHost")?.__markdownEditor;
    if (!editor) return;
    const value = String(editor.getValue?.() || "");
    const lineEnd = value.indexOf("\n");
    const end = lineEnd >= 0 ? lineEnd : value.length;
    editor.setSelectionRange?.(2, end);
    editor.focus?.();
  });
  await waitForPlaceholderTitleSelection(page);
}

async function waitForPlaceholderTitleSelection(page) {
  await page.waitForFunction(() => {
    const editor = document.querySelector("#editorHost")?.__markdownEditor;
    if (!editor) return false;
    const value = String(editor.getValue?.() || "");
    const selection = editor.selection?.();
    const lineEnd = value.indexOf("\n");
    const titleEnd = lineEnd >= 0 ? lineEnd : value.length;
    const title = value.startsWith("# ") ? value.slice(2, titleEnd) : value.slice(0, titleEnd);
    if (!selection) return false;
    const selectedText = value.slice(selection.from, selection.to);
    return (
      selectedText === "未命名笔记" ||
      (title === "未命名笔记" && selection.from >= 2 && selection.to <= titleEnd && selection.to > selection.from)
    );
  });
}

async function acceptPrompt(page, expectedMessagePattern, answer) {
  page.once("dialog", async (dialog) => {
    assert.equal(dialog.type(), "prompt");
    assert.match(dialog.message(), expectedMessagePattern);
    await dialog.accept(answer);
  });
}

async function openContextAction(page, locator, actionKey) {
  await locator.click({ button: "right" });
  await page.locator(`#contextMenu button[data-action="${actionKey}"]`).click();
}

async function openImportsModule(page) {
  await page.locator('.rail-btn[data-module="imports"]').click();
  await waitFor(async () => {
    const isActive = await page.locator('.rail-btn[data-module="imports"]').getAttribute("class");
    assert.match(String(isActive || ""), /active/);
    await page.locator("#importPanel:not(.hidden)").waitFor({ timeout: 500 });
    await page.locator("#importWorkspaceTabImport").waitFor({ timeout: 500 });
    await page.locator("#importResult").waitFor({ state: "attached", timeout: 500 });
  }, 7000);
  await page.locator(".import-compat-details").evaluate((el) => {
    el.open = true;
  });
}

async function selectRichTextInBlock(page, selector, searchText) {
  await page.evaluate(
    ({ searchText: targetText }) => {
      const editor = window.__prototypeEditor;
      if (!editor) throw new Error("Missing prototype editor");
      const value = String(editor.getEditorValue?.() || document.querySelector("#editorBody")?.value || "");
      const index = value.indexOf(targetText);
      if (index < 0) throw new Error(`Missing text: ${targetText}`);
      editor.setEditorSelectionRange?.(index, index + targetText.length);
      editor.focusEditor?.();
    },
    { selector, searchText }
  );
}

async function placeCaretAtRichBlockEnd(page, selector) {
  await page.evaluate((blockSelector) => {
    const editor = window.__prototypeEditor;
    if (!editor) throw new Error("Missing prototype editor");
    const value = String(editor.getEditorValue?.() || document.querySelector("#editorBody")?.value || "");
    let position = value.length;

    if (String(blockSelector || "").includes("h2")) {
      const match = value.match(/(^|\n)##\s+[^\n]*/);
      if (match) position = match.index + match[0].length;
    } else if (String(blockSelector || "").includes("h1")) {
      const lineEnd = value.indexOf("\n");
      position = lineEnd >= 0 ? lineEnd : value.length;
    }

    editor.setEditorSelectionRange?.(position, position);
    editor.focusEditor?.();
  }, selector);
}

async function openFirstGraphBridgeFollowup(page) {
  const actionSelector =
    '[data-graph-isolated-action="bridge"], [data-graph-bridge-gap-action="bridge"], [data-graph-followup-action="bridge"]';
  const selectionSelector = "[data-graph-select-isolated], [data-graph-select-bridge], [data-graph-isolated-key]";
  const bridgeSectionSelector = '[data-graph-section="bridge-gaps"]';
  await waitFor(async () => {
    const action = page.locator(actionSelector).first();
    if ((await action.count().catch(() => 0)) > 0) {
      await action.waitFor({ timeout: 500 });
      return;
    }
    const bridgeSection = page.locator(bridgeSectionSelector).first();
    if ((await bridgeSection.count().catch(() => 0)) > 0) {
      await bridgeSection.evaluate((node) => {
        node.open = true;
      });
      await page.locator(actionSelector).first().waitFor({ timeout: 500 });
      return;
    }
    const selection = page.locator(selectionSelector).first();
    await selection.waitFor({ timeout: 500 });
    await selection.click();
    await page.locator(actionSelector).first().waitFor({ timeout: 500 });
  }, 7000);
  await page.locator(actionSelector).first().click();
}

test("prototype browser flow creates, edits, and persists a markdown note", async (t) => {
  if (process.env.RUN_BROWSER_E2E !== "1") {
    t.skip("Set RUN_BROWSER_E2E=1 to enable browser e2e in local runs.");
    return;
  }

  const playwright = await optionalPlaywright(t);
  if (!playwright) return;

  const stack = await startPrototypeStack(t, playwright);
  if (!stack) return;
  const { apiBase, page } = stack;

  await page.waitForFunction(() => document.querySelector("#importPanel")?.classList.contains("hidden"));
  await page.waitForFunction(() => !document.querySelector("#markdownPanel")?.classList.contains("hidden"));

  const noteUpdatePayloads = [];
  page.on("request", (request) => {
    if (request.method() !== "PUT") return;
    if (!request.url().includes("/api/v1/notes/")) return;
    const raw = request.postData();
    if (!raw) return;
    try {
      noteUpdatePayloads.push(JSON.parse(raw));
    } catch {}
  });

  await page.locator("#btnNewNote").click();
  await page.waitForSelector(".tab.active");
  await ensureSourceMode(page);
  await waitForEditableNoteSurface(page);
  await page.waitForFunction(() => !window.__prototypeEditor?.savingPromise);
  await ensurePlaceholderTitleSelection(page);
  await page.keyboard.type("Browser E2E note");
  await page.keyboard.press("Enter");
  await page.keyboard.type("This markdown note was edited through the prototype UI. #e2e");
  await waitFor(async () => {
    const value = await page.locator("#editorBody").inputValue();
    assert.match(value, /Browser E2E note/);
    assert.match(value, /prototype UI/);
    assert.equal(await page.evaluate(() => window.__prototypeEditor?.activeTab?.()?.dirty === true), true);
  }, 7000);
  await confirmAuthorshipIfVisible(page, { claim: "Browser E2E note 的内容由我确认后保存。" });
  await page.evaluate(() => window.__prototypeEditor?.saveActiveNote?.({ skipOriginalityCheck: true }));

  const notes = await waitFor(async () => {
    const result = await fetchJson(apiBase, "/api/v1/directories/dir_original_default/notes");
    assert.equal(result.status, 200);
    assert.equal(result.json.total, 1);
    assert.match(result.json.items[0].body, /This markdown note was edited through the prototype UI\./);
    return result;
  }, 7000);

  await waitFor(async () => {
    assert.ok(
      noteUpdatePayloads.some((payload) => String(payload.body || "").includes("# Browser E2E note")),
      JSON.stringify({ noteUpdatePayloads }, null, 2)
    );
  }, 7000);

  const noteId = notes.json.items[0].id;
  const note = await fetchJson(apiBase, `/api/v1/notes/${encodeURIComponent(noteId)}`);
  assert.equal(note.status, 200);
  assert.match(note.json.item.body, /This markdown note was edited through the prototype UI\./);
  assert.match(note.json.item.body, /#e2e/);
});

test("prototype permanent note can save and persists content after authorship confirmation flow", async (t) => {
  if (process.env.RUN_BROWSER_E2E !== "1") {
    t.skip("Set RUN_BROWSER_E2E=1 to enable browser e2e in local runs.");
    return;
  }

  const playwright = await optionalPlaywright(t);
  if (!playwright) return;

  const stack = await startPrototypeStack(t, playwright);
  if (!stack) return;
  const { apiBase, page } = stack;

  await page.waitForFunction(() => document.querySelector("#importPanel")?.classList.contains("hidden"));
  await page.waitForFunction(() => !document.querySelector("#markdownPanel")?.classList.contains("hidden"));

  await page.locator("#btnNewNote").click();
  await page.waitForSelector(".tab.active");
  await ensureSourceMode(page);
  await waitForEditableNoteSurface(page);
  await page.evaluate(() => {
    const markdown = "# Authorship Gate Note\n\nThis note should not hit Markdown until I explicitly confirm authorship.";
    window.__prototypeEditor?.setEditorValue?.(markdown);
    window.__prototypeEditor?.handleEditorInput?.();
  });
  await waitFor(async () => {
    const value = await page.locator("#editorBody").inputValue();
    assert.match(value, /Authorship Gate Note/);
    assert.match(value, /explicitly confirm authorship/);
  }, 7000);
  assert.equal(await page.locator("#btnInsertLink").isVisible(), true);
  assert.equal(await page.locator("#btnRunGuard").count(), 0);

  await page.evaluate(() => window.__prototypeEditor?.saveActiveNote?.());

  const savedNoteId = await waitFor(async () => {
    const result = await fetchJson(apiBase, "/api/v1/directories/dir_original_default/notes");
    assert.equal(result.status, 200);
    assert.equal(result.json.total, 1);
    return result.json.items[0]?.id || "";
  }, 10000);

  const authorshipHandled = await confirmAuthorshipIfVisible(page, { claim: "Authorship Gate Note 的内容由我确认后保存。" });
  if (authorshipHandled) {
    await page.evaluate(() => window.__prototypeEditor?.saveActiveNote?.());
  }

  await waitFor(async () => {
    const savedNote = await fetchJson(apiBase, `/api/v1/notes/${encodeURIComponent(savedNoteId)}`);
    assert.equal(savedNote.status, 200);
    assert.match(savedNote.json.item.body || "", /Authorship Gate Note/);
    assert.match(savedNote.json.item.body || "", /explicitly confirm authorship/);
    const draftCount = await page.evaluate(() =>
      Object.keys(window.localStorage).filter((key) => key.startsWith("yansilu:draft:")).length
    );
    assert.equal(draftCount, 0);
  }, 10000);
});


test("prototype literature note keeps permanent-note actions out of the editor toolbar", async (t) => {
  if (process.env.RUN_BROWSER_E2E !== "1") {
    t.skip("Set RUN_BROWSER_E2E=1 to enable browser e2e in local runs.");
    return;
  }

  const playwright = await optionalPlaywright(t);
  if (!playwright) return;

  const stack = await startPrototypeStack(t, playwright);
  if (!stack) return;
  const { apiBase, page, webBase } = stack;

  const literatureCreate = await postJson(apiBase, "/api/v1/notes", {
    directoryId: "dir_literature_default",
    status: "draft",
    body: [
      "# 文献摘录验收",
      "",
      "## 文献信息",
      "",
      "- 标题：概念理解研究",
      "- 作者：作者一",
      "- 年份：2024",
      "- 主题：知识写作方法",
      "- 来源：研思录验收样例",
      "- 页码 / 位置：p. 12",
      "- 版本：测试版",
      "- 摘录 / 引文：",
      "- DOI / ISBN / arXiv / URL / PDF：https://example.com/concept-understanding",
      "",
      "## 原文",
      "A concept note should preserve the source boundary instead of flattening the author claim.",
      "",
      "## 转述",
      "Turning a paper extract into my own wording requires preserving the citation boundary and the author/source distinction.",
      "",
      "## 我的判断",
      "Turning excerpts into my own judgment means keeping the source boundary explicit instead of collapsing it into a fake summary.",
      "",
      "## 支持判断",
      "这段材料支持我的判断：研思录需要把摘录、转述和自己的判断分开。"
    ].join("\n")
  });
  assert.equal(literatureCreate.status, 201, JSON.stringify(literatureCreate.json));
  const literatureNoteId = literatureCreate.json.item.id;

  await page.goto(`${webBase}/prototype`, { waitUntil: "networkidle" });
  await page.locator('[data-action="quick-literature"]').click();
  await page.locator('.explorer-item[data-kind="folder"][data-id="dir_literature_default"]').click();
  await page.locator('.explorer-item[data-kind="file"]', { hasText: "文献摘录验收" }).waitFor();
  await page.locator('.explorer-item[data-kind="file"]', { hasText: "文献摘录验收" }).click();
  await ensureSourceMode(page);

  await waitFor(async () => {
    const editorValue = await page.locator("#editorBody").inputValue();
    assert.match(String(editorValue || ""), /## 文献信息/);
    assert.match(String(editorValue || ""), /DOI \/ ISBN \/ arXiv \/ URL \/ PDF/);
    assert.match(String(editorValue || ""), /## 原文/);
    assert.match(String(editorValue || ""), /## 转述/);
    assert.doesNotMatch(String(editorValue || ""), /判断种子|追问|边界\s*\/\s*反例|保留原因/);
  }, 7000);
  assert.equal(await page.locator("#btnRunGuard").count(), 0);
  assert.equal(await page.locator("#btnInsertLink").isVisible(), false);

  await page.keyboard.press(process.platform === "darwin" ? "Meta+S" : "Control+S");

  await waitFor(async () => {
    const note = await fetchJson(apiBase, `/api/v1/notes/${encodeURIComponent(literatureNoteId)}`);
    assert.equal(note.status, 200);
    assert.match(note.json.item.body || "", /## 转述/);
    assert.match(note.json.item.body || "", /摘录/);
    const statusText = await currentStatusText(page);
    assert.match(String(statusText || ""), /当前修改已同步|文献笔记已完成|已同步到 Markdown/);
  }, 10000);

  assert.equal(await page.locator('[data-toolbar-command="code"]').isVisible(), true);
});

test("prototype literature note with missing metadata has no toolbar recording action", async (t) => {
  if (process.env.RUN_BROWSER_E2E !== "1") {
    t.skip("Set RUN_BROWSER_E2E=1 to enable browser e2e in local runs.");
    return;
  }

  const playwright = await optionalPlaywright(t);
  if (!playwright) return;

  const stack = await startPrototypeStack(t, playwright);
  if (!stack) return;
  const { apiBase, page, webBase } = stack;

  const literatureCreate = await postJson(apiBase, "/api/v1/notes", {
    directoryId: "dir_literature_default",
    status: "draft",
    body: [
      "# 缺少文献信息验收",
      "",
      "## 原文",
      "这条摘录没有完整参考文献和来源信息。",
      "",
      "## 转述",
      "This note still lacks source metadata, so the paraphrase should remain blocked until the boundary and provenance are explicit.",
      "",
      "## 我的判断",
      "缺少文献信息时，不应该生成永久笔记。",
      "",
      "## 支持判断",
      "这支持源笔记必须先补齐作者、出处和来源字段的判断。"
    ].join("\n")
  });
  assert.equal(literatureCreate.status, 201, JSON.stringify(literatureCreate.json));

  await page.goto(`${webBase}/prototype`, { waitUntil: "networkidle" });
  await page.locator('[data-action="quick-literature"]').click();
  await page.locator('.explorer-item[data-kind="folder"][data-id="dir_literature_default"]').click();
  await page.locator('.explorer-item[data-kind="file"]', { hasText: "缺少文献信息验收" }).click();
  await waitFor(async () => {
    const editorBody = await page.locator("#editorBody").inputValue();
    assert.match(editorBody || "", /缺少文献信息验收/);
    assert.match(editorBody || "", /should remain blocked until the boundary and provenance are explicit/);
  }, 7000);
  const originalsBefore = await fetchJson(apiBase, "/api/v1/directories/dir_original_default/notes");
  assert.equal(originalsBefore.status, 200);
  const originalIdsBefore = originalsBefore.json.items.map((item) => item.id).sort();

  assert.equal(await page.locator("#btnRunGuard").count(), 0);
  assert.equal(await page.locator("#btnInsertLink").isVisible(), false);

  const originals = await fetchJson(apiBase, "/api/v1/directories/dir_original_default/notes");
  assert.equal(originals.status, 200);
  assert.deepEqual(
    originals.json.items.map((item) => item.id).sort(),
    originalIdsBefore
  );
});

test("standalone editor route loads and saves a note without workspace chrome", async (t) => {
  if (process.env.RUN_BROWSER_E2E !== "1") {
    t.skip("Set RUN_BROWSER_E2E=1 to enable browser e2e in local runs.");
    return;
  }

  const playwright = await optionalPlaywright(t);
  if (!playwright) return;

  const stack = await startPrototypeStack(t, playwright);
  if (!stack) return;
  const { apiBase, webBase, page } = stack;

  const created = await postJson(apiBase, "/api/v1/notes", {
    directoryId: "dir_original_default",
    body: "# Standalone editor note\n\nLoaded through the dedicated editor route."
  });
  assert.equal(created.status, 201);
  const noteId = created.json.item.id;

  await page.goto(`${webBase}/editor?note=${encodeURIComponent(noteId)}`, { waitUntil: "networkidle" });

  await page.waitForFunction(() => {
    const rail = document.querySelector(".rail");
    const sidebar = document.querySelector(".sidebar");
    const importPanel = document.querySelector("#importPanel");
    const relatedPanel = document.querySelector("#relatedPanel");
    const markdownPanel = document.querySelector("#markdownPanel");
    const styleOf = (node) => (node ? window.getComputedStyle(node) : null);
    return Boolean(
      document.documentElement.classList.contains("editor-only") &&
        rail &&
        sidebar &&
        importPanel &&
        relatedPanel &&
        markdownPanel &&
        styleOf(rail)?.display === "none" &&
        styleOf(sidebar)?.display === "none" &&
        styleOf(importPanel)?.display === "none" &&
        styleOf(relatedPanel)?.display === "none" &&
        styleOf(markdownPanel)?.display !== "none"
    );
  });

  await ensureSourceMode(page);
  await page.waitForFunction(() => {
    const value = document.querySelector("#editorBody")?.value || "";
    return value.includes("Standalone editor note") && value.includes("dedicated editor route");
  });

  await focusEditorContent(page);
  await page.keyboard.press(process.platform === "darwin" ? "Meta+End" : "Control+End");
  await page.keyboard.type("\n\nSaved from /editor.");
  await confirmAuthorshipIfVisible(page);
  await page.keyboard.press(process.platform === "darwin" ? "Meta+S" : "Control+S");

  await waitFor(async () => {
    const note = await fetchJson(apiBase, `/api/v1/notes/${encodeURIComponent(noteId)}`);
    assert.equal(note.status, 200);
    assert.match(note.json.item.body, /Saved from \/editor\./);
    const status = await currentStatusText(page);
    assert.match(String(status || ""), /已同步到 Markdown|永久笔记已同步|永久笔记已同步，但仍建议继续打磨/);
  }, 10000);
});

test("prototype new note auto-selects placeholder title for immediate typing", async (t) => {
  if (process.env.RUN_BROWSER_E2E !== "1") {
    t.skip("Set RUN_BROWSER_E2E=1 to enable browser e2e in local runs.");
    return;
  }

  const playwright = await optionalPlaywright(t);
  if (!playwright) return;

  const stack = await startPrototypeStack(t, playwright);
  if (!stack) return;
  const { page } = stack;

  await page.locator("#btnNewNote").click();
  await ensurePlaceholderTitleSelection(page);
  await page.keyboard.type("Immediate Title");

  await waitFor(async () => {
    const editorValue = await page.locator("#editorBody").inputValue();
    const tabTitle = await page.locator(".tab.active .tab-title").textContent();
    assert.match(editorValue, /^# Immediate Title\b/);
    assert.doesNotMatch(editorValue, /未命名笔记/);
    assert.match(editorValue, /## 核心观点/);
    assert.match(editorValue, /## 为什么成立/);
    assert.match(editorValue, /## 边界 \/ 反例/);
    assert.match(editorValue, /## 相关笔记/);
    assert.match(tabTitle || "", /Immediate Title/);
  }, 7000);
});

test("prototype editor inserts Chinese text at the clicked permanent-note field instead of the file tail", async (t) => {
  if (process.env.RUN_BROWSER_E2E !== "1") {
    t.skip("Set RUN_BROWSER_E2E=1 to enable browser e2e in local runs.");
    return;
  }

  const playwright = await optionalPlaywright(t);
  if (!playwright) return;

  const stack = await startPrototypeStack(t, playwright);
  if (!stack) return;
  const { page } = stack;

  await page.locator("#btnNewNote").click();
  await ensureNoteMode(page);
  await waitForActiveNoteBodyLoaded(page);
  await waitForEditableNoteSurface(page);

  await waitFor(async () => {
    const editorValue = await page.locator("#editorBody").inputValue();
    assert.match(editorValue, /## 核心观点\n\n写成一句可被反驳、可被引用、值得保留的判断。/);
    assert.doesNotMatch(editorValue, /^> 写成一句/m);
    assert.doesNotMatch(editorValue, /^- 来自哪条文献/m);
  }, 7000);

  const coreClaimParagraph = page.locator(
    "#wysiwygHost .toastui-editor-ww-container .ProseMirror.toastui-editor-contents p",
    { hasText: "写成一句可被反驳、可被引用、值得保留的判断。" }
  );
  await waitFor(async () => {
    assert.equal(await coreClaimParagraph.count(), 1);
  }, 7000);

  await coreClaimParagraph.click();
  await page.keyboard.type("中文观点不会跑到末尾");

  await waitFor(async () => {
    const editorValue = await page.locator("#editorBody").inputValue();
    const insertedAt = editorValue.indexOf("中文观点不会跑到末尾");
    const whyTrueAt = editorValue.indexOf("## 为什么成立");
    const boundaryAt = editorValue.indexOf("## 边界 / 反例");
    assert.ok(insertedAt > editorValue.indexOf("## 核心观点"), editorValue);
    assert.ok(insertedAt > 0 && insertedAt < whyTrueAt, editorValue);
    assert.ok(boundaryAt > insertedAt, editorValue);
    assert.doesNotMatch(editorValue.slice(boundaryAt), /中文观点不会跑到末尾/);
  }, 7000);
});

test("prototype note browser stays minimal and creates literature notes in the literature root", async (t) => {
  if (process.env.RUN_BROWSER_E2E !== "1") {
    t.skip("Set RUN_BROWSER_E2E=1 to enable browser e2e in local runs.");
    return;
  }

  const playwright = await optionalPlaywright(t);
  if (!playwright) return;

  const stack = await startPrototypeStack(t, playwright);
  if (!stack) return;
  const { apiBase, page } = stack;

  const assertMinimalBrowser = async (action, rootId) => {
    if (action) await page.locator(`[data-action="${action}"]`).click();
    await page.waitForFunction((expectedRootId) => window.__prototypeState?.browserRootId === expectedRootId, rootId);
    const sidebar = await page.evaluate(() => {
      const visible = (selector) => {
        const el = document.querySelector(selector);
        if (!el) return false;
        const style = window.getComputedStyle(el);
        const box = el.getBoundingClientRect();
        return style.display !== "none" && style.visibility !== "hidden" && box.width > 0 && box.height > 0;
      };
      return {
        title: document.querySelector("#sidebarTitle")?.textContent?.trim() || "",
        subtitleVisible: visible("#sidebarSubtitle"),
        flowVisible: visible("#sidebarFlow"),
        footVisible: visible("#sidebarFoot"),
        moduleVisible: visible("#moduleSidebar"),
        listVisible: visible("#listArea"),
        flowText: document.querySelector("#sidebarFlow")?.textContent?.trim() || "",
        listText: document.querySelector("#listArea")?.textContent?.trim() || ""
      };
    });

    assert.doesNotMatch(sidebar.title, /工作台|跟进/);
    assert.equal(sidebar.subtitleVisible, false);
    assert.equal(sidebar.flowVisible, false);
    assert.equal(sidebar.footVisible, false);
    assert.equal(sidebar.moduleVisible, false);
    assert.equal(sidebar.listVisible, true);
    assert.equal(sidebar.flowText, "");
    assert.ok(sidebar.listText.length > 0);
  };

  await assertMinimalBrowser("quick-original", "dir_original_default");
  await assertMinimalBrowser("quick-fleeting", "dir_fleeting_default");
  await assertMinimalBrowser("quick-literature", "dir_literature_default");

  const literatureBefore = await fetchJson(apiBase, "/api/v1/directories/dir_literature_default/notes");
  const originalBefore = await fetchJson(apiBase, "/api/v1/directories/dir_original_default/notes");
  assert.equal(literatureBefore.status, 200);
  assert.equal(originalBefore.status, 200);

  assert.match((await page.locator("#btnNewNote").getAttribute("aria-label")) || "", /摘录/);
  await page.locator("#btnNewNote").click();

  await waitFor(async () => {
    const active = await page.evaluate(() => {
      const state = window.__prototypeState || {};
      const activeTab = Array.isArray(state.tabs) ? state.tabs.find((tab) => tab.id === state.activeTabId) : null;
      const noteId = state.selectedFileId || activeTab?.noteId || "";
      const note = Array.isArray(state.notes) ? state.notes.find((item) => item.id === noteId) : null;
      return {
        browserRootId: state.browserRootId,
        selectedFolderId: state.selectedFolderId,
        noteId,
        folderId: note?.folderId || "",
        noteType: note?.noteType || ""
      };
    });
    assert.equal(active.browserRootId, "dir_literature_default");
    assert.equal(active.selectedFolderId, "dir_literature_default");
    assert.equal(active.folderId, "dir_literature_default");
    assert.equal(active.noteType, "literature");
    assert.ok(active.noteId);

    const literatureAfter = await fetchJson(apiBase, "/api/v1/directories/dir_literature_default/notes");
    const originalAfter = await fetchJson(apiBase, "/api/v1/directories/dir_original_default/notes");
    assert.equal(literatureAfter.json.total, literatureBefore.json.total + 1);
    assert.equal(originalAfter.json.total, originalBefore.json.total);
  }, 10000);
});

test("prototype mobile viewport keeps new note entry discoverable", async (t) => {
  if (process.env.RUN_BROWSER_E2E !== "1") {
    t.skip("Set RUN_BROWSER_E2E=1 to enable browser e2e in local runs.");
    return;
  }

  const playwright = await optionalPlaywright(t);
  if (!playwright) return;

  const stack = await startPrototypeStack(t, playwright, {
    beforeGoto: async (page) => {
      await page.setViewportSize({ width: 390, height: 844 });
    }
  });
  if (!stack) return;
  const { page } = stack;

  await page.waitForSelector("#btnMobileNewNote");
  await page.waitForFunction(() => {
    const fab = document.querySelector("#btnMobileNewNote");
    const bottomNotice = document.querySelector("#originalityNotice");
    const visible = (el) => {
      if (!el) return false;
      const style = window.getComputedStyle(el);
      const box = el.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && box.width > 0 && box.height > 0;
    };
    return visible(fab) && !visible(bottomNotice);
  });

  const mobileLayout = await page.evaluate(() => {
    const fab = document.querySelector("#btnMobileNewNote");
    const sidebarNew = document.querySelector("#btnNewNote");
    const toolbar = document.querySelector(".editor-stage-shell .toolbar");
    const thinkingStatus = document.querySelector("#editorThinkingStatus");
    const bottomNotice = document.querySelector("#originalityNotice");
    const rect = (el) => {
      if (!el) return null;
      const box = el.getBoundingClientRect();
      return { width: box.width, height: box.height, left: box.left, right: box.right };
    };
    const isVisible = (el) => {
      if (!el) return false;
      const style = window.getComputedStyle(el);
      const box = el.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && box.width > 0 && box.height > 0;
    };
    return {
      viewportWidth: window.innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      bodyWidth: document.body.scrollWidth,
      fab: {
        visible: isVisible(fab),
        text: fab?.textContent?.trim() || "",
        label: fab?.getAttribute("aria-label") || fab?.getAttribute("title") || "",
        rect: rect(fab)
      },
      thinkingStatus: { visible: isVisible(thinkingStatus), text: thinkingStatus?.textContent?.trim() || "", rect: rect(thinkingStatus) },
      bottomNotice: { visible: isVisible(bottomNotice), text: bottomNotice?.textContent?.trim() || "", rect: rect(bottomNotice) },
      sidebarNew: { visible: isVisible(sidebarNew), rect: rect(sidebarNew) },
      toolbar: {
        rect: rect(toolbar),
        scrollWidth: toolbar?.scrollWidth || 0,
        clientWidth: toolbar?.clientWidth || 0,
        overflowX: toolbar ? window.getComputedStyle(toolbar).overflowX : "",
        flexWrap: toolbar ? window.getComputedStyle(toolbar).flexWrap : ""
      }
    };
  });

  assert.equal(mobileLayout.fab.visible, true);
  assert.match(`${mobileLayout.fab.text} ${mobileLayout.fab.label}`.trim(), /永久|新建|笔记/);
  assert.equal(mobileLayout.thinkingStatus.visible, false);
  assert.equal(mobileLayout.bottomNotice.visible, false);
  assert.equal(mobileLayout.sidebarNew.visible, false);
  assert.equal(mobileLayout.documentWidth <= mobileLayout.viewportWidth + 1, true);
  assert.equal(mobileLayout.bodyWidth <= mobileLayout.viewportWidth + 1, true);
  assert.equal(mobileLayout.toolbar.overflowX, "auto");
  assert.equal(mobileLayout.toolbar.flexWrap, "nowrap");
  assert.ok(mobileLayout.toolbar.scrollWidth > mobileLayout.toolbar.clientWidth);

  await page.locator("#btnMobileNewNote").click();
  await page.waitForSelector(".tab.active");

  await waitFor(async () => {
    const editorValue = await page.locator("#editorBody").inputValue();
    const activeTabText = await page.locator(".tab.active").textContent();
    assert.match(editorValue, /^#\s*\S/);
    assert.ok(String(activeTabText || "").trim().length > 0);
  }, 7000);
});

test("prototype root boxes keep source-note and isolated badges scoped to their own note types", async (t) => {
  if (process.env.RUN_BROWSER_E2E !== "1") {
    t.skip("Set RUN_BROWSER_E2E=1 to enable browser e2e in local runs.");
    return;
  }

  const playwright = await optionalPlaywright(t);
  if (!playwright) return;

  const stack = await startPrototypeStack(t, playwright);
  if (!stack) return;
  const { apiBase, page, webBase } = stack;

  const fleetingCreate = await postJson(apiBase, "/api/v1/notes", {
    directoryId: "dir_fleeting_default",
    body: "# Fleeting Source Note\n\nCapture the idea first, then decide whether it deserves a permanent note."
  });
  assert.equal(fleetingCreate.status, 201, JSON.stringify(fleetingCreate.json));

  const literatureCreate = await postJson(apiBase, "/api/v1/notes", {
    directoryId: "dir_literature_default",
    status: "draft",
    body: [
      "# Literature Source Note",
      "",
      "## 引用信息",
      "",
      "- 标题：Boundary in Reading Notes",
      "- 作者：Example Author",
      "- 年份：2024",
      "- 容器：Journal",
      "- 出版社 / 来源：https://example.com/boundary",
      "- 页码 / 定位：p. 12",
      "",
      "## 原文",
      "Keep the citation boundary explicit.",
      "",
      "## 转述",
      "A literature note should preserve provenance before it becomes a permanent note.",
      "",
      "## 判断种子",
      "The source note is evidence, not yet part of the permanent-note relation network."
    ].join("\n")
  });
  assert.equal(literatureCreate.status, 201, JSON.stringify(literatureCreate.json));

  const permanentOne = await postJson(apiBase, "/api/v1/notes", {
    directoryId: "dir_original_default",
    body: "# Lonely Permanent One\n\nThis permanent note does not yet connect to other notes."
  });
  const permanentTwo = await postJson(apiBase, "/api/v1/notes", {
    directoryId: "dir_original_default",
    body: "# Lonely Permanent Two\n\nThis permanent note also waits for explicit relations."
  });
  assert.equal(permanentOne.status, 201, JSON.stringify(permanentOne.json));
  assert.equal(permanentTwo.status, 201, JSON.stringify(permanentTwo.json));

  await page.goto(`${webBase}/prototype`, { waitUntil: "networkidle" });

  const fleetingNoteId = fleetingCreate.json.item.id;
  const literatureNoteId = literatureCreate.json.item.id;

  await page.locator('[data-action="quick-fleeting"]').click();
  await page.locator('.explorer-item[data-kind="folder"][data-id="dir_fleeting_default"]').click();
  await page.locator(`.explorer-item[data-kind="file"][data-id="${fleetingNoteId}"]`).click();
  await waitFor(async () => {
    assert.equal(await page.locator(".tab.active .tab-title").textContent(), "Fleeting Source Note");
  }, 7000);
  assert.equal(await page.locator("#btnInsertLink").isVisible(), false);
  assert.equal(await page.locator("#btnRecordPermanent").isVisible(), true);
  assert.equal(await page.locator("#literatureWorkspace").isVisible(), false);
  assert.equal(await page.locator("#originalityNotice").isVisible(), false);
  assert.equal(
    await page.locator(`.explorer-item[data-kind="file"][data-id="${fleetingNoteId}"] .tree-state-icon`).getAttribute("data-note-state"),
    "source-pending"
  );
  assert.match(String((await page.locator("#btnRecordPermanent").textContent()) || ""), /创建永久笔记/);

  await page.locator('[data-action="quick-literature"]').click();
  await page.locator('.explorer-item[data-kind="folder"][data-id="dir_literature_default"]').click();
  await page.locator(`.explorer-item[data-kind="file"][data-id="${literatureNoteId}"]`).click();
  await waitFor(async () => {
    assert.equal(await page.locator(".tab.active .tab-title").textContent(), "Literature Source Note");
  }, 7000);
  assert.equal(await page.locator("#btnInsertLink").isVisible(), false);
  assert.equal(await page.locator("#btnRecordPermanent").isVisible(), true);
  assert.equal(await page.locator("#literatureWorkspace").isVisible(), true);
  assert.equal(await page.locator("#originalityNotice").isVisible(), false);
  assert.equal(
    await page.locator(`.explorer-item[data-kind="file"][data-id="${literatureNoteId}"] .tree-state-icon`).getAttribute("data-note-state"),
    "source-pending"
  );
  await page.locator("#btnRecordPermanent").click();
  await page.locator("#permanentNoteModal").waitFor();
  assert.match(String((await page.locator("#permanentNoteSourceType").textContent()) || ""), /文献笔记/);
  assert.match(String((await page.locator("#permanentNoteSourceHint").textContent()) || ""), /先选/);
  assert.equal(await page.locator("#permanentNoteTargetFolder option").count() > 0, true);
  await page.locator("#permanentNoteCancel").click();
  await page.locator("#permanentNoteModal.hidden").waitFor();

  await page.locator('[data-module="graph"]').click();
  await page.waitForFunction(() => window.__prototypeState?.graphConnectivityReady === true, null, { timeout: 10000 });
  await page.locator('[data-action="quick-original"]').click();
  await page.waitForFunction(() => window.__prototypeState?.browserRootId === "dir_original_default");

  assert.equal(
    await page.locator('.explorer-item[data-kind="folder"][data-id="dir_original_default"] .tree-state-icon').getAttribute("data-folder-state"),
    "permanent-isolated"
  );

  const permanentStates = await page.locator('.explorer-item[data-kind="file"] .tree-state-icon').evaluateAll((nodes) =>
    nodes.map((node) => node.getAttribute("data-note-state")).filter(Boolean)
  );
  assert.ok(permanentStates.some((value) => value === "permanent-isolated"));
});

test("prototype graph surfaces a continuous isolated-note handling queue", async (t) => {
  if (process.env.RUN_BROWSER_E2E !== "1") {
    t.skip("Set RUN_BROWSER_E2E=1 to enable browser e2e in local runs.");
    return;
  }

  const playwright = await optionalPlaywright(t);
  if (!playwright) return;

  const stack = await startPrototypeStack(t, playwright);
  if (!stack) return;
  const { apiBase, page, webBase } = stack;

  const created = await postJson(apiBase, "/api/v1/notes", {
    directoryId: "dir_original_default",
    title: "Queue Isolated One",
    body: "# Queue Isolated One\n\nA permanent note that still needs one explicit relationship."
  });
  assert.equal(created.status, 201, JSON.stringify(created.json));

  await page.goto(`${webBase}/prototype`, { waitUntil: "networkidle" });
  await page.locator('[data-module="graph"]').click();
  await page.waitForFunction(() => window.__prototypeState?.graphConnectivityReady === true, null, { timeout: 10000 });

  const strip = page.locator(".graph-isolated-queue-strip");
  await strip.waitFor({ timeout: 10000 });
  assert.match(String(await strip.textContent()), /笔记待关联/);

  await strip.locator('[data-graph-open-workbench-entry="organize"]').click();
  await page.locator(".graph-workbench-panel .graph-isolated-queue").waitFor({ timeout: 5000 });

  await strip.locator("[data-graph-select-isolated]").click();
  await page.locator(".graph-selection-panel").waitFor({ timeout: 5000 });
  assert.match(String(await page.locator(".graph-selection-panel").textContent()), /未入星系|孤立笔记/);
  assert.equal(await page.locator(".graph-selection-panel .graph-isolated-queue.is-compact").count(), 0);
  assert.equal(await page.locator(".graph-selection-panel [data-graph-isolated-relation-form]").count(), 1);
  const workflowTabs = page.locator(".graph-selection-panel [data-graph-isolated-tab]");
  await waitFor(async () => {
    assert.equal(await workflowTabs.count(), 2);
    assert.equal(await workflowTabs.first().getAttribute("aria-selected"), "true");
  }, 4000);
  await workflowTabs.nth(1).click();
  assert.equal(await workflowTabs.nth(1).getAttribute("aria-selected"), "true");
  assert.equal(await page.locator('.graph-selection-panel [data-graph-target-panel="manual"]').isVisible(), true);
  await workflowTabs.nth(1).focus();
  await page.keyboard.press("ArrowRight");
  assert.equal(await workflowTabs.first().getAttribute("aria-selected"), "true");
  assert.equal(await page.locator('.graph-selection-panel [data-graph-target-panel="ai"]').isVisible(), true);
  await page.locator("[data-graph-reading-lens]").first().evaluate((button) => button.click());
  const workflowTabsAfterRender = page.locator(".graph-selection-panel [data-graph-isolated-tab]");
  await waitFor(async () => {
    assert.equal(await workflowTabsAfterRender.first().getAttribute("aria-selected"), "true");
    assert.equal(await page.locator('.graph-selection-panel [data-graph-target-panel="ai"]').isVisible(), true);
  }, 4000);
});


test("prototype clears stale bottom thinking notice on note switch", async (t) => {
  if (process.env.RUN_BROWSER_E2E !== "1") {
    t.skip("Set RUN_BROWSER_E2E=1 to enable browser e2e in local runs.");
    return;
  }

  const playwright = await optionalPlaywright(t);
  if (!playwright) return;

  const stack = await startPrototypeStack(t, playwright);
  if (!stack) return;
  const { apiBase, page, webBase } = stack;

  const noticeSource = await postJson(apiBase, "/api/v1/notes", {
    directoryId: "dir_original_default",
    body: "# Thinking Notice Source\n\nThis permanent note still needs a one-sentence thesis."
  });
  assert.equal(noticeSource.status, 201, JSON.stringify(noticeSource.json));

  const noticeTarget = await postJson(apiBase, "/api/v1/notes", {
    directoryId: "dir_fleeting_default",
    body: "# Thinking Notice Cleared\n\nSwitching to a fleeting note should clear the stale permanent-note reminder."
  });
  assert.equal(noticeTarget.status, 201, JSON.stringify(noticeTarget.json));

  await reloadPrototype(page, webBase);

  const sourceNoteId = noticeSource.json.item.id;
  const targetNoteId = noticeTarget.json.item.id;
  const sourceRow = page.locator(`.explorer-item[data-kind="file"][data-id="${sourceNoteId}"]`);
  const targetRow = page.locator(`.explorer-item[data-kind="file"][data-id="${targetNoteId}"]`);
  await sourceRow.waitFor();

  await sourceRow.click();
  await waitFor(async () => {
    assert.equal(await page.locator(".tab.active .tab-title").textContent(), "Thinking Notice Source");
    assert.equal(await page.locator("#originalityNotice").isVisible(), false);
  }, 7000);

  const thinkingUi = await page.evaluate(() => {
    const header = document.querySelector("#editorThinkingStatus");
    const notice = document.querySelector("#originalityNotice");
    const isVisible = (el) => {
      if (!el) return false;
      const style = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
    };
    return {
      headerText: header?.textContent?.trim() || "",
      headerTone: header?.getAttribute("data-tone") || "",
      headerVisible: isVisible(header),
      noticeVisible: isVisible(notice),
      noticeText: notice?.textContent?.trim() || ""
    };
  });

  assert.equal(thinkingUi.headerVisible, false);
  assert.match(thinkingUi.headerText, /待写一句话判断|待写论点/);
  assert.match(thinkingUi.headerText, /写一句话判断|写一句话看法|继续完善当前笔记/);
  assert.ok(thinkingUi.headerTone);
  assert.equal(thinkingUi.noticeVisible, false);
  assert.doesNotMatch(thinkingUi.noticeText, /待写一句话判断|待写论点/);

  await page.locator('[data-action="quick-fleeting"]').click();
  await page.locator('.explorer-item[data-kind="folder"][data-id="dir_fleeting_default"]').click();
  await targetRow.waitFor();
  await targetRow.click();
  await waitFor(async () => {
    assert.equal(await page.locator(".tab.active .tab-title").textContent(), "Thinking Notice Cleared");
    assert.equal(await page.locator("#originalityNotice").isVisible(), false);
    assert.equal(await page.locator("#editorThinkingStatus").isVisible(), false);
  }, 7000);
});

test("prototype permanent note saves a current viewpoint and shows how it formed", async (t) => {
  if (process.env.RUN_BROWSER_E2E !== "1") {
    t.skip("Set RUN_BROWSER_E2E=1 to enable browser e2e in local runs.");
    return;
  }

  const playwright = await optionalPlaywright(t);
  if (!playwright) return;

  const stack = await startPrototypeStack(t, playwright);
  if (!stack) return;
  const { apiBase, page } = stack;

  await page.waitForFunction(() => document.querySelector("#importPanel")?.classList.contains("hidden"));
  await openOriginalNoteBox(page);
  await page.locator("#editorWorkspace").waitFor({ state: "visible" });

  await createAndSaveNoteViaEditor(
    page,
    "# Distillation Seed\n\nA permanent note that will be distilled in the inspector."
  );

  const noteId = await page.evaluate(() => window.__prototypeEditor?.activeNote?.()?.id || "");
  assert.ok(noteId);

  await page.locator("#btnShowRelated").click();
  await page.locator('[data-note-distillation-form] textarea[name="thesis"]').waitFor({ state: "visible" });

  await page.fill('[data-note-distillation-form] textarea[name="thesis"]', "Distilled thesis.");
  await page.fill('[data-note-distillation-form] textarea[name="startingQuestion"]', "What makes a viewpoint reusable?");
  await page.click('[data-note-distillation-form] button[type="submit"]');

  await waitFor(async () => {
    const statusText = await currentStatusText(page);
    assert.match(String(statusText || ""), /当前观点已保存/);
  }, 10000);

  await waitFor(async () => {
    const note = await fetchJson(apiBase, `/api/v1/notes/${encodeURIComponent(noteId)}`);
    assert.equal(note.status, 200);
    assert.equal(note.json.item.thesis, "Distilled thesis.");
    assert.deepEqual(note.json.item.threeLineSummary, []);
    assert.equal(note.json.item.startingQuestion, "What makes a viewpoint reusable?");
    assert.equal(note.json.item.distillationStatus, "confirmed");
    assert.match(note.json.item.body, /## 提炼观点/);
    assert.match(note.json.item.body, /### 当前观点\n\nDistilled thesis\./);
  }, 10000);

  await page.locator("[data-permanent-workspace-tab='viewpoint']", { hasText: "当前观点" }).click();
  await page.locator("[data-note-distillation-section]", { hasText: "你现在认为是什么？" }).waitFor({ state: "visible" });
  await page.locator("#relatedPanel [data-permanent-workspace-tab='relations']:visible", { hasText: "怎么形成的" }).click();
  await page.locator("#relatedPanel [data-permanent-workspace-pane='relations']:visible").waitFor({ state: "visible" });
  const formationState = await page.evaluate(() => ({
    text: document.querySelector("#relatedPanel [data-permanent-workspace-pane='relations']:not([hidden])")?.textContent || "",
    note: window.__prototypeEditor?.activeNote?.() || null
  }));
  assert.match(formationState.text, /What makes a viewpoint reusable\?/);
  assert.match(formationState.text, /Distilled thesis\./);
  assert.equal(await page.locator("[data-note-distillation-confirm]").count(), 0);
});

test("prototype main-path card refreshes relation state and does not leak stale relation status across note switches", async (t) => {
  if (process.env.RUN_BROWSER_E2E !== "1") {
    t.skip("Set RUN_BROWSER_E2E=1 to enable browser e2e in local runs.");
    return;
  }

  const playwright = await optionalPlaywright(t);
  if (!playwright) return;

  const stack = await startPrototypeStack(t, playwright);
  if (!stack) return;
  const { apiBase, page, webBase } = stack;

  const target = await postJson(apiBase, "/api/v1/notes", {
    directoryId: "dir_original_default",
    body: "# Main Path Relation Target\n\nThis note is the target for a loaded semantic relation."
  });
  assert.equal(target.status, 201, JSON.stringify(target.json));

  const source = await postJson(apiBase, "/api/v1/notes", {
    directoryId: "dir_original_default",
    body: "# Main Path Relation Source\n\nThis note should show a loaded relation in the main-path card."
  });
  assert.equal(source.status, 201, JSON.stringify(source.json));

  const plain = await postJson(apiBase, "/api/v1/notes", {
    directoryId: "dir_original_default",
    body: "# Main Path Plain Note\n\nThis note should not inherit the previous note relation state."
  });
  assert.equal(plain.status, 201, JSON.stringify(plain.json));

  const relation = await postJson(apiBase, `/api/v1/notes/${encodeURIComponent(source.json.item.id)}/relations`, {
    toNoteId: target.json.item.id,
    relationType: "supports",
    rationale: "This explicit relation should surface in the main-path card after relations load.",
    insightQuestion: "Does the main-path card wait for explicit relations before deciding the next step?",
    confidence: 1
  });
  assert.equal(relation.status, 201, JSON.stringify(relation.json));

  await page.goto(`${webBase}/prototype`, { waitUntil: "networkidle" });
  await openOriginalNoteBox(page);
  await page.locator('.explorer-item[data-kind="file"]', { hasText: "Main Path Relation Source" }).click();
  await ensureNoteMode(page);
  await page.locator("#btnShowRelated").click();

  await page.waitForFunction(() => {
    const text = document.querySelector("[data-note-main-path-section]")?.textContent || "";
    return text.trim().length > 0;
  });

  await waitFor(async () => {
    const text = await page.locator("[data-note-main-path-section]").textContent();
    assert.match(String(text || ""), /已加入 1|笔记 1/);
  }, 10000);

  await page.locator('.explorer-item[data-kind="file"]', { hasText: "Main Path Plain Note" }).click();

  await waitFor(async () => {
    const text = await page.locator("[data-note-main-path-section]").textContent();
    assert.doesNotMatch(String(text || ""), /已加入 1|笔记 1/);
    assert.match(String(text || ""), /关系|未连接|关系 0/);
  }, 10000);
});

test("prototype permanent relation workspace saves manually, refreshes before save, and resets on note switch", async (t) => {
  if (process.env.RUN_BROWSER_E2E !== "1") {
    t.skip("Set RUN_BROWSER_E2E=1 to enable browser e2e in local runs.");
    return;
  }

  const playwright = await optionalPlaywright(t);
  if (!playwright) return;

  const stack = await startPrototypeStack(t, playwright);
  if (!stack) return;
  const { apiBase, page, webBase } = stack;

  const target = await postJson(apiBase, "/api/v1/notes", {
    directoryId: "dir_original_default",
    status: "active",
    body: "# Relation Workspace Target\n\nThis target should appear in the permanent relation workspace search results.",
    thesis: "Relation workspace targets should be selected without leaving the current note.",
    threeLineSummary: ["The target is searchable.", "The relation needs a reason.", "The current context should stay open."],
    distillationStatus: "confirmed",
    authorship: { user_confirmed: true, ai_assisted: false },
    boundaryOrCounterpoint: "Only save when the reason is clear."
  });
  assert.equal(target.status, 201, JSON.stringify(target.json));

  const nextTarget = await postJson(apiBase, "/api/v1/notes", {
    directoryId: "dir_original_default",
    status: "active",
    body: "# Relation Workspace Next Target\n\nThis note exists so continuing the workflow still has somewhere to go.",
    thesis: "Continuous relation sorting should leave the user in the same large workspace.",
    threeLineSummary: ["The next target keeps context.", "The user can continue searching.", "The overlay should remain open."],
    distillationStatus: "confirmed",
    authorship: { user_confirmed: true, ai_assisted: false },
    boundaryOrCounterpoint: "Do not force navigation after saving."
  });
  assert.equal(nextTarget.status, 201, JSON.stringify(nextTarget.json));

  const source = await postJson(apiBase, "/api/v1/notes", {
    directoryId: "dir_original_default",
    status: "active",
    body: "# Relation Workspace Source\n\nThis note has no explicit relations yet.",
    thesis: "Relation sorting works best when target, relation type, and reason stay together.",
    threeLineSummary: ["The source starts without relations.", "The user should search manually.", "Saving should keep the overlay state."],
    distillationStatus: "confirmed",
    authorship: { user_confirmed: true, ai_assisted: false },
    boundaryOrCounterpoint: "Avoid mixing this with writing preparation."
  });
  assert.equal(source.status, 201, JSON.stringify(source.json));

  await page.goto(`${webBase}/prototype`, { waitUntil: "networkidle" });
  await openOriginalNoteBox(page);
  await page.locator('.explorer-item[data-kind="file"]', { hasText: "Relation Workspace Source" }).click();
  await ensureNoteMode(page);
  await page.locator("#btnShowRelated").click();

  await page.locator('#relatedPanel [data-permanent-relation-action="open"][data-permanent-relation-mode="manual"]:visible').click();

  const workspace = page.locator("[data-permanent-relation-workspace]");
  await workspace.waitFor({ state: "visible" });
  await waitFor(async () => {
    const focused = await page.evaluate(() => {
      const active = document.activeElement;
      return active?.hasAttribute?.("data-permanent-relation-target-search");
    });
    assert.equal(focused, true);
  }, 4000);

  await page.locator("[data-permanent-relation-target-search]").fill("Relation Workspace Target");
  await page.locator(`[data-permanent-relation-manual-target="${target.json.item.id}"]`).click();
  await page.locator('[data-permanent-relation-type-choice="supports"]').click();
  await page.locator('[data-permanent-relation-field="rationale"]').fill(
    "This source should support the target because it states the relation workflow as a clear, reviewable sequence."
  );

  const relationMethods = [];
  await page.route(`${apiBase}/api/v1/notes/${encodeURIComponent(source.json.item.id)}/relations`, async (route, request) => {
    relationMethods.push(request.method());
    await route.continue();
  });

  await page.locator("[data-permanent-relation-form] button[type='submit']").click();

  await waitFor(async () => {
    assert.equal(await page.locator(".permanent-relation-result").isVisible(), true);
    const relation = await fetchJson(apiBase, `/api/v1/notes/${encodeURIComponent(source.json.item.id)}/relations`);
    assert.equal(relation.status, 200);
    assert.equal(relation.json.item.outgoingLinks.some((link) => link.toNoteId === target.json.item.id && link.relationType === "supports"), true);
    const thinkingStatus = await page.evaluate(
      (noteId) => window.__prototypeState?.notes?.find((note) => note.id === noteId)?.thinkingStatus?.status || "",
      source.json.item.id
    );
    assert.equal(thinkingStatus, "ready_for_index");
  }, 10000);

  const firstPostIndex = relationMethods.indexOf("POST");
  assert.equal(firstPostIndex > 0, true);
  assert.equal(relationMethods.slice(0, firstPostIndex).includes("GET"), true);

  await page.locator('[data-permanent-relation-action="continue"]').click();
  await waitFor(async () => {
    assert.equal(await workspace.isVisible(), true);
    assert.equal(await page.locator("[data-permanent-relation-target-search]").isVisible(), true);
  }, 5000);

  await page.locator(".explorer-item[data-kind='file']", { hasText: "Relation Workspace Next Target" }).evaluate((element) => element.click());
  await waitFor(async () => {
    assert.equal(await page.evaluate(() => window.__prototypeState?.selectedFileId || ""), nextTarget.json.item.id);
  }, 5000);
  await waitFor(async () => {
    assert.equal(await page.locator("[data-permanent-relation-workspace]").count(), 0);
  }, 5000);
});

test("prototype permanent relation workspace saves a searched relation in place", async (t) => {
  if (process.env.RUN_BROWSER_E2E !== "1") {
    t.skip("Set RUN_BROWSER_E2E=1 to enable browser e2e in local runs.");
    return;
  }

  const playwright = await optionalPlaywright(t);
  if (!playwright) return;

  const stack = await startPrototypeStack(t, playwright);
  if (!stack) return;
  const { apiBase, page, webBase } = stack;

  const target = await postJson(apiBase, "/api/v1/notes", {
    directoryId: "dir_original_default",
    status: "active",
    body: "# AI Relation Target\n\nThis note should be returned as an AI relation candidate.",
    thesis: "AI relation suggestions still need a human-confirmed reason before saving.",
    threeLineSummary: ["The target is a candidate.", "The relation type is suggested.", "The user confirms the reason."],
    distillationStatus: "confirmed",
    authorship: { user_confirmed: true, ai_assisted: false },
    boundaryOrCounterpoint: "Do not save rejected candidates."
  });
  assert.equal(target.status, 201, JSON.stringify(target.json));

  const source = await postJson(apiBase, "/api/v1/notes", {
    directoryId: "dir_original_default",
    status: "active",
    body: "# AI Relation Source\n\nThis note should save an AI recommended relation without leaving the current context.",
    thesis: "AI relation suggestions should become formal relations only after the user confirms why.",
    threeLineSummary: ["The source starts with no relation.", "AI proposes a target.", "Saving happens in the overlay."],
    distillationStatus: "confirmed",
    authorship: { user_confirmed: true, ai_assisted: false },
    boundaryOrCounterpoint: "Keep writing preparation out of the relation flow."
  });
  assert.equal(source.status, 201, JSON.stringify(source.json));

  await page.route(`${apiBase}/api/v1/notes/${encodeURIComponent(source.json.item.id)}/ai-analysis`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        item: {
          analysis: {
            relationCandidates: [
              {
                actionSourceNoteId: source.json.item.id,
                counterpartNoteId: target.json.item.id,
                counterpartTitle: "AI Relation Target",
                relationType: "qualifies",
                rationaleDraft: "AI Relation Target qualifies AI Relation Source because it explains the human confirmation boundary.",
                insightQuestionDraft: "What boundary should stay visible before this relation supports writing?"
              }
            ],
            bridgeCandidates: []
          },
          reviewItems: {
            storedArtifactIds: [],
            artifacts: []
          }
        },
        requestId: "browser-ai-relation-workspace",
        timestamp: new Date().toISOString()
      })
    });
  });

  await page.goto(`${webBase}/prototype`, { waitUntil: "networkidle" });
  await openOriginalNoteBox(page);
  await page.locator('.explorer-item[data-kind="file"]', { hasText: "AI Relation Source" }).click();
  await ensureNoteMode(page);
  await page.locator("#btnShowRelated").click();
  await page.locator('#relatedPanel [data-permanent-relation-action="open"][data-permanent-relation-mode="manual"]:visible').click();

  const workspace = page.locator("[data-permanent-relation-workspace]");
  await workspace.waitFor({ state: "visible" });
  await page.locator("[data-permanent-relation-target-search]").fill("AI Relation Target");

  await waitFor(async () => {
    const workspaceText = await workspace.textContent();
    assert.match(String(workspaceText || ""), /AI Relation Target/);
    assert.doesNotMatch(String(workspaceText || ""), /Writing preparation|写作准备/);
  }, 10000);

  await page.locator(`[data-permanent-relation-manual-target="${target.json.item.id}"]`).click();
  await page.locator('[data-permanent-relation-type-choice="qualifies"]').click();
  await page.locator('[data-permanent-relation-field="rationale"]').fill("AI Relation Target qualifies AI Relation Source because it explains the human confirmation boundary.");
  await page.locator("[data-permanent-relation-form] button[type='submit']").click();

  await waitFor(async () => {
    assert.equal(await page.locator(".permanent-relation-result").isVisible(), true);
    const relation = await fetchJson(apiBase, `/api/v1/notes/${encodeURIComponent(source.json.item.id)}/relations`);
    assert.equal(relation.status, 200);
    assert.equal(relation.json.item.outgoingLinks.some((link) => link.toNoteId === target.json.item.id && link.relationType === "qualifies"), true);
  }, 10000);
});

test("prototype right sidebar relation entry saves through overlay and appears in graph", async (t) => {
  if (process.env.RUN_BROWSER_E2E !== "1") {
    t.skip("Set RUN_BROWSER_E2E=1 to enable browser e2e in local runs.");
    return;
  }

  const playwright = await optionalPlaywright(t);
  if (!playwright) return;

  const stack = await startPrototypeStack(t, playwright);
  if (!stack) return;
  const { apiBase, page, vaultPath, webBase } = stack;

  const graphDirectory = await postJson(apiBase, "/api/v1/directories", {
    title: "Sidebar Route Graph Scope",
    parentDirectoryId: "dir_original_default",
    directoryType: "custom",
    fsPath: path.join(vaultPath, "notes", "original", "sidebar-route-graph-scope"),
    maxNotes: 500
  });
  assert.equal(graphDirectory.status, 201, JSON.stringify(graphDirectory.json));
  const graphDirectoryId = graphDirectory.json.item.id;

  const target = await createWritingReadyPermanentNote(apiBase, {
    directoryId: graphDirectoryId,
    body: "# Sidebar Route Target\n\nThis permanent note should become visible as the graph target after a sidebar relation save.",
    thesis: "The graph should show relations saved from the right sidebar overlay.",
    threeLineSummary: ["The target is searchable.", "The relation is saved in the overlay.", "The graph should show the edge."],
    boundaryOrCounterpoint: "Do not lose the source context after saving."
  });

  const source = await createWritingReadyPermanentNote(apiBase, {
    directoryId: graphDirectoryId,
    body: "# Sidebar Route Source\n\nThis permanent note starts isolated and should gain a graph edge from the relation overlay.",
    thesis: "The right sidebar entry should return to the same note and refresh graph visibility after saving.",
    threeLineSummary: ["The source starts isolated.", "The user opens the large relation overlay.", "The saved edge appears in graph."],
    boundaryOrCounterpoint: "Relation sorting should stay separate from writing preparation."
  });

  await page.goto(`${webBase}/prototype`, { waitUntil: "networkidle" });
  await openOriginalNoteBox(page);
  await page.locator(`.explorer-item[data-kind="folder"][data-id="${graphDirectoryId}"]`).click();
  await page.waitForFunction((directoryId) => window.__prototypeState?.selectedFolderId === directoryId, graphDirectoryId);
  await page.locator('.explorer-item[data-kind="file"]', { hasText: "Sidebar Route Source" }).click();
  await ensureNoteMode(page);
  await page.locator("#btnShowRelated").click();
  await page.locator('[data-permanent-relation-action="open"][data-permanent-relation-mode="manual"]').click();

  const workspace = page.locator("[data-permanent-relation-workspace]");
  await workspace.waitFor({ state: "visible" });
  await page.locator("[data-permanent-relation-target-search]").fill("Sidebar Route Target");
  await page.locator(`[data-permanent-relation-manual-target="${target.json.item.id}"]`).click();
  await page.locator('[data-permanent-relation-field="relationType"]').selectOption("supports");
  await page.locator('[data-permanent-relation-field="rationale"]').fill(
    "The source supports the target because both describe the same entry route from sidebar overlay to graph visibility."
  );
  await page.locator("[data-permanent-relation-form] button[type='submit']").click();

  await waitFor(async () => {
    assert.equal(await page.locator(".permanent-relation-result").isVisible(), true);
    const relation = await fetchJson(apiBase, `/api/v1/notes/${encodeURIComponent(source.json.item.id)}/relations`);
    assert.equal(relation.status, 200);
    assert.equal(relation.json.item.outgoingLinks.some((link) => link.toNoteId === target.json.item.id && link.relationType === "supports"), true);
  }, 10000);

  await page.locator('[data-permanent-relation-action="complete"]').click();
  await page.locator("[data-permanent-relation-workspace]").waitFor({ state: "detached" });
  await page.locator('.rail-btn[data-module="graph"]').click();
  await waitFor(async () => {
    await page.locator(`#graphCanvas .graph-map-node[data-node-id="${source.json.item.id}"]`).waitFor({ timeout: 2000 });
    await page.locator(`#graphCanvas .graph-map-node[data-node-id="${target.json.item.id}"]`).waitFor({ timeout: 2000 });
    await page.locator(
      `#graphCanvas .graph-map-edge-group[data-edge-from="${source.json.item.id}"][data-edge-to="${target.json.item.id}"][data-edge-relation-type="supports"]`
    ).waitFor({ timeout: 2000 });
  }, 10000);
});

test("prototype main-path writing readiness matches writing center basket status for the same note", async (t) => {
  if (process.env.RUN_BROWSER_E2E !== "1") {
    t.skip("Set RUN_BROWSER_E2E=1 to enable browser e2e in local runs.");
    return;
  }

  const playwright = await optionalPlaywright(t);
  if (!playwright) return;

  const stack = await startPrototypeStack(t, playwright);
  if (!stack) return;
  const { apiBase, page, webBase } = stack;

  const note = await postJson(apiBase, "/api/v1/notes", {
    directoryId: "dir_original_default",
    status: "active",
    title: "Readiness Basket Note",
    body: "# Readiness Basket Note\n\nA confirmed note with no explicit boundary yet.",
    thesis: "A durable note should be allowed into the basket before it is ready for project creation.",
    threeLineSummary: [
      "The note already has a reusable judgment.",
      "It matters because basket entry should happen earlier than project creation.",
      "It should still wait for stronger structure before stronger actions."
    ],
    distillationStatus: "confirmed",
    authorship: {
      user_confirmed: true,
      ai_assisted: false
    }
  });
  assert.equal(note.status, 201, JSON.stringify(note.json));

  await page.goto(`${webBase}/prototype`, { waitUntil: "networkidle" });
  await openOriginalNoteBox(page);
  await page.locator('.explorer-item[data-kind="file"]', { hasText: "Readiness Basket Note" }).click();
  await ensureNoteMode(page);
  await page.locator("#btnShowRelated").click();

  await waitFor(async () => {
    const text = await page.locator("[data-note-main-path-section]").textContent();
    assert.match(String(text || ""), /设计写作项目/);
  }, 10000);

  await page.locator('.rail-btn[data-module="writing"]').click();
  await page.waitForFunction(() => !document.querySelector("#writingPanel")?.classList.contains("hidden"));
  await page.click("#btnWritingUseCurrent");

  await waitFor(async () => {
    const strip = await page.locator("#writingStatusStrip").textContent();
    assert.match(String(strip || ""), /保存/);
    assert.match(String(strip || ""), /设计写作项目/);
  }, 10000);

  const createProjectText = await page.locator("#btnWritingCreateProject").textContent();
  assert.match(String(createProjectText || ""), /先创建写作项目/);

  const strongModelText = await page.locator("#btnWritingStrongModelAnalysis").textContent();
  assert.match(String(strongModelText || ""), /先准备/);
});

test("prototype main-path project-ready state matches writing center project readiness", async (t) => {
  if (process.env.RUN_BROWSER_E2E !== "1") {
    t.skip("Set RUN_BROWSER_E2E=1 to enable browser e2e in local runs.");
    return;
  }

  const playwright = await optionalPlaywright(t);
  if (!playwright) return;

  const stack = await startPrototypeStack(t, playwright);
  if (!stack) return;
  const { apiBase, page, webBase } = stack;

  const target = await postJson(apiBase, "/api/v1/notes", {
    directoryId: "dir_original_default",
    status: "active",
    title: "Readiness Project Target",
    body: "# Readiness Project Target\n\nA durable target note.",
    thesis: "A target note helps the source note become structurally ready for project creation.",
    threeLineSummary: [
      "The target note already has a reusable judgment.",
      "It matters because the source note should not remain isolated.",
      "It helps the source note move beyond basket-only readiness."
    ],
    distillationStatus: "confirmed",
    authorship: {
      user_confirmed: true,
      ai_assisted: false
    },
    boundaryOrCounterpoint: "This target note is only useful when its relation is explicit."
  });
  assert.equal(target.status, 201, JSON.stringify(target.json));

  const source = await postJson(apiBase, "/api/v1/notes", {
    directoryId: "dir_original_default",
    status: "active",
    title: "Readiness Project Note",
    body: "# Readiness Project Note\n\n[[Readiness Project Target]]\n\nA confirmed note with one explicit relation and a boundary.",
    thesis: "A durable note should become project-ready once boundary and relation are both explicit.",
    threeLineSummary: [
      "The note has a reusable judgment.",
      "It matters because project creation should happen after basket entry, not before.",
      "It should still wait for richer theme signals before strong-model analysis."
    ],
    distillationStatus: "confirmed",
    authorship: {
      user_confirmed: true,
      ai_assisted: false
    },
    boundaryOrCounterpoint: "This readiness only makes sense after at least one explicit relation is added."
  });
  assert.equal(source.status, 201, JSON.stringify(source.json));

  const relation = await postJson(apiBase, `/api/v1/notes/${encodeURIComponent(source.json.item.id)}/relations`, {
    toNoteId: target.json.item.id,
    relationType: "supports",
    rationale: "The target note strengthens the source note enough to justify project creation.",
    insightQuestion: "What is still missing before this turns into strong-model-ready material?",
    confidence: 1
  });
  assert.equal(relation.status, 201, JSON.stringify(relation.json));

  await page.goto(`${webBase}/prototype`, { waitUntil: "networkidle" });
  await openOriginalNoteBox(page);
  await page.locator('.explorer-item[data-kind="file"]', { hasText: "Readiness Project Note" }).click();
  await ensureNoteMode(page);
  await page.locator("#btnShowRelated").click();

  await waitFor(async () => {
    const actionText = await page.locator('[data-note-main-route-action="writing"]').textContent();
    assert.match(String(actionText || ""), /创建项目/);
  }, 10000);

  await page.locator('.rail-btn[data-module="writing"]').click();
  await page.waitForFunction(() => !document.querySelector("#writingPanel")?.classList.contains("hidden"));
  await page.click("#btnWritingUseCurrent");

  await waitFor(async () => {
    const state = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll("#writingStatusStrip .writing-status-card")).map((card) => ({
        label: card.querySelector("span")?.textContent || "",
        value: card.querySelector("strong")?.textContent || "",
        note: card.querySelector("small")?.textContent || ""
      }));
      const cardByLabel = (label) => cards.find((card) => card.label === label) || null;
      const createProject = document.querySelector("#btnWritingCreateProject");
      const strongModel = document.querySelector("#btnWritingStrongModelAnalysis");
      return {
        projectCard: cardByLabel("项目"),
        strongModelCard: cardByLabel("强模型"),
        createProjectText: createProject?.textContent || "",
        createProjectDisabled: Boolean(createProject?.disabled),
        strongModelText: strongModel?.textContent || "",
        strongModelDisabled: Boolean(strongModel?.disabled)
      };
    });

    assert.equal(state.projectCard?.value, "已达到");
    assert.match(String(state.projectCard?.note || ""), /写作项目/);
    assert.equal(state.strongModelCard?.value, "先准备");
    assert.match(String(state.strongModelCard?.note || ""), /强模型准备/);
    assert.equal(state.createProjectDisabled, false);
    assert.equal(state.strongModelDisabled, true);
    assert.match(String(state.createProjectText || ""), /创建写作项目/);
    assert.match(String(state.strongModelText || ""), /先准备/);
  }, 10000);
});

test("prototype editor keeps related inspector collapsed until explicitly opened", async (t) => {
  if (process.env.RUN_BROWSER_E2E !== "1") {
    t.skip("Set RUN_BROWSER_E2E=1 to enable browser e2e in local runs.");
    return;
  }

  const playwright = await optionalPlaywright(t);
  if (!playwright) return;

  const stack = await startPrototypeStack(t, playwright);
  if (!stack) return;
  const { page } = stack;

  await page.locator("#btnNewNote").click();
  await page.waitForSelector(".tab.active");

  await page.waitForFunction(() => {
    const wrap = document.querySelector(".editor-wrap");
    const panel = document.querySelector("#relatedPanel");
    return Boolean(wrap?.classList.contains("inspector-closed") && panel && window.getComputedStyle(panel).display === "none");
  });

  await page.locator("#btnShowRelated").click();

  await page.waitForFunction(() => {
    const wrap = document.querySelector(".editor-wrap");
    const panel = document.querySelector("#relatedPanel");
    return Boolean(wrap && !wrap.classList.contains("inspector-closed") && panel && window.getComputedStyle(panel).display !== "none");
  });
});

test("prototype related inspector renders explicit semantic relations", async (t) => {
  if (process.env.RUN_BROWSER_E2E !== "1") {
    t.skip("Set RUN_BROWSER_E2E=1 to enable browser e2e in local runs.");
    return;
  }

  const playwright = await optionalPlaywright(t);
  if (!playwright) return;

  const stack = await startPrototypeStack(t, playwright);
  if (!stack) return;
  const { apiBase, page, webBase } = stack;

  const target = await postJson(apiBase, "/api/v1/notes", {
    directoryId: "dir_original_default",
    body: "# Relation Target`n`nThis target note collects the claim that still needs supporting evidence."
  });
  assert.equal(target.status, 201, JSON.stringify(target.json));

  const source = await postJson(apiBase, "/api/v1/notes", {
    directoryId: "dir_original_default",
    body: "# Relation Source`n`nThis source note should justify the target claim through an explicit support relation."
  });
  assert.equal(source.status, 201, JSON.stringify(source.json));

  const relation = await postJson(apiBase, `/api/v1/notes/${encodeURIComponent(source.json.item.id)}/relations`, {
    toNoteId: target.json.item.id,
    relationType: "supports",
    rationale: "This source note gives the target claim a concrete supporting reason.",
    insightQuestion: "What exactly makes the support relation strong enough to trust in later writing?",
    confidence: 1
  });
  assert.equal(relation.status, 201, JSON.stringify(relation.json));

  await page.goto(`${webBase}/prototype`, { waitUntil: "networkidle" });
  await openOriginalNoteBox(page);
  await page.locator('.explorer-item[data-kind="file"]', { hasText: "Relation Source" }).click();
  await ensureNoteMode(page);
  await page.locator("#btnShowRelated").click();

  await waitFor(async () => {
    const relatedText = await page.locator("#relatedPanel").textContent();
    assert.match(String(relatedText || ""), /Relation Source/);
    assert.match(String(relatedText || ""), /supports/);
    assert.match(String(relatedText || ""), /Relation Target/);
    assert.match(String(relatedText || ""), /support/);
    assert.match(String(relatedText || ""), /concrete supporting reason/);
    assert.match(String(relatedText || ""), /strong enough to trust/);
  }, 10000);
});

test("prototype related inspector can create an explicit semantic relation", async (t) => {
  if (process.env.RUN_BROWSER_E2E !== "1") {
    t.skip("Set RUN_BROWSER_E2E=1 to enable browser e2e in local runs.");
    return;
  }

  const playwright = await optionalPlaywright(t);
  if (!playwright) return;

  const stack = await startPrototypeStack(t, playwright);
  if (!stack) return;
  const { apiBase, page, webBase } = stack;

  const target = await postJson(apiBase, "/api/v1/notes", {
    directoryId: "dir_original_default",
    status: "active",
    body: "# Writing Target`n`nThis note is the target that still needs a clearly supported relation before drafting.",
    thesis: "A draft should treat supporting evidence as an explicit relation instead of an implied shortcut.",
    threeLineSummary: [
      "The target starts in a state where the support path is still missing.",
      "Its value comes from making the relation and evidence visible.",
      "The source relation should keep the draft grounded in the note state."
    ],
    distillationStatus: "confirmed",
    authorship: {
      user_confirmed: true,
      ai_assisted: false
    },
    boundaryOrCounterpoint: "Only treat the target as stable when the support relation is explicit and reviewable."
  });
  assert.equal(target.status, 201, JSON.stringify(target.json));

  const source = await postJson(apiBase, "/api/v1/notes", {
    directoryId: "dir_original_default",
    status: "active",
    body: "# Writing Source`n`nThis note should provide the evidence that makes the target relation explicit.",
    thesis: "A clear source boundary helps later writing keep the support path honest.",
    threeLineSummary: [
      "The source note should remain inspectable before drafting.",
      "The relation should be justified instead of guessed from proximity.",
      "A transparent support path makes later drafting more reliable."
    ],
    distillationStatus: "confirmed",
    authorship: {
      user_confirmed: true,
      ai_assisted: false
    },
    boundaryOrCounterpoint: "Only collapse the relation into draft language after the support path is explicit."
  });
  assert.equal(source.status, 201, JSON.stringify(source.json));

  await page.goto(`${webBase}/prototype`, { waitUntil: "networkidle" });
  await openOriginalNoteBox(page);
  await page.locator('.explorer-item[data-kind="file"]', { hasText: "Writing Source" }).click();
  await ensureNoteMode(page);
  await page.locator("#btnShowRelated").click();
  await waitFor(async () => {
    assert.ok((await page.locator('#resultArea [data-relation-action="open-create"]').count()) > 0);
  }, 10000);
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('#resultArea [data-relation-action="open-create"]'));
    const button = buttons.find((item) => item instanceof HTMLElement && item.offsetParent !== null) || buttons.at(-1);
    if (!button) throw new Error("Relation create action not found.");
    button.click();
  });

  const workspace = page.locator("[data-permanent-relation-workspace]");
  await workspace.waitFor({ state: "visible" });
  const workspaceText = await workspace.textContent();
  assert.match(String(workspaceText || ""), /关系|relation/i);
  assert.match(String(workspaceText || ""), /为什么|理由|reason|rationale/i);

  await page.locator("[data-permanent-relation-target-search]").fill("Writing Target");
  await page.locator(`[data-permanent-relation-manual-target="${target.json.item.id}"]`).click();
  await page.locator('[data-permanent-relation-field="relationType"]').selectOption("supports");
  await page.locator('[data-permanent-relation-field="rationale"]').fill("This source note gives the target one explicit supporting reason, with a boundary the draft can keep visible.");
  await page.locator("[data-permanent-relation-form] button[type='submit']").click();

  await waitFor(async () => {
    const relatedText = await page.locator("#relatedPanel").textContent();
    assert.match(String(relatedText || ""), /Writing Target/);
    assert.match(String(relatedText || ""), /explicit supporting reason/);
    assert.match(String(relatedText || ""), /支持|supports/i);
  }, 10000);

  await page.locator('[data-permanent-relation-action="complete"]').click();
  await page.locator("[data-permanent-relation-workspace]").waitFor({ state: "detached" });

  await page.locator('.rail-btn[data-module="graph"]').click();
  await waitFor(async () => {
    const summary = await page.locator("#graphSummary").textContent();
    const [nodeCount = 0, edgeCount = 0] = [...String(summary || "").matchAll(/\d+/g)].map((match) => Number(match[0]));
    assert.ok(nodeCount >= 2, summary || "");
    assert.ok(edgeCount >= 1, summary || "");
    const graphText = await page.locator("#graphCanvas").textContent();
    assert.match(String(graphText || ""), /Writing Source/);
    assert.match(String(graphText || ""), /Writing Target/);
  }, 10000);

  const relations = await fetchJson(apiBase, `/api/v1/notes/${encodeURIComponent(source.json.item.id)}/relations`);
  assert.equal(relations.status, 200, JSON.stringify(relations.json));
  assert.equal(relations.json.item.outgoingLinks.length, 1);
  assert.equal(relations.json.item.outgoingLinks[0].toNoteId, target.json.item.id);
  assert.equal(relations.json.item.outgoingLinks[0].relationType, "supports");
  assert.equal(relations.json.item.outgoingLinks[0].rationale, "This source note gives the target one explicit supporting reason, with a boundary the draft can keep visible.");
});

test("prototype related inspector searches unloaded SQLite relation targets", async (t) => {
  if (process.env.RUN_BROWSER_E2E !== "1") {
    t.skip("Set RUN_BROWSER_E2E=1 to enable browser e2e in local runs.");
    return;
  }

  const playwright = await optionalPlaywright(t);
  if (!playwright) return;

  const stack = await startPrototypeStack(t, playwright);
  if (!stack) return;
  const { apiBase, page, vaultPath, webBase } = stack;

  const childDirectory = await postJson(apiBase, "/api/v1/directories", {
    title: "Relation Search Child",
    parentDirectoryId: "dir_original_default",
    directoryType: "custom",
    fsPath: path.join(vaultPath, "notes", "original", "relation-search-child"),
    maxNotes: 500
  });
  assert.equal(childDirectory.status, 201, JSON.stringify(childDirectory.json));

  const target = await postJson(apiBase, "/api/v1/notes", {
    directoryId: childDirectory.json.item.id,
    body: "# Remote Relation Target\n\nThis target lives in a child directory that the current note list has not loaded."
  });
  assert.equal(target.status, 201, JSON.stringify(target.json));

  const source = await postJson(apiBase, "/api/v1/notes", {
    directoryId: "dir_original_default",
    body: "# Relation Search Source\n\nThis note should find a target through SQLite search."
  });
  assert.equal(source.status, 201, JSON.stringify(source.json));

  await page.goto(`${webBase}/prototype`, { waitUntil: "networkidle" });
  await openOriginalNoteBox(page);
  await page.locator('.explorer-item[data-kind="file"]', { hasText: "Relation Search Source" }).click();
  await ensureNoteMode(page);
  await page.locator("#btnShowRelated").click();
  await waitFor(async () => {
    assert.ok((await page.locator('#resultArea [data-relation-action="open-create"]').count()) > 0);
  }, 10000);
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('#resultArea [data-relation-action="open-create"]'));
    const button = buttons.find((item) => item instanceof HTMLElement && item.offsetParent !== null) || buttons.at(-1);
    if (!button) throw new Error("Relation create action not found.");
    button.click();
  });
  await page.locator("[data-permanent-relation-workspace]").waitFor({ state: "visible" });
  await page.locator("[data-permanent-relation-target-search]").fill("Remote Relation Target");

  await waitFor(async () => {
    const options = await page.locator("[data-permanent-relation-manual-target]").allTextContents();
    assert.ok(options.some((item) => item.includes("Remote Relation Target")), options.join(" | "));
  }, 10000);

  await page.locator(`[data-permanent-relation-manual-target="${target.json.item.id}"]`).click();
  await page.locator('[data-permanent-relation-field="relationType"]').selectOption("bridges");
  await page.locator('[data-permanent-relation-field="rationale"]').fill("SQLite search can connect the current note to a target that was not loaded in the file list.");
  await page.locator("[data-permanent-relation-form] button[type='submit']").click();

  await waitFor(async () => {
    const relatedText = await page.locator("#relatedPanel").textContent();
    assert.match(String(relatedText || ""), /Remote Relation Target/);
    assert.match(String(relatedText || ""), /SQLite search can connect/);
  }, 10000);

  const relations = await fetchJson(apiBase, `/api/v1/notes/${encodeURIComponent(source.json.item.id)}/relations`);
  assert.equal(relations.status, 200, JSON.stringify(relations.json));
  assert.equal(relations.json.item.outgoingLinks.length, 1);
  assert.equal(relations.json.item.outgoingLinks[0].toNoteId, target.json.item.id);
  assert.equal(relations.json.item.outgoingLinks[0].relationType, "bridges");
});

test("prototype related inspector can edit and delete an explicit semantic relation", async (t) => {
  if (process.env.RUN_BROWSER_E2E !== "1") {
    t.skip("Set RUN_BROWSER_E2E=1 to enable browser e2e in local runs.");
    return;
  }

  const playwright = await optionalPlaywright(t);
  if (!playwright) return;

  const stack = await startPrototypeStack(t, playwright);
  if (!stack) return;
  const { apiBase, page, webBase } = stack;

  const target = await postJson(apiBase, "/api/v1/notes", {
    directoryId: "dir_original_default",
    body: "# 关系编辑目标\n\n用于测试关系编辑的目标笔记。"
  });
  assert.equal(target.status, 201, JSON.stringify(target.json));

  const source = await postJson(apiBase, "/api/v1/notes", {
    directoryId: "dir_original_default",
    body: "# 关系编辑来源\n\n用于测试一条需要修改的关系。"
  });
  assert.equal(source.status, 201, JSON.stringify(source.json));

  const relation = await postJson(apiBase, `/api/v1/notes/${encodeURIComponent(source.json.item.id)}/relations`, {
    toNoteId: target.json.item.id,
    relationType: "supports",
    rationale: "原始关系理由用于编辑测试",
    insightQuestion: "原始问题是什么？",
    confidence: 1
  });
  assert.equal(relation.status, 201, JSON.stringify(relation.json));

  await page.goto(`${webBase}/prototype`, { waitUntil: "networkidle" });
  await openOriginalNoteBox(page);
  await page.locator('.explorer-item[data-kind="file"]', { hasText: "关系编辑来源" }).click();
  await ensureNoteMode(page);
  await page.locator("#btnShowRelated").click();
  await page.locator("#relatedPanel").waitFor({ state: "visible" });
  await waitFor(async () => {
    assert.ok((await page.locator('#relatedPanel [data-permanent-workspace-tab="relations"]:visible').count()) > 0);
  }, 10000);
  await page.locator('#relatedPanel [data-permanent-workspace-tab="relations"]:visible').click();
  await waitFor(async () => {
    assert.ok((await page.locator('#relatedPanel [data-relation-action="open-edit"]:visible').count()) > 0);
  }, 10000);
  await page.locator('#relatedPanel [data-relation-action="open-edit"]:visible').click();

  const editForm = page.locator("[data-edit-relation-form]:visible");
  await editForm.waitFor({ state: "visible" });
  const editFormText = await editForm.textContent();
  assert.ok(String(editFormText || "").trim().length > 0);
  assert.match(String(editFormText || ""), /为什么要关联/);
  assert.match(String(editFormText || ""), /继续追问/);

  await editForm.locator('select[name="relationType"]').selectOption("qualifies");
  await editForm.locator('select[name="status"]').selectOption("draft");
  await editForm.locator('textarea[name="rationale"]').fill("编辑后的关系理由应说明为什么这条关系成立。");
  await editForm.locator('textarea[name="insightQuestion"]').fill("这条关系还缺什么？");
  const editQualityText = await editForm.locator("[data-relation-quality]").textContent();
  assert.match(String(editQualityText || ""), /理由质量/);
  await editForm.locator('button[type="submit"]').click();

  await waitFor(async () => {
    const relatedText = await page.locator("#relatedPanel").textContent();
    assert.match(String(relatedText || ""), /关系已更新/);
    assert.match(String(relatedText || ""), /限定/);
    assert.match(String(relatedText || ""), /草稿/);
    assert.match(String(relatedText || ""), /编辑后的关系理由/);
    assert.match(String(relatedText || ""), /这条关系还缺什么/);
  }, 10000);

  const updatedRelations = await fetchJson(apiBase, `/api/v1/notes/${encodeURIComponent(source.json.item.id)}/relations`);
  assert.equal(updatedRelations.status, 200, JSON.stringify(updatedRelations.json));
  assert.equal(updatedRelations.json.item.outgoingLinks[0].relationType, "qualifies");
  assert.equal(updatedRelations.json.item.outgoingLinks[0].status, "draft");
  assert.equal(updatedRelations.json.item.outgoingLinks[0].rationale, "编辑后的关系理由应说明为什么这条关系成立。");

  page.once("dialog", async (dialog) => {
    assert.match(dialog.message(), /删除/);
    await dialog.accept();
  });
  await waitFor(async () => {
    assert.ok((await page.locator('#relatedPanel [data-permanent-workspace-tab="relations"]:visible').count()) > 0);
  }, 10000);
  await page.locator('#relatedPanel [data-permanent-workspace-tab="relations"]:visible').click();
  await waitFor(async () => {
    assert.ok((await page.locator('#relatedPanel [data-relation-action="delete"]:visible').count()) > 0);
  }, 10000);
  await page.locator('#relatedPanel [data-relation-action="delete"]:visible').click();

  await waitFor(async () => {
    const relatedText = await page.locator("#relatedPanel").textContent();
    assert.match(String(relatedText || ""), /关系已删除/);
    assert.doesNotMatch(String(relatedText || ""), /编辑后的关系理由/);
  }, 10000);

  const deletedRelations = await fetchJson(apiBase, `/api/v1/notes/${encodeURIComponent(source.json.item.id)}/relations`);
  assert.equal(deletedRelations.status, 200, JSON.stringify(deletedRelations.json));
  assert.deepEqual(deletedRelations.json.item.outgoingLinks, []);
});

test("prototype editor focus mode switches into a low-distraction writing chrome", async (t) => {
  if (process.env.RUN_BROWSER_E2E !== "1") {
    t.skip("Set RUN_BROWSER_E2E=1 to enable browser e2e in local runs.");
    return;
  }

  const playwright = await optionalPlaywright(t);
  if (!playwright) return;

  const stack = await startPrototypeStack(t, playwright);
  if (!stack) return;
  const { page } = stack;

  await page.locator("#btnNewNote").click();
  await page.waitForSelector(".tab.active");

  await page.locator("#btnFocusMode").click();

  await page.waitForFunction(() => {
    const app = document.querySelector(".app");
    const panel = document.querySelector("#relatedPanel");
    return (
      app?.getAttribute("data-focus-mode") === "true" &&
      panel &&
      window.getComputedStyle(panel).display === "none"
    );
  });

  await page.locator("#btnFocusMode").click();

  await page.waitForFunction(() => {
    const app = document.querySelector(".app");
    return app?.getAttribute("data-focus-mode") === "false";
  });
});

test("prototype editor defaults to note mode and toggles markdown source", async (t) => {
  if (process.env.RUN_BROWSER_E2E !== "1") {
    t.skip("Set RUN_BROWSER_E2E=1 to enable browser e2e in local runs.");
    return;
  }

  const playwright = await optionalPlaywright(t);
  if (!playwright) return;

  const stack = await startPrototypeStack(t, playwright);
  if (!stack) return;
  const { page } = stack;

  await page.locator("#btnNewNote").click();
  await page.waitForFunction(() => {
    const split = document.querySelector("#markdownSplit");
    const previewPanel = document.querySelector("#markdownPreviewPanel");
    return Boolean(
      split?.classList.contains("editor-mode-wysiwyg") &&
        previewPanel &&
        window.getComputedStyle(previewPanel).display === "none"
    );
  });
  await page.locator("#btnModeToggle").click();
  await ensurePlaceholderTitleSelection(page);
  await page.keyboard.type("Source Mode Note");
  await page.keyboard.press("Enter");
  await page.keyboard.type("Body with [[关系目标]] and #标签来源");

  await page.waitForFunction(() => {
    const split = document.querySelector("#markdownSplit");
    const content = document.querySelector("#editorHost .cm-content");
    const previewPanel = document.querySelector("#markdownPreviewPanel");
    return Boolean(
      split?.classList.contains("editor-mode-source") &&
        content &&
        previewPanel &&
        window.getComputedStyle(content).display !== "none" &&
        window.getComputedStyle(previewPanel).display === "none"
    );
  });
  const editorValue = await page.locator("#editorBody").inputValue();
  assert.match(editorValue, /Source Mode Note/);
  assert.match(editorValue, /标签来源/);

  await page.locator("#btnModeToggle").click();
  await page.waitForFunction(() => document.querySelector("#markdownSplit")?.classList.contains("editor-mode-wysiwyg"));
  await page.waitForFunction(() => {
    const split = document.querySelector("#markdownSplit");
    const content = document.querySelector("#wysiwygHost .toastui-editor-contents");
    const previewPanel = document.querySelector("#markdownPreviewPanel");
    return Boolean(
      split?.classList.contains("editor-mode-wysiwyg") &&
        content &&
        previewPanel &&
        window.getComputedStyle(previewPanel).display === "none"
    );
  });
});

test("prototype editor inserts uploaded image into markdown and preview", async (t) => {
  if (process.env.RUN_BROWSER_E2E !== "1") {
    t.skip("Set RUN_BROWSER_E2E=1 to enable browser e2e in local runs.");
    return;
  }

  const playwright = await optionalPlaywright(t);
  if (!playwright) return;

  const stack = await startPrototypeStack(t, playwright);
  if (!stack) return;
  const { apiBase, page, webBase } = stack;
  const brokenAssetResponses = [];
  page.on("response", (response) => {
    if (response.status() >= 400 && response.url().includes("/assets/images/")) {
      brokenAssetResponses.push({ status: response.status(), url: response.url() });
    }
  });

  const created = await postJson(apiBase, "/api/v1/notes", {
    directoryId: "dir_original_default",
    body: "# Asset note\n\nImage goes below."
  });
  assert.equal(created.status, 201);
  const noteId = created.json.item.id;
  await page.goto(`${webBase}/prototype`, { waitUntil: "networkidle" });
  await page.evaluate((id) => window.__prototypeGraph?.openNoteById?.(id), noteId);
  await waitFor(async () => {
    const editorValue = await page.locator("#editorBody").inputValue();
    assert.match(editorValue, /Image goes below\./);
  }, 10000);
  await ensureNoteMode(page);

  await page.locator("#assetImageInput").setInputFiles({
    name: "inline image \u8d44\u6599.png",
    mimeType: "image/png",
    buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9l9wAAAABJRU5ErkJggg==", "base64")
  });

  await waitFor(async () => {
    const editorValue = await page.locator("#editorBody").inputValue();
    assert.match(editorValue, /!\[inline image \u8d44\u6599\]\(<\.\.\/\.\.\/assets\/images\//);
    const previewHtml = await page.locator("#markdownPreview").innerHTML();
    assert.match(previewHtml, /preview-image-asset/);
    assert.deepEqual(brokenAssetResponses, []);
  }, 10000);

  await confirmAuthorshipIfVisible(page, { claim: "Asset note 这是一条用于验收的插图说明" });
  await page.keyboard.press(process.platform === "darwin" ? "Meta+S" : "Control+S");

  await waitFor(async () => {
    const savedNote = await fetchJson(apiBase, `/api/v1/notes/${encodeURIComponent(noteId)}`);
    assert.equal(savedNote.status, 200);
    assert.match(savedNote.json.item.body, /!\[inline image \u8d44\u6599\]\(<\.\.\/\.\.\/assets\/images\//);
  }, 10000);
});

test("prototype editor inserts uploaded file into markdown and preview action", async (t) => {
  if (process.env.RUN_BROWSER_E2E !== "1") {
    t.skip("Set RUN_BROWSER_E2E=1 to enable browser e2e in local runs.");
    return;
  }

  const playwright = await optionalPlaywright(t);
  if (!playwright) return;

  const stack = await startPrototypeStack(t, playwright);
  if (!stack) return;
  const { apiBase, page, webBase } = stack;

  const created = await postJson(apiBase, "/api/v1/notes", {
    directoryId: "dir_original_default",
    body: "# Attachment note\n\nFile goes below."
  });
  assert.equal(created.status, 201);
  const noteId = created.json.item.id;
  await page.goto(`${webBase}/prototype`, { waitUntil: "networkidle" });
  await page.evaluate((id) => window.__prototypeGraph?.openNoteById?.(id), noteId);
  await waitFor(async () => {
    const editorValue = await page.locator("#editorBody").inputValue();
    assert.match(editorValue, /File goes below\./);
  }, 10000);

  await page.locator("#assetFileInput").setInputFiles({
    name: "reference pack \u8d44\u6599.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF", "utf8")
  });

  await waitFor(async () => {
    const editorValue = await page.locator("#editorBody").inputValue();
    assert.match(editorValue, /\[reference pack \u8d44\u6599\.pdf\]\(<\.\.\/\.\.\/assets\/files\//);
    const previewHtml = await page.locator("#markdownPreview").innerHTML();
    assert.match(previewHtml, /preview-attachment/);
    assert.match(previewHtml, /reference pack \u8d44\u6599\.pdf/);
  }, 10000);

  await confirmAuthorshipIfVisible(page, { claim: "Attachment note 这是一条用于验收的文件说明" });
  await page.keyboard.press(process.platform === "darwin" ? "Meta+S" : "Control+S");

  await waitFor(async () => {
    const savedNote = await fetchJson(apiBase, `/api/v1/notes/${encodeURIComponent(noteId)}`);
    assert.equal(savedNote.status, 200);
    assert.match(savedNote.json.item.body, /\[reference pack \u8d44\u6599\.pdf\]\(<\.\.\/\.\.\/assets\/files\//);
  }, 10000);
});

test("prototype wysiwyg supports inline [[ link picker and # tag picker", async (t) => {
  if (process.env.RUN_BROWSER_E2E !== "1") {
    t.skip("Set RUN_BROWSER_E2E=1 to enable browser e2e in local runs.");
    return;
  }

  const playwright = await optionalPlaywright(t);
  if (!playwright) return;

  const stack = await startPrototypeStack(t, playwright);
  if (!stack) return;
  const { apiBase, page, webBase } = stack;

  const target = await postJson(apiBase, "/api/v1/notes", {
    directoryId: "dir_original_default",
    body: "# Target note\n\nI am a target."
  });
  assert.equal(target.status, 201);
  const source = await postJson(apiBase, "/api/v1/notes", {
    directoryId: "dir_original_default",
    body: "# Source note\n\nBody begins."
  });
  assert.equal(source.status, 201);
  const sourceNoteId = source.json.item.id;
  await page.goto(`${webBase}/prototype`, { waitUntil: "networkidle" });
  await page.evaluate((id) => window.__prototypeGraph?.openNoteById?.(id), sourceNoteId);
  await waitFor(async () => {
    const editorValue = await page.locator("#editorBody").inputValue();
    assert.match(editorValue, /Body begins\./);
  }, 10000);

  await ensureNoteMode(page);
  const bodyParagraph = page.locator(
    "#wysiwygHost .toastui-editor-ww-container .ProseMirror.toastui-editor-contents p",
    { hasText: "Body begins." }
  );
  await bodyParagraph.click();
  await page.keyboard.press(process.platform === "darwin" ? "Meta+ArrowRight" : "End");
  await page.keyboard.type("\n\n[[Tar");

  await page.waitForSelector("#linkPicker:not(.hidden)");
  await page.keyboard.press("Enter");

  await waitFor(async () => {
    const editorValue = await page.locator("#editorBody").inputValue();
    assert.match(editorValue, /\[\[Target note\]\]/);
  }, 10000);

  await page.keyboard.type("\n\n#ta");
  await page.waitForSelector("#tagPicker:not(.hidden)");
  await page.keyboard.press("Enter");

  await waitFor(async () => {
    const editorValue = await page.locator("#editorBody").inputValue();
    assert.match(editorValue, /#t/);
  }, 10000);

  const notes = await fetchJson(apiBase, "/api/v1/directories/dir_original_default/notes");
  assert.equal(notes.status, 200);
});

test("prototype editor helper can dismiss once or mute future hints", async (t) => {
  if (process.env.RUN_BROWSER_E2E !== "1") {
    t.skip("Set RUN_BROWSER_E2E=1 to enable browser e2e in local runs.");
    return;
  }

  const playwright = await optionalPlaywright(t);
  if (!playwright) return;

  const stack = await startPrototypeStack(t, playwright);
  if (!stack) return;
  const { page, webBase } = stack;

  await page.addInitScript(() => {
    window.__copiedTexts = [];
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (text) => {
          window.__copiedTexts.push(String(text || ""));
        }
      }
    });
  });
  const showEditorHelper = async () => {
    const helper = page.locator("#editorHelper");
    const hidden = await helper.evaluate((node) => node.classList.contains("hidden")).catch(() => true);
    if (!hidden) return;
    const activeTabClose = page.locator(".tab.active .tab-close");
    if (await activeTabClose.isVisible().catch(() => false)) {
      await activeTabClose.click();
      if (await helper.waitFor({ state: "visible", timeout: 2000 }).then(() => true).catch(() => false)) return;
    }
    const focusButton = page.locator("#btnFocusMode");
    if (await focusButton.isVisible().catch(() => false)) await focusButton.click();
    await helper.waitFor({ state: "visible", timeout: 7000 });
  };

  await page.goto(`${webBase}/prototype`, { waitUntil: "networkidle" });
  await showEditorHelper();
  await expandEditorHelper(page);
  await page.locator("#btnEditorHelperAction").click();
  await waitFor(async () => {
    const hidden = await page.locator("#editorHelper").evaluate((node) => node.classList.contains("hidden"));
    assert.equal(hidden, true);
  }, 4000);

  await page.reload({ waitUntil: "networkidle" });
  await showEditorHelper();
  await expandEditorHelper(page);
  await page.locator("#btnEditorHelperMute").click();
  await waitFor(async () => {
    const hidden = await page.locator("#editorHelper").evaluate((node) => node.classList.contains("hidden"));
    assert.equal(hidden, true);
  }, 4000);

  await page.reload({ waitUntil: "networkidle" });
  await waitFor(async () => {
    const hidden = await page.locator("#editorHelper").evaluate((node) => node.classList.contains("hidden"));
    assert.equal(hidden, true);
  }, 4000);

  await createAndSaveNoteViaEditor(
    page,
    "# Helper Mute Recovery\n辅助面板恢复后，应能继续保持笔记。",
    {
      authorshipClaim: "辅助面板恢复后，应能继续保持笔记。"
    }
  );

  await waitFor(async () => {
    const statusText = await currentStatusText(page);
    assert.match(
      String(statusText || ""),
      /已同步到 Markdown|永久笔记已同步|永久笔记已同步，但仍建议继续打磨|已同步到 Markdown，但当前永久笔记仍按 draft 处理/
    );
  }, 10000);
});

test("prototype editor inserts code blocks tables and dividers with preview support", async (t) => {
  if (process.env.RUN_BROWSER_E2E !== "1") {
    t.skip("Set RUN_BROWSER_E2E=1 to enable browser e2e in local runs.");
    return;
  }

  const playwright = await optionalPlaywright(t);
  if (!playwright) return;

  const stack = await startPrototypeStack(t, playwright);
  if (!stack) return;
  const { page } = stack;

  await page.locator("#btnNewNote").click();
  await ensurePlaceholderTitleSelection(page);
  await page.keyboard.type("Structure Blocks");
  await page.keyboard.press("Enter");

  await chooseToolbarCommand(page, "code");
  await page.keyboard.type("const answer = 42;");

  await page.evaluate(() => {
    const editor = document.querySelector("#editorHost")?.__markdownEditor;
    const value = String(editor?.getValue?.() || "");
    editor?.setSelectionRange?.(value.length, value.length);
    editor?.focus?.();
  });
  await chooseToolbarCommand(page, "table");

  await waitFor(async () => {
    const editorValue = await page.locator("#editorBody").inputValue();
    assert.match(editorValue, /```[\s\S]*const answer = 42;[\s\S]*```/);
    assert.match(editorValue, /\| 列 1 \| 列 2 \|/);
    assert.match(editorValue, /\| --- \| --- \|/);
  }, 7000);

  await chooseToolbarCommand(page, "table-row");
  await chooseToolbarCommand(page, "table-column");
  await waitFor(async () => {
    const editorValue = await page.locator("#editorBody").inputValue();
    assert.match(editorValue, /\| 列 1 \| 列 2 \| 列 3 \|/);
    const contentRows = editorValue.split("\n").filter((line) => /^\| 内容 \|/u.test(line));
    assert.ok(contentRows.length >= 2);
  }, 7000);

  await page.evaluate(() => {
    const editor = document.querySelector("#editorHost")?.__markdownEditor;
    const value = String(editor?.getValue?.() || "");
    editor?.setSelectionRange?.(value.length, value.length);
    editor?.focus?.();
  });
  await chooseToolbarCommand(page, "hr");

  await page.evaluate(() => {
    window.__copiedTexts = [];
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (text) => {
          window.__copiedTexts.push(String(text || ""));
        }
      }
    });
  });
  await waitFor(async () => {
    const previewHtml = await page.locator("#markdownPreview").innerHTML();
    assert.match(previewHtml, /preview-code-block/);
    assert.match(previewHtml, /preview-code-head[\s\S]*<span>javascript<\/span>/);
    assert.match(previewHtml, /preview-code-copy/);
    assert.match(previewHtml, /code-token-keyword/);
    assert.match(previewHtml, /code-token-number/);
    assert.match(previewHtml, /<table class="preview-table">/);
    assert.match(previewHtml, /preview-rule/);
  }, 7000);
  await page.locator(".preview-code-copy").evaluate((button) => button.click());
  await waitFor(async () => {
    const copiedTexts = await page.evaluate(() => window.__copiedTexts || []);
    assert.match(String(copiedTexts.at(-1) || ""), /const answer = 42;/);
  }, 7000);
});

test("prototype editor contextual code tools can switch the current code block language", async (t) => {
  if (process.env.RUN_BROWSER_E2E !== "1") {
    t.skip("Set RUN_BROWSER_E2E=1 to enable browser e2e in local runs.");
    return;
  }

  const playwright = await optionalPlaywright(t);
  if (!playwright) return;

  const stack = await startPrototypeStack(t, playwright);
  if (!stack) return;
  const { page } = stack;

  await page.locator("#btnNewNote").click();
  await ensurePlaceholderTitleSelection(page);
  await page.keyboard.type("Code Language Tools");
  await page.keyboard.press("Enter");

  await chooseToolbarCommand(page, "code");
  await page.keyboard.type("const sample = 1;");
  await page.evaluate(() => {
    const editor = document.querySelector("#editorHost")?.__markdownEditor;
    const value = String(editor?.getValue?.() || "");
    const codeStart = value.indexOf("const sample = 1;");
    if (codeStart < 0) return;
    const cursor = codeStart + "const sample = 1;".length;
    editor?.setSelectionRange?.(cursor, cursor);
    editor?.focus?.();
  });

  const codeLanguageControlAvailable = await page.evaluate(() => Boolean(document.querySelector("#codeLanguageSelect")));
  if (codeLanguageControlAvailable) {
    const languageValue = await page.evaluate(() => document.querySelector("#codeLanguageSelect")?.value || "");
    assert.ok(["text", "javascript"].includes(String(languageValue || "")));
    await page.evaluate(() => {
      const select = document.querySelector("#codeLanguageSelect");
      if (!select) return;
      select.value = "shell";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
  } else {
    await page.evaluate(() => {
      const editor = document.querySelector("#editorHost")?.__markdownEditor;
      const value = String(editor?.getValue?.() || "");
      editor?.setValue?.(value.replace("```javascript", "```shell").replace("```text", "```shell").replace("```\n", "```shell\n"));
      editor?.focus?.();
    });
  }
  await waitFor(async () => {
    const editorValue = await page.locator("#editorBody").inputValue();
    assert.match(editorValue, /^# Code Language Tools\b/);
    assert.match(editorValue, /```shell\nconst sample = 1;\n```/);
  }, 7000);

  await waitFor(async () => {
    const previewHtml = await page.locator("#markdownPreview").innerHTML();
    assert.match(previewHtml, /preview-code-head[\s\S]*<span>shell<\/span>/);
  }, 7000);
});

test("prototype editor mode shortcuts switch note and source", async (t) => {
  if (process.env.RUN_BROWSER_E2E !== "1") {
    t.skip("Set RUN_BROWSER_E2E=1 to enable browser e2e in local runs.");
    return;
  }

  const playwright = await optionalPlaywright(t);
  if (!playwright) return;

  const stack = await startPrototypeStack(t, playwright);
  if (!stack) return;
  const { page } = stack;

  await page.locator("#btnNewNote").click();
  await page.waitForTimeout(300);
  await page.keyboard.type("Mode Shortcut Note");
  await focusEditorContent(page);

  await page.keyboard.press(process.platform === "darwin" ? "Meta+2" : "Control+2");
  await page.waitForFunction(() => {
    const split = document.querySelector("#markdownSplit");
    const previewPanel = document.querySelector("#markdownPreviewPanel");
    return Boolean(
      split?.classList.contains("editor-mode-source") &&
        previewPanel &&
        window.getComputedStyle(previewPanel).display === "none"
    );
  });

  await page.keyboard.press(process.platform === "darwin" ? "Meta+1" : "Control+1");
  await page.waitForFunction(() => {
    const split = document.querySelector("#markdownSplit");
    const previewPanel = document.querySelector("#markdownPreviewPanel");
    return Boolean(
      split?.classList.contains("editor-mode-wysiwyg") &&
        previewPanel &&
        window.getComputedStyle(previewPanel).display === "none"
    );
  });
});

test("prototype new note exposes editable body area below title", async (t) => {
  if (process.env.RUN_BROWSER_E2E !== "1") {
    t.skip("Set RUN_BROWSER_E2E=1 to enable browser e2e in local runs.");
    return;
  }

  const playwright = await optionalPlaywright(t);
  if (!playwright) return;

  const stack = await startPrototypeStack(t, playwright);
  if (!stack) return;
  const { page } = stack;

  await page.locator("#btnNewNote").click();
  await ensurePlaceholderTitleSelection(page);
  await page.keyboard.type("Title To Body");
  await page.keyboard.press("Enter");
  await page.keyboard.type("First paragraph.");

  await waitFor(async () => {
    const editorValue = await page.locator("#editorBody").inputValue();
    assert.match(editorValue, /^# Title To Body\n\nFirst paragraph\./);
  }, 7000);
});

test("prototype editor toolbar keeps title in place and formats rich text blocks", async (t) => {
  if (process.env.RUN_BROWSER_E2E !== "1") {
    t.skip("Set RUN_BROWSER_E2E=1 to enable browser e2e in local runs.");
    return;
  }

  const playwright = await optionalPlaywright(t);
  if (!playwright) return;

  const stack = await startPrototypeStack(t, playwright);
  if (!stack) return;
  const { apiBase, page, webBase } = stack;

  const created = await postJson(apiBase, "/api/v1/notes", {
    directoryId: "dir_original_default",
    body: "# Toolbar Title\n\n## Section Heading\n\nFormatting target"
  });
  assert.equal(created.status, 201);

  await page.goto(`${webBase}/prototype`, { waitUntil: "networkidle" });
  await openOriginalNoteBox(page);
  await page.locator('.explorer-item[data-kind="file"]', { hasText: "Toolbar Title" }).click();
  await ensureSourceMode(page);
  await waitForEditableNoteSurface(page);

  await waitFor(async () => {
    const editorValue = await page.locator("#editorBody").inputValue();
    assert.match(editorValue, /^# Toolbar Title\n\n## Section Heading\n\nFormatting target/);
  }, 7000);

  await page.evaluate(() => {
    const editor = document.querySelector("#editorHost")?.__markdownEditor;
    if (!editor) throw new Error("Missing markdown editor");
    const value = String(editor.getValue?.() || "");
    const index = value.indexOf("Formatting");
    if (index < 0) throw new Error("Missing text: Formatting");
    editor.setSelectionRange?.(index, index + "Formatting".length);
    editor.focus?.();
  });
  await page.locator('.tb[data-md="bold"]').click();

  await waitFor(async () => {
    const editorValue = await page.locator("#editorBody").inputValue();
    assert.match(editorValue, /^# Toolbar Title\n\n## Section Heading/m);
    assert.match(editorValue, /\*\*Formatting\*\* target/);
  }, 7000);
});

test("prototype editor tab indents and shift-tab outdents selected lines", async (t) => {
  if (process.env.RUN_BROWSER_E2E !== "1") {
    t.skip("Set RUN_BROWSER_E2E=1 to enable browser e2e in local runs.");
    return;
  }

  const playwright = await optionalPlaywright(t);
  if (!playwright) return;

  const stack = await startPrototypeStack(t, playwright);
  if (!stack) return;
  const { page } = stack;

  await page.locator("#btnNewNote").click();
  await ensureSourceMode(page);
  await waitForActiveNoteBodyLoaded(page);
  await page.evaluate(() => {
    const markdown = "# Indent note\n\n- first\n- second";
    window.__prototypeEditor?.setEditorValue?.(markdown);
    window.__prototypeEditor?.handleEditorInput?.();
  });
  await page.waitForFunction(() => document.querySelector("#editorBody")?.value?.includes("- first"));

  await page.evaluate(() => {
    const editor = document.querySelector("#editorHost")?.__markdownEditor;
    const value = String(editor?.getValue?.() || "");
    const start = value.indexOf("- first");
    const end = value.indexOf("- second") + "- second".length;
    editor?.setSelectionRange?.(start, end);
    editor?.focus?.();
  });

  await page.evaluate(() => {
    window.__prototypeEditor?.indentSelection?.(1);
  });
  await waitFor(async () => {
    const editorValue = await page.locator("#editorBody").inputValue();
    assert.match(editorValue, /\n  - first\n  - second/);
  }, 5000);

  await page.evaluate(() => {
    window.__prototypeEditor?.indentSelection?.(-1);
  });
  await waitFor(async () => {
    const editorValue = await page.locator("#editorBody").inputValue();
    assert.match(editorValue, /\n- first\n- second/);
  }, 5000);
});

test("prototype editor enter continues list quote and checklist structures", async (t) => {
  if (process.env.RUN_BROWSER_E2E !== "1") {
    t.skip("Set RUN_BROWSER_E2E=1 to enable browser e2e in local runs.");
    return;
  }

  const playwright = await optionalPlaywright(t);
  if (!playwright) return;

  const stack = await startPrototypeStack(t, playwright);
  if (!stack) return;
  const { page, webBase } = stack;

  await page.goto(`${webBase}/prototype`, { waitUntil: "networkidle" });
  await page.locator("#btnNewNote").click();
  await ensureSourceMode(page);
  await waitForActiveNoteBodyLoaded(page);
  await page.evaluate(() => {
    const markdown = "# Continue structures\n\n- first\n> quoted\n- [ ] todo";
    window.__prototypeEditor?.setEditorValue?.(markdown);
    window.__prototypeEditor?.handleEditorInput?.();
  });
  await page.waitForFunction(() => document.querySelector("#editorBody")?.value?.includes("- [ ] todo"));

  await page.evaluate(() => {
    const editor = document.querySelector("#editorHost")?.__markdownEditor;
    const value = String(editor?.getValue?.() || "");
    const pos = value.indexOf("- first") + "- first".length;
    editor?.setSelectionRange?.(pos, pos);
    editor?.focus?.();
  });
  await page.keyboard.press("Enter");
  await page.keyboard.type("second");
  await waitFor(async () => {
    const editorValue = await page.locator("#editorBody").inputValue();
    assert.match(editorValue, /\n- first\n- second/);
  }, 5000);

  await page.evaluate(() => {
    const editor = document.querySelector("#editorHost")?.__markdownEditor;
    const value = String(editor?.getValue?.() || "");
    const pos = value.indexOf("> quoted") + "> quoted".length;
    editor?.setSelectionRange?.(pos, pos);
    editor?.focus?.();
  });
  await page.keyboard.press("Enter");
  await page.keyboard.type("reply");
  await waitFor(async () => {
    const editorValue = await page.locator("#editorBody").inputValue();
    assert.match(editorValue, /\n> quoted\n> reply/);
  }, 5000);

  await page.evaluate(() => {
    const editor = document.querySelector("#editorHost")?.__markdownEditor;
    const value = String(editor?.getValue?.() || "");
    const pos = value.indexOf("- [ ] todo") + "- [ ] todo".length;
    editor?.setSelectionRange?.(pos, pos);
    editor?.focus?.();
  });
  await page.keyboard.press("Enter");
  await page.keyboard.type("todo next");
  await waitFor(async () => {
    const editorValue = await page.locator("#editorBody").inputValue();
    assert.match(editorValue, /\n- \[ \] todo\n- \[ \] todo next/);
  }, 5000);
});

test("prototype editor enter preserves ordinary blank paragraphs", async (t) => {
  if (process.env.RUN_BROWSER_E2E !== "1") {
    t.skip("Set RUN_BROWSER_E2E=1 to enable browser e2e in local runs.");
    return;
  }

  const playwright = await optionalPlaywright(t);
  if (!playwright) return;

  const stack = await startPrototypeStack(t, playwright);
  if (!stack) return;
  const { apiBase, page, webBase } = stack;

  const created = await postJson(apiBase, "/api/v1/notes", {
    directoryId: "dir_original_default",
    body: "# Blank paragraph\n\nLine one"
  });
  assert.equal(created.status, 201);

  await page.goto(`${webBase}/prototype`, { waitUntil: "networkidle" });
  await openOriginalNoteBox(page);
  await page.locator('.explorer-item[data-kind="file"]', { hasText: "Blank paragraph" }).click();
  await ensureSourceMode(page);
  await page.waitForFunction(() => document.querySelector("#editorBody")?.value?.includes("Line one"));

  await page.evaluate(() => {
    const editor = document.querySelector("#editorHost")?.__markdownEditor;
    const value = String(editor?.getValue?.() || "");
    const pos = value.indexOf("Line one") + "Line one".length;
    editor?.setSelectionRange?.(pos, pos);
    editor?.focus?.();
  });
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter");
  await page.keyboard.type("Line two");

  await waitFor(async () => {
    const editorValue = await page.locator("#editorBody").inputValue();
    assert.ok(
      /\nLine one\n\n(?:<br>\n\n)?Line two/.test(editorValue),
      `Expected blank paragraph before Line two, got:\n${editorValue}`
    );
  }, 5000);
});

test("prototype editor enter preserves ordinary blank paragraphs in wysiwyg", async (t) => {
  if (process.env.RUN_BROWSER_E2E !== "1") {
    t.skip("Set RUN_BROWSER_E2E=1 to enable browser e2e in local runs.");
    return;
  }

  const playwright = await optionalPlaywright(t);
  if (!playwright) return;

  const stack = await startPrototypeStack(t, playwright);
  if (!stack) return;
  const { apiBase, page, webBase } = stack;

  const created = await postJson(apiBase, "/api/v1/notes", {
    directoryId: "dir_original_default",
    body: "# WYSIWYG blank paragraph\n\nLine one"
  });
  assert.equal(created.status, 201);

  await page.goto(`${webBase}/prototype`, { waitUntil: "networkidle" });
  await openOriginalNoteBox(page);
  await page.locator('.explorer-item[data-kind="file"]', { hasText: "WYSIWYG blank paragraph" }).click();
  await ensureNoteMode(page);
  await page.waitForFunction(() => document.querySelector("#editorBody")?.value?.includes("Line one"));

  const paragraph = page.locator("#wysiwygHost .toastui-editor-ww-container .ProseMirror.toastui-editor-contents p", {
    hasText: "Line one"
  });
  await waitFor(async () => {
    assert.equal(await paragraph.count(), 1);
  }, 5000);
  await paragraph.click();
  await page.keyboard.press(process.platform === "darwin" ? "Meta+ArrowRight" : "End");
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter");
  await page.keyboard.type("Line two");

  await waitFor(async () => {
    const editorValue = await page.locator("#editorBody").inputValue();
    assert.ok(
      /\nLine one\n\n(?:<br>\n\n)?Line two/.test(editorValue),
      `Expected blank paragraph before Line two, got:\n${editorValue}`
    );
  }, 5000);
});

test("prototype editor shows dirty state and supports Ctrl/Cmd+S sync", async (t) => {
  if (process.env.RUN_BROWSER_E2E !== "1") {
    t.skip("Set RUN_BROWSER_E2E=1 to enable browser e2e in local runs.");
    return;
  }

  const playwright = await optionalPlaywright(t);
  if (!playwright) return;

  const stack = await startPrototypeStack(t, playwright);
  if (!stack) return;
  const { apiBase, page } = stack;

  await page.locator("#btnNewNote").click();
  await ensureSourceMode(page);
  await waitForPlaceholderTitleSelection(page);
  await page.keyboard.type("Shortcut Save Note");
  await placeCaretAtRichBlockEnd(page, "#editorHost .cm-content h1");
  await page.keyboard.press("Enter");
  await page.keyboard.type("Dirty marker should appear before save.");

  await waitFor(async () => {
    const tabTitle = await page.locator(".tab.active .tab-title").textContent();
    const tabDirty = await page.locator(".tab.active .tab-dirty").textContent();
    assert.match(tabTitle || "", /Shortcut Save Note/);
    assert.ok(String(tabDirty || "").trim().length > 0);
    assert.equal(await page.locator("#btnSave").isVisible(), false);
  }, 7000);

  await confirmAuthorshipIfVisible(page, { claim: "Shortcut Save Note 这是一条用于验收的中心判断" });
  await page.keyboard.press(process.platform === "darwin" ? "Meta+S" : "Control+S");

  await waitFor(async () => {
    const notes = await fetchJson(apiBase, "/api/v1/directories/dir_original_default/notes");
    assert.equal(notes.status, 200);
    assert.equal(notes.json.total, 1);
    assert.equal(notes.json.items[0].title, "Shortcut Save Note");

    const tabDirty = await page.locator(".tab.active .tab-dirty").textContent();
    const status = await currentStatusText(page);
    assert.ok(
      !String(tabDirty || "").trim() ||
        /已同步到 Markdown|永久笔记已同步|永久笔记已同步，但仍建议继续打磨/.test(String(status || ""))
    );
    assert.equal(await page.locator("#btnSave").isVisible(), false);
  }, 10000);
});

test("prototype editor keeps long-form dirty drafts and save state isolated per tab", async (t) => {
  if (process.env.RUN_BROWSER_E2E !== "1") {
    t.skip("Set RUN_BROWSER_E2E=1 to enable browser e2e in local runs.");
    return;
  }

  const playwright = await optionalPlaywright(t);
  if (!playwright) return;

  const stack = await startPrototypeStack(t, playwright);
  if (!stack) return;
  const { apiBase, page, webBase } = stack;

  const alphaMarkdown = [
    "# Longform Alpha",
    "",
    ...Array.from({ length: 12 }, (_, index) => `Alpha paragraph ${index + 1}: ${"evidence map ".repeat(10).trim()}`),
    "",
    "## Closing",
    "",
    "Alpha ending keeps the note intentionally long."
  ].join("\n");
  const betaMarkdown = [
    "# Longform Beta",
    "",
    ...Array.from({ length: 10 }, (_, index) => `Beta paragraph ${index + 1}: ${"draft scaffold ".repeat(9).trim()}`),
    "",
    "## Summary",
    "",
    "Beta ending should stay untouched while Alpha is dirty."
  ].join("\n");

  const alphaCreate = await postJson(apiBase, "/api/v1/notes", {
    directoryId: "dir_original_default",
    body: alphaMarkdown
  });
  const betaCreate = await postJson(apiBase, "/api/v1/notes", {
    directoryId: "dir_original_default",
    body: betaMarkdown
  });
  assert.equal(alphaCreate.status, 201);
  assert.equal(betaCreate.status, 201);

  await page.goto(`${webBase}/prototype`, { waitUntil: "networkidle" });
  await openOriginalNoteBox(page);
  await page.locator('.explorer-item[data-kind="file"]', { hasText: "Longform Alpha" }).click();
  await page.locator('.explorer-item[data-kind="file"]', { hasText: "Longform Beta" }).click();

  await page.locator(".tab", { hasText: "Longform Alpha" }).click();
  await waitFor(async () => {
    const editorValue = await page.locator("#editorBody").inputValue();
    assert.match(editorValue, /Longform Alpha/);
    assert.ok(true);
  }, 7000);

  const unsavedSuffix = "\n\nUnsaved alpha appendix line 1.\nUnsaved alpha appendix line 2.";
  await focusEditorContent(page);
  await page.keyboard.press(process.platform === "darwin" ? "Meta+End" : "Control+End");
  await page.keyboard.type(unsavedSuffix);

  await waitFor(async () => {
    const editorValue = await page.locator("#editorBody").inputValue();
    const tabDirty = await page.locator(".tab.active .tab-dirty").textContent();
    assert.match(editorValue, /Unsaved alpha appendix line 2\./);
    assert.ok(String(tabDirty || "").trim().length > 0);
  }, 7000);

  await page.locator(".tab", { hasText: "Longform Beta" }).first().click();
  await waitFor(async () => {
    const editorValue = await page.locator("#editorBody").inputValue();
    assert.match(editorValue, /Longform Beta/);
    assert.doesNotMatch(editorValue, /Unsaved alpha appendix/);
  }, 7000);

  await page.locator(".tab", { hasText: "Longform Alpha" }).click();
  await waitFor(async () => {
    const editorValue = await page.locator("#editorBody").inputValue();
    assert.match(editorValue, /Unsaved alpha appendix line 2\./);
  }, 7000);

  await confirmAuthorshipIfVisible(page, { claim: "Longform Alpha still keeps the source boundary explicit instead of collapsing it into a fake summary." });
  await page.keyboard.press(process.platform === "darwin" ? "Meta+S" : "Control+S");
  await waitFor(async () => {
    const status = await currentStatusText(page);
    assert.match(String(status || ""), /已同步到 Markdown|永久笔记已同步|永久笔记已同步，但仍建议继续打磨/);
  }, 10000);

  const notes = await fetchJson(apiBase, "/api/v1/directories/dir_original_default/notes");
  assert.equal(notes.status, 200);
  const alphaNote = notes.json.items.find((item) => item.title === "Longform Alpha");
  const betaNote = notes.json.items.find((item) => item.title === "Longform Beta");
  assert.ok(alphaNote);
  assert.ok(betaNote);

  const alphaAfterSave = await fetchJson(apiBase, `/api/v1/notes/${encodeURIComponent(alphaNote.id)}`);
  assert.equal(alphaAfterSave.status, 200);
  assert.match(alphaAfterSave.json.item.body, /Unsaved alpha appendix line 2\./);

  const betaAfterSave = await fetchJson(apiBase, `/api/v1/notes/${encodeURIComponent(betaNote.id)}`);
  assert.equal(betaAfterSave.status, 200);
  assert.doesNotMatch(betaAfterSave.json.item.body, /Unsaved alpha appendix/);
});

test("prototype tab switch syncs the left navigation to the active note location", async (t) => {
  if (process.env.RUN_BROWSER_E2E !== "1") {
    t.skip("Set RUN_BROWSER_E2E=1 to enable browser e2e in local runs.");
    return;
  }

  const playwright = await optionalPlaywright(t);
  if (!playwright) return;

  const stack = await startPrototypeStack(t, playwright);
  if (!stack) return;
  const { apiBase, page, vaultPath, webBase } = stack;

  const childDirectory = await postJson(apiBase, "/api/v1/directories", {
    title: "Tab Sync Child",
    parentDirectoryId: "dir_original_default",
    directoryType: "custom",
    fsPath: path.join(vaultPath, "notes", "original", "tab-sync-child"),
    maxNotes: 500
  });
  assert.equal(childDirectory.status, 201, JSON.stringify(childDirectory.json));
  const childDirectoryId = childDirectory.json.item.id;

  const originalNote = await postJson(apiBase, "/api/v1/notes", {
    directoryId: childDirectoryId,
    body: "# Tab Sync Original Child\n\nThis permanent note lives below a child card box."
  });
  const literatureNote = await postJson(apiBase, "/api/v1/notes", {
    directoryId: "dir_literature_default",
    status: "draft",
    body: "# Tab Sync Literature\n\n## 原文\n\nA quoted source fragment.\n\n## 转述\n\nI restate the source in my own words."
  });
  assert.equal(originalNote.status, 201, JSON.stringify(originalNote.json));
  assert.equal(literatureNote.status, 201, JSON.stringify(literatureNote.json));
  const originalNoteId = originalNote.json.item.id;
  const literatureNoteId = literatureNote.json.item.id;

  await page.goto(`${webBase}/prototype`, { waitUntil: "networkidle" });
  await page.locator('.explorer-item[data-kind="folder"]', { hasText: "Tab Sync Child" }).click();
  await page.locator('.explorer-item[data-kind="file"]', { hasText: "Tab Sync Original Child" }).click();

  await page.locator('[data-action="quick-literature"]').click();
  await page.locator('.explorer-item[data-kind="folder"][data-id="dir_literature_default"]').click();
  await page.locator('.explorer-item[data-kind="file"]', { hasText: "Tab Sync Literature" }).click();

  await page.locator("#tabs .tab", { hasText: "Tab Sync Original Child" }).click();
  await waitFor(async () => {
    const nav = await page.evaluate(({ childDirectoryId, originalNoteId }) => {
      const visible = (el) => {
        if (!el) return false;
        const style = window.getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
      };
      const activeFile = document.querySelector('.explorer-item.file-row.active[data-kind="file"]');
      const childFolder = document.querySelector(`.explorer-item[data-kind="folder"][data-id="${childDirectoryId}"]`);
      return {
        quickAction: document.querySelector(".quick-entry.current-root")?.getAttribute("data-action") || "",
        activeFileId: activeFile?.getAttribute("data-id") || "",
        activeFileText: activeFile?.textContent || "",
        childFolderVisible: visible(childFolder),
        activeFileVisible: visible(activeFile),
        listText: document.querySelector("#listArea")?.textContent || "",
        expectedOriginal: originalNoteId
      };
    }, { childDirectoryId, originalNoteId });
    assert.equal(nav.quickAction, "quick-original");
    assert.equal(nav.activeFileId, originalNoteId);
    assert.equal(nav.activeFileVisible, true);
    assert.equal(nav.childFolderVisible, true);
    assert.match(nav.activeFileText, /Tab Sync Original Child/);
    assert.match(nav.listText, /Tab Sync Child/);
  }, 7000);

  await page.locator("#tabs .tab", { hasText: "Tab Sync Literature" }).click();
  await waitFor(async () => {
    const nav = await page.evaluate(({ literatureNoteId }) => {
      const visible = (el) => {
        if (!el) return false;
        const style = window.getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
      };
      const activeFile = document.querySelector('.explorer-item.file-row.active[data-kind="file"]');
      return {
        quickAction: document.querySelector(".quick-entry.current-root")?.getAttribute("data-action") || "",
        activeFileId: activeFile?.getAttribute("data-id") || "",
        activeFileText: activeFile?.textContent || "",
        activeFileVisible: visible(activeFile),
        listText: document.querySelector("#listArea")?.textContent || "",
        expectedLiterature: literatureNoteId
      };
    }, { literatureNoteId });
    assert.equal(nav.quickAction, "quick-literature");
    assert.equal(nav.activeFileId, literatureNoteId);
    assert.equal(nav.activeFileVisible, true);
    assert.match(nav.activeFileText, /Tab Sync Literature/);
    assert.match(nav.listText, /Tab Sync Literature/);
  }, 7000);
});

test("prototype explorer keeps current-note context when selecting a different folder", async (t) => {
  if (process.env.RUN_BROWSER_E2E !== "1") {
    t.skip("Set RUN_BROWSER_E2E=1 to enable browser e2e in local runs.");
    return;
  }

  const playwright = await optionalPlaywright(t);
  if (!playwright) return;

  const stack = await startPrototypeStack(t, playwright);
  if (!stack) return;
  const { apiBase, page, vaultPath, webBase } = stack;

  const sourceDirectory = await postJson(apiBase, "/api/v1/directories", {
    title: "Explorer Sync Source",
    parentDirectoryId: "dir_original_default",
    directoryType: "custom",
    fsPath: path.join(vaultPath, "notes", "original", "explorer-sync-source"),
    maxNotes: 500
  });
  assert.equal(sourceDirectory.status, 201, JSON.stringify(sourceDirectory.json));
  const sourceDirectoryId = sourceDirectory.json.item.id;

  const childDirectory = await postJson(apiBase, "/api/v1/directories", {
    title: "Explorer Sync Child",
    parentDirectoryId: sourceDirectoryId,
    directoryType: "custom",
    fsPath: path.join(vaultPath, "notes", "original", "explorer-sync-source", "explorer-sync-child"),
    maxNotes: 500
  });
  assert.equal(childDirectory.status, 201, JSON.stringify(childDirectory.json));
  const childDirectoryId = childDirectory.json.item.id;

  const siblingDirectory = await postJson(apiBase, "/api/v1/directories", {
    title: "Explorer Sync Sibling",
    parentDirectoryId: "dir_original_default",
    directoryType: "custom",
    fsPath: path.join(vaultPath, "notes", "original", "explorer-sync-sibling"),
    maxNotes: 500
  });
  assert.equal(siblingDirectory.status, 201, JSON.stringify(siblingDirectory.json));
  const siblingDirectoryId = siblingDirectory.json.item.id;

  const note = await postJson(apiBase, "/api/v1/notes", {
    directoryId: childDirectoryId,
    body: "# Explorer Sync Note\n\nThis note stays current while the folder selection moves elsewhere."
  });
  assert.equal(note.status, 201, JSON.stringify(note.json));
  const noteId = note.json.item.id;

  await page.goto(`${webBase}/prototype`, { waitUntil: "networkidle" });
  await openOriginalNoteBox(page);
  await page.locator(`.explorer-item[data-kind="folder"][data-id="${sourceDirectoryId}"]`).click();
  await page.locator(`.explorer-item[data-kind="folder"][data-id="${childDirectoryId}"]`).click();
  await page.locator('.explorer-item[data-kind="file"]', { hasText: "Explorer Sync Note" }).click();

  await waitFor(async () => {
    const opened = await page.evaluate(({ noteId, sourceDirectoryId, childDirectoryId }) => {
      const currentNote = document.querySelector(`.explorer-item[data-kind="file"][data-id="${noteId}"]`);
      return {
        activeFileId: document.querySelector('.explorer-item.file-row.active[data-kind="file"]')?.getAttribute("data-id") || "",
        currentNoteId: currentNote?.getAttribute("data-id") || "",
        sourceExpanded: document.querySelector(`.explorer-item[data-kind="folder"][data-id="${sourceDirectoryId}"] .tree-toggle`)?.textContent?.trim() || "",
        childVisible: Boolean(document.querySelector(`.explorer-item[data-kind="folder"][data-id="${childDirectoryId}"]`))
      };
    }, { noteId, sourceDirectoryId, childDirectoryId });
    assert.equal(opened.activeFileId, noteId);
    assert.equal(opened.currentNoteId, noteId);
    assert.equal(opened.sourceExpanded, "▾");
    assert.equal(opened.childVisible, true);
  }, 7000);

  await page.locator(`.explorer-item[data-kind="folder"][data-id="${siblingDirectoryId}"]`).click();

  await waitFor(async () => {
    const state = await page.evaluate(({ noteId, sourceDirectoryId, childDirectoryId, siblingDirectoryId }) => {
      const currentNote = document.querySelector(`.explorer-item[data-kind="file"][data-id="${noteId}"]`);
      const listArea = document.querySelector("#listArea");
      const noteRect = currentNote?.getBoundingClientRect?.() || null;
      const listRect = listArea?.getBoundingClientRect?.() || null;
      return {
        selectedFolderId: document.querySelector('.explorer-item[data-kind="folder"].active')?.getAttribute("data-id") || "",
        activeFileId: document.querySelector('.explorer-item.file-row.active[data-kind="file"]')?.getAttribute("data-id") || "",
        currentNoteId: currentNote?.getAttribute("data-id") || "",
        currentNoteIsActive: currentNote?.classList.contains("active") || false,
        currentNoteHasWeakState: currentNote?.classList.contains("is-current-note") || false,
        sourceExpanded: document.querySelector(`.explorer-item[data-kind="folder"][data-id="${sourceDirectoryId}"] .tree-toggle`)?.textContent?.trim() || "",
        childVisible: Boolean(document.querySelector(`.explorer-item[data-kind="folder"][data-id="${childDirectoryId}"]`)),
        currentNoteVisible: Boolean(noteRect && listRect && noteRect.top < listRect.bottom && noteRect.bottom > listRect.top),
        expectedFolder: siblingDirectoryId
      };
    }, { noteId, sourceDirectoryId, childDirectoryId, siblingDirectoryId });
    assert.equal(state.selectedFolderId, siblingDirectoryId);
    assert.equal(state.activeFileId, "");
    assert.equal(state.currentNoteId, noteId);
    assert.equal(state.currentNoteIsActive, false);
    assert.equal(state.currentNoteHasWeakState, true);
    assert.equal(state.sourceExpanded, "▾");
    assert.equal(state.childVisible, true);
    assert.equal(state.currentNoteVisible, true);
  }, 7000);
});

test("prototype explorer close-all clears stale file highlight and current-note state", async (t) => {
  if (process.env.RUN_BROWSER_E2E !== "1") {
    t.skip("Set RUN_BROWSER_E2E=1 to enable browser e2e in local runs.");
    return;
  }

  const playwright = await optionalPlaywright(t);
  if (!playwright) return;

  const stack = await startPrototypeStack(t, playwright);
  if (!stack) return;
  const { apiBase, page, vaultPath, webBase } = stack;

  const folder = await postJson(apiBase, "/api/v1/directories", {
    title: "Explorer Close All Sync",
    parentDirectoryId: "dir_original_default",
    directoryType: "custom",
    fsPath: path.join(vaultPath, "notes", "original", "explorer-close-all-sync"),
    maxNotes: 500
  });
  assert.equal(folder.status, 201, JSON.stringify(folder.json));
  const folderId = folder.json.item.id;

  const note = await postJson(apiBase, "/api/v1/notes", {
    directoryId: folderId,
    body: "# Explorer Close All Sync Note\n\nClose-all should clear stale explorer file highlight."
  });
  assert.equal(note.status, 201, JSON.stringify(note.json));
  const noteId = note.json.item.id;

  await page.goto(`${webBase}/prototype`, { waitUntil: "networkidle" });
  await openOriginalNoteBox(page);
  await page.locator(`.explorer-item[data-kind="folder"][data-id="${folderId}"]`).click();
  await page.locator('.explorer-item[data-kind="file"]', { hasText: "Explorer Close All Sync Note" }).click();

  await waitFor(async () => {
    const opened = await page.evaluate(({ noteId }) => ({
      activeTabId: window.__prototypeState?.activeTabId || "",
      selectedFileId: window.__prototypeState?.selectedFileId || "",
      activeFileId: document.querySelector('.explorer-item.file-row.active[data-kind="file"]')?.getAttribute("data-id") || "",
      currentNoteId: document.querySelector(`.explorer-item[data-kind="file"][data-id="${noteId}"]`)?.getAttribute("data-id") || "",
      tabCount: Array.isArray(window.__prototypeState?.tabs) ? window.__prototypeState.tabs.length : -1
    }), { noteId });
    assert.notEqual(opened.activeTabId, "");
    assert.equal(opened.selectedFileId, noteId);
    assert.equal(opened.activeFileId, noteId);
    assert.equal(opened.currentNoteId, noteId);
    assert.ok(opened.tabCount >= 1);
  }, 7000);

  await page.evaluate(() => {
    const closed = window.__prototypeEditor?.closeAllTabs?.();
    if (!closed) throw new Error("closeAllTabs returned false");
  });

  await waitFor(async () => {
    const closed = await page.evaluate(() => ({
      activeTabId: window.__prototypeState?.activeTabId || "",
      selectedFileId: window.__prototypeState?.selectedFileId || "",
      activeFileId: document.querySelector('.explorer-item.file-row.active[data-kind="file"]')?.getAttribute("data-id") || "",
      currentNoteId: document.querySelector('.explorer-item.file-row.is-current-note[data-kind="file"]')?.getAttribute("data-id") || "",
      tabCount: Array.isArray(window.__prototypeState?.tabs) ? window.__prototypeState.tabs.length : -1
    }));
    assert.equal(closed.activeTabId, "");
    assert.equal(closed.selectedFileId, "");
    assert.equal(closed.activeFileId, "");
    assert.equal(closed.currentNoteId, "");
    assert.equal(closed.tabCount, 0);
  }, 7000);
});

test("prototype close-all lets a new note reopen from a clean explorer and tab state", async (t) => {
  if (process.env.RUN_BROWSER_E2E !== "1") {
    t.skip("Set RUN_BROWSER_E2E=1 to enable browser e2e in local runs.");
    return;
  }

  const playwright = await optionalPlaywright(t);
  if (!playwright) return;

  const stack = await startPrototypeStack(t, playwright);
  if (!stack) return;
  const { apiBase, page, vaultPath, webBase } = stack;

  const folder = await postJson(apiBase, "/api/v1/directories", {
    title: "Explorer Reopen Sync",
    parentDirectoryId: "dir_original_default",
    directoryType: "custom",
    fsPath: path.join(vaultPath, "notes", "original", "explorer-reopen-sync"),
    maxNotes: 500
  });
  assert.equal(folder.status, 201, JSON.stringify(folder.json));
  const folderId = folder.json.item.id;

  const note = await postJson(apiBase, "/api/v1/notes", {
    directoryId: folderId,
    body: "# Explorer Reopen Sync Note\n\nThis note anchors the reopen-from-clean-state flow."
  });
  assert.equal(note.status, 201, JSON.stringify(note.json));
  const noteId = note.json.item.id;

  await page.goto(`${webBase}/prototype`, { waitUntil: "networkidle" });
  await openOriginalNoteBox(page);
  await page.evaluate(() => {
    window.__prototypeEditor?.closeAllTabs?.();
  });
  await page.locator(`.explorer-item[data-kind="folder"][data-id="${folderId}"]`).click();
  await page.locator('.explorer-item[data-kind="file"]', { hasText: "Explorer Reopen Sync Note" }).click();

  await waitFor(async () => {
    const opened = await page.evaluate(({ noteId }) => ({
      activeTabId: window.__prototypeState?.activeTabId || "",
      selectedFileId: window.__prototypeState?.selectedFileId || "",
      activeFileId: document.querySelector('.explorer-item.file-row.active[data-kind="file"]')?.getAttribute("data-id") || "",
      currentNoteId: document.querySelector('.explorer-item.file-row.is-current-note[data-kind="file"]')?.getAttribute("data-id") || "",
      tabCount: Array.isArray(window.__prototypeState?.tabs) ? window.__prototypeState.tabs.length : -1
    }), { noteId });
    assert.notEqual(opened.activeTabId, "");
    assert.equal(opened.selectedFileId, noteId);
    assert.equal(opened.activeFileId, noteId);
    assert.equal(opened.currentNoteId, noteId);
    assert.equal(opened.tabCount, 1);
  }, 7000);

  await page.locator("#btnNewNote").click();

  await waitFor(async () => {
    const afterNewTab = await page.evaluate(({ noteId }) => ({
      activeTabId: window.__prototypeState?.activeTabId || "",
      selectedFileId: window.__prototypeState?.selectedFileId || "",
      activeFileId: document.querySelector('.explorer-item.file-row.active[data-kind="file"]')?.getAttribute("data-id") || "",
      currentNoteId: document.querySelector('.explorer-item.file-row.is-current-note[data-kind="file"]')?.getAttribute("data-id") || "",
      oldNoteIsCurrent: document.querySelector(`.explorer-item[data-kind="file"][data-id="${noteId}"]`)?.classList.contains("is-current-note") || false,
      tabCount: Array.isArray(window.__prototypeState?.tabs) ? window.__prototypeState.tabs.length : -1
    }), { noteId });
    assert.notEqual(afterNewTab.activeTabId, "");
    assert.equal(afterNewTab.tabCount, 2);
    assert.notEqual(afterNewTab.selectedFileId, noteId);
    assert.notEqual(afterNewTab.activeFileId, noteId);
    assert.notEqual(afterNewTab.currentNoteId, noteId);
    assert.equal(afterNewTab.oldNoteIsCurrent, false);
  }, 7000);

  await page.locator(".tab", { hasText: "Explorer Reopen Sync Note" }).click();

  await waitFor(async () => {
    const switchedBack = await page.evaluate(({ noteId }) => ({
      activeFileId: document.querySelector('.explorer-item.file-row.active[data-kind="file"]')?.getAttribute("data-id") || "",
      currentNoteId: document.querySelector('.explorer-item.file-row.is-current-note[data-kind="file"]')?.getAttribute("data-id") || ""
    }), { noteId });
    assert.equal(switchedBack.activeFileId, noteId);
    assert.equal(switchedBack.currentNoteId, noteId);
  }, 7000);

  await page.evaluate(() => {
    const closed = window.__prototypeEditor?.closeAllTabs?.();
    if (!closed) throw new Error("closeAllTabs returned false");
  });

  await waitFor(async () => {
    const cleared = await page.evaluate(() => ({
      activeTabId: window.__prototypeState?.activeTabId || "",
      selectedFileId: window.__prototypeState?.selectedFileId || "",
      activeFileId: document.querySelector('.explorer-item.file-row.active[data-kind="file"]')?.getAttribute("data-id") || "",
      currentNoteId: document.querySelector('.explorer-item.file-row.is-current-note[data-kind="file"]')?.getAttribute("data-id") || "",
      tabCount: Array.isArray(window.__prototypeState?.tabs) ? window.__prototypeState.tabs.length : -1
    }));
    assert.equal(cleared.activeTabId, "");
    assert.equal(cleared.selectedFileId, "");
    assert.equal(cleared.activeFileId, "");
    assert.equal(cleared.currentNoteId, "");
    assert.equal(cleared.tabCount, 0);
  }, 7000);

  await page.locator("#btnNewNote").click();

  await waitFor(async () => {
    const reopened = await page.evaluate(({ noteId }) => ({
      activeTabId: window.__prototypeState?.activeTabId || "",
      selectedFileId: window.__prototypeState?.selectedFileId || "",
      activeFileId: document.querySelector('.explorer-item.file-row.active[data-kind="file"]')?.getAttribute("data-id") || "",
      currentNoteId: document.querySelector('.explorer-item.file-row.is-current-note[data-kind="file"]')?.getAttribute("data-id") || "",
      oldNoteIsCurrent: document.querySelector(`.explorer-item[data-kind="file"][data-id="${noteId}"]`)?.classList.contains("is-current-note") || false,
      tabCount: Array.isArray(window.__prototypeState?.tabs) ? window.__prototypeState.tabs.length : -1
    }), { noteId });
    assert.notEqual(reopened.activeTabId, "");
    assert.equal(reopened.tabCount, 1);
    assert.notEqual(reopened.selectedFileId, noteId);
    assert.notEqual(reopened.activeFileId, noteId);
    assert.notEqual(reopened.currentNoteId, noteId);
    assert.equal(reopened.oldNoteIsCurrent, false);
  }, 7000);
});

test("prototype editor stays editable after opening related panel and switching directories", async (t) => {
  if (process.env.RUN_BROWSER_E2E !== "1") {
    t.skip("Set RUN_BROWSER_E2E=1 to enable browser e2e in local runs.");
    return;
  }

  const playwright = await optionalPlaywright(t);
  if (!playwright) return;

  const stack = await startPrototypeStack(t, playwright);
  if (!stack) return;
  const { apiBase, page, vaultPath, webBase } = stack;

  const siblingDir = await postJson(apiBase, "/api/v1/directories", {
    title: "Panel Switch Folder",
    parentDirectoryId: "dir_original_default",
    directoryType: "custom",
    fsPath: path.join(vaultPath, "notes", "original", "panel-switch-folder"),
    maxNotes: 500
  });
  assert.equal(siblingDir.status, 201, JSON.stringify(siblingDir.json));

  const first = await postJson(apiBase, "/api/v1/notes", {
    directoryId: "dir_original_default",
    body: "# Panel Alpha\n\nAlpha body."
  });
  const second = await postJson(apiBase, "/api/v1/notes", {
    directoryId: siblingDir.json.item.id,
    body: "# Panel Beta\n\nBeta body."
  });
  assert.equal(first.status, 201);
  assert.equal(second.status, 201);

  await page.goto(`${webBase}/prototype`, { waitUntil: "networkidle" });
  await openOriginalNoteBox(page);
  await page.locator('.explorer-item[data-kind="file"]', { hasText: "Panel Alpha" }).click();
  await waitFor(async () => {
    const value = await page.locator("#editorBody").inputValue();
    assert.match(value, /Panel Alpha/);
  }, 7000);

  await page.locator("#btnShowRelated").click();
  await page.waitForFunction(() => {
    const wrap = document.querySelector(".editor-wrap");
    const panel = document.querySelector("#relatedPanel");
    return Boolean(wrap && !wrap.classList.contains("inspector-closed") && panel && window.getComputedStyle(panel).display !== "none");
  });

  await ensureSourceMode(page);
  await focusEditorContent(page);
  await page.keyboard.press(process.platform === "darwin" ? "Meta+End" : "Control+End");
  await page.keyboard.type("\n\nAlpha after panel open.");
  await waitFor(async () => {
    const value = await page.locator("#editorBody").inputValue();
    assert.match(value, /Alpha after panel open\./);
  }, 7000);

  page.once("dialog", async (dialog) => {
    assert.ok(dialog.message().includes("未保存") || dialog.message().includes("unsaved"));
    await dialog.accept();
  });
  await page.locator('.explorer-item[data-kind="folder"]', { hasText: "Panel Switch Folder" }).click();
  await page.locator('.explorer-item[data-kind="file"]', { hasText: "Panel Beta" }).click();
  await waitFor(async () => {
    const value = await page.locator("#editorBody").inputValue();
    assert.match(value, /Panel Beta/);
  }, 7000);

  await page.waitForFunction(() => {
    const split = document.querySelector("#markdownSplit");
    const source = document.querySelector("#editorHost");
    return Boolean(
      split &&
        source &&
        split.getBoundingClientRect().height > 240 &&
        source.getBoundingClientRect().height > 200
    );
  });

  await ensureSourceMode(page);
  await focusEditorContent(page);
  await page.keyboard.press(process.platform === "darwin" ? "Meta+End" : "Control+End");
  await page.keyboard.type("\n\nBeta still editable.");
  await waitFor(async () => {
    const value = await page.locator("#editorBody").inputValue();
    assert.match(value, /Beta still editable\./);
  }, 7000);
});

test("prototype editor keeps content editable when toggling source and wysiwyg with related panel open", async (t) => {
  if (process.env.RUN_BROWSER_E2E !== "1") {
    t.skip("Set RUN_BROWSER_E2E=1 to enable browser e2e in local runs.");
    return;
  }

  const playwright = await optionalPlaywright(t);
  if (!playwright) return;

  const stack = await startPrototypeStack(t, playwright);
  if (!stack) return;
  const { apiBase, page } = stack;

  await createAndSaveNoteViaEditor(page, "# Mode Guard Note\n\nBody before toggle.");
  await waitFor(async () => {
    const value = await page.locator("#editorBody").inputValue();
    assert.match(value, /Mode Guard Note/);
    assert.match(value, /Body before toggle\./);
  }, 7000);

  await page.locator("#btnShowRelated").click();
  await page.waitForFunction(() => {
    const wrap = document.querySelector(".editor-wrap");
    const panel = document.querySelector("#relatedPanel");
    return Boolean(wrap && !wrap.classList.contains("inspector-closed") && panel && window.getComputedStyle(panel).display !== "none");
  });

  await ensureSourceMode(page);
  await focusEditorContent(page);
  await page.keyboard.press(process.platform === "darwin" ? "Meta+End" : "Control+End");
  await page.keyboard.type("\n\nSource tail.");
  await waitFor(async () => {
    const value = await page.locator("#editorBody").inputValue();
    assert.match(value, /Source tail\./);
  }, 7000);

  await ensureNoteMode(page);
  await placeCaretAtRichBlockEnd(page, "#editorHost .cm-content p:last-of-type, #editorHost .cm-content h1");
  await page.keyboard.type(" WYSIWYG tail.");
  await waitFor(async () => {
    const value = await page.locator("#editorBody").inputValue();
    assert.match(value, /WYSIWYG tail\./);
  }, 7000);

  await page.waitForFunction(() => {
    const split = document.querySelector("#markdownSplit");
    const source = document.querySelector("#editorHost");
    const rich = document.querySelector("#wysiwygHost");
    const related = document.querySelector("#relatedPanel");
    const isSource = split?.classList.contains("editor-mode-source");
    const isWysiwyg = split?.classList.contains("editor-mode-wysiwyg");
    return Boolean(
      split &&
        related &&
        split.getBoundingClientRect().height > 240 &&
        ((isSource && source && source.getBoundingClientRect().height > 200) ||
          (isWysiwyg && rich && rich.getBoundingClientRect().height > 200)) &&
        related.getBoundingClientRect().width > 160
    );
  });

  const activeNoteId = await page.evaluate(() => window.__prototypeEditor?.activeNote?.()?.id || "");
  assert.ok(activeNoteId);
  await page.evaluate(() => window.__prototypeEditor?.saveActiveNote?.());

  await waitFor(async () => {
    const saved = await fetchJson(apiBase, `/api/v1/notes/${encodeURIComponent(activeNoteId)}`);
    assert.equal(saved.status, 200);
    assert.match(saved.json.item.body || "", /# Mode Guard Note/);
    assert.match(saved.json.item.body || "", /Source tail\./);
    assert.match(saved.json.item.body || "", /WYSIWYG tail\./);
    const status = await currentStatusText(page);
    assert.match(String(status || ""), /已同步到 Markdown|永久笔记已同步|永久笔记已同步，但仍建议继续打磨|已同步到 Markdown，但当前永久笔记仍按 draft 处理/);
  }, 10000);
});

test("prototype editor preserves consecutive blank lines in wysiwyg", async (t) => {
  if (process.env.RUN_BROWSER_E2E !== "1") {
    t.skip("Set RUN_BROWSER_E2E=1 to enable browser e2e in local runs.");
    return;
  }

  const playwright = await optionalPlaywright(t);
  if (!playwright) return;

  const stack = await startPrototypeStack(t, playwright);
  if (!stack) return;
  const { page } = stack;

  await page.locator("#btnNewNote").click();
  await ensurePlaceholderTitleSelection(page);
  await page.keyboard.type("Blank Lines Note");
  await page.keyboard.press("Enter");
  await page.keyboard.type("First line");

  // Consecutive Enter in WYSIWYG should keep blank lines stable.
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter");
  await page.keyboard.type("After blanks");

  await waitFor(async () => {
    const value = await page.locator("#editorBody").inputValue();
    assert.match(value, /# Blank Lines Note/);
    assert.match(value, /First line/);
    assert.match(value, /After blanks/);
    const hasBr = value.includes("<br>");
    const hasTripleNewline = /\n{3,}/.test(value);
    assert.ok(
      hasBr || hasTripleNewline,
      `Expected preserved blank lines (<br> or extra newlines), got:\n${value}`
    );
  }, 8000);
});

test("prototype editor opens external links without navigating the app", async (t) => {
  if (process.env.RUN_BROWSER_E2E !== "1") {
    t.skip("Set RUN_BROWSER_E2E=1 to enable browser e2e in local runs.");
    return;
  }

  const playwright = await optionalPlaywright(t);
  if (!playwright) return;

  const stack = await startPrototypeStack(t, playwright);
  if (!stack) return;
  const { page, webBase } = stack;

  await createAndSaveNoteViaEditor(page, "# External Link\n\n[Example](https://example.com)");

  const startUrl = page.url();
  await ensureNoteMode(page);
  await page.waitForFunction(() => {
    const link = document.querySelector(
      "#wysiwygHost .toastui-editor-ww-container .ProseMirror.toastui-editor-contents a[href^='https://']"
    );
    if (!link) return false;
    const box = link.getBoundingClientRect();
    const style = window.getComputedStyle(link);
    return style.display !== "none" && style.visibility !== "hidden" && box.width > 0 && box.height > 0;
  });

  const externalLink = page
    .locator("#wysiwygHost .toastui-editor-ww-container .ProseMirror.toastui-editor-contents a[href^='https://']")
    .first();
  await externalLink.scrollIntoViewIfNeeded();
  const popupPromise = page.waitForEvent("popup", { timeout: 1500 }).catch(() => null);
  await externalLink.click({ force: true });
  const popup = await popupPromise;
  if (popup) {
    await popup.close().catch(() => {});
  }

  await waitFor(async () => {
    assert.equal(page.url(), startUrl);
    assert.ok(page.url().startsWith(`${webBase}/prototype`), `Unexpected navigation to ${page.url()}`);
  }, 3000);
});

test("prototype editor can insert image and attachment", async (t) => {
  if (process.env.RUN_BROWSER_E2E !== "1") {
    t.skip("Set RUN_BROWSER_E2E=1 to enable browser e2e in local runs.");
    return;
  }

  const playwright = await optionalPlaywright(t);
  if (!playwright) return;

  const stack = await startPrototypeStack(t, playwright);
  if (!stack) return;
  const { page } = stack;

  const tempDir = await makeTempDir("yansilu-asset-e2e-");
  const pngPath = path.join(tempDir, "tiny.png");
  const txtPath = path.join(tempDir, "hello.txt");
  const pngBase64 =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMB/aznP6UAAAAASUVORK5CYII=";
  await fs.writeFile(pngPath, Buffer.from(pngBase64, "base64"));
  await fs.writeFile(txtPath, "hello attachment\n", "utf8");

  await page.locator("#btnNewNote").click();
  await ensurePlaceholderTitleSelection(page);
  await page.keyboard.type("Asset Insert Note");
  await page.keyboard.press("Enter");
  await page.keyboard.type("Body");

  await page.setInputFiles("#assetImageInput", pngPath);
  await waitFor(async () => {
    const value = await page.locator("#editorBody").inputValue();
    assert.match(value, /tiny\.png/);
  }, 10000);

  await page.setInputFiles("#assetFileInput", txtPath);
  await waitFor(async () => {
    const value = await page.locator("#editorBody").inputValue();
    assert.match(value, /hello\.txt/);
  }, 10000);

  await waitFor(async () => {
    const value = await page.locator("#editorBody").inputValue();
    assert.ok(/!\[[^\]]*\]\([^\)]*tiny\.png\)/.test(value), `Expected image markdown, got:\n${value}`);
    assert.ok(/\[[^\]]*\]\([^\)]*hello\.txt\)/.test(value), `Expected attachment markdown, got:\n${value}`);
  }, 8000);

  await ensureNoteMode(page);
  await page.waitForFunction(() => {
    const rich = document.querySelector("#wysiwygHost .toastui-editor-contents");
    return Boolean(
      rich &&
        rich.querySelector("img[data-preview-asset-url]") &&
        [...rich.querySelectorAll("a[data-preview-asset-url]")].some((a) => /hello\.txt/i.test(a.textContent || ""))
    );
  });

  await page.evaluate(() => {
    const img = document.querySelector("#wysiwygHost .toastui-editor-contents img[data-preview-asset-url]");
    if (!img) throw new Error("Missing previewable image asset");
    img.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  });
  await page.waitForFunction(() => {
    const mask = document.querySelector("#assetPreviewMask");
    return Boolean(mask && !mask.classList.contains("hidden"));
  });

  await page.locator("#btnCloseAssetPreview").click();
  await page.evaluate(() => {
    const link = [...document.querySelectorAll("#wysiwygHost .toastui-editor-contents a[data-preview-asset-url]")]
      .find((node) => /hello\.txt/i.test(node.textContent || ""));
    if (!link) throw new Error("Missing previewable attachment asset");
    link.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  });
  await page.waitForFunction(() => {
    const mask = document.querySelector("#assetPreviewMask");
    return Boolean(mask && !mask.classList.contains("hidden"));
  });
});

test("prototype editor opens wikilinks and tag results from wysiwyg tokens", async (t) => {
  if (process.env.RUN_BROWSER_E2E !== "1") {
    t.skip("Set RUN_BROWSER_E2E=1 to enable browser e2e in local runs.");
    return;
  }

  const playwright = await optionalPlaywright(t);
  if (!playwright) return;

  const stack = await startPrototypeStack(t, playwright);
  if (!stack) return;
  const { apiBase, page, webBase } = stack;

  await postJson(apiBase, "/api/v1/notes", {
    directoryId: "dir_original_default",
    body: "# Token Target\n\nTarget body with #thinkingflow."
  });
  await postJson(apiBase, "/api/v1/notes", {
    directoryId: "dir_original_default",
    body: "# Tag Peer\n\nAnother note with #thinkingflow."
  });
  const source = await postJson(apiBase, "/api/v1/notes", {
    directoryId: "dir_original_default",
    body: "# Token Source\n\nOpen [[Token Target]] and inspect #thinkingflow."
  });
  assert.equal(source.status, 201);

  await page.goto(`${webBase}/prototype`, { waitUntil: "networkidle" });
  await openOriginalNoteBox(page);
  await page.locator('.explorer-item[data-kind="file"]', { hasText: "Token Source" }).click();
  await ensureNoteMode(page);
  const startUrl = page.url();
  await page.waitForFunction(() => {
    const host = document.querySelector("#wysiwygHost");
    return Boolean(host && host.querySelector("[data-wikilink='Token Target']") && host.querySelector("[data-tag-token='thinkingflow']"));
  });

  await page.evaluate(() => {
    const tag = document.querySelector("#wysiwygHost [data-tag-token='thinkingflow']");
    if (!tag) throw new Error("Missing tag token");
    tag.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  });
  await waitFor(async () => {
    assert.equal(page.url(), startUrl);
    const relatedText = await page.locator("#relatedPanel").textContent();
    assert.match(String(relatedText || ""), /同标签笔记：#thinkingflow/);
    assert.match(String(relatedText || ""), /Tag Peer|Token Target/);
  }, 10000);

  await page.evaluate(() => {
    const link = document.querySelector("#wysiwygHost [data-wikilink='Token Target']");
    if (!link) throw new Error("Missing wikilink token");
    link.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  });
  await waitFor(async () => {
    assert.equal(page.url(), startUrl);
    const value = await page.locator("#editorBody").inputValue();
    assert.match(value, /# Token Source/);
    const relatedText = await page.locator("#relatedPanel").textContent();
    assert.match(String(relatedText || ""), /Token Target/);
    assert.match(String(relatedText || ""), /Target body with #thinkingflow/);
  }, 10000);
});

test("prototype editor inline wikilink picker inserts ranked candidate", async (t) => {
  if (process.env.RUN_BROWSER_E2E !== "1") {
    t.skip("Set RUN_BROWSER_E2E=1 to enable browser e2e in local runs.");
    return;
  }

  const playwright = await optionalPlaywright(t);
  if (!playwright) return;

  const stack = await startPrototypeStack(t, playwright);
  if (!stack) return;
  const { apiBase, page, webBase } = stack;

  await postJson(apiBase, "/api/v1/notes", {
    directoryId: "dir_original_default",
    body: "# Alpha target\n\nA less relevant target."
  });
  const gammaTarget = await postJson(apiBase, "/api/v1/notes", {
    directoryId: "dir_original_default",
    body: "# Gamma target\n\nThe expected wikilink target."
  });
  assert.equal(gammaTarget.status, 201);
  const source = await postJson(apiBase, "/api/v1/notes", {
    directoryId: "dir_original_default",
    body: "# Link picker source\n\nStart typing below."
  });
  assert.equal(source.status, 201);

  await page.goto(`${webBase}/prototype`, { waitUntil: "networkidle" });
  await openOriginalNoteBox(page);
  await page.locator('.explorer-item[data-kind="file"]', { hasText: "Link picker source" }).click();
  await ensureSourceMode(page);
  await focusEditorContent(page);
  await page.keyboard.press(process.platform === "darwin" ? "Meta+End" : "Control+End");
  await page.keyboard.type("\n\n[[ga");

  await waitFor(async () => {
    await page.locator("#linkPicker:not(.hidden) .link-picker-item.active", { hasText: "Gamma target" }).waitFor({ timeout: 500 });
  }, 7000);

  const pickerState = await page.evaluate(() => {
    const picker = document.querySelector("#linkPicker");
    return {
      hidden: picker?.classList.contains("hidden") ?? true,
      labels: Array.from(document.querySelectorAll("#linkPicker .picker-section-label")).map((node) => node.textContent || ""),
      activeHtml: document.querySelector("#linkPicker .link-picker-item.active")?.innerHTML || "",
      activeText: document.querySelector("#linkPicker .link-picker-item.active")?.textContent || ""
    };
  });
  assert.equal(pickerState.hidden, false, JSON.stringify(pickerState));
  assert.ok(
    pickerState.labels.length === 0 || pickerState.labels.some((text) => /最匹配|同目录笔记/.test(String(text || ""))),
    JSON.stringify(pickerState)
  );
  assert.match(pickerState.activeHtml, /picker-mark/);
  assert.match(pickerState.activeText, /Gamma target/);

  assert.equal(await page.locator("#btnSave").isVisible(), false);

  await page.keyboard.press("Enter");
  await waitFor(async () => {
    assert.equal(await page.locator("#linkSearchInput").inputValue(), "Gamma target");
    assert.equal(await page.locator("#btnConfirmLinkInsert").isDisabled(), true);
  }, 3000);
  await page.locator("#linkReasonInput").fill("Gamma target explains the related idea.");
  await waitFor(async () => {
    assert.equal(await page.locator("#btnConfirmLinkInsert").isDisabled(), false);
  }, 3000);
  await page.locator("#btnConfirmLinkInsert").click();
  await page.waitForFunction(
    (targetId) => document.querySelector("#editorBody")?.value?.includes(`[[${targetId}|Gamma target]]`),
    gammaTarget.json.item.id
  );
  const editorValue = await page.locator("#editorBody").inputValue();
  assert.match(editorValue, new RegExp(`\\[\\[${escapeRegExp(gammaTarget.json.item.id)}\\|Gamma target\\]\\]`));
  await waitFor(async () => {
    const relation = await fetchJson(apiBase, `/api/v1/notes/${encodeURIComponent(source.json.item.id)}/relations`);
    assert.equal(relation.status, 200, JSON.stringify(relation.json));
    const saved = relation.json.item.outgoingLinks.find((item) => item.toNoteId === gammaTarget.json.item.id);
    assert.ok(saved, JSON.stringify(relation.json));
    assert.equal(saved.rationale, "Gamma target explains the related idea.");
  }, 5000);
});

test("prototype editor confirms before closing or switching away from dirty note", async (t) => {
  if (process.env.RUN_BROWSER_E2E !== "1") {
    t.skip("Set RUN_BROWSER_E2E=1 to enable browser e2e in local runs.");
    return;
  }

  const playwright = await optionalPlaywright(t);
  if (!playwright) return;

  const stack = await startPrototypeStack(t, playwright);
  if (!stack) return;
  const { apiBase, page, webBase } = stack;

  const first = await postJson(apiBase, "/api/v1/notes", {
    directoryId: "dir_original_default",
    body: "# Dirty source\n\nThis note will be edited without saving."
  });
  const second = await postJson(apiBase, "/api/v1/notes", {
    directoryId: "dir_original_default",
    body: "# Switch target\n\nOpening this should ask first."
  });
  assert.equal(first.status, 201);
  assert.equal(second.status, 201);

  await page.goto(`${webBase}/prototype`, { waitUntil: "networkidle" });
  await openOriginalNoteBox(page);
  await page.locator('.explorer-item[data-kind="file"]', { hasText: "Dirty source" }).click();
  await ensureSourceMode(page);
  await placeCaretAtRichBlockEnd(page, "#editorHost .cm-content p:last-of-type, #editorHost .cm-content h1");
  await page.keyboard.type("\n\nUnsaved line.");

  await waitFor(async () => {
    const dirty = await page.locator(".tab.active .tab-dirty").textContent();
    assert.ok(String(dirty || "").trim());
  }, 7000);

  page.once("dialog", async (dialog) => {
    assert.ok(
      dialog.message().includes("未同步的修改") ||
        dialog.message().includes("丢失这些更改") ||
        dialog.message().toLowerCase().includes("unsaved")
    );
    await dialog.dismiss();
  });
  await page.locator(".tab.active .tab-close").click();
  await page.locator(".tab.active", { hasText: "Dirty source" }).waitFor({ timeout: 1000 });

  await page.locator('.explorer-item[data-kind="file"]', { hasText: "Switch target" }).click();
  await page.waitForFunction(() => document.querySelector("#editorBody")?.value?.includes("Switch target"));

  await waitFor(async () => {
    const saved = await fetchJson(apiBase, `/api/v1/notes/${encodeURIComponent(first.json.item.id)}`);
    assert.equal(saved.status, 200);
    assert.match(saved.json.item.body, /Unsaved line\./);
  }, 10000);

  page.once("dialog", async (dialog) => {
    assert.ok(
      dialog.message().includes("未同步的修改") ||
        dialog.message().includes("丢失这些更改") ||
        dialog.message().toLowerCase().includes("unsaved")
    );
    await dialog.accept();
  });
  await page.locator(".tab", { hasText: "Dirty source" }).locator(".tab-close").click();
  await waitFor(async () => {
    const dirtySourceTabs = await page.locator(".tab", { hasText: "Dirty source" }).count();
    assert.equal(dirtySourceTabs, 0);
  }, 7000);
});

test("prototype editor restores autosaved draft after reload", async (t) => {
  if (process.env.RUN_BROWSER_E2E !== "1") {
    t.skip("Set RUN_BROWSER_E2E=1 to enable browser e2e in local runs.");
    return;
  }

  const playwright = await optionalPlaywright(t);
  if (!playwright) return;

  const stack = await startPrototypeStack(t, playwright);
  if (!stack) return;
  const { apiBase, page, webBase } = stack;

  const created = await postJson(apiBase, "/api/v1/notes", {
    directoryId: "dir_original_default",
    body: "# Autosave source\n\nThis note starts from disk."
  });
  assert.equal(created.status, 201);

  await page.goto(`${webBase}/prototype`, { waitUntil: "networkidle" });
  await openOriginalNoteBox(page);
  await page.locator('.explorer-item[data-kind="file"]', { hasText: "Autosave source" }).click();
  await ensureSourceMode(page);
  await placeCaretAtRichBlockEnd(page, "#editorHost .cm-content p:last-of-type, #editorHost .cm-content h1");
  await page.keyboard.type("\n\nRecovered draft line.");

  await waitFor(async () => {
    const draftCount = await page.evaluate(() =>
      Object.keys(window.localStorage).filter((key) => key.startsWith("yansilu:draft:")).length
    );
    assert.equal(draftCount, 1);
  }, 7000);

  const dialogMessages = [];
  page.on("dialog", async (dialog) => {
    dialogMessages.push(dialog.message());
    await dialog.accept();
  });

  await page.reload({ waitUntil: "networkidle" });
  await page.locator('.explorer-item[data-kind="file"]', { hasText: "Autosave source" }).click();
  await ensureSourceMode(page);
  await page.waitForFunction(() => document.querySelector("#editorBody")?.value?.includes("Recovered draft line."));

  assert.ok(
    dialogMessages.some(
      (message) =>
        String(message || "").includes("上次未完成的编辑内容") ||
        String(message || "").includes("是否恢复")
    ),
    JSON.stringify(dialogMessages)
  );
  const restored = await page.locator("#editorBody").inputValue();
  assert.match(restored, /Recovered draft line\./);
  const restoreStatus = await currentStatusText(page);
  assert.match(String(restoreStatus || ""), /已恢复上次未完成的编辑内容/);

  await confirmAuthorshipIfVisible(page, { claim: "Autosave source 定位指向的草稿中心判断" });
  await page.keyboard.press(process.platform === "darwin" ? "Meta+S" : "Control+S");
  await waitFor(async () => {
    const draftCount = await page.evaluate(() =>
      Object.keys(window.localStorage).filter((key) => key.startsWith("yansilu:draft:")).length
    );
    assert.equal(draftCount, 0);
  }, 10000);
});

test("prototype tag click searches SQLite beyond the loaded directory", async (t) => {
  if (process.env.RUN_BROWSER_E2E !== "1") {
    t.skip("Set RUN_BROWSER_E2E=1 to enable browser e2e in local runs.");
    return;
  }

  const playwright = await optionalPlaywright(t);
  if (!playwright) return;

  const stack = await startPrototypeStack(t, playwright);
  if (!stack) return;
  const { apiBase, page, vaultPath } = stack;

  const siblingDir = await postJson(apiBase, "/api/v1/directories", {
    title: "SQLite Tag Sibling",
    parentDirectoryId: "dir_original_default",
    directoryType: "custom",
    fsPath: path.join(vaultPath, "notes", "original", "sqlite-tag-sibling"),
    maxNotes: 500
  });
  assert.equal(siblingDir.status, 201, JSON.stringify(siblingDir.json));

  const sourceNote = await postJson(apiBase, "/api/v1/notes", {
    directoryId: "dir_original_default",
    body: "# Tag source\n\nClick #sharedtag to search through SQLite."
  });
  assert.equal(sourceNote.status, 201, JSON.stringify(sourceNote.json));

  const hiddenSiblingNote = await postJson(apiBase, "/api/v1/notes", {
    directoryId: siblingDir.json.item.id,
    body: "# Hidden sibling result\n\nThis note is outside the loaded directory but has #sharedtag."
  });
  assert.equal(hiddenSiblingNote.status, 201, JSON.stringify(hiddenSiblingNote.json));

  await page.reload({ waitUntil: "networkidle" });
  await page.locator('.explorer-item[data-kind="file"]', { hasText: "Tag source" }).click();
  await page.waitForFunction(() => document.querySelector("#editorBody")?.value?.includes("#sharedtag"));
  await ensureNoteMode(page);
  await page.waitForFunction(() => Boolean(document.querySelector("#wysiwygHost [data-tag-token='sharedtag']")));

  await page.evaluate(() => {
    const token = document.querySelector("#wysiwygHost [data-tag-token='sharedtag']");
    if (!token) throw new Error("Missing #sharedtag token");
    token.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  });

  await waitFor(async () => {
    const related = await page.locator("#resultArea").textContent();
    assert.match(related || "", /Hidden sibling result/);
  }, 7000);

  const resultText = await page.locator("#resultArea").textContent();
  assert.ok(String(resultText || "").includes("标签") && String(resultText || "").includes("#sharedtag"));
  const siblingNote = await fetchJson(apiBase, `/api/v1/notes/${encodeURIComponent(hiddenSiblingNote.json.item.id)}`);
  assert.equal(siblingNote.status, 200);
});

test("prototype editor inline tag picker inserts SQLite-backed tag suggestion", async (t) => {
  if (process.env.RUN_BROWSER_E2E !== "1") {
    t.skip("Set RUN_BROWSER_E2E=1 to enable browser e2e in local runs.");
    return;
  }

  const playwright = await optionalPlaywright(t);
  if (!playwright) return;

  const stack = await startPrototypeStack(t, playwright);
  if (!stack) return;
  const { apiBase, page, vaultPath, webBase } = stack;

  const siblingDir = await postJson(apiBase, "/api/v1/directories", {
    title: "Tag Suggestion Sibling",
    parentDirectoryId: "dir_original_default",
    directoryType: "custom",
    fsPath: path.join(vaultPath, "notes", "original", "tag-suggestion-sibling"),
    maxNotes: 500
  });
  assert.equal(siblingDir.status, 201, JSON.stringify(siblingDir.json));

  const taggedNote = await postJson(apiBase, "/api/v1/notes", {
    directoryId: siblingDir.json.item.id,
    body: "# Tagged sibling\n\nThis note contributes #writingflow to tag suggestions."
  });
  assert.equal(taggedNote.status, 201, JSON.stringify(taggedNote.json));

  const sourceNote = await postJson(apiBase, "/api/v1/notes", {
    directoryId: "dir_original_default",
    body: "# Tag picker source\n\nStart a new tag below."
  });
  assert.equal(sourceNote.status, 201, JSON.stringify(sourceNote.json));

  await page.goto(`${webBase}/prototype`, { waitUntil: "networkidle" });
  await openOriginalNoteBox(page);
  await page.locator('.explorer-item[data-kind="file"]', { hasText: "Tag picker source" }).click();
  await ensureSourceMode(page);
  await focusEditorContent(page);
  await page.keyboard.press(process.platform === "darwin" ? "Meta+End" : "Control+End");
  await page.keyboard.type("\n\n#writ");

  await waitFor(async () => {
    await page.locator("#tagPicker:not(.hidden) .link-picker-item.active", { hasText: "#writingflow" }).waitFor({ timeout: 500 });
  }, 7000);

  const tagSectionText = await page.locator("#tagPicker .picker-section-label").first().textContent();
  assert.ok(String(tagSectionText || "").trim().length > 0);

  const tagCandidateHtml = await page.locator("#tagPicker .link-picker-item.active").innerHTML();
  assert.match(tagCandidateHtml, /picker-mark/);
  assert.match(tagCandidateHtml, /picker-badge/);
  assert.match(tagCandidateHtml, /picker-meta/);

  await page.keyboard.press("Enter");
  await page.waitForFunction(() => document.querySelector("#editorBody")?.value?.includes("#writingflow"));
  const editorValue = await page.locator("#editorBody").inputValue();
  assert.match(editorValue, /#writingflow/);
});

test("prototype settings switches and initializes the active vault", async (t) => {
  if (process.env.RUN_BROWSER_E2E !== "1") {
    t.skip("Set RUN_BROWSER_E2E=1 to enable browser e2e in local runs.");
    return;
  }

  const playwright = await optionalPlaywright(t);
  if (!playwright) return;

  const stack = await startPrototypeStack(t, playwright);
  if (!stack) return;
  const { apiBase, page, vaultPath } = stack;
  const nextVaultPath = path.join(await makeTempDir("yansilu-browser-e2e-switched-vault-parent-"), "switched-vault");

  await openSettingsModule(page, "workspace");
  await waitFor(async () => {
    const currentVaultPath = await page.locator("#settingsVaultPath").inputValue();
    assert.equal(path.resolve(String(currentVaultPath || "").trim()), path.resolve(vaultPath));
  }, 7000);

  await page.locator("#settingsVaultPath").fill(nextVaultPath);
  await page.locator("#settingsSwitchVault").click();
  await waitFor(async () => {
    const health = await fetchJson(apiBase, "/health");
    assert.equal(health.status, 200);
    assert.equal(path.resolve(health.json.vaultPath), path.resolve(nextVaultPath));
  }, 10000);
  await waitFor(async () => {
    const currentVaultPath = await page.locator("#settingsVaultPath").inputValue();
    assert.equal(path.resolve(String(currentVaultPath || "").trim()), path.resolve(nextVaultPath));
  }, 7000);

  await fs.access(path.join(nextVaultPath, ".yansilu", "vault.json"));

  const health = await fetchJson(apiBase, "/health");
  assert.equal(health.status, 200);
  assert.equal(path.resolve(health.json.vaultPath), path.resolve(nextVaultPath));

  const directories = await fetchJson(apiBase, "/api/v1/directories");
  assert.equal(directories.status, 200);
  assert.ok(directories.json.items.some((item) => item.id === "dir_original_default"));
});

test("prototype settings browse vault uses picker fallback and fills the path", async (t) => {
  if (process.env.RUN_BROWSER_E2E !== "1") {
    t.skip("Set RUN_BROWSER_E2E=1 to enable browser e2e in local runs.");
    return;
  }

  const playwright = await optionalPlaywright(t);
  if (!playwright) return;

  const stack = await startPrototypeStack(t, playwright);
  if (!stack) return;
  const { page, vaultPath } = stack;
  const nextVaultPath = path.join(await makeTempDir("yansilu-browser-e2e-browse-vault-parent-"), "browsed-vault");

  await openSettingsModule(page, "workspace");
  await waitFor(async () => {
    const currentVaultPath = await page.locator("#settingsVaultPath").inputValue();
    assert.equal(path.resolve(String(currentVaultPath || "").trim()), path.resolve(vaultPath));
  }, 7000);

  await page.evaluate((pickedPath) => {
    window.showDirectoryPicker = undefined;
    window.__lastVaultPrompt = null;
    window.prompt = (message, defaultPath) => {
      window.__lastVaultPrompt = { message, defaultPath };
      return pickedPath;
    };
  }, nextVaultPath);

  await page.locator("#settingsBrowseVault").click();

  await waitFor(async () => {
    const selectedPath = await page.locator("#settingsVaultPath").inputValue();
    assert.equal(path.resolve(selectedPath), path.resolve(nextVaultPath));
  }, 7000);

  const promptMeta = await page.evaluate(() => window.__lastVaultPrompt || null);
  assert.ok(promptMeta);
  assert.match(String(promptMeta.message || ""), /请输入目录路径|浏览器降级模式/);
  assert.equal(path.resolve(String(promptMeta.defaultPath || "")), path.resolve(vaultPath));
});

test("prototype settings exposes the permanent note template entry", async (t) => {
  if (process.env.RUN_BROWSER_E2E !== "1") {
    t.skip("Set RUN_BROWSER_E2E=1 to enable browser e2e in local runs.");
    return;
  }

  const playwright = await optionalPlaywright(t);
  if (!playwright) return;

  const stack = await startPrototypeStack(t, playwright);
  if (!stack) return;
  const { page } = stack;

  await openSettingsModule(page, "templates");

  const editor = page.locator("#settingsPermanentTemplateEditor");
  await waitFor(async () => {
    assert.equal(await editor.isVisible(), true);
  }, 5000);
  assert.match(await editor.inputValue(), /## 核心观点/);

  await page.locator("#settingsPreviewPermanentTemplate").click();
  await waitFor(async () => {
    assert.equal(await page.locator("#settingsTemplatePreviewModal").getAttribute("aria-hidden"), "false");
  }, 5000);
  assert.match(String(await page.locator("#settingsTemplatePreviewBody").textContent() || ""), /核心观点/);
  await page.locator("#settingsTemplatePreviewClose").click();
  await waitFor(async () => {
    assert.equal(await page.locator("#settingsTemplatePreviewModal").getAttribute("aria-hidden"), "true");
  }, 5000);
});

test("prototype migrates the legacy default permanent template before settings render", async (t) => {
  if (process.env.RUN_BROWSER_E2E !== "1") {
    t.skip("Set RUN_BROWSER_E2E=1 to enable browser e2e in local runs.");
    return;
  }

  const playwright = await optionalPlaywright(t);
  if (!playwright) return;

  const legacyPermanentTemplate = `# {{title}}

## 核心观点

> 写成一句可被反驳、可被引用、值得保留的判断。
## 为什么成立

> 说明这条判断依赖的理由、证据或经验。
## 证据 / 来源

- 来自哪条文献笔记、经验、案例或观察？

## 相关笔记

- 它连接到哪些已有笔记、主题或写作项目？

## 边界 / 反例

- 这条判断在什么条件下不成立？
`;

  const stack = await startPrototypeStack(t, playwright, {
    beforeGoto: async (page) => {
      await page.addInitScript(({ permanent }) => {
        window.localStorage.setItem("yansilu:settings:note-template:permanent", permanent);
      }, {
        permanent: legacyPermanentTemplate
      });
    }
  });
  if (!stack) return;
  const { page } = stack;

  await openSettingsModule(page, "templates");
  await waitFor(async () => {
    const value = await page.locator("#settingsPermanentTemplateEditor").inputValue();
    assert.match(value, /## 核心观点\n\n写成一句可被反驳、可被引用、值得保留的判断。/);
    assert.doesNotMatch(value, /^> 写成一句/m);
    assert.doesNotMatch(value, /^- 来自哪条文献/m);
  }, 5000);

  await page.locator('[data-action="quick-original"]').click();
  await page.locator("#btnNewNote").click();
  await waitFor(async () => {
    const value = await page.locator("#editorBody").inputValue();
    assert.match(value, /## 核心观点\n\n写成一句可被反驳、可被引用、值得保留的判断。/);
    assert.doesNotMatch(value, /^> 写成一句/m);
    assert.doesNotMatch(value, /^- 来自哪条文献/m);
  }, 5000);
});

test("prototype settings keeps template drafts across same-vault refreshes", async (t) => {
  if (process.env.RUN_BROWSER_E2E !== "1") {
    t.skip("Set RUN_BROWSER_E2E=1 to enable browser e2e in local runs.");
    return;
  }

  const playwright = await optionalPlaywright(t);
  if (!playwright) return;

  const stack = await startPrototypeStack(t, playwright);
  if (!stack) return;
  const { page } = stack;
  const draftTemplate = `# {{title}}

## 核心观点

这是还没保存的模板草稿。
`;

  await openSettingsModule(page, "templates");

  await page.locator("#settingsPermanentTemplateEditor").fill(draftTemplate);
  await waitFor(async () => {
    assert.match(String(await page.locator("#settingsPermanentTemplateFeedbackText").textContent() || ""), /有未保存修改/);
  }, 5000);

  await openSettingsModule(page, "workspace");
  await page.locator("#settingsRefreshVault").click();
  await waitFor(async () => {
    const currentVaultPath = String(await page.locator("#settingsVaultPath").inputValue() || "").trim();
    assert.ok(currentVaultPath.length > 0);
  }, 10000);
  await waitFor(async () => {
    assert.equal(await page.locator("#settingsPermanentTemplateEditor").inputValue(), draftTemplate);
    assert.match(String(await page.locator("#settingsPermanentTemplateFeedbackText").textContent() || ""), /有未保存修改/);
  }, 5000);

  await openSettingsModule(page, "templates");
  await waitFor(async () => {
    assert.equal(await page.locator("#settingsPermanentTemplateEditor").inputValue(), draftTemplate);
    assert.match(String(await page.locator("#settingsPermanentTemplateFeedbackText").textContent() || ""), /有未保存修改/);
  }, 5000);

  await page.locator("#settingsPermanentTemplateEditor").fill("");
  await waitFor(async () => {
    assert.equal(await page.locator("#settingsPermanentTemplateEditor").inputValue(), "");
  }, 5000);
  await openSettingsModule(page, "workspace");
  await page.locator("#settingsRefreshVault").click();
  await waitFor(async () => {
  assert.equal(await page.locator("#settingsPermanentTemplateEditor").inputValue(), "");
  }, 5000);
});

test("prototype literature template preview surfaces invalid shapes before save", async (t) => {
  if (process.env.RUN_BROWSER_E2E !== "1") {
    t.skip("Set RUN_BROWSER_E2E=1 to enable browser e2e in local runs.");
    return;
  }

  const playwright = await optionalPlaywright(t);
  if (!playwright) return;

  const stack = await startPrototypeStack(t, playwright);
  if (!stack) return;
  const { page } = stack;
  const invalidLiteratureTemplate = `# {{title}}

## 引用信息

## 原文

## 转述

## 判断种子

## 追问

## 边界 / 反例

## Research Notes
`;

  await openSettingsModule(page, "templates");
  await page.locator("#settingsLiteratureTemplateEditor").fill(invalidLiteratureTemplate);
  await page.locator("#settingsPreviewLiteratureTemplate").click();
  await waitFor(async () => {
    assert.match(String(await page.locator("#settingsTemplatePreviewBody").textContent() || ""), /模板当前不能保存/);
    assert.equal(await page.locator("#settingsSaveLiteratureTemplate").isDisabled(), true);
    assert.match(String(await page.locator("#settingsLiteratureTemplateFeedbackText").textContent() || ""), /当前内容还不能保存/);
  }, 5000);
  await page.locator("#settingsTemplatePreviewClose").click();
});

test("prototype falls back to default literature template when stored template is invalid", async (t) => {
  if (process.env.RUN_BROWSER_E2E !== "1") {
    t.skip("Set RUN_BROWSER_E2E=1 to enable browser e2e in local runs.");
    return;
  }

  const playwright = await optionalPlaywright(t);
  if (!playwright) return;

  const invalidLiteratureTemplate = `# {{title}}

## 引用信息

## 原文

## 转述

## 判断种子

## 追问

## 边界 / 反例

## Research Notes
`;

  const stack = await startPrototypeStack(t, playwright, {
    beforeGoto: async (page) => {
      await page.addInitScript(({ literature }) => {
        window.localStorage.setItem("yansilu:settings:note-template:literature", literature);
      }, {
        literature: invalidLiteratureTemplate
      });
    }
  });
  if (!stack) return;
  const { page } = stack;

  await openSettingsModule(page, "templates");
  await page.locator("#settingsPreviewLiteratureTemplate").click();
  await waitFor(async () => {
    assert.match(String(await page.locator("#settingsTemplatePreviewBody").textContent() || ""), /模板当前不能保存/);
    assert.equal(await page.locator("#settingsSaveLiteratureTemplate").isDisabled(), true);
  }, 5000);
  await page.locator("#settingsTemplatePreviewClose").click();

  await page.locator('[data-action="quick-literature"]').click();
  await page.locator("#btnNewNote").click();
  await waitFor(async () => {
    const value = await page.locator("#editorBody").inputValue();
    assert.match(value, /## 引用信息/);
    assert.match(value, /## 原文/);
    assert.match(value, /## 转述/);
    assert.doesNotMatch(value, /## Research Notes/);
  }, 5000);
  const originalUntitledNoteId = await page.evaluate(() => String(window.__prototypeState?.selectedFileId || "").trim());
  assert.ok(originalUntitledNoteId);

  await page.locator('[data-action="quick-literature"]').click();
  await page.locator("#btnNewNote").click();
  await waitFor(async () => {
    const selectedFileId = await page.evaluate(() => String(window.__prototypeState?.selectedFileId || "").trim());
    assert.equal(selectedFileId, originalUntitledNoteId);
    const value = await page.locator("#editorBody").inputValue();
    assert.match(value, /## 引用信息/);
    assert.doesNotMatch(value, /## Research Notes/);
  }, 5000);
});

test("prototype migrates legacy global note templates into the active vault scope", async (t) => {
  if (process.env.RUN_BROWSER_E2E !== "1") {
    t.skip("Set RUN_BROWSER_E2E=1 to enable browser e2e in local runs.");
    return;
  }

  const playwright = await optionalPlaywright(t);
  if (!playwright) return;

  const legacyPermanentTemplate = `# {{title}}

## 核心观点

这是旧版全局永久模板。
`;
  const legacyLiteratureTemplate = `# {{title}}

## 引用信息

- 标题：旧版全局来源

## 原文

旧版全局原文占位

## 转述

这是旧版全文献模板。
`;

  const stack = await startPrototypeStack(t, playwright, {
    beforeGoto: async (page) => {
      await page.addInitScript(({ permanent, literature }) => {
        window.localStorage.setItem("yansilu:settings:note-template:permanent", permanent);
        window.localStorage.setItem("yansilu:settings:note-template:literature", literature);
      }, {
        permanent: legacyPermanentTemplate,
        literature: legacyLiteratureTemplate
      });
    }
  });
  if (!stack) return;
  const { page, vaultPath } = stack;
  const nextVaultPath = path.join(await makeTempDir("yansilu-browser-e2e-template-legacy-vault-"), "vault");

  await openSettingsModule(page, "workspace");
  await waitFor(async () => {
    const currentVaultPath = String(await page.locator("#settingsVaultPath").inputValue() || "").trim();
    assert.equal(path.resolve(currentVaultPath), path.resolve(vaultPath));
  }, 10000);

  await openSettingsModule(page, "templates");
  await waitFor(async () => {
    assert.match(await page.locator("#settingsPermanentTemplateEditor").inputValue(), /这是旧版全局永久模板。/);
    assert.match(await page.locator("#settingsLiteratureTemplateEditor").inputValue(), /这是旧版全文献模板。/);
  }, 5000);

  const migratedStorage = await page.evaluate(() => {
    const keys = Object.keys(window.localStorage);
    const scopedPermanentKey = keys.find((key) => key.startsWith("yansilu:settings:note-template:permanent:") && !key.endsWith(":history")) || "";
    const scopedLiteratureKey = keys.find((key) => key.startsWith("yansilu:settings:note-template:literature:") && !key.endsWith(":history")) || "";
    return {
      legacyPermanent: window.localStorage.getItem("yansilu:settings:note-template:permanent"),
      legacyLiterature: window.localStorage.getItem("yansilu:settings:note-template:literature"),
      scopedPermanentKey,
      scopedPermanentValue: scopedPermanentKey ? window.localStorage.getItem(scopedPermanentKey) : "",
      scopedLiteratureKey,
      scopedLiteratureValue: scopedLiteratureKey ? window.localStorage.getItem(scopedLiteratureKey) : ""
    };
  });

  assert.match(String(migratedStorage.legacyPermanent || ""), /这是旧版全局永久模板。/);
  assert.match(String(migratedStorage.legacyLiterature || ""), /这是旧版全文献模板。/);
  assert.match(String(migratedStorage.scopedPermanentKey || ""), /yansilu:settings:note-template:permanent:/);
  assert.match(String(migratedStorage.scopedPermanentValue || ""), /这是旧版全局永久模板。/);
  assert.match(String(migratedStorage.scopedLiteratureKey || ""), /yansilu:settings:note-template:literature:/);
  assert.match(String(migratedStorage.scopedLiteratureValue || ""), /这是旧版全文献模板。/);

  await openSettingsModule(page, "workspace");
  await page.locator("#settingsVaultPath").fill(nextVaultPath);
  await page.locator("#settingsSwitchVault").click();
  await waitFor(async () => {
    const currentVaultPath = String(await page.locator("#settingsVaultPath").inputValue() || "").trim();
    assert.equal(path.resolve(currentVaultPath), path.resolve(nextVaultPath));
  }, 10000);

  await openSettingsModule(page, "templates");
  await waitFor(async () => {
    assert.match(await page.locator("#settingsPermanentTemplateEditor").inputValue(), /这是旧版全局永久模板。/);
    assert.match(await page.locator("#settingsLiteratureTemplateEditor").inputValue(), /这是旧版全文献模板。/);
  }, 5000);
});

test("prototype settings saved literature and permanent templates drive later new notes in the same vault", async (t) => {
  if (process.env.RUN_BROWSER_E2E !== "1") {
    t.skip("Set RUN_BROWSER_E2E=1 to enable browser e2e in local runs.");
    return;
  }

  const playwright = await optionalPlaywright(t);
  if (!playwright) return;

  const stack = await startPrototypeStack(t, playwright);
  if (!stack) return;
  const { page } = stack;
  const permanentTemplate = `# {{title}}

## 核心观点

这是新的永久模板起手句。

## 相关笔记

- [[模板测试]]
`;
  const literatureTemplate = `# {{title}}

## 引用信息

- 标题：模板来源

## 原文

原文占位

## 转述

这是新的文献模板起手句。
`;

  await openSettingsModule(page, "workspace");
  await waitFor(async () => {
    const currentVaultPath = String(await page.locator("#settingsVaultPath").inputValue() || "").trim();
    assert.ok(currentVaultPath.length > 0);
  }, 10000);

  await openSettingsModule(page, "templates");
  await page.locator("#settingsPermanentTemplateEditor").fill(permanentTemplate);
  await page.locator("#settingsSavePermanentTemplate").click();
  assert.match(
    String(
      await page.evaluate(
        () =>
          Object.entries(window.localStorage)
            .filter(([key]) => key.includes("yansilu:settings:note-template:permanent"))
            .map(([, value]) => value)
            .join("\n")
      )
    ),
    /这是新的永久模板起手句。/
  );

  await page.locator("#settingsLiteratureTemplateEditor").fill(literatureTemplate);
  await page.locator("#settingsSaveLiteratureTemplate").click();
  assert.match(
    String(
      await page.evaluate(
        () =>
          Object.entries(window.localStorage)
            .filter(([key]) => key.includes("yansilu:settings:note-template:literature"))
            .map(([, value]) => value)
            .join("\n")
      )
    ),
    /这是新的文献模板起手句。/
  );

  await page.locator('[data-action="quick-original"]').click();
  await page.locator("#btnNewNote").click();
  await waitFor(async () => {
    const value = await page.locator("#editorBody").inputValue();
    assert.match(value, /这是新的永久模板起手句。/);
    assert.match(value, /- \[\[模板测试\]\]/);
  }, 5000);
  await ensureSourceMode(page);
  await waitForEditableNoteSurface(page);
  await page.evaluate(() => {
    const editor = window.__prototypeEditor;
    editor?.setEditorValue?.("# 已有永久笔记\n\n这是新的永久模板起手句。\n\n## 相关笔记\n\n- [[模板测试]]");
    editor?.handleEditorInput?.();
  });
  await waitFor(async () => {
    const value = await page.locator("#editorBody").inputValue();
    assert.match(value, /^# 已有永久笔记/m);
  }, 5000);

  await page.locator("#btnNewNote").click();
  await waitFor(async () => {
    const value = await page.locator("#editorBody").inputValue();
    assert.match(value, /这是新的永久模板起手句。/);
    assert.match(value, /- \[\[模板测试\]\]/);
  }, 5000);

  await page.locator('[data-action="quick-literature"]').click();
  await page.locator("#btnNewNote").click();
  await waitFor(async () => {
    const value = await page.locator("#editorBody").inputValue();
    assert.match(value, /这是新的文献模板起手句。/);
    assert.match(value, /原文占位/);
  }, 5000);
});

test("prototype note templates stay scoped to the active vault and old untitled placeholders stay reusable", async (t) => {
  if (process.env.RUN_BROWSER_E2E !== "1") {
    t.skip("Set RUN_BROWSER_E2E=1 to enable browser e2e in local runs.");
    return;
  }

  const playwright = await optionalPlaywright(t);
  if (!playwright) return;

  const stack = await startPrototypeStack(t, playwright);
  if (!stack) return;
  const { page, apiBase, vaultPath } = stack;
  const nextVaultPath = path.join(await makeTempDir("yansilu-browser-e2e-template-scope-vault-"), "vault");
  const customPermanentTemplate = `# {{title}}

## 核心观点

这是按当前 Vault 定义的永久模板。
`;

  await page.locator('[data-action="quick-original"]').click();
  await page.locator("#btnNewNote").click();
  await waitFor(async () => {
    const selectedFileId = await page.evaluate(() => String(window.__prototypeState?.selectedFileId || "").trim());
    assert.ok(selectedFileId);
  }, 5000);
  const originalUntitledNoteId = await page.evaluate(() => String(window.__prototypeState?.selectedFileId || "").trim());
  assert.ok(originalUntitledNoteId);

  await openSettingsModule(page, "workspace");
  await waitFor(async () => {
    const currentVaultPath = String(await page.locator("#settingsVaultPath").inputValue() || "").trim();
    assert.equal(path.resolve(currentVaultPath), path.resolve(vaultPath));
  }, 10000);
  await openSettingsModule(page, "templates");
  await page.evaluate((value) => {
    const editor = document.querySelector("#settingsPermanentTemplateEditor");
    if (!editor) throw new Error("missing permanent template editor");
    editor.value = value;
    editor.dispatchEvent(new Event("input", { bubbles: true }));
  }, customPermanentTemplate);
  await page.locator("#settingsSavePermanentTemplate").click();

  await page.locator('[data-action="quick-original"]').click();
  await page.locator("#btnNewNote").click();
  await waitFor(async () => {
    const selectedFileId = await page.evaluate(() => String(window.__prototypeState?.selectedFileId || "").trim());
    assert.ok(selectedFileId);
  }, 5000);
  const reopenedUntitledNoteId = await page.evaluate(() => String(window.__prototypeState?.selectedFileId || "").trim());
  assert.equal(reopenedUntitledNoteId, originalUntitledNoteId);
  await waitFor(async () => {
    const value = await page.locator("#editorBody").inputValue();
    assert.match(value, /这是按当前 Vault 定义的永久模板。/);
  }, 5000);

  await openSettingsModule(page, "workspace");
  await page.locator("#settingsVaultPath").fill(nextVaultPath);
  await page.locator("#settingsSwitchVault").click();
  await waitFor(async () => {
    const health = await fetchJson(apiBase, "/health");
    assert.equal(health.status, 200);
    assert.equal(path.resolve(health.json.vaultPath), path.resolve(nextVaultPath));
  }, 10000);

  await page.locator('[data-action="quick-original"]').click();
  await page.locator("#btnNewNote").click();
  await waitFor(async () => {
    const value = await page.locator("#editorBody").inputValue();
    assert.doesNotMatch(value, /这是按当前 Vault 定义的永久模板。/);
    assert.match(value, /## 核心观点/);
  }, 5000);
});

test("prototype source-generated permanent notes adopt the current permanent template", async (t) => {
  if (process.env.RUN_BROWSER_E2E !== "1") {
    t.skip("Set RUN_BROWSER_E2E=1 to enable browser e2e in local runs.");
    return;
  }

  const playwright = await optionalPlaywright(t);
  if (!playwright) return;

  const stack = await startPrototypeStack(t, playwright);
  if (!stack) return;
  const { page, apiBase } = stack;
  const permanentTemplate = `# {{title}}

这是一条来自模板前言的提醒。

## 自定义问题

这个 section 应该跟着模板一起进入来源生成的永久笔记。
`;
  const literatureBody = `# Source Driven Literature

## 引用信息

- 标题：Source Driven Literature

## 原文

Original evidence block.

## 转述

这里已经有一段用户转述。

## 判断种子

把转述压成一句可辩护的判断。
`;
  const createdLiterature = await postJson(apiBase, "/api/v1/notes", {
    directoryId: "dir_literature_default",
    body: literatureBody
  });
  assert.equal(createdLiterature.status, 201, JSON.stringify(createdLiterature.json));
  const literatureNoteId = createdLiterature.json.item.id;

  await openSettingsModule(page, "templates");
  await page.locator("#settingsPermanentTemplateEditor").fill(permanentTemplate);
  await page.locator("#settingsSavePermanentTemplate").click();

  await page.locator('[data-action="quick-literature"]').click();
  await page.locator('.explorer-item[data-kind="folder"][data-id="dir_literature_default"]').click();
  await page.locator(`.explorer-item[data-kind="file"][data-id="${literatureNoteId}"]`).click();
  await waitFor(async () => {
    assert.equal(await page.locator(".tab.active .tab-title").textContent(), "Source Driven Literature");
    assert.equal(await page.locator("#btnRecordPermanent").isVisible(), true);
  }, 7000);

  await page.locator("#btnRecordPermanent").click();
  await page.locator("#permanentNoteModal").waitFor();
  await waitFor(async () => {
    assert.equal(await page.locator("#permanentNoteTargetFolder option").count() > 0, true);
  }, 5000);
  await page.locator("#permanentNoteCreate").click();
  await page.locator("#permanentNoteModal").waitFor({ state: "hidden" });

  await waitFor(async () => {
    const value = await page.locator("#editorBody").inputValue();
    assert.equal(await page.locator("#permanentWorkspace").count(), 0);
    assert.equal(await page.locator("#markdownSplit").isVisible(), true);
    assert.match(value, /这是一条来自模板前言的提醒。/);
    assert.match(value, /## 自定义问题/);
    assert.match(value, /这个 section 应该跟着模板一起进入来源生成的永久笔记。/);
    assert.match(value, /## 来源生成提示/);
    assert.match(value, /### 核心观点/);
    assert.match(value, /把转述压成一句可辩护的判断。/);
    assert.match(value, /### 相关笔记/);
    assert.match(value, /来自文献笔记：\[\[Source Driven Literature\]\]/);
    assert.match(value, /把转述压成一句可辩护的判断。/);
    assert.doesNotMatch(value, /^## 核心观点$/m);
    assert.doesNotMatch(value, /^## 为什么成立$/m);
    assert.doesNotMatch(value, /^## 边界 \/ 反例$/m);
  }, 7000);
});

test("prototype browser flow creates a directory and persists notes inside it after reload", async (t) => {
  if (process.env.RUN_BROWSER_E2E !== "1") {
    t.skip("Set RUN_BROWSER_E2E=1 to enable browser e2e in local runs.");
    return;
  }

  const playwright = await optionalPlaywright(t);
  if (!playwright) return;

  const stack = await startPrototypeStack(t, playwright);
  if (!stack) return;
  const { apiBase, page, vaultPath } = stack;

  const targetFsPath = path.join(vaultPath, "notes", "original", "browser-e2e-folder");

  await page.locator("#btnOpenNewBoxDialog").click();
  await page.locator("#modalBoxName").fill("Browser E2E Folder");
  await page.locator("#modalFsPath").fill(targetFsPath);
  await page.locator("#modalCreate").click();
  await page.waitForSelector('.explorer-item[data-kind="folder"] >> text=Browser E2E Folder');

  const editorValueBeforeSave = await createAndSaveNoteViaEditor(
    page,
    "# Directory scoped note\n\nThis note belongs to the newly created directory."
  );
  assert.match(editorValueBeforeSave, /Directory scoped note/);

  const directories = await fetchJson(apiBase, "/api/v1/directories?includeHidden=true");
  assert.equal(directories.status, 200);
  const createdDirectory = directories.json.items.find((item) => item.title === "Browser E2E Folder");
  assert.ok(createdDirectory, JSON.stringify(directories.json.items, null, 2));

  const notes = await waitFor(async () => {
    const result = await fetchJson(apiBase, `/api/v1/directories/${encodeURIComponent(createdDirectory.id)}/notes`);
    assert.equal(result.status, 200);
    assert.equal(result.json.total, 1);
    assert.equal(result.json.items[0].title, "Directory scoped note");
    return result;
  }, 7000);

  await page.reload({ waitUntil: "networkidle" });
  await page.locator('.explorer-item[data-kind="folder"]', { hasText: "Browser E2E Folder" }).click();
  await waitFor(async () => {
    const visibleCount = await page.locator('.explorer-item[data-kind="file"]', { hasText: "Directory scoped note" }).count();
    assert.equal(visibleCount, 1);
  }, 7000);
  await page.locator('.explorer-item[data-kind="file"]', { hasText: "Directory scoped note" }).click();
  await page.waitForFunction(() => document.querySelector("#editorBody")?.value?.includes("Directory scoped note"));

  const note = await fetchJson(apiBase, `/api/v1/notes/${encodeURIComponent(notes.json.items[0].id)}`);
  assert.equal(note.status, 200);
  assert.equal(note.json.item.directoryId, createdDirectory.id);
  assert.match(note.json.item.body, /newly created directory/);
});

test("prototype import panel previews and confirms realistic Obsidian import", async (t) => {
  if (process.env.RUN_BROWSER_E2E !== "1") {
    t.skip("Set RUN_BROWSER_E2E=1 to enable browser e2e in local runs.");
    return;
  }

  const playwright = await optionalPlaywright(t);
  if (!playwright) return;

  const stack = await startPrototypeStack(t, playwright);
  if (!stack) return;
  const { apiBase, page } = stack;

  const fixturePath = path.join(REPO_ROOT, "tests", "fixtures", "imports", "obsidian-realistic-vault");

  await openImportsModule(page);
  await page.fill("#importPath", fixturePath);
  await page.fill("#importPayload", "");
  await page.fill("#importOptions", JSON.stringify({ detectWikilinks: true }));
  await page.click("#btnImportPreview");

  await page.waitForFunction(() => {
    const text = document.querySelector("#importResult")?.textContent || "";
    return text.includes('"stage": "preview"') && text.includes("中文阅读卡片");
  });
  await page.locator("#importOperationResultModal:not(.hidden)").waitFor();
  await page.locator('#importResult .result-card[data-result-stage="preview"]').waitFor();

  const previewResultText = await page.locator("#importResult").textContent();
  assert.match(previewResultText || "", /来源卡片/);
  assert.match(previewResultText || "", /文献笔记/);
  assert.match(previewResultText || "", /永久笔记/);
  assert.match(previewResultText || "", /中文阅读卡片/);
  assert.match(previewResultText || "", /"importRecordId":\s*"/);
  const importRecordId = await page.inputValue("#importRecordId");
  assert.ok(importRecordId.startsWith("imp_"));

  await page.click("#btnCloseImportOperationResult");
  await page.click("#btnImportConfirm");
  await page.waitForFunction(() => {
    const text = document.querySelector("#importResult")?.textContent || "";
    return text.includes('"stage": "confirm"') && text.includes('"status": "completed"');
  });
  await page.locator("#importOperationResultModal:not(.hidden)").waitFor();
  await page.locator('#importResult .result-card[data-result-stage="confirm"]').waitFor();

  const confirmResultText = await page.locator("#importResult").textContent();
  assert.match(confirmResultText || "", /"sources":\s*2/);
  assert.match(confirmResultText || "", /"literatureNotes":\s*2/);
  assert.match(confirmResultText || "", /"permanentNotes":\s*0/);
  assert.match(confirmResultText || "", /"selectedCandidates":\s*4/);

  const importedLiteratureNotes = await waitFor(async () => {
    const result = await fetchJson(apiBase, "/api/v1/directories/dir_literature_default/notes");
    assert.equal(result.status, 200);
    assert.equal(result.json.total, 2);
    return result;
  }, 7000);
  const importedPermanentNotes = await waitFor(async () => {
    const result = await fetchJson(apiBase, "/api/v1/directories/dir_original_default/notes");
    assert.equal(result.status, 200);
    assert.equal(result.json.total, 0);
    return result;
  }, 7000);

  assert.ok(importedLiteratureNotes.json.items.some((item) => item.title === "中文阅读卡片"));
  assert.ok(importedLiteratureNotes.json.items.some((item) => item.title === "Spacing Note"));
  assert.equal(importedPermanentNotes.json.total, 0);

  await page.locator('[data-import-writing-action="open-literature-queue"]').waitFor();
  await page.locator('[data-import-writing-action="open-literature-queue"]').click();

  await waitFor(async () => {
    await page.locator("#editorWorkspace:not(.hidden)").waitFor({ timeout: 500 });
    const statusText = await currentStatusText(page);
    const editorBody = await page.locator("#editorBody").inputValue();
    assert.ok(String(statusText || "").trim().length > 0);
    assert.match(String(editorBody || ""), /^# /);
  }, 10000);
});

test("prototype import panel keeps unsupported-encoding previews reviewable but not confirmable", async (t) => {
  if (process.env.RUN_BROWSER_E2E !== "1") {
    t.skip("Set RUN_BROWSER_E2E=1 to enable browser e2e in local runs.");
    return;
  }

  const playwright = await optionalPlaywright(t);
  if (!playwright) return;

  const stack = await startPrototypeStack(t, playwright);
  if (!stack) return;
  const { page } = stack;

  const importRoot = await makeTempDir("yansilu-browser-import-unsupported-");
  const cp1252Hex = "2d2d2d0a7469746c653a20436166e9206e6f74650a2d2d2d0a0a426f64790a";
  await fs.writeFile(path.join(importRoot, "cp1252.md"), Buffer.from(cp1252Hex, "hex"));

  await openImportsModule(page);
  await page.fill("#importPath", importRoot);
  await page.fill("#importPayload", "");
  await page.fill("#importOptions", "{}");
  await page.click("#btnImportPreview");

  await page.waitForFunction(() => {
    const text = document.querySelector("#importResult")?.textContent || "";
    return text.includes('"stage": "preview"') && text.includes("IMPORT_MARKDOWN_ENCODING_UNSUPPORTED");
  });
  await page.locator("#importOperationResultModal:not(.hidden)").waitFor();
  await page.locator('#importResult .result-card[data-result-stage="preview"]').waitFor();

  const previewResultText = await page.locator("#importResult").textContent();
  assert.match(String(previewResultText || ""), /IMPORT_MARKDOWN_ENCODING_UNSUPPORTED/);
  assert.match(String(previewResultText || ""), /把源文件转成 UTF-8/);
  assert.match(String(previewResultText || ""), /当前预览没有可导入内容/);

  await waitFor(async () => {
    assert.equal(await page.locator("#btnImportConfirm").isDisabled(), true);
    const label = await page.locator("#btnImportConfirm").textContent();
    assert.match(String(label || ""), /没有可导入候选/);
  }, 4000);
});

test("prototype export panel exports markdown files through real API", async (t) => {
  if (process.env.RUN_BROWSER_E2E !== "1") {
    t.skip("Set RUN_BROWSER_E2E=1 to enable browser e2e in local runs.");
    return;
  }

  const playwright = await optionalPlaywright(t);
  if (!playwright) return;

  const stack = await startPrototypeStack(t, playwright);
  if (!stack) return;
  const { apiBase, page, vaultPath } = stack;

  const createdNote = await postJson(apiBase, "/api/v1/notes", {
    directoryId: "dir_original_default",
    body: "# Export panel note\n\nThis note should be exported from the browser UI with a [resource file](../../assets/browser-export/asset.txt)."
  });
  assert.equal(createdNote.status, 201);
  await fs.mkdir(path.join(vaultPath, "assets", "browser-export"), { recursive: true });
  await fs.writeFile(path.join(vaultPath, "assets", "browser-export", "asset.txt"), "browser asset", "utf8");

  const exportTargetPath = await makeTempDir("yansilu-browser-export-target-");
  await openImportsModule(page);
  await page.click("#importWorkspaceTabExport");
  await page.locator("#exportCardMount:not([hidden])").waitFor();
  await page.fill("#exportTargetPath", exportTargetPath);
  await page.click("#btnExportMarkdown");

  await page.waitForFunction(() => {
    const text = document.querySelector("#exportResult")?.textContent || "";
    return text.includes('"stage": "export_markdown"') && text.includes('"assetFiles": 1');
  });
  await page.locator("#importOperationResultModal:not(.hidden)").waitFor();

  const exportResultText = await page.locator("#exportResult").textContent();
  assert.match(exportResultText || "", /"exportJobId":\s*"exp_/);
  assert.match(exportResultText || "", /"status":\s*"queued"/);
  assert.match(exportResultText || "", /"copiedBreakdown":/);
  assert.match(exportResultText || "", /"assetFiles":\s*1/);

  const exportedFiles = await listMarkdownFiles(exportTargetPath);
  assert.ok(exportedFiles.length >= 1, JSON.stringify(exportedFiles, null, 2));
  const exportedAsset = await fs.readFile(path.join(exportTargetPath, "assets", "browser-export", "asset.txt"), "utf8");
  assert.equal(exportedAsset, "browser asset");

  const exportedContents = await Promise.all(exportedFiles.map((file) => fs.readFile(file, "utf8")));
  const exportedContent = exportedContents.find((content) => content.includes("# Export panel note")) || "";
  assert.match(exportedContent, /# Export panel note/);
  assert.match(exportedContent, /exported from the browser UI/);
});

test("prototype writing panel creates project and draft scaffold through real API", async (t) => {
  if (process.env.RUN_BROWSER_E2E !== "1") {
    t.skip("Set RUN_BROWSER_E2E=1 to enable browser e2e in local runs.");
    return;
  }

  const playwright = await optionalPlaywright(t);
  if (!playwright) return;

  const stack = await startPrototypeStack(t, playwright);
  if (!stack) return;
  const { apiBase, page, vaultPath, webBase } = stack;

  await page.addInitScript(() => {
    window.__copiedTexts = [];
    window.__downloads = [];
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (text) => {
          window.__copiedTexts.push(String(text || ""));
        }
      }
    });
    const originalCreateObjectUrl = URL.createObjectURL.bind(URL);
    URL.createObjectURL = (blob) => {
      window.__downloads.push({ size: blob.size, type: blob.type });
      return originalCreateObjectUrl(blob);
    };
  });

  const writingDirectory = await postJson(apiBase, "/api/v1/directories", {
    title: "Writing UI Scope",
    parentDirectoryId: "dir_original_default",
    directoryType: "custom",
    fsPath: path.join(vaultPath, "notes", "original", "writing-ui-scope"),
    maxNotes: 500
  });
  assert.equal(writingDirectory.status, 201, JSON.stringify(writingDirectory.json));
  const writingDirectoryId = writingDirectory.json.item.id;

  const noteA = await createWritingReadyPermanentNote(apiBase, {
    directoryId: writingDirectoryId,
    title: "Writing UI claim",
    body: "# Writing UI claim\n\nThe writing panel should start from permanent notes.",
    thesis: "The writing panel should start from permanent notes.",
    threeLineSummary: [
      "Use permanent notes as the stable writing substrate.",
      "Keep writing-entry setup visible in the browser UI.",
      "Preserve note-level evidence inside the scaffold flow."
    ],
    boundaryOrCounterpoint: "The UI still depends on authorship confirmation and active status."
  });

  const noteB = await createWritingReadyPermanentNote(apiBase, {
    directoryId: writingDirectoryId,
    title: "Evidence UI map",
    body: "# Evidence UI map\n\nThe scaffold should retain an evidence map.",
    thesis: "The scaffold should retain an evidence map.",
    threeLineSummary: [
      "Browser-generated scaffolds need visible evidence anchors.",
      "The writing flow should keep note provenance inspectable.",
      "The scaffold should organize claims without flattening the source map."
    ],
    boundaryOrCounterpoint: "A scaffold is not the final draft and still needs human judgment."
  });
  const seededRelation = await postJson(apiBase, `/api/v1/notes/${encodeURIComponent(noteA.json.item.id)}/relations`, {
    toNoteId: noteB.json.item.id,
    relationType: "supports",
    rationale: "The evidence map supports the central writing claim and should appear in project scaffolding.",
    insightQuestion: "How should the scaffold keep claim-evidence links visible?",
    status: "confirmed"
  });
  assert.equal(seededRelation.status, 201, JSON.stringify(seededRelation.json));

  await page.goto(`${webBase}/prototype`, { waitUntil: "networkidle" });
  await page.locator('[data-action="quick-original"]').click();
  await page.locator(`.explorer-item[data-kind="folder"][data-id="${writingDirectoryId}"]`).click();
  await page.locator('.explorer-item[data-kind="file"]', { hasText: "Writing UI claim" }).waitFor();
  await page.locator('.explorer-item[data-kind="file"]', { hasText: "Evidence UI map" }).waitFor();
  await page.locator('.rail-btn[data-module="writing"]').click();
  await page.fill("#writingTitle", "Writing UI Project");
  await page.fill("#writingGoal", "Turn two permanent notes into a browser-generated scaffold.");
  await page.fill("#writingAudience", "Researchers");
  await page.fill("#writingTone", "clear");
  await page.fill("#writingVersionNote", "First scaffold note from browser flow.");
  await page.click("#btnWritingAddVisible");
  const targetBasketIds = [noteA.json.item.id, noteB.json.item.id];
  await page.waitForFunction(
    (ids) => {
      const basketIds = String(document.querySelector("#writingBasketNoteIds")?.value || "").split(/\s+/);
      return ids.every((id) => basketIds.includes(id));
    },
    targetBasketIds
  );
  const extraBasketIds = (await page.locator("#writingBasketNoteIds").inputValue())
    .split(/\s+/)
    .filter((id) => id && !targetBasketIds.includes(id));
  for (const noteId of extraBasketIds) {
    await page.locator(`#writingBasketList [data-writing-action="remove"][data-writing-note-id="${noteId}"]`).click();
  }
  await page.waitForFunction(
    (ids) => {
      const basketIds = String(document.querySelector("#writingBasketNoteIds")?.value || "")
        .split(/\s+/)
        .filter(Boolean);
      return basketIds.length === ids.length && ids.every((id) => basketIds.includes(id));
    },
    targetBasketIds
  );

  const basketText = await page.locator("#writingBasketList").textContent();
  assert.match(basketText || "", /Writing UI claim/);
  assert.match(basketText || "", /Evidence UI map/);

  await page.click("#btnWritingCreateProject");

  await page.waitForFunction(() => {
    const text = document.querySelector("#writingResult")?.textContent || "";
    return text.includes('"stage": "writing_project"') && text.includes('"writingProjectId": "wp_');
  });
  await page.locator('#writingResult .result-card[data-result-stage="writing_project"]').waitFor();

  const projectResultText = await page.locator("#writingResult").textContent();
  assert.match(projectResultText || "", /项目已创建|writing_project/);
  assert.match(projectResultText || "", /Writing UI claim/);
  assert.match(projectResultText || "", /Evidence UI map/);
  await waitFor(async () => {
    const statusStripText = await page.locator("#writingStatusStrip").textContent();
    assert.match(statusStripText || "", /相关笔记|可写主题|文章提纲|开始草稿/);
  }, 10000);

  await page.click("#btnWritingCreateScaffold");
  await page.locator('#writingResult .result-card[data-result-stage="draft_scaffold"]').waitFor();
  await page.waitForFunction(() => {
    const text = document.querySelector("#writingScaffoldPreview")?.textContent || "";
    return text.includes("文章提纲：ds_");
  });

  const scaffoldResultText = await page.locator("#writingResult").textContent();
  assert.match(scaffoldResultText || "", /"draftScaffoldId":\s*"ds_/);
  assert.match(scaffoldResultText || "", /Writing UI claim/);
  assert.match(scaffoldResultText || "", /Evidence UI map/);

  const scaffoldPreviewText = await page.locator("#writingScaffoldPreview").textContent();
  assert.ok(String(scaffoldPreviewText || "").trim().length > 0);
  assert.match(scaffoldPreviewText || "", /文章提纲：ds_/);
  assert.match(scaffoldPreviewText || "", /章节结构/);
  assert.match(scaffoldPreviewText || "", /待处理的反方与漏洞/);
  await waitFor(async () => {
    const statusStripText = await page.locator("#writingStatusStrip").textContent();
    assert.match(statusStripText || "", /相关笔记|可写主题|文章提纲|开始草稿/);
  }, 10000);

  await page.click("#btnWritingCopyScaffold");
  await page.waitForFunction(() => {
    const text = document.querySelector("#writingResult")?.textContent || "";
    return text.includes("writing_copy_scaffold");
  });
  const copiedTexts = await page.evaluate(() => window.__copiedTexts || []);
  assert.ok(copiedTexts.length >= 1);
  assert.match(copiedTexts.at(-1), /段落-证据对照表/);

  await page.click("#btnWritingExportScaffold");
  await page.waitForFunction(() => {
    const text = document.querySelector("#writingResult")?.textContent || "";
    return text.includes("writing_export_scaffold");
  });
  const exportMeta = await page.evaluate(() => window.__lastWritingExport__ || null);
  assert.ok(exportMeta);
  assert.match(exportMeta.fileName || "", /_scaffold\.md/);

  const firstScaffoldCardId = await page.locator('#writingScaffoldVersionsList [data-writing-scaffold-id]').first().getAttribute("data-writing-scaffold-id");
  await page.click("#btnWritingCreateScaffold");
  await page.waitForFunction((firstId) => {
    const cards = [...document.querySelectorAll("#writingScaffoldVersionsList [data-writing-scaffold-id]")];
    return cards.length >= 2 && cards.some((card) => card.getAttribute("data-writing-scaffold-id") !== firstId);
  }, firstScaffoldCardId);

  const scaffoldVersionText = await page.locator("#writingScaffoldVersionsList").textContent();
  assert.match(scaffoldVersionText || "", /ds_/);
  assert.match(scaffoldVersionText || "", /First scaffold note from browser flow/);

  await page.evaluate(() => {
    window.__promptResponse__ = "Edited scaffold note from browser flow.";
    window.prompt = () => window.__promptResponse__;
  });
  await page.locator('#writingScaffoldVersionsList [data-writing-scaffold-action="edit-note"]').first().click();
  await page.waitForFunction(() => {
    const text = document.querySelector("#statusText")?.textContent || "";
    return text.includes("已更新文章提纲版本说明");
  });
  const editedScaffoldVersionText = await page.locator("#writingScaffoldVersionsList").textContent();
  assert.match(editedScaffoldVersionText || "", /Edited scaffold note from browser flow/);

  await page.locator('#writingScaffoldVersionsList [data-writing-scaffold-action="open"]').nth(1).click();
  await page.waitForFunction((firstId) => {
    const summary = document.querySelector("#writingScaffoldPreview")?.textContent || "";
    return summary.includes(firstId);
  }, firstScaffoldCardId);

  await page.fill("#writingVersionNote", "Draft note saved from browser flow.");
  await page.click("#btnWritingSaveDraft");
  await page.waitForFunction(() => {
    const text = document.querySelector("#statusText")?.textContent || "";
    return text.trim().length > 0;
  });
  await page.waitForFunction(() => {
    const text = document.querySelector("#writingDraftVersionsList")?.textContent || "";
    return text.includes("v1");
  });

  const draftVersionsTextV1 = await page.locator("#writingDraftVersionsList").textContent();
  assert.match(draftVersionsTextV1 || "", /v1/);
  assert.match(draftVersionsTextV1 || "", /当前版本/);
  assert.match(draftVersionsTextV1 || "", /Draft note saved from browser flow/);

  await page.locator('.rail-btn[data-module="writing"].active').waitFor();
  const openDraftText = await page.locator("#btnWritingOpenDraft").textContent();
  assert.match(openDraftText || "", /打开当前草稿/);

  await page.waitForFunction(() => {
    const text = document.querySelector("#writingBasketSummary")?.textContent || "";
    return text.includes("当前阶段：");
  });

  const writingSummaryText = await page.locator("#writingBasketSummary").textContent();
  assert.match(writingSummaryText || "", /当前阶段：/);
  assert.ok(String(writingSummaryText || "").trim().length > 0);
  const scaffoldPreviewAfterDraft = await page.locator("#writingScaffoldPreview").textContent();
  assert.match(scaffoldPreviewAfterDraft || "", /下一步：打开当前草稿/);
  await page.waitForFunction(() => {
    const text = document.querySelector("#writingProjectsList")?.textContent || "";
    return text.includes("可写主题") && text.includes("Evidence UI map");
  });
  const projectsListText = await page.locator("#writingProjectsList").textContent();
  assert.match(projectsListText || "", /Evidence UI map/);
  assert.match(projectsListText || "", /可写主题|文章提纲|当前草稿/);

  await page.locator("#btnWritingOpenDraft").click({ force: true });
  await page.waitForFunction(() => {
    const text = document.querySelector("#statusText")?.textContent || "";
    return text.trim().length > 0;
  });
  const editorValue = await page.locator("#editorBody").inputValue();
  assert.match(editorValue, /# .*草稿/);
  assert.match(editorValue, /文章提纲：ds\\?_/);

  await page.locator('.rail-btn[data-module="writing"]').click();
  await page.waitForFunction(() => document.querySelector('.rail-btn[data-module="writing"]')?.classList.contains("active"));
  await page.fill("#writingVersionNote", "Second draft note saved from browser flow.");
  await page.click("#btnWritingSaveDraft");
  await page.waitForFunction(() => {
    const text = document.querySelector("#writingDraftVersionsList")?.textContent || "";
    return text.includes("v2");
  });
  const draftVersionsTextV2 = await page.locator("#writingDraftVersionsList").textContent();
  assert.match(draftVersionsTextV2 || "", /v2/);
  assert.match(draftVersionsTextV2 || "", /Second draft note saved from browser flow/);

  await page.evaluate(() => {
    window.__promptResponse__ = "Edited draft note from browser flow.";
    window.prompt = () => window.__promptResponse__;
  });
  await page.locator('#writingDraftVersionsList [data-writing-draft-action="edit-note"]').first().click();
  await page.waitForFunction(() => {
    const text = document.querySelector("#statusText")?.textContent || "";
    return text.includes("已更新草稿版本说明");
  });
  const editedDraftVersionsText = await page.locator("#writingDraftVersionsList").textContent();
  assert.match(editedDraftVersionsText || "", /Edited draft note from browser flow/);

  await page.locator('.rail-btn[data-module="writing"]').click();
  await page.waitForFunction(() => document.querySelector('.rail-btn[data-module="writing"]')?.classList.contains("active"));
  await page.locator("#btnWritingOpenDraft").click({ force: true });
  await page.waitForFunction(() => {
    const text = document.querySelector("#statusText")?.textContent || "";
    return text.trim().length > 0;
  });

  await page.locator('.rail-btn[data-module="writing"]').click();
  await page.waitForFunction(() => {
    const buttons = [...document.querySelectorAll('#writingDraftVersionsList [data-writing-draft-action="open"]')];
    return buttons.length >= 1 && buttons.every((button) => button instanceof HTMLElement && button.offsetParent !== null);
  });
  await page.locator('#writingDraftVersionsList [data-writing-draft-action="open"]').last().click();
  await page.waitForFunction(() => {
    const text = document.querySelector("#statusText")?.textContent || "";
    return text.trim().length > 0;
  });

  await page.locator('.rail-btn[data-module="writing"]').click();
  await page.waitForFunction(() => {
    const buttons = [...document.querySelectorAll('#writingDraftVersionsList [data-writing-draft-action="set-current"]')];
    return buttons.length >= 1 && buttons.every((button) => button instanceof HTMLElement && button.offsetParent !== null);
  });
  await page.locator('#writingDraftVersionsList [data-writing-draft-action="set-current"]').last().click();
  await page.waitForFunction(() => {
    const text = document.querySelector("#statusText")?.textContent || "";
    return text.trim().length > 0;
  });
  const reboundDraftVersionsText = await page.locator("#writingDraftVersionsList").textContent();
  assert.match(reboundDraftVersionsText || "", /v1/);
  assert.match(reboundDraftVersionsText || "", /当前版本/);

  await page.locator("#btnWritingOpenDraft").click({ force: true });
  await page.waitForFunction(() => {
    const text = document.querySelector("#statusText")?.textContent || "";
    return text.trim().length > 0;
  });
  const reboundEditorValue = await page.locator("#editorBody").inputValue();
  assert.match(reboundEditorValue, /# .*草稿/);
  assert.doesNotMatch(reboundEditorValue, /second scaffold/i);

  await page.locator('.rail-btn[data-module="writing"]').click();
  await page.locator('#writingProjectsList [data-writing-project-id] .writing-note-actions button').first().click();
  await page.waitForFunction(() => {
    const title = document.querySelector("#writingTitle")?.value || "";
    return title.includes("主题") && title.includes("Evidence UI map");
  });
  await waitFor(async () => {
    const statusStripText = await page.locator("#writingStatusStrip").textContent();
    assert.doesNotMatch(statusStripText || "", /读取失败/);
    assert.match(statusStripText || "", /主题|可写主题/);
    assert.match(statusStripText || "", /相关笔记|可写主题|文章提纲|开始草稿/);
  }, 10000);
});

test("paper workspace browser flow preserves draft, selection, failure, and permanent-note continuity across reload", async (t) => {
  if (process.env.RUN_BROWSER_E2E !== "1") {
    t.skip("Set RUN_BROWSER_E2E=1 to enable browser e2e in local runs.");
    return;
  }

  const playwright = await optionalPlaywright(t);
  if (!playwright) return;

  const stack = await startPrototypeStack(t, playwright);
  if (!stack) return;
  const { page, webBase } = stack;

  const paperId = "paper_browser_workspace";
  const savedParaphrase = "My takeaway is that retrieval effort improves later access to the idea.";
  const savedRelation = "This supports turning reading work into durable notes.";
  const refreshedKickoffRelation = "Updated relation after local kickoff started.";
  const savedBoundary = "Only when the study task is comparable.";
  const unsavedParaphrase = "An unsaved draft should survive candidate switches.";
  const unsavedRelation = "This is still in progress and should come back.";
  const unsavedBoundary = "This draft is not ready to save yet.";
  let firstPermanentCandidateId = "";

    await openPaperWorkspace(page, webBase);
    await waitFor(async () => {
      const statusText = await currentPaperWorkspaceStatusText(page);
      assert.match(String(statusText || ""), /已连接 API/);
    }, 4000);

    await page.fill("#paperIdInput", paperId);
    await page.fill("#paperTitleInput", "Browser Paper Workspace");
    await page.click("#btnCreatePaperWorkspace");
    await waitFor(async () => {
      const text = await page.locator(".paper-result-json").textContent();
      assert.match(text || "", /"stage": "create_workspace"/);
      const statusText = await currentPaperWorkspaceStatusText(page);
      assert.match(String(statusText || ""), /论文工作台已创建/);
      assert.match(String(statusText || ""), /粘贴 NotebookLM 输出/);
    }, 6000);
    await waitFor(async () => {
      assert.notEqual(await page.locator("#btnSaveTranslation").getAttribute("disabled"), null);
      const translationStepText = await page.locator(".paper-grid .paper-card.paper-span-2").nth(0).textContent();
      assert.match(String(translationStepText || ""), /还没有候选/);
      assert.match(String(translationStepText || ""), /这里会先生成 literature 候选/);
      assert.match(String(translationStepText || ""), /尚未选择候选/);
      assert.match(String(translationStepText || ""), /先从左侧选一条候选/);
    }, 4000);

    await openPaperWorkspace(page, webBase);
    await page.fill("#paperIdInput", paperId);
    await page.click("#btnLoadPaperWorkspace");
    await waitFor(async () => {
      const text = await page.locator(".paper-result-json").textContent();
      assert.match(text || "", /"stage": "load_workspace"/);
      const statusText = await currentPaperWorkspaceStatusText(page);
      assert.match(String(statusText || ""), /论文工作台已读取/);
      assert.match(String(statusText || ""), /粘贴 NotebookLM 输出/);
    }, 6000);
    await waitFor(async () => {
      assert.equal(await page.locator(".paper-candidate").count(), 0);
      const translationStepText = await page.locator(".paper-grid .paper-card.paper-span-2").nth(0).textContent();
      assert.match(String(translationStepText || ""), /还没有候选/);
      assert.match(String(translationStepText || ""), /这里会先生成 literature 候选/);
    }, 4000);

  await page.fill(
    "#notebookSummaryInput",
    "Claim: retrieval practice improves retention.\n\nLimitation: sample size was small."
  );
    await page.click("#btnAddNotebookDraft");
    await waitFor(async () => {
      assert.equal(await page.locator(".paper-candidate").count(), 2);
      const statusText = await currentPaperWorkspaceStatusText(page);
      assert.match(String(statusText || ""), /NotebookLM 内容已转成 literature 候选/);
      assert.match(String(statusText || ""), /已选择候选|先用自己的话完成转述并保存/);
    }, 6000);

  const permanentCandidateButton = page.locator("#btnCreatePermanentCandidate");
  await waitFor(async () => {
    assert.notEqual(await permanentCandidateButton.getAttribute("disabled"), null);
    assert.match(String((await page.locator("[data-paper-candidate-id]").nth(0).getAttribute("class")) || ""), /is-active/);
    assert.doesNotMatch(String((await page.locator("[data-paper-candidate-id]").nth(1).getAttribute("class")) || ""), /is-active/);
      assert.equal(await page.locator("#translationParaphraseInput").inputValue(), "");
      assert.equal(await page.locator("#translationRelationInput").inputValue(), "");
      assert.equal(await page.locator("#translationBoundaryInput").inputValue(), "");
      assert.match(String((await permanentCandidateButton.textContent()) || ""), /先保存转述/);
      const translationStepText = await page.locator(".paper-grid .paper-card.paper-span-2").nth(0).textContent();
      assert.match(String(translationStepText || ""), /先保存这条候选的用户转述，再进入永久笔记候选/);
      assert.match(String(translationStepText || ""), /关系和边界信息也会一起恢复/);
      assert.match(String((await page.locator("[data-paper-draft-continuity]").textContent()) || ""), /先保存这条转述，再继续写 draft/);
      const permanentStepText = await page.locator(".paper-grid .paper-card.paper-span-2").nth(1).textContent();
      assert.match(String(permanentStepText || ""), /当前这条候选只有本地未保存的转述草稿/);
      assert.match(String(permanentStepText || ""), /先保存这条转述，再进入永久笔记候选或继续写 draft/);
  }, 4000);

  await page.fill("#translationParaphraseInput", savedParaphrase);
  await waitFor(async () => {
    assert.notEqual(await permanentCandidateButton.getAttribute("disabled"), null);
    const translationStepText = await page.locator(".paper-grid .paper-card.paper-span-2").nth(0).textContent();
    assert.match(String(translationStepText || ""), /已恢复这条候选的本地未保存转述草稿/);
    assert.match(String(translationStepText || ""), /可以继续修改后再保存/);
  }, 4000);

    await page.click("#btnSaveTranslation");
    await waitFor(async () => {
      const text = await page.locator(".paper-result-json").textContent();
      assert.match(text || "", /"stage": "save_translation"/);
      const statusText = await currentPaperWorkspaceStatusText(page);
      assert.match(String(statusText || ""), /用户转述已保存/);
      assert.match(String(statusText || ""), /relation 和 boundary|支撑下一步/);
      assert.match(String((await page.locator(".paper-status").getAttribute("class")) || ""), /paper-status-warn/);
    }, 6000);
    await waitFor(async () => {
      assert.notEqual(await permanentCandidateButton.getAttribute("disabled"), null);
      assert.match(String((await permanentCandidateButton.textContent()) || ""), /先补 relation \/ boundary/);
      const translationStepText = await page.locator(".paper-grid .paper-card.paper-span-2").nth(0).textContent();
      assert.match(String(translationStepText || ""), /relation 和 boundary|支撑下一步/);
      assert.match(String((await page.locator("[data-paper-draft-continuity]").textContent()) || ""), /relation 和 boundary .*继续写 draft/);
      const permanentStepText = await page.locator(".paper-grid .paper-card.paper-span-2").nth(1).textContent();
      assert.match(String(permanentStepText || ""), /relation 和 boundary 还不足以支撑 Step 4/);
      assert.match(String((await page.locator("#btnSaveTranslation").textContent()) || ""), /已保存转述/);
    }, 4000);

  await page.fill("#translationRelationInput", savedRelation);
  await page.fill("#translationBoundaryInput", savedBoundary);
  await waitFor(async () => {
    assert.equal(await page.locator("#btnSaveTranslation").getAttribute("disabled"), null);
    assert.match(String((await page.locator("#btnSaveTranslation").textContent()) || ""), /更新转述/);
    assert.notEqual(await permanentCandidateButton.getAttribute("disabled"), null);
    assert.match(String((await permanentCandidateButton.textContent()) || ""), /先更新转述/);
  }, 4000);

    await page.click("#btnSaveTranslation");
    await waitFor(async () => {
      const text = await page.locator(".paper-result-json").textContent();
      assert.match(text || "", /"stage": "save_translation"/);
    }, 6000);
    await waitFor(async () => {
      assert.equal(await permanentCandidateButton.getAttribute("disabled"), null);
      const permanentStepText = await page.locator(".paper-grid .paper-card.paper-span-2").nth(1).textContent();
      assert.match(String(permanentStepText || ""), /还没有永久笔记候选/);
      assert.match(String(permanentStepText || ""), /先在 Step 3 保存转述并生成候选/);
      assert.match(String(permanentStepText || ""), /保存转述后，可以为当前候选生成永久笔记候选/);
      assert.match(String((await page.locator("[data-paper-draft-continuity]").textContent()) || ""), /具备继续写 draft 的最小条件/);
      assert.match(String((await page.locator("[data-paper-draft-brief-step-four]").textContent()) || ""), /Step 4: 尚未生成永久笔记候选/);
      assert.match(
        String((await page.locator("[data-paper-draft-brief-next-action]").textContent()) || ""),
        /Next action: .*具备继续写 draft 的最小条件/
      );
      assert.equal(await page.locator("#btnCopyDraftBrief").getAttribute("disabled"), null);
      assert.match(String((await page.locator("#btnCopyDraftBrief").textContent()) || ""), /复制 brief，继续写 draft/);
      assert.equal(await page.locator("#confirmAuthorshipInput").isChecked(), false);
      assert.notEqual(await page.locator("#btnSavePermanentNote").getAttribute("disabled"), null);
      assert.match(String((await page.locator("#btnSavePermanentNote").textContent()) || ""), /确认保存为永久笔记/);
    }, 4000);

    await page.click("#btnCopyDraftBrief");
    await waitFor(async () => {
      const statusText = await currentPaperWorkspaceStatusText(page);
      assert.match(String(statusText || ""), /已复制 draft brief/);
      assert.match(String(statusText || ""), /当前链路：Step 4: 尚未生成永久笔记候选/);
      assert.match(String(statusText || ""), /下一步：.*具备继续写 draft 的最小条件/);
      assert.match(
        String((await page.locator("[data-paper-draft-brief-copy]").textContent()) || ""),
        /最近一次已复制。下一步：.*具备继续写 draft 的最小条件/
      );
      const copiedText = await page.evaluate(
        () => window.__paperWorkspaceLastDraftBrief || (Array.isArray(window.__copiedTexts) ? window.__copiedTexts.at(-1) : "")
      );
      assert.match(String(copiedText || ""), /# Draft brief:/);
      assert.match(String(copiedText || ""), /## Relation to question/);
      assert.match(String(copiedText || ""), /This supports turning reading work into durable notes\./);
    }, 4000);

    await page.click("#btnStartDraftKickoff");
    await waitFor(async () => {
      const statusText = await currentPaperWorkspaceStatusText(page);
      assert.match(String(statusText || ""), /已载入本地 draft kickoff/);
      assert.match(String(statusText || ""), /当前链路：Step 4: 尚未生成永久笔记候选/);
      assert.match(String((await page.locator("#btnStartDraftKickoff").textContent()) || ""), /继续本地 draft/);
      assert.match(String((await page.locator("#draftKickoffTextarea").inputValue()) || ""), /# Draft brief:/);
      assert.match(
        String((await page.locator("[data-paper-draft-kickoff-note]").textContent()) || ""),
        /本地 draft kickoff 会跟着当前候选连续恢复/
      );
    }, 4000);

    await page.fill("#draftKickoffTextarea", "Local draft kickoff wording that should survive refresh.");
    await page.fill("#translationRelationInput", refreshedKickoffRelation);
    await waitFor(async () => {
      assert.equal(await page.locator("#btnSaveTranslation").getAttribute("disabled"), null);
      assert.match(String((await page.locator("#btnSaveTranslation").textContent()) || ""), /更新转述/);
    }, 4000);
    await page.click("#btnSaveTranslation");
    await waitFor(async () => {
      const text = await page.locator(".paper-result-json").textContent();
      assert.match(text || "", /"stage": "save_translation"/);
      assert.match(String((await page.locator("#btnStartDraftKickoff").textContent()) || ""), /载入新版 brief，更新本地 draft/);
      assert.match(
        String((await page.locator("[data-paper-draft-kickoff-note]").textContent()) || ""),
        /仍基于旧版转述/
      );
    }, 6000);
    await page.click("#btnStartDraftKickoff");
	    await waitFor(async () => {
	      const statusText = await currentPaperWorkspaceStatusText(page);
	      assert.match(String(statusText || ""), /已载入本地 draft kickoff/);
	      assert.match(String(statusText || ""), /当前链路：Step 4: 尚未生成永久笔记候选/);
	      assert.match(
	        String((await page.locator("#draftKickoffTextarea").inputValue()) || ""),
	        new RegExp(refreshedKickoffRelation.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      );
      assert.match(String((await page.locator("#draftKickoffPreviousTextarea").inputValue()) || ""), /Local draft kickoff wording that should survive refresh\./);
      assert.match(
        String((await page.locator("[data-paper-draft-kickoff-previous-note]").textContent()) || ""),
        /保留了上一版 kickoff/
      );
    }, 4000);
	    await page.click("#btnAdoptPreviousKickoff");
	    await waitFor(async () => {
	      const statusText = await currentPaperWorkspaceStatusText(page);
	      assert.match(String(statusText || ""), /已采用上一版 kickoff 写法/);
	      assert.match(String(statusText || ""), /Summary 1/);
	      assert.match(String(statusText || ""), /下一步：.*具备继续写 draft 的最小条件/);
	      assert.match(
	        String((await page.locator("#draftKickoffTextarea").inputValue()) || ""),
	        /Local draft kickoff wording that should survive refresh\./
      );
      assert.match(
        String((await page.locator("#draftKickoffPreviousTextarea").inputValue()) || ""),
        new RegExp(refreshedKickoffRelation.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      );
    }, 4000);

    await page.locator(".paper-candidate").nth(1).click();
    await waitFor(async () => {
      assert.equal(await page.locator("#translationParaphraseInput").inputValue(), "");
      assert.equal(await page.locator("#translationRelationInput").inputValue(), "");
      assert.equal(await page.locator("#translationBoundaryInput").inputValue(), "");
      assert.doesNotMatch(String((await page.locator("[data-paper-candidate-id]").nth(0).getAttribute("class")) || ""), /is-active/);
      assert.match(String((await page.locator("[data-paper-candidate-id]").nth(1).getAttribute("class")) || ""), /is-active/);
      assert.notEqual(await permanentCandidateButton.getAttribute("disabled"), null);
      const statusText = await currentPaperWorkspaceStatusText(page);
      assert.match(String(statusText || ""), /已选择候选/);
      assert.equal(await page.locator("#draftKickoffTextarea").count(), 0);
    }, 4000);

    await page.fill("#translationRelationInput", "This relation should survive a failed save.");
    await page.fill("#translationBoundaryInput", "This boundary should survive a failed save.");
    await waitFor(async () => {
      const statusText = await currentPaperWorkspaceStatusText(page);
      assert.match(String(statusText || ""), /先保存这条转述，再进入永久笔记候选/);
    }, 4000);
    await page.click("#btnSaveTranslation");
    await waitFor(async () => {
      const text = await page.locator(".paper-result-json").textContent();
      assert.match(text || "", /"stage": "error"/);
      assert.match(text || "", /PAPER_TRANSLATION_PARAPHRASE_REQUIRED/);
      const statusText = await currentPaperWorkspaceStatusText(page);
      assert.match(String(statusText || ""), /操作失败/);
      assert.equal(await page.locator("#translationParaphraseInput").inputValue(), "");
      assert.equal(await page.locator("#translationRelationInput").inputValue(), "This relation should survive a failed save.");
      assert.equal(await page.locator("#translationBoundaryInput").inputValue(), "This boundary should survive a failed save.");
      assert.doesNotMatch(String((await page.locator("[data-paper-candidate-id]").nth(0).getAttribute("class")) || ""), /is-active/);
      assert.match(String((await page.locator("[data-paper-candidate-id]").nth(1).getAttribute("class")) || ""), /is-active/);
      assert.equal(await page.locator("#btnSaveTranslation").getAttribute("disabled"), null);
      assert.match(String((await page.locator("#btnSaveTranslation").textContent()) || ""), /保存转述/);
      assert.notEqual(await permanentCandidateButton.getAttribute("disabled"), null);
      const translationStepText = await page.locator(".paper-grid .paper-card.paper-span-2").nth(0).textContent();
      assert.match(String(translationStepText || ""), /已恢复这条候选的本地未保存转述草稿/);
    }, 6000);

    await openPaperWorkspace(page, webBase);
    await page.fill("#paperIdInput", paperId);
    await page.click("#btnLoadPaperWorkspace");
    await waitFor(async () => {
      const text = await page.locator(".paper-result-json").textContent();
      assert.match(text || "", /"stage": "load_workspace"/);
    }, 6000);
    await waitFor(async () => {
      assert.equal(await page.locator("#translationParaphraseInput").inputValue(), "");
      assert.equal(await page.locator("#translationRelationInput").inputValue(), "This relation should survive a failed save.");
      assert.equal(await page.locator("#translationBoundaryInput").inputValue(), "This boundary should survive a failed save.");
      assert.doesNotMatch(String((await page.locator("[data-paper-candidate-id]").nth(0).getAttribute("class")) || ""), /is-active/);
      assert.match(String((await page.locator("[data-paper-candidate-id]").nth(1).getAttribute("class")) || ""), /is-active/);
      assert.equal(await page.locator("#btnSaveTranslation").getAttribute("disabled"), null);
      assert.match(String((await page.locator("#btnSaveTranslation").textContent()) || ""), /保存转述/);
      assert.notEqual(await permanentCandidateButton.getAttribute("disabled"), null);
      const translationStepText = await page.locator(".paper-grid .paper-card.paper-span-2").nth(0).textContent();
      assert.match(String(translationStepText || ""), /已恢复这条候选的本地未保存转述草稿/);
      assert.match(String(translationStepText || ""), /可以继续修改后再保存/);
    }, 6000);

    await page.fill("#translationRelationInput", unsavedRelation);
    await page.fill("#translationBoundaryInput", unsavedBoundary);

    await page.fill("#translationParaphraseInput", unsavedParaphrase);

  await page.locator(".paper-candidate").nth(0).click();
  await waitFor(async () => {
    assert.equal(await page.locator("#translationParaphraseInput").inputValue(), savedParaphrase);
    assert.equal(await page.locator("#translationRelationInput").inputValue(), refreshedKickoffRelation);
    assert.equal(await page.locator("#translationBoundaryInput").inputValue(), savedBoundary);
    assert.notEqual(await page.locator("#btnSaveTranslation").getAttribute("disabled"), null);
    assert.match(String((await page.locator("#btnSaveTranslation").textContent()) || ""), /已保存转述/);
    assert.equal(await permanentCandidateButton.getAttribute("disabled"), null);
    const translationStepText = await page.locator(".paper-grid .paper-card.paper-span-2").nth(0).textContent();
    assert.match(String(translationStepText || ""), /如果要继续写 draft/);
  }, 4000);

  await page.locator(".paper-candidate").nth(1).click();
  await waitFor(async () => {
    assert.equal(await page.locator("#translationParaphraseInput").inputValue(), unsavedParaphrase);
    assert.equal(await page.locator("#translationRelationInput").inputValue(), unsavedRelation);
    assert.equal(await page.locator("#translationBoundaryInput").inputValue(), unsavedBoundary);
    assert.doesNotMatch(String((await page.locator("[data-paper-candidate-id]").nth(0).getAttribute("class")) || ""), /is-active/);
    assert.match(String((await page.locator("[data-paper-candidate-id]").nth(1).getAttribute("class")) || ""), /is-active/);
    assert.notEqual(await permanentCandidateButton.getAttribute("disabled"), null);
    const translationStepText = await page.locator(".paper-grid .paper-card.paper-span-2").nth(0).textContent();
    assert.match(String(translationStepText || ""), /已恢复这条候选的本地未保存转述草稿/);
    assert.match(String(translationStepText || ""), /可以继续修改后再保存/);
  }, 4000);

  await waitFor(async () => {
    const statusText = await currentPaperWorkspaceStatusText(page);
    assert.match(String(statusText || ""), /先保存这条转述，再进入永久笔记候选/);
  }, 4000);

    await page.locator(".paper-candidate").nth(0).click();
    await waitFor(async () => {
      assert.equal(await page.locator("#translationParaphraseInput").inputValue(), savedParaphrase);
      assert.equal(await page.locator("#translationRelationInput").inputValue(), refreshedKickoffRelation);
      assert.equal(await page.locator("#translationBoundaryInput").inputValue(), savedBoundary);
      assert.match(String((await page.locator("[data-paper-candidate-id]").nth(0).getAttribute("class")) || ""), /is-active/);
      assert.doesNotMatch(String((await page.locator("[data-paper-candidate-id]").nth(1).getAttribute("class")) || ""), /is-active/);
      assert.equal(await permanentCandidateButton.getAttribute("disabled"), null);
      const statusText = await currentPaperWorkspaceStatusText(page);
      assert.match(String(statusText || ""), /这条候选的转述已就绪，但还没有生成对应的永久笔记候选/);
      const translationStepText = await page.locator(".paper-grid .paper-card.paper-span-2").nth(0).textContent();
      assert.match(String(translationStepText || ""), /这条候选已经保存过转述/);
      assert.equal(await page.locator("[data-paper-draft-brief-copy]").count(), 0);
      assert.match(
        String((await page.locator("#draftKickoffTextarea").inputValue()) || ""),
        /Local draft kickoff wording that should survive refresh\./
      );
      assert.match(
        String((await page.locator("#draftKickoffPreviousTextarea").inputValue()) || ""),
        new RegExp(refreshedKickoffRelation.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      );
      assert.match(String((await page.locator("#btnStartDraftKickoff").textContent()) || ""), /继续本地 draft/);
    }, 4000);

      await page.locator(".paper-candidate").nth(1).click();
      await waitFor(async () => {
        assert.equal(await page.locator("#translationParaphraseInput").inputValue(), unsavedParaphrase);
        assert.equal(await page.locator("#translationRelationInput").inputValue(), unsavedRelation);
        assert.equal(await page.locator("#translationBoundaryInput").inputValue(), unsavedBoundary);
        assert.notEqual(await permanentCandidateButton.getAttribute("disabled"), null);
        const translationStepText = await page.locator(".paper-grid .paper-card.paper-span-2").nth(0).textContent();
        assert.match(String(translationStepText || ""), /已恢复这条候选的本地未保存转述草稿/);
      }, 4000);

      await page.evaluate(
        ({ key, paperId }) => {
          window.localStorage.setItem(
            key,
            JSON.stringify({
              paperId,
              selectedCandidateId: "pwc_missing",
              selectedPermanentCandidateId: "",
              updatedAt: new Date().toISOString()
            })
          );
        },
        { key: paperWorkspaceSelectionStorageKey(paperId), paperId }
      );

      await openPaperWorkspace(page, webBase);
      await page.fill("#paperIdInput", paperId);
      await page.click("#btnLoadPaperWorkspace");
      await waitFor(async () => {
        const text = await page.locator(".paper-result-json").textContent();
        assert.match(text || "", /"stage": "load_workspace"/);
      }, 6000);
      await waitFor(async () => {
        assert.equal(await page.locator(".paper-candidate").count(), 2);
        assert.equal(await page.locator("#translationParaphraseInput").inputValue(), unsavedParaphrase);
        assert.equal(await page.locator("#translationRelationInput").inputValue(), unsavedRelation);
        assert.equal(await page.locator("#translationBoundaryInput").inputValue(), unsavedBoundary);
        assert.doesNotMatch(String((await page.locator("[data-paper-candidate-id]").nth(0).getAttribute("class")) || ""), /is-active/);
        assert.match(String((await page.locator("[data-paper-candidate-id]").nth(1).getAttribute("class")) || ""), /is-active/);
        assert.notEqual(await permanentCandidateButton.getAttribute("disabled"), null);
        const translationStepText = await page.locator(".paper-grid .paper-card.paper-span-2").nth(0).textContent();
        assert.match(String(translationStepText || ""), /已恢复这条候选的本地未保存转述草稿/);
      }, 6000);

          await page.locator(".paper-candidate").nth(0).click();
          await waitFor(async () => {
      assert.equal(await page.locator("#translationParaphraseInput").inputValue(), savedParaphrase);
      assert.equal(await page.locator("#translationRelationInput").inputValue(), refreshedKickoffRelation);
      assert.equal(await page.locator("#translationBoundaryInput").inputValue(), savedBoundary);
      assert.notEqual(await page.locator("#btnSaveTranslation").getAttribute("disabled"), null);
      assert.match(String((await page.locator("#btnSaveTranslation").textContent()) || ""), /已保存转述/);
      assert.equal(await permanentCandidateButton.getAttribute("disabled"), null);
      const statusText = await currentPaperWorkspaceStatusText(page);
      assert.match(String(statusText || ""), /这条候选的转述已就绪，但还没有生成对应的永久笔记候选/);
            const translationStepText = await page.locator(".paper-grid .paper-card.paper-span-2").nth(0).textContent();
            assert.match(String(translationStepText || ""), /这条候选已经保存过转述/);
            assert.match(String(translationStepText || ""), /也可以直接生成永久笔记候选/);
            assert.match(String(translationStepText || ""), /如果要继续写 draft/);
          }, 4000);

          await page.fill("#translationRelationInput", "Updated relation that has not been saved yet.");
          await waitFor(async () => {
            assert.equal(await page.locator("#btnSaveTranslation").getAttribute("disabled"), null);
            assert.match(String((await page.locator("#btnSaveTranslation").textContent()) || ""), /更新转述/);
            assert.match(String((await permanentCandidateButton.textContent()) || ""), /先更新转述/);
            assert.notEqual(await permanentCandidateButton.getAttribute("disabled"), null);
            const permanentStepText = await page.locator(".paper-grid .paper-card.paper-span-2").nth(1).textContent();
            assert.match(String(permanentStepText || ""), /当前 Step 3 还有未保存改动/);
            assert.match(String(permanentStepText || ""), /先更新这条转述，再生成对应的永久笔记候选/);
          }, 4000);
          await page.fill("#translationRelationInput", refreshedKickoffRelation);
          await waitFor(async () => {
            assert.equal(await permanentCandidateButton.getAttribute("disabled"), null);
          }, 4000);

          await page.click("#btnCreatePermanentCandidate");
          await waitFor(async () => {
            const text = await page.locator(".paper-result-json").textContent();
            assert.match(text || "", /"stage": "permanent_candidate"/);
            const parsed = JSON.parse(text || "{}");
            firstPermanentCandidateId = String(parsed?.permanentCandidate?.id || "").trim();
            assert.ok(firstPermanentCandidateId);
            assert.equal(await page.locator("[data-paper-permanent-candidate-id]").count(), 1);
            assert.match(String((await page.locator("[data-paper-permanent-candidate-id]").nth(0).getAttribute("class")) || ""), /is-active/);
            const previewText = await page.locator(".paper-permanent-preview").textContent();
            assert.match(String(previewText || ""), /My takeaway is that retrieval effort improves later access to the idea/);
            assert.doesNotMatch(String(previewText || ""), /已保存为：/);
            const statusText = await currentPaperWorkspaceStatusText(page);
            assert.match(String(statusText || ""), /永久笔记候选已生成/);
            assert.match(String(statusText || ""), /已对齐到这条候选的永久笔记候选/);
            assert.equal(await page.locator("#confirmAuthorshipInput").isChecked(), false);
            assert.equal(await page.locator("#permanentStatusInput").inputValue(), "draft");
            assert.equal(await page.locator("#btnSavePermanentNote").getAttribute("disabled"), null);
            assert.match(String((await page.locator("#btnSavePermanentNote").textContent()) || ""), /确认保存为永久笔记/);
          }, 6000);

        await page.locator(".paper-candidate").nth(1).click();
        await waitFor(async () => {
          assert.equal(await page.locator("#translationParaphraseInput").inputValue(), unsavedParaphrase);
          assert.equal(await page.locator("#translationRelationInput").inputValue(), unsavedRelation);
          assert.equal(await page.locator("#translationBoundaryInput").inputValue(), unsavedBoundary);
          assert.equal(await page.locator(".paper-permanent-preview").count(), 0);
          assert.notEqual(await page.locator("#btnSavePermanentNote").getAttribute("disabled"), null);
          const statusText = await currentPaperWorkspaceStatusText(page);
          assert.match(String(statusText || ""), /已恢复这条候选的本地未保存转述草稿/);
          const permanentStepText = await page.locator(".paper-grid .paper-card.paper-span-2").nth(1).textContent();
          assert.match(String(permanentStepText || ""), /当前这条候选只有本地未保存的转述草稿/);
          assert.match(String(permanentStepText || ""), /先保存这条转述，再进入永久笔记候选或继续写 draft/);
        }, 4000);
        await page.click("#btnSaveTranslation");
        await waitFor(async () => {
          const text = await page.locator(".paper-result-json").textContent();
          assert.match(text || "", /"stage": "save_translation"/);
          assert.equal(await page.locator("#btnCreatePermanentCandidate").getAttribute("disabled"), null);
        }, 6000);
        await page.click("#btnCreatePermanentCandidate");
        await waitFor(async () => {
          const text = await page.locator(".paper-result-json").textContent();
          assert.match(text || "", /"stage": "permanent_candidate"/);
          assert.equal(await page.locator("[data-paper-permanent-candidate-id]").count(), 2);
          assert.match(await page.locator(".paper-permanent-preview").textContent(), /An unsaved draft should survive candidate switches/);
        }, 6000);


            await page.locator("[data-paper-permanent-candidate-id]").nth(0).click();
            await waitFor(async () => {
              const previewText = await page.locator(".paper-permanent-preview").textContent();
              assert.match(String(previewText || ""), /My takeaway is that retrieval effort improves later access to the idea/);
              assert.doesNotMatch(String(previewText || ""), /已保存为：/);
              assert.equal(await page.locator("#translationParaphraseInput").inputValue(), savedParaphrase);
              assert.equal(await page.locator("#translationRelationInput").inputValue(), refreshedKickoffRelation);
              assert.equal(await page.locator("#translationBoundaryInput").inputValue(), savedBoundary);
              assert.match(String((await page.locator("[data-paper-candidate-id]").nth(0).getAttribute("class")) || ""), /is-active/);
              assert.doesNotMatch(String((await page.locator("[data-paper-candidate-id]").nth(1).getAttribute("class")) || ""), /is-active/);
              assert.match(String((await page.locator("[data-paper-permanent-candidate-id]").nth(0).getAttribute("class")) || ""), /is-active/);
              assert.doesNotMatch(String((await page.locator("[data-paper-permanent-candidate-id]").nth(1).getAttribute("class")) || ""), /is-active/);
              assert.match(String((await page.locator("#btnSavePermanentNote").textContent()) || ""), /确认保存为永久笔记/);
              const statusText = await currentPaperWorkspaceStatusText(page);
              assert.match(String(statusText || ""), /已对齐到这条候选的永久笔记候选/);
            }, 4000);
	            await page.locator("[data-paper-permanent-candidate-id]").nth(1).click();
	            await waitFor(async () => {
	              const previewText = await page.locator(".paper-permanent-preview").textContent();
	              assert.match(String(previewText || ""), /An unsaved draft should survive candidate switches/);
                assert.doesNotMatch(String(previewText || ""), /已保存为：/);
                assert.equal(await page.locator("#translationParaphraseInput").inputValue(), unsavedParaphrase);
                assert.equal(await page.locator("#translationRelationInput").inputValue(), unsavedRelation);
                assert.equal(await page.locator("#translationBoundaryInput").inputValue(), unsavedBoundary);
                assert.doesNotMatch(String((await page.locator("[data-paper-candidate-id]").nth(0).getAttribute("class")) || ""), /is-active/);
                assert.match(String((await page.locator("[data-paper-candidate-id]").nth(1).getAttribute("class")) || ""), /is-active/);
                assert.doesNotMatch(String((await page.locator("[data-paper-permanent-candidate-id]").nth(0).getAttribute("class")) || ""), /is-active/);
                assert.match(String((await page.locator("[data-paper-permanent-candidate-id]").nth(1).getAttribute("class")) || ""), /is-active/);
                assert.equal(await page.locator("#permanentStatusInput").inputValue(), "draft");
                assert.equal(await page.locator("#confirmAuthorshipInput").isChecked(), false);
                assert.equal(await page.locator("#btnSavePermanentNote").getAttribute("disabled"), null);
                assert.match(String((await page.locator("#btnSavePermanentNote").textContent()) || ""), /确认保存为永久笔记/);
	            }, 4000);

	              await page.selectOption("#permanentStatusInput", "draft");
	              await page.selectOption("#permanentStatusInput", "draft");
                await page.locator("[data-paper-permanent-candidate-id]").nth(0).click();
                await waitFor(async () => {
                  assert.equal(await page.locator("#permanentStatusInput").inputValue(), "draft");
                }, 4000);
                await page.locator("[data-paper-permanent-candidate-id]").nth(1).click();
                await waitFor(async () => {
                  assert.equal(await page.locator("#permanentStatusInput").inputValue(), "draft");
                }, 4000);
                await page.locator(".paper-candidate").nth(0).click();
                await waitFor(async () => {
                  const previewText = await page.locator(".paper-permanent-preview").textContent();
                  assert.match(String(previewText || ""), /My takeaway is that retrieval effort improves later access to the idea/);
                  assert.doesNotMatch(String(previewText || ""), /An unsaved draft should survive candidate switches/);
                  assert.equal(await page.locator("#permanentStatusInput").inputValue(), "draft");
                  assert.equal(await page.locator("#confirmAuthorshipInput").isChecked(), false);
                }, 4000);
                await page.locator(".paper-candidate").nth(1).click();
                await waitFor(async () => {
                  const previewText = await page.locator(".paper-permanent-preview").textContent();
                  assert.match(String(previewText || ""), /An unsaved draft should survive candidate switches/);
                  assert.doesNotMatch(String(previewText || ""), /My takeaway is that retrieval effort improves later access to the idea/);
                  assert.equal(await page.locator("#permanentStatusInput").inputValue(), "draft");
                  assert.equal(await page.locator("#confirmAuthorshipInput").isChecked(), false);
                }, 4000);

	            await page.click("#btnSavePermanentNote");
            await waitFor(async () => {
              const text = await page.locator(".paper-result-json").textContent();
              assert.match(text || "", /"stage": "error"/);
              assert.match(text || "", /PAPER_PERMANENT_NOTE_AUTHORSHIP_REQUIRED/);
              const statusText = await currentPaperWorkspaceStatusText(page);
              assert.match(String(statusText || ""), /操作失败/);
              const previewText = await page.locator(".paper-permanent-preview").textContent();
              assert.match(String(previewText || ""), /An unsaved draft should survive candidate switches/);
              assert.doesNotMatch(String(previewText || ""), /已保存为：/);
              assert.doesNotMatch(String((await page.locator("[data-paper-permanent-candidate-id]").nth(0).getAttribute("class")) || ""), /is-active/);
              assert.match(String((await page.locator("[data-paper-permanent-candidate-id]").nth(1).getAttribute("class")) || ""), /is-active/);
              assert.equal(await page.locator("#permanentStatusInput").inputValue(), "draft");
              assert.equal(await page.locator("#confirmAuthorshipInput").isChecked(), false);
              assert.equal(await page.locator("#btnSavePermanentNote").getAttribute("disabled"), null);
              assert.match(String((await page.locator("#btnSavePermanentNote").textContent()) || ""), /确认保存为永久笔记/);
            }, 6000);

            await openPaperWorkspace(page, webBase);
            await page.fill("#paperIdInput", paperId);
            await page.click("#btnLoadPaperWorkspace");
            await waitFor(async () => {
              const text = await page.locator(".paper-result-json").textContent();
              assert.match(text || "", /"stage": "load_workspace"/);
              assert.equal(await page.locator("[data-paper-permanent-candidate-id]").count(), 2);
              const statusText = await currentPaperWorkspaceStatusText(page);
              assert.match(String(statusText || ""), /已对齐到这条候选的永久笔记候选/);
            }, 6000);
            await waitFor(async () => {
              const previewText = await page.locator(".paper-permanent-preview").textContent();
              assert.match(String(previewText || ""), /An unsaved draft should survive candidate switches/);
              assert.doesNotMatch(String(previewText || ""), /My takeaway is that retrieval effort improves later access to the idea/);
              assert.doesNotMatch(String(previewText || ""), /已保存为：/);
              assert.doesNotMatch(String((await page.locator("[data-paper-permanent-candidate-id]").nth(0).getAttribute("class")) || ""), /is-active/);
              assert.match(String((await page.locator("[data-paper-permanent-candidate-id]").nth(1).getAttribute("class")) || ""), /is-active/);
              assert.equal(await page.locator("#permanentStatusInput").inputValue(), "draft");
              assert.equal(await page.locator("#confirmAuthorshipInput").isChecked(), false);
              assert.equal(await page.locator("#btnSavePermanentNote").getAttribute("disabled"), null);
              assert.match(String((await page.locator("#btnSavePermanentNote").textContent()) || ""), /确认保存为永久笔记/);
            }, 4000);

            await page.evaluate(
              ({ key, paperId }) => {
                window.localStorage.setItem(
                  key,
                JSON.stringify({
                  paperId,
                  selectedCandidateId: "pwc_2",
                  selectedPermanentCandidateId: "pn_1",
                  updatedAt: new Date().toISOString()
                })
              );
            },
            { key: paperWorkspaceSelectionStorageKey(paperId), paperId }
          );

          await openPaperWorkspace(page, webBase);
          await page.fill("#paperIdInput", paperId);
          await page.click("#btnLoadPaperWorkspace");
          await waitFor(async () => {
            const text = await page.locator(".paper-result-json").textContent();
            assert.match(text || "", /"stage": "load_workspace"/);
            assert.equal(await page.locator("[data-paper-permanent-candidate-id]").count(), 2);
          }, 6000);
	          await waitFor(async () => {
	            const previewText = await page.locator(".paper-permanent-preview").textContent();
	            assert.match(String(previewText || ""), /My takeaway is that retrieval effort improves later access to the idea/);
	            assert.doesNotMatch(String(previewText || ""), /An unsaved draft should survive candidate switches/);
              assert.equal(await page.locator("#translationParaphraseInput").inputValue(), savedParaphrase);
              assert.equal(await page.locator("#translationRelationInput").inputValue(), refreshedKickoffRelation);
              assert.equal(await page.locator("#translationBoundaryInput").inputValue(), savedBoundary);
              assert.match(String((await page.locator("[data-paper-candidate-id]").nth(0).getAttribute("class")) || ""), /is-active/);
              assert.doesNotMatch(String((await page.locator("[data-paper-candidate-id]").nth(1).getAttribute("class")) || ""), /is-active/);
              assert.match(String((await page.locator("[data-paper-permanent-candidate-id]").nth(0).getAttribute("class")) || ""), /is-active/);
              assert.doesNotMatch(String((await page.locator("[data-paper-permanent-candidate-id]").nth(1).getAttribute("class")) || ""), /is-active/);
              assert.equal(await page.locator("#confirmAuthorshipInput").isChecked(), false);
              assert.equal(await page.locator("#btnSavePermanentNote").getAttribute("disabled"), null);
              assert.match(String((await page.locator("#btnSavePermanentNote").textContent()) || ""), /确认保存为永久笔记/);
	          }, 4000);

            await page.evaluate(
              ({ key, paperId, permanentCandidateId }) => {
                const parsed = JSON.parse(window.localStorage.getItem(key) || "{}");
                window.localStorage.setItem(
                  key,
                  JSON.stringify({
                    ...parsed,
                    paperId,
                    translationSignatureByPermanentCandidate: {
                      ...(parsed.translationSignatureByPermanentCandidate || {}),
                      [permanentCandidateId]: JSON.stringify({
                        candidateId: "pwc_1",
                        translationId: "ptr_1",
                        paraphraseText: "Saved wording v1.",
                        relationToQuestion: "Saved relation v1.",
                        boundaryOrCondition: "Saved boundary v1."
                      })
                    },
                    updatedAt: new Date().toISOString()
                  })
                );
              },
              { key: paperWorkspaceSelectionStorageKey(paperId), paperId, permanentCandidateId: firstPermanentCandidateId }
            );

            await openPaperWorkspace(page, webBase);
            await page.fill("#paperIdInput", paperId);
            await page.click("#btnLoadPaperWorkspace");
            await waitFor(async () => {
              const text = await page.locator(".paper-result-json").textContent();
              assert.match(text || "", /"stage": "load_workspace"/);
              const statusText = await currentPaperWorkspaceStatusText(page);
              assert.match(String(statusText || ""), /这条转述已经更新过|重新生成永久笔记候选/);
            }, 6000);
            await waitFor(async () => {
              assert.notEqual(await page.locator("#btnSavePermanentNote").getAttribute("disabled"), null);
              const previewText = await page.locator(".paper-permanent-preview").textContent();
              assert.match(String(previewText || ""), /旧版转述|重新生成永久笔记候选/);
              const translationStepText = await page.locator(".paper-grid .paper-card.paper-span-2").nth(0).textContent();
              assert.match(String(translationStepText || ""), /旧版转述|重新生成永久笔记候选/);
            }, 4000);

            await page.evaluate(
              ({ key, paperId, permanentCandidateId }) => {
                const parsed = JSON.parse(window.localStorage.getItem(key) || "{}");
                const nextSignatures = { ...(parsed.translationSignatureByPermanentCandidate || {}) };
                delete nextSignatures[permanentCandidateId];
                window.localStorage.setItem(
                  key,
                  JSON.stringify({
                    ...parsed,
                    paperId,
                    translationSignatureByPermanentCandidate: nextSignatures,
                    updatedAt: new Date().toISOString()
                  })
                );
              },
              { key: paperWorkspaceSelectionStorageKey(paperId), paperId, permanentCandidateId: firstPermanentCandidateId }
            );

            await openPaperWorkspace(page, webBase);
            await page.fill("#paperIdInput", paperId);
            await page.click("#btnLoadPaperWorkspace");
            await waitFor(async () => {
              const text = await page.locator(".paper-result-json").textContent();
              assert.match(text || "", /"stage": "load_workspace"/);
              assert.equal(await page.locator("#btnSavePermanentNote").getAttribute("disabled"), null);
            }, 6000);

            await page.fill("#translationRelationInput", "Step 4 is now stale because Step 3 changed.");
            await waitFor(async () => {
              assert.notEqual(await page.locator("#btnSavePermanentNote").getAttribute("disabled"), null);
              assert.match(String((await page.locator("#btnSavePermanentNote").textContent()) || ""), /确认保存为永久笔记/);
              const statusText = await currentPaperWorkspaceStatusText(page);
              assert.match(String(statusText || ""), /先重新保存这条转述，再更新或确认永久笔记/);
            }, 4000);

            await openPaperWorkspace(page, webBase);
            await page.fill("#paperIdInput", paperId);
            await page.click("#btnLoadPaperWorkspace");
            await waitFor(async () => {
              const text = await page.locator(".paper-result-json").textContent();
              assert.match(text || "", /"stage": "load_workspace"/);
              const statusText = await currentPaperWorkspaceStatusText(page);
              assert.match(String(statusText || ""), /已恢复这条候选的本地未保存草稿|先重新保存这条转述，再更新或确认永久笔记/);
              assert.match(String((await page.locator(".paper-status").getAttribute("class")) || ""), /paper-status-warn/);
            }, 6000);
            await waitFor(async () => {
              assert.equal(await page.locator("#translationRelationInput").inputValue(), "Step 4 is now stale because Step 3 changed.");
              assert.notEqual(await page.locator("#btnSavePermanentNote").getAttribute("disabled"), null);
              assert.notEqual(await page.locator("#confirmAuthorshipInput").getAttribute("disabled"), null);
              assert.notEqual(await page.locator("#permanentStatusInput").getAttribute("disabled"), null);
              assert.match(String((await page.locator("[data-paper-candidate-id]").nth(0).getAttribute("class")) || ""), /is-active/);
              assert.match(String((await page.locator("[data-paper-permanent-candidate-id]").nth(0).getAttribute("class")) || ""), /is-active/);
            }, 4000);
            await page.fill("#translationRelationInput", refreshedKickoffRelation);
            await waitFor(async () => {
              assert.equal(await page.locator("#btnSavePermanentNote").getAttribute("disabled"), null);
              assert.match(String((await page.locator("#btnSavePermanentNote").textContent()) || ""), /确认保存为永久笔记/);
            }, 4000);

            await waitFor(async () => {
              assert.equal(await page.locator("#confirmAuthorshipInput").getAttribute("disabled"), null);
              assert.equal(await page.locator("#permanentStatusInput").getAttribute("disabled"), null);
            }, 4000);

            await page.locator("#confirmAuthorshipInput").check();
            await page.click("#btnSavePermanentNote");
            let savedPermanentNoteId = "";
            await waitFor(async () => {
              const text = await page.locator(".paper-result-json").textContent();
              assert.match(text || "", /"stage": "save_permanent_note"/);
              const parsed = JSON.parse(text || "{}");
              savedPermanentNoteId = String(parsed?.permanentNote?.id || parsed?.permanentCandidate?.savedPermanentNoteId || "").trim();
              assert.ok(savedPermanentNoteId);
              const statusText = await currentPaperWorkspaceStatusText(page);
              assert.match(String(statusText || ""), /永久笔记已保存/);
              assert.match(String(statusText || ""), /已对齐到这条候选已保存的永久笔记路径/);
            }, 6000);
            await waitFor(async () => {
              const previewText = await page.locator(".paper-permanent-preview").textContent();
              assert.match(String(previewText || ""), /My takeaway is that retrieval effort improves later access to the idea/);
              assert.doesNotMatch(String(previewText || ""), /An unsaved draft should survive candidate switches/);
              assert.doesNotMatch(String(previewText || ""), /An unsaved draft should survive candidate switches/);
              assert.match(String(previewText || ""), new RegExp(`已保存为：${savedPermanentNoteId}`));
              assert.equal(await page.locator("#confirmAuthorshipInput").isChecked(), true);
              assert.match(String((await page.locator("[data-paper-permanent-candidate-id]").nth(0).getAttribute("class")) || ""), /is-active/);
              assert.doesNotMatch(String((await page.locator("[data-paper-permanent-candidate-id]").nth(1).getAttribute("class")) || ""), /is-active/);
              assert.equal(await page.locator("[data-paper-permanent-candidate-id]").count(), 2);
              assert.notEqual(await page.locator("#btnSavePermanentNote").getAttribute("disabled"), null);
              assert.match(String((await page.locator("#btnSavePermanentNote").textContent()) || ""), /已保存为永久笔记/);
            }, 4000);

            await openPaperWorkspace(page, webBase);
            await page.fill("#paperIdInput", paperId);
            await page.click("#btnLoadPaperWorkspace");
            await waitFor(async () => {
              const text = await page.locator(".paper-result-json").textContent();
              assert.match(text || "", /"stage": "load_workspace"/);
              assert.equal(await page.locator("[data-paper-permanent-candidate-id]").count(), 2);
            }, 6000);
            await waitFor(async () => {
              const previewText = await page.locator(".paper-permanent-preview").textContent();
              assert.match(String(previewText || ""), /My takeaway is that retrieval effort improves later access to the idea/);
              assert.doesNotMatch(String(previewText || ""), /An unsaved draft should survive candidate switches/);
              assert.match(String(previewText || ""), new RegExp(`已保存为：${savedPermanentNoteId}`));
              const savedPathStatusText = await currentPaperWorkspaceStatusText(page);
              assert.match(String(savedPathStatusText || ""), /已对齐到这条候选已保存的永久笔记路径/);
              assert.match(String((await page.locator("[data-paper-permanent-candidate-id]").nth(0).getAttribute("class")) || ""), /is-active/);
              assert.doesNotMatch(String((await page.locator("[data-paper-permanent-candidate-id]").nth(1).getAttribute("class")) || ""), /is-active/);
              assert.equal(await page.locator("#permanentStatusInput").inputValue(), "draft");
              assert.equal(await page.locator("#confirmAuthorshipInput").isChecked(), true);
              assert.notEqual(await page.locator("#confirmAuthorshipInput").getAttribute("disabled"), null);
              assert.notEqual(await page.locator("#permanentStatusInput").getAttribute("disabled"), null);
              assert.notEqual(await page.locator("#btnSavePermanentNote").getAttribute("disabled"), null);
              assert.match(String((await page.locator("#btnSavePermanentNote").textContent()) || ""), /已保存为永久笔记/);
            }, 4000);

            await waitFor(async () => {
              assert.notEqual(await page.locator("#confirmAuthorshipInput").getAttribute("disabled"), null);
              assert.notEqual(await page.locator("#permanentStatusInput").getAttribute("disabled"), null);
            }, 4000);

            await page.locator("[data-paper-permanent-candidate-id]").nth(1).click();
            await waitFor(async () => {
              const previewText = await page.locator(".paper-permanent-preview").textContent();
              assert.match(String(previewText || ""), /An unsaved draft should survive candidate switches/);
              const statusText = await currentPaperWorkspaceStatusText(page);
              assert.match(String(statusText || ""), /已对齐到这条候选的永久笔记候选/);
            }, 4000);

            await page.locator("[data-paper-permanent-candidate-id]").nth(0).click();
            await waitFor(async () => {
              const previewText = await page.locator(".paper-permanent-preview").textContent();
              assert.match(String(previewText || ""), new RegExp(`已保存为：${savedPermanentNoteId}`));
              const statusText = await currentPaperWorkspaceStatusText(page);
              assert.match(String(statusText || ""), /已对齐到这条候选已保存的永久笔记路径/);
              const draftBriefText = await page.locator("[data-paper-draft-brief]").textContent();
              assert.match(String(draftBriefText || ""), /Step 4: 已保存永久笔记路径/);
              assert.match(String((await page.locator("[data-paper-draft-brief-step-four]").textContent()) || ""), /Step 4: 已保存永久笔记路径/);
              assert.match(String((await page.locator("[data-paper-draft-brief-saved-note]").textContent()) || ""), new RegExp(`Saved note: ${savedPermanentNoteId}`));
              assert.match(
                String((await page.locator("[data-paper-draft-brief-next-action]").textContent()) || ""),
                /Next action: .*originality \/ authorship/
              );
              assert.equal(await page.locator("#btnCopyDraftBrief").getAttribute("disabled"), null);
              assert.match(String((await page.locator("#btnCopyDraftBrief").textContent()) || ""), /复制 brief，回看已保存路径/);
              assert.match(
                String((await page.locator("[data-paper-draft-continuity]").textContent()) || ""),
                /继续写 draft 前，先回看 originality \/ authorship/
              );
            }, 4000);

            await page.click("#btnCopyDraftBrief");
            await waitFor(async () => {
              const statusText = await currentPaperWorkspaceStatusText(page);
              assert.match(String(statusText || ""), /已复制 draft brief/);
              assert.match(String(statusText || ""), /下一步：.*originality \/ authorship/);
              assert.match(
                String((await page.locator("[data-paper-draft-brief-copy]").textContent()) || ""),
                /最近一次已复制。下一步：.*originality \/ authorship/
              );
              const copiedText = await page.evaluate(
                () => window.__paperWorkspaceLastDraftBrief || (Array.isArray(window.__copiedTexts) ? window.__copiedTexts.at(-1) : "")
              );
              assert.match(String(copiedText || ""), /Step 4: 已保存永久笔记路径 \(.+\)/);
              assert.match(String(copiedText || ""), /Saved permanent note: /);
              assert.match(String(copiedText || ""), /Next action: .*originality \/ authorship/);
            }, 4000);

            await page.locator(".paper-candidate").nth(1).click();
            await waitFor(async () => {
              const previewText = await page.locator(".paper-permanent-preview").textContent();
              assert.match(String(previewText || ""), /An unsaved draft should survive candidate switches/);
              const statusText = await currentPaperWorkspaceStatusText(page);
              assert.match(String(statusText || ""), /已对齐到这条候选的永久笔记候选/);
            }, 4000);

            await page.locator(".paper-candidate").nth(0).click();
            await waitFor(async () => {
              const previewText = await page.locator(".paper-permanent-preview").textContent();
              assert.match(String(previewText || ""), new RegExp(`已保存为：${savedPermanentNoteId}`));
              const statusText = await currentPaperWorkspaceStatusText(page);
              assert.match(String(statusText || ""), /已对齐到这条候选已保存的永久笔记路径/);
              const draftBriefText = await page.locator("[data-paper-draft-brief]").textContent();
              assert.match(String(draftBriefText || ""), /Step 4: 已保存永久笔记路径/);
            }, 4000);

            await page.fill("#translationRelationInput", "Saved relation after the permanent note was already confirmed.");
            await page.click("#btnSaveTranslation");
            await waitFor(async () => {
              const text = await page.locator(".paper-result-json").textContent();
              assert.match(text || "", /"stage": "save_translation"/);
              const statusText = await currentPaperWorkspaceStatusText(page);
              assert.match(String(statusText || ""), /用户转述已保存/);
              assert.match(String(statusText || ""), /这条转述已经更新过|重新生成永久笔记候选/);
            }, 6000);
            await waitFor(async () => {
              const translationStepText = await page.locator(".paper-grid .paper-card.paper-span-2").nth(0).textContent();
              assert.match(String(translationStepText || ""), /Step 4 .*旧版转述|下一步先重新生成永久笔记候选/);
              const previewText = await page.locator(".paper-permanent-preview").textContent();
              assert.match(String(previewText || ""), /旧版转述|重新生成永久笔记候选/);
              assert.equal(await page.locator("#btnCreatePermanentCandidate").getAttribute("disabled"), null);
              assert.match(String((await page.locator("#btnCreatePermanentCandidate").textContent()) || ""), /重新生成永久笔记候选/);
              assert.notEqual(await page.locator("#btnSavePermanentNote").getAttribute("disabled"), null);
              assert.notEqual(await page.locator("#confirmAuthorshipInput").getAttribute("disabled"), null);
              assert.notEqual(await page.locator("#permanentStatusInput").getAttribute("disabled"), null);
              assert.match(String((await page.locator("#btnSavePermanentNote").textContent()) || ""), /先重新生成永久笔记候选/);
            }, 4000);

            await waitFor(async () => {
              assert.notEqual(await page.locator("#btnStartDraftKickoff").getAttribute("disabled"), null);
              assert.match(String((await page.locator("#btnStartDraftKickoff").textContent()) || ""), /先刷新 Step 4/);
              assert.match(
                String((await page.locator("#draftKickoffTextarea").inputValue()) || ""),
                /Local draft kickoff wording that should survive refresh\./
              );
              assert.match(
                String((await page.locator("#draftKickoffPreviousTextarea").inputValue()) || ""),
                new RegExp(`Kickoff written before refreshing stale Step 4\\.|${refreshedKickoffRelation.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`)
              );
            }, 4000);

            await page.locator(".paper-candidate").nth(1).click();
            await waitFor(async () => {
              const previewText = await page.locator(".paper-permanent-preview").textContent();
              assert.match(String(previewText || ""), /An unsaved draft should survive candidate switches/);
              const statusText = await currentPaperWorkspaceStatusText(page);
              assert.match(String(statusText || ""), /已对齐到这条候选的永久笔记候选/);
            }, 4000);

            await page.locator(".paper-candidate").nth(0).click();
            await waitFor(async () => {
              const translationStepText = await page.locator(".paper-grid .paper-card.paper-span-2").nth(0).textContent();
              assert.match(String(translationStepText || ""), /Step 4 .*旧版转述|下一步先重新生成永久笔记候选/);
              const statusText = await currentPaperWorkspaceStatusText(page);
              assert.match(String(statusText || ""), /这条转述已经更新过|重新生成永久笔记候选/);
              const previewText = await page.locator(".paper-permanent-preview").textContent();
              assert.match(String(previewText || ""), /旧版转述|重新生成永久笔记候选/);
              assert.match(
                String((await page.locator("[data-paper-draft-continuity]").textContent()) || ""),
                /先重新生成永久笔记候选，再继续写 draft/
              );
              const draftBriefText = await page.locator("[data-paper-draft-brief]").textContent();
              assert.match(String(draftBriefText || ""), /Step 4: 已生成永久笔记候选/);
              assert.notEqual(await page.locator("#btnCopyDraftBrief").getAttribute("disabled"), null);
              assert.match(String((await page.locator("#btnCopyDraftBrief").textContent()) || ""), /先刷新 Step 4/);
              assert.match(String((await page.locator("#btnStartDraftKickoff").textContent()) || ""), /先刷新 Step 4/);
              assert.match(
                String((await page.locator("#draftKickoffTextarea").inputValue()) || ""),
                /Local draft kickoff wording that should survive refresh\./
              );
              assert.match(
                String((await page.locator("#draftKickoffPreviousTextarea").inputValue()) || ""),
                new RegExp(`Kickoff written before refreshing stale Step 4\\.|${refreshedKickoffRelation.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`)
              );
              assert.equal(await page.locator("#btnCreatePermanentCandidate").getAttribute("disabled"), null);
              assert.match(String((await page.locator("#btnCreatePermanentCandidate").textContent()) || ""), /重新生成永久笔记候选/);
              assert.notEqual(await page.locator("#btnSavePermanentNote").getAttribute("disabled"), null);
              assert.match(String((await page.locator("#btnSavePermanentNote").textContent()) || ""), /先重新生成永久笔记候选/);
              assert.equal(await page.locator("[data-paper-draft-brief-copy]").count(), 0);
            }, 4000);

            await page.click("#btnCreatePermanentCandidate");
            await waitFor(async () => {
              const text = await page.locator(".paper-result-json").textContent();
              assert.match(text || "", /"stage": "(create_permanent_candidate|permanent_candidate)"/);
              const statusText = await currentPaperWorkspaceStatusText(page);
              assert.match(String(statusText || ""), /永久笔记候选已生成/);
              assert.match(String(statusText || ""), /已对齐到这条候选的永久笔记候选/);
              assert.equal(await page.locator("#btnSavePermanentNote").getAttribute("disabled"), null);
              assert.equal(await page.locator("#confirmAuthorshipInput").getAttribute("disabled"), null);
              assert.equal(await page.locator("#permanentStatusInput").getAttribute("disabled"), null);
            }, 6000);

            await page.locator("#confirmAuthorshipInput").check();
            let refreshedSavedPermanentNoteId = "";
            await page.click("#btnSavePermanentNote");
            await waitFor(async () => {
              const text = await page.locator(".paper-result-json").textContent();
              assert.match(text || "", /"stage": "save_permanent_note"/);
              const parsed = JSON.parse(text || "{}");
              refreshedSavedPermanentNoteId = String(
                parsed?.permanentNote?.id || parsed?.permanentCandidate?.savedPermanentNoteId || ""
              ).trim();
              assert.ok(refreshedSavedPermanentNoteId);
              const statusText = await currentPaperWorkspaceStatusText(page);
              assert.match(String(statusText || ""), /永久笔记已保存/);
            }, 6000);

            await waitFor(async () => {
              assert.match(
                String((await page.locator("[data-paper-draft-brief-step-four]").textContent()) || ""),
                /Step 4: 已保存永久笔记路径/
              );
              assert.match(
                String((await page.locator("[data-paper-draft-brief-saved-note]").textContent()) || ""),
                new RegExp(`Saved note: ${refreshedSavedPermanentNoteId}`)
              );
              assert.equal(await page.locator("#btnAdoptPreviousKickoff").getAttribute("disabled"), null);
              assert.match(String((await page.locator("#btnStartDraftKickoff").textContent()) || ""), /载入新版 brief，更新本地 draft/);
              assert.match(
                String((await page.locator("#draftKickoffTextarea").inputValue()) || ""),
                /Local draft kickoff wording that should survive refresh\./
              );
              assert.match(
                String((await page.locator("#draftKickoffPreviousTextarea").inputValue()) || ""),
                new RegExp(refreshedKickoffRelation.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
              );
            }, 4000);

            await page.locator(".paper-candidate").nth(1).click();
            await waitFor(async () => {
              const statusText = await currentPaperWorkspaceStatusText(page);
              assert.match(String(statusText || ""), /已对齐到这条候选的永久笔记候选/);
            }, 4000);

            await page.locator(".paper-candidate").nth(0).click();
            await waitFor(async () => {
              const statusText = await currentPaperWorkspaceStatusText(page);
              assert.match(String(statusText || ""), /已对齐到这条候选已保存的永久笔记路径/);
              assert.match(
                String((await page.locator("[data-paper-draft-brief-step-four]").textContent()) || ""),
                /Step 4: 已保存永久笔记路径/
              );
              assert.match(
                String((await page.locator("[data-paper-draft-brief-saved-note]").textContent()) || ""),
                new RegExp(`Saved note: ${refreshedSavedPermanentNoteId}`)
              );
            }, 4000);

	            await page.click("#btnAdoptPreviousKickoff");
	            await waitFor(async () => {
	              const statusText = await currentPaperWorkspaceStatusText(page);
	              assert.match(String(statusText || ""), /已采用上一版 kickoff 写法/);
	              assert.match(String(statusText || ""), /Summary 1/);
	              assert.match(String(statusText || ""), /当前本地 draft 仍指向最新转述链路/);
	              assert.match(String(statusText || ""), /下一步：/);
	              assert.match(
	                String((await page.locator("[data-paper-draft-brief-step-four]").textContent()) || ""),
	                /Step 4: 已保存永久笔记路径/
              );
              assert.match(
                String((await page.locator("[data-paper-draft-brief-saved-note]").textContent()) || ""),
                new RegExp(`Saved note: ${refreshedSavedPermanentNoteId}`)
              );
              assert.match(
                String((await page.locator("#draftKickoffTextarea").inputValue()) || ""),
                new RegExp(refreshedKickoffRelation.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
              );
              assert.match(
                String((await page.locator("#draftKickoffPreviousTextarea").inputValue()) || ""),
                /Local draft kickoff wording that should survive refresh\./
              );
            }, 4000);

            await openPaperWorkspace(page, webBase);
            await page.fill("#paperIdInput", paperId);
            await page.click("#btnLoadPaperWorkspace");
            await waitFor(async () => {
              const text = await page.locator(".paper-result-json").textContent();
              assert.match(text || "", /"stage": "load_workspace"/);
              const statusText = await currentPaperWorkspaceStatusText(page);
              assert.match(String(statusText || ""), /已对齐到这条候选已保存的永久笔记路径/);
              assert.match(
                String((await page.locator("[data-paper-draft-brief-step-four]").textContent()) || ""),
                /Step 4: 已保存永久笔记路径/
              );
              assert.match(
                String((await page.locator("[data-paper-draft-brief-saved-note]").textContent()) || ""),
                new RegExp(`Saved note: ${refreshedSavedPermanentNoteId}`)
              );
              assert.match(
                String((await page.locator("#draftKickoffTextarea").inputValue()) || ""),
                new RegExp(refreshedKickoffRelation.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
              );
              assert.match(
                String((await page.locator("#draftKickoffPreviousTextarea").inputValue()) || ""),
                /Local draft kickoff wording that should survive refresh\./
              );
              assert.match(String((await page.locator("#btnStartDraftKickoff").textContent()) || ""), /继续本地 draft/);
              assert.equal(await page.locator("#btnAdoptPreviousKickoff").getAttribute("disabled"), null);
            }, 6000);

            const secondRefreshedKickoffRelation = "Saved path relation after a second kickoff refresh cycle.";
            await page.fill("#translationRelationInput", secondRefreshedKickoffRelation);
            await page.click("#btnSaveTranslation");
            await waitFor(async () => {
              const text = await page.locator(".paper-result-json").textContent();
              assert.match(text || "", /"stage": "save_translation"/);
              const statusText = await currentPaperWorkspaceStatusText(page);
              assert.match(String(statusText || ""), /这条转述已经更新过|重新生成永久笔记候选/);
              assert.match(String((await page.locator("#btnStartDraftKickoff").textContent()) || ""), /先刷新 Step 4/);
              assert.match(
                String((await page.locator("[data-paper-draft-kickoff-note]").textContent()) || ""),
                /仍基于旧版转述/
              );
              assert.equal(await page.locator("#btnCreatePermanentCandidate").getAttribute("disabled"), null);
              assert.match(String((await page.locator("#btnCreatePermanentCandidate").textContent()) || ""), /重新生成永久笔记候选/);
            }, 6000);

            await page.click("#btnCreatePermanentCandidate");
            await waitFor(async () => {
              const text = await page.locator(".paper-result-json").textContent();
              assert.match(text || "", /"stage": "(create_permanent_candidate|permanent_candidate)"/);
              assert.equal(await page.locator("#confirmAuthorshipInput").getAttribute("disabled"), null);
              assert.equal(await page.locator("#btnSavePermanentNote").getAttribute("disabled"), null);
            }, 6000);

            await page.locator("#confirmAuthorshipInput").check();
            let secondSavedPermanentNoteId = "";
            await page.click("#btnSavePermanentNote");
            await waitFor(async () => {
              const text = await page.locator(".paper-result-json").textContent();
              assert.match(text || "", /"stage": "save_permanent_note"/);
              const parsed = JSON.parse(text || "{}");
              secondSavedPermanentNoteId = String(
                parsed?.permanentNote?.id || parsed?.permanentCandidate?.savedPermanentNoteId || ""
              ).trim();
              assert.ok(secondSavedPermanentNoteId);
              const statusText = await currentPaperWorkspaceStatusText(page);
              assert.match(String(statusText || ""), /永久笔记已保存/);
              assert.match(String((await page.locator("#btnStartDraftKickoff").textContent()) || ""), /载入新版 brief，更新本地 draft/);
              assert.ok((await page.locator("[data-paper-permanent-saved-note-id]").count()) >= 3);
              assert.equal(
                await page.locator(`[data-paper-permanent-saved-note-id="${savedPermanentNoteId}"]`).count(),
                1
              );
              assert.equal(
                await page.locator(`[data-paper-permanent-saved-note-id="${secondSavedPermanentNoteId}"]`).count(),
                1
              );
            }, 6000);

            await page.click("#btnStartDraftKickoff");
            await waitFor(async () => {
              const statusText = await currentPaperWorkspaceStatusText(page);
              assert.match(String(statusText || ""), /已载入本地 draft kickoff/);
              assert.match(
                String((await page.locator("#draftKickoffTextarea").inputValue()) || ""),
                new RegExp(secondRefreshedKickoffRelation.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
              );
              assert.match(
                String((await page.locator("#draftKickoffPreviousTextarea").inputValue()) || ""),
                new RegExp(refreshedKickoffRelation.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
              );
              assert.equal(await page.locator("#btnAdoptPreviousKickoff").getAttribute("disabled"), null);
            }, 4000);

            await openPaperWorkspace(page, webBase);
            await page.fill("#paperIdInput", paperId);
            await page.click("#btnLoadPaperWorkspace");
            await waitFor(async () => {
              const text = await page.locator(".paper-result-json").textContent();
              assert.match(text || "", /"stage": "load_workspace"/);
              const statusText = await currentPaperWorkspaceStatusText(page);
              assert.match(String(statusText || ""), /已对齐到这条候选已保存的永久笔记路径/);
              assert.ok((await page.locator("[data-paper-permanent-saved-note-id]").count()) >= 3);
              assert.equal(
                await page.locator(`[data-paper-permanent-saved-note-id="${savedPermanentNoteId}"]`).count(),
                1
              );
              assert.equal(
                await page.locator(`[data-paper-permanent-saved-note-id="${secondSavedPermanentNoteId}"]`).count(),
                1
              );
              assert.match(
                String((await page.locator("[data-paper-draft-brief-step-four]").textContent()) || ""),
                /Step 4: 已保存永久笔记路径/
              );
              assert.match(
                String((await page.locator("#draftKickoffTextarea").inputValue()) || ""),
                new RegExp(secondRefreshedKickoffRelation.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
              );
              assert.match(
                String((await page.locator("#draftKickoffPreviousTextarea").inputValue()) || ""),
                new RegExp(refreshedKickoffRelation.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
              );
              assert.match(String((await page.locator("#btnStartDraftKickoff").textContent()) || ""), /继续本地 draft/);
              assert.equal(await page.locator("#btnAdoptPreviousKickoff").getAttribute("disabled"), null);
            }, 6000);

            await page.locator(".paper-candidate").nth(1).click();
            await waitFor(async () => {
              const statusText = await currentPaperWorkspaceStatusText(page);
              assert.match(String(statusText || ""), /已对齐到这条候选的永久笔记候选/);
              assert.equal(await page.locator("#draftKickoffTextarea").count(), 0);
            }, 4000);

            await page.locator(".paper-candidate").nth(0).click();
            await waitFor(async () => {
              const statusText = await currentPaperWorkspaceStatusText(page);
              assert.match(String(statusText || ""), /已对齐到这条候选已保存的永久笔记路径/);
              assert.match(
                String((await page.locator("[data-paper-draft-brief-step-four]").textContent()) || ""),
                /Step 4: 已保存永久笔记路径/
              );
              assert.match(
                String((await page.locator("#draftKickoffTextarea").inputValue()) || ""),
                new RegExp(secondRefreshedKickoffRelation.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
              );
              assert.match(
                String((await page.locator("#draftKickoffPreviousTextarea").inputValue()) || ""),
                new RegExp(refreshedKickoffRelation.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
              );
              assert.match(String((await page.locator("#btnStartDraftKickoff").textContent()) || ""), /继续本地 draft/);
              assert.equal(await page.locator("#btnAdoptPreviousKickoff").getAttribute("disabled"), null);
            }, 4000);

            await page.locator("[data-paper-permanent-candidate-id]").nth(1).click();
            await waitFor(async () => {
              const statusText = await currentPaperWorkspaceStatusText(page);
              assert.match(String(statusText || ""), /已对齐到这条候选的永久笔记候选/);
              assert.equal(await page.locator("#draftKickoffTextarea").count(), 0);
            }, 4000);

            await page
              .locator("[data-paper-permanent-candidate-id]", {
                hasText: secondSavedPermanentNoteId
              })
              .click();
            await waitFor(async () => {
              const statusText = await currentPaperWorkspaceStatusText(page);
              assert.match(String(statusText || ""), /已对齐到这条候选已保存的永久笔记路径/);
              assert.match(
                String((await page.locator("[data-paper-draft-brief-step-four]").textContent()) || ""),
                /Step 4: 已保存永久笔记路径/
              );
              assert.match(
                String((await page.locator("#draftKickoffTextarea").inputValue()) || ""),
                new RegExp(secondRefreshedKickoffRelation.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
              );
              assert.match(
                String((await page.locator("#draftKickoffPreviousTextarea").inputValue()) || ""),
                new RegExp(refreshedKickoffRelation.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
              );
              assert.match(String((await page.locator("#btnStartDraftKickoff").textContent()) || ""), /继续本地 draft/);
              assert.equal(await page.locator("#btnAdoptPreviousKickoff").getAttribute("disabled"), null);
            }, 4000);

            await page
              .locator("[data-paper-permanent-candidate-id]", {
                hasText: refreshedSavedPermanentNoteId
              })
              .click();
            await waitFor(async () => {
              const statusText = await currentPaperWorkspaceStatusText(page);
              assert.match(String(statusText || ""), /这条转述已经更新过|重新生成永久笔记候选/);
              assert.match(
                String((await page.locator("[data-paper-draft-continuity]").textContent()) || ""),
                /先重新生成永久笔记候选，再继续写 draft/
              );
              assert.equal(await page.locator("[data-paper-draft-brief-copy]").count(), 0);
              assert.match(
                String((await page.locator("#draftKickoffTextarea").inputValue()) || ""),
                new RegExp(secondRefreshedKickoffRelation.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
              );
              assert.match(
                String((await page.locator("#draftKickoffPreviousTextarea").inputValue()) || ""),
                new RegExp(refreshedKickoffRelation.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
              );
              assert.notEqual(await page.locator("#btnCopyDraftBrief").getAttribute("disabled"), null);
              assert.match(String((await page.locator("#btnCopyDraftBrief").textContent()) || ""), /先刷新 Step 4/);
              assert.match(String((await page.locator("#btnStartDraftKickoff").textContent()) || ""), /先刷新 Step 4/);
              assert.equal(await page.locator("#btnAdoptPreviousKickoff").getAttribute("disabled"), null);
            }, 4000);

            await openPaperWorkspace(page, webBase);
            await page.fill("#paperIdInput", paperId);
            await page.click("#btnLoadPaperWorkspace");
            await waitFor(async () => {
              const text = await page.locator(".paper-result-json").textContent();
              assert.match(text || "", /"stage": "load_workspace"/);
              const statusText = await currentPaperWorkspaceStatusText(page);
              assert.match(String(statusText || ""), /这条转述已经更新过|重新生成永久笔记候选/);
              assert.ok((await page.locator("[data-paper-permanent-saved-note-id]").count()) >= 3);
              assert.match(
                String((await page.locator("[data-paper-draft-continuity]").textContent()) || ""),
                /先重新生成永久笔记候选，再继续写 draft/
              );
              assert.match(
                String((await page.locator("#draftKickoffTextarea").inputValue()) || ""),
                new RegExp(secondRefreshedKickoffRelation.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
              );
              assert.match(
                String((await page.locator("#draftKickoffPreviousTextarea").inputValue()) || ""),
                new RegExp(refreshedKickoffRelation.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
              );
              assert.notEqual(await page.locator("#btnCopyDraftBrief").getAttribute("disabled"), null);
              assert.match(String((await page.locator("#btnCopyDraftBrief").textContent()) || ""), /先刷新 Step 4/);
              assert.match(String((await page.locator("#btnStartDraftKickoff").textContent()) || ""), /先刷新 Step 4/);
              assert.equal(await page.locator("#btnAdoptPreviousKickoff").getAttribute("disabled"), null);
            }, 6000);

            await page
              .locator("[data-paper-permanent-candidate-id]", {
                hasText: secondSavedPermanentNoteId
              })
              .click();
            await waitFor(async () => {
              const statusText = await currentPaperWorkspaceStatusText(page);
              assert.match(String(statusText || ""), /已对齐到这条候选已保存的永久笔记路径/);
              assert.match(
                String((await page.locator("[data-paper-draft-brief-saved-note]").textContent()) || ""),
                new RegExp(`Saved note: ${secondSavedPermanentNoteId}`)
              );
              assert.equal(await page.locator("[data-paper-draft-brief-copy]").count(), 0);
              assert.equal(await page.locator("#btnCopyDraftBrief").getAttribute("disabled"), null);
              assert.match(String((await page.locator("#btnCopyDraftBrief").textContent()) || ""), /复制 brief，回看已保存路径/);
              assert.match(String((await page.locator("#btnStartDraftKickoff").textContent()) || ""), /继续本地 draft/);
              assert.match(
                String((await page.locator("#draftKickoffTextarea").inputValue()) || ""),
                new RegExp(secondRefreshedKickoffRelation.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
              );
              assert.equal(await page.locator("#btnAdoptPreviousKickoff").getAttribute("disabled"), null);
            }, 4000);

	            await page.click("#btnCopyDraftBrief");
	            await waitFor(async () => {
	              const statusText = await currentPaperWorkspaceStatusText(page);
	              assert.match(String(statusText || ""), /已复制 draft brief/);
	              assert.match(String(statusText || ""), /当前链路：Step 4: 已保存永久笔记路径/);
	              assert.match(String(statusText || ""), /下一步：.*originality \/ authorship/);
	              const copiedText = await page.evaluate(
	                () => window.__paperWorkspaceLastDraftBrief || (Array.isArray(window.__copiedTexts) ? window.__copiedTexts.at(-1) : "")
              );
              assert.match(String(copiedText || ""), new RegExp(`Saved permanent note: ${secondSavedPermanentNoteId}`));
              assert.match(String(copiedText || ""), /Step 4: 已保存永久笔记路径 \(.+\)/);
              assert.doesNotMatch(String(copiedText || ""), new RegExp(`Saved permanent note: ${refreshedSavedPermanentNoteId}`));
            }, 4000);

            await page.locator(".paper-candidate").nth(1).click();
            await waitFor(async () => {
              const statusText = await currentPaperWorkspaceStatusText(page);
              assert.match(String(statusText || ""), /已对齐到这条候选的永久笔记候选/);
              assert.equal(await page.locator("#draftKickoffTextarea").count(), 0);
            }, 4000);

            await page.locator(".paper-candidate").nth(0).click();
            await waitFor(async () => {
              const statusText = await currentPaperWorkspaceStatusText(page);
              assert.match(String(statusText || ""), /已对齐到这条候选已保存的永久笔记路径/);
              assert.match(
                String((await page.locator("[data-paper-draft-brief-saved-note]").textContent()) || ""),
                new RegExp(`Saved note: ${secondSavedPermanentNoteId}`)
              );
              assert.match(
                String((await page.locator("#draftKickoffTextarea").inputValue()) || ""),
                new RegExp(secondRefreshedKickoffRelation.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
              );
              assert.match(
                String((await page.locator("#draftKickoffPreviousTextarea").inputValue()) || ""),
                new RegExp(refreshedKickoffRelation.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
              );
              assert.match(String((await page.locator("#btnStartDraftKickoff").textContent()) || ""), /继续本地 draft/);
              assert.equal(await page.locator("#btnAdoptPreviousKickoff").getAttribute("disabled"), null);
            }, 4000);

            await page
              .locator("[data-paper-permanent-candidate-id]", {
                hasText: secondSavedPermanentNoteId
              })
              .click();
            await waitFor(async () => {
              const statusText = await currentPaperWorkspaceStatusText(page);
              assert.match(String(statusText || ""), /已对齐到这条候选已保存的永久笔记路径/);
              assert.match(String((await page.locator("#btnStartDraftKickoff").textContent()) || ""), /继续本地 draft/);
              assert.match(
                String((await page.locator("#draftKickoffTextarea").inputValue()) || ""),
                new RegExp(secondRefreshedKickoffRelation.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
              );
            }, 4000);

            await page.click("#btnStartDraftKickoff");
	            await waitFor(async () => {
	              const statusText = await currentPaperWorkspaceStatusText(page);
	              assert.match(String(statusText || ""), /继续本地 draft|已载入本地 draft kickoff/);
	              assert.match(String(statusText || ""), /当前链路：Step 4: 已保存永久笔记路径/);
	              assert.match(String(statusText || ""), /下一步：.*originality \/ authorship/);
	              assert.match(
	                String((await page.locator("#draftKickoffTextarea").inputValue()) || ""),
                new RegExp(secondRefreshedKickoffRelation.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
              );
              assert.match(
                String((await page.locator("#draftKickoffPreviousTextarea").inputValue()) || ""),
                new RegExp(refreshedKickoffRelation.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
              );
              assert.equal(await page.locator("#btnAdoptPreviousKickoff").getAttribute("disabled"), null);
            }, 4000);

            await openPaperWorkspace(page, webBase);
            await page.fill("#paperIdInput", paperId);
            await page.click("#btnLoadPaperWorkspace");
            await waitFor(async () => {
              const text = await page.locator(".paper-result-json").textContent();
              assert.match(text || "", /"stage": "load_workspace"/);
              const statusText = await currentPaperWorkspaceStatusText(page);
              assert.match(String(statusText || ""), /已对齐到这条候选已保存的永久笔记路径/);
              assert.match(
                String((await page.locator("[data-paper-draft-brief-saved-note]").textContent()) || ""),
                new RegExp(`Saved note: ${secondSavedPermanentNoteId}`)
              );
              assert.match(String((await page.locator("#btnStartDraftKickoff").textContent()) || ""), /继续本地 draft/);
              assert.match(
                String((await page.locator("#draftKickoffTextarea").inputValue()) || ""),
                new RegExp(secondRefreshedKickoffRelation.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
              );
              assert.match(
                String((await page.locator("#draftKickoffPreviousTextarea").inputValue()) || ""),
                new RegExp(refreshedKickoffRelation.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
              );
              assert.equal(await page.locator("#btnAdoptPreviousKickoff").getAttribute("disabled"), null);
            }, 6000);

            await page.click("#btnCopyDraftBrief");
            await waitFor(async () => {
              const statusText = await currentPaperWorkspaceStatusText(page);
              assert.match(String(statusText || ""), /已复制 draft brief/);
              assert.match(String(statusText || ""), /下一步：.*originality \/ authorship/);
              const copiedText = await page.evaluate(
                () => window.__paperWorkspaceLastDraftBrief || (Array.isArray(window.__copiedTexts) ? window.__copiedTexts.at(-1) : "")
              );
              assert.match(String(copiedText || ""), new RegExp(`Saved permanent note: ${secondSavedPermanentNoteId}`));
              assert.doesNotMatch(String(copiedText || ""), new RegExp(`Saved permanent note: ${refreshedSavedPermanentNoteId}`));
              assert.match(String(copiedText || ""), /Step 4: 已保存永久笔记路径 \(.+\)/);
            }, 4000);

            await page.locator(".paper-candidate").nth(1).click();
            await waitFor(async () => {
              const statusText = await currentPaperWorkspaceStatusText(page);
              assert.match(String(statusText || ""), /已对齐到这条候选的永久笔记候选/);
              assert.equal(await page.locator("#draftKickoffTextarea").count(), 0);
            }, 4000);

            await page.locator(".paper-candidate").nth(0).click();
            await waitFor(async () => {
              const statusText = await currentPaperWorkspaceStatusText(page);
              assert.match(String(statusText || ""), /已对齐到这条候选已保存的永久笔记路径/);
              assert.match(
                String((await page.locator("[data-paper-draft-brief-saved-note]").textContent()) || ""),
                new RegExp(`Saved note: ${secondSavedPermanentNoteId}`)
              );
              assert.match(String((await page.locator("#btnStartDraftKickoff").textContent()) || ""), /继续本地 draft/);
              assert.match(
                String((await page.locator("#draftKickoffTextarea").inputValue()) || ""),
                new RegExp(secondRefreshedKickoffRelation.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
              );
            }, 4000);

            await page.click("#btnCopyDraftBrief");
            await waitFor(async () => {
              const statusText = await currentPaperWorkspaceStatusText(page);
              assert.match(String(statusText || ""), /已复制 draft brief/);
              assert.match(
                String((await page.locator("[data-paper-draft-brief-copy]").textContent()) || ""),
                /最近一次已复制。下一步：.*originality \/ authorship/
              );
              const copiedText = await page.evaluate(
                () => window.__paperWorkspaceLastDraftBrief || (Array.isArray(window.__copiedTexts) ? window.__copiedTexts.at(-1) : "")
              );
              assert.match(String(copiedText || ""), new RegExp(`Saved permanent note: ${secondSavedPermanentNoteId}`));
              assert.doesNotMatch(String(copiedText || ""), new RegExp(`Saved permanent note: ${refreshedSavedPermanentNoteId}`));
            }, 4000);

            await page.locator("[data-paper-permanent-candidate-id]").nth(1).click();
            await waitFor(async () => {
              const statusText = await currentPaperWorkspaceStatusText(page);
              assert.match(String(statusText || ""), /已对齐到这条候选的永久笔记候选/);
              assert.equal(await page.locator("#draftKickoffTextarea").count(), 0);
            }, 4000);

            await page
              .locator("[data-paper-permanent-candidate-id]", {
                hasText: secondSavedPermanentNoteId
              })
              .click();
            await waitFor(async () => {
              const statusText = await currentPaperWorkspaceStatusText(page);
              assert.match(String(statusText || ""), /已对齐到这条候选已保存的永久笔记路径/);
              assert.match(
                String((await page.locator("[data-paper-draft-brief-saved-note]").textContent()) || ""),
                new RegExp(`Saved note: ${secondSavedPermanentNoteId}`)
              );
              assert.match(String((await page.locator("#btnStartDraftKickoff").textContent()) || ""), /继续本地 draft/);
              assert.match(
                String((await page.locator("#draftKickoffTextarea").inputValue()) || ""),
                new RegExp(secondRefreshedKickoffRelation.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
              );
            }, 4000);

            await page.click("#btnCopyDraftBrief");
            await waitFor(async () => {
              const statusText = await currentPaperWorkspaceStatusText(page);
              assert.match(String(statusText || ""), /已复制 draft brief/);
              const copiedText = await page.evaluate(
                () => window.__paperWorkspaceLastDraftBrief || (Array.isArray(window.__copiedTexts) ? window.__copiedTexts.at(-1) : "")
              );
              assert.match(String(copiedText || ""), new RegExp(`Saved permanent note: ${secondSavedPermanentNoteId}`));
              assert.doesNotMatch(String(copiedText || ""), new RegExp(`Saved permanent note: ${refreshedSavedPermanentNoteId}`));
            }, 4000);

            await page.click("#btnStartDraftKickoff");
            await waitFor(async () => {
              const statusText = await currentPaperWorkspaceStatusText(page);
              assert.match(String(statusText || ""), /继续本地 draft|已载入本地 draft kickoff/);
              assert.match(String(statusText || ""), /下一步：.*originality \/ authorship/);
              assert.match(
                String((await page.locator("#draftKickoffTextarea").inputValue()) || ""),
                new RegExp(secondRefreshedKickoffRelation.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
              );
              assert.match(
                String((await page.locator("#draftKickoffPreviousTextarea").inputValue()) || ""),
                new RegExp(refreshedKickoffRelation.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
              );
              assert.equal(await page.locator("#btnAdoptPreviousKickoff").getAttribute("disabled"), null);
            }, 4000);

            await openPaperWorkspace(page, webBase);
            await page.fill("#paperIdInput", paperId);
            await page.click("#btnLoadPaperWorkspace");
            await waitFor(async () => {
              const text = await page.locator(".paper-result-json").textContent();
              assert.match(text || "", /"stage": "load_workspace"/);
              const statusText = await currentPaperWorkspaceStatusText(page);
              assert.match(String(statusText || ""), /已对齐到这条候选已保存的永久笔记路径/);
              assert.match(
                String((await page.locator("[data-paper-draft-brief-saved-note]").textContent()) || ""),
                new RegExp(`Saved note: ${secondSavedPermanentNoteId}`)
              );
              assert.match(String((await page.locator("#btnStartDraftKickoff").textContent()) || ""), /继续本地 draft/);
              assert.match(
                String((await page.locator("#draftKickoffTextarea").inputValue()) || ""),
                new RegExp(secondRefreshedKickoffRelation.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
              );
              assert.match(
                String((await page.locator("#draftKickoffPreviousTextarea").inputValue()) || ""),
                new RegExp(refreshedKickoffRelation.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
              );
              assert.match(
                String((await page.locator("[data-paper-draft-brief-copy]").textContent()) || ""),
                /最近一次已复制。下一步：.*originality \/ authorship/
              );
              assert.equal(await page.locator("#btnAdoptPreviousKickoff").getAttribute("disabled"), null);
            }, 6000);

            await page.click("#btnCopyDraftBrief");
            await waitFor(async () => {
              const statusText = await currentPaperWorkspaceStatusText(page);
              assert.match(String(statusText || ""), /已复制 draft brief/);
              assert.match(String(statusText || ""), /下一步：.*originality \/ authorship/);
              const copiedText = await page.evaluate(
                () => window.__paperWorkspaceLastDraftBrief || (Array.isArray(window.__copiedTexts) ? window.__copiedTexts.at(-1) : "")
              );
              assert.match(String(copiedText || ""), new RegExp(`Saved permanent note: ${secondSavedPermanentNoteId}`));
              assert.doesNotMatch(String(copiedText || ""), new RegExp(`Saved permanent note: ${refreshedSavedPermanentNoteId}`));
              assert.match(String(copiedText || ""), /Step 4: 已保存永久笔记路径 \(.+\)/);
            }, 4000);

            await page.locator(".paper-candidate").nth(1).click();
            await waitFor(async () => {
              const statusText = await currentPaperWorkspaceStatusText(page);
              assert.match(String(statusText || ""), /已对齐到这条候选的永久笔记候选/);
              assert.equal(await page.locator("#draftKickoffTextarea").count(), 0);
            }, 4000);

            await page.locator(".paper-candidate").nth(0).click();
            await waitFor(async () => {
              const statusText = await currentPaperWorkspaceStatusText(page);
              assert.match(String(statusText || ""), /已对齐到这条候选已保存的永久笔记路径/);
              assert.match(
                String((await page.locator("[data-paper-draft-brief-saved-note]").textContent()) || ""),
                new RegExp(`Saved note: ${secondSavedPermanentNoteId}`)
              );
              assert.match(String((await page.locator("#btnStartDraftKickoff").textContent()) || ""), /继续本地 draft/);
              assert.match(
                String((await page.locator("#draftKickoffTextarea").inputValue()) || ""),
                new RegExp(secondRefreshedKickoffRelation.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
              );
              assert.match(
                String((await page.locator("#draftKickoffPreviousTextarea").inputValue()) || ""),
                new RegExp(refreshedKickoffRelation.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
              );
              assert.match(
                String((await page.locator("[data-paper-draft-brief-copy]").textContent()) || ""),
                /最近一次已复制。下一步：.*originality \/ authorship/
              );
            }, 4000);

            await page.click("#btnCopyDraftBrief");
            await waitFor(async () => {
              const statusText = await currentPaperWorkspaceStatusText(page);
              assert.match(String(statusText || ""), /已复制 draft brief/);
              const copiedText = await page.evaluate(
                () => window.__paperWorkspaceLastDraftBrief || (Array.isArray(window.__copiedTexts) ? window.__copiedTexts.at(-1) : "")
              );
              assert.match(String(copiedText || ""), new RegExp(`Saved permanent note: ${secondSavedPermanentNoteId}`));
              assert.doesNotMatch(String(copiedText || ""), new RegExp(`Saved permanent note: ${refreshedSavedPermanentNoteId}`));
            }, 4000);

            await page.fill("#translationRelationInput", "A third saved-path update should invalidate the late recent-copy hint.");
            await page.click("#btnSaveTranslation");
            await waitFor(async () => {
              const text = await page.locator(".paper-result-json").textContent();
              assert.match(text || "", /"stage": "save_translation"/);
              const statusText = await currentPaperWorkspaceStatusText(page);
              assert.match(String(statusText || ""), /这条转述已经更新过|重新生成永久笔记候选/);
              assert.equal(await page.locator("[data-paper-draft-brief-copy]").count(), 0);
              assert.match(
                String((await page.locator("[data-paper-draft-continuity]").textContent()) || ""),
                /先重新生成永久笔记候选，再继续写 draft/
              );
            }, 6000);

            await openPaperWorkspace(page, webBase);
            await page.fill("#paperIdInput", paperId);
            await page.click("#btnLoadPaperWorkspace");
            await waitFor(async () => {
              const text = await page.locator(".paper-result-json").textContent();
              assert.match(text || "", /"stage": "load_workspace"/);
              const statusText = await currentPaperWorkspaceStatusText(page);
              assert.match(String(statusText || ""), /这条转述已经更新过|重新生成永久笔记候选/);
              assert.equal(await page.locator("[data-paper-draft-brief-copy]").count(), 0);
              assert.match(
                String((await page.locator("[data-paper-draft-continuity]").textContent()) || ""),
                /先重新生成永久笔记候选，再继续写 draft/
              );
            }, 6000);

            await page.locator(".paper-candidate").nth(1).click();
            await waitFor(async () => {
              const statusText = await currentPaperWorkspaceStatusText(page);
              assert.match(String(statusText || ""), /已对齐到这条候选的永久笔记候选/);
              assert.equal(await page.locator("[data-paper-draft-brief-copy]").count(), 0);
            }, 4000);

            await page.locator(".paper-candidate").nth(0).click();
            await waitFor(async () => {
              const statusText = await currentPaperWorkspaceStatusText(page);
              assert.match(String(statusText || ""), /这条转述已经更新过|重新生成永久笔记候选/);
              assert.equal(await page.locator("[data-paper-draft-brief-copy]").count(), 0);
              assert.match(
                String((await page.locator("[data-paper-draft-continuity]").textContent()) || ""),
                /先重新生成永久笔记候选，再继续写 draft/
              );
            }, 4000);

            await page.locator("[data-paper-permanent-candidate-id]").nth(1).click();
            await waitFor(async () => {
              const statusText = await currentPaperWorkspaceStatusText(page);
              assert.match(String(statusText || ""), /已对齐到这条候选的永久笔记候选/);
              assert.equal(await page.locator("[data-paper-draft-brief-copy]").count(), 0);
            }, 4000);

            await page
              .locator("[data-paper-permanent-candidate-id]", {
                hasText: secondSavedPermanentNoteId
              })
              .click();
            await waitFor(async () => {
              const statusText = await currentPaperWorkspaceStatusText(page);
              assert.match(String(statusText || ""), /这条转述已经更新过|重新生成永久笔记候选/);
              assert.equal(await page.locator("[data-paper-draft-brief-copy]").count(), 0);
              assert.match(
                String((await page.locator("[data-paper-draft-continuity]").textContent()) || ""),
                /先重新生成永久笔记候选，再继续写 draft/
              );
            }, 4000);
	        });
  
  test("prototype writing entry switch clears stale strong-model analysis summary", async (t) => {
  if (process.env.RUN_BROWSER_E2E !== "1") {
    t.skip("Set RUN_BROWSER_E2E=1 to enable browser e2e in local runs.");
    return;
  }

  const playwright = await optionalPlaywright(t);
  if (!playwright) return;

  const stack = await startPrototypeStack(t, playwright, {
    beforeGoto: async (page) => {
      await page.addInitScript(() => {
        window.confirm = () => true;
      });
      await page.route("**/api/v1/writing/ai-analysis", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            item: {
              request: {
                requestType: "writing_strong_model_analysis",
                model: { model: "mock-strong-model" }
              },
              result: {
                summary: { artifactCount: 2 },
                artifacts: [
                  { type: "WritingMove", status: "pending_review" },
                  { type: "EvidenceGap", status: "pending_review" }
                ]
              }
            }
          })
        });
      });
    }
  });
  if (!stack) return;
  const { apiBase, page, vaultPath, webBase } = stack;

  const writingDirectory = await postJson(apiBase, "/api/v1/directories", {
    title: "Writing Entry Reset Scope",
    parentDirectoryId: "dir_original_default",
    directoryType: "custom",
    fsPath: path.join(vaultPath, "notes", "original", "writing-entry-reset-scope"),
    maxNotes: 500
  });
  assert.equal(writingDirectory.status, 201, JSON.stringify(writingDirectory.json));
  const writingDirectoryId = writingDirectory.json.item.id;

  const noteA = await postJson(apiBase, "/api/v1/notes", {
    directoryId: writingDirectoryId,
    status: "active",
    body: "# Entry reset claim\n\nA fresh writing entry should invalidate previous analysis."
  });
  assert.equal(noteA.status, 201, JSON.stringify(noteA.json));

  const noteB = await postJson(apiBase, "/api/v1/notes", {
    directoryId: writingDirectoryId,
    status: "active",
    body: "# Entry reset evidence\n\nSwitching inputs should clear old strong-model summaries."
  });
  assert.equal(noteB.status, 201, JSON.stringify(noteB.json));

  await page.goto(`${webBase}/prototype`, { waitUntil: "networkidle" });
  await page.locator('[data-action="quick-original"]').click();
  await page.locator(`.explorer-item[data-kind="folder"][data-id="${writingDirectoryId}"]`).click();
  await page.locator('.explorer-item[data-kind="file"]', { hasText: "Entry reset claim" }).click();
  await page.locator('.rail-btn[data-module="writing"]').click();

  await page.click("#btnWritingUseCurrent");
  await page.waitForFunction(() => {
    const text = document.querySelector("#writingBasketSummary")?.textContent || "";
    return text.includes("已选择 1 条相关笔记");
  });

  await page.click("#btnWritingStrongModelAnalysis");
  await page.waitForFunction(() => {
    const text = document.querySelector("#writingStrongModelSummary")?.textContent || "";
    return text.includes("已关联一组 2 条写作材料");
  });

  await page.click("#btnWritingAddVisible");
  await page.waitForFunction(() => {
    const basketText = document.querySelector("#writingBasketSummary")?.textContent || "";
    const summaryText = document.querySelector("#writingStrongModelSummary")?.textContent || "";
    return basketText.includes("已选择 2 条相关笔记") && summaryText.includes("尚未准备 AI 写作分析");
  });

  const strongModelSummary = await page.locator("#writingStrongModelSummary").textContent();
  assert.match(strongModelSummary || "", /尚未准备强模型请求/);
});

test("prototype writing center can save a theme index, edit central question, and create a project from theme", async (t) => {
  if (process.env.RUN_BROWSER_E2E !== "1") {
    t.skip("Set RUN_BROWSER_E2E=1 to enable browser e2e in local runs.");
    return;
  }

  const playwright = await optionalPlaywright(t);
  if (!playwright) return;

  const stack = await startPrototypeStack(t, playwright);
  if (!stack) return;
  const { apiBase, page, vaultPath, webBase } = stack;

  const noteA = await createWritingReadyPermanentNote(apiBase, {
    body: "# Theme Browser Claim\n\nA theme should carry a central question, not just grouped notes.",
    thesis: "A theme should carry a central question, not just grouped notes.",
    threeLineSummary: [
      "A theme should carry a central question.",
      "That makes grouped notes serve one reusable problem.",
      "It helps writing start from a theme instead of a blank page."
    ],
    boundaryOrCounterpoint: "A loose cluster can exist temporarily, but it should not stay forever without a question."
  });

  const noteB = await createWritingReadyPermanentNote(apiBase, {
    body: "# Theme Browser Tension\n\nA second note adds the tension the theme still needs.",
    thesis: "A mature theme needs tension, not only support.",
    threeLineSummary: [
      "A mature theme needs tension, not only support.",
      "That keeps the theme from turning into a storage bucket.",
      "It gives the later writing project a sharper structure."
    ],
    boundaryOrCounterpoint: "Some themes start narrow, but they still need an explicit question and growing tension."
  });

  const noteC = await createWritingReadyPermanentNote(apiBase, {
    body: "# Theme Browser Reader Path\n\nA third note turns the theme into a reader-facing outline path.",
    thesis: "A writing theme becomes useful when it can suggest a reader path.",
    threeLineSummary: [
      "A writing theme needs a reader path.",
      "That path helps the outline start from the notes instead of a blank page.",
      "It gives the later draft a concrete opening move."
    ],
    boundaryOrCounterpoint: "A theme can start from two notes, but a third note makes the outline path easier to explain."
  });

  const relation = await postJson(apiBase, `/api/v1/notes/${encodeURIComponent(noteA.json.item.id)}/relations`, {
    toNoteId: noteB.json.item.id,
    relationType: "supports",
    rationale: "The first theme note gives the second one a structural support edge before project creation.",
    insightQuestion: "What central question now organizes these two notes as one theme?",
    confidence: 1
  });
  assert.equal(relation.status, 201, JSON.stringify(relation.json));

  const readerPathRelation = await postJson(apiBase, `/api/v1/notes/${encodeURIComponent(noteB.json.item.id)}/relations`, {
    toNoteId: noteC.json.item.id,
    relationType: "extends",
    rationale: "The reader path note turns the theme tension into a concrete outline entry.",
    insightQuestion: "What outline path should these permanent notes suggest next?",
    confidence: 1
  });
  assert.equal(readerPathRelation.status, 201, JSON.stringify(readerPathRelation.json));

  await page.goto(`${webBase}/prototype`, { waitUntil: "networkidle" });
  await page.locator('.rail-btn[data-module="writing"]').click();
  await page.locator("#writingBasketNoteIds").waitFor({ state: "visible" });
  const targetBasketIds = [noteA.json.item.id, noteB.json.item.id, noteC.json.item.id];
  await page.fill("#writingBasketNoteIds", targetBasketIds.join("\n"));

  await page.evaluate(() => {
    const answers = ["Browser Theme Index", "A theme saved from the browser flow."];
    window.prompt = () => answers.shift() ?? "";
  });
  await page.click("#btnWritingSaveThemeIndex");

  let themeCard = null;
  await waitFor(async () => {
    const indexCards = await fetchJson(apiBase, "/api/v1/index-cards?directoryId=dir_original_default&indexType=topic&includeDescendants=true&limit=20");
    assert.equal(indexCards.status, 200, JSON.stringify(indexCards.json));
    themeCard = indexCards.json.items.find((item) => item.title === "Browser Theme Index");
    assert.ok(themeCard);
  }, 10000);
  await page.goto(`${webBase}/prototype`, { waitUntil: "networkidle" });
  await page.locator('[data-action="quick-original"]').click();
  await page.locator('.rail-btn[data-module="writing"]').click();
  await page.locator('#writingThemeIndexList .writing-note-card', { hasText: "Browser Theme Index" }).click();
  await page.waitForFunction(() => {
    const value = document.querySelector("#writingThemeDetailTitle")?.value || "";
    return value.includes("Browser Theme Index");
  }, null, { timeout: 10000 });
  await waitForWritingThemeProjectActionReady(page);
  await page.waitForFunction(() => {
    const hint = document.querySelector("#writingThemeIndexesHint")?.textContent || "";
    return !hint.includes("正在读取写作材料");
  }, null, { timeout: 10000 });

  await page.fill("#writingThemeDetailCentralQuestion", "What question should organize these permanent notes before writing begins?");
  await page.fill("#writingThemeDetailThesis", "A theme becomes useful when it organizes notes around one reusable question.");
  await page.fill("#writingThemeDetailSummary1", "This theme is about turning mature notes into one reusable question.");
  await page.fill("#writingThemeDetailSummary2", "That matters because writing should begin from theme-level structure, not loose grouping.");
  await page.fill("#writingThemeDetailSummary3", "It gives the next writing project a sharper starting point.");
  await page.click('[data-writing-theme-action="save"]');
  await waitFor(async () => {
    const statusText = await currentStatusText(page);
    assert.match(String(statusText || ""), /已保存主题：Browser Theme Index/);
  }, 10000);

  await page.click('[data-writing-theme-action="create-project"]');

  await waitFor(async () => {
    const resultText = await page.locator("#writingResult").textContent();
    assert.match(String(resultText || ""), /\"stage\": \"writing_project\"/);
  }, 10000);

  const projects = await fetchJson(apiBase, "/api/v1/writing-projects?limit=10");
  assert.equal(projects.status, 200, JSON.stringify(projects.json));
  const themedProject = projects.json.items.find((item) => item.title.includes("Browser Theme Index"));
  assert.ok(themedProject);
  assert.deepEqual(themedProject.related_index_ids, [themeCard.id]);
});

test("prototype writing center can create a project from a theme index after its notes were only preloaded as directory stubs", async (t) => {
  if (process.env.RUN_BROWSER_E2E !== "1") {
    t.skip("Set RUN_BROWSER_E2E=1 to enable browser e2e in local runs.");
    return;
  }

  const playwright = await optionalPlaywright(t);
  if (!playwright) return;

  const stack = await startPrototypeStack(t, playwright);
  if (!stack) return;
  const { apiBase, page, webBase } = stack;

  const noteA = await createWritingReadyPermanentNote(apiBase, {
    body: "# Cold Start Theme Claim\n\nA cold-start theme should still hydrate its member notes before gating project creation.",
    thesis: "Cold-start theme readiness should not depend on whether notes were already opened in the UI.",
    threeLineSummary: [
      "Cold-start theme readiness should not depend on UI preload order.",
      "That matters because theme entry is supposed to be a real writing shortcut.",
      "The UI should hydrate the needed notes before it decides whether project creation is allowed."
    ],
    distillationStatus: "confirmed",
    boundaryOrCounterpoint: "This only works if the theme reuses the same readiness semantics as the writing basket."
  });

  const noteB = await createWritingReadyPermanentNote(apiBase, {
    body: "# Cold Start Theme Tension\n\nA second mature note adds enough relation structure for project creation.",
    thesis: "A second mature note gives the theme enough structure to become project-ready.",
    threeLineSummary: [
      "A second mature note gives the theme enough structure.",
      "That matters because project creation should depend on structure, not cache state.",
      "It keeps the theme entry path consistent with the writing basket."
    ],
    distillationStatus: "confirmed",
    boundaryOrCounterpoint: "A theme with only one isolated note should still stop before project creation."
  });

  const relation = await postJson(apiBase, `/api/v1/notes/${encodeURIComponent(noteA.json.item.id)}/relations`, {
    toNoteId: noteB.json.item.id,
    relationType: "supports",
    rationale: "The second note gives the first enough explicit structure to justify project creation.",
    insightQuestion: "What question now organizes these notes as one reusable writing entry?",
    confidence: 1
  });
  assert.equal(relation.status, 201, JSON.stringify(relation.json));

  const coldTheme = await postJson(apiBase, "/api/v1/index-cards", {
    directoryId: "dir_original_default",
    indexType: "topic",
    title: "Cold Start Theme Index",
    summary: "A theme index created entirely through the API before the browser loads any note bodies.",
    thesis: "Theme entry should hydrate its own context before deciding whether project creation is allowed.",
    threeLineSummary: [
      "Theme entry should hydrate its own context.",
      "That keeps project gating tied to note quality instead of cache timing.",
      "It makes cold-start theme entry behave like the rest of the writing flow."
    ],
    centralQuestion: "How should a cold-start theme decide whether it can create a writing project?",
    items: [
      { noteId: noteA.json.item.id, shortLabel: "claim", rationale: "Sets the cold-start claim." },
      { noteId: noteB.json.item.id, shortLabel: "tension", rationale: "Adds the missing structure." }
    ]
  });
  assert.equal(coldTheme.status, 201, JSON.stringify(coldTheme.json));

  await page.goto(`${webBase}/prototype`, { waitUntil: "networkidle" });
  await page.locator('[data-action="quick-original"]').click();
  await page.locator('.explorer-item[data-kind="file"]', { hasText: "Cold Start Theme Claim" }).waitFor();
  await page.locator('.explorer-item[data-kind="file"]', { hasText: "Cold Start Theme Tension" }).waitFor();
  await page.locator('.rail-btn[data-module="writing"]').click();
  await page.locator('#writingThemeIndexList .writing-note-card', { hasText: "Cold Start Theme Index" }).click();
  await page.waitForFunction(() => {
    const value = document.querySelector("#writingThemeDetailTitle")?.value || "";
    return value.includes("Cold Start Theme Index");
  }, null, { timeout: 10000 });

  await waitForWritingThemeProjectActionReady(page);

  await page.click('[data-writing-theme-action="create-project"]');

  await waitFor(async () => {
    const resultText = await page.locator("#writingResult").textContent();
    assert.match(String(resultText || ""), /\"stage\": \"writing_project\"/);
  }, 10000);

  const projects = await fetchJson(apiBase, "/api/v1/writing-projects?limit=10");
  assert.equal(projects.status, 200, JSON.stringify(projects.json));
  const themedProject = projects.json.items.find((item) => item.title.includes("Cold Start Theme Index"));
  assert.ok(themedProject);
  assert.deepEqual(themedProject.related_index_ids, [coldTheme.json.item.id]);
});

test("prototype graph panel renders directory wikilinks and opens graph nodes", async (t) => {
  if (process.env.RUN_BROWSER_E2E !== "1") {
    t.skip("Set RUN_BROWSER_E2E=1 to enable browser e2e in local runs.");
    return;
  }

  const playwright = await optionalPlaywright(t);
  if (!playwright) return;

  const stack = await startPrototypeStack(t, playwright);
  if (!stack) return;
  const { apiBase, page, vaultPath, webBase } = stack;

  const graphDirectory = await postJson(apiBase, "/api/v1/directories", {
    title: "Graph UI Scope",
    parentDirectoryId: "dir_original_default",
    directoryType: "custom",
    fsPath: path.join(vaultPath, "notes", "original", "graph-ui-scope"),
    maxNotes: 500
  });
  assert.equal(graphDirectory.status, 201, JSON.stringify(graphDirectory.json));
  const graphDirectoryId = graphDirectory.json.item.id;

  const targetNote = await postJson(apiBase, "/api/v1/notes", {
    directoryId: graphDirectoryId,
    body: "# Graph target\n\nThis note should be opened from the graph."
  });
  assert.equal(targetNote.status, 201);

  const sourceNote = await postJson(apiBase, "/api/v1/notes", {
    directoryId: graphDirectoryId,
    body: "# Graph source\n\nThis note links to [[Graph target]] and should create one graph edge."
  });
  assert.equal(sourceNote.status, 201);

  const relation = await postJson(apiBase, `/api/v1/notes/${encodeURIComponent(sourceNote.json.item.id)}/relations`, {
    toNoteId: targetNote.json.item.id,
    relationType: "supports",
    rationale: "This explicit relation should be visible in the graph UI for the selected directory.",
    insightQuestion: "Can the graph panel render and open notes from an explicit directory-scoped relation?",
    confidence: 1
  });
  assert.equal(relation.status, 201, JSON.stringify(relation.json));

  await waitFor(async () => {
    const graph = await fetchJson(
      apiBase,
      `/api/v1/graph?scope=directory&directoryId=${encodeURIComponent(graphDirectoryId)}&includeDescendants=true`
    );
    assert.equal(graph.status, 200);
    assert.ok((graph.json.item?.totalNodes || 0) >= 2, JSON.stringify(graph.json));
    assert.ok((graph.json.item?.totalEdges || 0) >= 1, JSON.stringify(graph.json));
    return graph;
  }, 7000);

  await page.goto(`${webBase}/prototype`, { waitUntil: "networkidle" });
  await openOriginalNoteBox(page);
  await page.locator(`.explorer-item[data-kind="folder"][data-id="${graphDirectoryId}"]`).click();
  await page.waitForFunction((directoryId) => window.__prototypeState?.selectedFolderId === directoryId, graphDirectoryId);
  await waitFor(async () => {
    const explorerText = await page.locator("#listArea").textContent();
    assert.match(String(explorerText || ""), /Graph source/);
    assert.match(String(explorerText || ""), /Graph target/);
  }, 7000);
  await page.locator('.rail-btn[data-module="graph"]').click();

  await waitFor(async () => {
    await page.waitForSelector("#graphCanvas .graph-map-node", { timeout: 2000 });
    const summary = await page.locator("#graphSummary").textContent();
    const [nodeCount = 0, edgeCount = 0] = [...String(summary || "").matchAll(/\d+/g)].map((match) => Number(match[0]));
    assert.ok(nodeCount >= 2, summary || "");
    assert.ok(edgeCount >= 1, summary || "");
    await page.locator("#graphCanvas .graph-map-edge-group").first().waitFor({ timeout: 2000 });
  }, 7000);
  await page.locator(`#graphCanvas .graph-map-node[data-node-id="${targetNote.json.item.id}"]`).click();
  await page.locator(".graph-selection-panel", { hasText: "Graph target" }).waitFor({ timeout: 3000 });
  await page.locator(".graph-selection-panel", { hasText: /当前笔记|连接|打开笔记/ }).waitFor({ timeout: 3000 });
  await page.locator(`.graph-selection-panel [data-open-note="${targetNote.json.item.id}"]`).first().click();
  await page.waitForFunction((noteId) => {
    const state = window.__prototypeState || {};
    const activeTab = Array.isArray(state.tabs) ? state.tabs.find((tab) => tab.id === state.activeTabId) : null;
    return state.selectedFileId === noteId || activeTab?.noteId === noteId;
  }, targetNote.json.item.id);

  const selectionClose = page.locator("[data-graph-selection-close]").first();
  if (await selectionClose.isVisible().catch(() => false)) await selectionClose.click();
});

test("prototype graph panel bridge gap followup opens relation creation on an isolated note", async (t) => {
  if (process.env.RUN_BROWSER_E2E !== "1") {
    t.skip("Set RUN_BROWSER_E2E=1 to enable browser e2e in local runs.");
    return;
  }

  const playwright = await optionalPlaywright(t);
  if (!playwright) return;

  const stack = await startPrototypeStack(t, playwright);
  if (!stack) return;
  const { apiBase, page, vaultPath, webBase } = stack;

  const graphDirectory = await postJson(apiBase, "/api/v1/directories", {
    title: "Graph Bridge Scope",
    parentDirectoryId: "dir_original_default",
    directoryType: "custom",
    fsPath: path.join(vaultPath, "notes", "original", "graph-bridge-scope"),
    maxNotes: 500
  });
  assert.equal(graphDirectory.status, 201, JSON.stringify(graphDirectory.json));
  const graphDirectoryId = graphDirectory.json.item.id;

  const noteA = await postJson(apiBase, "/api/v1/notes", {
    directoryId: graphDirectoryId,
    body: "# Bridge Gap A\n\nThis note is currently isolated and should ask for a bridge relation."
  });
  assert.equal(noteA.status, 201);

  const noteB = await postJson(apiBase, "/api/v1/notes", {
    directoryId: graphDirectoryId,
    body: "# Bridge Gap B\n\nThis second isolated note creates a disconnected structure."
  });
  assert.equal(noteB.status, 201);

  await waitFor(async () => {
    const graph = await fetchJson(
      apiBase,
      `/api/v1/graph?scope=directory&directoryId=${encodeURIComponent(graphDirectoryId)}&includeDescendants=true`
    );
    assert.equal(graph.status, 200);
    assert.ok((graph.json.item?.totalNodes || 0) >= 2, JSON.stringify(graph.json));
    return graph;
  }, 7000);

  await page.goto(`${webBase}/prototype`, { waitUntil: "networkidle" });
  await openOriginalNoteBox(page);
  await page.locator(`.explorer-item[data-kind="folder"][data-id="${graphDirectoryId}"]`).click();
  await page.waitForFunction((directoryId) => window.__prototypeState?.selectedFolderId === directoryId, graphDirectoryId);
  await waitFor(async () => {
    const explorerText = await page.locator("#listArea").textContent();
    assert.match(String(explorerText || ""), /Bridge Gap A/);
    assert.match(String(explorerText || ""), /Bridge Gap B/);
  }, 7000);
  await page.evaluate(
    ({ noteId, targetNoteId }) =>
      window.__prototypeGraph?.openFollowupNote?.(noteId, "bridge", {
        targetNoteId,
        relationType: "bridges"
      }),
    { noteId: noteA.json.item.id, targetNoteId: noteB.json.item.id }
  );
  await page.waitForFunction(() => {
    const overlay = document.querySelector("[data-permanent-relation-workspace]");
    const form = overlay?.querySelector?.("[data-permanent-relation-form]");
    return Boolean(overlay && form);
  });
  await waitFor(async () => {
    assert.equal(await page.locator('.quick-entry.active.current-root[data-action="quick-original"]').count(), 1);
  }, 4000);
  await page.evaluate(() => window.__prototypeEditor?.onStatus?.("桥接动作后的失败提示", "bad"));
  await waitFor(async () => {
    const statusText = await currentStatusText(page);
    assert.match(String(statusText || ""), /桥接动作后的失败提示/);
  }, 4000);

  const relationFormText = await page.locator("[data-permanent-relation-workspace]").textContent();
  assert.ok(String(relationFormText || "").trim().length > 0);
  assert.match(String(relationFormText || ""), /Bridge Gap A/);
  assert.match(String(relationFormText || ""), /桥接/);
});

test("prototype graph panel tension followup opens boundary field on the source note", async (t) => {
  if (process.env.RUN_BROWSER_E2E !== "1") {
    t.skip("Set RUN_BROWSER_E2E=1 to enable browser e2e in local runs.");
    return;
  }

  const playwright = await optionalPlaywright(t);
  if (!playwright) return;

  const stack = await startPrototypeStack(t, playwright);
  if (!stack) return;
  const { apiBase, page, vaultPath, webBase } = stack;

  const graphDirectory = await postJson(apiBase, "/api/v1/directories", {
    title: "Graph Tension Scope",
    parentDirectoryId: "dir_original_default",
    directoryType: "custom",
    fsPath: path.join(vaultPath, "notes", "original", "graph-tension-scope"),
    maxNotes: 500
  });
  assert.equal(graphDirectory.status, 201, JSON.stringify(graphDirectory.json));
  const graphDirectoryId = graphDirectory.json.item.id;

  const noteA = await postJson(apiBase, "/api/v1/notes", {
    directoryId: graphDirectoryId,
    body: "# Tension Source\n\nThis note should be opened so the user can add a sharper boundary."
  });
  assert.equal(noteA.status, 201);

  const noteB = await postJson(apiBase, "/api/v1/notes", {
    directoryId: graphDirectoryId,
    body: "# Tension Target\n\nThis note is challenged by the source note."
  });
  assert.equal(noteB.status, 201);

  const relation = await postJson(apiBase, `/api/v1/notes/${encodeURIComponent(noteA.json.item.id)}/relations`, {
    toNoteId: noteB.json.item.id,
    relationType: "counterexample_to",
    rationale: "The source note provides a counterexample that should push the user to clarify the boundary.",
    insightQuestion: "What boundary would keep this judgment from overreaching?",
    confidence: 1
  });
  assert.equal(relation.status, 201, JSON.stringify(relation.json));

  await waitFor(async () => {
    const graph = await fetchJson(
      apiBase,
      `/api/v1/graph?scope=directory&directoryId=${encodeURIComponent(graphDirectoryId)}&includeDescendants=true`
    );
    assert.equal(graph.status, 200);
    assert.ok((graph.json.item?.totalNodes || 0) >= 2, JSON.stringify(graph.json));
    assert.ok((graph.json.item?.totalEdges || 0) >= 1, JSON.stringify(graph.json));
    return graph;
  }, 7000);

  await page.goto(`${webBase}/prototype`, { waitUntil: "networkidle" });
  await openOriginalNoteBox(page);
  await page.locator(`.explorer-item[data-kind="folder"][data-id="${graphDirectoryId}"]`).click();
  await page.waitForFunction((directoryId) => window.__prototypeState?.selectedFolderId === directoryId, graphDirectoryId);
  await waitFor(async () => {
    const explorerText = await page.locator("#listArea").textContent();
    assert.match(String(explorerText || ""), /Tension Source/);
    assert.match(String(explorerText || ""), /Tension Target/);
  }, 7000);
  await page.evaluate(
    ({ noteId, targetNoteId }) =>
      window.__prototypeGraph?.openFollowupNote?.(noteId, "tension", {
        targetNoteId,
        relationType: "counterexample_to"
      }),
    { noteId: noteA.json.item.id, targetNoteId: noteB.json.item.id }
  );
  await page.waitForFunction(() => {
    const boundaryField = document.querySelector('[data-note-distillation-form] textarea[name="boundaryOrCounterpoint"]');
    return Boolean(boundaryField);
  });

  const boundaryValue = await page.locator('[data-note-distillation-form] textarea[name="boundaryOrCounterpoint"]').inputValue();
  assert.ok(String(boundaryValue || "").trim().length > 0);
});

test("prototype graph ai analysis badge counts candidates and opens on failure", async (t) => {
  if (process.env.RUN_BROWSER_E2E !== "1") {
    t.skip("Set RUN_BROWSER_E2E=1 to enable browser e2e in local runs.");
    return;
  }

  const playwright = await optionalPlaywright(t);
  if (!playwright) return;

  let aiAnalysisMode = "success";
  const requestedDirectoryIds = [];
  const stack = await startPrototypeStack(t, playwright, {
    beforeGoto: async (page) => {
      await page.route("**/api/v1/graph/ai-analysis", async (route) => {
        const payload = route.request().postDataJSON?.() || {};
        requestedDirectoryIds.push(String(payload.directoryId || ""));
        if (aiAnalysisMode === "fail") {
          await route.abort("failed");
          return;
        }
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            item: {
              directoryId: "dir_original_default",
              analysis: {
                topicCandidates: [{ id: "topic-1" }],
                relationCandidates: [{ id: "relation-1" }],
                bridgeCandidates: [{ id: "bridge-1" }],
                isolatedNotes: [{ noteId: "pn-isolated-1" }]
              },
              reviewItems: {
                summary: {
                  artifactCount: 0,
                  topicCandidateCount: 1,
                  relationCandidateCount: 1,
                  bridgeCandidateCount: 1,
                  isolatedNoteCount: 1
                },
                artifacts: []
              }
            }
          })
        });
      });
    }
  });
  if (!stack) return;
  const { apiBase, page, vaultPath, webBase } = stack;

  const graphDirectory = await postJson(apiBase, "/api/v1/directories", {
    title: "Graph AI Scope",
    parentDirectoryId: "dir_original_default",
    directoryType: "custom",
    fsPath: path.join(vaultPath, "notes", "original", "graph-ai-scope"),
    maxNotes: 500
  });
  assert.equal(graphDirectory.status, 201, JSON.stringify(graphDirectory.json));
  const graphDirectoryId = graphDirectory.json.item.id;
  const seedNote = await postJson(apiBase, "/api/v1/notes", {
    directoryId: graphDirectoryId,
    body: "# Graph AI Seed\n\nThis note ensures the graph workspace has a concrete directory context."
  });
  assert.equal(seedNote.status, 201, JSON.stringify(seedNote.json));

  await page.goto(`${webBase}/prototype`, { waitUntil: "networkidle" });
  await openOriginalNoteBox(page);
  await page.locator(`.explorer-item[data-kind="folder"][data-id="${graphDirectoryId}"]`).click();
  await page.waitForFunction((directoryId) => window.__prototypeState?.selectedFolderId === directoryId, graphDirectoryId);
  await waitFor(async () => {
    const explorerText = await page.locator("#listArea").textContent();
    assert.match(String(explorerText || ""), /Graph AI Seed/);
  }, 7000);
  await page.evaluate(() => window.__prototypeGraph?.runAiAnalysis?.());

  await waitFor(async () => {
    assert.equal(requestedDirectoryIds.at(-1), graphDirectoryId);
    const badgeCount = await page.locator('[data-graph-section="ai-analysis"] .graph-collapsible-badge').count();
    if (badgeCount > 0) {
      const badge = await page.locator('[data-graph-section="ai-analysis"] .graph-collapsible-badge').textContent();
      assert.match(String(badge || ""), /4 项/);
    }
  }, 4000);

  aiAnalysisMode = "fail";
  await page.evaluate(() => window.__prototypeGraph?.runAiAnalysis?.());

  await waitFor(async () => {
    const sectionCount = await page.locator('[data-graph-section="ai-analysis"]').count();
    if (sectionCount > 0) {
      assert.equal(await page.locator('[data-graph-section="ai-analysis"]').evaluate((node) => node.hasAttribute("open")), true);
      const errorText = await page.locator('[data-graph-section="ai-analysis"] .graph-empty.bad').textContent();
      assert.match(String(errorText || ""), /AI 图谱初判失败/);
      return;
    }
    const statusText = await currentStatusText(page);
    assert.match(String(statusText || ""), /AI 图谱初判失败/);
  }, 7000);
});

test("prototype graph AI connect suggests a relation from notes without relation data", async (t) => {
  if (process.env.RUN_BROWSER_E2E !== "1") {
    t.skip("Set RUN_BROWSER_E2E=1 to enable browser e2e in local runs.");
    return;
  }

  const playwright = await optionalPlaywright(t);
  if (!playwright) return;

  let sourceNoteId = "";
  let targetNoteId = "";
  let graphDirectoryId = "";
  const stack = await startPrototypeStack(t, playwright, {
    beforeGoto: async (page) => {
      await page.route("**/api/v1/graph/ai-analysis", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            item: {
              directoryId: graphDirectoryId,
              analysis: {
                analysisMode: "local_graph_rule",
                relationCount: 0,
                relationCandidates: [
                  {
                    fromNoteId: sourceNoteId,
                    toNoteId: targetNoteId,
                    relationType: "supports",
                    rationale: "Local scan found shared relation-review language.",
                    evidence: [
                      { noteId: sourceNoteId, summary: "AI relation candidates should remain reviewable." },
                      { noteId: targetNoteId, summary: "Human confirmation turns candidates into graph edges." }
                    ],
                    confidence: 0.72,
                    status: "suggested",
                    componentBridge: true
                  }
                ],
                bridgeCandidates: [],
                isolatedNotes: [{ noteId: sourceNoteId }]
              },
              reviewItems: {
                summary: {
                  artifactCount: 1,
                  relationCandidateCount: 1,
                  bridgeCandidateCount: 0,
                  isolatedNoteCount: 1,
                  canAutoConfirm: false
                },
                artifacts: []
              }
            }
          })
        });
      });
    }
  });
  if (!stack) return;
  const { apiBase, page, vaultPath, webBase } = stack;

  const graphDirectory = await postJson(apiBase, "/api/v1/directories", {
    title: "Graph AI Connect No Relations",
    parentDirectoryId: "dir_original_default",
    directoryType: "custom",
    fsPath: path.join(vaultPath, "notes", "original", "graph-ai-connect-no-relations"),
    maxNotes: 500
  });
  assert.equal(graphDirectory.status, 201, JSON.stringify(graphDirectory.json));
  graphDirectoryId = graphDirectory.json.item.id;

  const sourceNote = await postJson(apiBase, "/api/v1/notes", {
    directoryId: graphDirectoryId,
    body: "# AI Review Source\n\nAI relation candidates should remain reviewable suggestions. #ai-review"
  });
  const targetNote = await postJson(apiBase, "/api/v1/notes", {
    directoryId: graphDirectoryId,
    body: "# AI Review Target\n\nHuman confirmation turns candidates into graph edges. #ai-review"
  });
  assert.equal(sourceNote.status, 201, JSON.stringify(sourceNote.json));
  assert.equal(targetNote.status, 201, JSON.stringify(targetNote.json));
  sourceNoteId = sourceNote.json.item.id;
  targetNoteId = targetNote.json.item.id;

  const graphBeforeAnalysis = await fetchJson(
    apiBase,
    `/api/v1/graph?scope=directory&directoryId=${encodeURIComponent(graphDirectoryId)}&includeDescendants=true`
  );
  assert.equal(graphBeforeAnalysis.status, 200, JSON.stringify(graphBeforeAnalysis.json));
  assert.equal(graphBeforeAnalysis.json.item.totalEdges, 0);

  await page.goto(`${webBase}/prototype`, { waitUntil: "networkidle" });
  await openOriginalNoteBox(page);
  await page.locator(`.explorer-item[data-kind="folder"][data-id="${graphDirectoryId}"]`).click();
  await page.waitForFunction((directoryId) => window.__prototypeState?.selectedFolderId === directoryId, graphDirectoryId);
  await page.locator('.rail-btn[data-module="graph"]').click();
  await page.locator("#graphCanvas").waitFor({ state: "visible", timeout: 7000 });
  await page.locator(`#graphCanvas .graph-map-node[data-node-id="${sourceNoteId}"]`).waitFor({ timeout: 7000 });
  await page.evaluate((noteId) => window.__prototypeGraph?.runAiConnectForNote?.(noteId), sourceNoteId);

  await waitFor(async () => {
    const panelText = await page.locator(".graph-selection-panel").first().textContent();
    assert.match(String(panelText || ""), /AI Review Source|关联工作台|未关联/);
    assert.match(String(panelText || ""), /保存关系|查找推荐|自己搜索/);
  }, 7000);

  const aiCandidateSelect = page.locator(".graph-selection-panel [data-graph-ai-candidate-select]");
  await aiCandidateSelect.waitFor({ state: "visible", timeout: 7000 });
  await aiCandidateSelect.selectOption(targetNoteId);
  await page.locator(".graph-selection-panel [data-graph-isolated-rationale]").fill("AI 推荐指出两条笔记都在说明候选关系需要人工确认。");
  await page.locator(".graph-selection-panel [data-graph-isolated-relation-save]").click();
  await waitFor(async () => {
    const relations = await fetchJson(apiBase, `/api/v1/notes/${encodeURIComponent(sourceNoteId)}/relations`);
    assert.equal(relations.status, 200, JSON.stringify(relations.json));
    assert.equal(relations.json.item.outgoingLinks.length, 1);
    assert.equal(relations.json.item.outgoingLinks[0].toNoteId, targetNoteId);
  }, 10000);
  assert.equal(await page.locator("[data-create-relation-form]").count(), 0);
});

test("prototype graph local candidate save removes isolated state and updates graph", async (t) => {
  if (process.env.RUN_BROWSER_E2E !== "1") {
    t.skip("Set RUN_BROWSER_E2E=1 to enable browser e2e in local runs.");
    return;
  }

  const playwright = await optionalPlaywright(t);
  if (!playwright) return;

  const stack = await startPrototypeStack(t, playwright);
  if (!stack) return;
  const { apiBase, page, vaultPath, webBase } = stack;

  const graphDirectory = await postJson(apiBase, "/api/v1/directories", {
    title: "Graph Local Candidate Scope",
    parentDirectoryId: "dir_original_default",
    directoryType: "custom",
    fsPath: path.join(vaultPath, "notes", "original", "graph-local-candidate-scope"),
    maxNotes: 500
  });
  assert.equal(graphDirectory.status, 201, JSON.stringify(graphDirectory.json));
  const graphDirectoryId = graphDirectory.json.item.id;

  const source = await postJson(apiBase, "/api/v1/notes", {
    directoryId: graphDirectoryId,
    body: "# Aaa Local Source\n\nThis note is isolated for now, but it shares #graphlocalbridge with one nearby note."
  });
  const target = await postJson(apiBase, "/api/v1/notes", {
    directoryId: graphDirectoryId,
    body: "# Bbb Local Target\n\nThis note also carries #graphlocalbridge so the graph can suggest a local connection."
  });
  assert.equal(source.status, 201, JSON.stringify(source.json));
  assert.equal(target.status, 201, JSON.stringify(target.json));

  const graphBefore = await fetchJson(
    apiBase,
    `/api/v1/graph?scope=directory&directoryId=${encodeURIComponent(graphDirectoryId)}&includeDescendants=true`
  );
  assert.equal(graphBefore.status, 200, JSON.stringify(graphBefore.json));
  assert.equal(graphBefore.json.item.totalEdges, 0);

  await page.goto(`${webBase}/prototype`, { waitUntil: "networkidle" });
  await openOriginalNoteBox(page);
  await page.locator(`.explorer-item[data-kind="folder"][data-id="${graphDirectoryId}"]`).click();
  await page.waitForFunction((directoryId) => window.__prototypeState?.selectedFolderId === directoryId, graphDirectoryId);
  await page.locator('.rail-btn[data-module="graph"]').click();
  await page.locator(`#graphCanvas .graph-map-node[data-node-id="${source.json.item.id}"]`).waitFor({ timeout: 7000 });
  await page.locator(`#graphCanvas .graph-map-node[data-node-id="${source.json.item.id}"]`).click();

  await waitFor(async () => {
    assert.equal(await page.locator(".graph-selection-panel .graph-isolated-join").count(), 1);
    const selectionText = await page.locator(".graph-selection-panel").textContent();
    assert.match(String(selectionText || ""), /Aaa Local Source/);
    assert.match(String(selectionText || ""), /关联工作台|未关联/);
    assert.match(String(selectionText || ""), /推荐目标|自己搜索|查找推荐/);
  }, 7000);

  await page.locator('.graph-selection-panel [data-graph-isolated-tab="manual"]').click();
  await page.locator(".graph-selection-panel [data-graph-manual-target-search]").fill("Bbb");
  await waitFor(async () => {
    assert.equal(await page.locator('.graph-selection-panel [data-graph-pick-manual-target]:has-text("Bbb Local Target")').first().isVisible(), true);
    assert.equal(await page.locator("[data-create-relation-form]").count(), 0);
  }, 7000);

  await page.locator('.graph-selection-panel [data-graph-pick-manual-target]:has-text("Bbb Local Target")').first().click();
  await page.locator(".graph-selection-panel [data-graph-isolated-relation-type]").selectOption("supports");
  await page.locator(".graph-selection-panel [data-graph-isolated-rationale]").fill("两条笔记都在说明同一个测试主题，需要放入同一张关系网。");
  await page.locator(".graph-selection-panel [data-graph-manual-target-search]").fill("No stale target");
  await page.locator(".graph-selection-panel [data-graph-isolated-relation-save]").click();
  await waitFor(async () => {
    const errorText = await page.locator(".graph-selection-panel [data-graph-isolated-form-error]").textContent();
    assert.match(String(errorText || ""), /请先搜索并选择一条目标笔记/);
    const relations = await fetchJson(apiBase, `/api/v1/notes/${encodeURIComponent(source.json.item.id)}/relations`);
    assert.equal(relations.status, 200, JSON.stringify(relations.json));
    assert.equal(relations.json.item.outgoingLinks.length, 0);
  }, 7000);

  await page.locator(".graph-selection-panel [data-graph-manual-target-search]").fill("Bbb");
  await page.locator('.graph-selection-panel [data-graph-pick-manual-target]:has-text("Bbb Local Target")').first().click();
  await page.locator(".graph-selection-panel [data-graph-isolated-relation-save]").click();
  await waitFor(async () => {
    const relations = await fetchJson(apiBase, `/api/v1/notes/${encodeURIComponent(source.json.item.id)}/relations`);
    assert.equal(relations.status, 200, JSON.stringify(relations.json));
    assert.equal(relations.json.item.outgoingLinks.length, 1);
    assert.equal(relations.json.item.outgoingLinks[0].toNoteId, target.json.item.id);
    assert.equal(relations.json.item.outgoingLinks[0].relationType, "supports");
  }, 10000);

  const relations = await fetchJson(apiBase, `/api/v1/notes/${encodeURIComponent(source.json.item.id)}/relations`);
  assert.equal(relations.status, 200, JSON.stringify(relations.json));
  assert.equal(relations.json.item.outgoingLinks.length, 1);
  assert.equal(relations.json.item.outgoingLinks[0].toNoteId, target.json.item.id);
  assert.equal(relations.json.item.outgoingLinks[0].relationType, "supports");

  await page.locator('.rail-btn[data-module="graph"]').click();
  await waitFor(async () => {
    const summary = await page.locator("#graphSummary").textContent();
    const [nodeCount = 0, edgeCount = 0] = [...String(summary || "").matchAll(/\d+/g)].map((match) => Number(match[0]));
    assert.ok(nodeCount >= 2, summary || "");
    assert.ok(edgeCount >= 1, summary || "");
  }, 10000);

  await waitFor(async () => {
    const hasIsolatedKey = await page.locator(`#graphCanvas .graph-map-node[data-node-id="${source.json.item.id}"]`).evaluate((node) =>
      node.hasAttribute("data-graph-isolated-key")
    );
    assert.equal(hasIsolatedKey, false);
    assert.equal(await page.locator(".graph-isolated-queue-strip").count(), 0);
    assert.equal(await page.locator(`#graphCanvas .graph-map-node[data-node-id="${target.json.item.id}"]`).count(), 1);
    const savedEdgeCount = await page.locator(`#graphCanvas .graph-map-edge-group[data-edge-from="${source.json.item.id}"][data-edge-to="${target.json.item.id}"], #graphCanvas .graph-map-edge-group[data-edge-from="${target.json.item.id}"][data-edge-to="${source.json.item.id}"]`).count();
    assert.equal(savedEdgeCount, 1);
  }, 7000);

  await waitFor(async () => {
    assert.equal(await page.locator(".graph-selection-panel .graph-isolated-join").count(), 0);
    assert.equal(await page.locator(".graph-selection-panel .graph-isolated-complete-card").count(), 1);
    const workspaceText = await page.locator(".graph-selection-panel").textContent();
    assert.match(String(workspaceText || ""), /已接入关系网|关系已保存/);
    assert.match(String(workspaceText || ""), /Bbb Local Target/);
    assert.equal(await page.locator("[data-graph-isolated-relation-form]").count(), 0);
  }, 7000);
});

test("prototype graph relation workspace creates a theme index from linked notes", async (t) => {
  if (process.env.RUN_BROWSER_E2E !== "1") {
    t.skip("Set RUN_BROWSER_E2E=1 to enable browser e2e in local runs.");
    return;
  }

  const playwright = await optionalPlaywright(t);
  if (!playwright) return;

  const stack = await startPrototypeStack(t, playwright);
  if (!stack) return;
  const { apiBase, page, vaultPath, webBase } = stack;

  const graphDirectory = await postJson(apiBase, "/api/v1/directories", {
    title: "Graph Theme Index Scope",
    parentDirectoryId: "dir_original_default",
    directoryType: "custom",
    fsPath: path.join(vaultPath, "notes", "original", "graph-theme-index-scope"),
    maxNotes: 500
  });
  assert.equal(graphDirectory.status, 201, JSON.stringify(graphDirectory.json));
  const graphDirectoryId = graphDirectory.json.item.id;

  const noteA = await postJson(apiBase, "/api/v1/notes", {
    directoryId: graphDirectoryId,
    body: "# Theme Index Source\n\nThis permanent note can become the center of a small theme network."
  });
  const noteB = await postJson(apiBase, "/api/v1/notes", {
    directoryId: graphDirectoryId,
    body: "# Theme Index Target\n\nThis permanent note supports the same theme network."
  });
  const noteC = await postJson(apiBase, "/api/v1/notes", {
    directoryId: graphDirectoryId,
    body: "# Theme Index Bridge\n\nThis permanent note bridges the same theme network."
  });
  assert.equal(noteA.status, 201, JSON.stringify(noteA.json));
  assert.equal(noteB.status, 201, JSON.stringify(noteB.json));
  assert.equal(noteC.status, 201, JSON.stringify(noteC.json));

  const relation = await postJson(apiBase, `/api/v1/notes/${encodeURIComponent(noteA.json.item.id)}/relations`, {
    toNoteId: noteB.json.item.id,
    relationType: "supports",
    rationale: "The target note supports the source note as part of one theme network.",
    insightQuestion: "What central question does this small network answer?",
    confidence: 1
  });
  assert.equal(relation.status, 201, JSON.stringify(relation.json));
  const bridgeRelation = await postJson(apiBase, `/api/v1/notes/${encodeURIComponent(noteA.json.item.id)}/relations`, {
    toNoteId: noteC.json.item.id,
    relationType: "bridges",
    rationale: "The bridge note keeps the theme network coherent.",
    insightQuestion: "What bridge does this network need?",
    confidence: 1
  });
  assert.equal(bridgeRelation.status, 201, JSON.stringify(bridgeRelation.json));

  await page.goto(`${webBase}/prototype`, { waitUntil: "networkidle" });
  await openOriginalNoteBox(page);
  await page.locator(`.explorer-item[data-kind="folder"][data-id="${graphDirectoryId}"]`).click();
  await page.waitForFunction((directoryId) => window.__prototypeState?.selectedFolderId === directoryId, graphDirectoryId);
  await page.locator('.rail-btn[data-module="graph"]').click();
  await page.waitForSelector(`#graphCanvas .graph-map-node[data-node-id="${noteA.json.item.id}"]`, { timeout: 7000 });
  await page.locator(`#graphCanvas .graph-map-node[data-node-id="${noteA.json.item.id}"]`).click();

  await waitFor(async () => {
    const workspaceText = await page.locator(".graph-relation-workspace").textContent();
    assert.match(String(workspaceText || ""), /现有关联/);
    assert.match(String(workspaceText || ""), /创建主题草稿/);
  }, 7000);

  await page.locator('[data-graph-create-theme-index]:not([disabled]):visible').first().click();
  await waitFor(async () => {
    const statusText = await currentStatusText(page);
    assert.match(String(statusText || ""), /已创建主题草稿/);
  }, 7000);

  const indexes = await fetchJson(
    apiBase,
    `/api/v1/index-cards?directoryId=${encodeURIComponent(graphDirectoryId)}&includeDescendants=true&indexType=topic&limit=12`
  );
  assert.equal(indexes.status, 200, JSON.stringify(indexes.json));
  assert.ok((indexes.json.items || []).some((item) => String(item.title || "").includes("可写主题")));
});

test("prototype graph followup remembers relation template preference after reload", async (t) => {
  if (process.env.RUN_BROWSER_E2E !== "1") {
    t.skip("Set RUN_BROWSER_E2E=1 to enable browser e2e in local runs.");
    return;
  }

  const playwright = await optionalPlaywright(t);
  if (!playwright) return;

  const stack = await startPrototypeStack(t, playwright);
  if (!stack) return;
  const { apiBase, page, vaultPath, webBase } = stack;

  const graphDirectory = await postJson(apiBase, "/api/v1/directories", {
    title: "Graph Template Preference Scope",
    parentDirectoryId: "dir_original_default",
    directoryType: "custom",
    fsPath: path.join(vaultPath, "notes", "original", "graph-template-preference-scope"),
    maxNotes: 500
  });
  assert.equal(graphDirectory.status, 201, JSON.stringify(graphDirectory.json));
  const graphDirectoryId = graphDirectory.json.item.id;

  const noteA = await postJson(apiBase, "/api/v1/notes", {
    directoryId: graphDirectoryId,
    body: "# Template Preference A\n\nThis isolated note should use the remembered graph relation template."
  });
  assert.equal(noteA.status, 201, JSON.stringify(noteA.json));

  const noteB = await postJson(apiBase, "/api/v1/notes", {
    directoryId: graphDirectoryId,
    body: "# Template Preference B\n\nThis second isolated note keeps the bridge followup available after reload."
  });
  assert.equal(noteB.status, 201, JSON.stringify(noteB.json));

  await waitFor(async () => {
    const graph = await fetchJson(
      apiBase,
      `/api/v1/graph?scope=directory&directoryId=${encodeURIComponent(graphDirectoryId)}&includeDescendants=true`
    );
    assert.equal(graph.status, 200);
    assert.ok((graph.json.item?.totalNodes || 0) >= 2, JSON.stringify(graph.json));
    return graph;
  }, 7000);

  await page.goto(`${webBase}/prototype`, { waitUntil: "networkidle" });
  await openOriginalNoteBox(page);
  await page.evaluate(() => localStorage.removeItem("yansilu:template-variant:relation"));
  await page.locator(`.explorer-item[data-kind="folder"][data-id="${graphDirectoryId}"]`).click();
  await page.waitForFunction((directoryId) => window.__prototypeState?.selectedFolderId === directoryId, graphDirectoryId);
  await waitFor(async () => {
    const explorerText = await page.locator("#listArea").textContent();
    assert.match(String(explorerText || ""), /Template Preference A/);
    assert.match(String(explorerText || ""), /Template Preference B/);
  }, 7000);
  await page.evaluate(
    ({ noteId, targetNoteId }) =>
      window.__prototypeGraph?.openFollowupNote?.(noteId, "bridge", {
        targetNoteId,
        relationType: "bridges"
      }),
    { noteId: noteA.json.item.id, targetNoteId: noteB.json.item.id }
  );
  await page.waitForSelector("[data-permanent-relation-workspace] [data-permanent-relation-form]", { state: "visible" });
  await waitFor(async () => {
    const overlayText = await page.locator("[data-permanent-relation-workspace]").textContent();
    assert.match(String(overlayText || ""), /Template Preference A/);
    assert.match(String(overlayText || ""), /Template Preference B/);
    const relationType = await page.locator('[data-permanent-relation-form] select[name="relationType"]').inputValue();
    assert.equal(relationType, "bridges");
  }, 4000);

  await page.goto(`${webBase}/prototype`, { waitUntil: "networkidle" });
  await openOriginalNoteBox(page);
  await page.locator(`.explorer-item[data-kind="folder"][data-id="${graphDirectoryId}"]`).click();
  await page.waitForFunction((directoryId) => window.__prototypeState?.selectedFolderId === directoryId, graphDirectoryId);
  await page.evaluate(
    ({ noteId, targetNoteId }) =>
      window.__prototypeGraph?.openFollowupNote?.(noteId, "bridge", {
        targetNoteId,
        relationType: "bridges"
      }),
    { noteId: noteA.json.item.id, targetNoteId: noteB.json.item.id }
  );
  await page.waitForSelector("[data-permanent-relation-workspace] [data-permanent-relation-form]", { state: "visible" });
  await waitFor(async () => {
    const overlayText = await page.locator("[data-permanent-relation-workspace]").textContent();
    assert.match(String(overlayText || ""), /Template Preference A/);
    assert.match(String(overlayText || ""), /Template Preference B/);
    const relationType = await page.locator('[data-permanent-relation-form] select[name="relationType"]').inputValue();
    assert.equal(relationType, "bridges");
    assert.equal(await page.locator('[data-permanent-relation-workspace] .semantic-template-memory').count(), 0);
  }, 4000);
});

test("prototype graph followup can clear remembered template preference for relation and boundary flows", async (t) => {
  if (process.env.RUN_BROWSER_E2E !== "1") {
    t.skip("Set RUN_BROWSER_E2E=1 to enable browser e2e in local runs.");
    return;
  }

  const playwright = await optionalPlaywright(t);
  if (!playwright) return;

  const stack = await startPrototypeStack(t, playwright);
  if (!stack) return;
  const { apiBase, page, vaultPath, webBase } = stack;

  const graphDirectory = await postJson(apiBase, "/api/v1/directories", {
    title: "Graph Template Clear Scope",
    parentDirectoryId: "dir_original_default",
    directoryType: "custom",
    fsPath: path.join(vaultPath, "notes", "original", "graph-template-clear-scope"),
    maxNotes: 500
  });
  assert.equal(graphDirectory.status, 201, JSON.stringify(graphDirectory.json));
  const graphDirectoryId = graphDirectory.json.item.id;

  const bridgeSource = await postJson(apiBase, "/api/v1/notes", {
    directoryId: graphDirectoryId,
    body: "# Template Clear Bridge Source\n\nThis note should expose a remembered bridge template preference."
  });
  assert.equal(bridgeSource.status, 201, JSON.stringify(bridgeSource.json));

  const bridgeTarget = await postJson(apiBase, "/api/v1/notes", {
    directoryId: graphDirectoryId,
    body: "# Template Clear Bridge Target\n\nThis note keeps the bridge followup visible."
  });
  assert.equal(bridgeTarget.status, 201, JSON.stringify(bridgeTarget.json));

  const tensionSource = await postJson(apiBase, "/api/v1/notes", {
    directoryId: graphDirectoryId,
    body: "# Template Clear Tension Source\n\nThis note should expose a remembered boundary template preference."
  });
  assert.equal(tensionSource.status, 201, JSON.stringify(tensionSource.json));

  const tensionTarget = await postJson(apiBase, "/api/v1/notes", {
    directoryId: graphDirectoryId,
    body: "# Template Clear Tension Target\n\nThis note is challenged by the tension source."
  });
  assert.equal(tensionTarget.status, 201, JSON.stringify(tensionTarget.json));

  const tensionRelation = await postJson(apiBase, `/api/v1/notes/${encodeURIComponent(tensionSource.json.item.id)}/relations`, {
    toNoteId: tensionTarget.json.item.id,
    relationType: "counterexample_to",
    rationale: "The source note needs a remembered boundary template so the user can sharpen the counterexample.",
    insightQuestion: "What boundary should remain visible after clearing the remembered template?",
    confidence: 1
  });
  assert.equal(tensionRelation.status, 201, JSON.stringify(tensionRelation.json));

  await waitFor(async () => {
    const graph = await fetchJson(
      apiBase,
      `/api/v1/graph?scope=directory&directoryId=${encodeURIComponent(graphDirectoryId)}&includeDescendants=true`
    );
    assert.equal(graph.status, 200);
    assert.ok((graph.json.item?.totalNodes || 0) >= 4, JSON.stringify(graph.json));
    assert.ok((graph.json.item?.totalEdges || 0) >= 1, JSON.stringify(graph.json));
    return graph;
  }, 7000);

  await page.goto(`${webBase}/prototype`, { waitUntil: "networkidle" });
  await openOriginalNoteBox(page);
  await page.evaluate(() => {
    localStorage.setItem("yansilu:template-variant:relation", "product");
    localStorage.setItem("yansilu:template-variant:distillation", "product");
  });
  await page.locator(`.explorer-item[data-kind="folder"][data-id="${graphDirectoryId}"]`).click();
  await page.waitForFunction((directoryId) => window.__prototypeState?.selectedFolderId === directoryId, graphDirectoryId);
  await waitFor(async () => {
    const explorerText = await page.locator("#listArea").textContent();
    assert.match(String(explorerText || ""), /Template Clear Bridge Source/);
    assert.match(String(explorerText || ""), /Template Clear Tension Source/);
  }, 7000);
  await page.evaluate(
    ({ noteId, targetNoteId }) =>
      window.__prototypeGraph?.openFollowupNote?.(noteId, "bridge", {
        targetNoteId,
        relationType: "bridges"
      }),
    { noteId: bridgeSource.json.item.id, targetNoteId: bridgeTarget.json.item.id }
  );
  await page.waitForSelector("[data-permanent-relation-workspace] [data-permanent-relation-form]", { state: "visible" });
  await waitFor(async () => {
    assert.equal(await page.locator('[data-permanent-relation-workspace] .semantic-template-memory').count(), 0);
    assert.equal(await page.locator('[data-permanent-relation-workspace] [data-template-preference-clear="relation"]').count(), 0);
    const stored = await page.evaluate(() => localStorage.getItem("yansilu:template-variant:relation"));
    assert.equal(stored, "product");
  }, 4000);

  await page.evaluate(
    ({ noteId, targetNoteId }) =>
      window.__prototypeGraph?.openFollowupNote?.(noteId, "tension", {
        targetNoteId,
        relationType: "counterexample_to"
      }),
    { noteId: tensionSource.json.item.id, targetNoteId: tensionTarget.json.item.id }
  );
  await page.waitForSelector('[data-note-distillation-form] textarea[name="boundaryOrCounterpoint"]', { state: "visible" });
  await waitFor(async () => {
    const memoryHint = await page.locator('[data-note-distillation-form] .semantic-template-memory').textContent();
    assert.match(String(memoryHint || ""), /产品版/);
  }, 4000);
  await page.locator('[data-note-distillation-form] [data-template-preference-clear="distillation"]').click();

  await waitFor(async () => {
    assert.equal(await page.locator('[data-note-distillation-form] .semantic-template-memory').count(), 0);
    const stored = await page.evaluate(() => localStorage.getItem("yansilu:template-variant:distillation"));
    assert.equal(stored, null);
  }, 4000);
});

test("prototype route shell exposes graph workspace without explorer rail assumptions", async (t) => {
  if (process.env.RUN_BROWSER_E2E !== "1") {
    t.skip("Set RUN_BROWSER_E2E=1 to enable browser e2e in local runs.");
    return;
  }

  const playwright = await optionalPlaywright(t);
  if (!playwright) return;

  const stack = await startPrototypeStack(t, playwright);
  if (!stack) return;
  const { page, webBase } = stack;

  await page.goto(`${webBase}/prototype`, { waitUntil: "networkidle" });

  await waitFor(async () => {
    assert.equal(await page.locator('.rail-btn[data-module="graph"]').count(), 1);
    assert.equal(await page.locator('.rail-btn[data-module="explorer"]').count(), 0);
    assert.equal(await page.locator("#statusBar").count(), 1);
    assert.equal(await page.locator("#statusText").count(), 1);
  }, 4000);

  await page.locator('.rail-btn[data-module="graph"]').click();

  await waitFor(async () => {
    const summary = await page.locator("#graphSummary").textContent();
    assert.ok(String(summary || "").trim().length > 0);
    await page.locator("#graphCanvas").waitFor({ state: "visible", timeout: 500 });
  }, 7000);
});


test("prototype smart notes startup demo opens the guide note without duplicating seed data", async (t) => {
  if (process.env.RUN_BROWSER_E2E !== "1") {
    t.skip("Set RUN_BROWSER_E2E=1 to enable browser e2e in local runs.");
    return;
  }

  const playwright = await optionalPlaywright(t);
  if (!playwright) return;

  const stack = await startPrototypeStack(t, playwright);
  if (!stack) return;
  const { apiBase, page, webBase } = stack;

  await page.goto(`${webBase}/prototype?demo=smart-notes-product-thinking`, { waitUntil: "networkidle" });

  await waitFor(async () => {
    const statusText = await currentStatusText(page);
    assert.match(String(statusText || ""), /Smart Notes 产品思考 Demo/);
    assert.match(String(statusText || ""), /已打开导览笔记/);

    const startupState = await page.evaluate(() => ({
      module: window.__prototypeState?.module || "",
      selectedFileId: window.__prototypeState?.selectedFileId || "",
      selectedFolderId: window.__prototypeState?.selectedFolderId || ""
    }));
    assert.equal(startupState.module, "explorer");
    assert.equal(startupState.selectedFileId, "GUIDE-SMART-NOTES-START");
    assert.equal(startupState.selectedFolderId, "dir_demo_smart_notes_product_thinking_original");
  }, 15000);

  const firstSeedDirectory = await fetchJson(apiBase, "/api/v1/directories/dir_demo_smart_notes_product_thinking_original/notes");
  assert.equal(firstSeedDirectory.status, 200, JSON.stringify(firstSeedDirectory.json));
  const firstSeedDirectoryTotal = Number(firstSeedDirectory.json.total || 0);
  assert.ok(firstSeedDirectoryTotal >= 25);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${webBase}/prototype?demo=smart-notes-product-thinking`, { waitUntil: "networkidle" });
  await waitFor(async () => {
    const firstVisibleGuideBlocks = await page.evaluate(() =>
      [...document.querySelectorAll("#wysiwygHost h1,#wysiwygHost h2,#wysiwygHost p,#wysiwygHost li")]
        .map((node) => {
          const rect = node.getBoundingClientRect();
          return {
            text: String(node.textContent || "").trim().replace(/\s+/g, " "),
            top: rect.top,
            height: rect.height
          };
        })
        .filter((item) => item.height > 0 && item.top >= 90 && item.top < 520)
        .slice(0, 4)
        .map((item) => item.text)
        .join(" ")
    );
    assert.match(firstVisibleGuideBlocks, /00 从这里开始|你不用先学术语|6 步/);
    assert.doesNotMatch(firstVisibleGuideBlocks, /产品功能示例笔记/);
  }, 15000);
  await page.setViewportSize({ width: 1366, height: 900 });

  await page.goto(`${webBase}/prototype?demo=smart-notes-product-thinking`, { waitUntil: "networkidle" });
  await waitFor(async () => {
    const statusText = await currentStatusText(page);
    assert.match(String(statusText || ""), /已打开导览笔记/);
    const startupState = await page.evaluate(() => ({
      module: window.__prototypeState?.module || "",
      selectedFileId: window.__prototypeState?.selectedFileId || ""
    }));
    assert.equal(startupState.module, "explorer");
    assert.equal(startupState.selectedFileId, "GUIDE-SMART-NOTES-START");
  }, 15000);

  await page.click('.rail-btn[data-module="writing"]');
  await waitFor(async () => {
    const writingState = await page.evaluate(() => ({
      title: document.querySelector("#writingTitle")?.value || "",
      goal: document.querySelector("#writingGoal")?.value || "",
      audience: document.querySelector("#writingAudience")?.value || "",
      basketSummary: document.querySelector("#writingBasketSummary")?.textContent || ""
    }));
    assert.ok(String(writingState.title || "").trim().length > 0);
    assert.ok(String(writingState.goal || "").trim().length > 0);
    assert.ok(String(writingState.audience || "").trim().length > 0);
    assert.match(writingState.basketSummary, /已选择 \d+ 条相关笔记/);
  }, 15000);

  const project = await fetchJson(apiBase, "/api/v1/writing-projects/WRITE-SMART-NOTES-DEMO");
  assert.equal(project.status, 200, JSON.stringify(project.json));
  assert.equal(project.json.item.scaffold_id, "DRAFT-SMART-NOTES-DEMO");

  const scaffold = await fetchJson(apiBase, "/api/v1/draft-scaffolds/DRAFT-SMART-NOTES-DEMO");
  assert.equal(scaffold.status, 200, JSON.stringify(scaffold.json));
  assert.ok(scaffold.json.item.sections.length > 0);

  const secondSeedDirectory = await fetchJson(apiBase, "/api/v1/directories/dir_demo_smart_notes_product_thinking_original/notes");
  assert.equal(secondSeedDirectory.status, 200, JSON.stringify(secondSeedDirectory.json));
  assert.equal(secondSeedDirectory.json.total, firstSeedDirectoryTotal);
});

test("prototype explorer context rename moves directory fsPath and note markdown path", async (t) => {
  if (process.env.RUN_BROWSER_E2E !== "1") {
    t.skip("Set RUN_BROWSER_E2E=1 to enable browser e2e in local runs.");
    return;
  }

  const playwright = await optionalPlaywright(t);
  if (!playwright) return;

  const stack = await startPrototypeStack(t, playwright);
  if (!stack) return;
  const { apiBase, page, vaultPath, webBase } = stack;

  const originalPath = path.join(vaultPath, "notes", "original", "rename-me");
  const renamedPath = path.join(vaultPath, "notes", "original", "Renamed Folder");

  const directory = await postJson(apiBase, "/api/v1/directories", {
    title: "Rename Me",
    parentDirectoryId: "dir_original_default",
    directoryType: "custom",
    fsPath: originalPath,
    maxNotes: 500
  });
  assert.equal(directory.status, 201, JSON.stringify(directory.json));

  const note = await postJson(apiBase, "/api/v1/notes", {
    directoryId: directory.json.item.id,
    body: "# Rename flow note\n\nThis note should move with the renamed directory."
  });
  assert.equal(note.status, 201, JSON.stringify(note.json));

  await page.goto(`${webBase}/prototype`, { waitUntil: "networkidle" });
  await openOriginalNoteBox(page);
  const folderRow = page.locator('.explorer-item[data-kind="folder"]', { hasText: "Rename Me" });
  await folderRow.waitFor();

  await acceptPrompt(page, /重命名目录/, "Renamed Folder");
  await openContextAction(page, folderRow, "rename");

  await waitFor(async () => {
    await page.locator('.explorer-item[data-kind="folder"]', { hasText: "Renamed Folder" }).waitFor({ timeout: 500 });
    const statusText = await page.locator("#statusText").textContent();
    assert.match(statusText || "", /目录已更新并落盘/);
  }, 8000);

  const directories = await fetchJson(apiBase, "/api/v1/directories?includeHidden=true");
  assert.equal(directories.status, 200);
  const renamedDirectory = directories.json.items.find((item) => item.id === directory.json.item.id);
  assert.ok(renamedDirectory, JSON.stringify(directories.json.items, null, 2));
  assert.equal(renamedDirectory.title, "Renamed Folder");
  assert.equal(path.resolve(renamedDirectory.fsPath), path.resolve(renamedPath));

  const noteAfter = await fetchJson(apiBase, `/api/v1/notes/${encodeURIComponent(note.json.item.id)}`);
  assert.equal(noteAfter.status, 200);
  const movedNotePath = path.join(vaultPath, noteAfter.json.item.markdownPath.replaceAll("/", path.sep));
  assert.equal(path.resolve(movedNotePath), path.resolve(path.join(renamedPath, "Rename flow note.md")));
  await fs.access(movedNotePath);
  await assert.rejects(fs.access(path.join(originalPath, "Rename flow note.md")));
});

test("prototype explorer set-folder-path updates directory fsPath and moves markdown files", async (t) => {
  if (process.env.RUN_BROWSER_E2E !== "1") {
    t.skip("Set RUN_BROWSER_E2E=1 to enable browser e2e in local runs.");
    return;
  }

  const playwright = await optionalPlaywright(t);
  if (!playwright) return;

  const stack = await startPrototypeStack(t, playwright);
  if (!stack) return;
  const { apiBase, page, vaultPath, webBase } = stack;

  const originalPath = path.join(vaultPath, "notes", "original", "path-source");
  const updatedPath = path.join(vaultPath, "notes", "original", "path-target");

  const directory = await postJson(apiBase, "/api/v1/directories", {
    title: "Path Source",
    parentDirectoryId: "dir_original_default",
    directoryType: "custom",
    fsPath: originalPath,
    maxNotes: 500
  });
  assert.equal(directory.status, 201, JSON.stringify(directory.json));

  const note = await postJson(apiBase, "/api/v1/notes", {
    directoryId: directory.json.item.id,
    body: "# Path move note\n\nThis note should move when the directory save path changes."
  });
  assert.equal(note.status, 201, JSON.stringify(note.json));

  await page.goto(`${webBase}/prototype`, { waitUntil: "networkidle" });
  await openOriginalNoteBox(page);
  const folderRow = page.locator('.explorer-item[data-kind="folder"]', { hasText: "Path Source" });
  await folderRow.waitFor();

  await page.evaluate((nextPath) => {
    window.showDirectoryPicker = undefined;
    window.prompt = () => nextPath;
  }, updatedPath);
  await openContextAction(page, folderRow, "set-folder-path");

  await waitFor(async () => {
    const directories = await fetchJson(apiBase, "/api/v1/directories?includeHidden=true");
    const updatedDirectory = directories.json.items.find((item) => item.id === directory.json.item.id);
    assert.ok(updatedDirectory);
    assert.equal(path.resolve(updatedDirectory.fsPath), path.resolve(updatedPath));
  }, 8000);

  const noteAfter = await fetchJson(apiBase, `/api/v1/notes/${encodeURIComponent(note.json.item.id)}`);
  assert.equal(noteAfter.status, 200);
  const movedNotePath = path.join(vaultPath, noteAfter.json.item.markdownPath.replaceAll("/", path.sep));
  assert.equal(path.resolve(movedNotePath), path.resolve(path.join(updatedPath, "Path move note.md")));
  await fs.access(movedNotePath);
  await assert.rejects(fs.access(path.join(originalPath, "Path move note.md")));
});

test("prototype explorer drag and drop moves directory under another folder and updates note path", async (t) => {
  if (process.env.RUN_BROWSER_E2E !== "1") {
    t.skip("Set RUN_BROWSER_E2E=1 to enable browser e2e in local runs.");
    return;
  }

  const playwright = await optionalPlaywright(t);
  if (!playwright) return;

  const stack = await startPrototypeStack(t, playwright);
  if (!stack) return;
  const { apiBase, page, vaultPath, webBase } = stack;

  const targetPath = path.join(vaultPath, "notes", "original", "target-parent");
  const sourcePath = path.join(vaultPath, "notes", "original", "source-parent");
  const movedSourcePath = path.join(targetPath, "source-parent");

  const targetDirectory = await postJson(apiBase, "/api/v1/directories", {
    title: "Target Parent",
    parentDirectoryId: "dir_original_default",
    directoryType: "custom",
    fsPath: targetPath,
    maxNotes: 500
  });
  assert.equal(targetDirectory.status, 201, JSON.stringify(targetDirectory.json));

  const sourceDirectory = await postJson(apiBase, "/api/v1/directories", {
    title: "Source Parent",
    parentDirectoryId: "dir_original_default",
    directoryType: "custom",
    fsPath: sourcePath,
    maxNotes: 500
  });
  assert.equal(sourceDirectory.status, 201, JSON.stringify(sourceDirectory.json));

  const sourceNote = await postJson(apiBase, "/api/v1/notes", {
    directoryId: sourceDirectory.json.item.id,
    body: "# Drag move note\n\nThis note should move with the dragged directory."
  });
  assert.equal(sourceNote.status, 201, JSON.stringify(sourceNote.json));

  await page.goto(`${webBase}/prototype`, { waitUntil: "networkidle" });
  await openOriginalNoteBox(page);
  const sourceRow = page.locator('.explorer-item[data-kind="folder"]', { hasText: "Source Parent" });
  const targetRow = page.locator('.explorer-item[data-kind="folder"]', { hasText: "Target Parent" });
  await sourceRow.waitFor();
  await targetRow.waitFor();

  await sourceRow.dragTo(targetRow);

  await waitFor(async () => {
    const statusText = await page.locator("#statusText").textContent();
    assert.match(statusText || "", /目录层级已更新并落盘/);
    const directories = await fetchJson(apiBase, "/api/v1/directories?includeHidden=true");
    const movedDirectory = directories.json.items.find((item) => item.id === sourceDirectory.json.item.id);
    assert.ok(movedDirectory);
    assert.equal(movedDirectory.parentDirectoryId, targetDirectory.json.item.id);
    assert.equal(path.resolve(movedDirectory.fsPath), path.resolve(movedSourcePath));
  }, 8000);

  const noteAfter = await fetchJson(apiBase, `/api/v1/notes/${encodeURIComponent(sourceNote.json.item.id)}`);
  assert.equal(noteAfter.status, 200);
  const movedNotePath = path.join(vaultPath, noteAfter.json.item.markdownPath.replaceAll("/", path.sep));
  assert.equal(path.resolve(movedNotePath), path.resolve(path.join(movedSourcePath, "Drag move note.md")));
  await fs.access(movedNotePath);
  await assert.rejects(fs.access(path.join(sourcePath, "Drag move note.md")));
});

test("prototype explorer note context rename updates markdown title and keeps file addressable", async (t) => {
  if (process.env.RUN_BROWSER_E2E !== "1") {
    t.skip("Set RUN_BROWSER_E2E=1 to enable browser e2e in local runs.");
    return;
  }

  const playwright = await optionalPlaywright(t);
  if (!playwright) return;

  const stack = await startPrototypeStack(t, playwright);
  if (!stack) return;
  const { apiBase, page, vaultPath, webBase } = stack;

  const note = await postJson(apiBase, "/api/v1/notes", {
    directoryId: "dir_original_default",
    body: "# Rename source note\n\nThis note title should change through the explorer context menu."
  });
  assert.equal(note.status, 201, JSON.stringify(note.json));

  const originalMarkdownPath = path.join(vaultPath, note.json.item.markdownPath.replaceAll("/", path.sep));
  await fs.access(originalMarkdownPath);

  await page.goto(`${webBase}/prototype`, { waitUntil: "networkidle" });
  await openOriginalNoteBox(page);
  const noteRow = page.locator('.explorer-item[data-kind="file"]', { hasText: "Rename source note" });
  await noteRow.waitFor();

  await acceptPrompt(page, /重命名笔记/, "Renamed note title");
  await openContextAction(page, noteRow, "rename");

  await waitFor(async () => {
    await page.locator('.explorer-item[data-kind="file"]', { hasText: "Renamed note title" }).waitFor({ timeout: 500 });
    const statusText = await page.locator("#statusText").textContent();
    assert.match(String(statusText || ""), /笔记已重命名|已同步到 Markdown|永久笔记已同步|当前修改已同步|文献笔记已完成/);
  }, 8000);

  const noteAfter = await fetchJson(apiBase, `/api/v1/notes/${encodeURIComponent(note.json.item.id)}`);
  assert.equal(noteAfter.status, 200);
  assert.equal(noteAfter.json.item.title, "Renamed note title");
  assert.match(noteAfter.json.item.body, /^# Renamed note title/m);

  const renamedMarkdownPath = path.join(vaultPath, noteAfter.json.item.markdownPath.replaceAll("/", path.sep));
  await assert.rejects(fs.access(originalMarkdownPath));
  const markdownAfter = await fs.readFile(renamedMarkdownPath, "utf8");
  assert.match(markdownAfter, /^# Renamed note title/m);
});

test("prototype explorer reveal note uses tauri opener when desktop shell is available", async (t) => {
  if (process.env.RUN_BROWSER_E2E !== "1") {
    t.skip("Set RUN_BROWSER_E2E=1 to enable browser e2e in local runs.");
    return;
  }

  const playwright = await optionalPlaywright(t);
  if (!playwright) return;

  const stack = await startPrototypeStack(t, playwright);
  if (!stack) return;
  const { apiBase, page, vaultPath, webBase } = stack;

  const note = await postJson(apiBase, "/api/v1/notes", {
    directoryId: "dir_original_default",
    body: "# Reveal source note\n\nThis note should ask the desktop shell to reveal its Markdown file."
  });
  assert.equal(note.status, 201, JSON.stringify(note.json));

  const expectedMarkdownPath = path.join(vaultPath, note.json.item.markdownPath.replaceAll("/", path.sep));

  await page.goto(`${webBase}/prototype`, { waitUntil: "networkidle" });
  await page.evaluate(() => {
    window.__tauriRevealCalls = [];
    window.__TAURI__ = {
      opener: {
        async revealItemInDir(targetPath) {
          window.__tauriRevealCalls.push(targetPath);
        }
      }
    };
  });

  const noteRow = page.locator('.explorer-item[data-kind="file"]', { hasText: "Reveal source note" });
  await noteRow.waitFor();
  await openContextAction(page, noteRow, "reveal-note");

  await waitFor(async () => {
    const statusText = await page.locator("#statusText").textContent();
    assert.match(String(statusText || ""), /已定位 Markdown 文件位置|已打开Markdown 文件位置/);
  }, 7000);

  const revealCalls = await page.evaluate(() => window.__tauriRevealCalls || []);
  assert.deepEqual(revealCalls.map((item) => path.resolve(item)), [path.resolve(expectedMarkdownPath)]);
});

test("prototype explorer note context move and delete update disk state", async (t) => {
  if (process.env.RUN_BROWSER_E2E !== "1") {
    t.skip("Set RUN_BROWSER_E2E=1 to enable browser e2e in local runs.");
    return;
  }

  const playwright = await optionalPlaywright(t);
  if (!playwright) return;

  const stack = await startPrototypeStack(t, playwright);
  if (!stack) return;
  const { apiBase, page, vaultPath, webBase } = stack;

  const targetPath = path.join(vaultPath, "notes", "original", "note-move-target");
  const targetDirectory = await postJson(apiBase, "/api/v1/directories", {
    title: "Note Move Target",
    parentDirectoryId: "dir_original_default",
    directoryType: "custom",
    fsPath: targetPath,
    maxNotes: 500
  });
  assert.equal(targetDirectory.status, 201, JSON.stringify(targetDirectory.json));

  const note = await postJson(apiBase, "/api/v1/notes", {
    directoryId: "dir_original_default",
    body: "# Note move source\n\nThis note should move and then be deleted through the explorer context menu."
  });
  assert.equal(note.status, 201, JSON.stringify(note.json));

  const oldMarkdownPath = path.join(vaultPath, note.json.item.markdownPath.replaceAll("/", path.sep));
  await fs.access(oldMarkdownPath);

  await page.goto(`${webBase}/prototype`, { waitUntil: "networkidle" });
  await openOriginalNoteBox(page);
  const noteRow = page.locator('.explorer-item[data-kind="file"]', { hasText: "Note move source" });
  await noteRow.waitFor();

  await openContextAction(page, noteRow, "move");
  await page.locator("#permanentNoteTargetFolder").selectOption(targetDirectory.json.item.id);
  await page.locator("#permanentNoteCreate").click();

  await waitFor(async () => {
    const statusText = await page.locator("#statusText").textContent();
    assert.match(statusText || "", /已移动笔记并落盘/);
    const noteAfterMove = await fetchJson(apiBase, `/api/v1/notes/${encodeURIComponent(note.json.item.id)}`);
    assert.equal(noteAfterMove.status, 200);
    assert.equal(noteAfterMove.json.item.directoryId, targetDirectory.json.item.id);
  }, 8000);

  const noteAfterMove = await fetchJson(apiBase, `/api/v1/notes/${encodeURIComponent(note.json.item.id)}`);
  const movedMarkdownPath = path.join(vaultPath, noteAfterMove.json.item.markdownPath.replaceAll("/", path.sep));
  assert.equal(path.resolve(movedMarkdownPath), path.resolve(path.join(targetPath, "Note move source.md")));
  await fs.access(movedMarkdownPath);
  await assert.rejects(fs.access(oldMarkdownPath));

  await page.locator('.explorer-item[data-kind="folder"]', { hasText: "Note Move Target" }).click();
  const movedRow = page.locator('.explorer-item[data-kind="file"]', { hasText: "Note move source" });
  await movedRow.waitFor();

  page.once("dialog", async (dialog) => {
    assert.equal(dialog.type(), "confirm");
    assert.match(dialog.message(), /确认删除笔记/);
    assert.match(dialog.message(), /Markdown 文件/);
    await dialog.accept();
  });
  await openContextAction(page, movedRow, "delete");

  await waitFor(async () => {
    const statusText = await page.locator("#statusText").textContent();
    assert.match(statusText || "", /已删除笔记并落盘/);
    const deletedNote = await fetchJson(apiBase, `/api/v1/notes/${encodeURIComponent(note.json.item.id)}`);
    assert.equal(deletedNote.status, 404);
  }, 8000);

  await assert.rejects(fs.access(movedMarkdownPath));
});

test("prototype AI inbox field suggestion flow adopts a suggestion as draft and updates the target note", async (t) => {
  if (process.env.RUN_BROWSER_E2E !== "1") {
    t.skip("Set RUN_BROWSER_E2E=1 to enable browser e2e in local runs.");
    return;
  }

  const playwright = await optionalPlaywright(t);
  if (!playwright) return;

  const stack = await startPrototypeStack(t, playwright);
  if (!stack) return;
  const { apiBase, page, webBase } = stack;

  const fixture = await createAiFieldSuggestionFixture(apiBase, {
    title: "Inbox review target",
    body: "The inbox review flow should only advance after explicit user action."
  });

  await reloadPrototype(page, webBase);
  await openAiInboxModule(page);
  await filterAiInboxBySourceNote(page, fixture.noteId);

  const item = page.locator(`#aiInboxPanel .ai-inbox-list-pane [data-ai-inbox-artifact-id="${fixture.artifactId}"]`);
  await item.waitFor();
  await item.click();

  await waitFor(async () => {
    const detailText = await page.locator("#aiInboxPanel .ai-inbox-detail-pane").textContent();
    assert.match(String(detailText || ""), new RegExp(escapeRegExp(fixture.suggestionId)));
  }, 8000);

  await page.locator('#aiInboxPanel .ai-inbox-detail-pane [data-ai-inbox-suggestion-status="adopted_as_draft"]').click();

  await waitFor(async () => {
    const note = await fetchJson(apiBase, `/api/v1/notes/${encodeURIComponent(fixture.noteId)}`);
    assert.equal(note.status, 200);
    assert.equal(
      note.json.item[noteFieldKey(fixture.targetField)],
      suggestionFieldValue(fixture.suggestedContent, fixture.targetField)
    );
  }, 8000);

  await waitFor(async () => {
    assert.equal(await page.evaluate(() => window.__prototypeState?.module || ""), "explorer");
  }, 8000);
});

test("prototype editor embedded AI suggestion flow keeps review inside the permanent note context", async (t) => {
  if (process.env.RUN_BROWSER_E2E !== "1") {
    t.skip("Set RUN_BROWSER_E2E=1 to enable browser e2e in local runs.");
    return;
  }

  const playwright = await optionalPlaywright(t);
  if (!playwright) return;

  const stack = await startPrototypeStack(t, playwright);
  if (!stack) return;
  const { apiBase, page, webBase } = stack;

  const fixture = await createAiFieldSuggestionFixture(apiBase, {
    title: "Editor embedded review target",
    body: "The permanent note editor should host adopt, edit, and confirm actions for this field suggestion."
  });

  await reloadPrototype(page, webBase);
  await waitFor(async () => {
    assert.equal(await page.evaluate(() => window.__prototypeState?.module || ""), "explorer");
  }, 5000);

  await page.locator(".explorer-item[data-kind='file']", { hasText: fixture.noteTitle }).click();
  await ensureSourceMode(page);
  await page.locator("#btnShowRelated").click();

  await waitFor(async () => {
    const detailText = await page.locator("#relatedPanel").textContent();
    assert.match(String(detailText || ""), /关联 AI 建议/);
    assert.match(String(detailText || ""), /采纳为草稿/);
  }, 10000);

  const embeddedSuggestionCard = page.locator(`#relatedPanel [data-note-ai-suggestion-id="${fixture.suggestionId}"]`);

  assert.equal(await embeddedSuggestionCard.locator("[data-note-ai-suggestion-action='confirmed']").count(), 0);

  await embeddedSuggestionCard.locator("[data-note-ai-suggestion-action='adopted_as_draft']").click();

  await waitFor(async () => {
    const suggestion = await fetchJson(apiBase, `/api/v1/ai-suggestions/${encodeURIComponent(fixture.suggestionId)}?canonical=true`);
    assert.equal(suggestion.status, 200);
    assert.equal(suggestion.json.item.status, "adopted_as_draft");
  }, 10000);

  await waitFor(async () => {
    const detailText = await page.locator("#relatedPanel").textContent();
    assert.match(String(detailText || ""), /标记已编辑/);
  }, 10000);

  const editedThesis = "编辑器内先采纳为草稿，再由用户亲自改写并确认。";
  await page.locator("textarea[name='thesis']").fill(editedThesis);
  await page.locator("[data-note-distillation-form] button[type='submit']").click();

  await waitFor(async () => {
    const note = await fetchJson(apiBase, `/api/v1/notes/${encodeURIComponent(fixture.noteId)}`);
    assert.equal(note.status, 200);
    assert.equal(note.json.item.thesis, editedThesis);
  }, 10000);

  await embeddedSuggestionCard.locator("[data-note-ai-suggestion-action='edited']").click();

  await waitFor(async () => {
    const suggestion = await fetchJson(apiBase, `/api/v1/ai-suggestions/${encodeURIComponent(fixture.suggestionId)}?canonical=true`);
    assert.equal(suggestion.status, 200);
    assert.equal(suggestion.json.item.status, "edited");
  }, 10000);

  await waitFor(async () => {
    assert.equal(await embeddedSuggestionCard.locator("[data-note-ai-suggestion-action='confirmed']").isVisible(), true);
  }, 10000);

  await embeddedSuggestionCard.locator("[data-note-ai-suggestion-action='confirmed']").click();

  await waitFor(async () => {
    const suggestion = await fetchJson(apiBase, `/api/v1/ai-suggestions/${encodeURIComponent(fixture.suggestionId)}?canonical=true`);
    assert.equal(suggestion.status, 200);
    assert.equal(suggestion.json.item.status, "confirmed");
  }, 10000);

  await waitFor(async () => {
    const note = await fetchJson(apiBase, `/api/v1/notes/${encodeURIComponent(fixture.noteId)}`);
    assert.equal(note.status, 200);
    assert.equal(note.json.item.thesis, editedThesis);
  }, 10000);
});

test("prototype AI inbox returns review to the editor context for final processing", async (t) => {
  if (process.env.RUN_BROWSER_E2E !== "1") {
    t.skip("Set RUN_BROWSER_E2E=1 to enable browser e2e in local runs.");
    return;
  }

  const playwright = await optionalPlaywright(t);
  if (!playwright) return;

  const stack = await startPrototypeStack(t, playwright);
  if (!stack) return;
  const { apiBase, page, webBase } = stack;

  const fixture = await createAiFieldSuggestionFixture(apiBase, {
    title: "Inbox return-to-editor target",
    body: "The inbox should route the final review back into the permanent note editor context."
  });
  await adoptSuggestionAsDraftViaApi(apiBase, fixture);

  await reloadPrototype(page, webBase);
  await openAiInboxModule(page);
  await filterAiInboxBySourceNote(page, fixture.noteId);

  await waitFor(async () => {
    const reviewedCount = String(await page.locator('#aiInboxPanel [data-ai-inbox-view="reviewed"] strong').textContent() || "").trim();
    assert.notEqual(reviewedCount, "0");
  }, 8000);

  await page.evaluate(() => {
    const button = document.querySelector('#aiInboxPanel [data-ai-inbox-view="reviewed"]');
    if (!button) throw new Error("missing reviewed tab");
    button.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  });

  const item = page.locator(`#aiInboxPanel .ai-inbox-list-pane [data-ai-inbox-artifact-id="${fixture.artifactId}"]`);
  await item.waitFor();
  await item.click();

  await waitFor(async () => {
    const detailText = await page.locator("#aiInboxPanel .ai-inbox-detail-pane").textContent();
    assert.match(String(detailText || ""), new RegExp(escapeRegExp(fixture.noteId)));
    assert.match(String(detailText || ""), /Open target note|打开目标笔记/);
  }, 8000);

  await page.locator("#aiInboxPanel .ai-inbox-detail-pane button", { hasText: /Open target note|打开目标笔记/ }).click();

  await waitFor(async () => {
    assert.equal(await page.evaluate(() => window.__prototypeState?.module || ""), "explorer");
    const statusText = await currentStatusText(page);
    assert.match(String(statusText || ""), /已回到笔记/);
  }, 8000);

  await waitFor(async () => {
    const bodyValue = await page.locator("#editorBody").inputValue();
    assert.match(String(bodyValue || ""), /Inbox return-to-editor target/);
    const relatedText = await page.locator("#relatedPanel").textContent();
    assert.match(String(relatedText || ""), /关联 AI 建议|当前笔记的 AI 建议/);
    assert.match(String(relatedText || ""), /标记已编辑/);
  }, 10000);

  await page.evaluate(() => {
    const button = document.querySelector("#relatedPanel [data-note-ai-suggestion-action='edited']");
    if (!button) throw new Error("missing embedded edit suggestion action");
    button.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  });
  await waitFor(async () => {
    const suggestion = await fetchJson(apiBase, `/api/v1/ai-suggestions/${encodeURIComponent(fixture.suggestionId)}?canonical=true`);
    assert.equal(suggestion.status, 200);
    assert.equal(suggestion.json.item.status, "edited");
  }, 10000);

  await page.evaluate(() => {
    const button = document.querySelector("#relatedPanel [data-note-ai-suggestion-action='confirmed']");
    if (!button) throw new Error("missing embedded confirm suggestion action");
    button.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  });
  await waitFor(async () => {
    const suggestion = await fetchJson(apiBase, `/api/v1/ai-suggestions/${encodeURIComponent(fixture.suggestionId)}?canonical=true`);
    assert.equal(suggestion.status, 200);
    assert.equal(suggestion.json.item.status, "confirmed");
  }, 10000);
});

test("prototype AI inbox reviewed detail can mark an adopted draft edited and then confirmed", async (t) => {
  if (process.env.RUN_BROWSER_E2E !== "1") {
    t.skip("Set RUN_BROWSER_E2E=1 to enable browser e2e in local runs.");
    return;
  }

  const playwright = await optionalPlaywright(t);
  if (!playwright) return;

  const stack = await startPrototypeStack(t, playwright);
  if (!stack) return;
  const { apiBase, page, webBase } = stack;

  const fixture = await createAiFieldSuggestionFixture(apiBase, {
    title: "Inbox reviewed detail target",
    body: "This adopted draft should be edited and confirmed from the reviewed AI inbox detail."
  });
  await adoptSuggestionAsDraftViaApi(apiBase, fixture);
  const editedThesis = "Inbox browser review changed this thesis before final confirmation.";

  await reloadPrototype(page, webBase);
  await openAiInboxModule(page);
  await filterAiInboxBySourceNote(page, fixture.noteId);
  await waitFor(async () => {
    const reviewedCount = String(await page.locator('#aiInboxPanel [data-ai-inbox-view="reviewed"] strong').textContent() || "").trim();
    assert.notEqual(reviewedCount, "0");
  }, 8000);
  await page.evaluate(() => {
    const button = document.querySelector('#aiInboxPanel [data-ai-inbox-view="reviewed"]');
    if (!button) throw new Error("missing reviewed tab");
    button.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  });
  await waitFor(async () => {
    const present = await page.evaluate((artifactId) => Boolean(document.querySelector(`#aiInboxPanel [data-ai-inbox-artifact-id="${artifactId}"]`)), fixture.artifactId);
    assert.equal(present, true);
  }, 8000);
  await page.evaluate((artifactId) => {
    const item = document.querySelector(`#aiInboxPanel [data-ai-inbox-artifact-id="${artifactId}"]`);
    if (!item) throw new Error(`missing reviewed inbox item: ${artifactId}`);
    item.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  }, fixture.artifactId);

  await waitFor(async () => {
    assert.equal(await page.locator("#aiInboxSuggestionContentEditor").isVisible(), true);
    const detailText = await page.locator("#aiInboxPanel .ai-inbox-detail-pane").textContent();
    assert.match(String(detailText || ""), /Adopted as draft|已采纳为草稿/);
  }, 8000);

  await page.locator("#aiInboxSuggestionContentEditor").fill(JSON.stringify({ thesis: editedThesis }, null, 2));
  await page.locator('#aiInboxPanel .ai-inbox-detail-pane [data-ai-inbox-suggestion-status="edited"]').click();

  await waitFor(async () => {
    const suggestion = await fetchJson(apiBase, `/api/v1/ai-suggestions/${encodeURIComponent(fixture.suggestionId)}?canonical=true`);
    assert.equal(suggestion.status, 200);
    assert.equal(suggestion.json.item.status, "edited");
    assert.equal(suggestionFieldValue(suggestion.json.item.content, fixture.targetField), editedThesis);
  }, 8000);

  await page.locator("#aiInboxSuggestionContentEditor").fill(JSON.stringify({ thesis: editedThesis }, null, 2));
  await page.locator('#aiInboxPanel .ai-inbox-detail-pane [data-ai-inbox-suggestion-status="confirmed"]').click();

  await waitFor(async () => {
    const suggestion = await fetchJson(apiBase, `/api/v1/ai-suggestions/${encodeURIComponent(fixture.suggestionId)}?canonical=true`);
    assert.equal(suggestion.status, 200);
    assert.equal(suggestion.json.item.status, "confirmed");
    assert.equal(suggestionFieldValue(suggestion.json.item.content, fixture.targetField), editedThesis);
    assert.equal(suggestion.json.canonical.latest_review_event.event_type, "confirmed");
  }, 8000);

  await waitFor(async () => {
    const detailText = await page.locator("#aiInboxPanel .ai-inbox-detail-pane").textContent();
    assert.match(String(detailText || ""), /Confirmed|已确认/);
    assert.match(String(detailText || ""), new RegExp(escapeRegExp(editedThesis)));
  }, 8000);
});

test("prototype AI inbox reviewed detail keeps invalid reviewed JSON as inline error without submitting", async (t) => {
  if (process.env.RUN_BROWSER_E2E !== "1") {
    t.skip("Set RUN_BROWSER_E2E=1 to enable browser e2e in local runs.");
    return;
  }

  const playwright = await optionalPlaywright(t);
  if (!playwright) return;

  const stack = await startPrototypeStack(t, playwright);
  if (!stack) return;
  const { apiBase, page, webBase } = stack;

  const fixture = await createAiFieldSuggestionFixture(apiBase, {
    title: "Inbox invalid reviewed JSON target",
    body: "This adopted draft should reject invalid reviewed JSON from the AI inbox detail."
  });
  await adoptSuggestionAsDraftViaApi(apiBase, fixture);

  let patchCount = 0;
  await page.route(`${apiBase}/api/v1/ai-suggestions/${fixture.suggestionId}?canonical=true`, async (route, request) => {
    if (request.method() === "PATCH") patchCount += 1;
    await route.continue();
  });

  await reloadPrototype(page, webBase);
  await openAiInboxModule(page);
  await filterAiInboxBySourceNote(page, fixture.noteId);
  await page.locator('#aiInboxPanel [data-ai-inbox-view="reviewed"]').click();

  const reviewedItem = page.locator(`#aiInboxPanel .ai-inbox-list-pane [data-ai-inbox-artifact-id="${fixture.artifactId}"]`);
  await reviewedItem.waitFor();
  await reviewedItem.click();

  await waitFor(async () => {
    assert.equal(await page.locator("#aiInboxSuggestionContentEditor").isVisible(), true);
  }, 8000);

  await page.locator("#aiInboxSuggestionContentEditor").fill("{not valid json}");
  await page.locator('#aiInboxPanel .ai-inbox-detail-pane [data-ai-inbox-suggestion-status="edited"]').click();

  await waitFor(async () => {
    const detailText = await page.locator("#aiInboxPanel .ai-inbox-detail-pane").textContent();
    assert.match(String(detailText || ""), /must be valid JSON/i);
  }, 8000);

  assert.equal(patchCount, 0);
  const suggestion = await fetchJson(apiBase, `/api/v1/ai-suggestions/${encodeURIComponent(fixture.suggestionId)}?canonical=true`);
  assert.equal(suggestion.status, 200);
  assert.equal(suggestion.json.item.status, "adopted_as_draft");
});

test("prototype AI inbox can reject a linked suggestion and keeps the reviewed artifact inspectable", async (t) => {
  if (process.env.RUN_BROWSER_E2E !== "1") {
    t.skip("Set RUN_BROWSER_E2E=1 to enable browser e2e in local runs.");
    return;
  }

  const playwright = await optionalPlaywright(t);
  if (!playwright) return;

  const stack = await startPrototypeStack(t, playwright);
  if (!stack) return;
  const { apiBase, page, webBase } = stack;

  const fixture = await createAiFieldSuggestionFixture(apiBase, {
    title: "Inbox reject target",
    body: "This suggestion should be rejected from the AI inbox detail view."
  });

  await reloadPrototype(page, webBase);
  await openAiInboxModule(page);
  await filterAiInboxBySourceNote(page, fixture.noteId);

  const item = page.locator(`#aiInboxPanel .ai-inbox-list-pane [data-ai-inbox-artifact-id="${fixture.artifactId}"]`);
  await item.waitFor();
  await item.click();
  await page.locator('#aiInboxPanel .ai-inbox-detail-pane [data-ai-inbox-suggestion-status="rejected"]').click();

  await waitFor(async () => {
    const suggestion = await fetchJson(apiBase, `/api/v1/ai-suggestions/${encodeURIComponent(fixture.suggestionId)}?canonical=true`);
    assert.equal(suggestion.status, 200);
    assert.equal(suggestion.json.item.status, "rejected");
  }, 8000);

  await page.locator('#aiInboxPanel [data-ai-inbox-view="reviewed"]').click();
  const reviewedItem = page.locator(`#aiInboxPanel .ai-inbox-list-pane [data-ai-inbox-artifact-id="${fixture.artifactId}"]`);
  await reviewedItem.waitFor();
  await reviewedItem.click();

  await waitFor(async () => {
    const detailText = await page.locator("#aiInboxPanel .ai-inbox-detail-pane").textContent();
    assert.match(String(detailText || ""), /Rejected/);
  }, 8000);

  const detail = await fetchJson(apiBase, `/api/v1/ai/inbox/${encodeURIComponent(fixture.artifactId)}?canonical=true`);
  assert.equal(detail.status, 200);
  assert.equal(detail.json.canonical.artifact.status, "ignored");
  assert.equal(detail.json.canonical.suggestion.status, "rejected");
});

test("prototype AI inbox reject plus refresh keeps the reviewed artifact stable", async (t) => {
  if (process.env.RUN_BROWSER_E2E !== "1") {
    t.skip("Set RUN_BROWSER_E2E=1 to enable browser e2e in local runs.");
    return;
  }

  const playwright = await optionalPlaywright(t);
  if (!playwright) return;

  const stack = await startPrototypeStack(t, playwright);
  if (!stack) return;
  const { apiBase, page, webBase } = stack;

  const fixture = await createAiFieldSuggestionFixture(apiBase, {
    title: "Inbox reject refresh target",
    body: "This suggestion should remain inspectable after reject plus refresh."
  });

  await reloadPrototype(page, webBase);
  await openAiInboxModule(page);
  await filterAiInboxBySourceNote(page, fixture.noteId);

  const item = page.locator(`#aiInboxPanel .ai-inbox-list-pane [data-ai-inbox-artifact-id="${fixture.artifactId}"]`);
  await item.waitFor();
  await item.click();
  await page.locator('#aiInboxPanel .ai-inbox-detail-pane [data-ai-inbox-suggestion-status="rejected"]').click();

  await waitFor(async () => {
    const suggestion = await fetchJson(apiBase, `/api/v1/ai-suggestions/${encodeURIComponent(fixture.suggestionId)}?canonical=true`);
    assert.equal(suggestion.status, 200);
    assert.equal(suggestion.json.item.status, "rejected");
  }, 8000);

  await page.locator('#aiInboxPanel [data-ai-inbox-view="reviewed"]').click();
  await page.locator("#btnAiInboxRefresh").click();

  const reviewedItem = page.locator(`#aiInboxPanel .ai-inbox-list-pane [data-ai-inbox-artifact-id="${fixture.artifactId}"]`);
  await reviewedItem.waitFor();
  await reviewedItem.click();

  await waitFor(async () => {
    const detailText = await page.locator("#aiInboxPanel .ai-inbox-detail-pane").textContent();
    assert.match(String(detailText || ""), /Rejected/);
    assert.doesNotMatch(String(detailText || ""), /读取失败/);
  }, 8000);

  const detail = await fetchJson(apiBase, `/api/v1/ai/inbox/${encodeURIComponent(fixture.artifactId)}?canonical=true`);
  assert.equal(detail.status, 200);
  assert.equal(detail.json.canonical.artifact.status, "ignored");
  assert.equal(detail.json.canonical.suggestion.status, "rejected");
});

test("prototype AI inbox reviewed reopen continuity keeps canonical detail aligned after refresh and tab switches", async (t) => {
  if (process.env.RUN_BROWSER_E2E !== "1") {
    t.skip("Set RUN_BROWSER_E2E=1 to enable browser e2e in local runs.");
    return;
  }

  const playwright = await optionalPlaywright(t);
  if (!playwright) return;

  const stack = await startPrototypeStack(t, playwright);
  if (!stack) return;
  const { page, webBase, apiBase } = stack;

  const fixture = await createAiFieldSuggestionFixture(apiBase, {
    title: "Inbox reviewed reopen continuity target",
    body: "Reopening the same reviewed inbox item should keep detail aligned after refresh and tab switches."
  });
  await adoptSuggestionAsDraftViaApi(apiBase, fixture);

  await reloadPrototype(page, webBase);
  await openAiInboxModule(page);
  await filterAiInboxBySourceNote(page, fixture.noteId);
  await page.locator('#aiInboxPanel [data-ai-inbox-view="reviewed"]').click();

  const reviewedItem = page.locator(`#aiInboxPanel .ai-inbox-list-pane [data-ai-inbox-artifact-id="${fixture.artifactId}"]`);
  await reviewedItem.waitFor();
  await reviewedItem.click();

  await waitFor(async () => {
    const detailText = await page.locator("#aiInboxPanel .ai-inbox-detail-pane").textContent();
    assert.match(String(detailText || ""), /Adopted as draft|已采纳为草稿/);
    assert.match(String(detailText || ""), new RegExp(escapeRegExp(fixture.suggestionId)));
    assert.equal(await page.locator("#aiInboxSuggestionContentEditor").isVisible(), true);
  }, 8000);

  await page.locator("#btnAiInboxRefresh").click();
  await page.locator('#aiInboxPanel [data-ai-inbox-view="pending"]').click();
  await page.locator('#aiInboxPanel [data-ai-inbox-view="reviewed"]').click();
  await reviewedItem.waitFor();
  await reviewedItem.click();

  await waitFor(async () => {
    const detailText = await page.locator("#aiInboxPanel .ai-inbox-detail-pane").textContent();
    assert.match(String(detailText || ""), /Adopted as draft|已采纳为草稿/);
    assert.match(String(detailText || ""), new RegExp(escapeRegExp(fixture.suggestionId)));
    assert.equal(await page.locator("#aiInboxSuggestionContentEditor").isVisible(), true);
    assert.doesNotMatch(String(detailText || ""), /Review safety/);
    assert.doesNotMatch(String(detailText || ""), /正在读取建议详情/);
  }, 8000);
});

test("prototype AI inbox review-action continuity keeps detail aligned with filtered pending selection changes", async (t) => {
  if (process.env.RUN_BROWSER_E2E !== "1") {
    t.skip("Set RUN_BROWSER_E2E=1 to enable browser e2e in local runs.");
    return;
  }

  const playwright = await optionalPlaywright(t);
  if (!playwright) return;

  const stack = await startPrototypeStack(t, playwright);
  if (!stack) return;
  const { apiBase, page, webBase } = stack;

  const firstFixture = await createAiFieldSuggestionFixture(apiBase, {
    title: "Inbox filtered continuity first target",
    body: "Rejecting this pending inbox item should move detail to another visible pending item."
  });
  const secondFixture = await createAiFieldSuggestionFixture(apiBase, {
    title: "Inbox filtered continuity second target",
    body: "This pending inbox item should stay visible after the first one is rejected."
  });
  const loneFixture = await createAiFieldSuggestionFixture(apiBase, {
    title: "Inbox filtered continuity lone target",
    body: "Rejecting the last filtered pending inbox item should clear list and detail."
  });

  await reloadPrototype(page, webBase);
  await openAiInboxModule(page);

  const firstItem = page.locator(`#aiInboxPanel .ai-inbox-list-pane [data-ai-inbox-artifact-id="${firstFixture.artifactId}"]`);
  await firstItem.waitFor();
  await page.evaluate((artifactId) => {
    document
      .querySelector(`#aiInboxPanel .ai-inbox-list-pane [data-ai-inbox-artifact-id="${artifactId}"]`)
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  }, firstFixture.artifactId);

  await waitFor(async () => {
    const detailText = await page.locator("#aiInboxPanel .ai-inbox-detail-pane").textContent();
    assert.match(String(detailText || ""), new RegExp(escapeRegExp(firstFixture.noteId)));
    assert.match(String(detailText || ""), /Reject/);
  }, 8000);

  await page.locator('#aiInboxPanel .ai-inbox-detail-pane [data-ai-inbox-suggestion-status="rejected"]').click({ force: true });

  await waitFor(async () => {
    const suggestion = await fetchJson(apiBase, `/api/v1/ai-suggestions/${encodeURIComponent(firstFixture.suggestionId)}?canonical=true`);
    assert.equal(suggestion.status, 200);
    assert.equal(suggestion.json.item.status, "rejected");
  }, 8000);

  await waitFor(async () => {
    const detailText = await page.locator("#aiInboxPanel .ai-inbox-detail-pane").textContent();
    assert.doesNotMatch(String(detailText || ""), new RegExp(escapeRegExp(firstFixture.noteId)));
    const switchedToRemainingSuggestion =
      new RegExp(escapeRegExp(secondFixture.noteId)).test(String(detailText || "")) ||
      new RegExp(escapeRegExp(loneFixture.noteId)).test(String(detailText || ""));
    assert.equal(switchedToRemainingSuggestion, true);
  }, 8000);

  await waitFor(async () => {
    assert.equal(await firstItem.count(), 0);
    const activeRows = await page.locator("#aiInboxPanel .ai-inbox-list-pane .ai-inbox-item.is-active").count();
    assert.equal(activeRows >= 1, true);
  }, 8000);

  await filterAiInboxBySourceNote(page, loneFixture.noteId);

  const loneItem = page.locator(`#aiInboxPanel .ai-inbox-list-pane [data-ai-inbox-artifact-id="${loneFixture.artifactId}"]`);
  await waitFor(async () => {
    assert.equal(await loneItem.count(), 1);
  }, 8000);

  await page.evaluate((artifactId) => {
    document
      .querySelector(`#aiInboxPanel .ai-inbox-list-pane [data-ai-inbox-artifact-id="${artifactId}"]`)
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  }, loneFixture.artifactId);

  await waitFor(async () => {
    const detailText = await page.locator("#aiInboxPanel .ai-inbox-detail-pane").textContent();
    assert.match(String(detailText || ""), new RegExp(escapeRegExp(loneFixture.suggestionId)));
    assert.match(String(detailText || ""), /Reject/);
  }, 8000);

  await page.locator('#aiInboxPanel .ai-inbox-detail-pane [data-ai-inbox-suggestion-status="rejected"]').click({ force: true });

  await waitFor(async () => {
    const suggestion = await fetchJson(apiBase, `/api/v1/ai-suggestions/${encodeURIComponent(loneFixture.suggestionId)}?canonical=true`);
    assert.equal(suggestion.status, 200);
    assert.equal(suggestion.json.item.status, "rejected");
  }, 8000);

  await page.evaluate(() => {
    const button = document.querySelector('#aiInboxPanel [data-ai-inbox-view="reviewed"]');
    if (!button) throw new Error("missing reviewed tab");
    button.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  });

  const loneReviewedItem = page.locator(`#aiInboxPanel .ai-inbox-list-pane [data-ai-inbox-artifact-id="${loneFixture.artifactId}"]`);
  await waitFor(async () => {
    assert.equal(await loneReviewedItem.count(), 1);
  }, 8000);

  await page.evaluate((artifactId) => {
    document
      .querySelector(`#aiInboxPanel .ai-inbox-list-pane [data-ai-inbox-artifact-id="${artifactId}"]`)
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  }, loneFixture.artifactId);

  await waitFor(async () => {
    const detailText = await page.locator("#aiInboxPanel .ai-inbox-detail-pane").textContent();
    assert.match(String(detailText || ""), /Rejected|已拒绝/);
    assert.match(String(detailText || ""), new RegExp(escapeRegExp(loneFixture.suggestionId)));
    assert.doesNotMatch(String(detailText || ""), /AI inbox review failed/);
    assert.equal(await page.locator('#aiInboxPanel .ai-inbox-detail-pane [data-ai-inbox-decision="archived"]').count(), 0);
  }, 8000);

  const detail = await fetchJson(apiBase, `/api/v1/ai/inbox/${encodeURIComponent(loneFixture.artifactId)}?canonical=true`);
  assert.equal(detail.status, 200);
  assert.equal(detail.json.canonical.artifact.status, "ignored");
  assert.equal(detail.json.canonical.suggestion.status, "rejected");
});

test("prototype AI inbox guards stale detail selection and duplicate reviewed submit", async (t) => {
  if (process.env.RUN_BROWSER_E2E !== "1") {
    t.skip("Set RUN_BROWSER_E2E=1 to enable browser e2e in local runs.");
    return;
  }

  const playwright = await optionalPlaywright(t);
  if (!playwright) return;

  const stack = await startPrototypeStack(t, playwright);
  if (!stack) return;
  const { apiBase, page, webBase } = stack;

  const slowFixture = await createAiFieldSuggestionFixture(apiBase, {
    title: "Inbox stale selection slow target",
    body: "The first inbox detail request should resolve too late and must not overwrite the second reviewed selection."
  });
  const fastFixture = await createAiFieldSuggestionFixture(apiBase, {
    title: "Inbox stale selection fast target",
    body: "The second inbox detail request should win and stay visible in reviewed AI inbox detail."
  });
  await adoptSuggestionAsDraftViaApi(apiBase, slowFixture);
  await adoptSuggestionAsDraftViaApi(apiBase, fastFixture);

  let delayedSlowDetail = false;
  await page.route(`${apiBase}/api/v1/ai/inbox/${slowFixture.artifactId}?canonical=true`, async (route) => {
    if (!delayedSlowDetail) {
      delayedSlowDetail = true;
      await new Promise((resolve) => setTimeout(resolve, 700));
    }
    await route.continue();
  });

  let editRequestCount = 0;
  await page.route(`${apiBase}/api/v1/ai-suggestions/${fastFixture.suggestionId}?canonical=true`, async (route, request) => {
    if (request.method() === "PATCH") {
      editRequestCount += 1;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    await route.continue();
  });

  await reloadPrototype(page, webBase);
  await openAiInboxModule(page);

  await page.evaluate(() => {
    const button = document.querySelector('#aiInboxPanel [data-ai-inbox-view="reviewed"]');
    if (!button) throw new Error("missing reviewed tab");
    button.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  });

  const slowItem = page.locator(`#aiInboxPanel .ai-inbox-list-pane [data-ai-inbox-artifact-id="${slowFixture.artifactId}"]`);
  const fastItem = page.locator(`#aiInboxPanel .ai-inbox-list-pane [data-ai-inbox-artifact-id="${fastFixture.artifactId}"]`);
  await slowItem.waitFor();
  await fastItem.waitFor();

  await page.evaluate((artifactId) => {
    document
      .querySelector(`#aiInboxPanel .ai-inbox-list-pane [data-ai-inbox-artifact-id="${artifactId}"]`)
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  }, slowFixture.artifactId);
  await page.evaluate((artifactId) => {
    document
      .querySelector(`#aiInboxPanel .ai-inbox-list-pane [data-ai-inbox-artifact-id="${artifactId}"]`)
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  }, fastFixture.artifactId);

  await waitFor(async () => {
    const detailText = await page.locator("#aiInboxPanel .ai-inbox-detail-pane").textContent();
    assert.match(String(detailText || ""), new RegExp(escapeRegExp(fastFixture.suggestionId)));
    assert.doesNotMatch(String(detailText || ""), new RegExp(escapeRegExp(slowFixture.suggestionId)));
  }, 8000);

  await page.locator("#aiInboxSuggestionContentEditor").fill(JSON.stringify({ thesis: "Duplicate inbox click should still submit once." }, null, 2));
  const editButton = page.locator('#aiInboxPanel .ai-inbox-detail-pane [data-ai-inbox-suggestion-status="edited"]');
  const firstClick = editButton.click({ force: true });

  await waitFor(async () => {
    assert.equal(await editButton.isDisabled(), true);
  }, 4000);

  await editButton.click({ force: true, timeout: 250 }).catch(() => {});
  await firstClick;

  await waitFor(async () => {
    const suggestion = await fetchJson(apiBase, `/api/v1/ai-suggestions/${encodeURIComponent(fastFixture.suggestionId)}?canonical=true`);
    assert.equal(suggestion.status, 200);
    assert.equal(suggestion.json.item.status, "edited");
    assert.equal(
      suggestion.json.item.history.filter((entry) => entry.toStatus === "edited").length,
      1
    );
  }, 8000);

  assert.equal(editRequestCount, 1);
});

test("prototype AI inbox shows inline no-op UX for already adopted reviewed field suggestions without resubmitting", async (t) => {
  if (process.env.RUN_BROWSER_E2E !== "1") {
    t.skip("Set RUN_BROWSER_E2E=1 to enable browser e2e in local runs.");
    return;
  }

  const playwright = await optionalPlaywright(t);
  if (!playwright) return;

  const stack = await startPrototypeStack(t, playwright);
  if (!stack) return;
  const { apiBase, page, webBase } = stack;

  const fixture = await createAiFieldSuggestionFixture(apiBase, {
    title: "Inbox no-op reviewed adopt target",
    body: "Triggering adopt again from reviewed detail should no-op inline instead of resubmitting."
  });
  await adoptSuggestionAsDraftViaApi(apiBase, fixture);

  let adoptPostCount = 0;
  await page.route(`${apiBase}/api/v1/ai/inbox/${fixture.artifactId}/adopt-field-suggestion?canonical=true`, async (route, request) => {
    if (request.method() === "POST") adoptPostCount += 1;
    await route.continue();
  });

  await reloadPrototype(page, webBase);
  await openAiInboxModule(page);
  await filterAiInboxBySourceNote(page, fixture.noteId);
  await page.locator('#aiInboxPanel [data-ai-inbox-view="reviewed"]').click();

  const reviewedItem = page.locator(`#aiInboxPanel .ai-inbox-list-pane [data-ai-inbox-artifact-id="${fixture.artifactId}"]`);
  await reviewedItem.waitFor();
  await reviewedItem.click();

  await waitFor(async () => {
    const button = page.locator(`#aiInboxPanel .ai-inbox-detail-pane [data-ai-inbox-adopt-field="${fixture.artifactId}"]`);
    assert.equal(await button.isDisabled(), true);
  }, 8000);

  await page.evaluate((artifactId) => {
    const button = document.querySelector(`#aiInboxPanel .ai-inbox-detail-pane [data-ai-inbox-adopt-field="${artifactId}"]`);
    if (!button) throw new Error("missing adopt-field button");
    button.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  }, fixture.artifactId);

  await waitFor(async () => {
    const detailText = await page.locator("#aiInboxPanel .ai-inbox-detail-pane").textContent();
    assert.match(String(detailText || ""), /This field suggestion is already (Adopted as draft|已采纳为草稿)\./);
    assert.equal(await page.locator('#aiInboxPanel .ai-inbox-detail-pane [data-ai-inbox-action-notice="true"]').count(), 1);
  }, 8000);

  assert.equal(adoptPostCount, 0);
  const suggestion = await fetchJson(apiBase, `/api/v1/ai-suggestions/${encodeURIComponent(fixture.suggestionId)}?canonical=true`);
  assert.equal(suggestion.status, 200);
  assert.equal(suggestion.json.item.status, "adopted_as_draft");
});

test("prototype settings AI suggestions panel edits confirms and rejects suggestions through the real review flow", async (t) => {
  if (process.env.RUN_BROWSER_E2E !== "1") {
    t.skip("Set RUN_BROWSER_E2E=1 to enable browser e2e in local runs.");
    return;
  }

  const playwright = await optionalPlaywright(t);
  if (!playwright) return;

  const stack = await startPrototypeStack(t, playwright);
  if (!stack) return;
  const { apiBase, page, webBase } = stack;

  const editableFixture = await createAiFieldSuggestionFixture(apiBase, {
    title: "Settings editable target",
    body: "This suggestion should be edited and then confirmed from settings."
  });
  await adoptSuggestionAsDraftViaApi(apiBase, editableFixture);

  const rejectFixture = await createAiFieldSuggestionFixture(apiBase, {
    title: "Settings reject target",
    body: "This suggestion should be rejected from settings."
  });
  const editedThesis = "Settings browser review produced the final user-owned thesis.";

  await reloadPrototype(page, webBase);
  await openSettingsModule(page, "automation");

  await filterAiSuggestionsByTarget(page, editableFixture.noteId);
  const editableRow = page.locator(`#settingsAiSuggestionsPanel .ai-inbox-list-pane [data-ai-suggestion-id="${editableFixture.suggestionId}"]`);
  await editableRow.waitFor();
  await editableRow.click();

  await waitFor(async () => {
    assert.equal(await page.locator("#aiSuggestionContentEditor").isVisible(), true);
    const detailText = await page.locator("#settingsAiSuggestionsPanel .ai-inbox-detail-pane").textContent();
    assert.match(String(detailText || ""), /Adopted as draft|已采纳为草稿/);
  }, 8000);

  await page.locator("#aiSuggestionContentEditor").fill(JSON.stringify({ thesis: editedThesis }, null, 2));
  await page.locator('#settingsAiSuggestionsPanel .ai-inbox-detail-pane [data-ai-suggestion-status="edited"]').click();

  await waitFor(async () => {
    const suggestion = await fetchJson(apiBase, `/api/v1/ai-suggestions/${encodeURIComponent(editableFixture.suggestionId)}?canonical=true`);
    assert.equal(suggestion.status, 200);
    assert.equal(suggestion.json.item.status, "edited");
    assert.equal(suggestionFieldValue(suggestion.json.item.content, editableFixture.targetField), editedThesis);
  }, 8000);

  await page.locator("#aiSuggestionContentEditor").fill(JSON.stringify({ thesis: editedThesis }, null, 2));
  const firstConfirmButton = page.locator('#settingsAiSuggestionsPanel .ai-inbox-detail-pane [data-ai-suggestion-status="confirmed"]');
  await waitFor(async () => {
    assert.equal(await firstConfirmButton.isEnabled(), true);
  }, 8000);
  await firstConfirmButton.click({ force: true });

  await waitFor(async () => {
    const suggestion = await fetchJson(apiBase, `/api/v1/ai-suggestions/${encodeURIComponent(editableFixture.suggestionId)}?canonical=true`);
    assert.equal(suggestion.status, 200);
    assert.equal(suggestion.json.item.status, "confirmed");
    assert.equal(suggestionFieldValue(suggestion.json.item.content, editableFixture.targetField), editedThesis);
  }, 8000);
  await waitFor(async () => {
    assert.equal(await page.locator("#settingsAiSuggestionsPanel .ai-inbox-detail.is-busy").count(), 0);
  }, 8000);

  await waitFor(async () => {
    await page.locator("#aiSuggestionStatusFilter").selectOption("all");
    await page.locator("#aiSuggestionTargetIdFilter").fill("");
    assert.equal(await page.locator("#aiSuggestionStatusFilter").inputValue(), "all");
    assert.equal(await page.locator("#aiSuggestionTargetIdFilter").inputValue(), "");
  }, 8000);
  await page.locator("#btnAiSuggestionsApplyFilters").click();
  const rejectRow = page.locator(`#settingsAiSuggestionsPanel .ai-inbox-list-pane [data-ai-suggestion-id="${rejectFixture.suggestionId}"]`);
  await rejectRow.waitFor();
  await rejectRow.click();
  await page.locator('#settingsAiSuggestionsPanel .ai-inbox-detail-pane [data-ai-suggestion-status="rejected"]').click();

  await waitFor(async () => {
    const suggestion = await fetchJson(apiBase, `/api/v1/ai-suggestions/${encodeURIComponent(rejectFixture.suggestionId)}?canonical=true`);
    assert.equal(suggestion.status, 200);
    assert.equal(suggestion.json.item.status, "rejected");
  }, 8000);

  await waitFor(async () => {
    const detailText = await page.locator("#settingsAiSuggestionsPanel .ai-inbox-detail-pane").textContent();
    assert.match(String(detailText || ""), /Rejected|已拒绝/);
  }, 8000);
});

test("prototype settings AI suggestions guards stale detail selection and duplicate review submits", async (t) => {
  if (process.env.RUN_BROWSER_E2E !== "1") {
    t.skip("Set RUN_BROWSER_E2E=1 to enable browser e2e in local runs.");
    return;
  }

  const playwright = await optionalPlaywright(t);
  if (!playwright) return;

  const stack = await startPrototypeStack(t, playwright);
  if (!stack) return;
  const { apiBase, page, webBase } = stack;

  const slowFixture = await createAiFieldSuggestionFixture(apiBase, {
    title: "Settings stale selection slow target",
    body: "The first detail request should resolve too late and must not overwrite the second selection."
  });
  const fastFixture = await createAiFieldSuggestionFixture(apiBase, {
    title: "Settings stale selection fast target",
    body: "The second detail request should win and stay visible."
  });
  await adoptSuggestionAsDraftViaApi(apiBase, slowFixture);
  await adoptSuggestionAsDraftViaApi(apiBase, fastFixture);

  let delayedSlowDetail = false;
  await page.route(`${apiBase}/api/v1/ai-suggestions/${slowFixture.suggestionId}?canonical=true`, async (route) => {
    if (!delayedSlowDetail) {
      delayedSlowDetail = true;
      await new Promise((resolve) => setTimeout(resolve, 700));
    }
    await route.continue();
  });

  let editRequestCount = 0;
  await page.route(`${apiBase}/api/v1/ai-suggestions/${fastFixture.suggestionId}?canonical=true`, async (route, request) => {
    if (request.method() === "PATCH") {
      editRequestCount += 1;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    await route.continue();
  });

  await reloadPrototype(page, webBase);
  await openSettingsModule(page, "automation");

  const slowRow = page.locator(`#settingsAiSuggestionsPanel .ai-inbox-list-pane [data-ai-suggestion-id="${slowFixture.suggestionId}"]`);
  const fastRow = page.locator(`#settingsAiSuggestionsPanel .ai-inbox-list-pane [data-ai-suggestion-id="${fastFixture.suggestionId}"]`);
  await slowRow.waitFor();
  await fastRow.waitFor();

  await slowRow.click();
  await fastRow.click();

  await waitFor(async () => {
    const detailText = await page.locator("#settingsAiSuggestionsPanel .ai-inbox-detail-pane").textContent();
    assert.match(String(detailText || ""), new RegExp(escapeRegExp(fastFixture.noteId)));
    assert.doesNotMatch(String(detailText || ""), new RegExp(escapeRegExp(slowFixture.noteId)));
  }, 8000);

  await page.locator("#aiSuggestionContentEditor").fill(JSON.stringify({ thesis: "Duplicate click should still submit once." }, null, 2));
  const editButton = page.locator('#settingsAiSuggestionsPanel .ai-inbox-detail-pane [data-ai-suggestion-status="edited"]');
  const firstClick = editButton.click();

  await waitFor(async () => {
    assert.equal(await editButton.isDisabled(), true);
  }, 4000);

  await editButton.click({ timeout: 250 }).catch(() => {});
  await firstClick;

  await waitFor(async () => {
    const suggestion = await fetchJson(apiBase, `/api/v1/ai-suggestions/${encodeURIComponent(fastFixture.suggestionId)}?canonical=true`);
    assert.equal(suggestion.status, 200);
    assert.equal(suggestion.json.item.status, "edited");
    assert.equal(
      suggestion.json.item.history.filter((entry) => entry.toStatus === "edited").length,
      1
    );
  }, 8000);

  assert.equal(editRequestCount, 1);
});

test("prototype settings AI suggestions review-action continuity keeps detail aligned with filtered selection changes", async (t) => {
  if (process.env.RUN_BROWSER_E2E !== "1") {
    t.skip("Set RUN_BROWSER_E2E=1 to enable browser e2e in local runs.");
    return;
  }

  const playwright = await optionalPlaywright(t);
  if (!playwright) return;

  const stack = await startPrototypeStack(t, playwright);
  if (!stack) return;
  const { apiBase, page, webBase } = stack;

  const firstEditedFixture = await createAiFieldSuggestionFixture(apiBase, {
    title: "Settings filtered continuity first edited target",
    body: "Confirming this edited suggestion should move selection to the next filtered suggestion."
  });
  await adoptSuggestionAsDraftViaApi(apiBase, firstEditedFixture);
  await markSuggestionEditedViaApi(apiBase, firstEditedFixture, "First edited fixture should leave the edited filter after confirm.");

  const secondEditedFixture = await createAiFieldSuggestionFixture(apiBase, {
    title: "Settings filtered continuity second edited target",
    body: "This edited suggestion should become the next visible detail after the first one is confirmed."
  });
  await adoptSuggestionAsDraftViaApi(apiBase, secondEditedFixture);
  await markSuggestionEditedViaApi(apiBase, secondEditedFixture, "Second edited fixture should stay visible in the edited filter.");

  const loneEditedFixture = await createAiFieldSuggestionFixture(apiBase, {
    title: "Settings filtered continuity lone edited target",
    body: "Confirming the last edited suggestion should clear the filtered list and detail."
  });
  await adoptSuggestionAsDraftViaApi(apiBase, loneEditedFixture);
  await markSuggestionEditedViaApi(apiBase, loneEditedFixture, "Lone edited fixture should empty the edited filter after confirm.");

  await reloadPrototype(page, webBase);
  await openSettingsModule(page, "automation");

  await filterAiSuggestionsByStatus(page, "edited");
  const firstEditedRow = page.locator(
    `#settingsAiSuggestionsPanel .ai-inbox-list-pane [data-ai-suggestion-id="${firstEditedFixture.suggestionId}"]`
  );
  await firstEditedRow.waitFor();
  await firstEditedRow.click({ force: true });

  await waitFor(async () => {
    const detailText = await page.locator("#settingsAiSuggestionsPanel .ai-inbox-detail-pane").textContent();
    assert.match(String(detailText || ""), new RegExp(escapeRegExp(firstEditedFixture.noteId)));
    assert.match(String(detailText || ""), /Confirm|确认/);
    assert.equal(await page.locator("#aiSuggestionContentEditor").isVisible(), true);
  }, 8000);

  const loneConfirmButton = page.locator('#settingsAiSuggestionsPanel .ai-inbox-detail-pane [data-ai-suggestion-status="confirmed"]:visible');
  await waitFor(async () => {
    assert.equal(await loneConfirmButton.isEnabled(), true);
  }, 8000);
  await loneConfirmButton.click({ force: true });

  await waitFor(async () => {
    const suggestion = await fetchJson(
      apiBase,
      `/api/v1/ai-suggestions/${encodeURIComponent(firstEditedFixture.suggestionId)}?canonical=true`
    );
    assert.equal(suggestion.status, 200);
    assert.equal(suggestion.json.item.status, "confirmed");
  }, 8000);

  await waitFor(async () => {
    const detailText = await page.locator("#settingsAiSuggestionsPanel .ai-inbox-detail-pane").textContent();
    assert.doesNotMatch(String(detailText || ""), new RegExp(escapeRegExp(firstEditedFixture.noteId)));
    const switchedToRemainingSuggestion =
      new RegExp(escapeRegExp(secondEditedFixture.noteId)).test(String(detailText || "")) ||
      new RegExp(escapeRegExp(loneEditedFixture.noteId)).test(String(detailText || ""));
    assert.equal(switchedToRemainingSuggestion, true);
  }, 8000);

  await waitFor(async () => {
    assert.equal(await firstEditedRow.count(), 0);
    const activeRows = await page.locator("#settingsAiSuggestionsPanel .ai-inbox-list-pane .ai-inbox-item.is-active").count();
    assert.equal(activeRows >= 1, true);
  }, 8000);

  await filterAiSuggestionsByTarget(page, loneEditedFixture.noteId);
  const loneEditedRow = page.locator(
    `#settingsAiSuggestionsPanel .ai-inbox-list-pane [data-ai-suggestion-id="${loneEditedFixture.suggestionId}"]`
  );

  await waitFor(async () => {
    const listText = await page.locator("#settingsAiSuggestionsPanel .ai-inbox-list-pane").textContent();
    assert.match(String(listText || ""), new RegExp(escapeRegExp(loneEditedFixture.noteId)));
    assert.doesNotMatch(String(listText || ""), new RegExp(escapeRegExp(secondEditedFixture.noteId)));
    assert.equal(await loneEditedRow.count(), 1);
  }, 8000);

  await loneEditedRow.first().click({ force: true });

  await waitFor(async () => {
    const className = await loneEditedRow.first().getAttribute("class");
    assert.match(String(className || ""), /is-active/);
  }, 8000);

  await waitFor(async () => {
    const detailText = await page.locator("#settingsAiSuggestionsPanel .ai-inbox-detail-pane").textContent();
    assert.match(String(detailText || ""), new RegExp(escapeRegExp(loneEditedFixture.noteId)));
  }, 8000);

  await page.locator('#settingsAiSuggestionsPanel .ai-inbox-detail-pane [data-ai-suggestion-status="confirmed"]').click({ force: true });

  await waitFor(async () => {
    const suggestion = await fetchJson(
      apiBase,
      `/api/v1/ai-suggestions/${encodeURIComponent(loneEditedFixture.suggestionId)}?canonical=true`
    );
    assert.equal(suggestion.status, 200);
    assert.equal(suggestion.json.item.status, "confirmed");
  }, 8000);

  await waitFor(async () => {
    const listText = await page.locator("#settingsAiSuggestionsPanel .ai-inbox-list-pane").textContent();
    const detailText = await page.locator("#settingsAiSuggestionsPanel .ai-inbox-detail-pane").textContent();
    assert.match(String(listText || ""), /No AI suggestions match these filters|没有符合这些筛选条件的待确认建议/);
    assert.match(String(detailText || ""), /Pick a suggestion to inspect its target, content, and review history|选择一条建议后/);
    assert.doesNotMatch(String(detailText || ""), /Loading suggestion detail/);
    assert.doesNotMatch(String(detailText || ""), new RegExp(escapeRegExp(loneEditedFixture.noteId)));
  }, 8000);
});
