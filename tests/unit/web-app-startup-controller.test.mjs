import test from "node:test";
import assert from "node:assert/strict";

import { bootstrapAppForRuntime } from "../../apps/web/src/app-startup-controller.js";
import { initializeAppRouteForRuntime } from "../../apps/web/src/app-route-initializer.js";
import { openInitialStartupRouteForRuntime } from "../../apps/web/src/app-startup-seed.js";

test("startup controller wires import toolbar events then initializes route and startup note", async () => {
  const calls = [];
  let fallback = false;
  await bootstrapAppForRuntime({
    state: { browserRootId: "root" },
    importState: { importRecordId: "import-1" },
    setUsingLocalFallbackData: (value) => {
      calls.push(["fallback", value]);
      fallback = value;
    },
    getUsingLocalFallbackData: () => fallback,
    renderImportPageShell: () => calls.push(["renderImportShell"]),
    createImportToolbarActions: (options) => {
      calls.push(["createToolbar", typeof options.onPreviewSuccess, typeof options.onConfirmSuccess]);
      return { handlePreview: async () => {} };
    },
    renderImportToolbar: () => calls.push(["renderToolbar"]),
    bindImportWorkspaceEvents: ({ importToolbarActions }) => calls.push(["bindEvents", Boolean(importToolbarActions)]),
    initializeAppRoute: async () => calls.push(["initRoute"]),
    renderAll: () => calls.push(["renderAll"]),
    openInitialStartupRoute: async ({ usingLocalFallbackData }) => calls.push(["openStartup", usingLocalFallbackData]),
    setStatus: () => {}
  });

  assert.deepEqual(calls, [
    ["fallback", false],
    ["renderImportShell"],
    ["createToolbar", "function", "function"],
    ["renderToolbar"],
    ["bindEvents", true],
    ["renderAll"],
    ["initRoute"],
    ["renderAll"],
    ["openStartup", false]
  ]);
});

test("startup controller keeps confirmed import results visible", async () => {
  const calls = [];
  let confirmSuccess = null;
  await bootstrapAppForRuntime({
    state: { browserRootId: "root", selectedFolderId: "root" },
    importState: { importRecordId: "import-1", directoryId: "root" },
    setUsingLocalFallbackData: () => {},
    renderImportPageShell: () => {},
    createImportToolbarActions: (options) => {
      confirmSuccess = options.onConfirmSuccess;
      return {};
    },
    renderImportToolbar: () => {},
    bindImportWorkspaceEvents: () => {},
    initializeAppRoute: async () => {},
    openInitialStartupRoute: async () => {},
    confirmedImportTargetDirectoryId: () => "",
    preferredImportDirectoryId: (value) => value,
    setImportRecordId: (id) => calls.push(["record", id]),
    showImportResult: (payload) => calls.push(["result", payload.stage]),
    activateModule: (moduleName) => calls.push(["module", moduleName]),
    hideImportOperationResultModal: () => calls.push(["hideModal"]),
    renderAll: () => {}
  });

  await confirmSuccess({
    importRecordId: "import-1",
    result: { status: "completed", result: { organizingOverview: { permanentCount: 1 } } },
    preview: { candidatePreview: null }
  });

  assert.deepEqual(calls, [
    ["record", "import-1"],
    ["result", "confirm"]
  ]);
});

test("startup controller keeps the shell usable when startup initialization throws", async () => {
  const calls = [];
  let fallback = true;
  await bootstrapAppForRuntime({
    state: { browserRootId: "root" },
    importState: { importRecordId: "import-1" },
    setUsingLocalFallbackData: (value) => {
      calls.push(["fallback", value]);
      fallback = value;
    },
    getUsingLocalFallbackData: () => fallback,
    renderImportPageShell: () => calls.push(["renderImportShell"]),
    createImportToolbarActions: () => ({}),
    renderImportToolbar: () => calls.push(["renderToolbar"]),
    bindImportWorkspaceEvents: () => calls.push(["bindEvents"]),
    initializeAppRoute: async () => {
      throw new Error("dev instance is still running");
    },
    renderAll: () => calls.push(["renderAll"]),
    activateModule: (moduleName) => calls.push(["module", moduleName]),
    openInitialStartupRoute: async () => calls.push(["unexpectedStartupRoute"]),
    setStatus: (message, tone, options) => calls.push(["status", tone, /dev instance is still running/.test(message), options?.force])
  });

  assert.deepEqual(calls, [
    ["fallback", false],
    ["renderImportShell"],
    ["renderToolbar"],
    ["bindEvents"],
    ["renderAll"],
    ["fallback", false],
    ["module", "today"],
    ["renderAll"],
    ["status", "bad", true, true]
  ]);
});

test("route initializer connects API and marks browser fallback on web failures", async () => {
  const successCalls = [];
  const success = await initializeAppRouteForRuntime({
    state: { browserRootId: "root" },
    refreshVaultSettings: async () => successCalls.push("vault"),
    syncDirectoriesFromApi: async () => successCalls.push("dirs"),
    syncNotesForDirectoryTree: async (id) => successCalls.push(["notes", id]),
    getApiBase: () => "http://api",
    setStatus: (message, tone) => successCalls.push(["status", tone, message])
  });

  assert.equal(success.connected, true);
  assert.deepEqual(successCalls.slice(0, 3), ["vault", "dirs", ["notes", "root"]]);

  const fallbackCalls = [];
  const fallback = await initializeAppRouteForRuntime({
    refreshVaultSettings: async () => {
      throw new Error("offline");
    },
    windowRef: {},
    setUsingLocalFallbackData: (value) => fallbackCalls.push(["fallback", value]),
    setStatus: (message, tone) => fallbackCalls.push(["status", tone, message])
  });

  assert.equal(fallback.connected, false);
  assert.equal(fallback.usingLocalFallbackData, true);
  assert.deepEqual(fallbackCalls[0], ["fallback", true]);
  assert.equal(fallbackCalls[1][1], "warn");
});

test("route initializer does not mask API connection failures as local empty data", async () => {
  const calls = [];
  const apiError = new Error("API 未连接");
  apiError.code = "api_unavailable";
  apiError.apiBase = "http://127.0.0.1:3999";

  const result = await initializeAppRouteForRuntime({
    refreshVaultSettings: async () => {
      throw apiError;
    },
    windowRef: {},
    isApiConnectionError: (error) => error?.code === "api_unavailable",
    apiConnectionErrorMessage: (error) => `API 未连接，不能读取笔记库。当前尝试地址：${error.apiBase}`,
    setUsingLocalFallbackData: (value) => calls.push(["fallback", value]),
    setStatus: (message, tone) => calls.push(["status", tone, message])
  });

  assert.equal(result.connected, false);
  assert.equal(result.usingLocalFallbackData, false);
  assert.deepEqual(calls[0], ["fallback", false]);
  assert.equal(calls[1][1], "bad");
  assert.match(calls[1][2], /API 未连接/);
});

test("route initializer shows install-friendly desktop API failure message", async () => {
  const dialogCalls = [];
  const result = await initializeAppRouteForRuntime({
    refreshVaultSettings: async () => {
      throw new Error("桌面内置服务未启动");
    },
    getApiBase: () => "",
    windowRef: {
      __TAURI__: {
        core: {
          invoke: async (command) => {
            assert.equal(command, "get_desktop_api_status");
            return {
              baseUrl: "",
              running: false,
              launchError: "Yansilu desktop API runtime is incomplete."
            };
          }
        },
        dialog: {
          message: async (message, options) => dialogCalls.push([message, options])
        }
      }
    },
    setStatus: () => {}
  });

  assert.equal(result.connected, false);
  assert.equal(dialogCalls.length, 1);
  assert.equal(dialogCalls[0][1].title, "本地服务启动失败");
  assert.match(dialogCalls[0][0], /本地服务没有启动完成/);
  assert.match(dialogCalls[0][0], /runtime is incomplete/);
  assert.doesNotMatch(dialogCalls[0][0], /npm run dev:api/);
  assert.doesNotMatch(dialogCalls[0][0], /联系开发者获取“内置 API”的版本/);
});

test("startup route opener auto-opens demo then explicit note then fallback note", async () => {
  const demoCalls = [];
  const demo = await openInitialStartupRouteForRuntime({
    windowRef: { location: { search: "?demo=smart-notes" } },
    state: { notes: [] },
    confirm: (message) => {
      demoCalls.push(["confirm", /Smart Notes Demo/.test(message)]);
      return true;
    },
    importSmartNotesProductThinkingDemo: async (payload) => {
      demoCalls.push(["demo", payload.startup, payload.confirmed]);
      return true;
    },
    renderAll: () => demoCalls.push("render")
  });
  assert.equal(demo.route, "demo");
  assert.deepEqual(demoCalls, [["demo", true, true], "render"]);

  const state = { notes: [{ id: "n1", folderId: "f1" }] };
  const note = await openInitialStartupRouteForRuntime({
    windowRef: { location: { search: "?note=n1" } },
    state,
    rootBoxIdFromFolder: () => "root",
    openNoteById: (id) => {
      assert.equal(id, "n1");
      return true;
    }
  });
  assert.equal(note.route, "note");
  assert.equal(state.browserRootId, "root");
  assert.equal(state.selectedFolderId, "f1");

  const fallbackCalls = [];
  const fallback = await openInitialStartupRouteForRuntime({
    windowRef: { location: { search: "" } },
    state: { notes: [] },
    usingLocalFallbackData: true,
    preferredLocalFallbackNote: () => ({ id: "fallback", folderId: "f2", title: "Fallback" }),
    rootBoxIdFromFolder: () => "root2",
    openNoteById: (id, options) => fallbackCalls.push(["open", id, options]),
    setStatus: (message, tone) => fallbackCalls.push(["status", tone, message])
  });
  assert.equal(fallback.route, "fallback_note");
  assert.equal(fallbackCalls[0][1], "fallback");
  assert.equal(fallbackCalls[1][1], "warn");
});

test("startup route opener reads late auto-open suppression before creating an untitled note", async () => {
  let suppressed = false;
  let created = 0;
  const route = await openInitialStartupRouteForRuntime({
    windowRef: { location: { search: "" } },
    state: { notes: [] },
    getStartupAutoOpenSuppressed: () => {
      suppressed = true;
      return suppressed;
    },
    openStartupUntitledNote: async () => {
      created += 1;
    }
  });

  assert.equal(route.route, "skipped");
  assert.equal(created, 0);
});

test("startup route opener opens existing Smart Notes Demo guide instead of showing empty start", async () => {
  const calls = [];
  const state = {
    folders: [{ id: "demo-dir", title: "写作 Demo（卡片笔记写作法 x 产品思考）" }],
    notes: []
  };
  const route = await openInitialStartupRouteForRuntime({
    windowRef: { location: { search: "" } },
    state,
    rootBoxIdFromFolder: (_state, directoryId) => `root:${directoryId}`,
    syncNotesForDirectory: async (directoryId) => {
      calls.push(["sync", directoryId]);
      state.notes.push({
        id: "GUIDE-SMART-NOTES-START",
        folderId: directoryId,
        title: "00 从这里开始：10 分钟走完研思录"
      });
    },
    activateModule: (moduleName) => calls.push(["module", moduleName]),
    openNoteById: (id, options) => calls.push(["open", id, options]),
    setStatus: (message, tone) => calls.push(["status", tone, message])
  });

  assert.equal(route.route, "existing_demo");
  assert.equal(route.noteId, "GUIDE-SMART-NOTES-START");
  assert.equal(state.browserRootId, "root:demo-dir");
  assert.equal(state.selectedFolderId, "demo-dir");
  assert.deepEqual(calls[0], ["sync", "demo-dir"]);
  assert.deepEqual(calls[1], ["sync", "dir_demo_smart_notes_product_thinking_guide"]);
  assert.deepEqual(calls[2], ["module", "explorer"]);
  assert.equal(calls[3][0], "open");
  assert.equal(calls[4][1], "ok");
});

test("startup route opener falls back to home when existing Smart Notes Demo guide cannot load", async () => {
  const calls = [];
  const state = {
    folders: [{ id: "demo-dir", title: "写作 Demo（卡片笔记写作法 x 产品思考）" }],
    notes: []
  };
  const route = await openInitialStartupRouteForRuntime({
    windowRef: { location: { search: "" } },
    state,
    rootBoxIdFromFolder: (_state, directoryId) => `root:${directoryId}`,
    syncNotesForDirectory: async () => {
      throw new Error("locked");
    },
    activateModule: (moduleName) => calls.push(["module", moduleName]),
    setStatus: (message, tone) => calls.push(["status", tone, message])
  });

  assert.equal(route.route, "today");
  assert.deepEqual(calls[0], ["status", "warn", "Demo 导览暂时无法自动打开：locked"]);
  assert.deepEqual(calls[1], ["module", "today"]);
});

test("startup route opener defaults to organizer when no note is requested", async () => {
  const calls = [];
  const route = await openInitialStartupRouteForRuntime({
    windowRef: { location: { search: "" } },
    state: { notes: [] },
    activateModule: (moduleName) => calls.push(["module", moduleName]),
    openStartupUntitledNote: async () => calls.push(["untitled"])
  });

  assert.equal(route.route, "today");
  assert.deepEqual(calls, [["module", "today"]]);
});
