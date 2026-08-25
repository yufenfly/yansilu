import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { execFile, spawn } from "node:child_process";

import {
  publicImportRecord,
} from "../../../packages/connectors/src/index.mjs";
import {
  assertLocalRuntimeControlAllowed
} from "./local-runtime-control.mjs";
import {
  handleMobileApiRequest
} from "./mobile-access-service.mjs";
import {
  requestMayAccessLan
} from "./api-request-network-scope.mjs";
import {
  LOCAL_MODEL_TIERS,
  OLLAMA_INSTALL_URL,
  OLLAMA_RECOMMENDED_MODEL,
  assertAllowedOllamaCatalogModel,
  currentPlatformName,
  hasOllamaModel,
  localAiBootstrapStatus,
  normalizeLocalRuntimeMode,
  ollamaInstallGuide,
  ollamaReadinessStatus
} from "./ollama-local-runtime-model.mjs";
import {
  createDirectory,
  createIndexCard,
  createEncryptedVaultBackup,
  createNoteInDirectory,
  createNoteRelation,
  deleteDirectory,
  deleteNoteRelation,
  deleteNoteById,
  distillIndexCard,
  detectGraphConflicts,
  findNotePath,
  getNoteById,
  getIndexCard,
  initVault,
  getDirectoryGraph,
  listDistillationQueue,
  listDirectories,
  listIndexCards,
  listNoteRelations,
  listRelationReviewQueue,
  listTags,
  listNotesByTag,
  listNotesInDirectory,
  moveNoteToDirectory,
  registerMarkdownNoteInCatalog,
  resolveVaultPath,
  saveNoteAsset,
  searchNotes,
  restoreEncryptedVaultBackup,
  updateIndexCard,
  updateDirectory,
  updateNoteContent,
  updatePermanentNoteDistillation,
  updateNoteRelation,
  confirmPermanentNoteDistillation,
  writeLiteratureNoteIfAbsent,
  writePermanentNoteIfAbsent,
  writeSourceIfAbsent
} from "../../../packages/domain/src/index.mjs";
import { normalizeOriginalityPlan, originalityGuard } from "../../../packages/originality-guard/src/index.mjs";
import {
  addNotebookLmDraft,
  createPaperPermanentCandidate,
  createPaperWorkspace,
  getPaperWorkspace,
  savePaperPermanentNote,
  savePaperTranslation
} from "../../../packages/paper-workspace/src/index.mjs";
import {
  bindDraftNoteToProject,
  createDraftScaffold,
  createWritingProject,
  getDraftScaffold,
  getWritingProject,
  listProjectDraftVersions,
  listProjectScaffolds,
  listWritingProjects,
  setCurrentDraftNote,
  syncWritingProject,
  updateDraftScaffold,
  updateDraftNoteVersionNote,
  updateDraftScaffoldVersionNote,
  updateWritingProjectBookStructure,
  updateWritingProjectIntent
} from "../../../packages/writing-engine/src/index.mjs";
import { seedSmartNotesProductThinking } from "../../../scripts/seed-smart-notes-product-thinking.mjs";
import {
  checkForAppUpdate,
  readPackageVersion,
  resolveUpdateManifestUrl
} from "../../../packages/app-update/src/index.mjs";
import {
  aiInboxItemToCanonical,
  createSqliteAiPreferencesStore,
  createSqliteAiProviderConfigStore,
  createSqliteScheduledAgentTaskStore,
  createSqliteArtifactStore,
  createSqliteSuggestionStore,
  createAiInbox,
  createSqliteProviderHealthStore,
  createAiHarnessRuntime,
  createCoreNoteTools,
  createProviderAdapterRegistry,
  degradedSuggestionTraceFromArtifact,
  artifactDecisionToCanonicalAdoptionEvent,
  artifactToCanonical,
  analyzePermanentNoteForReview,
  analyzePermanentNoteGraphLocally,
  buildPermanentNoteGraphReviewItems,
  buildPotentialRelationCandidates,
  buildPotentialRelationAiBatches,
  DEFAULT_POTENTIAL_RELATION_AI_NUM_PREDICT,
  buildPermanentNoteLocalModelRequest,
  assertProviderModelCallAllowed,
  createScheduledTaskFromTemplate,
  DEFAULT_POTENTIAL_RELATION_MODEL,
  DEFAULT_LOCAL_AI_MODEL_DOWNLOAD_COMMAND,
  LOCAL_AI_MODEL_TIERS,
  LOCAL_AI_RECOMMENDED_MODELS,
  localModelProfile,
  listScheduledAgentTaskTemplates,
  PotentialRelationAiCache,
  preferencesToSettingsInput,
  refinePotentialRelationCandidateWithLocalAi,
  providerConfigToSettingsInput,
  assertValidAiProviderConfig,
  resolveAiUserSettings,
  resolveModelRoute,
  resolveProviderDescriptor,
  mergePermanentNoteLocalModelResponse,
  runPermanentNoteLocalModelAnalysis,
  buildWritingStrongModelRequest,
  mergeWritingStrongModelResponse,
  runWritingStrongModelAnalysis,
  runDueScheduledAgentTasks,
  runProviderHealthCheck,
  scheduledTaskToCanonical,
  acceptLinkAndRecordArtifactDecisionAtomically,
  adoptSuggestionAndLinkedArtifactAtomically,
  promoteNoteAndRecordArtifactDecisionAtomically,
  transitionSuggestionStatus,
  suggestionTransitionToCanonicalAdoptionEvent,
  suggestionToCanonical
} from "../../../packages/ai-orchestrator/src/index.mjs";
import { createImportExportService } from "./import-export-service.mjs";
import { createVaultBackupJobGate, createVaultWriteGate } from "./vault-write-gate.mjs";

const PORT = Number(process.env.API_PORT || 3000);
const HOST = String(process.env.API_HOST || "127.0.0.1");
const WEB_PORT = Number(process.env.WEB_PORT || 5173);
const PROTOTYPE_URL = String(process.env.PROTOTYPE_URL || `http://127.0.0.1:${WEB_PORT}/prototype`);
const CWD = process.cwd();
const PACKAGE_JSON_PATH = path.join(CWD, "package.json");
const MOBILE_WEB_DIR = path.join(CWD, "apps", "web", "src");
const DEFAULT_VAULT_PATH = path.resolve(process.env.VAULT_PATH || path.join(CWD, "vault-example", "yansilu-vault"));
const OLLAMA_BASE_URL = String(process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434").replace(/\/+$/, "");
const OLLAMA_RECOMMENDED_MODELS = [...LOCAL_AI_RECOMMENDED_MODELS];
const DEFAULT_OLLAMA_GENERATE_TIMEOUT_MS = 60000;
const MAX_OLLAMA_GENERATE_TIMEOUT_MS = 180000;
const managedOllamaProcessIds = new Set();
const APP_UPDATE_CHANNEL = String(process.env.YANSILU_UPDATE_CHANNEL || "beta").trim() || "beta";
let VAULT_PATH = DEFAULT_VAULT_PATH;
let AI_SECRET_STATE_PATH = path.resolve(DEFAULT_VAULT_PATH, ".yansilu", "ai-secrets.json");
let aiPreferencesStorePromise = null;
let aiProviderConfigStorePromise = null;
let aiProviderHealthStorePromise = null;
let aiScheduledTaskStorePromise = null;
let aiArtifactStorePromise = null;
let aiSuggestionStorePromise = null;
const potentialRelationAiCache = new PotentialRelationAiCache();
let appVersionPromise = null;
let apiReady = false;
let apiStartupError = "";
const vaultWriteGate = createVaultWriteGate();
const vaultBackupJobGate = createVaultBackupJobGate();

async function currentAppVersion() {
  if (!appVersionPromise) {
    appVersionPromise = readPackageVersion(PACKAGE_JSON_PATH).catch(() => "0.0.0");
  }
  return appVersionPromise;
}

async function apiHealthPayload() {
  const readiness = await apiReadinessPayload();
  return {
    app: "yansilu",
    ok: apiReady && readiness.ready,
    service: "api",
    pid: process.pid,
    port: PORT,
    vaultPath: VAULT_PATH,
    ready: apiReady && readiness.ready,
    readiness,
    timestamp: new Date().toISOString(),
    version: await currentAppVersion(),
    startupError: apiStartupError || undefined
  };
}

async function pathWritableStatus(targetDir = "") {
  const filePath = path.join(targetDir, ".yansilu", ".healthcheck-write");
  try {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, String(Date.now()), "utf8");
    await fs.rm(filePath, { force: true });
    return { status: "ready", writable: true, message: "" };
  } catch (error) {
    return {
      status: "blocked",
      writable: false,
      message: cleanText(error?.message || error)
    };
  }
}

async function apiReadinessPayload() {
  const vaultExists = await fs.stat(VAULT_PATH).then((item) => item.isDirectory()).catch(() => false);
  const storage = vaultExists ? await pathWritableStatus(VAULT_PATH) : {
    status: "blocked",
    writable: false,
    message: "Vault directory does not exist."
  };
  const vaultStatus = vaultExists && storage.writable ? "ready" : "blocked";
  return {
    ready: apiReady && vaultStatus === "ready" && storage.status === "ready",
    vault: {
      status: vaultStatus,
      path: VAULT_PATH,
      exists: vaultExists
    },
    storage,
    dependencies: {
      ollama: {
        status: "external",
        managed: false,
        baseUrl: OLLAMA_BASE_URL,
        recovery: "bounded_by_local_runtime_control"
      }
    }
  };
}

async function aiPreferencesStore() {
  if (!aiPreferencesStorePromise) {
    aiPreferencesStorePromise = createSqliteAiPreferencesStore({ vaultPath: VAULT_PATH });
  }
  return aiPreferencesStorePromise;
}

async function aiProviderConfigStore() {
  if (!aiProviderConfigStorePromise) {
    aiProviderConfigStorePromise = createSqliteAiProviderConfigStore({ vaultPath: VAULT_PATH });
  }
  return aiProviderConfigStorePromise;
}

async function aiProviderHealthStore() {
  if (!aiProviderHealthStorePromise) {
    aiProviderHealthStorePromise = createSqliteProviderHealthStore({ vaultPath: VAULT_PATH });
  }
  return aiProviderHealthStorePromise;
}

async function aiScheduledTaskStore() {
  if (!aiScheduledTaskStorePromise) {
    aiScheduledTaskStorePromise = createSqliteScheduledAgentTaskStore({ vaultPath: VAULT_PATH });
  }
  return aiScheduledTaskStorePromise;
}

async function aiArtifactStore() {
  if (!aiArtifactStorePromise) {
    aiArtifactStorePromise = createSqliteArtifactStore({ vaultPath: VAULT_PATH });
  }
  return aiArtifactStorePromise;
}

async function aiSuggestionStore() {
  if (!aiSuggestionStorePromise) {
    aiSuggestionStorePromise = createSqliteSuggestionStore({ vaultPath: VAULT_PATH });
  }
  return aiSuggestionStorePromise;
}

function normalizeSecretMap(input = {}) {
  const secrets = {};
  if (!input || typeof input !== "object" || Array.isArray(input)) return secrets;
  for (const [key, value] of Object.entries(input)) {
    const name = cleanText(key);
    const secret = cleanText(value);
    if (name && secret) secrets[name] = secret;
  }
  return secrets;
}

function normalizeSecretRefList(input = []) {
  const values = Array.isArray(input) ? input : [input];
  return values.map((value) => cleanText(value)).filter(Boolean);
}

async function readLocalAiSecrets() {
  try {
    const raw = await fs.readFile(AI_SECRET_STATE_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return normalizeSecretMap(parsed?.secrets || parsed);
  } catch {
    return {};
  }
}

async function writeLocalAiSecrets(secrets = {}) {
  const cleanSecrets = normalizeSecretMap(secrets);
  await fs.mkdir(path.dirname(AI_SECRET_STATE_PATH), { recursive: true });
  await fs.writeFile(AI_SECRET_STATE_PATH, JSON.stringify({ secrets: cleanSecrets }, null, 2), "utf8");
  return cleanSecrets;
}

async function upsertLocalAiSecrets(input = {}) {
  const incoming = normalizeSecretMap(input?.secrets || input?.secretValues || input?.secret_values);
  const deleteSecrets = normalizeSecretRefList(input?.deleteSecrets || input?.delete_secrets);
  if (!Object.keys(incoming).length && !deleteSecrets.length) return readLocalAiSecrets();
  const current = await readLocalAiSecrets();
  for (const secretRef of deleteSecrets) delete current[secretRef];
  return writeLocalAiSecrets({
    ...current,
    ...incoming
  });
}

async function closeVaultScopedStores() {
  const stores = await Promise.allSettled([
    aiPreferencesStorePromise,
    aiProviderConfigStorePromise,
    aiProviderHealthStorePromise,
    aiScheduledTaskStorePromise,
    aiArtifactStorePromise,
    aiSuggestionStorePromise
  ]);
  for (const item of stores) {
    if (item.status === "fulfilled" && typeof item.value?.close === "function") {
      item.value.close();
    }
  }
  aiPreferencesStorePromise = null;
  aiProviderConfigStorePromise = null;
  aiProviderHealthStorePromise = null;
  aiScheduledTaskStorePromise = null;
  aiArtifactStorePromise = null;
  aiSuggestionStorePromise = null;
}

function advancedModelRefFrom(input = {}) {
  const advancedSettings = input.advancedSettings || input.advanced_settings || {};
  return cleanText(input.modelRef || input.model_ref || advancedSettings.modelRef || advancedSettings.model_ref);
}

function advancedSecretRefFrom(input = {}) {
  const advancedSettings = input.advancedSettings || input.advanced_settings || {};
  return cleanText(input.secretRef || input.secret_ref || advancedSettings.secretRef || advancedSettings.secret_ref);
}

function authSummary(authMode = "", options = {}) {
  const mode = cleanText(authMode);
  const labels = {
    platform_managed: "platform_managed",
    workspace_managed: "workspace_key",
    byok_advanced: "user_key",
    local_no_key: "no_key",
    enterprise_secret: "enterprise_secret"
  };
  const requiresKey = ["workspace_managed", "byok_advanced", "enterprise_secret"].includes(mode);
  const secretRef = cleanText(options.secretRef || options.secret_ref);
  const secretRefConfigured = Boolean(secretRef);
  const ready = !requiresKey || secretRefConfigured;
  const nextActions = {
    workspace_managed: "configure_workspace_key",
    byok_advanced: "add_user_key",
    enterprise_secret: "configure_enterprise_secret"
  };
  const messages = {
    platform_managed: "Platform-managed AI can run without a user-provided key.",
    local_no_key: "Local/private mode does not require a cloud API key.",
    workspace_managed: secretRefConfigured
      ? "Workspace key reference is configured."
      : "A workspace provider key reference is required before this model pack can run.",
    byok_advanced: secretRefConfigured ? "User key reference is configured." : "A user provider key reference is required before this override can run.",
    enterprise_secret: secretRefConfigured ? "Enterprise secret reference is configured." : "An enterprise secret reference is required before this provider can run."
  };
  return {
    authMode: mode,
    keyMode: labels[mode] || "unknown",
    requiresKey,
    secretRefConfigured,
    ready,
    status: ready ? "ready" : "needs_key",
    nextAction: ready ? "none" : nextActions[mode] || "configure_provider",
    message: messages[mode] || "Provider access mode is unknown."
  };
}

function disabledProviderConfigError(providerConfig = null) {
  const error = new Error("AI provider config is disabled.");
  error.code = "AI_PROVIDER_CONFIG_DISABLED";
  error.status = 400;
  error.details = {
    providerId: cleanText(providerConfig?.providerId || providerConfig?.provider_id),
    providerConfigId: cleanText(providerConfig?.id || providerConfig?.configId || providerConfig?.config_id),
    configStatus: cleanText(providerConfig?.status || providerConfig?.status_text)
  };
  return error;
}

function assertProviderResponseSucceeded(response = {}, code = "AI_PROVIDER_REQUEST_FAILED") {
  if (response?.status === "succeeded") return;
  const providerError = response?.error || {};
  const message = cleanText(providerError.message) || "Provider request failed.";
  const error = new Error(message);
  error.code = code;
  error.details = {
    providerId: cleanText(response?.providerId || response?.provider_id),
    modelRef: cleanText(response?.modelRef || response?.model_ref),
    status: cleanText(response?.status),
    providerError
  };
  throw error;
}

function providerConfigWithRunnableHealthCheck(config = {}, input = {}) {
  const healthCheck = {
    ...(config.healthCheck || {}),
    ...(input.healthCheck || input.health_check || {})
  };
  return {
    ...config,
    healthCheck: {
      enabled: true,
      endpointUrl: cleanText(healthCheck.endpointUrl || healthCheck.endpoint_url || config.endpointUrl),
      method: cleanText(healthCheck.method || "GET").toUpperCase(),
      timeoutMs: Number(healthCheck.timeoutMs ?? healthCheck.timeout_ms ?? 5000),
      expectedStatus: Number(healthCheck.expectedStatus ?? healthCheck.expected_status ?? 200),
      intervalSeconds: Number(healthCheck.intervalSeconds ?? healthCheck.interval_seconds ?? 300)
    }
  };
}

function providerHealthPreview(record = null) {
  if (!record) {
    return {
      status: "unknown",
      checkedAt: "",
      latencyMs: 0,
      message: "No provider health check has run yet.",
      errorType: "",
      retryable: false
    };
  }
  return {
    status: cleanText(record.status) || "unknown",
    checkedAt: cleanText(record.checkedAt || record.checked_at),
    latencyMs: Number(record.latencyMs || record.latency_ms || 0),
    message: cleanText(record.message),
    errorType: cleanText(record.errorType || record.error_type),
    retryable: record.retryable === true
  };
}

async function fetchJsonWithTimeout(url, options = {}) {
  if (typeof fetch !== "function") {
    const error = new Error("fetch is not available in this runtime");
    error.code = "FETCH_UNAVAILABLE";
    throw error;
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number(options.timeoutMs || 2000));
  try {
    const response = await fetch(url, {
      method: options.method || "GET",
      headers: options.headers,
      body: options.body,
      signal: controller.signal
    });
    const json = await response.json().catch(() => ({}));
    return { response, json };
  } finally {
    clearTimeout(timeout);
  }
}

function isOllamaLocalEndpointUrl(value = "") {
  const endpointUrl = cleanText(value).replace(/\/+$/, "");
  if (!endpointUrl) return false;
  return endpointUrl === `${OLLAMA_BASE_URL}/v1/chat/completions` ||
    endpointUrl === `${OLLAMA_BASE_URL}/api/tags` ||
    endpointUrl.startsWith(`${OLLAMA_BASE_URL}/`);
}

function isManagedOllamaProviderConfig(input = {}) {
  const providerId = cleanText(input.providerId || input.provider_id || input.id);
  if (providerId === "ollama_local_gateway") return true;
  if (providerId !== "local_private_gateway") return false;
  const displayName = cleanText(input.displayName || input.display_name).toLowerCase();
  const endpointUrl = cleanText(input.endpointUrl || input.endpoint_url);
  const healthCheck = input.healthCheck || input.health_check || {};
  const healthEndpointUrl = cleanText(healthCheck?.endpointUrl || healthCheck?.endpoint_url);
  return displayName === "ollama local" ||
    isOllamaLocalEndpointUrl(endpointUrl) ||
    isOllamaLocalEndpointUrl(healthEndpointUrl);
}

function assertAllowedManagedOllamaProviderConfigModels(input = {}) {
  if (!isManagedOllamaProviderConfig(input)) return;
  const runtimeModelMap = input.runtimeModelMap || input.runtime_model_map || {};
  if (!runtimeModelMap || typeof runtimeModelMap !== "object" || Array.isArray(runtimeModelMap)) return;
  for (const modelName of Object.values(runtimeModelMap)) {
    if (!cleanText(modelName)) continue;
    assertAllowedOllamaCatalogModel(modelName);
  }
}

function assertAllowedManagedOllamaProviderConfig(config = null) {
  if (!config) return config;
  assertAllowedManagedOllamaProviderConfigModels(config);
  return config;
}

function assertAllowedManagedOllamaProviderConfigInput(input = {}, existing = {}) {
  const providerId = firstOwnValue(input, ["providerId", "provider_id"], firstOwnValue(existing, ["providerId", "provider_id"]));
  const displayName = firstOwnValue(input, ["displayName", "display_name"], firstOwnValue(existing, ["displayName", "display_name"]));
  const endpointUrl = firstOwnValue(input, ["endpointUrl", "endpoint_url"], firstOwnValue(existing, ["endpointUrl", "endpoint_url"]));
  const healthCheck = firstOwnValue(input, ["healthCheck", "health_check"], firstOwnValue(existing, ["healthCheck", "health_check"]));
  const runtimeModelMap = firstOwnValue(input, ["runtimeModelMap", "runtime_model_map"], firstOwnValue(existing, ["runtimeModelMap", "runtime_model_map"]));
  assertAllowedManagedOllamaProviderConfigModels({
    ...existing,
    ...input,
    providerId,
    displayName,
    endpointUrl,
    healthCheck,
    runtimeModelMap
  });
}

function settingsInputManagesLocalPrivateOllama(input = {}) {
  const advancedSettings = advancedSettingsFrom(input);
  const providerId = cleanText(input.providerPreset || input.provider_preset || advancedSettings.localProviderPreset || advancedSettings.local_provider_preset);
  const localProviderPreset = cleanText(input.localProviderPreset || input.local_provider_preset || advancedSettings.localProviderPreset || advancedSettings.local_provider_preset);
  const modelPack = cleanText(input.modelPack || input.model_pack);
  const modelRef = advancedModelRefFrom(input);
  const runtimeMode = normalizeLocalRuntimeMode(advancedSettings.runtimeMode || advancedSettings.runtime_mode);
  const modelRefProvider = cleanText(modelRef).split(":")[0];
  return modelPack === "Ollama Local" ||
    (
      runtimeMode === "hybrid" &&
      [providerId, localProviderPreset, modelRefProvider].includes("local_private_gateway")
    );
}

function assertAllowedManagedOllamaProviderConfigDraft(input = {}, settingsInput = {}) {
  const providerId = cleanText(input.providerId || input.provider_id || input.id);
  if (providerId === "local_private_gateway" && !settingsInputManagesLocalPrivateOllama(settingsInput)) return;
  assertAllowedManagedOllamaProviderConfigModels(input);
}

function ollamaModelNameFromManagedModelRef(modelRef = "") {
  const value = cleanText(modelRef);
  const providerPrefix = ["ollama_local_gateway:", "local_private_gateway:"].find((prefix) => value.startsWith(prefix));
  if (!providerPrefix) return "";
  const modelName = value.slice(providerPrefix.length);
  if (LOCAL_MODEL_TIERS.includes(modelName)) return "";
  return modelName;
}

function assertAllowedManagedOllamaSettings(input = {}) {
  const advancedSettings = advancedSettingsFrom(input);
  const providerId = cleanText(input.providerPreset || input.provider_preset || advancedSettings.localProviderPreset || advancedSettings.local_provider_preset);
  const localProviderPreset = cleanText(input.localProviderPreset || input.local_provider_preset || advancedSettings.localProviderPreset || advancedSettings.local_provider_preset);
  const localModel = localModelFromSettings(input);
  const modelRef = advancedModelRefFrom(input);
  const managedByProvider = providerId === "ollama_local_gateway" ||
    localProviderPreset === "ollama_local_gateway" ||
    settingsInputManagesLocalPrivateOllama(input);
  if (managedByProvider && localModel) assertAllowedOllamaCatalogModel(localModel);
  const managedModelRefModel = ollamaModelNameFromManagedModelRef(modelRef);
  if (managedModelRefModel && (managedByProvider || modelRef.startsWith("ollama_local_gateway:"))) assertAllowedOllamaCatalogModel(managedModelRefModel);
}

function normalizeOllamaModel(model = {}) {
  return {
    name: cleanText(model.name || model.model),
    modifiedAt: cleanText(model.modified_at || model.modifiedAt),
    size: Number(model.size || 0),
    parameterSize: cleanText(model.details?.parameter_size || model.parameter_size),
    quantizationLevel: cleanText(model.details?.quantization_level || model.quantization_level)
  };
}

function runtimeModelMapForLocalModel(providerId = "ollama_local_gateway", modelName = OLLAMA_RECOMMENDED_MODEL) {
  const cleanProviderId = cleanText(providerId) || "ollama_local_gateway";
  const cleanModel = cleanText(modelName) || OLLAMA_RECOMMENDED_MODEL;
  return Object.fromEntries(LOCAL_MODEL_TIERS.map((tier) => [`${cleanProviderId}:${tier}`, cleanModel]));
}

function preferredOllamaModelNames(models = []) {
  const installedNames = (Array.isArray(models) ? models : [])
    .map((model) => cleanText(model?.name || model?.model || model))
    .filter(Boolean);
  const seen = new Set();
  return [...OLLAMA_RECOMMENDED_MODELS, ...installedNames].filter((name) => {
    const key = name.toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function ollamaSetupGuide(status = "unavailable", models = []) {
  const hasModels = Array.isArray(models) && models.length > 0;
  const hasDefaultModel = (Array.isArray(models) ? models : []).some((model) => {
    const name = cleanText(model?.name || model?.model || model).toLowerCase();
    return name === OLLAMA_RECOMMENDED_MODEL.toLowerCase();
  });
  if (status !== "available") {
    return {
      nextAction: "install_or_start_ollama",
      installUrl: OLLAMA_INSTALL_URL,
      install: ollamaInstallGuide(),
      steps: [
        "下载并安装 Ollama。",
        "启动 Ollama，让它在后台运行。",
        "回到研思录，重新检测 Ollama。"
      ]
    };
  }
  if (!hasModels || !hasDefaultModel) {
    return {
      nextAction: "pull_recommended_model",
      recommendedModel: OLLAMA_RECOMMENDED_MODEL,
      recommendedModelProfile: localModelProfile(OLLAMA_RECOMMENDED_MODEL),
      downloadCommand: DEFAULT_LOCAL_AI_MODEL_DOWNLOAD_COMMAND,
      steps: [
        `下载推荐模型 ${OLLAMA_RECOMMENDED_MODEL}。`,
        `也可以复制命令：${DEFAULT_LOCAL_AI_MODEL_DOWNLOAD_COMMAND}`,
        "下载完成后，研思录会把它设为本地模型。",
        "运行健康检查，确认请求可以走本地模型。"
      ]
    };
  }
  return {
    nextAction: "select_or_test_model",
    recommendedModel: preferredOllamaModelNames(models)[0] || OLLAMA_RECOMMENDED_MODEL,
    recommendedModelProfile: localModelProfile(preferredOllamaModelNames(models)[0] || OLLAMA_RECOMMENDED_MODEL),
    downloadCommand: DEFAULT_LOCAL_AI_MODEL_DOWNLOAD_COMMAND,
    steps: [
      "从已安装模型里选择一个作为本地模型。",
      "保存当前服务配置。",
      "运行健康检查，确认模型可用。"
    ]
  };
}

function normalizeAiRuntimeModeForRouting(value = "") {
  const mode = cleanText(value).toLowerCase().replace(/[\s/-]+/g, "_");
  if (["local", "local_only", "private"].includes(mode)) return "local_only";
  if (["hybrid", "mixed", "local_cloud"].includes(mode)) return "hybrid";
  if (["cloud", "cloud_only", "remote"].includes(mode)) return "cloud_only";
  return "auto";
}

function advancedSettingsFrom(input = {}) {
  return input.advancedSettings || input.advanced_settings || {};
}

function runtimeModeFromSettings(input = {}) {
  const advancedSettings = advancedSettingsFrom(input);
  return normalizeAiRuntimeModeForRouting(input.runtimeMode || input.runtime_mode || advancedSettings.runtimeMode || advancedSettings.runtime_mode);
}

function localModelFromSettings(input = {}) {
  const advancedSettings = advancedSettingsFrom(input);
  return cleanText(input.localModel || input.local_model || advancedSettings.localModel || advancedSettings.local_model);
}

function isLocalProviderPreset(value = "") {
  return ["local_private_gateway", "ollama_local_gateway", "minicpm_local_gateway"].includes(cleanText(value));
}

function localProviderPresetFromSettings(input = {}, userSettings = {}) {
  const advancedSettings = advancedSettingsFrom(input);
  const providerPreset = cleanText(
    input.localProviderPreset ||
      input.local_provider_preset ||
      advancedSettings.localProviderPreset ||
      advancedSettings.local_provider_preset ||
      input.providerPreset ||
      input.provider_preset ||
      userSettings.providerPreset ||
      userSettings.provider_preset
  );
  return isLocalProviderPreset(providerPreset) ? providerPreset : "local_private_gateway";
}

function requestedModelTier(input = {}, agent = {}) {
  return cleanText(input.modelTier || input.model_tier || agent.defaultModelTier || agent.default_model_tier) || "standard";
}

function shouldPreferLocalForHybridRoute({ settingsInput = {}, userSettings = {}, input = {}, agent = {}, privacyMode = "normal" } = {}) {
  if (privacyMode === "local_only") return { preferLocal: true, reason: "privacy_local_only" };
  if (input.forceCloud === true || input.force_cloud === true) return { preferLocal: false, reason: "force_cloud" };
  if (input.forceLocal === true || input.force_local === true) return { preferLocal: true, reason: "force_local" };

  const runtimeMode = runtimeModeFromSettings(settingsInput);
  const hybridEnabled = runtimeMode === "hybrid" || (userSettings.privacy?.localPreferred === true && userSettings.privacy?.allowCloud !== false);
  if (!hybridEnabled) return { preferLocal: false, reason: "hybrid_disabled" };
  if (!localModelFromSettings(settingsInput)) return { preferLocal: false, reason: "local_model_missing" };

  const agentId = cleanText(agent.agentId || agent.agent_id);
  const taskType = cleanText(input.taskType || input.task_type).toLowerCase();
  const tier = requestedModelTier(input, agent);
  if (agentId === "connection_agent") return { preferLocal: true, reason: "lightweight_agent" };
  if (["router_fast", "cheap_fast", "guardrail", "local_private"].includes(tier)) return { preferLocal: true, reason: "lightweight_tier" };
  if (/relation|link|tag|classif|summar|summary|title|theme|quick/.test(taskType)) return { preferLocal: true, reason: "lightweight_task" };
  return { preferLocal: false, reason: "cloud_preferred_task" };
}

function settingsForHybridRoute({ settingsInput = {}, userSettings = {}, input = {}, agent = {}, privacyMode = "normal" } = {}) {
  const decision = shouldPreferLocalForHybridRoute({ settingsInput, userSettings, input, agent, privacyMode });
  if (!decision.preferLocal) return { settingsInput, decision };

  const localProviderPreset = localProviderPresetFromSettings(settingsInput, userSettings);
  const localModel = localModelFromSettings(settingsInput);
  const modelRef = localModel ? `${localProviderPreset}:${localModel}` : advancedModelRefFrom(settingsInput);
  return {
    settingsInput: {
      ...settingsInput,
      providerPreset: localProviderPreset,
      provider_preset: localProviderPreset,
      authMode: cleanText(settingsInput.authMode || settingsInput.auth_mode) || "local_no_key",
      ...(modelRef ? { modelRef } : {}),
      advancedSettings: {
        ...advancedSettingsFrom(settingsInput),
        ...(modelRef ? { modelRef } : {})
      }
    },
    decision: {
      ...decision,
      providerPreset: localProviderPreset,
      modelRef
    }
  };
}

async function enableOllamaLocalModel(modelName = OLLAMA_RECOMMENDED_MODEL, options = {}) {
  await initVault(VAULT_PATH);
  const model = assertAllowedOllamaCatalogModel(modelName || OLLAMA_RECOMMENDED_MODEL);
  const runtimeMode = normalizeLocalRuntimeMode(options.runtimeMode || options.runtime_mode);
  const providerId = runtimeMode === "hybrid" ? "local_private_gateway" : "ollama_local_gateway";
  const modelPack = runtimeMode === "hybrid" ? "Starter Auto" : "Ollama Local";
  const userMode = runtimeMode === "hybrid" ? "Auto" : "Local / Private";
  const privacy = runtimeMode === "hybrid"
    ? { defaultMode: "normal", allowCloud: true, localPreferred: true }
    : { defaultMode: "local_only", allowCloud: false, localPreferred: true };
  const fallbackPolicy = runtimeMode === "hybrid"
    ? {
        allowSameProviderFallback: true,
        allowCrossProviderFallback: true,
        allowCloudFallback: true,
        requiresConfirmationForCloud: false,
        localPreferred: true
      }
    : {
        allowSameProviderFallback: true,
        allowCrossProviderFallback: false,
        allowCloudFallback: false,
        requiresConfirmationForCloud: true
      };
  const preferencesStore = await aiPreferencesStore();
  const preferences = preferencesStore.setUserPreferences({
    workspaceId: "local_workspace",
    userId: "local_user",
    userMode,
    modelPack,
    privacy,
    fallbackPolicy,
    advancedSettings: {
      runtimeMode,
      localModel: model,
      localProviderPreset: providerId,
      ...(runtimeMode === "local_only" ? { modelRef: `${providerId}:${model}` } : {})
    }
  });
  const configStore = await aiProviderConfigStore();
  const providerConfig = configStore.setProviderConfig({
    providerId,
    displayName: "Ollama Local",
    adapterType: "local_gateway",
    status: "enabled",
    authMode: "local_no_key",
    endpointUrl: `${OLLAMA_BASE_URL}/v1/chat/completions`,
    runtimeModelMap: runtimeModelMapForLocalModel(providerId, model),
    healthCheck: {
      enabled: true,
      endpointUrl: `${OLLAMA_BASE_URL}/api/tags`,
      method: "GET",
      timeoutMs: 5000,
      expectedStatus: 200,
      intervalSeconds: 300
    }
  });
  return { preferences, providerConfig };
}

async function buildOllamaModelsPreview() {
  const healthEndpointUrl = `${OLLAMA_BASE_URL}/api/tags`;
  const chatEndpointUrl = `${OLLAMA_BASE_URL}/v1/chat/completions`;
  const startedAt = Date.now();
  const installation = await detectOllamaInstallation();
  try {
    const { response, json } = await fetchJsonWithTimeout(healthEndpointUrl, { timeoutMs: 2500 });
    const models = Array.isArray(json.models) ? json.models.map(normalizeOllamaModel).filter((model) => model.name) : [];
    const defaultModelInstalled = hasOllamaModel({ models }, OLLAMA_RECOMMENDED_MODEL);
    const readinessStatus = ollamaReadinessStatus({ responseOk: response.ok, installation, models });
    return {
      runtimeId: "ollama",
      displayName: "Ollama",
      status: response.ok ? "available" : "unavailable",
      readinessStatus,
      apiReachable: response.ok,
      installation,
      installed: installation.installed,
      baseUrl: OLLAMA_BASE_URL,
      chatEndpointUrl,
      healthEndpointUrl,
      latencyMs: Date.now() - startedAt,
      models,
      defaultModelInstalled,
      recommendedModels: preferredOllamaModelNames(models).slice(0, 8),
      recommendedModel: preferredOllamaModelNames(models)[0] || OLLAMA_RECOMMENDED_MODEL,
      modelTiers: LOCAL_AI_MODEL_TIERS,
      recommendedModelProfile: localModelProfile(preferredOllamaModelNames(models)[0] || OLLAMA_RECOMMENDED_MODEL),
      downloadCommand: DEFAULT_LOCAL_AI_MODEL_DOWNLOAD_COMMAND,
      setupGuide: ollamaSetupGuide(response.ok ? "available" : "unavailable", models),
      message: response.ok ? "" : `Ollama returned HTTP ${response.status}`
    };
  } catch (error) {
    const readinessStatus = ollamaReadinessStatus({ responseOk: false, installation, models: [], error });
    return {
      runtimeId: "ollama",
      displayName: "Ollama",
      status: "unavailable",
      readinessStatus,
      apiReachable: false,
      installation,
      installed: installation.installed,
      baseUrl: OLLAMA_BASE_URL,
      chatEndpointUrl,
      healthEndpointUrl,
      latencyMs: Date.now() - startedAt,
      models: [],
      defaultModelInstalled: false,
      recommendedModels: [...OLLAMA_RECOMMENDED_MODELS],
      recommendedModel: OLLAMA_RECOMMENDED_MODEL,
      modelTiers: LOCAL_AI_MODEL_TIERS,
      recommendedModelProfile: localModelProfile(OLLAMA_RECOMMENDED_MODEL),
      downloadCommand: DEFAULT_LOCAL_AI_MODEL_DOWNLOAD_COMMAND,
      setupGuide: ollamaSetupGuide("unavailable", []),
      message: cleanText(error?.message) || "Ollama is not reachable."
    };
  }
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, Number(ms) || 0)));
}

async function fileExists(filePath = "") {
  if (!filePath) return false;
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function resolveOllamaCommand() {
  const explicitBin = cleanText(process.env.OLLAMA_BIN);
  const candidates = explicitBin ? [explicitBin] : [];
  if (process.platform === "win32") {
    const localAppData = cleanText(process.env.LOCALAPPDATA);
    const programFiles = cleanText(process.env.ProgramFiles);
    const programFilesX86 = cleanText(process.env["ProgramFiles(x86)"]);
    if (localAppData) candidates.push(path.join(localAppData, "Programs", "Ollama", "ollama.exe"));
    if (programFiles) candidates.push(path.join(programFiles, "Ollama", "ollama.exe"));
    if (programFilesX86) candidates.push(path.join(programFilesX86, "Ollama", "ollama.exe"));
  } else {
    candidates.push("/opt/homebrew/bin/ollama", "/usr/local/bin/ollama", "/usr/bin/ollama");
  }

  const checked = [];
  for (const candidate of candidates) {
    const normalized = cleanText(candidate);
    if (!normalized || checked.includes(normalized)) continue;
    checked.push(normalized);
    if (await fileExists(normalized)) {
      return {
        command: normalized,
        checked,
        source: explicitBin && normalized === explicitBin ? "env" : "known_path"
      };
    }
  }
  return { command: "ollama", checked, source: "path" };
}

function execFileQuiet(command, args = [], options = {}) {
  return new Promise((resolve) => {
    const child = execFile(
      command,
      args,
      { windowsHide: true, timeout: Math.max(0, Number(options.timeoutMs || 0) || 0) },
      (error, stdout, stderr) => {
        resolve({
          command,
          args,
          ok: !error,
          code: error?.code ?? 0,
          signal: cleanText(error?.signal),
          message: cleanText(error?.message || stderr || stdout || ""),
          stdout: cleanText(stdout),
          stderr: cleanText(stderr)
        });
      }
    );
    child.once("error", (error) => {
      resolve({
        command,
        args,
        ok: false,
        code: error?.code ?? "ERROR",
        signal: "",
        message: cleanText(error?.message || error)
      });
    });
  });
}

async function detectOllamaInstallation() {
  const resolved = await resolveOllamaCommand();
  const versionProbe = await execFileQuiet(resolved.command, ["--version"], { timeoutMs: 2500 });
  return {
    runtimeId: "ollama",
    platform: currentPlatformName(),
    installed: versionProbe.ok,
    command: resolved.command,
    commandSource: resolved.source,
    checkedPaths: resolved.checked,
    version: versionProbe.ok ? cleanText(versionProbe.stdout || versionProbe.stderr || versionProbe.message) : "",
    installGuide: ollamaInstallGuide(),
    message: versionProbe.ok
      ? "Ollama CLI is installed."
      : cleanText(versionProbe.message) || "Ollama CLI was not found."
  };
}

async function waitForOllamaRuntimeStatus(targetStatus, timeoutMs = 8000) {
  const startedAt = Date.now();
  let latest = await buildOllamaModelsPreview();
  while (latest.status !== targetStatus && Date.now() - startedAt < timeoutMs) {
    await wait(500);
    latest = await buildOllamaModelsPreview();
  }
  return latest;
}

async function startOllamaRuntime() {
  const current = await buildOllamaModelsPreview();
  if (current.status === "available") {
    return {
      runtimeId: "ollama",
      status: "already_running",
      runtime: current,
      message: "Ollama is already running."
    };
  }

  let spawnError = null;
  const ollamaCommand = await resolveOllamaCommand();
  try {
    const child = spawn(ollamaCommand.command, ["serve"], {
      detached: true,
      stdio: "ignore",
      windowsHide: true
    });
    if (Number.isInteger(child.pid) && child.pid > 0) {
      managedOllamaProcessIds.add(child.pid);
      const forgetManagedPid = () => managedOllamaProcessIds.delete(child.pid);
      child.once("exit", forgetManagedPid);
      child.once("close", forgetManagedPid);
      child.once("error", forgetManagedPid);
    }
    child.once("error", (error) => {
      spawnError = error;
    });
    child.unref();
    await wait(350);
    if (spawnError) throw spawnError;
  } catch (error) {
    error.details = {
      installUrl: OLLAMA_INSTALL_URL,
      installGuide: ollamaInstallGuide(),
      command: `${ollamaCommand.command} serve`,
      checkedPaths: ollamaCommand.checked
    };
    throw error;
  }

  const runtime = await waitForOllamaRuntimeStatus("available", 9000);
  return {
    runtimeId: "ollama",
    status: runtime.status === "available" ? "started" : "starting",
    runtime,
    message: runtime.status === "available"
      ? "Ollama started."
      : "Ollama start command was sent, but the runtime is not reachable yet."
  };
}

function forgetManagedOllamaProcessId(pid) {
  const processId = Number(pid);
  if (Number.isInteger(processId) && processId > 0) managedOllamaProcessIds.delete(processId);
}

function stopResultMeansProcessMissing(result = {}) {
  const code = cleanText(result?.code).toUpperCase();
  const message = cleanText(`${result?.message || ""} ${result?.stdout || ""} ${result?.stderr || ""}`).toLowerCase();
  return code === "ESRCH" ||
    /not found|no running instance|does not exist|not exist|no such process|cannot find/.test(message);
}

async function stopManagedOllamaProcess(pid) {
  const processId = Number(pid);
  if (!Number.isInteger(processId) || processId <= 0 || !managedOllamaProcessIds.has(processId)) {
    return {
      pid,
      ok: false,
      message: "Only Ollama processes started by this Yansilu session can be stopped automatically."
    };
  }
  if (process.platform === "win32") {
    const result = await execFileQuiet("taskkill", ["/PID", String(processId), "/T"], { timeoutMs: 5000 });
    if (stopResultMeansProcessMissing(result)) forgetManagedOllamaProcessId(processId);
    return result;
  }
  try {
    process.kill(processId, "SIGTERM");
    return {
      pid: processId,
      ok: true,
      command: "process.kill",
      args: [String(processId), "SIGTERM"],
      message: "SIGTERM sent to the managed Ollama process."
    };
  } catch (error) {
    const result = {
      pid: processId,
      ok: false,
      command: "process.kill",
      args: [String(processId), "SIGTERM"],
      code: cleanText(error?.code),
      message: cleanText(error?.message || error)
    };
    if (stopResultMeansProcessMissing(result)) forgetManagedOllamaProcessId(processId);
    return result;
  }
}

async function stopOllamaRuntime() {
  const current = await buildOllamaModelsPreview();
  const managedPids = [...managedOllamaProcessIds].filter((pid) => Number.isInteger(Number(pid)) && Number(pid) > 0);
  if (current.status !== "available" && !managedPids.length) {
    return {
      runtimeId: "ollama",
      status: "already_stopped",
      runtime: current,
      message: "Ollama is not reachable."
    };
  }

  if (!managedPids.length) {
    return {
      runtimeId: "ollama",
      status: "manual_stop_required",
      runtime: current,
      message: "Ollama is running, but it was not started by this Yansilu session. Stop or restart it from the Ollama app or your system service manager.",
      management: {
        installUrl: OLLAMA_INSTALL_URL,
        safeStopSupported: false,
        reason: "Yansilu will not stop unrelated Ollama processes by name."
      }
    };
  }

  const results = [];
  for (const pid of managedPids) results.push(await stopManagedOllamaProcess(pid));
  const runtime = await waitForOllamaRuntimeStatus("unavailable", 6000);
  const stoppedAfterReachable = current.status === "available" && runtime.status === "unavailable";
  if (stoppedAfterReachable) {
    for (const pid of managedPids) managedOllamaProcessIds.delete(pid);
  }
  const remainingManagedPids = managedPids.filter((pid) => managedOllamaProcessIds.has(pid));
  const stopped = stoppedAfterReachable || remainingManagedPids.length === 0;
  const message = stopped
    ? "Ollama stopped."
    : runtime.status === "unavailable"
      ? "Stop command was sent to the Ollama process started by this Yansilu session, but process exit is not confirmed yet."
      : "Stop command was sent to the Ollama process started by this Yansilu session, but Ollama is still reachable.";
  return {
    runtimeId: "ollama",
    status: stopped ? "stopped" : "stopping",
    runtime,
    message,
    managedPids,
    remainingManagedPids,
    commands: results
  };
}

async function pullOllamaModel(modelName = OLLAMA_RECOMMENDED_MODEL) {
  const model = assertAllowedOllamaCatalogModel(modelName || OLLAMA_RECOMMENDED_MODEL);
  const startedAt = Date.now();
  const pullEndpointUrl = `${OLLAMA_BASE_URL}/api/pull`;
  const { response, json } = await fetchJsonWithTimeout(pullEndpointUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, stream: false }),
    timeoutMs: 30 * 60 * 1000
  });
  if (!response.ok) {
    const error = new Error(cleanText(json?.error || json?.message) || `Ollama pull returned HTTP ${response.status}`);
    error.status = response.status;
    error.details = json;
    throw error;
  }
  const runtime = await buildOllamaModelsPreview();
  return {
    runtimeId: "ollama",
    model,
    status: cleanText(json.status) || "success",
    latencyMs: Date.now() - startedAt,
    pullEndpointUrl,
    runtime
  };
}

async function latestLocalAiProviderState(providerId = "ollama_local_gateway") {
  await initVault(VAULT_PATH);
  const configStore = await aiProviderConfigStore();
  const providerConfig = configStore.getProviderConfig({ id: providerId, providerId });
  const healthStore = await aiProviderHealthStore();
  const health = healthStore.getLatestProviderHealth({ providerId });
  return { providerConfig, health };
}

async function buildOllamaBootstrapPreview(input = {}) {
  const model = assertAllowedOllamaCatalogModel(input.model || input.modelName || input.model_name || OLLAMA_RECOMMENDED_MODEL);
  const runtimeMode = normalizeLocalRuntimeMode(input.runtimeMode || input.runtime_mode);
  const providerId = runtimeMode === "hybrid" ? "local_private_gateway" : "ollama_local_gateway";
  const runtime = await buildOllamaModelsPreview();
  const { providerConfig, health } = await latestLocalAiProviderState(providerId);
  return {
    ...localAiBootstrapStatus({ runtime, providerConfig, health, modelName: model, runtimeMode }),
    runtime,
    installation: runtime.installation || null,
    providerConfig,
    health: providerHealthPreview(health),
    modelTiers: LOCAL_AI_MODEL_TIERS,
    modelProfile: localModelProfile(model),
    downloadCommand: `ollama pull ${model}`,
    installGuide: runtime.installation?.installGuide || ollamaInstallGuide()
  };
}

async function runOllamaProviderHealth(providerConfig) {
  const healthStore = await aiProviderHealthStore();
  const result = await runProviderHealthCheck({
    providerConfig: providerConfigWithRunnableHealthCheck(providerConfig),
    providerHealthStore: healthStore,
    trigger: "bootstrap",
    networkEnabled: true
  });
  return result.record;
}

async function bootstrapOllamaLocalAi(input = {}) {
  const model = assertAllowedOllamaCatalogModel(input.model || input.modelName || input.model_name || OLLAMA_RECOMMENDED_MODEL);
  const runtimeMode = normalizeLocalRuntimeMode(input.runtimeMode || input.runtime_mode);
  const autoStart = input.autoStart !== false && input.auto_start !== false;
  const pullModel = input.pullModel !== false && input.pull_model !== false;
  const enableConfig = input.enableConfig !== false && input.enable_config !== false;
  const runHealth = input.healthCheck !== false && input.health_check !== false;
  const actions = [];

  let runtime = await buildOllamaModelsPreview();
  if (runtime.status !== "available") {
    if (runtime.installation?.installed !== true) {
      const preview = await buildOllamaBootstrapPreview({ model, runtimeMode });
      return {
        ...preview,
        actions,
        message: "Ollama must be installed before Yansilu can start the local runtime."
      };
    }
    if (autoStart) {
      const started = await startOllamaRuntime();
      actions.push({ action: "start_ollama", status: started.status, message: started.message });
      runtime = started.runtime || await buildOllamaModelsPreview();
    }
  }

  if (runtime.status !== "available") {
    const preview = await buildOllamaBootstrapPreview({ model, runtimeMode });
    return { ...preview, actions };
  }

  if (!hasOllamaModel(runtime, model)) {
    if (!pullModel) {
      const preview = await buildOllamaBootstrapPreview({ model, runtimeMode });
      return { ...preview, actions };
    }
    const pulled = await pullOllamaModel(model);
    actions.push({ action: "pull_model", model: pulled.model, status: pulled.status, latencyMs: pulled.latencyMs });
    runtime = pulled.runtime || await buildOllamaModelsPreview();
  }

  let enabled = null;
  let providerConfig = null;
  let health = null;
  if (enableConfig) {
    enabled = await enableOllamaLocalModel(model, { runtimeMode });
    providerConfig = enabled.providerConfig;
    actions.push({ action: "save_local_ai_config", providerId: providerConfig.providerId, model });
  }

  if (runHealth && providerConfig) {
    health = await runOllamaProviderHealth(providerConfig);
    actions.push({ action: "run_health_check", status: health.status, message: health.message });
  }

  const providerId = runtimeMode === "hybrid" ? "local_private_gateway" : "ollama_local_gateway";
  if (!providerConfig || !health) {
    const state = await latestLocalAiProviderState(providerId);
    providerConfig ||= state.providerConfig;
    health ||= state.health;
  }

  return {
    ...localAiBootstrapStatus({ runtime, providerConfig, health, modelName: model, runtimeMode }),
    runtime,
    installation: runtime.installation || null,
    providerConfig,
    health: providerHealthPreview(health),
    modelTiers: LOCAL_AI_MODEL_TIERS,
    modelProfile: localModelProfile(model),
    downloadCommand: `ollama pull ${model}`,
    installGuide: runtime.installation?.installGuide || ollamaInstallGuide(),
    enabled,
    actions
  };
}

async function buildAiRoutePreview(input = {}) {
  await initVault(VAULT_PATH);
  const store = await aiPreferencesStore();
  const storedPreferences = store.getUserPreferences({ workspaceId: "local_workspace", userId: "local_user" });
  const storedSettings = preferencesToSettingsInput(storedPreferences);
  const advancedSettingsInput = input.advancedSettings || input.advanced_settings || {};
  const draftEndpointValue = firstOwnValue(input, ["endpointUrl", "endpoint_url"]);
  const draftRuntimeModelMap = firstOwnValue(input, ["runtimeModelMap", "runtime_model_map"]);
  const draftSecretRefValue = firstOwnValue(
    input,
    ["secretRef", "secret_ref"],
    firstOwnValue(advancedSettingsInput, ["secretRef", "secret_ref"])
  );
  const hasDraftEndpointUrl = draftEndpointValue !== undefined;
  const hasDraftRuntimeModelMap = draftRuntimeModelMap !== undefined;
  const hasDraftSecretRef = draftSecretRefValue !== undefined;
  const hasProviderConfigDraft = hasDraftEndpointUrl || hasDraftRuntimeModelMap;
  const advancedSettings = {
    ...(storedSettings.advancedSettings || {}),
    ...advancedSettingsInput
  };
  const settingsSecretRef = hasDraftSecretRef
    ? cleanText(draftSecretRefValue)
    : advancedSecretRefFrom({ ...storedSettings, ...input, advancedSettings });
  const settingsRuntimeModelMap = hasDraftRuntimeModelMap
    ? mergeRuntimeModelMaps(draftRuntimeModelMap)
    : mergeRuntimeModelMaps(storedSettings.runtimeModelMap);
  const settingsInput = {
    ...storedSettings,
    userMode: input.userMode || input.user_mode || storedSettings.userMode,
    modelPack: input.modelPack || input.model_pack || storedSettings.modelPack,
    providerPreset: input.providerPreset || input.provider_preset || storedSettings.providerPreset,
    authMode: input.authMode || input.auth_mode || storedSettings.authMode,
    endpointUrl: hasDraftEndpointUrl ? cleanText(draftEndpointValue) : storedSettings.endpointUrl,
    secretRef: settingsSecretRef,
    runtimeModelMap: settingsRuntimeModelMap,
    privacy: { ...(storedSettings.privacy || {}), ...(input.privacy || {}) },
    budget: { ...(storedSettings.budget || {}), ...(input.budget || {}) },
    fallbackPolicy: { ...(storedSettings.fallbackPolicy || {}), ...(input.fallbackPolicy || input.fallback_policy || {}) },
    advancedSettings
  };
  const modelRef = advancedModelRefFrom({ ...settingsInput, ...input, advancedSettings });
  if (modelRef) settingsInput.modelRef = modelRef;
  assertAllowedManagedOllamaSettings(settingsInput);

  let userSettings = resolveAiUserSettings(settingsInput);
  const routeAgent = {
    agentId: "settings_preview_agent",
    defaultModelTier: cleanText(input.modelTier || input.model_tier) || "standard",
    requiredCapabilities: ["structured_output"]
  };
  const privacyMode = cleanText(input.privacyMode || input.privacy_mode || userSettings.privacy.defaultMode) || "normal";
  const hybridRoute = settingsForHybridRoute({ settingsInput, userSettings, input, agent: routeAgent, privacyMode });
  Object.assign(settingsInput, hybridRoute.settingsInput);
  userSettings = resolveAiUserSettings(settingsInput);
  const configStore = await aiProviderConfigStore();
  const providerConfig = configStore.getProviderConfig({ providerId: settingsInput.providerPreset || userSettings.providerPreset });
  const hasStoredProviderConfigDraft = hasProviderConfigDraft;
  if (!hasStoredProviderConfigDraft && cleanText(providerConfig?.status || providerConfig?.status_text) === "disabled") {
    throw disabledProviderConfigError(providerConfig);
  }
  if (providerConfig) {
    assertAllowedManagedOllamaProviderConfig(providerConfig);
    const configSettings = providerConfigToSettingsInput(providerConfig);
    const secretRef = hasDraftSecretRef ? settingsInput.secretRef : settingsInput.secretRef || configSettings.secretRef;
    const endpointUrl = hasDraftEndpointUrl ? settingsInput.endpointUrl : configSettings.endpointUrl || settingsInput.endpointUrl;
    const runtimeModelMap = hasDraftRuntimeModelMap
      ? settingsInput.runtimeModelMap
      : {
          ...(configSettings.runtimeModelMap || {}),
          ...(settingsInput.runtimeModelMap || settingsInput.runtime_model_map || {})
        };
    const providerDescriptorInput = {
      ...(configSettings.providerDescriptor || {}),
      endpointUrl,
      secretRef
    };
    Object.assign(settingsInput, {
      ...configSettings,
      endpointUrl,
      secretRef,
      providerDescriptor: providerDescriptorInput,
      runtimeModelMap
    });
  }
  const previewProviderId = cleanText(settingsInput.providerPreset || userSettings.providerPreset);
  if (
    previewProviderId === "platform_managed_openai" &&
    ((hasDraftEndpointUrl && cleanText(draftEndpointValue)) || (hasDraftRuntimeModelMap && hasRuntimeModelMapEntries(draftRuntimeModelMap)))
  ) {
    const error = new Error("platform-managed AI does not accept endpointUrl or runtimeModelMap overrides");
    error.code = "AI_PROVIDER_CONFIG_INVALID";
    throw error;
  }
  if (previewProviderId && previewProviderId !== "platform_managed_openai" && hasStoredProviderConfigDraft) {
    const draftProviderConfigInput = {
      providerId: previewProviderId,
      status: "enabled",
      authMode: cleanText(settingsInput.authMode) || providerConfig?.authMode
    };
    if (hasDraftSecretRef || cleanText(settingsInput.secretRef)) draftProviderConfigInput.secretRef = settingsInput.secretRef;
    if (hasDraftEndpointUrl || cleanText(settingsInput.endpointUrl)) draftProviderConfigInput.endpointUrl = settingsInput.endpointUrl;
    if (hasDraftRuntimeModelMap || hasRuntimeModelMapEntries(settingsInput.runtimeModelMap)) {
      draftProviderConfigInput.runtimeModelMap = settingsInput.runtimeModelMap;
    }
    assertAllowedManagedOllamaProviderConfigDraft(draftProviderConfigInput, settingsInput);
    const draftProviderConfig = assertValidAiProviderConfig(draftProviderConfigInput, providerConfig || {});
    const draftSettings = providerConfigToSettingsInput(draftProviderConfig);
    const secretRef = hasDraftSecretRef ? settingsInput.secretRef : cleanText(settingsInput.secretRef) || draftSettings.secretRef;
    const endpointUrl = hasDraftEndpointUrl ? settingsInput.endpointUrl : cleanText(settingsInput.endpointUrl) || draftSettings.endpointUrl;
    const runtimeModelMap = hasDraftRuntimeModelMap
      ? draftSettings.runtimeModelMap
      : mergeRuntimeModelMaps(draftSettings.runtimeModelMap, settingsInput.runtimeModelMap);
    const providerDescriptorInput = {
      ...(draftSettings.providerDescriptor || {}),
      endpointUrl,
      secretRef
    };
    Object.assign(settingsInput, {
      ...draftSettings,
      endpointUrl,
      secretRef,
      providerDescriptor: providerDescriptorInput,
      runtimeModelMap
    });
  }
  const providerDescriptor = resolveProviderDescriptor(settingsInput);
  const cloudAllowed = userSettings.privacy.allowCloud !== false && privacyMode !== "local_only";
  const route = resolveModelRoute({
    ...settingsInput,
    providerDescriptor,
    contextPack: {
      privacy: {
        mode: privacyMode,
        cloudAllowed
      }
    },
    agent: routeAgent,
    modelRef: cleanText(settingsInput.modelRef) || modelRef
  });
  const healthStore = await aiProviderHealthStore();
  const latestProviderHealth = healthStore.getLatestProviderHealth({ providerId: providerDescriptor.providerId });

  return {
    userMode: route.userMode,
    modelPack: route.modelPack,
    modelPackId: route.modelPackId,
    providerPreset: route.providerPreset,
    provider: {
      providerId: providerDescriptor.providerId,
      displayName: providerDescriptor.displayName,
      adapterType: providerDescriptor.adapterType,
      localExecution: providerDescriptor.localExecution === true,
      noviceVisible: providerDescriptor.noviceVisible === true
    },
    route: {
      modelRef: route.modelRef,
      requestedTier: route.requestedTier,
      selectedTier: route.selectedTier,
      localOnly: route.localOnly === true,
      cloudAllowed: route.cloudAllowed === true,
      advancedOverride: route.advancedOverride === true,
      confirmationRequired: route.confirmationRequired === true
    },
    privacy: {
      mode: route.privacyMode,
      localPreferred: userSettings.privacy.localPreferred === true
    },
    access: authSummary(route.authMode || userSettings.authMode || providerDescriptor.authMode, {
      secretRef: hasDraftSecretRef ? settingsInput.secretRef : providerDescriptor.secretRef || settingsInput.secretRef
    }),
    health: providerHealthPreview(latestProviderHealth)
  };
}

function enabledFlag(input = {}, camelKey = "", snakeKey = "") {
  return input[camelKey] === true || (snakeKey && input[snakeKey] === true);
}

function disabledFlag(input = {}, camelKey = "", snakeKey = "") {
  return input[camelKey] === false || (snakeKey && input[snakeKey] === false);
}

function hasOwn(value = {}, key = "") {
  return Object.prototype.hasOwnProperty.call(value || {}, key);
}

function firstOwnValue(value = {}, keys = [], fallback = undefined) {
  for (const key of keys) {
    if (hasOwn(value, key)) return value[key];
  }
  return fallback;
}

function mergeRuntimeModelMaps(...values) {
  return Object.assign(
    {},
    ...values.filter((value) => value && typeof value === "object" && !Array.isArray(value))
  );
}

function hasRuntimeModelMapEntries(value = null) {
  return Boolean(
    value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      Object.entries(value).some(([key, runtimeModel]) => cleanText(key) && cleanText(runtimeModel))
  );
}

function wantsCanonical(url) {
  const value = cleanText(url?.searchParams?.get("canonical")).toLowerCase();
  return value === "1" || value === "true" || value === "yes";
}

function withCanonical(body = {}, canonical = null) {
  if (!canonical) return body;
  return {
    ...body,
    canonical
  };
}

function modelExecutionSummary(response = {}, context = {}) {
  return {
    status: cleanText(response.status) || "unknown",
    fallbackUsed: context.fallbackUsed === true,
    providerId: cleanText(response.providerId || response.provider_id),
    modelRef: cleanText(response.modelRef || response.model_ref),
    route: context.modelRoute
      ? {
          modelRef: context.modelRoute.modelRef,
          selectedTier: context.modelRoute.selectedTier,
          privacyMode: context.modelRoute.privacyMode,
          cloudAllowed: context.modelRoute.cloudAllowed === true
        }
      : null,
    usage: response.usage || null,
    error: response.error || null
  };
}

function modelExecutionFailure(error = {}, context = {}) {
  return {
    status: "failed",
    fallbackUsed: context.fallbackUsed === true,
    providerId: cleanText(context.providerDescriptor?.providerId || context.providerDescriptor?.provider_id),
    modelRef: cleanText(context.modelRoute?.modelRef),
    route: context.modelRoute
      ? {
          modelRef: context.modelRoute.modelRef,
          selectedTier: context.modelRoute.selectedTier,
          privacyMode: context.modelRoute.privacyMode,
          cloudAllowed: context.modelRoute.cloudAllowed === true
        }
      : null,
    usage: null,
    error: {
      code: cleanText(error.code) || "AI_PROVIDER_EXECUTION_FAILED",
      message: String(error?.message || error)
    }
  };
}

function requestModelFromRoute(providerDescriptor = {}, modelRoute = {}, explicitModel = "", mode = "") {
  const modelRef = cleanText(explicitModel) || cleanText(modelRoute.modelRef);
  return {
    provider: cleanText(providerDescriptor.providerId || providerDescriptor.provider_id),
    model: modelRef,
    modelRef,
    tier: cleanText(modelRoute.selectedTier) || cleanText(modelRoute.requestedTier),
    mode: cleanText(mode) || cleanText(modelRoute.userMode)
  };
}

function mergeSettingsWithProviderSettings(routedSettingsInput = {}, providerSettings = {}, options = {}) {
  const hasSecretRef = options.hasSecretRef === true;
  const hasEndpointUrl = options.hasEndpointUrl === true;
  const hasRuntimeModelMap = options.hasRuntimeModelMap === true;
  const secretRef = hasSecretRef
    ? cleanText(routedSettingsInput.secretRef || routedSettingsInput.secret_ref)
    : cleanText(routedSettingsInput.secretRef || routedSettingsInput.secret_ref) || providerSettings.secretRef;
  const endpointUrl = hasEndpointUrl
    ? cleanText(routedSettingsInput.endpointUrl || routedSettingsInput.endpoint_url)
    : cleanText(routedSettingsInput.endpointUrl || routedSettingsInput.endpoint_url) || providerSettings.endpointUrl;
  const runtimeModelMap = hasRuntimeModelMap
    ? mergeRuntimeModelMaps(routedSettingsInput.runtimeModelMap, routedSettingsInput.runtime_model_map)
    : mergeRuntimeModelMaps(providerSettings.runtimeModelMap, providerSettings.runtime_model_map, routedSettingsInput.runtimeModelMap, routedSettingsInput.runtime_model_map);
  const providerDescriptorSource = providerSettings.providerDescriptor || providerSettings.provider_descriptor || routedSettingsInput.providerDescriptor || routedSettingsInput.provider_descriptor || null;
  return {
    ...routedSettingsInput,
    ...providerSettings,
    secretRef,
    endpointUrl,
    ...(providerDescriptorSource
      ? {
          providerDescriptor: {
            ...providerDescriptorSource,
            secretRef,
            endpointUrl
          }
        }
      : {}),
    runtimeModelMap
  };
}

async function resolveAnalysisProviderExecution(input = {}, defaults = {}) {
  await initVault(VAULT_PATH);
  const preferencesStore = await aiPreferencesStore();
  const storedPreferences = preferencesStore.getUserPreferences({ workspaceId: "local_workspace", userId: "local_user" });
  const storedSettings = preferencesToSettingsInput(storedPreferences);
  const advancedSettingsInput = input.advancedSettings || input.advanced_settings || {};
  const inputEndpointValue = firstOwnValue(input, ["endpointUrl", "endpoint_url"]);
  const inputRuntimeModelMap = firstOwnValue(input, ["runtimeModelMap", "runtime_model_map"]);
  const inputSecretRefValue = firstOwnValue(
    input,
    ["secretRef", "secret_ref"],
    firstOwnValue(advancedSettingsInput, ["secretRef", "secret_ref"])
  );
  const hasInputEndpointUrl = inputEndpointValue !== undefined;
  const hasInputRuntimeModelMap = inputRuntimeModelMap !== undefined;
  const hasInputSecretRef = inputSecretRefValue !== undefined;
  const advancedSettings = {
    ...(storedSettings.advancedSettings || {}),
    ...advancedSettingsInput
  };
  const settingsSecretRef = hasInputSecretRef
    ? cleanText(inputSecretRefValue)
    : advancedSecretRefFrom({ ...storedSettings, ...input, advancedSettings });
  const settingsInput = {
    ...storedSettings,
    userMode: input.userMode ?? input.user_mode ?? defaults.userMode ?? storedSettings.userMode,
    modelPack: input.modelPack ?? input.model_pack ?? defaults.modelPack ?? storedSettings.modelPack,
    providerPreset: input.providerPreset ?? input.provider_preset ?? defaults.providerPreset ?? storedSettings.providerPreset,
    authMode: input.authMode ?? input.auth_mode ?? defaults.authMode ?? storedSettings.authMode,
    secretRef: settingsSecretRef,
    endpointUrl: hasInputEndpointUrl ? cleanText(inputEndpointValue) : storedSettings.endpointUrl,
    modelRef: input.modelRef ?? input.model_ref ?? storedSettings.modelRef,
    headers: {
      ...(storedSettings.headers || {}),
      ...(input.headers || {})
    },
    runtimeModelMap: hasInputRuntimeModelMap
      ? mergeRuntimeModelMaps(inputRuntimeModelMap)
      : mergeRuntimeModelMaps(storedSettings.runtimeModelMap, storedSettings.runtime_model_map),
    privacy: {
      ...(storedSettings.privacy || {}),
      ...(input.privacy || {}),
      ...(defaults.privacyMode ? { defaultMode: defaults.privacyMode } : {})
    },
    fallbackPolicy: {
      ...(storedSettings.fallbackPolicy || {}),
      ...(input.fallbackPolicy || input.fallback_policy || {})
    },
    advancedSettings
  };
  assertAllowedManagedOllamaSettings(settingsInput);

  const baseUserSettings = resolveAiUserSettings(settingsInput);
  const privacyMode =
    cleanText(defaults.privacyMode || input.privacyMode || input.privacy_mode) ||
    baseUserSettings.privacy?.defaultMode ||
    "normal";
  const routeAgent = {
    agentId: cleanText(input.agentId || input.agent_id || defaults.agentId || defaults.agent_id),
    defaultModelTier: input.modelTier ?? input.model_tier ?? defaults.modelTier ?? "standard"
  };
  const hybridRoute = settingsForHybridRoute({ settingsInput, userSettings: baseUserSettings, input, agent: routeAgent, privacyMode });
  const routedSettingsInput = hybridRoute.settingsInput;
  const providerId = cleanText(routedSettingsInput.providerPreset || routedSettingsInput.providerId || routedSettingsInput.provider_id || baseUserSettings.providerPreset);
  const configStore = await aiProviderConfigStore();
  const providerConfig = providerId ? configStore.getProviderConfig({ providerId }) : null;
  const hasProviderConfigDraft = hasInputEndpointUrl || hasInputRuntimeModelMap || hasInputSecretRef;
  if (
    providerId === "platform_managed_openai" &&
    ((hasInputEndpointUrl && cleanText(inputEndpointValue)) || (hasInputRuntimeModelMap && hasRuntimeModelMapEntries(inputRuntimeModelMap)))
  ) {
    const error = new Error("platform-managed AI does not accept endpointUrl or runtimeModelMap overrides");
    error.code = "AI_PROVIDER_CONFIG_INVALID";
    throw error;
  }
  if (providerConfig) assertAllowedManagedOllamaProviderConfig(providerConfig);
  let providerSettings = providerConfig ? providerConfigToSettingsInput(providerConfig) : {};
  if (providerId && providerId !== "platform_managed_openai" && hasProviderConfigDraft) {
    const draftProviderConfigInput = {
      providerId,
      status: "enabled",
      authMode: cleanText(routedSettingsInput.authMode) || providerConfig?.authMode
    };
    if (hasInputSecretRef || cleanText(routedSettingsInput.secretRef)) draftProviderConfigInput.secretRef = routedSettingsInput.secretRef;
    if (hasInputEndpointUrl || cleanText(routedSettingsInput.endpointUrl)) draftProviderConfigInput.endpointUrl = routedSettingsInput.endpointUrl;
    if (hasInputRuntimeModelMap || hasRuntimeModelMapEntries(routedSettingsInput.runtimeModelMap)) {
      draftProviderConfigInput.runtimeModelMap = routedSettingsInput.runtimeModelMap;
    }
    assertAllowedManagedOllamaProviderConfigDraft(draftProviderConfigInput, settingsInput);
    const draftProviderConfig = assertValidAiProviderConfig(draftProviderConfigInput, providerConfig || {});
    providerSettings = providerConfigToSettingsInput(draftProviderConfig);
  }
  if (!hasProviderConfigDraft && cleanText(providerConfig?.status || providerConfig?.status_text) === "disabled") throw disabledProviderConfigError(providerConfig);
  const mergedSettings = mergeSettingsWithProviderSettings(routedSettingsInput, providerSettings, {
    hasSecretRef: hasInputSecretRef,
    hasEndpointUrl: hasInputEndpointUrl,
    hasRuntimeModelMap: hasInputRuntimeModelMap
  });
  mergedSettings.modelRef = cleanText(routedSettingsInput.modelRef) || providerSettings.modelRef;
  mergedSettings.headers = {
    ...(providerSettings.headers || {}),
    ...(routedSettingsInput.headers || {})
  };
  const providerDescriptor = resolveProviderDescriptor(mergedSettings);
  const resolvedUserSettings = resolveAiUserSettings(mergedSettings);
  const modelRoute = resolveModelRoute({
    ...mergedSettings,
    providerDescriptor,
    userMode: input.userMode ?? input.user_mode ?? defaults.userMode ?? resolvedUserSettings.userMode,
    modelTier: input.modelTier ?? input.model_tier ?? defaults.modelTier ?? "standard",
    privacyMode
  });
  const useMockProviderAdapters = enabledFlag(input, "useMockProviderAdapters", "use_mock_provider_adapters");
  const registry = createProviderAdapterRegistry({
    useMockProviderAdapters,
    useOpenAiCompatibleAdapter: !useMockProviderAdapters && !disabledFlag(input, "useOpenAiCompatibleAdapter", "use_openai_compatible_adapter"),
    networkEnabled: !disabledFlag(input, "networkEnabled", "network_enabled"),
    createExecutor: true,
    secrets: await upsertLocalAiSecrets(input)
  });
  const adapterSelection = registry.getAdapter({
    ...mergedSettings,
    providerDescriptor
  });

  return {
    providerAdapter: adapterSelection.adapter,
    providerDescriptor,
    modelRoute,
    userSettings: resolvedUserSettings,
    providerConfig
  };
}

const importRecords = new Map();
const allowedConnectors = new Set(["obsidian"]);

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function cleanText(value) {
  return String(value || "").trim();
}

function stringArray(value) {
  if (Array.isArray(value)) return value.map(cleanText).filter(Boolean);
  if (value === undefined || value === null || value === "") return [];
  return [cleanText(value)].filter(Boolean);
}

function potentialRelationPairKey(left = "", right = "") {
  return `${cleanText(left)}::${cleanText(right)}`;
}

function samePotentialRelationCandidate(left = {}, right = {}) {
  const leftId = cleanText(left.id || left.candidateId || left.candidate_id);
  const rightId = cleanText(right.id || right.candidateId || right.candidate_id);
  if (leftId && rightId && leftId === rightId) return true;
  const leftSource = cleanText(left.sourceNoteId || left.fromNoteId || left.from_note_id);
  const leftTarget = cleanText(left.targetNoteId || left.toNoteId || left.to_note_id);
  const rightSource = cleanText(right.sourceNoteId || right.fromNoteId || right.from_note_id);
  const rightTarget = cleanText(right.targetNoteId || right.toNoteId || right.to_note_id);
  return Boolean(leftSource && leftTarget && rightSource && rightTarget && potentialRelationPairKey(leftSource, leftTarget) === potentialRelationPairKey(rightSource, rightTarget));
}

function resolvePotentialRelationCandidate(scan = {}, requestedCandidate = null) {
  const scanCandidates = Array.isArray(scan?.candidates) ? scan.candidates : [];
  const requested = requestedCandidate && typeof requestedCandidate === "object" ? requestedCandidate : null;
  const scannedMatch = requested ? scanCandidates.find((candidate) => samePotentialRelationCandidate(candidate, requested)) || null : null;
  if (scannedMatch && requested) return { ...requested, ...scannedMatch };
  if (requested) return null;
  return scanCandidates[0] || null;
}

async function resolvePotentialRelationScope(body = {}) {
  let notes = Array.isArray(body.notes) ? body.notes : [];
  let relations = Array.isArray(body.relations) ? body.relations : [];
  let graph = null;
  let directoryId = cleanText(body.directoryId || body.directory_id);
  const focusNoteId = cleanText(
    body.focusNoteId ||
      body.focus_note_id ||
      body.currentNoteId ||
      body.current_note_id ||
      body.noteId ||
      body.note_id
  );
  if (!notes.length) {
    if (!directoryId && focusNoteId) {
      const focusNote = await getNoteById(VAULT_PATH, focusNoteId);
      directoryId = cleanText(focusNote?.folderId || focusNote?.directoryId || focusNote?.directory_id);
      if (!directoryId) notes = [focusNote];
    }
    if (directoryId) {
      graph = await getDirectoryGraph(VAULT_PATH, directoryId, {
        includeDescendants: body.includeDescendants === true || body.include_descendants === true
      });
      const permanentNodeIds = graph.nodes.filter((node) => node.noteType === "permanent").map((node) => node.id);
      notes = await loadNotesByIds(permanentNodeIds);
      relations = graph.edges;
    }
  }
  return { notes, relations, graph, directoryId, focusNoteId };
}

function graphArtifactScopeKey(body = {}, notes = []) {
  const directoryId = cleanText(body.directoryId || body.directory_id);
  if (directoryId) return `graph_scope:${directoryId}`;
  const focusNoteId = cleanText(
    body.focusNoteId ||
      body.focus_note_id ||
      body.currentNoteId ||
      body.current_note_id ||
      body.noteId ||
      body.note_id
  );
  if (focusNoteId) return `graph_focus:${focusNoteId}`;
  const noteIds = [...new Set((Array.isArray(notes) ? notes : []).map((note) => cleanText(note?.noteId || note?.id)).filter(Boolean))].sort();
  return `graph_notes:${noteIds.join(",") || "manual_scope"}`;
}

function stableArtifactScopePart(value = "") {
  return cleanText(value).toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/giu, "_").replace(/^_+|_+$/g, "").slice(0, 48);
}

function artifactRefreshSnapshot(artifact = {}) {
  return JSON.stringify({
    id: cleanText(artifact.id),
    type: cleanText(artifact.type),
    title: cleanText(artifact.title),
    summary: cleanText(artifact.summary),
    body: artifact.body ?? "",
    origin: cleanText(artifact.origin),
    agentRunId: cleanText(artifact.agentRunId || artifact.agent_run_id),
    contextPackId: cleanText(artifact.contextPackId || artifact.context_pack_id),
    model: artifact.model || null,
    sources: artifact.sources || { noteIds: [], sourceDocIds: [], artifactIds: [], externalUrls: [] },
    provenance: artifact.provenance || {},
    confidence: artifact.confidence || {},
    privacy: artifact.privacy || {},
    payload: artifact.payload || {}
  });
}

function persistArtifactsIdempotently(artifactStore, artifacts = []) {
  if (!artifactStore) return [];
  const stored = [];
  for (const artifact of Array.isArray(artifacts) ? artifacts : []) {
    try {
      stored.push(artifactStore.createArtifact(artifact));
    } catch (error) {
      if (error?.code !== "AI_ARTIFACT_ALREADY_EXISTS") throw error;
      const existing = artifactStore.getArtifact(artifact?.id);
      if (!existing) continue;
      if (artifactRefreshSnapshot(existing) !== artifactRefreshSnapshot(artifact)) {
        stored.push(
          artifactStore.updateArtifact(artifact.id, {
            ...artifact,
            status: existing.status || artifact.status,
            createdAt: existing.createdAt,
            updatedAt: new Date().toISOString()
          })
        );
        continue;
      }
      stored.push(existing);
    }
  }
  return stored.filter(Boolean);
}

const GRAPH_REVIEW_ARTIFACT_TYPES = new Set(["InsightCard", "LinkSuggestion", "BridgeCard", "QuestionCard"]);

function graphArtifactBelongsToScope(artifact = {}, scopePart = "") {
  const id = cleanText(artifact?.id);
  if (!id || !scopePart) return false;
  return id.includes(`_${scopePart}_`) || id.endsWith(`_${scopePart}`);
}

function pruneStaleGraphReviewArtifacts(artifactStore, currentArtifacts = [], { body = {}, notes = [] } = {}) {
  if (!artifactStore || typeof artifactStore.listArtifacts !== "function" || typeof artifactStore.deleteArtifact !== "function") return [];
  const scopePart = stableArtifactScopePart(graphArtifactScopeKey(body, notes));
  if (!scopePart) return [];
  const currentIds = new Set((Array.isArray(currentArtifacts) ? currentArtifacts : []).map((artifact) => cleanText(artifact?.id)).filter(Boolean));
  const staleArtifacts = artifactStore
    .listArtifacts({ status: "pending_review", limit: 500 })
    .filter((artifact) => GRAPH_REVIEW_ARTIFACT_TYPES.has(cleanText(artifact?.type)) && graphArtifactBelongsToScope(artifact, scopePart))
    .filter((artifact) => !currentIds.has(cleanText(artifact?.id)));
  for (const artifact of staleArtifacts) {
    artifactStore.deleteArtifact(artifact.id);
  }
  return staleArtifacts.map((artifact) => artifact.id);
}

function graphReviewArtifactsForCandidate(candidate = {}, context = {}) {
  const reviewItems = buildPermanentNoteGraphReviewItems(
    {
      topicCandidates: [],
      relationCandidates: candidate?.componentBridge ? [] : [candidate],
      bridgeCandidates: candidate?.componentBridge ? [candidate] : [],
      isolatedNotes: []
    },
    context
  );
  return Array.isArray(reviewItems?.artifacts) ? reviewItems.artifacts : [];
}

function graphArtifactExecutionContext({ body = {}, notes = [], rid = "", providerExecution = null, modelName = "" } = {}) {
  const requestedUserMode = cleanText(body.userMode || body.user_mode);
  if (providerExecution) {
    return {
      agentRunId: `run_graph_analysis_${rid}`,
      contextPackId: `ctx_graph_analysis_${rid}`,
      artifactIdSalt: graphArtifactScopeKey(body, notes),
      model: requestModelFromRoute(providerExecution.providerDescriptor, providerExecution.modelRoute, modelName, requestedUserMode),
      privacy: {
        mode: cleanText(providerExecution.modelRoute?.privacyMode) || "normal",
        cloudModelUsed: providerExecution.providerDescriptor?.localExecution !== true
      }
    };
  }
  return {
    agentRunId: `run_graph_analysis_${rid}`,
    contextPackId: `ctx_graph_analysis_${rid}`,
    artifactIdSalt: graphArtifactScopeKey(body, notes),
      model: {
        provider: "ollama_direct",
        model: cleanText(modelName) || DEFAULT_POTENTIAL_RELATION_MODEL,
        modelRef: cleanText(modelName) || DEFAULT_POTENTIAL_RELATION_MODEL,
        tier: "local_private",
        mode: requestedUserMode || "Local / Private"
      },
    privacy: {
      mode: cleanText(body.privacyMode || body.privacy_mode) || "local_only",
      cloudModelUsed: false
    }
  };
}

async function callOllamaGenerate(prompt = "", options = {}) {
  const model = assertAllowedOllamaCatalogModel(options.modelName || options.model || DEFAULT_POTENTIAL_RELATION_MODEL);
  const timeoutMs = Math.max(
    1,
    Math.min(
      Number(options.timeoutMs ?? options.timeout_ms ?? DEFAULT_OLLAMA_GENERATE_TIMEOUT_MS) || DEFAULT_OLLAMA_GENERATE_TIMEOUT_MS,
      MAX_OLLAMA_GENERATE_TIMEOUT_MS
    )
  );
  const controller = new AbortController();
  function ollamaTimeoutError() {
    const timeoutError = new Error(`OLLAMA_TIMEOUT_${timeoutMs}`);
    timeoutError.code = "OLLAMA_TIMEOUT";
    return timeoutError;
  }
  const startedAt = Date.now();
  async function withOllamaDeadline(promise, remainingMs) {
    const timeoutWindow = Math.max(1, Number(remainingMs) || 1);
    let timer = null;
    try {
      return await Promise.race([
        Promise.resolve(promise),
        new Promise((_, reject) => {
          timer = setTimeout(() => {
            controller.abort();
            reject(ollamaTimeoutError());
          }, timeoutWindow);
        })
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
  try {
    const response = await withOllamaDeadline(
      fetch(`${OLLAMA_BASE_URL}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          model,
          prompt: String(prompt || ""),
          stream: false,
          options: {
            temperature: Number(options.temperature ?? 0.1),
            num_predict: Math.max(1, Math.min(Number(options.numPredict ?? options.num_predict ?? 320) || 320, 400))
          }
        })
      }),
      timeoutMs
    );
    let json = {};
    try {
      json = await withOllamaDeadline(response.json(), timeoutMs - (Date.now() - startedAt));
    } catch (error) {
      if (error?.name === "AbortError") throw ollamaTimeoutError();
      if (error?.code === "OLLAMA_TIMEOUT") throw error;
    }
    if (!response.ok) {
      const error = new Error(cleanText(json?.error || json?.message) || `Ollama returned HTTP ${response.status}`);
      error.status = response.status;
      throw error;
    }
    return json.response || "";
  } catch (error) {
    if (error?.name === "AbortError") throw ollamaTimeoutError();
    throw error;
  }
}

async function loadNotesByIds(noteIds = []) {
  const ids = [...new Set(stringArray(noteIds))];
  const items = [];
  for (const noteId of ids) {
    items.push(await getNoteById(VAULT_PATH, noteId));
  }
  return items;
}

async function suggestionWithReadableTarget(item = null) {
  if (!item?.target?.id || item.target.title || item.target.name) return item;
  try {
    const note = await getNoteById(VAULT_PATH, item.target.id);
    const title = cleanText(note?.title || note?.thesis);
    return title ? { ...item, target: { ...item.target, title } } : item;
  } catch {
    return item;
  }
}

async function suggestionsWithReadableTargets(items = []) {
  return Promise.all((Array.isArray(items) ? items : []).map((item) => suggestionWithReadableTarget(item)));
}

function sendJson(res, status, body) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,X-Request-Id,Authorization,X-Yansilu-Local-Runtime-Control,X-Yansilu-Mobile-Token"
  });
  res.end(status === 204 ? "" : JSON.stringify(body, null, 2));
}

function sendBinary(res, status, contentType, body) {
  res.writeHead(status, {
    "Content-Type": contentType || "application/octet-stream",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,X-Request-Id,Authorization"
  });
  res.end(body);
}

function sendHtml(res, status, body) {
  res.writeHead(status, {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,X-Request-Id,Authorization"
  });
  res.end(String(body || ""));
}

function requestId(req) {
  return req.headers["x-request-id"] || `req_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
}

function err(code, message, rid, details) {
  return {
    error: { code, message, ...(details ? { details } : {}) },
    requestId: rid,
    timestamp: new Date().toISOString()
  };
}

function isMutatingRequest(req) {
  return ["POST", "PUT", "PATCH", "DELETE"].includes(String(req?.method || "").toUpperCase());
}

function bypassVaultWriteGate(url) {
  return url?.pathname === "/api/v1/vault/backups" ||
    url?.pathname === "/api/v1/vault/backups/restore";
}

function publicVaultInfo(layout = null) {
  return {
    vaultPath: VAULT_PATH,
    defaultVaultPath: DEFAULT_VAULT_PATH,
    initialized: Boolean(layout),
    dirs: layout?.dirs || []
  };
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) return {};
  return JSON.parse(raw);
}

async function readRaw(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks);
}

function parseConfirmPath(urlPath) {
  const m = urlPath.match(/^\/api\/v1\/imports\/([^/]+)\/confirm$/);
  return m ? m[1] : null;
}

function parseRollbackPath(urlPath) {
  const m = urlPath.match(/^\/api\/v1\/imports\/([^/]+)\/rollback$/);
  return m ? m[1] : null;
}

function parseImportRecordPath(urlPath) {
  const m = urlPath.match(/^\/api\/v1\/imports\/([^/]+)$/);
  return m ? m[1] : null;
}

function parseConnectorPath(urlPath) {
  const m = urlPath.match(/^\/api\/v1\/imports\/(obsidian)$/);
  return m ? m[1] : null;
}

function parsePaperPath(urlPath) {
  const m = urlPath.match(/^\/api\/v1\/papers\/([^/]+)$/);
  return m ? decodeURIComponent(m[1]) : null;
}

function parsePaperNotebookLmDraftsPath(urlPath) {
  const m = urlPath.match(/^\/api\/v1\/papers\/([^/]+)\/notebooklm-drafts$/);
  return m ? decodeURIComponent(m[1]) : null;
}

function parsePaperTranslationsPath(urlPath) {
  const m = urlPath.match(/^\/api\/v1\/papers\/([^/]+)\/translations$/);
  return m ? decodeURIComponent(m[1]) : null;
}

function parsePaperPermanentCandidatesPath(urlPath) {
  const m = urlPath.match(/^\/api\/v1\/papers\/([^/]+)\/permanent-candidates$/);
  return m ? decodeURIComponent(m[1]) : null;
}

function parsePaperPermanentNotesPath(urlPath) {
  const m = urlPath.match(/^\/api\/v1\/papers\/([^/]+)\/permanent-notes$/);
  return m ? decodeURIComponent(m[1]) : null;
}

function parseDirectoryNotesPath(urlPath) {
  const m = urlPath.match(/^\/api\/v1\/directories\/([^/]+)\/notes$/);
  return m ? decodeURIComponent(m[1]) : null;
}

function parseTagNotesPath(urlPath) {
  const m = urlPath.match(/^\/api\/v1\/tags\/([^/]+)\/notes$/);
  return m ? decodeURIComponent(m[1]) : null;
}

function parseDirectoryPath(urlPath) {
  const m = urlPath.match(/^\/api\/v1\/directories\/([^/]+)$/);
  return m ? decodeURIComponent(m[1]) : null;
}

function parseNotePath(urlPath) {
  const m = urlPath.match(/^\/api\/v1\/notes\/([^/]+)$/);
  return m ? decodeURIComponent(m[1]) : null;
}

function parsePermanentNoteDistillationPath(urlPath) {
  const m = urlPath.match(/^\/api\/v1\/permanent-notes\/([^/]+)\/distillation$/);
  return m ? decodeURIComponent(m[1]) : null;
}

function parsePermanentNoteDistillationConfirmPath(urlPath) {
  const m = urlPath.match(/^\/api\/v1\/permanent-notes\/([^/]+)\/distillation\/confirm$/);
  return m ? decodeURIComponent(m[1]) : null;
}

function parseNoteRelationsPath(urlPath) {
  const m = urlPath.match(/^\/api\/v1\/notes\/([^/]+)\/relations$/);
  return m ? decodeURIComponent(m[1]) : null;
}

function parseNoteAiAnalysisPath(urlPath) {
  const m = urlPath.match(/^\/api\/v1\/notes\/([^/]+)\/ai-analysis$/);
  return m ? decodeURIComponent(m[1]) : null;
}

function parseRelationPath(urlPath) {
  const m = urlPath.match(/^\/api\/v1\/relations\/([^/]+)$/);
  return m ? decodeURIComponent(m[1]) : null;
}

function parseMoveNotePath(urlPath) {
  const m = urlPath.match(/^\/api\/v1\/notes\/([^/]+)\/move$/);
  return m ? decodeURIComponent(m[1]) : null;
}

function parseScheduledTaskPath(urlPath) {
  const m = urlPath.match(/^\/api\/v1\/ai\/scheduled-tasks\/([^/]+)$/);
  return m ? decodeURIComponent(m[1]) : null;
}

function parseScheduledTaskStatusPath(urlPath) {
  const m = urlPath.match(/^\/api\/v1\/ai\/scheduled-tasks\/([^/]+)\/status$/);
  return m ? decodeURIComponent(m[1]) : null;
}

function parseAiInboxItemPath(urlPath) {
  const m = urlPath.match(/^\/api\/v1\/ai\/inbox\/([^/]+)$/);
  return m ? decodeURIComponent(m[1]) : null;
}

function parseAiSuggestionPath(urlPath) {
  const m = urlPath.match(/^\/api\/v1\/ai-suggestions\/([^/]+)$/);
  return m ? decodeURIComponent(m[1]) : null;
}

function noteDistillationPayload(note = {}, body = {}, options = {}) {
  const confirmed = options.confirm === true;
  const hasSummary = body.threeLineSummary !== undefined || body.three_line_summary !== undefined;
  const hasStatus = body.distillationStatus !== undefined || body.distillation_status !== undefined;
  const thesis = body.thesis === undefined ? note.thesis || "" : body.thesis;
  const threeLineSummary = hasSummary ? body.threeLineSummary ?? body.three_line_summary : note.threeLineSummary || [];
  const distillationStatus = confirmed
    ? "confirmed"
    : hasStatus
      ? body.distillationStatus ?? body.distillation_status
      : note.distillationStatus || (cleanText(thesis) || (Array.isArray(threeLineSummary) && threeLineSummary.length) ? "draft" : "missing");

  const payload = {
    title: note.title,
    body: note.body,
    status: note.status,
    distillationStatus,
    boundaryOrCounterpoint: body.boundaryOrCounterpoint ?? body.boundary_or_counterpoint ?? note.boundaryOrCounterpoint,
    originalityStatus: note.originalityStatus,
    originalitySimilarity: note.originalitySimilarity,
    authorship: confirmed ? { user_confirmed: true, ai_assisted: false } : body.authorship,
    authorshipConfirmed: confirmed ? true : body.authorshipConfirmed,
    authorshipAiAssisted: confirmed ? false : body.authorshipAiAssisted
  };
  if (body.thesis !== undefined) payload.thesis = body.thesis;
  else if (!confirmed && note.thesis !== undefined) payload.thesis = note.thesis;
  if (hasSummary) payload.threeLineSummary = threeLineSummary;
  else if (!confirmed && note.threeLineSummary !== undefined) payload.threeLineSummary = note.threeLineSummary;
  return payload;
}

function assertPermanentNoteReadyToConfirm(note = {}, body = {}) {
  const thesis = cleanText(body.thesis === undefined ? note.thesis : body.thesis);
  if (!thesis) {
    const error = new Error("Confirming a permanent note requires a current viewpoint.");
    error.code = "PERMANENT_DISTILLATION_CONFIRMATION_INCOMPLETE";
    error.details = { hasThesis: false };
    throw error;
  }
}

function publicDistillationQueueItems(queue = {}, filter = {}) {
  const requestedStatus = cleanText(filter.status || "");
  return (Array.isArray(queue.items) ? queue.items : [])
    .map((entry) => {
      const missing = [
        entry.missingThesis ? "thesis" : "",
        entry.missingThreeLineSummary ? "three_line_summary" : ""
      ].filter(Boolean);
      return {
        targetId: entry.note?.id || "",
        targetType: "permanent_note",
        status: entry.status,
        missing,
        note: entry.note,
        qualityChecks: entry.qualityChecks
      };
    })
    .filter((entry) => !requestedStatus || requestedStatus === "all" || entry.status === requestedStatus);
}

function parseAiInboxDecisionPath(urlPath) {
  const m = urlPath.match(/^\/api\/v1\/ai\/inbox\/([^/]+)\/decision$/);
  return m ? decodeURIComponent(m[1]) : null;
}

function parseAiInboxAcceptLinkPath(urlPath) {
  const m = urlPath.match(/^\/api\/v1\/ai\/inbox\/([^/]+)\/accept-link$/);
  return m ? decodeURIComponent(m[1]) : null;
}

function parseAiInboxPromoteNotePath(urlPath) {
  const m = urlPath.match(/^\/api\/v1\/ai\/inbox\/([^/]+)\/promote-note$/);
  return m ? decodeURIComponent(m[1]) : null;
}

function parseAiInboxAdoptFieldSuggestionPath(urlPath) {
  const m = urlPath.match(/^\/api\/v1\/ai\/inbox\/([^/]+)\/adopt-field-suggestion$/);
  return m ? decodeURIComponent(m[1]) : null;
}

function parseAiInboxSummarizePath(urlPath) {
  const m = urlPath.match(/^\/api\/v1\/ai\/inbox\/([^/]+)\/summarize$/);
  return m ? decodeURIComponent(m[1]) : null;
}

function assetContentType(filePath) {
  const ext = path.extname(String(filePath || "")).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".gif") return "image/gif";
  if (ext === ".webp") return "image/webp";
  if (ext === ".svg") return "image/svg+xml";
  if (ext === ".bmp") return "image/bmp";
  if (ext === ".ico") return "image/x-icon";
  if (ext === ".pdf") return "application/pdf";
  if (ext === ".md") return "text/markdown; charset=utf-8";
  if (ext === ".txt") return "text/plain; charset=utf-8";
  return "application/octet-stream";
}

function defaultDirectoryIdForImportNoteType(noteType) {
  if (noteType === "source") return "dir_source_default";
  if (noteType === "literature") return "dir_literature_default";
  if (noteType === "fleeting") return "dir_fleeting_default";
  return "dir_original_default";
}

function normalizeAiInboxDecision(body = {}) {
  const raw = cleanText(body.decision || body.action || body.status);
  const aliases = {
    accept: "accepted",
    accepted: "accepted",
    ignore: "ignored",
    ignored: "ignored",
    archive: "archived",
    archived: "archived"
  };
  return aliases[raw] || raw;
}

function normalizeAiInboxDecisionFeedback(body = {}) {
  const feedback = body.feedback && typeof body.feedback === "object" ? body.feedback : {};
  const readBool = (...values) => {
    for (const value of values) {
      if (typeof value === "boolean") return value;
    }
    return false;
  };
  return {
    useful: readBool(body.useful, feedback.useful),
    noisy: readBool(body.noisy, feedback.noisy),
    wrong: readBool(body.wrong, feedback.wrong),
    alreadyKnown: readBool(body.alreadyKnown, body.already_known, feedback.alreadyKnown, feedback.already_known),
    privacyConcern: readBool(body.privacyConcern, body.privacy_concern, feedback.privacyConcern, feedback.privacy_concern)
  };
}

function sameAiInboxDecisionPayload(existingDecision = null, body = {}) {
  if (!existingDecision) return false;
  const nextFeedback = normalizeAiInboxDecisionFeedback(body);
  const previousFeedback = existingDecision.feedback && typeof existingDecision.feedback === "object"
    ? existingDecision.feedback
    : {};
  const hasComment = Object.prototype.hasOwnProperty.call(body, "comment");
  const hasUserId = Object.prototype.hasOwnProperty.call(body, "userId") || Object.prototype.hasOwnProperty.call(body, "user_id");
  const hasNoteId = Object.prototype.hasOwnProperty.call(body, "noteId") || Object.prototype.hasOwnProperty.call(body, "note_id");
  const hasUseful = Object.prototype.hasOwnProperty.call(body, "useful") || Object.prototype.hasOwnProperty.call(body.feedback || {}, "useful");
  const hasNoisy = Object.prototype.hasOwnProperty.call(body, "noisy") || Object.prototype.hasOwnProperty.call(body.feedback || {}, "noisy");
  const hasWrong = Object.prototype.hasOwnProperty.call(body, "wrong") || Object.prototype.hasOwnProperty.call(body.feedback || {}, "wrong");
  const hasAlreadyKnown =
    Object.prototype.hasOwnProperty.call(body, "alreadyKnown") ||
    Object.prototype.hasOwnProperty.call(body, "already_known") ||
    Object.prototype.hasOwnProperty.call(body.feedback || {}, "alreadyKnown") ||
    Object.prototype.hasOwnProperty.call(body.feedback || {}, "already_known");
  const hasPrivacyConcern =
    Object.prototype.hasOwnProperty.call(body, "privacyConcern") ||
    Object.prototype.hasOwnProperty.call(body, "privacy_concern") ||
    Object.prototype.hasOwnProperty.call(body.feedback || {}, "privacyConcern") ||
    Object.prototype.hasOwnProperty.call(body.feedback || {}, "privacy_concern");
  return (
    (!hasComment || cleanText(body.comment) === cleanText(existingDecision.comment)) &&
    (!hasUserId || cleanText(body.userId || body.user_id || "local_user") === cleanText(existingDecision.userId || existingDecision.user_id || "local_user")) &&
    (!hasNoteId || cleanText(body.noteId || body.note_id) === cleanText(existingDecision.noteId || existingDecision.note_id)) &&
    (!hasUseful || nextFeedback.useful === (previousFeedback.useful === true)) &&
    (!hasNoisy || nextFeedback.noisy === (previousFeedback.noisy === true)) &&
    (!hasWrong || nextFeedback.wrong === (previousFeedback.wrong === true)) &&
    (!hasAlreadyKnown || nextFeedback.alreadyKnown === (previousFeedback.alreadyKnown === true)) &&
    (!hasPrivacyConcern || nextFeedback.privacyConcern === (previousFeedback.privacyConcern === true))
  );
}

function assertReviewDecision(decision) {
  if (["accepted", "revised", "ignored", "archived"].includes(decision)) return;
  const error = new Error("Use a dedicated promotion API for adopted_as_draft, promoted_to_note, or linked_to_note decisions");
  error.code = "AI_ARTIFACT_DECISION_INVALID";
  throw error;
}

function recommendedAiInboxActionFromText(text = "") {
  const raw = cleanText(text).toLowerCase();
  if (!raw) return "";
  const match = raw.match(/recommended\s+action\s*[:：]\s*([a-z_ -]+)/i);
  const candidate = cleanText(match?.[1] || "")
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
    .replace(/[^a-z_].*$/, "");
  const aliases = {
    accept: "accept_link",
    accept_link: "accept_link",
    create_link: "accept_link",
    adopt_field: "adopt_field_suggestion",
    adopt_field_suggestion: "adopt_field_suggestion",
    adopt_as_draft: "adopt_field_suggestion",
    promote: "promote_note",
    promote_note: "promote_note",
    create_note: "promote_note",
    ignore: "ignore",
    ignored: "ignore",
    archive: "ignore",
    needs_more_context: "needs_more_context",
    more_context: "needs_more_context"
  };
  return aliases[candidate] || "";
}

function hasExplicitConfirmation(body = {}) {
  return body.confirm === true || body.confirmed === true || body.userConfirmed === true || body.user_confirmed === true;
}

function noteEndpointId(endpoint = {}) {
  const kind = cleanText(endpoint.kind || endpoint.type || "note").toLowerCase();
  if (kind && kind !== "note") {
    const error = new Error("LinkSuggestion acceptance only supports note-to-note relations");
    error.code = "AI_LINK_SUGGESTION_NOTE_ENDPOINT_REQUIRED";
    throw error;
  }
  return cleanText(endpoint.id || endpoint.noteId || endpoint.note_id);
}

function relationInputFromLinkSuggestion(artifact = {}, body = {}) {
  if (artifact.type !== "LinkSuggestion") {
    const error = new Error("artifact must be a LinkSuggestion");
    error.code = "AI_LINK_SUGGESTION_REQUIRED";
    throw error;
  }
  const payload = artifact.payload || {};
  const suggestedFromNoteId = noteEndpointId(payload.from || {});
  const suggestedToNoteId = noteEndpointId(payload.to || {});
  const fromNoteId = cleanText(body.fromNoteId || body.from_note_id) || suggestedFromNoteId;
  const toNoteId = cleanText(body.toNoteId || body.to_note_id) || suggestedToNoteId;
  const relationType = cleanText(body.relationType || body.relation_type || payload.relationType || payload.relation_type || "related").toLowerCase();
  const rationale = cleanText(body.rationale || payload.rationale || artifact.summary);
  const confidence = body.confidence ?? body.confidenceScore ?? body.confidence_score ?? artifact.confidence?.score;
  return {
    fromNoteId,
    toNoteId,
    relationType,
    rationale,
    confidence
  };
}

const NOTE_PROMOTION_ARTIFACT_TYPES = new Set(["QuestionCard", "ReflectionPrompt"]);

function latestPromotedNoteDecision(artifact = {}) {
  const decisions = Array.isArray(artifact.userDecisions) ? artifact.userDecisions : [];
  return decisions
    .slice()
    .reverse()
    .find((decision) => decision?.decision === "promoted_to_note" && cleanText(decision.noteId || decision.note_id));
}

function firstCleanText(...values) {
  for (const value of values) {
    const text = cleanText(value);
    if (text) return text;
  }
  return "";
}

function promoteNoteInputFromArtifact(artifact = {}, body = {}) {
  if (!NOTE_PROMOTION_ARTIFACT_TYPES.has(artifact.type)) {
    const error = new Error("artifact must be a QuestionCard or ReflectionPrompt");
    error.code = "AI_NOTE_PROMOTION_ARTIFACT_TYPE_INVALID";
    throw error;
  }

  const existingPromotion = latestPromotedNoteDecision(artifact);
  if (existingPromotion) {
    const error = new Error("artifact has already been promoted to a note");
    error.code = "AI_ARTIFACT_ALREADY_PROMOTED";
    error.details = { noteId: existingPromotion.noteId || existingPromotion.note_id };
    throw error;
  }

  const payload = artifact.payload && typeof artifact.payload === "object" ? artifact.payload : {};
  const title = firstCleanText(
    body.title,
    payload.noteTitle,
    payload.note_title,
    payload.title,
    payload.question,
    payload.prompt,
    artifact.title,
    "AI artifact draft"
  );
  const mainBody = firstCleanText(
    body.body,
    payload.draft,
    payload.question,
    payload.prompt,
    payload.body,
    artifact.body,
    artifact.summary
  );
  const sourceNoteIds = Array.isArray(artifact.sources?.noteIds) ? artifact.sources.noteIds.filter(Boolean) : [];
  const sourceLines = sourceNoteIds.length
    ? ["", "## Source notes", ...sourceNoteIds.map((noteId) => `- ${noteId}`)]
    : [];
  const contextLines = [
    "",
    "## AI artifact context",
    `- Artifact: ${artifact.id}`,
    `- Type: ${artifact.type}`,
    `- Agent run: ${artifact.agentRunId || "unknown"}`,
    `- Context pack: ${artifact.contextPackId || "none"}`,
    `- Privacy: ${artifact.privacy?.mode || "normal"}`
  ];
  const summaryLines = artifact.summary ? ["", "## Summary", artifact.summary] : [];
  const payloadRationale = firstCleanText(payload.rationale, payload.whyItMatters, payload.why_it_matters);
  const rationaleLines = payloadRationale ? ["", "## Rationale", payloadRationale] : [];

  return {
    directoryId: cleanText(body.directoryId || body.directory_id) || "dir_fleeting_default",
    title,
    body: [
      `# ${title}`,
      "",
      "AI artifact draft. Review, revise, or delete before treating it as your own note.",
      "",
      "## Draft",
      mainBody || "No draft body recorded.",
      ...summaryLines,
      ...rationaleLines,
      ...sourceLines,
      ...contextLines
    ].join("\n"),
    status: cleanText(body.status) || "draft"
  };
}

function normalizeFieldSuggestionField(value = "") {
  const field = cleanText(value).replace(/[A-Z]/g, (match) => `_${match.toLowerCase()}`).replace(/^_+/, "");
  const aliases = {
    thesis: "thesis",
    three_line_summary: "three_line_summary",
    three_linesummary: "three_line_summary"
  };
  const normalized = aliases[field] || field;
  if (["thesis", "three_line_summary"].includes(normalized)) return normalized;
  const error = new Error("field suggestion must target thesis or three_line_summary");
  error.code = "AI_FIELD_SUGGESTION_FIELD_INVALID";
  throw error;
}

function fieldSuggestionItems(value) {
  if (Array.isArray(value)) return value.map((item) => cleanText(item)).filter(Boolean);
  const text = cleanText(value);
  if (!text) return [];
  return text.split(/\r?\n|\s+\/\s+/u).map((item) => cleanText(item)).filter(Boolean);
}

function fieldSuggestionInputFromArtifact(artifact = {}, body = {}) {
  const payload = artifact.payload && typeof artifact.payload === "object" ? artifact.payload : {};
  const suggestion = payload.fieldSuggestion || payload.field_suggestion;
  if (artifact.type !== "InsightCard" || !suggestion || typeof suggestion !== "object") {
    const error = new Error("artifact must be an InsightCard with a fieldSuggestion payload");
    error.code = "AI_FIELD_SUGGESTION_REQUIRED";
    throw error;
  }
  const existingAdoption = (Array.isArray(artifact.userDecisions) ? artifact.userDecisions : [])
    .slice()
    .reverse()
    .find((decision) => decision?.decision === "adopted_as_draft");
  if (existingAdoption) {
    const error = new Error("field suggestion has already been adopted as a draft");
    error.code = "AI_FIELD_SUGGESTION_ALREADY_ADOPTED";
    error.details = { noteId: existingAdoption.noteId || existingAdoption.note_id };
    throw error;
  }

  const target = suggestion.target && typeof suggestion.target === "object" ? suggestion.target : {};
  const targetType = cleanText(target.type || target.kind || "permanent_note").toLowerCase();
  if (targetType !== "permanent_note") {
    const error = new Error("field suggestions can only be adopted into permanent notes");
    error.code = "AI_FIELD_SUGGESTION_TARGET_INVALID";
    throw error;
  }

  const noteId = cleanText(
    body.noteId ||
      body.note_id ||
      target.id ||
      payload.sourceNoteIds?.[0] ||
      payload.source_note_ids?.[0] ||
      artifact.sources?.noteIds?.[0]
  );
  if (!noteId) {
    const error = new Error("field suggestion target noteId is required");
    error.code = "AI_FIELD_SUGGESTION_NOTE_ID_REQUIRED";
    throw error;
  }

  const content = suggestion.content && typeof suggestion.content === "object" ? suggestion.content : {};
  const bodyContent = body.content && typeof body.content === "object" ? body.content : {};
  const field = normalizeFieldSuggestionField(body.field || body.targetField || body.target_field || target.field || payload.targetField || payload.target_field);
  const update = {
    distillationStatus: "draft",
    authorship: {
      user_confirmed: false,
      ai_assisted: true
    }
  };
  const adoptedValue = {};

  if (field === "thesis") {
    const thesis = cleanText(body.thesis ?? body.value ?? bodyContent.thesis ?? content.thesis ?? content[field] ?? artifact.body);
    if (!thesis) {
      const error = new Error("thesis field suggestion content is required");
      error.code = "AI_FIELD_SUGGESTION_CONTENT_REQUIRED";
      throw error;
    }
    update.thesis = thesis;
    adoptedValue.thesis = thesis;
  } else {
    const summary = fieldSuggestionItems(
      body.threeLineSummary ??
        body.three_line_summary ??
        body.value ??
        bodyContent.threeLineSummary ??
        bodyContent.three_line_summary ??
        content.threeLineSummary ??
        content.three_line_summary
    );
    if (!summary.length) {
      const error = new Error("three_line_summary field suggestion content is required");
      error.code = "AI_FIELD_SUGGESTION_CONTENT_REQUIRED";
      throw error;
    }
    update.threeLineSummary = summary;
    adoptedValue.threeLineSummary = summary;
  }

  return {
    noteId,
    field,
    update,
    adoptedValue
  };
}

function payloadWithAdoptedFieldSuggestion(artifact = {}, fieldSuggestion = {}, updatedNote = null, suggestion = null) {
  const payload = artifact.payload && typeof artifact.payload === "object" ? artifact.payload : {};
  const originalSuggestion = payload.fieldSuggestion || payload.field_suggestion;
  if (!originalSuggestion || typeof originalSuggestion !== "object") return payload;

  const nextSource = suggestion && typeof suggestion === "object" && !Array.isArray(suggestion) ? suggestion : originalSuggestion;
  const target = originalSuggestion.target && typeof originalSuggestion.target === "object" ? originalSuggestion.target : {};
  const nextTarget = nextSource.target && typeof nextSource.target === "object" ? nextSource.target : {};
  const nextProvenance = nextSource.provenance && typeof nextSource.provenance === "object" ? nextSource.provenance : {};
  const nextHistory = Array.isArray(nextSource.history)
    ? cloneJson(nextSource.history)
    : Array.isArray(originalSuggestion.history)
      ? cloneJson(originalSuggestion.history)
      : undefined;
  const nextSuggestion = {
    ...originalSuggestion,
    id: cleanText(nextSource.id || originalSuggestion.id),
    content: Object.prototype.hasOwnProperty.call(nextSource, "content") ? nextSource.content : originalSuggestion.content,
    status: cleanText(nextSource.status || "adopted_as_draft"),
    target: {
      ...target,
      type: nextTarget.type || nextTarget.kind || target.type || target.kind || "permanent_note",
      id: fieldSuggestion.noteId || nextTarget.id || target.id || "",
      field: fieldSuggestion.field || nextTarget.field || target.field || ""
    },
    provenance: {
      ...(originalSuggestion.provenance && typeof originalSuggestion.provenance === "object" ? originalSuggestion.provenance : {}),
      humanEdited:
        nextProvenance.humanEdited === true ||
        nextProvenance.human_edited === true,
      humanConfirmed:
        nextProvenance.humanConfirmed === true ||
        nextProvenance.human_confirmed === true
    },
    ...(Array.isArray(nextHistory) ? { history: nextHistory } : {})
  };

  return {
    ...payload,
    targetField: fieldSuggestion.field,
    target_field: fieldSuggestion.field,
    adoptedNoteId: cleanText(updatedNote?.id || fieldSuggestion.noteId),
    adopted_note_id: cleanText(updatedNote?.id || fieldSuggestion.noteId),
    fieldSuggestion: nextSuggestion,
    field_suggestion: nextSuggestion
  };
}

function payloadWithRejectedFieldSuggestion(artifact = {}, suggestion = null) {
  const payload = artifact.payload && typeof artifact.payload === "object" ? artifact.payload : {};
  const originalSuggestion = payload.fieldSuggestion || payload.field_suggestion;
  if (!originalSuggestion || typeof originalSuggestion !== "object") return payload;
  const copyJson = (value) => JSON.parse(JSON.stringify(value ?? null));
  const nextSource = suggestion && typeof suggestion === "object" && !Array.isArray(suggestion) ? suggestion : originalSuggestion;
  const nextProvenance = nextSource.provenance && typeof nextSource.provenance === "object" ? nextSource.provenance : {};
  const nextHistory = Array.isArray(nextSource.history)
    ? copyJson(nextSource.history)
    : Array.isArray(originalSuggestion.history)
      ? copyJson(originalSuggestion.history)
      : undefined;

  const nextSuggestion = {
    ...originalSuggestion,
    id: cleanText(nextSource.id || originalSuggestion.id),
    content: Object.prototype.hasOwnProperty.call(nextSource, "content") ? nextSource.content : originalSuggestion.content,
    status: cleanText(nextSource.status || "rejected"),
    provenance: {
      ...(originalSuggestion.provenance && typeof originalSuggestion.provenance === "object" ? originalSuggestion.provenance : {}),
      humanEdited:
        nextProvenance.humanEdited === true ||
        nextProvenance.human_edited === true,
      humanConfirmed: false
    },
    ...(Array.isArray(nextHistory) ? { history: nextHistory } : {})
  };

  return {
    ...payload,
    fieldSuggestion: nextSuggestion,
    field_suggestion: nextSuggestion
  };
}

function artifactWithProjectedSuggestionState(artifact = null, suggestion = null) {
  if (!artifact || typeof artifact !== "object" || Array.isArray(artifact)) return artifact;
  if (!suggestion || typeof suggestion !== "object" || Array.isArray(suggestion)) return artifact;

  const payload = artifact.payload && typeof artifact.payload === "object" ? artifact.payload : {};
  const originalSuggestion = payload.fieldSuggestion || payload.field_suggestion;
  if (!originalSuggestion || typeof originalSuggestion !== "object") return artifact;

  const target = suggestion.target && typeof suggestion.target === "object" ? suggestion.target : {};
  const existingTarget = originalSuggestion.target && typeof originalSuggestion.target === "object" ? originalSuggestion.target : {};
  const suggestionProvenance = suggestion.provenance && typeof suggestion.provenance === "object" ? suggestion.provenance : {};
  const suggestionStatus = cleanText(suggestion.status);
  const suggestionHistory = Array.isArray(suggestion.history)
    ? cloneJson(suggestion.history)
    : Array.isArray(originalSuggestion.history)
      ? cloneJson(originalSuggestion.history)
      : undefined;
  const adoptedStatus = suggestionStatus === "adopted_as_draft" || suggestionStatus === "edited" || suggestionStatus === "confirmed";
  const rewrittenStatus = suggestionStatus === "edited" || suggestionStatus === "confirmed";

  const nextSuggestion = {
    ...originalSuggestion,
    id: cleanText(suggestion.id || originalSuggestion.id),
    content: Object.prototype.hasOwnProperty.call(suggestion, "content") ? suggestion.content : originalSuggestion.content,
    status: suggestionStatus || cleanText(originalSuggestion.status),
    target: {
      ...existingTarget,
      type: cleanText(target.type || target.kind || existingTarget.type || existingTarget.kind),
      id: cleanText(target.id || existingTarget.id),
      field: cleanText(target.field || existingTarget.field)
    },
    provenance: {
      ...(originalSuggestion.provenance && typeof originalSuggestion.provenance === "object" ? originalSuggestion.provenance : {}),
      humanEdited:
        suggestionProvenance.humanEdited === true ||
        suggestionProvenance.human_edited === true ||
        rewrittenStatus,
      humanConfirmed:
        suggestionProvenance.humanConfirmed === true ||
        suggestionProvenance.human_confirmed === true ||
        suggestionStatus === "confirmed"
    },
    ...(Array.isArray(suggestionHistory) ? { history: suggestionHistory } : {})
  };

  return {
    ...artifact,
    status:
      suggestionStatus === "rejected"
        ? "ignored"
        : adoptedStatus
          ? "adopted_as_draft"
          : cleanText(artifact.status),
    provenance: {
      ...(artifact.provenance && typeof artifact.provenance === "object" ? artifact.provenance : {}),
      humanAccepted:
        (artifact.provenance?.humanAccepted === true || artifact.provenance?.human_accepted === true || adoptedStatus) === true,
      humanRewritten:
        (artifact.provenance?.humanRewritten === true || artifact.provenance?.human_rewritten === true || rewrittenStatus) === true
    },
    payload: {
      ...payload,
      ...(cleanText(nextSuggestion.target.field)
        ? {
            targetField: cleanText(nextSuggestion.target.field),
            target_field: cleanText(nextSuggestion.target.field)
          }
        : {}),
      ...(adoptedStatus && cleanText(nextSuggestion.target.id)
        ? {
            adoptedNoteId: cleanText(nextSuggestion.target.id),
            adopted_note_id: cleanText(nextSuggestion.target.id)
          }
        : {}),
      fieldSuggestion: nextSuggestion,
      field_suggestion: nextSuggestion
    }
  };
}

let sqliteDatabaseSyncPromise = null;

async function loadSqliteDatabaseSync() {
  if (!sqliteDatabaseSyncPromise) {
    sqliteDatabaseSyncPromise = import("node:sqlite").then((mod) => mod.DatabaseSync);
  }
  return sqliteDatabaseSyncPromise;
}

function fieldSuggestionIdFromArtifactPayload(artifact = {}) {
  const payload = artifact.payload && typeof artifact.payload === "object" ? artifact.payload : {};
  return cleanText(
    payload.fieldSuggestionId ||
      payload.field_suggestion_id ||
      payload.fieldSuggestion?.id ||
      payload.field_suggestion?.id
  );
}

function payloadWithAiReviewSummary(artifact = {}, summary = {}) {
  const payload = artifact.payload && typeof artifact.payload === "object" ? artifact.payload : {};
  const record = {
    providerId: cleanText(summary.providerId || summary.provider_id),
    modelRef: cleanText(summary.modelRef || summary.model_ref),
    recommendedAction: cleanText(summary.recommendedAction || summary.recommended_action),
    content: cleanText(summary.content || summary.text || summary.body),
    createdAt: cleanText(summary.createdAt || summary.created_at) || new Date().toISOString()
  };
  return {
    ...payload,
    aiReviewSummary: record,
    ai_review_summary: {
      provider_id: record.providerId,
      model_ref: record.modelRef,
      recommended_action: record.recommendedAction,
      content: record.content,
      created_at: record.createdAt
    }
  };
}

function adoptionEventFromCanonical(event = {}) {
  return {
    adoptionEventId: cleanText(event.adoption_event_id),
    subjectKind: cleanText(event.subject_kind),
    subjectId: cleanText(event.subject_id),
    eventType: cleanText(event.event_type),
    actorType: cleanText(event.actor_type),
    actorId: cleanText(event.actor_id),
    target: {
      kind: cleanText(event.target?.kind),
      id: cleanText(event.target?.id),
      field: cleanText(event.target?.field)
    },
    comment: cleanText(event.comment),
    feedback: {
      useful: event.feedback?.useful === true,
      noisy: event.feedback?.noisy === true,
      wrong: event.feedback?.wrong === true,
      alreadyKnown: event.feedback?.already_known === true,
      privacyConcern: event.feedback?.privacy_concern === true
    },
    metadata: {
      fromStatus: cleanText(event.metadata?.from_status),
      toStatus: cleanText(event.metadata?.to_status),
      noteId: cleanText(event.metadata?.note_id)
    },
    createdAt: cleanText(event.created_at)
  };
}

function suggestionReviewEventsFromSuggestion(suggestion = {}) {
  const history = Array.isArray(suggestion.history) ? suggestion.history : [];
  return history.map((entry) =>
    adoptionEventFromCanonical(suggestionTransitionToCanonicalAdoptionEvent(entry, suggestion))
  );
}

function suggestionReviewEventsToCanonical(suggestion = {}) {
  const history = Array.isArray(suggestion.history) ? suggestion.history : [];
  return history.map((entry) => suggestionTransitionToCanonicalAdoptionEvent(entry, suggestion));
}

function latestSuggestionReviewEventFromSuggestion(suggestion = {}) {
  const reviewEvents = suggestionReviewEventsFromSuggestion(suggestion);
  return reviewEvents[reviewEvents.length - 1] || null;
}

function latestSuggestionReviewEventToCanonical(suggestion = {}) {
  const reviewEvents = suggestionReviewEventsToCanonical(suggestion);
  return reviewEvents[reviewEvents.length - 1] || null;
}

function embeddedSuggestionFromArtifact(artifact = {}) {
  const payload = artifact?.payload && typeof artifact.payload === "object" ? artifact.payload : {};
  const embeddedSuggestion =
    payload.fieldSuggestion && typeof payload.fieldSuggestion === "object"
      ? payload.fieldSuggestion
      : payload.field_suggestion && typeof payload.field_suggestion === "object"
        ? payload.field_suggestion
        : null;
  return embeddedSuggestion && !Array.isArray(embeddedSuggestion) ? embeddedSuggestion : null;
}

function reviewedEmbeddedSuggestionFromArtifact(artifact = {}) {
  const embeddedSuggestion = embeddedSuggestionFromArtifact(artifact);
  if (!embeddedSuggestion) return null;
  const history = Array.isArray(embeddedSuggestion.history) ? embeddedSuggestion.history : [];
  const status = cleanText(embeddedSuggestion.status);
  const provenance = embeddedSuggestion.provenance && typeof embeddedSuggestion.provenance === "object"
    ? embeddedSuggestion.provenance
    : {};
  const hasReviewedSnapshot =
    history.length > 0 ||
    status === "adopted_as_draft" ||
    status === "edited" ||
    status === "confirmed" ||
    status === "rejected" ||
    provenance.humanEdited === true ||
    provenance.human_edited === true ||
    provenance.humanConfirmed === true ||
    provenance.human_confirmed === true;
  if (!hasReviewedSnapshot) return null;
  return {
    ...embeddedSuggestion,
    sourceArtifactId:
      cleanText(embeddedSuggestion.sourceArtifactId || embeddedSuggestion.source_artifact_id || artifact.id) || cleanText(artifact.id)
  };
}

function canonicalEmbeddedSuggestionFromArtifact(artifact = {}) {
  const embeddedSuggestion = reviewedEmbeddedSuggestionFromArtifact(artifact);
  if (!embeddedSuggestion) return null;
  return suggestionToCanonical(embeddedSuggestion, { sourceArtifactId: artifact.id });
}

function degradedSuggestionReviewEventsFromArtifact(artifact = {}) {
  const embeddedSuggestion = embeddedSuggestionFromArtifact(artifact);
  return embeddedSuggestion ? suggestionReviewEventsFromSuggestion(embeddedSuggestion) : [];
}

function degradedSuggestionReviewEventsToCanonical(artifact = {}) {
  const embeddedSuggestion = embeddedSuggestionFromArtifact(artifact);
  return embeddedSuggestion ? suggestionReviewEventsToCanonical(embeddedSuggestion) : [];
}

function degradedLatestSuggestionReviewEventFromArtifact(artifact = {}) {
  const reviewEvents = degradedSuggestionReviewEventsFromArtifact(artifact);
  return reviewEvents[reviewEvents.length - 1] || null;
}

function degradedLatestSuggestionReviewEventToCanonical(artifact = {}) {
  const reviewEvents = degradedSuggestionReviewEventsToCanonical(artifact);
  return reviewEvents[reviewEvents.length - 1] || null;
}

function artifactDecisionEventContext(artifact = {}, decision = {}) {
  const artifactType = cleanText(artifact.type);
  const payload = artifact.payload && typeof artifact.payload === "object" ? artifact.payload : {};
  const noteId = cleanText(decision.noteId || decision.note_id);
  if (decision.decision === "adopted_as_draft") {
    return {
      target: {
        kind: "permanent_note",
        id: noteId,
        field: cleanText(
          payload.targetField ||
            payload.target_field ||
            payload.fieldSuggestion?.target?.field ||
            payload.field_suggestion?.target?.field
        )
      },
      metadata: {
        noteId
      }
    };
  }
  if (decision.decision === "promoted_to_note") {
    return {
      target: {
        kind: "note",
        id: noteId
      },
      metadata: {
        noteId
      }
    };
  }
  if (decision.decision === "linked_to_note") {
    return {
      target: {
        kind: artifactType === "LinkSuggestion" ? "relation_review" : "note",
        id: noteId
      },
      metadata: {
        noteId
      }
    };
  }
  return {
    target: {
      kind: artifactType ? artifactType.toLowerCase() : "artifact_review",
      id: noteId
    },
    metadata: {
      noteId
    }
  };
}

function artifactReviewEventsToCanonical(artifact = {}) {
  const decisions = Array.isArray(artifact.userDecisions) ? artifact.userDecisions : [];
  return decisions.map((decision, index) =>
    artifactDecisionToCanonicalAdoptionEvent(decision, artifact, {
      ...artifactDecisionEventContext(artifact, decision),
      metadata: {
        fromStatus:
          index === 0
            ? "pending_review"
            : cleanText(decisions[index - 1]?.decision) || cleanText(artifact.status),
        toStatus: cleanText(decision.decision),
        ...artifactDecisionEventContext(artifact, decision).metadata
      }
    })
  );
}

function artifactReviewEventsFromArtifact(artifact = {}) {
  return artifactReviewEventsToCanonical(artifact).map((event) => adoptionEventFromCanonical(event));
}

function latestArtifactReviewEventCanonical(artifact = {}) {
  const events = artifactReviewEventsToCanonical(artifact);
  return events[events.length - 1] || null;
}

function suggestionTraceContext(suggestion = {}, artifact = {}) {
  const payload = artifact?.payload && typeof artifact.payload === "object" ? artifact.payload : {};
  const payloadSuggestion =
    payload.fieldSuggestion && typeof payload.fieldSuggestion === "object"
      ? payload.fieldSuggestion
      : payload.field_suggestion && typeof payload.field_suggestion === "object"
        ? payload.field_suggestion
        : {};
  const suggestionTarget = suggestion?.target && typeof suggestion.target === "object" ? suggestion.target : {};
  const payloadTarget = payloadSuggestion.target && typeof payloadSuggestion.target === "object" ? payloadSuggestion.target : {};
  const sourceNoteIds = Array.isArray(artifact.sources?.noteIds)
    ? artifact.sources.noteIds.filter(Boolean)
    : Array.isArray(payload.sourceNoteIds)
      ? payload.sourceNoteIds.filter(Boolean)
      : Array.isArray(payload.source_note_ids)
        ? payload.source_note_ids.filter(Boolean)
        : [];
  const targetNoteId = cleanText(
    suggestionTarget.id ||
      payloadTarget.id ||
      payload.adoptedNoteId ||
      payload.adopted_note_id ||
      payload.targetNoteId ||
      payload.target_note_id
  );
  const targetField = cleanText(
    suggestionTarget.field ||
      payloadTarget.field ||
      payload.targetField ||
      payload.target_field
  );
  const suggestionStatus = cleanText(
    suggestion.status ||
      payloadSuggestion.status
  );
  return {
    sourceNoteIds,
    targetNoteId,
    targetField,
    suggestionStatus
  };
}

function suggestionTraceFromRecord(suggestion = {}, artifact = {}) {
  const traceContext = suggestionTraceContext(suggestion, artifact);
  return {
    suggestionId: cleanText(suggestion.id),
    sourceArtifactId: cleanText(suggestion.sourceArtifactId || suggestion.source_artifact_id || artifact.id),
    primarySourceNoteId: cleanText(traceContext.sourceNoteIds[0]),
    sourceNoteIds: traceContext.sourceNoteIds,
    targetNoteId: traceContext.targetNoteId,
    targetField: traceContext.targetField,
    suggestionStatus: traceContext.suggestionStatus
  };
}

function suggestionTraceToCanonical(trace = {}) {
  return {
    suggestion_id: cleanText(trace.suggestionId || trace.suggestion_id),
    source_artifact_id: cleanText(trace.sourceArtifactId || trace.source_artifact_id),
    primary_source_note_id: cleanText(trace.primarySourceNoteId || trace.primary_source_note_id),
    source_note_ids: Array.isArray(trace.sourceNoteIds || trace.source_note_ids) ? [...(trace.sourceNoteIds || trace.source_note_ids)] : [],
    target_note_id: cleanText(trace.targetNoteId || trace.target_note_id),
    target_field: cleanText(trace.targetField || trace.target_field),
    suggestion_status: cleanText(trace.suggestionStatus || trace.suggestion_status)
  };
}

function assertSuggestionPatchDoesNotRetarget(body = {}) {
  const hasTargetId = cleanText(body.targetId || body.target_id || body.noteId || body.note_id);
  const hasTargetField = cleanText(body.targetField || body.target_field);
  if (!hasTargetId && !hasTargetField) return;
  const error = new Error("suggestion target retargeting is not allowed through the generic suggestion PATCH API");
  error.code = "AI_SUGGESTION_TARGET_IMMUTABLE";
  throw error;
}

async function sourceArtifactForSuggestion(suggestion = {}) {
  const sourceArtifactId = cleanText(suggestion.sourceArtifactId || suggestion.source_artifact_id);
  if (!sourceArtifactId) return null;
  const artifactStore = await aiArtifactStore();
  return artifactStore.getArtifact(sourceArtifactId);
}

async function rejectSuggestionAndLinkedArtifactAtomically({
  suggestionStore,
  artifactStore,
  suggestion,
  nextSuggestion,
  sourceArtifact,
  body = {}
} = {}) {
  if (!suggestionStore?.dbPath || !artifactStore?.dbPath || !sourceArtifact?.id) {
    const originalArtifact = artifactStore.getArtifact(sourceArtifact.id);
    const storedSuggestion = suggestionStore.replace(nextSuggestion, { allowReviewedCreate: true });
    try {
      let syncedArtifact = artifactStore.updateArtifact(sourceArtifact.id, {
        payload: payloadWithRejectedFieldSuggestion(sourceArtifact, nextSuggestion)
      });
      syncedArtifact = artifactStore.recordDecision(sourceArtifact.id, {
        decision: "ignored",
        userId: body.userId || body.user_id || "local_user",
        noteId: cleanText(body.noteId || body.note_id),
        comment: body.comment || "Rejected linked AI suggestion."
      });
      return { item: storedSuggestion, artifact: syncedArtifact };
    } catch (error) {
      suggestionStore.replace(suggestion, { allowReviewedCreate: true });
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
  }

  const DatabaseSync = await loadSqliteDatabaseSync();
  const db = new DatabaseSync(suggestionStore.dbPath);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = ON;");
  const now = new Date().toISOString();
  const nextArtifactPayload = payloadWithRejectedFieldSuggestion(sourceArtifact, nextSuggestion);
  const nextArtifactProvenance = {
    ...(sourceArtifact.provenance || {}),
    humanAccepted: sourceArtifact.provenance?.humanAccepted === true,
    humanRewritten: sourceArtifact.provenance?.humanRewritten === true
  };
  const decisionId = `decision_${randomUUID().slice(0, 8)}`;
  const feedbackJson = JSON.stringify({
    useful: false,
    noisy: false,
    wrong: false,
    alreadyKnown: false,
    privacyConcern: false
  });

  db.exec("BEGIN IMMEDIATE;");
  try {
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

    db.prepare(
      `UPDATE ai_artifacts
       SET status = ?, updated_at = ?, provenance_json = ?, payload_json = ?
       WHERE id = ?`
    ).run(
      "ignored",
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
      decisionId,
      sourceArtifact.id,
      body.userId || body.user_id || "local_user",
      "ignored",
      cleanText(body.noteId || body.note_id),
      body.comment || "Rejected linked AI suggestion.",
      feedbackJson,
      now
    );

    db.exec("COMMIT;");
  } catch (error) {
    db.exec("ROLLBACK;");
    throw error;
  } finally {
    db.close();
  }

  return {
    item: suggestionStore.get(nextSuggestion.id),
    artifact: artifactStore.getArtifact(sourceArtifact.id)
  };
}
function titleForCatalogNote(candidate) {
  const explicit = String(candidate?.title || "").trim();
  if (explicit) return explicit;
  const firstLine = String(candidate?.core_claim || candidate?.quote_text || "")
    .trim()
    .split(/\r?\n/)[0]
    ?.trim();
  return firstLine || String(candidate?.id || "imported-note");
}

async function registerImportCatalogNote(candidate, noteType, writeResult, directoryId = "") {
  if (!writeResult?.written) return null;
  return registerMarkdownNoteInCatalog(VAULT_PATH, {
    noteId: candidate.id,
    noteType,
    title: titleForCatalogNote(candidate),
    status: candidate.status || "draft",
    markdownPath: path.relative(path.resolve(VAULT_PATH), writeResult.path).replaceAll("\\", "/"),
    directoryId: String(directoryId || "").trim() || defaultDirectoryIdForImportNoteType(noteType)
  });
}
const importExportService = createImportExportService({
  getVaultPath: () => VAULT_PATH,
  getCwd: () => CWD,
  importRecords,
  initVault,
  writeSourceIfAbsent,
  writeLiteratureNoteIfAbsent,
  writePermanentNoteIfAbsent,
  deleteNoteById,
  registerImportCatalogNote
});

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

    // Desktop mode: rewrite /mobile/api/* to /api/v1/mobile/*
    if (url.pathname.startsWith("/mobile/api/")) {
      url.pathname = url.pathname.replace("/mobile/api", "/api/v1/mobile");
    }
  const rid = requestId(req);
  let releaseWrite = null;

  try {
    if (!requestMayAccessLan(req, url.pathname)) {
      return sendJson(res, 403, err(
        "LOCAL_API_LAN_FORBIDDEN",
        "This API route is available only on the local computer.",
        rid
      ));
    }
    if (req.method === "OPTIONS") return sendJson(res, 204, {});
    if (isMutatingRequest(req)) {
      releaseWrite = await vaultWriteGate.enter({ bypass: bypassVaultWriteGate(url) });
    }

    if (url.pathname.startsWith("/api/v1/mobile/")) {
      return handleMobileApiRequest({
        req,
        res,
        url,
        sendJson,
        readJson,
        err,
        requestId: rid,
        vaultPath: VAULT_PATH,
        deps: {
          initVault,
          listDirectories,
          listNotesInDirectory,
          listIndexCards,
          searchNotes,
          getNoteById,
          createNoteInDirectory,
          saveNoteAsset,
          updateNoteContent
        },
        assertDesktopControlAllowed: assertLocalRuntimeControlAllowed
      });
    }

    if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/index.html")) {
      return sendHtml(
        res,
        200,
        `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>研思录 API 开发入口</title>
    <meta http-equiv="refresh" content="0; url=${PROTOTYPE_URL}" />
    <style>
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        background: #f3f5f9;
        color: #0f172a;
        font-family: "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
      }
      .card {
        width: min(560px, calc(100vw - 40px));
        padding: 28px 30px;
        border-radius: 18px;
        background: #ffffff;
        box-shadow: 0 18px 48px rgba(15, 23, 42, 0.08);
      }
      h1 {
        margin: 0 0 10px;
        font-size: 24px;
      }
      p {
        margin: 0 0 14px;
        line-height: 1.65;
        color: #475569;
      }
      .actions {
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
        margin-top: 18px;
      }
      a {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 140px;
        padding: 10px 14px;
        border-radius: 10px;
        text-decoration: none;
        font-weight: 600;
      }
      .primary {
        background: #0f172a;
        color: #ffffff;
      }
      .secondary {
        background: #eef2f7;
        color: #0f172a;
      }
      code {
        padding: 2px 6px;
        border-radius: 6px;
        background: #eef2f7;
      }
    </style>
    <script>
      window.location.replace(${JSON.stringify(PROTOTYPE_URL)});
    </script>
  </head>
  <body>
    <div class="card">
      <h1>研思录开发服务已启动</h1>
      <p>你当前打开的是 <code>API 端口 ${PORT}</code>，不是前端原型页。页面会自动跳转到可操作的原型界面。</p>
      <p>如果没有自动跳转，可以手动打开下面的入口。</p>
      <div class="actions">
        <a class="primary" href="${PROTOTYPE_URL}">打开原型界面</a>
        <a class="secondary" href="/health">查看 API 健康状态</a>
        <a class="secondary" href="/api/v1/vault">查看 Vault 信息</a>
      </div>
    </div>
  </body>
</html>`
      );
    }

    if (req.method === "GET" && (url.pathname === "/health" || url.pathname === "/api/v1/health")) {
      const health = await apiHealthPayload();
      return sendJson(res, 200, {
        ...health,
        requestId: rid,
        time: health.timestamp
      });
    }

    if (req.method === "GET" && url.pathname === "/api/v1/app/version") {
      const version = await currentAppVersion();
      const manifestUrl = resolveUpdateManifestUrl(process.env);
      return sendJson(res, 200, {
        item: {
          name: "yansilu",
          version,
          channel: APP_UPDATE_CHANNEL,
          manifestUrl,
          updateStatus: manifestUrl ? "idle" : "disabled",
          updateCheckIntervalHours: 24
        },
        requestId: rid,
        timestamp: new Date().toISOString()
      });
    }

    if (req.method === "POST" && url.pathname === "/api/v1/app/updates/check") {
      const body = await readJson(req).catch(() => ({}));
      const version = await currentAppVersion();
      const configuredManifestUrl = resolveUpdateManifestUrl(process.env);
      const requestedManifestUrl = String(body.manifestUrl || body.manifest_url || "").trim();
      const allowManifestOverride = ["1", "true", "yes", "on"].includes(String(process.env.YANSILU_ALLOW_UPDATE_MANIFEST_OVERRIDE || "").trim().toLowerCase());
      const manifestUrl = allowManifestOverride && requestedManifestUrl ? requestedManifestUrl : configuredManifestUrl;
      const result = await checkForAppUpdate({
        currentVersion: version,
        manifestUrl
      });
      return sendJson(res, 200, {
        item: result,
        requestId: rid,
        timestamp: new Date().toISOString()
      });
    }

    if (req.method === "GET" && url.pathname === "/api/v1/vault") {
      try {
        const layout = await initVault(VAULT_PATH);
        return sendJson(res, 200, {
          item: publicVaultInfo(layout),
          requestId: rid,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        return sendJson(res, 500, err("VAULT_INIT_FAILED", String(error?.message || error), rid));
      }
    }

    if (req.method === "POST" && url.pathname === "/api/v1/vault") {
      const body = await readJson(req);
      const nextVaultPathRaw = String(body.vaultPath || "").trim();
      if (!nextVaultPathRaw) return sendJson(res, 400, err("VAULT_PATH_REQUIRED", "vaultPath required", rid));
      const nextVaultPath = path.resolve(nextVaultPathRaw);
      try {
        const layout = await initVault(nextVaultPath);
        VAULT_PATH = layout.vaultPath;
        AI_SECRET_STATE_PATH = path.resolve(VAULT_PATH, ".yansilu", "ai-secrets.json");
        importRecords.clear();
        aiPreferencesStorePromise = null;
        aiProviderConfigStorePromise = null;
        aiProviderHealthStorePromise = null;
        aiScheduledTaskStorePromise = null;
        aiArtifactStorePromise = null;
        aiSuggestionStorePromise = null;
        return sendJson(res, 200, {
          item: publicVaultInfo(layout),
          requestId: rid,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        return sendJson(res, 400, err("VAULT_SWITCH_FAILED", String(error?.message || error), rid));
      }
    }

    if (req.method === "POST" && url.pathname === "/api/v1/vault/backups") {
      const body = await readJson(req);
      let releaseBackupJob = null;
      try {
        releaseBackupJob = vaultBackupJobGate.enter();
        const version = await currentAppVersion();
        const drain = await vaultWriteGate.pauseAndDrain({ timeoutMs: 15000 });
        await closeVaultScopedStores();
        const item = await createEncryptedVaultBackup({
          vaultPath: VAULT_PATH,
          password: body.password,
          targetDirectory: body.targetDirectory || body.target_directory,
          targetPath: body.targetPath || body.target_path,
          appVersion: version
        });
        return sendJson(res, 201, {
          item: {
            ...item,
            drain,
            message: "Encrypted backup created. Keep the password safe; Yansilu cannot recover it."
          },
          requestId: rid,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        const statusByCode = {
          VAULT_BACKUP_PASSWORD_REQUIRED: 400,
          VAULT_BACKUP_TARGET_REQUIRED: 400,
          VAULT_BACKUP_TARGET_INSIDE_VAULT: 400,
          VAULT_BACKUP_TARGET_INVALID: 400,
          VAULT_BACKUP_WRITES_BUSY: 423,
          VAULT_BACKUP_ALREADY_RUNNING: 423,
          VAULT_BACKUP_TOO_LARGE: 413,
          VAULT_BACKUP_SPACE_NOT_ENOUGH: 507
        };
        const status = error?.status || statusByCode[error?.code] || 500;
        return sendJson(res, status, err(error?.code || "VAULT_BACKUP_CREATE_FAILED", String(error?.message || error), rid, error?.details));
      } finally {
        releaseBackupJob?.();
        vaultWriteGate.resume();
      }
    }

    if (req.method === "POST" && url.pathname === "/api/v1/vault/backups/restore") {
      const body = await readJson(req);
      let releaseBackupJob = null;
      try {
        releaseBackupJob = vaultBackupJobGate.enter();
        const item = await restoreEncryptedVaultBackup({
          backupPath: body.backupPath || body.backup_path,
          password: body.password,
          targetVaultPath: body.targetVaultPath || body.target_vault_path
        });
        return sendJson(res, 201, {
          item: {
            ...item,
            message: "Backup restored to a new vault folder. Open it when you are ready."
          },
          requestId: rid,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        const statusByCode = {
          VAULT_BACKUP_PASSWORD_REQUIRED: 400,
          VAULT_RESTORE_TARGET_REQUIRED: 400,
          VAULT_RESTORE_TARGET_EXISTS: 409,
          VAULT_BACKUP_FILE_REQUIRED: 400,
          VAULT_BACKUP_FILE_NOT_FOUND: 404,
          VAULT_BACKUP_PASSWORD_OR_FILE_INVALID: 400,
          VAULT_BACKUP_FILE_DAMAGED: 400,
          VAULT_BACKUP_FORMAT_UNSUPPORTED: 400,
          VAULT_BACKUP_ALREADY_RUNNING: 423,
          VAULT_RESTORE_SPACE_NOT_ENOUGH: 507
        };
        return sendJson(res, statusByCode[error?.code] || 500, err(error?.code || "VAULT_BACKUP_RESTORE_FAILED", String(error?.message || error), rid, error?.details));
      } finally {
        releaseBackupJob?.();
      }
    }

    if (req.method === "GET" && url.pathname === "/api/v1/ai/preferences") {
      try {
        await initVault(VAULT_PATH);
        const store = await aiPreferencesStore();
        const prefs = store.getUserPreferences({ workspaceId: "local_workspace", userId: "local_user" });
        return sendJson(res, 200, {
          item: prefs,
          requestId: rid,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        return sendJson(res, 500, err("AI_PREFERENCES_LOAD_FAILED", String(error?.message || error), rid));
      }
    }

    if (req.method === "GET" && url.pathname === "/api/v1/ai/local-runtimes/ollama/recovery") {
      try {
        const model = url.searchParams.get("model") || "";
        const runtimeMode = url.searchParams.get("runtimeMode") || url.searchParams.get("runtime_mode") || "";
        const runtime = await buildOllamaModelsPreview();
        const bootstrap = await buildOllamaBootstrapPreview({ model, runtimeMode });
        return sendJson(res, 200, {
          item: {
            runtimeId: "ollama",
            status: bootstrap.status,
            ready: bootstrap.ready,
            nextAction: bootstrap.nextAction,
            message: bootstrap.message,
            runtime,
            bootstrap,
            boundary: {
              externalProcessSafe: true,
              stopsUserProcesses: false,
              canStopManagedSessionOnly: true
            }
          },
          requestId: rid,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        return sendJson(res, error?.status || 500, err("OLLAMA_RECOVERY_PREVIEW_FAILED", String(error?.message || error), rid, error?.details || {}));
      }
    }

    if (req.method === "POST" && url.pathname === "/api/v1/ai/local-runtimes/ollama/recovery") {
      try {
        assertLocalRuntimeControlAllowed(req);
        const body = await readJson(req);
        const item = await bootstrapOllamaLocalAi({
          ...body,
          autoStart: body.autoStart !== false && body.auto_start !== false,
          pullModel: body.pullModel !== false && body.pull_model !== false,
          enableConfig: body.enableConfig !== false && body.enable_config !== false,
          healthCheck: body.healthCheck !== false && body.health_check !== false
        });
        return sendJson(res, 200, {
          item: {
            ...item,
            boundary: {
              externalProcessSafe: true,
              stopsUserProcesses: false,
              canStopManagedSessionOnly: true
            }
          },
          requestId: rid,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        return sendJson(res, error?.status || 502, err("OLLAMA_RECOVERY_FAILED", String(error?.message || error), rid, error?.details || {}));
      }
    }

    if (req.method === "GET" && url.pathname === "/api/v1/ai/local-runtimes/ollama/models") {
      const item = await buildOllamaModelsPreview();
      return sendJson(res, 200, {
        item,
        requestId: rid,
        timestamp: new Date().toISOString()
      });
    }

    if (req.method === "GET" && url.pathname === "/api/v1/ai/local-runtimes/ollama/bootstrap") {
      try {
        const item = await buildOllamaBootstrapPreview({
          model: url.searchParams.get("model") || "",
          runtimeMode: url.searchParams.get("runtimeMode") || url.searchParams.get("runtime_mode") || ""
        });
        return sendJson(res, 200, {
          item,
          requestId: rid,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        return sendJson(res, error?.status || 500, err("OLLAMA_BOOTSTRAP_PREVIEW_FAILED", String(error?.message || error), rid, error?.details || {}));
      }
    }

    if (req.method === "POST" && url.pathname === "/api/v1/ai/local-runtimes/ollama/bootstrap") {
      try {
        assertLocalRuntimeControlAllowed(req);
        const body = await readJson(req);
        const item = await bootstrapOllamaLocalAi(body);
        return sendJson(res, 200, {
          item,
          requestId: rid,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        return sendJson(res, error?.status || 502, err("OLLAMA_BOOTSTRAP_FAILED", String(error?.message || error), rid, error?.details || {}));
      }
    }

    if (req.method === "POST" && url.pathname === "/api/v1/ai/local-runtimes/ollama/start") {
      try {
        assertLocalRuntimeControlAllowed(req);
        const item = await startOllamaRuntime();
        return sendJson(res, 200, {
          item,
          requestId: rid,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        const status = error?.status || (error?.code === "ENOENT" ? 404 : 502);
        return sendJson(res, status, err("OLLAMA_START_FAILED", String(error?.message || error), rid, error?.details || {}));
      }
    }

    if (req.method === "POST" && url.pathname === "/api/v1/ai/local-runtimes/ollama/stop") {
      try {
        assertLocalRuntimeControlAllowed(req);
        const item = await stopOllamaRuntime();
        return sendJson(res, 200, {
          item,
          requestId: rid,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        return sendJson(res, error?.status || 502, err("OLLAMA_STOP_FAILED", String(error?.message || error), rid, error?.details || {}));
      }
    }

    if (req.method === "POST" && url.pathname === "/api/v1/ai/local-runtimes/ollama/pull-model") {
      try {
        assertLocalRuntimeControlAllowed(req);
        const body = await readJson(req);
        const requestedModel = assertAllowedOllamaCatalogModel(body.model || body.modelName || body.model_name);
        const item = await pullOllamaModel(requestedModel);
        if (body.enable === true || body.enable_local === true || body.enableLocal === true) {
          item.enabled = await enableOllamaLocalModel(item.model, {
            runtimeMode: body.runtimeMode || body.runtime_mode
          });
        }
        return sendJson(res, 200, {
          item,
          requestId: rid,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        return sendJson(res, error?.status || 502, err("OLLAMA_PULL_FAILED", String(error?.message || error), rid, error?.details || {}));
      }
    }

    if (req.method === "GET" && url.pathname === "/api/v1/ai/provider-configs") {
      try {
        await initVault(VAULT_PATH);
        const store = await aiProviderConfigStore();
        const items = store.listProviderConfigs({
          status: url.searchParams.get("status") || "",
          limit: url.searchParams.get("limit") || 50
        });
        return sendJson(res, 200, {
          items,
          total: items.length,
          requestId: rid,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        return sendJson(res, 500, err("AI_PROVIDER_CONFIGS_LOAD_FAILED", String(error?.message || error), rid));
      }
    }

    if (req.method === "GET" && url.pathname.startsWith("/api/v1/ai/provider-configs/")) {
      try {
        await initVault(VAULT_PATH);
        const providerId = decodeURIComponent(url.pathname.slice("/api/v1/ai/provider-configs/".length));
        const store = await aiProviderConfigStore();
        const item = store.getProviderConfig({ id: providerId, providerId });
        if (!item) return sendJson(res, 404, err("AI_PROVIDER_CONFIG_NOT_FOUND", "provider config not found", rid));
        return sendJson(res, 200, {
          item,
          requestId: rid,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        return sendJson(res, 500, err("AI_PROVIDER_CONFIG_LOAD_FAILED", String(error?.message || error), rid));
      }
    }

    if (req.method === "POST" && url.pathname === "/api/v1/ai/provider-configs") {
      try {
        await initVault(VAULT_PATH);
        const body = await readJson(req);
        await upsertLocalAiSecrets(body);
        const {
          secrets: _secrets,
          secretValues: _secretValues,
          secret_values: _secret_values,
          deleteSecrets: _deleteSecrets,
          delete_secrets: _delete_secrets,
          ...providerConfigInput
        } = body;
        const store = await aiProviderConfigStore();
        const lookup = cleanText(providerConfigInput.id || providerConfigInput.configId || providerConfigInput.config_id);
        const providerId = cleanText(providerConfigInput.providerId || providerConfigInput.provider_id);
        const existing = (lookup || providerId) ? store.getProviderConfig({ id: lookup, providerId }) : null;
        assertAllowedManagedOllamaProviderConfigInput(providerConfigInput, existing || {});
        const item = store.setProviderConfig(providerConfigInput);
        return sendJson(res, 200, {
          item,
          requestId: rid,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        return sendJson(res, error?.status || 400, err("AI_PROVIDER_CONFIG_SAVE_FAILED", String(error?.message || error), rid, error?.details || {}));
      }
    }

    if (req.method === "POST" && url.pathname.startsWith("/api/v1/ai/provider-configs/") && url.pathname.endsWith("/health-check")) {
      try {
        await initVault(VAULT_PATH);
        const providerId = decodeURIComponent(url.pathname.slice("/api/v1/ai/provider-configs/".length, -"/health-check".length));
        const body = await readJson(req);
        const configStore = await aiProviderConfigStore();
        const providerConfig = configStore.getProviderConfig({ id: providerId, providerId });
        if (!providerConfig) return sendJson(res, 404, err("AI_PROVIDER_CONFIG_NOT_FOUND", "provider config not found", rid));
        const healthStore = await aiProviderHealthStore();
        const result = await runProviderHealthCheck({
          providerConfig: providerConfigWithRunnableHealthCheck(providerConfig, body),
          providerHealthStore: healthStore,
          trigger: "user_command",
          networkEnabled: body.networkEnabled !== false && body.network_enabled !== false
        });
        return sendJson(res, 200, {
          item: {
            status: result.status,
            record: result.record,
            request: result.request
              ? {
                  providerId: result.request.providerId,
                  providerConfigId: result.request.providerConfigId,
                  url: result.request.url,
                  method: result.request.init?.method || "GET",
                  expectedStatus: result.request.expectedStatus,
                  timeoutMs: result.request.timeoutMs
                }
              : null
          },
          requestId: rid,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        return sendJson(res, 400, err("AI_PROVIDER_HEALTH_CHECK_FAILED", String(error?.message || error), rid));
      }
    }

    if (req.method === "GET" && url.pathname === "/api/v1/ai/route-preview") {
      try {
        const item = await buildAiRoutePreview();
        return sendJson(res, 200, {
          item,
          requestId: rid,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        if (error?.code === "AI_PROVIDER_CONFIG_DISABLED") {
          return sendJson(res, 400, err(error.code, String(error?.message || error), rid, error?.details));
        }
        return sendJson(res, error?.status || 400, err("AI_ROUTE_PREVIEW_FAILED", String(error?.message || error), rid, error?.details || {}));
      }
    }

    if (req.method === "POST" && url.pathname === "/api/v1/ai/route-preview") {
      try {
        const body = await readJson(req);
        const item = await buildAiRoutePreview(body);
        return sendJson(res, 200, {
          item,
          requestId: rid,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        if (error?.code === "AI_PROVIDER_CONFIG_DISABLED") {
          return sendJson(res, 400, err(error.code, String(error?.message || error), rid, error?.details));
        }
        return sendJson(res, error?.status || 400, err("AI_ROUTE_PREVIEW_FAILED", String(error?.message || error), rid, error?.details || {}));
      }
    }

    if (req.method === "POST" && url.pathname === "/api/v1/ai/test-chat") {
      let runtime = null;
      try {
        await initVault(VAULT_PATH);
        const body = await readJson(req);
        const localAiSecrets = await upsertLocalAiSecrets(body);
        const store = await aiPreferencesStore();
        const prefs = store.getUserPreferences({ workspaceId: "local_workspace", userId: "local_user" }) || {};
        const baseSettingsInput = preferencesToSettingsInput(prefs);
        const bodyEndpointValue = firstOwnValue(body, ["endpointUrl", "endpoint_url"]);
        const bodySecretRefValue = firstOwnValue(body, ["secretRef", "secret_ref"]);
        const bodyRuntimeModelMap = firstOwnValue(body, ["runtimeModelMap", "runtime_model_map"]);
        const hasBodyEndpointUrl = bodyEndpointValue !== undefined;
        const hasBodySecretRef = bodySecretRefValue !== undefined;
        const hasBodyRuntimeModelMap = bodyRuntimeModelMap !== undefined;

        const settingsInput = {
          ...baseSettingsInput,
          userMode: body.userMode ?? body.user_mode ?? baseSettingsInput.userMode,
          modelPack: body.modelPack ?? body.model_pack ?? baseSettingsInput.modelPack,
          providerPreset: body.providerPreset ?? body.provider_preset ?? baseSettingsInput.providerPreset,
          authMode: body.authMode ?? body.auth_mode ?? baseSettingsInput.authMode,
          secretRef: body.secretRef ?? body.secret_ref ?? baseSettingsInput.secretRef,
          endpointUrl: body.endpointUrl ?? body.endpoint_url ?? baseSettingsInput.endpointUrl,
          modelRef: body.modelRef ?? body.model_ref ?? baseSettingsInput.modelRef,
          runtimeModelMap: hasBodyRuntimeModelMap
            ? mergeRuntimeModelMaps(bodyRuntimeModelMap)
            : mergeRuntimeModelMaps(baseSettingsInput.runtimeModelMap)
        };
        assertAllowedManagedOllamaSettings(settingsInput);

        const baseUserSettings = resolveAiUserSettings(settingsInput);
        const modelTier = body.modelTier ?? body.model_tier ?? "standard";
        const privacyMode = body.privacyMode ?? body.privacy_mode ?? baseUserSettings.privacy?.defaultMode ?? "normal";
        const hybridRoute = settingsForHybridRoute({
          settingsInput,
          userSettings: baseUserSettings,
          input: body,
          agent: { agentId: "test_chat_agent", defaultModelTier: modelTier },
          privacyMode
        });
        const routedSettingsInput = hybridRoute.settingsInput;
        const userSettings = resolveAiUserSettings(routedSettingsInput);
        const providerPreset = String(routedSettingsInput.providerPreset || userSettings.providerPreset || "").trim();
        const configStore = await aiProviderConfigStore();
        const providerConfig = providerPreset ? configStore.getProviderConfig({ providerId: providerPreset }) : null;
        const hasProviderConfigDraft = hasBodyEndpointUrl || hasBodyRuntimeModelMap || hasBodySecretRef;
        if (providerConfig) assertAllowedManagedOllamaProviderConfig(providerConfig);
        let providerSettings = providerConfig ? providerConfigToSettingsInput(providerConfig) : {};
        if (
          providerPreset === "platform_managed_openai" &&
          ((hasBodyEndpointUrl && cleanText(bodyEndpointValue)) || (hasBodyRuntimeModelMap && hasRuntimeModelMapEntries(bodyRuntimeModelMap)))
        ) {
          return sendJson(
            res,
            400,
            err(
              "AI_PROVIDER_CONFIG_INVALID",
              "platform-managed AI does not accept endpointUrl or runtimeModelMap overrides",
              rid
            )
          );
        }
        if (providerPreset && providerPreset !== "platform_managed_openai" && hasProviderConfigDraft) {
          const draftProviderConfigInput = {
            providerId: providerPreset,
            status: "enabled",
            authMode: cleanText(routedSettingsInput.authMode) || providerConfig?.authMode
          };
          if (hasBodySecretRef || cleanText(routedSettingsInput.secretRef)) draftProviderConfigInput.secretRef = routedSettingsInput.secretRef;
          if (hasBodyEndpointUrl || cleanText(routedSettingsInput.endpointUrl)) draftProviderConfigInput.endpointUrl = routedSettingsInput.endpointUrl;
          if (hasBodyRuntimeModelMap || hasRuntimeModelMapEntries(routedSettingsInput.runtimeModelMap)) {
            draftProviderConfigInput.runtimeModelMap = routedSettingsInput.runtimeModelMap;
          }
          assertAllowedManagedOllamaProviderConfigDraft(draftProviderConfigInput, settingsInput);
          const draftProviderConfig = assertValidAiProviderConfig(draftProviderConfigInput, providerConfig || {});
          providerSettings = providerConfigToSettingsInput(draftProviderConfig);
        }
        if (!hasProviderConfigDraft && cleanText(providerConfig?.status || providerConfig?.status_text) === "disabled") {
          return sendJson(res, 400, err("AI_PROVIDER_CONFIG_DISABLED", "AI provider config is disabled.", rid, {
            providerId: providerPreset,
            providerConfigId: providerConfig?.id || providerConfig?.configId || providerConfig?.config_id
          }));
        }
        const mergedSettings = mergeSettingsWithProviderSettings(routedSettingsInput, providerSettings, {
          hasSecretRef: hasBodySecretRef,
          hasEndpointUrl: hasBodyEndpointUrl,
          hasRuntimeModelMap: hasBodyRuntimeModelMap
        });
        mergedSettings.modelRef = cleanText(routedSettingsInput.modelRef) || providerSettings.modelRef;

        const providerDescriptor = resolveProviderDescriptor(mergedSettings);
        const modelRoute = resolveModelRoute({
          ...mergedSettings,
          providerDescriptor,
          userMode: userSettings.userMode,
          modelTier,
          privacyMode
        });

        runtime = await createAiHarnessRuntime({
          storageMode: "sqlite",
          vaultPath: VAULT_PATH,
          tools: createCoreNoteTools({ vaultPath: VAULT_PATH }),
          useOpenAiCompatibleAdapter: true,
          networkEnabled: true,
          createExecutor: true,
          secrets: localAiSecrets
        });

        const adapterSelection = runtime.providerAdapterRegistry.getAdapter({
          ...mergedSettings,
          providerDescriptor
        });
        const providerAdapter = adapterSelection.adapter;

        const prompt = String(body.prompt || "").trim();
        if (!prompt) return sendJson(res, 400, err("AI_TEST_PROMPT_REQUIRED", "prompt is required", rid));

        const response = await providerAdapter.complete({
          requestId: `${rid}_test_chat`,
          agentRunId: rid,
          purpose: "test_chat",
          providerDescriptor,
          modelRoute,
          modelRef: modelRoute.modelRef,
          messages: [
            { role: "system", content: "You are a helpful local assistant for note-taking and knowledge work." },
            { role: "user", content: prompt }
          ],
          tools: [],
          output: { mode: "text" },
          settings: { stream: false, temperature: body.temperature },
          policy: {
            privacyMode: modelRoute.privacyMode,
            allowCloud: modelRoute.cloudAllowed,
            allowFallback: modelRoute.fallbackPolicy.allowSameProviderFallback,
            modelRoute,
            budgetPrecheck: { ok: true, confirmationRequired: false, estimatedUsage: { estimatedCost: 0, currency: "USD" } }
          }
        });
        assertProviderResponseSucceeded(response, "AI_TEST_CHAT_PROVIDER_FAILED");

        return sendJson(res, 200, {
          item: {
            providerId: response.providerId,
            modelRef: response.modelRef,
            status: response.status,
            output: response.output,
            usage: response.usage
          },
          requestId: rid,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        return sendJson(res, 400, err(error?.code || "AI_TEST_CHAT_FAILED", String(error?.message || error), rid, error?.details));
      } finally {
        if (runtime && typeof runtime.close === "function") runtime.close();
      }
    }

    if (req.method === "POST" && url.pathname === "/api/v1/ai/preferences") {
      try {
        await initVault(VAULT_PATH);
        const body = await readJson(req);
        const store = await aiPreferencesStore();
        const preferencesInput = {
          workspaceId: "local_workspace",
          userId: "local_user",
          userMode: body.userMode ?? body.user_mode,
          modelPack: body.modelPack ?? body.model_pack,
          monthlyBudget: body.monthlyBudget ?? body.monthly_budget,
          confirmationThreshold: body.confirmationThreshold ?? body.confirmation_threshold,
          fallbackPolicy: body.fallbackPolicy ?? body.fallback_policy,
          privacy: body.privacy,
          budget: body.budget,
          budgetState: body.budgetState ?? body.budget_state,
          advancedSettings: body.advancedSettings ?? body.advanced_settings
        };
        assertAllowedManagedOllamaSettings(preferencesInput);
        const updated = store.setUserPreferences(preferencesInput);
        return sendJson(res, 200, {
          item: updated,
          requestId: rid,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        return sendJson(res, error?.status || 400, err("AI_PREFERENCES_SAVE_FAILED", String(error?.message || error), rid, error?.details || {}));
      }
    }

    if (req.method === "GET" && url.pathname === "/api/v1/ai/inbox") {
      try {
        await initVault(VAULT_PATH);
        const artifactStore = await aiArtifactStore();
        const inbox = createAiInbox({ artifactStore });
        const filter = {
          view: url.searchParams.get("view") || "pending",
          type: url.searchParams.get("type") || url.searchParams.get("artifactType") || "",
          sourceNoteId: url.searchParams.get("sourceNoteId") || url.searchParams.get("source_note_id") || "",
          privacyMode: url.searchParams.get("privacyMode") || url.searchParams.get("privacy_mode") || "",
          limit: url.searchParams.get("limit") || 50
        };
        const items = inbox.listItems(filter);
        return sendJson(res, 200, withCanonical({
          items,
          total: items.length,
          counts: inbox.counts(filter),
          views: inbox.views(),
          requestId: rid,
          timestamp: new Date().toISOString()
        }, wantsCanonical(url) ? {
          items: items.map((item) => aiInboxItemToCanonical(item))
        } : null));
      } catch (error) {
        return sendJson(res, 400, err(error?.code || "AI_INBOX_LOAD_FAILED", String(error?.message || error), rid));
      }
    }

    if (req.method === "GET" && url.pathname === "/api/v1/ai/inbox/evaluation-summary") {
      try {
        await initVault(VAULT_PATH);
        const artifactStore = await aiArtifactStore();
        const inbox = createAiInbox({ artifactStore });
        const filter = {
          view: url.searchParams.get("view") || "all",
          type: url.searchParams.get("type") || url.searchParams.get("artifactType") || "",
          sourceNoteId: url.searchParams.get("sourceNoteId") || url.searchParams.get("source_note_id") || "",
          privacyMode: url.searchParams.get("privacyMode") || url.searchParams.get("privacy_mode") || ""
        };
        return sendJson(res, 200, {
          item: inbox.evaluationSummary(filter),
          requestId: rid,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        return sendJson(res, 400, err(error?.code || "AI_INBOX_EVALUATION_SUMMARY_FAILED", String(error?.message || error), rid));
      }
    }

    if (req.method === "GET" && url.pathname === "/api/v1/ai-suggestions") {
      try {
        await initVault(VAULT_PATH);
        const store = await aiSuggestionStore();
        const items = store.list({
          status: url.searchParams.get("status") || "all",
          targetType: url.searchParams.get("targetType") || url.searchParams.get("target_type") || "",
          targetId: url.searchParams.get("targetId") || url.searchParams.get("target_id") || "",
          sourceArtifactId: url.searchParams.get("sourceArtifactId") || url.searchParams.get("source_artifact_id") || "",
          scope: url.searchParams.get("scope") || "",
          limit: Number(url.searchParams.get("limit") || 50)
        });
        const readableItems = await suggestionsWithReadableTargets(items);
        return sendJson(res, 200, withCanonical({
          items: readableItems,
          total: readableItems.length,
          requestId: rid,
          timestamp: new Date().toISOString()
        }, wantsCanonical(url) ? {
          items: readableItems.map((item) => suggestionToCanonical(item))
        } : null));
      } catch (error) {
        return sendJson(res, 400, err(error?.code || "AI_SUGGESTION_LIST_FAILED", String(error?.message || error), rid, error?.details));
      }
    }

    if (req.method === "POST" && url.pathname === "/api/v1/ai-suggestions") {
      const body = await readJson(req);
      try {
        await initVault(VAULT_PATH);
        const store = await aiSuggestionStore();
        const item = await suggestionWithReadableTarget(store.create(body, { now: new Date().toISOString() }));
        return sendJson(res, 201, withCanonical({
          item,
          requestId: rid,
          timestamp: new Date().toISOString()
        }, wantsCanonical(url) ? {
          item: suggestionToCanonical(item)
        } : null));
      } catch (error) {
        return sendJson(res, 400, err(error?.code || "AI_SUGGESTION_CREATE_FAILED", String(error?.message || error), rid, error?.details));
      }
    }

    const aiSuggestionId = parseAiSuggestionPath(url.pathname);
    if (req.method === "GET" && aiSuggestionId) {
      try {
        await initVault(VAULT_PATH);
        const store = await aiSuggestionStore();
        const item = await suggestionWithReadableTarget(store.get(aiSuggestionId));
        if (!item) return sendJson(res, 404, err("AI_SUGGESTION_NOT_FOUND", `suggestionId not found: ${aiSuggestionId}`, rid));
        const sourceArtifact = await sourceArtifactForSuggestion(item);
        const projectedArtifact = artifactWithProjectedSuggestionState(sourceArtifact, item);
        const reviewEvents = suggestionReviewEventsFromSuggestion(item);
        const latestReviewEvent = latestSuggestionReviewEventFromSuggestion(item);
        const trace = suggestionTraceFromRecord(item, sourceArtifact || {});
        return sendJson(res, 200, withCanonical({
          item,
          artifact: projectedArtifact || null,
          reviewEvents,
          latestReviewEvent,
          trace,
          requestId: rid,
          timestamp: new Date().toISOString()
        }, wantsCanonical(url) ? {
          item: suggestionToCanonical(item),
          ...(projectedArtifact ? { artifact: artifactToCanonical(projectedArtifact) } : {}),
          review_events: suggestionReviewEventsToCanonical(item),
          latest_review_event: latestSuggestionReviewEventToCanonical(item),
          trace: suggestionTraceToCanonical(trace)
        } : null));
      } catch (error) {
        return sendJson(res, 400, err(error?.code || "AI_SUGGESTION_LOAD_FAILED", String(error?.message || error), rid, error?.details));
      }
    }

    if (req.method === "PATCH" && aiSuggestionId) {
      const body = await readJson(req);
      try {
        await initVault(VAULT_PATH);
        const store = await aiSuggestionStore();
        const toStatus = body.status || body.toStatus || body.to_status;
        const existingItem = store.get(aiSuggestionId);
        if (!existingItem) return sendJson(res, 404, err("AI_SUGGESTION_NOT_FOUND", `suggestionId not found: ${aiSuggestionId}`, rid));
        const sourceArtifact = await sourceArtifactForSuggestion(existingItem);
        const nextItem = transitionSuggestionStatus(existingItem, toStatus, body);
        let syncedArtifact = null;
        let item = null;
        if (cleanText(toStatus) === "rejected" && sourceArtifact) {
          const artifactStore = await aiArtifactStore();
          const rejected = await rejectSuggestionAndLinkedArtifactAtomically({
            suggestionStore: store,
            artifactStore,
            suggestion: existingItem,
            nextSuggestion: nextItem,
            sourceArtifact,
            body
          });
          item = await suggestionWithReadableTarget(rejected.item);
          syncedArtifact = rejected.artifact;
        } else {
          item = await suggestionWithReadableTarget(store.transition(aiSuggestionId, toStatus, body));
        }
        const finalSourceArtifact = syncedArtifact || (await sourceArtifactForSuggestion(item));
        const projectedArtifact = artifactWithProjectedSuggestionState(finalSourceArtifact, item);
        if (!syncedArtifact && finalSourceArtifact?.id && projectedArtifact) {
          const artifactStore = await aiArtifactStore();
          artifactStore.updateArtifact(finalSourceArtifact.id, {
            status: projectedArtifact.status,
            payload: projectedArtifact.payload,
            provenance: projectedArtifact.provenance,
            updatedAt: item.updatedAt || new Date().toISOString()
          });
        }
        const reviewEvents = suggestionReviewEventsFromSuggestion(item);
        const latestReviewEvent = latestSuggestionReviewEventFromSuggestion(item);
        const trace = suggestionTraceFromRecord(item, finalSourceArtifact || {});
        return sendJson(res, 200, withCanonical({
          item,
          artifact: projectedArtifact || null,
          reviewEvents,
          latestReviewEvent,
          trace,
          requestId: rid,
          timestamp: new Date().toISOString()
        }, wantsCanonical(url) ? {
          item: suggestionToCanonical(item),
          ...(projectedArtifact ? { artifact: artifactToCanonical(projectedArtifact) } : {}),
          review_events: suggestionReviewEventsToCanonical(item),
          latest_review_event: latestSuggestionReviewEventToCanonical(item),
          trace: suggestionTraceToCanonical(trace)
        } : null));
      } catch (error) {
        const status = error?.code === "AI_SUGGESTION_NOT_FOUND" ? 404 : 400;
        return sendJson(res, status, err(error?.code || "AI_SUGGESTION_UPDATE_FAILED", String(error?.message || error), rid, error?.details));
      }
    }

    const aiInboxDecisionId = parseAiInboxDecisionPath(url.pathname);
    if (req.method === "POST" && aiInboxDecisionId) {
      try {
        await initVault(VAULT_PATH);
        const body = await readJson(req);
        const artifactStore = await aiArtifactStore();
        const existingArtifact = artifactStore.getArtifact(aiInboxDecisionId);
        if (!existingArtifact) return sendJson(res, 404, err("AI_ARTIFACT_NOT_FOUND", "artifact not found", rid));
        const decision = normalizeAiInboxDecision(body);
        assertReviewDecision(decision);
        const existingLatestDecision = Array.isArray(existingArtifact.userDecisions)
          ? existingArtifact.userDecisions[existingArtifact.userDecisions.length - 1] || null
          : null;
        if (
          ["accepted", "revised", "ignored", "archived"].includes(decision) &&
          existingLatestDecision?.decision === decision &&
          sameAiInboxDecisionPayload(existingLatestDecision, body)
        ) {
          const inbox = createAiInbox({ artifactStore });
          const item = inbox.getItem(aiInboxDecisionId);
          const latestDecision = item?.latestDecision || existingLatestDecision;
          const latestDecisionCanonical = latestArtifactReviewEventCanonical(existingArtifact);
          return sendJson(res, 200, withCanonical({
            item,
            artifact: existingArtifact,
            latestDecision,
            requestId: rid,
            timestamp: new Date().toISOString()
          }, wantsCanonical(url) ? {
            item: item ? aiInboxItemToCanonical(item) : null,
            artifact: artifactToCanonical(existingArtifact),
            latestDecision: latestDecisionCanonical
          } : null));
        }
        if (
          existingArtifact.status !== "pending_review" &&
          existingLatestDecision?.decision &&
          existingLatestDecision.decision !== decision
        ) {
          return sendJson(
            res,
            409,
            err("AI_INBOX_DECISION_CONFLICT", "artifact review state has changed; reload the inbox item before submitting a different decision", rid, {
              artifactId: aiInboxDecisionId,
              currentStatus: existingArtifact.status,
              latestDecision: existingLatestDecision.decision,
              requestedDecision: decision
            })
          );
        }
        const artifact = artifactStore.recordDecision(aiInboxDecisionId, {
          ...body,
          decision,
          userId: body.userId || body.user_id || "local_user"
        });
        const inbox = createAiInbox({ artifactStore });
        const item = inbox.getItem(aiInboxDecisionId);
        const latestDecision = item?.latestDecision || null;
        return sendJson(res, 200, withCanonical({
          item,
          artifact,
          latestDecision,
          requestId: rid,
          timestamp: new Date().toISOString()
        }, wantsCanonical(url) ? {
          item: item ? aiInboxItemToCanonical(item) : null,
          artifact: artifact ? artifactToCanonical(artifact) : null,
          latestDecision: latestDecision
            ? artifactDecisionToCanonicalAdoptionEvent(latestDecision, artifact, {
                metadata: {
                  fromStatus: existingArtifact.status
                }
              })
            : null
        } : null));
      } catch (error) {
        const status = error?.code === "AI_ARTIFACT_NOT_FOUND" ? 404 : 400;
        return sendJson(res, status, err(error?.code || "AI_INBOX_DECISION_FAILED", String(error?.message || error), rid));
      }
    }

    const aiInboxAcceptLinkId = parseAiInboxAcceptLinkPath(url.pathname);
    if (req.method === "POST" && aiInboxAcceptLinkId) {
      try {
        await initVault(VAULT_PATH);
        const body = await readJson(req);
        if (!hasExplicitConfirmation(body)) {
          return sendJson(
            res,
            400,
            err("AI_LINK_SUGGESTION_CONFIRMATION_REQUIRED", "confirm: true is required before creating a note relation", rid)
          );
        }

        const artifactStore = await aiArtifactStore();
        const existingArtifact = artifactStore.getArtifact(aiInboxAcceptLinkId);
        if (!existingArtifact) return sendJson(res, 404, err("AI_ARTIFACT_NOT_FOUND", "artifact not found", rid));

        const relationInput = relationInputFromLinkSuggestion(existingArtifact, body);
        const accepted = await acceptLinkAndRecordArtifactDecisionAtomically({
          artifactStore,
          artifactId: aiInboxAcceptLinkId,
          body,
          createRelation: () => createNoteRelation(VAULT_PATH, {
            ...relationInput,
            createdBy: "user"
          }),
          deleteRelation: (relationId) => deleteNoteRelation(VAULT_PATH, relationId)
        });
        const relation = accepted.relation;
        const artifact = accepted.artifact;
        const inbox = createAiInbox({ artifactStore });
        const item = inbox.getItem(aiInboxAcceptLinkId);
        const latestDecision = item?.latestDecision || null;
        return sendJson(res, 200, withCanonical({
          item,
          artifact,
          relation,
          latestDecision,
          requestId: rid,
          timestamp: new Date().toISOString()
        }, wantsCanonical(url) ? {
          item: item ? aiInboxItemToCanonical(item) : null,
          artifact: artifact ? artifactToCanonical(artifact) : null,
          latestDecision: latestDecision
            ? artifactDecisionToCanonicalAdoptionEvent(latestDecision, artifact, {
                target: {
                  kind: "relation",
                  id: relation.id
                },
                metadata: {
                  fromStatus: existingArtifact.status,
                  noteId: relation.fromNoteId
                }
              })
            : null
        } : null));
      } catch (error) {
        const status = error?.code === "AI_ARTIFACT_NOT_FOUND" ? 404 : 400;
        return sendJson(res, status, err(error?.code || "AI_LINK_SUGGESTION_ACCEPT_FAILED", String(error?.message || error), rid));
      }
    }

    const aiInboxPromoteNoteId = parseAiInboxPromoteNotePath(url.pathname);
    if (req.method === "POST" && aiInboxPromoteNoteId) {
      try {
        await initVault(VAULT_PATH);
        const body = await readJson(req);
        if (!hasExplicitConfirmation(body)) {
          return sendJson(
            res,
            400,
            err("AI_NOTE_PROMOTION_CONFIRMATION_REQUIRED", "confirm: true is required before creating a draft note", rid)
          );
        }

        const artifactStore = await aiArtifactStore();
        const existingArtifact = artifactStore.getArtifact(aiInboxPromoteNoteId);
        if (!existingArtifact) return sendJson(res, 404, err("AI_ARTIFACT_NOT_FOUND", "artifact not found", rid));
        const existingPromotion = latestPromotedNoteDecision(existingArtifact);
        if (existingPromotion) {
          const promotedNoteId = cleanText(existingPromotion.noteId || existingPromotion.note_id);
          if (promotedNoteId) {
            const note = await getNoteById(VAULT_PATH, promotedNoteId);
            const inbox = createAiInbox({ artifactStore });
            const item = inbox.getItem(aiInboxPromoteNoteId);
            const latestDecision = item?.latestDecision || existingPromotion;
            const latestDecisionCanonical = latestArtifactReviewEventCanonical(existingArtifact);
            return sendJson(res, 200, withCanonical({
              item,
              artifact: existingArtifact,
              note,
              latestDecision,
              requestId: rid,
              timestamp: new Date().toISOString()
            }, wantsCanonical(url) ? {
              item: item ? aiInboxItemToCanonical(item) : null,
              artifact: artifactToCanonical(existingArtifact),
              latestDecision: latestDecisionCanonical
            } : null));
          }
        }

        const noteInput = promoteNoteInputFromArtifact(existingArtifact, body);
        const promoted = await promoteNoteAndRecordArtifactDecisionAtomically({
          artifactStore,
          artifactId: aiInboxPromoteNoteId,
          body: {
            ...body,
            comment: body.comment || `Promoted ${existingArtifact.type} into draft note.`
          },
          createDraftNote: () => createNoteInDirectory(VAULT_PATH, noteInput),
          deleteDraftNote: (noteId) => deleteNoteById(VAULT_PATH, noteId)
        });
        const note = promoted.note;
        const artifact = promoted.artifact;
        const inbox = createAiInbox({ artifactStore });
        const item = inbox.getItem(aiInboxPromoteNoteId);
        const latestDecision = item?.latestDecision || null;
        return sendJson(res, 201, withCanonical({
          item,
          artifact,
          note,
          latestDecision,
          requestId: rid,
          timestamp: new Date().toISOString()
        }, wantsCanonical(url) ? {
          item: item ? aiInboxItemToCanonical(item) : null,
          artifact: artifact ? artifactToCanonical(artifact) : null,
          latestDecision: latestDecision
            ? artifactDecisionToCanonicalAdoptionEvent(latestDecision, artifact, {
                target: {
                  kind: "note",
                  id: note.id
                },
                metadata: {
                  fromStatus: existingArtifact.status,
                  noteId: note.id
                }
              })
            : null
        } : null));
      } catch (error) {
        const status = error?.code === "AI_ARTIFACT_NOT_FOUND" ? 404 : error?.code === "AI_ARTIFACT_ALREADY_PROMOTED" ? 409 : 400;
        return sendJson(res, status, err(error?.code || "AI_NOTE_PROMOTION_FAILED", String(error?.message || error), rid, error?.details));
      }
    }

    const aiInboxAdoptFieldSuggestionId = parseAiInboxAdoptFieldSuggestionPath(url.pathname);
    if (req.method === "POST" && aiInboxAdoptFieldSuggestionId) {
      try {
        await initVault(VAULT_PATH);
        const body = await readJson(req);
        if (!hasExplicitConfirmation(body)) {
          return sendJson(
            res,
            400,
            err("AI_FIELD_SUGGESTION_CONFIRMATION_REQUIRED", "confirm: true is required before adopting a field suggestion", rid)
          );
        }

        const artifactStore = await aiArtifactStore();
        const existingArtifact = artifactStore.getArtifact(aiInboxAdoptFieldSuggestionId);
        if (!existingArtifact) return sendJson(res, 404, err("AI_ARTIFACT_NOT_FOUND", "artifact not found", rid));
        const existingAdoption = (Array.isArray(existingArtifact.userDecisions) ? existingArtifact.userDecisions : [])
          .slice()
          .reverse()
          .find((decision) => decision?.decision === "adopted_as_draft");
        if (existingAdoption) {
          const adoptedNoteId = cleanText(
            existingAdoption.noteId ||
              existingAdoption.note_id ||
              existingArtifact.payload?.adoptedNoteId ||
              existingArtifact.payload?.adopted_note_id
          );
          if (adoptedNoteId) {
            const adoptedNote = await getNoteById(VAULT_PATH, adoptedNoteId);
            const suggestionId = fieldSuggestionIdFromArtifactPayload(existingArtifact);
            const suggestionStore = suggestionId ? await aiSuggestionStore() : null;
            const suggestion = suggestionId ? suggestionStore.get(suggestionId) : null;
            const inbox = createAiInbox({ artifactStore });
            const item = inbox.getItem(aiInboxAdoptFieldSuggestionId);
            const latestDecision = item?.latestDecision || existingAdoption;
            const latestDecisionCanonical = latestArtifactReviewEventCanonical(existingArtifact);
            const targetField = cleanText(
              existingArtifact.payload?.targetField ||
                existingArtifact.payload?.target_field ||
                existingArtifact.payload?.fieldSuggestion?.target?.field ||
                existingArtifact.payload?.field_suggestion?.target?.field
            );
            return sendJson(res, 200, withCanonical({
              item,
              artifact: existingArtifact,
              suggestion,
              note: adoptedNote,
              adoptedField: targetField,
              adoptedValue: targetField === "thesis"
                ? { thesis: adoptedNote.thesis || "" }
                : { threeLineSummary: Array.isArray(adoptedNote.threeLineSummary) ? adoptedNote.threeLineSummary : [] },
              latestDecision,
              requestId: rid,
              timestamp: new Date().toISOString()
            }, wantsCanonical(url) ? {
              item: item ? aiInboxItemToCanonical(item) : null,
              artifact: artifactToCanonical(existingArtifact),
              suggestion: suggestion ? suggestionToCanonical(suggestion) : null,
              latestDecision: latestDecisionCanonical
            } : null));
          }
        }

        const fieldSuggestion = fieldSuggestionInputFromArtifact(existingArtifact, body);
        const note = await getNoteById(VAULT_PATH, fieldSuggestion.noteId);
        if (note.noteType !== "permanent") {
          return sendJson(
            res,
            400,
            err("AI_FIELD_SUGGESTION_TARGET_INVALID", "field suggestions can only be adopted into permanent notes", rid, {
              noteId: fieldSuggestion.noteId,
              noteType: note.noteType
            })
          );
        }
        if (fieldSuggestion.field === "thesis" && cleanText(note.thesis) && cleanText(note.thesis) !== cleanText(fieldSuggestion.update.thesis)) {
          fieldSuggestion.update.thesisChangeReason = cleanText(body.comment) || "采纳 AI 建议作为待确认草稿。";
          fieldSuggestion.update.viewpointChangeSourceNoteIds = Array.isArray(existingArtifact.sources?.noteIds)
            ? existingArtifact.sources.noteIds.filter((noteId) => cleanText(noteId) && cleanText(noteId) !== fieldSuggestion.noteId)
            : [];
          fieldSuggestion.update.viewpointChangeStatus = "draft";
        }
        const suggestionId = fieldSuggestionIdFromArtifactPayload(existingArtifact);
        const suggestionStore = suggestionId ? await aiSuggestionStore() : null;
        const adoption = await adoptSuggestionAndLinkedArtifactAtomically({
          suggestionStore,
          artifactStore,
          sourceArtifact: existingArtifact,
          fieldSuggestion,
          body,
          originalNote: note,
          applyNoteUpdate: () => updateNoteContent(VAULT_PATH, fieldSuggestion.noteId, fieldSuggestion.update),
          restoreNote: (input) => updateNoteContent(VAULT_PATH, fieldSuggestion.noteId, input),
          buildAdoptedArtifactPayload: payloadWithAdoptedFieldSuggestion,
          getSuggestionIdFromArtifact: fieldSuggestionIdFromArtifactPayload,
          loadSqliteDatabaseSync
        });
        const updatedNote = adoption.note;
        const artifact = adoption.artifact;
        const suggestion = adoption.suggestion;
        const inbox = createAiInbox({ artifactStore });
        const item = inbox.getItem(aiInboxAdoptFieldSuggestionId);
        const latestDecision = item?.latestDecision || null;
        return sendJson(res, 200, withCanonical({
          item,
          artifact,
          suggestion,
          note: updatedNote,
          adoptedField: fieldSuggestion.field,
          adoptedValue: fieldSuggestion.adoptedValue,
          latestDecision,
          requestId: rid,
          timestamp: new Date().toISOString()
        }, wantsCanonical(url) ? {
          item: item ? aiInboxItemToCanonical(item) : null,
          artifact: artifact ? artifactToCanonical(artifact) : null,
          ...(suggestion ? { suggestion: suggestionToCanonical(suggestion) } : {}),
          latestDecision: latestDecision
            ? artifactDecisionToCanonicalAdoptionEvent(latestDecision, artifact, {
                target: {
                  kind: "permanent_note",
                  id: updatedNote.id,
                  field: fieldSuggestion.field
                },
                metadata: {
                  fromStatus: existingArtifact.status,
                  noteId: updatedNote.id
                }
              })
            : null
        } : null));
      } catch (error) {
        const status =
          error?.code === "AI_ARTIFACT_NOT_FOUND" || error?.code === "NOTE_NOT_FOUND" || error?.code === "AI_SUGGESTION_NOT_FOUND"
            ? 404
            : error?.code === "AI_FIELD_SUGGESTION_ALREADY_ADOPTED"
              ? 409
              : 400;
        return sendJson(res, status, err(error?.code || "AI_FIELD_SUGGESTION_ADOPT_FAILED", String(error?.message || error), rid, error?.details));
      }
    }

    const aiInboxItemId = parseAiInboxItemPath(url.pathname);
    if (req.method === "GET" && aiInboxItemId) {
      try {
        await initVault(VAULT_PATH);
        const artifactStore = await aiArtifactStore();
        const artifact = artifactStore.getArtifact(aiInboxItemId);
        if (!artifact) return sendJson(res, 404, err("AI_ARTIFACT_NOT_FOUND", "artifact not found", rid));
        const inbox = createAiInbox({ artifactStore });
        const item = inbox.getItem(aiInboxItemId);
        const suggestionId = fieldSuggestionIdFromArtifactPayload(artifact);
        const suggestionStore = suggestionId ? await aiSuggestionStore() : null;
        const suggestion = suggestionId ? suggestionStore.get(suggestionId) : null;
        const projectedArtifact = suggestion ? artifactWithProjectedSuggestionState(artifact, suggestion) : artifact;
        const suggestionReviewEvents = suggestion
          ? suggestionReviewEventsFromSuggestion(suggestion)
          : degradedSuggestionReviewEventsFromArtifact(projectedArtifact);
        const latestSuggestionReviewEvent = suggestion
          ? latestSuggestionReviewEventFromSuggestion(suggestion)
          : degradedLatestSuggestionReviewEventFromArtifact(projectedArtifact);
        const trace = suggestion ? suggestionTraceFromRecord(suggestion, projectedArtifact || artifact) : degradedSuggestionTraceFromArtifact(artifact);
        return sendJson(res, 200, withCanonical({
          item,
          artifact: projectedArtifact,
          suggestion: suggestion || reviewedEmbeddedSuggestionFromArtifact(projectedArtifact),
          suggestionReviewEvents,
          latestSuggestionReviewEvent,
          trace,
          requestId: rid,
          timestamp: new Date().toISOString()
        }, wantsCanonical(url) ? {
          item: item ? aiInboxItemToCanonical(item) : null,
          artifact: projectedArtifact ? artifactToCanonical(projectedArtifact) : null,
          suggestion: suggestion ? suggestionToCanonical(suggestion) : canonicalEmbeddedSuggestionFromArtifact(projectedArtifact),
          suggestion_review_events: suggestion
            ? suggestionReviewEventsToCanonical(suggestion)
            : degradedSuggestionReviewEventsToCanonical(projectedArtifact),
          latest_suggestion_review_event: suggestion
            ? latestSuggestionReviewEventToCanonical(suggestion)
            : degradedLatestSuggestionReviewEventToCanonical(projectedArtifact),
          trace: trace ? suggestionTraceToCanonical(trace) : null
        } : null));
      } catch (error) {
        return sendJson(res, 500, err("AI_INBOX_ITEM_LOAD_FAILED", String(error?.message || error), rid));
      }
    }

    if (req.method === "GET" && url.pathname === "/api/v1/ai/scheduled-task-templates") {
      try {
        const implementationReady = url.searchParams.has("implementationReady")
          ? url.searchParams.get("implementationReady") === "true"
          : undefined;
        const items = listScheduledAgentTaskTemplates({ implementationReady });
        return sendJson(res, 200, {
          items,
          total: items.length,
          requestId: rid,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        return sendJson(res, 500, err("AI_SCHEDULED_TASK_TEMPLATES_LOAD_FAILED", String(error?.message || error), rid));
      }
    }

    if (req.method === "GET" && url.pathname === "/api/v1/ai/scheduled-tasks") {
      try {
        await initVault(VAULT_PATH);
        const store = await aiScheduledTaskStore();
        const items = store.listScheduledTasks({
          workspaceId: "local_workspace",
          userId: "local_user",
          status: url.searchParams.get("status") || "",
          taskType: url.searchParams.get("taskType") || url.searchParams.get("task_type") || "",
          limit: url.searchParams.get("limit") || 50
        });
        return sendJson(res, 200, withCanonical({
          items,
          total: items.length,
          requestId: rid,
          timestamp: new Date().toISOString()
        }, wantsCanonical(url) ? {
          items: items.map((item) => scheduledTaskToCanonical(item))
        } : null));
      } catch (error) {
        return sendJson(res, 500, err("AI_SCHEDULED_TASKS_LOAD_FAILED", String(error?.message || error), rid));
      }
    }

    if (req.method === "POST" && url.pathname === "/api/v1/ai/scheduled-tasks") {
      try {
        await initVault(VAULT_PATH);
        const body = await readJson(req);
        const store = await aiScheduledTaskStore();
        const input = {
          ...body,
          workspaceId: "local_workspace",
          userId: "local_user"
        };
        const item = body.templateId || body.template_id ? store.upsertScheduledTask(createScheduledTaskFromTemplate(input)) : store.upsertScheduledTask(input);
        return sendJson(res, 201, withCanonical({
          item,
          requestId: rid,
          timestamp: new Date().toISOString()
        }, wantsCanonical(url) ? {
          item: scheduledTaskToCanonical(item)
        } : null));
      } catch (error) {
        return sendJson(res, 400, err(error?.code || "AI_SCHEDULED_TASK_SAVE_FAILED", String(error?.message || error), rid));
      }
    }

    if (req.method === "POST" && url.pathname === "/api/v1/ai/scheduled-tasks/run-due") {
      let runtime = null;
      try {
        await initVault(VAULT_PATH);
        const body = await readJson(req);
        runtime = await createAiHarnessRuntime({
          storageMode: "sqlite",
          vaultPath: VAULT_PATH,
          tools: createCoreNoteTools({ vaultPath: VAULT_PATH }),
          secrets: await readLocalAiSecrets()
        });
        const summary = await runDueScheduledAgentTasks({
          harness: runtime,
          scheduledTaskStore: runtime.stores.scheduledTaskStore,
          providerConfigStore: runtime.stores.providerConfigStore,
          providerHealthStore: runtime.stores.providerHealthStore,
          now: body.now || body.nowAt || body.now_at,
          workspaceId: "local_workspace",
          userId: "local_user",
          limit: body.limit
        });
        return sendJson(res, 200, {
          item: summary,
          requestId: rid,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        return sendJson(res, 400, err(error?.code || "AI_SCHEDULED_TASK_RUN_DUE_FAILED", String(error?.message || error), rid));
      } finally {
        if (runtime && typeof runtime.close === "function") runtime.close();
      }
    }

    const scheduledTaskStatusId = parseScheduledTaskStatusPath(url.pathname);
    if (req.method === "POST" && scheduledTaskStatusId) {
      try {
        await initVault(VAULT_PATH);
        const body = await readJson(req);
        const store = await aiScheduledTaskStore();
        const item = store.updateScheduledTaskStatus({
          scheduledTaskId: scheduledTaskStatusId,
          status: body.status
        });
        if (!item) return sendJson(res, 404, err("AI_SCHEDULED_TASK_NOT_FOUND", "scheduled task not found", rid));
        return sendJson(res, 200, withCanonical({
          item,
          requestId: rid,
          timestamp: new Date().toISOString()
        }, wantsCanonical(url) ? {
          item: scheduledTaskToCanonical(item)
        } : null));
      } catch (error) {
        return sendJson(res, 400, err("AI_SCHEDULED_TASK_STATUS_FAILED", String(error?.message || error), rid));
      }
    }

    const scheduledTaskId = parseScheduledTaskPath(url.pathname);
    if (req.method === "GET" && scheduledTaskId) {
      try {
        await initVault(VAULT_PATH);
        const store = await aiScheduledTaskStore();
        const item = store.getScheduledTask(scheduledTaskId);
        if (!item) return sendJson(res, 404, err("AI_SCHEDULED_TASK_NOT_FOUND", "scheduled task not found", rid));
        return sendJson(res, 200, withCanonical({
          item,
          requestId: rid,
          timestamp: new Date().toISOString()
        }, wantsCanonical(url) ? {
          item: scheduledTaskToCanonical(item)
        } : null));
      } catch (error) {
        return sendJson(res, 500, err("AI_SCHEDULED_TASK_LOAD_FAILED", String(error?.message || error), rid));
      }
    }

    if (req.method === "DELETE" && scheduledTaskId) {
      try {
        await initVault(VAULT_PATH);
        const store = await aiScheduledTaskStore();
        const deleted = store.deleteScheduledTask({ scheduledTaskId });
        if (!deleted) return sendJson(res, 404, err("AI_SCHEDULED_TASK_NOT_FOUND", "scheduled task not found", rid));
        return sendJson(res, 200, {
          ok: true,
          deleted: true,
          scheduledTaskId,
          requestId: rid,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        return sendJson(res, 400, err("AI_SCHEDULED_TASK_DELETE_FAILED", String(error?.message || error), rid));
      }
    }

    if (req.method === "GET" && url.pathname === "/api/v1/directories") {
      await initVault(VAULT_PATH);
      const includeHidden = url.searchParams.get("includeHidden") === "true";
      const directories = await listDirectories(VAULT_PATH, { includeHidden });
      return sendJson(res, 200, {
        items: directories,
        total: directories.length,
        requestId: rid,
        timestamp: new Date().toISOString()
      });
    }

    if (req.method === "GET" && url.pathname === "/api/v1/graph") {
      const scope = String(url.searchParams.get("scope") || "directory").trim();
      const directoryId = String(url.searchParams.get("directoryId") || "").trim();
      const includeDescendants = url.searchParams.get("includeDescendants") === "true";
      if (scope !== "directory") {
        return sendJson(res, 400, err("GRAPH_SCOPE_INVALID", "only directory scope is supported in MVP", rid));
      }
      try {
        await initVault(VAULT_PATH);
        const graph = await getDirectoryGraph(VAULT_PATH, directoryId, { includeDescendants });
        return sendJson(res, 200, {
          item: graph,
          requestId: rid,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        return sendJson(res, 400, err("GRAPH_QUERY_INVALID", String(error?.message || error), rid));
      }
    }

    if (req.method === "POST" && url.pathname === "/api/v1/graph/ai-analysis") {
      try {
        await initVault(VAULT_PATH);
        const body = await readJson(req);
        let notes = Array.isArray(body.notes) ? body.notes : [];
        let relations = Array.isArray(body.relations) ? body.relations : [];
        let graph = null;
        if (!notes.length && body.directoryId) {
          graph = await getDirectoryGraph(VAULT_PATH, body.directoryId, {
            includeDescendants: body.includeDescendants === true || body.include_descendants === true
          });
          const permanentNodeIds = graph.nodes.filter((node) => node.noteType === "permanent").map((node) => node.id);
          notes = await loadNotesByIds(permanentNodeIds);
          relations = graph.edges;
        } else if (Array.isArray(body.noteIds || body.note_ids)) {
          notes = await loadNotesByIds(body.noteIds || body.note_ids);
        }

        const analysis = analyzePermanentNoteGraphLocally({
          notes,
          relations,
          options: body.options || {
            minRelationConfidence: body.minRelationConfidence ?? body.min_relation_confidence,
            relationLimit: body.relationLimit ?? body.relation_limit,
            focusNoteId: body.focusNoteId ?? body.focus_note_id,
            currentNoteId: body.currentNoteId ?? body.current_note_id,
            minTopicSize: body.minTopicSize ?? body.min_topic_size
          }
        });
        const reviewItems = buildPermanentNoteGraphReviewItems(analysis, {
          agentRunId: `run_graph_analysis_${rid}`,
          contextPackId: `ctx_graph_analysis_${rid}`,
          artifactIdSalt: graphArtifactScopeKey(body, notes),
          privacyMode: "local_only"
        });
        const persistArtifacts = body.persistArtifacts !== false && body.persist_artifacts !== false;
        const artifactStore = persistArtifacts ? await aiArtifactStore() : null;
        const storedArtifacts = persistArtifacts ? persistArtifactsIdempotently(artifactStore, reviewItems.artifacts) : [];
        if (persistArtifacts) pruneStaleGraphReviewArtifacts(artifactStore, storedArtifacts, { body, notes });
        return sendJson(res, 200, {
          item: {
            directoryId: body.directoryId || null,
            graphScope: graph
              ? {
                  nodeCount: graph.totalNodes,
                  edgeCount: graph.totalEdges,
                  includeDescendants: graph.includeDescendants
                }
              : null,
            analysis,
            reviewItems: {
              ...reviewItems,
              storedArtifactIds: storedArtifacts.map((artifact) => artifact.id),
              artifactsPersisted: persistArtifacts
            }
          },
          requestId: rid,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        return sendJson(res, 400, err(error?.code || "GRAPH_AI_ANALYSIS_FAILED", String(error?.message || error), rid, error?.details));
      }
    }

    if (req.method === "POST" && url.pathname === "/api/v1/graph/potential-relations") {
      try {
        await initVault(VAULT_PATH);
        const body = await readJson(req);
        const { notes, relations, graph, directoryId, focusNoteId } = await resolvePotentialRelationScope(body);
        const scan = buildPotentialRelationCandidates({
          notes,
          relations,
          options: {
            ...(body.options || {}),
            minScore: body.minScore ?? body.min_score ?? body.options?.minScore ?? body.options?.min_score,
            perNoteLimit: body.perNoteLimit ?? body.per_note_limit ?? body.options?.perNoteLimit ?? body.options?.per_note_limit,
            globalLimit: body.globalLimit ?? body.global_limit ?? body.options?.globalLimit ?? body.options?.global_limit,
            focusNoteId:
              body.focusNoteId ??
              body.focus_note_id ??
              body.noteId ??
              body.note_id ??
              body.options?.focusNoteId ??
              body.options?.focus_note_id ??
              focusNoteId,
            currentNoteId: body.currentNoteId ?? body.current_note_id ?? body.options?.currentNoteId ?? body.options?.current_note_id,
            recentNoteIds: body.recentNoteIds ?? body.recent_note_ids ?? body.options?.recentNoteIds ?? body.options?.recent_note_ids
          }
        });
        return sendJson(res, 200, {
          item: {
            directoryId: directoryId || null,
            graphScope: graph
              ? {
                  nodeCount: graph.totalNodes,
                  edgeCount: graph.totalEdges,
                  includeDescendants: graph.includeDescendants
                }
              : null,
            ...scan
          },
          requestId: rid,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        return sendJson(res, 400, err(error?.code || "POTENTIAL_RELATIONS_FAILED", String(error?.message || error), rid, error?.details));
      }
    }

    if (req.method === "POST" && url.pathname === "/api/v1/graph/potential-relations/refine") {
      try {
        await initVault(VAULT_PATH);
        const body = await readJson(req);
        const { notes, relations, focusNoteId } = await resolvePotentialRelationScope(body);
        const scan = buildPotentialRelationCandidates({
          notes,
          relations,
          options: {
            ...(body.options || {}),
            focusNoteId:
              body.focusNoteId ??
              body.focus_note_id ??
              body.noteId ??
              body.note_id ??
              body.options?.focusNoteId ??
              body.options?.focus_note_id ??
              focusNoteId,
            currentNoteId: body.currentNoteId ?? body.current_note_id ?? body.options?.currentNoteId ?? body.options?.current_note_id,
            globalLimit: Math.min(Number(body.globalLimit ?? body.global_limit ?? body.options?.globalLimit ?? body.options?.global_limit) || 10, 10)
          }
        });
        const candidate = resolvePotentialRelationCandidate(scan, body.candidate);
        if (!candidate) return sendJson(res, 404, err("POTENTIAL_RELATION_CANDIDATE_NOT_FOUND", "candidate is no longer available in the current scan", rid));
        const executeWithCurrentSettings = body.providerMode !== "ollama_direct" && body.provider_mode !== "ollama_direct";
        const providerExecution = executeWithCurrentSettings
          ? await resolveAnalysisProviderExecution(body, {
              agentId: "potential_relation_refine_agent",
              modelTier: body.modelTier ?? body.model_tier ?? "standard",
              privacyMode: body.privacyMode ?? body.privacy_mode
            })
          : null;
        const batchPlan = buildPotentialRelationAiBatches(scan.candidates, {
          batchSize: body.batchSize ?? body.batch_size,
          timeoutMs: body.batchTimeoutMs ?? body.batch_timeout_ms,
          numPredict: body.numPredict ?? body.num_predict
        });
        const hasBatchTimeout =
          body.batchTimeoutMs !== undefined ||
          body.batch_timeout_ms !== undefined;
        const timeoutMs = hasBatchTimeout
          ? batchPlan[0]?.timeoutMs || 120000
          : Math.min(Number(body.timeoutMs ?? body.timeout_ms) || 60000, 60000);
        const modelName = providerExecution
          ? cleanText(providerExecution.modelRoute?.modelRef) || DEFAULT_POTENTIAL_RELATION_MODEL
          : assertAllowedOllamaCatalogModel(body.modelName || body.model_name || body.model || DEFAULT_POTENTIAL_RELATION_MODEL);
        const item = await refinePotentialRelationCandidateWithLocalAi(candidate, {
          fingerprints: scan.fingerprints,
          cache: potentialRelationAiCache,
          modelName,
          providerId: providerExecution?.providerDescriptor?.providerId || "ollama_direct",
          privacyMode: providerExecution?.modelRoute?.privacyMode || cleanText(body.privacyMode || body.privacy_mode) || "local_only",
          userMode: providerExecution?.modelRoute?.userMode || cleanText(body.userMode || body.user_mode) || "Local / Private",
          timeoutMs,
          temperature: Number(body.temperature ?? 0.1),
          numPredict: Number(body.numPredict ?? body.num_predict ?? DEFAULT_POTENTIAL_RELATION_AI_NUM_PREDICT),
          confirmationApproved: body.confirmationApproved === true || body.confirmation_approved === true,
          confirmBudget: body.confirmBudget === true || body.confirm_budget === true,
          callModel: providerExecution
            ? async (prompt, options) => {
                const budgetPrecheck = assertProviderModelCallAllowed({
                  body,
                  prompt,
                  providerExecution,
                  outputTokenEstimate: options.numPredict
                });
                const response = await providerExecution.providerAdapter.complete({
                  requestId: `${rid}_potential_relation_refine`,
                  agentRunId: rid,
                  purpose: "potential_relation_refine",
                  providerDescriptor: providerExecution.providerDescriptor,
                  modelRoute: providerExecution.modelRoute,
                  modelRef: providerExecution.modelRoute.modelRef,
                  messages: [
                    { role: "system", content: "You are a strict reviewer of potential note relations. Return only strict JSON." },
                    { role: "user", content: prompt }
                  ],
                  tools: [],
                  output: { mode: "text" },
                  settings: {
                    stream: false,
                    temperature: options.temperature,
                    num_predict: options.numPredict,
                    maxOutputTokens: options.numPredict,
                    max_output_tokens: options.numPredict
                  },
                  policy: {
                    privacyMode: providerExecution.modelRoute.privacyMode,
                    allowCloud: providerExecution.modelRoute.cloudAllowed,
                    allowFallback: providerExecution.modelRoute.fallbackPolicy?.allowSameProviderFallback !== false,
                    modelRoute: providerExecution.modelRoute,
                    budgetPrecheck
                  }
                });
                assertProviderResponseSucceeded(response, "POTENTIAL_RELATION_PROVIDER_FAILED");
                return response?.output?.content || "";
              }
            : (prompt, options) => callOllamaGenerate(prompt, { ...options, timeoutMs })
        });
        const persistArtifacts = body.persistArtifacts !== false && body.persist_artifacts !== false;
        const artifactStore = persistArtifacts ? await aiArtifactStore() : null;
        const artifactContext = graphArtifactExecutionContext({
          body,
          notes,
          rid,
          providerExecution,
          modelName
        });
        const storedArtifacts = persistArtifacts
          ? persistArtifactsIdempotently(
              artifactStore,
              graphReviewArtifactsForCandidate(item, artifactContext)
            )
          : [];
        return sendJson(res, 200, {
          item,
          metrics: {
            ruleElapsedMs: scan.metrics.elapsedMs,
            aiElapsedMs: item.aiElapsedMs,
            cacheHit: item.cacheHit === true,
            providerId: providerExecution?.providerDescriptor?.providerId || "ollama_direct",
            modelRef: modelName,
            mode: scan.mode
          },
          batchPlan: {
            batchSize: batchPlan[0]?.batchSize || 4,
            timeoutMs: batchPlan[0]?.timeoutMs || 120000,
            numPredict: batchPlan[0]?.numPredict || DEFAULT_POTENTIAL_RELATION_AI_NUM_PREDICT,
            totalBatches: batchPlan.length,
            candidateCount: scan.candidates.length
          },
          reviewItems: {
            storedArtifactIds: storedArtifacts.map((artifact) => artifact.id),
            artifactsPersisted: persistArtifacts
          },
          requestId: rid,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        return sendJson(res, 400, err(error?.code || "POTENTIAL_RELATION_REFINE_FAILED", String(error?.message || error), rid, error?.details));
      }
    }

    if (req.method === "GET" && url.pathname === "/api/v1/graph/path") {
      try {
        await initVault(VAULT_PATH);
        const item = await findNotePath(VAULT_PATH, {
          fromNoteId: url.searchParams.get("fromNoteId"),
          toNoteId: url.searchParams.get("toNoteId"),
          directoryId: url.searchParams.get("directoryId"),
          maxDepth: url.searchParams.get("maxDepth"),
          direction: url.searchParams.get("direction")
        });
        return sendJson(res, 200, {
          item,
          requestId: rid,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        return sendJson(res, 400, err("GRAPH_PATH_INVALID", String(error?.message || error), rid));
      }
    }

    if (req.method === "GET" && url.pathname === "/api/v1/graph/conflicts") {
      try {
        await initVault(VAULT_PATH);
        const item = await detectGraphConflicts(VAULT_PATH, {
          directoryId: url.searchParams.get("directoryId"),
          includeDescendants: url.searchParams.get("includeDescendants") !== "false"
        });
        return sendJson(res, 200, {
          item,
          requestId: rid,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        return sendJson(res, 400, err("GRAPH_CONFLICTS_INVALID", String(error?.message || error), rid));
      }
    }

    if (req.method === "GET" && url.pathname === "/api/v1/relations/review-queue") {
      try {
        await initVault(VAULT_PATH);
        const result = await listRelationReviewQueue(VAULT_PATH, {
          directoryId: url.searchParams.get("directoryId"),
          includeDescendants: url.searchParams.get("includeDescendants") === "true",
          qualityLevels: url.searchParams.get("qualityLevels") || url.searchParams.get("qualityLevel"),
          relationType: url.searchParams.get("relationType"),
          status: url.searchParams.get("status"),
          limit: Number(url.searchParams.get("limit") || 20)
        });
        return sendJson(res, 200, {
          ...result,
          requestId: rid,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        return sendJson(res, 400, err(error?.code || "RELATION_REVIEW_QUEUE_INVALID", String(error?.message || error), rid, error?.details));
      }
    }

    const tagName = parseTagNotesPath(url.pathname);
    if (req.method === "GET" && tagName) {
      const rootDirectoryId = String(url.searchParams.get("rootDirectoryId") || url.searchParams.get("directoryId") || "").trim();
      try {
        await initVault(VAULT_PATH);
        const result = await listNotesByTag(VAULT_PATH, tagName, { rootDirectoryId });
        return sendJson(res, 200, {
          ...result,
          requestId: rid,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        return sendJson(res, 400, err("TAG_QUERY_INVALID", String(error?.message || error), rid));
      }
    }

    if (req.method === "GET" && url.pathname === "/api/v1/tags") {
      const rootDirectoryId = String(url.searchParams.get("rootDirectoryId") || url.searchParams.get("directoryId") || "").trim();
      const query = String(url.searchParams.get("q") || "").trim();
      const limit = Number(url.searchParams.get("limit") || 20);
      try {
        await initVault(VAULT_PATH);
        const result = await listTags(VAULT_PATH, { rootDirectoryId, query, limit });
        return sendJson(res, 200, {
          ...result,
          requestId: rid,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        return sendJson(res, 400, err("TAG_LIST_INVALID", String(error?.message || error), rid));
      }
    }

    if (req.method === "GET" && url.pathname === "/api/v1/notes/search") {
      try {
        await initVault(VAULT_PATH);
        const result = await searchNotes(VAULT_PATH, {
          q: url.searchParams.get("q") || "",
          rootDirectoryId: url.searchParams.get("rootDirectoryId") || url.searchParams.get("directoryId") || "",
          excludeNoteId: url.searchParams.get("excludeNoteId") || "",
          limit: Number(url.searchParams.get("limit") || 20)
        });
        return sendJson(res, 200, {
          ...result,
          requestId: rid,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        return sendJson(res, 400, err("NOTE_SEARCH_INVALID", String(error?.message || error), rid));
      }
    }

    const aiInboxSummarizeId = parseAiInboxSummarizePath(url.pathname);
    if (req.method === "POST" && aiInboxSummarizeId) {
      let runtime = null;
      try {
        await initVault(VAULT_PATH);
        const body = await readJson(req);
        const artifactStore = await aiArtifactStore();
        const artifact = artifactStore.getArtifact(aiInboxSummarizeId);
        if (!artifact) return sendJson(res, 404, err("AI_ARTIFACT_NOT_FOUND", "artifact not found", rid));

        const prefStore = await aiPreferencesStore();
        const prefs = prefStore.getUserPreferences({ workspaceId: "local_workspace", userId: "local_user" }) || {};
        const baseSettingsInput = preferencesToSettingsInput(prefs);
        const settingsInput = {
          ...baseSettingsInput,
          userMode: body.userMode ?? body.user_mode ?? baseSettingsInput.userMode,
          modelPack: body.modelPack ?? body.model_pack ?? baseSettingsInput.modelPack,
          authMode: body.authMode ?? body.auth_mode ?? baseSettingsInput.authMode,
          secretRef: body.secretRef ?? body.secret_ref ?? baseSettingsInput.secretRef,
          modelRef: body.modelRef ?? body.model_ref ?? baseSettingsInput.modelRef
        };
        assertAllowedManagedOllamaSettings(settingsInput);
        const artifactPrivacyMode = String(artifact?.privacy?.mode || artifact?.privacy_mode || "").trim();
        const baseUserSettings = resolveAiUserSettings(settingsInput);
        const privacyMode = body.privacyMode ?? body.privacy_mode ?? artifactPrivacyMode ?? baseUserSettings.privacy?.defaultMode ?? "normal";
        const modelTier = body.modelTier ?? body.model_tier ?? "cheap_fast";
        const hybridRoute = settingsForHybridRoute({
          settingsInput,
          userSettings: baseUserSettings,
          input: { taskType: "summary", ...body, modelTier },
          agent: { agentId: "ai_inbox_summary_agent", defaultModelTier: modelTier },
          privacyMode
        });
        const routedSettingsInput = hybridRoute.settingsInput;
        const userSettings = resolveAiUserSettings(routedSettingsInput);
        const providerPreset = String(routedSettingsInput.providerPreset || userSettings.providerPreset || "").trim();
        const configStore = await aiProviderConfigStore();
        const providerConfig = providerPreset ? configStore.getProviderConfig({ providerId: providerPreset }) : null;
        if (cleanText(providerConfig?.status || providerConfig?.status_text) === "disabled") {
          return sendJson(res, 400, err("AI_PROVIDER_CONFIG_DISABLED", "AI provider config is disabled.", rid, {
            providerId: providerPreset,
            providerConfigId: providerConfig?.id || providerConfig?.configId || providerConfig?.config_id
          }));
        }
        if (providerConfig) assertAllowedManagedOllamaProviderConfig(providerConfig);
        const providerSettings = providerConfig ? providerConfigToSettingsInput(providerConfig) : {};
        const mergedSettings = { ...routedSettingsInput, ...providerSettings };
        const providerDescriptor = resolveProviderDescriptor(mergedSettings);
        const modelRoute = resolveModelRoute({
          ...mergedSettings,
          providerDescriptor,
          userMode: userSettings.userMode,
          modelTier,
          privacyMode
        });

        runtime = await createAiHarnessRuntime({
          storageMode: "sqlite",
          vaultPath: VAULT_PATH,
          tools: createCoreNoteTools({ vaultPath: VAULT_PATH }),
          useOpenAiCompatibleAdapter: true,
          networkEnabled: true,
          createExecutor: true,
          secrets: await readLocalAiSecrets()
        });
        const adapterSelection = runtime.providerAdapterRegistry.getAdapter({
          ...mergedSettings,
          providerDescriptor
        });
        const providerAdapter = adapterSelection.adapter;

        const prompt = [
          "Summarize this AI Inbox item for a human reviewer.",
          "Return:",
          "1) one-sentence gist",
          "2) key evidence bullets (max 5)",
          "3) recommended action among: accept_link, promote_note, ignore, needs_more_context",
          "4) privacy risk note if any",
          "",
          `artifactType: ${artifact.artifactType || artifact.type || ""}`,
          `title: ${artifact.title || ""}`,
          `summary: ${artifact.summary || ""}`,
          `body: ${artifact.body || ""}`,
          `payload: ${JSON.stringify(artifact.payload || {}, null, 2).slice(0, 8000)}`
        ].join("\n");

        const response = await providerAdapter.complete({
          requestId: `${rid}_inbox_summarize`,
          agentRunId: rid,
          purpose: "ai_inbox_summarize",
          providerDescriptor,
          modelRoute,
          modelRef: modelRoute.modelRef,
          messages: [
            { role: "system", content: "You are a precise, privacy-aware assistant for note review workflows." },
            { role: "user", content: prompt }
          ],
          tools: [],
          output: { mode: "text" },
          settings: { stream: false, temperature: body.temperature },
          policy: {
            privacyMode: modelRoute.privacyMode,
            allowCloud: modelRoute.cloudAllowed,
            allowFallback: modelRoute.fallbackPolicy.allowSameProviderFallback,
            modelRoute,
            budgetPrecheck: { ok: true, confirmationRequired: false, estimatedUsage: { estimatedCost: 0, currency: "USD" } }
          }
        });
        assertProviderResponseSucceeded(response, "AI_INBOX_SUMMARIZE_PROVIDER_FAILED");

        const summaryText = String(response?.output?.content || "").trim();
        const recommendedAction = recommendedAiInboxActionFromText(summaryText);
        const decorated = [
          "[AI Summary]",
          `provider=${String(response.providerId || "").trim()}`,
          `model=${String(response.modelRef || "").trim()}`,
          ...(recommendedAction ? [`recommendedAction=${recommendedAction}`] : []),
          "",
          summaryText || "(empty)"
        ].join("\n");
        const existingLatestDecision = Array.isArray(artifact.userDecisions)
          ? artifact.userDecisions[artifact.userDecisions.length - 1] || null
          : null;
        const summarizeDecisionInput = {
          decision: "revised",
          userId: body.userId || body.user_id || "local_user",
          comment: decorated
        };
        const updatedArtifact =
          existingLatestDecision?.decision === "revised" && sameAiInboxDecisionPayload(existingLatestDecision, summarizeDecisionInput)
            ? artifact
            : artifactStore.recordDecision(aiInboxSummarizeId, summarizeDecisionInput);
        const inbox = createAiInbox({ artifactStore });
        const updatedItem = inbox.getItem(aiInboxSummarizeId);

        return sendJson(res, 200, {
          item: {
            artifactId: aiInboxSummarizeId,
            providerId: response.providerId,
            modelRef: response.modelRef,
            status: response.status,
            recommendedAction,
            output: response.output,
            usage: response.usage,
            artifact: updatedArtifact,
            inboxItem: updatedItem
          },
          requestId: rid,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        return sendJson(res, 400, err(error?.code || "AI_INBOX_SUMMARIZE_FAILED", String(error?.message || error), rid, error?.details));
      } finally {
        if (runtime && typeof runtime.close === "function") runtime.close();
      }
    }

    if (req.method === "POST" && url.pathname === "/api/v1/demo/product-thinking/smart-notes") {
      try {
        await readJson(req);
        const item = await seedSmartNotesProductThinking(VAULT_PATH);
        return sendJson(res, 200, {
          item,
          requestId: rid,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        return sendJson(
          res,
          400,
          err("SMART_NOTES_PRODUCT_THINKING_SEED_INVALID", String(error?.message || error), rid, error?.details)
        );
      }
    }

    if (req.method === "POST" && url.pathname === "/api/v1/directories") {
      const body = await readJson(req);
      try {
        await initVault(VAULT_PATH);
        const created = await createDirectory(VAULT_PATH, {
          title: body.title,
          parentDirectoryId: body.parentDirectoryId || null,
          directoryType: body.directoryType || "custom",
          fsPath: body.fsPath,
          maxNotes: body.maxNotes
        });
        return sendJson(res, 201, {
          item: created,
          requestId: rid,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        return sendJson(res, 400, err("DIRECTORY_PAYLOAD_INVALID", String(error?.message || error), rid));
      }
    }

    const directoryId = parseDirectoryPath(url.pathname);
    if (req.method === "PATCH" && directoryId) {
      const body = await readJson(req);
      try {
        await initVault(VAULT_PATH);
        const item = await updateDirectory(VAULT_PATH, directoryId, {
          title: body.title,
          parentDirectoryId: body.parentDirectoryId,
          fsPath: body.fsPath,
          isHidden: body.isHidden,
          maxNotes: body.maxNotes
        });
        return sendJson(res, 200, {
          item,
          requestId: rid,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        return sendJson(res, 400, err("DIRECTORY_UPDATE_INVALID", String(error?.message || error), rid));
      }
    }

    if (req.method === "DELETE" && directoryId) {
      try {
        await initVault(VAULT_PATH);
        const result = await deleteDirectory(VAULT_PATH, directoryId);
        return sendJson(res, 200, {
          ...result,
          requestId: rid,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        return sendJson(res, 400, err("DIRECTORY_DELETE_INVALID", String(error?.message || error), rid));
      }
    }

    const dirNotesId = parseDirectoryNotesPath(url.pathname);
    if (req.method === "GET" && dirNotesId) {
      try {
        await initVault(VAULT_PATH);
        const items = await listNotesInDirectory(VAULT_PATH, dirNotesId);
        return sendJson(res, 200, {
          directoryId: dirNotesId,
          items,
          total: items.length,
          requestId: rid,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        return sendJson(res, 400, err("DIRECTORY_NOTES_INVALID", String(error?.message || error), rid));
      }
    }

    if (req.method === "POST" && url.pathname === "/api/v1/notes") {
      const body = await readJson(req);
      try {
        await initVault(VAULT_PATH);
        const created = await createNoteInDirectory(VAULT_PATH, {
          directoryId: body.directoryId,
          title: body.title,
          body: body.body,
          status: body.status || "draft",
          thesis: body.thesis,
          threeLineSummary: body.threeLineSummary ?? body.three_line_summary,
          startingQuestion: body.startingQuestion ?? body.starting_question,
          thesisChangeReason: body.thesisChangeReason ?? body.thesis_change_reason,
          viewpointChangeSourceNoteIds: body.viewpointChangeSourceNoteIds ?? body.viewpoint_change_source_note_ids,
          viewpointChangeStatus: body.viewpointChangeStatus ?? body.viewpoint_change_status,
          commitViewpointChange: body.commitViewpointChange ?? body.commit_viewpoint_change,
          distillationStatus: body.distillationStatus ?? body.distillation_status,
          boundaryOrCounterpoint: body.boundaryOrCounterpoint ?? body.boundary_or_counterpoint,
          originalityStatus: body.originalityStatus ?? body.originality_status,
          originalitySimilarity: body.originalitySimilarity ?? body.originality_similarity,
          authorship: body.authorship,
          authorshipConfirmed: body.authorshipConfirmed,
          authorshipAiAssisted: body.authorshipAiAssisted
        });
        return sendJson(res, 201, {
          item: created,
          requestId: rid,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        return sendJson(
          res,
          400,
          err(error?.code || "NOTE_PAYLOAD_INVALID", String(error?.message || error), rid, error?.details)
        );
      }
    }

    if (req.method === "GET" && url.pathname === "/api/v1/distillation/queue") {
      try {
        await initVault(VAULT_PATH);
        const result = await listDistillationQueue(VAULT_PATH, {
          targetType: url.searchParams.get("targetType") || url.searchParams.get("target_type") || "permanent_note",
          status: url.searchParams.get("status") || "",
          limit: url.searchParams.get("limit") || 50
        });
        const item = result?.item ?? result;
        const items = publicDistillationQueueItems(item, { status: url.searchParams.get("status") || "" });
        return sendJson(res, 200, {
          item,
          items,
          total: items.length,
          counts: item?.counts || {},
          requestId: rid,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        return sendJson(res, 400, err(error?.code || "DISTILLATION_QUEUE_INVALID", String(error?.message || error), rid, error?.details));
      }
    }

    const permanentNoteDistillationId = parsePermanentNoteDistillationPath(url.pathname);
    if (req.method === "PATCH" && permanentNoteDistillationId) {
      const body = await readJson(req);
      try {
        await initVault(VAULT_PATH);
        const item = await updatePermanentNoteDistillation(VAULT_PATH, permanentNoteDistillationId, {
          thesis: body.thesis,
          threeLineSummary: body.threeLineSummary ?? body.three_line_summary,
          startingQuestion: body.startingQuestion ?? body.starting_question,
          thesisChangeReason: body.thesisChangeReason ?? body.thesis_change_reason,
          viewpointChangeSourceNoteIds: body.viewpointChangeSourceNoteIds ?? body.viewpoint_change_source_note_ids,
          viewpointChangeStatus: body.viewpointChangeStatus ?? body.viewpoint_change_status,
          commitViewpointChange: body.commitViewpointChange ?? body.commit_viewpoint_change,
          distillationStatus: body.distillationStatus ?? body.distillation_status,
          boundaryOrCounterpoint: body.boundaryOrCounterpoint ?? body.boundary_or_counterpoint
        });
        return sendJson(res, 200, {
          item,
          requestId: rid,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        const status = error?.code === "PERMANENT_NOTE_REQUIRED" ? 400 : error?.code === "NOTE_NOT_FOUND" ? 404 : 400;
        return sendJson(res, status, err(error?.code || "PERMANENT_NOTE_DISTILLATION_UPDATE_INVALID", String(error?.message || error), rid, error?.details));
      }
    }

    const permanentNoteDistillationConfirmId = parsePermanentNoteDistillationConfirmPath(url.pathname);
    if (req.method === "POST" && permanentNoteDistillationConfirmId) {
      const body = await readJson(req);
      try {
        await initVault(VAULT_PATH);
        const note = await getNoteById(VAULT_PATH, permanentNoteDistillationConfirmId);
        assertPermanentNoteReadyToConfirm(note, body);
        const item = await confirmPermanentNoteDistillation(VAULT_PATH, permanentNoteDistillationConfirmId, {
          aiAssisted: body.aiAssisted ?? body.ai_assisted
        });
        return sendJson(res, 200, {
          item,
          requestId: rid,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        const status = error?.code === "PERMANENT_NOTE_REQUIRED" ? 400 : error?.code === "NOTE_NOT_FOUND" ? 404 : 400;
        return sendJson(res, status, err(error?.code || "PERMANENT_NOTE_DISTILLATION_CONFIRM_INVALID", String(error?.message || error), rid, error?.details));
      }
    }

    const noteRelationsId = parseNoteRelationsPath(url.pathname);
    if (req.method === "POST" && noteRelationsId) {
      const body = await readJson(req);
      try {
        await initVault(VAULT_PATH);
        const relation = await createNoteRelation(VAULT_PATH, noteRelationsId, {
          toNoteId: body.toNoteId ?? body.to_note_id,
          relationType: body.relationType ?? body.relation_type,
          rationale: body.rationale,
          insightQuestion: body.insightQuestion ?? body.insight_question,
          createdBy: body.createdBy ?? body.created_by,
          confidence: body.confidence,
          status: body.status
        });
        return sendJson(res, 201, {
          item: relation,
          requestId: rid,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        return sendJson(res, 400, err(error?.code || "NOTE_RELATION_CREATE_INVALID", String(error?.message || error), rid, error?.details));
      }
    }

    if (req.method === "GET" && noteRelationsId) {
      try {
        await initVault(VAULT_PATH);
        const relations = await listNoteRelations(VAULT_PATH, noteRelationsId);
        return sendJson(res, 200, {
          item: relations,
          requestId: rid,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        return sendJson(res, 404, err("NOTE_RELATIONS_NOT_FOUND", String(error?.message || error), rid));
      }
    }

    const noteAiAnalysisId = parseNoteAiAnalysisPath(url.pathname);
    if (req.method === "POST" && noteAiAnalysisId) {
      try {
        await initVault(VAULT_PATH);
        const body = await readJson(req);
        const note = await getNoteById(VAULT_PATH, noteAiAnalysisId);
        if (note.noteType !== "permanent") {
          return sendJson(
            res,
            400,
            err("NOTE_AI_ANALYSIS_PERMANENT_REQUIRED", "AI note analysis currently only supports permanent notes.", rid, {
              noteId: noteAiAnalysisId,
              noteType: note.noteType
            })
          );
        }

        const relatedNotes = [
          ...(Array.isArray(body.relatedNotes || body.related_notes) ? body.relatedNotes || body.related_notes : []),
          ...(await loadNotesByIds(body.relatedNoteIds || body.related_note_ids))
        ];
        const literatureNotes = [
          ...(Array.isArray(body.literatureNotes || body.literature_notes) ? body.literatureNotes || body.literature_notes : []),
          ...(await loadNotesByIds(body.literatureNoteIds || body.literature_note_ids))
        ];
        const analysisInput = {
          note,
          relatedNotes,
          literatureNotes,
          options: body.options || {
            minRelationConfidence: body.minRelationConfidence ?? body.min_relation_confidence,
            relationLimit: body.relationLimit ?? body.relation_limit,
            originalityPlan: body.originalityPlan ?? body.originality_plan
          }
        };
        const analysisContext = {
          agentRunId: `run_note_analysis_${rid}`,
          contextPackId: `ctx_note_analysis_${rid}`,
          artifactIdSalt: rid,
          privacyMode: "local_only"
        };
        const localModelResponse = body.localModelResponse ?? body.local_model_response;
        const executeLocalModel = enabledFlag(body, "executeLocalModel", "execute_local_model");
        const prepareLocalModelRequest =
          body.prepareLocalModelRequest === true ||
          body.prepare_local_model_request === true ||
          Boolean(localModelResponse) ||
          executeLocalModel;
        const providerExecution = executeLocalModel
          ? await resolveAnalysisProviderExecution(body, {
              modelPack: "Ollama Local",
              userMode: "Local / Private",
              providerPreset: "ollama_local_gateway",
              authMode: "local_no_key",
              modelTier: "local_private",
              privacyMode: "local_only"
            })
          : null;
        const explicitLocalModel = cleanText(body.localModel || body.local_model);
        if (prepareLocalModelRequest && explicitLocalModel) assertAllowedOllamaCatalogModel(explicitLocalModel);
        const localModelContext = providerExecution
          ? {
              ...analysisContext,
              model: requestModelFromRoute(
                providerExecution.providerDescriptor,
                providerExecution.modelRoute,
                explicitLocalModel,
                "Local / Private"
              )
            }
          : {
              ...analysisContext,
              localModel: explicitLocalModel
            };
        const localModelRequest = prepareLocalModelRequest
          ? buildPermanentNoteLocalModelRequest(analysisInput, null, localModelContext)
          : null;
        let modelExecution = null;
        let result = null;
        if (localModelResponse) {
          result = mergePermanentNoteLocalModelResponse(localModelRequest, localModelResponse, analysisContext);
        } else if (executeLocalModel) {
          try {
            result = await runPermanentNoteLocalModelAnalysis(localModelRequest, providerExecution.providerAdapter, {
              ...analysisContext,
              model: localModelRequest.model
            });
            modelExecution = modelExecutionSummary(result.providerResponse, {
              modelRoute: providerExecution.modelRoute
            });
          } catch (error) {
            if (body.fallbackOnProviderFailure === false || body.fallback_on_provider_failure === false) throw error;
            result = analyzePermanentNoteForReview(analysisInput, analysisContext);
            modelExecution = modelExecutionFailure(error, {
              fallbackUsed: true,
              providerDescriptor: providerExecution.providerDescriptor,
              modelRoute: providerExecution.modelRoute
            });
          }
        } else {
          result = analyzePermanentNoteForReview(analysisInput, analysisContext);
        }
        const { analysis, reviewItems } = result;
        const persistArtifacts = body.persistArtifacts !== false && body.persist_artifacts !== false;
        const persistSuggestions = persistArtifacts;
        const fieldSuggestionArtifactIds = new Map(
          (Array.isArray(reviewItems.artifacts) ? reviewItems.artifacts : [])
            .map((artifact) => {
              const suggestionId = fieldSuggestionIdFromArtifactPayload(artifact);
              return suggestionId ? [suggestionId, artifact.id] : null;
            })
            .filter(Boolean)
        );
        const artifactStore = persistArtifacts ? await aiArtifactStore() : null;
        const suggestionStore = persistSuggestions ? await aiSuggestionStore() : null;
        const storedSuggestions = persistSuggestions
          ? (Array.isArray(reviewItems.suggestions) ? reviewItems.suggestions : []).map((suggestion) =>
              suggestionStore.create(
                {
                  ...suggestion,
                  sourceArtifactId: fieldSuggestionArtifactIds.get(suggestion.id)
                },
                { now: new Date().toISOString() }
              )
            )
          : [];
        const storedArtifacts = persistArtifacts ? artifactStore.createMany(reviewItems.artifacts) : [];
        const inbox = persistArtifacts ? createAiInbox({ artifactStore }) : null;
        return sendJson(res, 200, {
          item: {
            noteId: noteAiAnalysisId,
            analysis,
            localModelRequest,
            modelExecution,
            reviewItems: {
              ...reviewItems,
              suggestions: storedSuggestions.length ? storedSuggestions : reviewItems.suggestions,
              storedSuggestionIds: storedSuggestions.map((suggestion) => suggestion.id),
              suggestionsPersisted: persistSuggestions,
              storedArtifactIds: storedArtifacts.map((artifact) => artifact.id),
              artifactsPersisted: persistArtifacts
            },
            inbox: inbox
              ? {
                  counts: inbox.counts({ sourceNoteId: noteAiAnalysisId }),
                  pending: inbox.listItems({ view: "pending", sourceNoteId: noteAiAnalysisId, limit: 100 })
                }
              : null
          },
          requestId: rid,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        const status = error?.code === "NOTE_NOT_FOUND" ? 404 : 400;
        return sendJson(res, status, err(error?.code || "NOTE_AI_ANALYSIS_FAILED", String(error?.message || error), rid, error?.details));
      }
    }

    if (req.method === "GET" && noteAiAnalysisId) {
      try {
        await initVault(VAULT_PATH);
        await getNoteById(VAULT_PATH, noteAiAnalysisId);
        const artifactStore = await aiArtifactStore();
        const inbox = createAiInbox({ artifactStore });
        const filter = {
          sourceNoteId: noteAiAnalysisId,
          view: url.searchParams.get("view") || "all",
          limit: url.searchParams.get("limit") || 100
        };
        const items = inbox.listItems(filter);
        return sendJson(res, 200, {
          item: {
            noteId: noteAiAnalysisId,
            items,
            counts: inbox.counts({ sourceNoteId: noteAiAnalysisId }),
            views: inbox.views()
          },
          requestId: rid,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        const status = error?.code === "NOTE_NOT_FOUND" ? 404 : 400;
        return sendJson(res, status, err(error?.code || "NOTE_AI_ANALYSIS_LOAD_FAILED", String(error?.message || error), rid));
      }
    }

    const relationId = parseRelationPath(url.pathname);
    if (req.method === "PATCH" && relationId) {
      const body = await readJson(req);
      try {
        await initVault(VAULT_PATH);
        const relation = await updateNoteRelation(VAULT_PATH, relationId, {
          relationType: body.relationType ?? body.relation_type,
          rationale: body.rationale,
          insightQuestion: body.insightQuestion ?? body.insight_question,
          confidence: body.confidence,
          status: body.status
        });
        return sendJson(res, 200, {
          item: relation,
          requestId: rid,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        return sendJson(res, 400, err(error?.code || "NOTE_RELATION_UPDATE_INVALID", String(error?.message || error), rid, error?.details));
      }
    }

    if (req.method === "DELETE" && relationId) {
      try {
        await initVault(VAULT_PATH);
        const result = await deleteNoteRelation(VAULT_PATH, relationId);
        return sendJson(res, 200, {
          ...result,
          requestId: rid,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        return sendJson(res, 400, err(error?.code || "NOTE_RELATION_DELETE_INVALID", String(error?.message || error), rid, error?.details));
      }
    }

    const noteId = parseNotePath(url.pathname);
    if (req.method === "GET" && noteId) {
      try {
        await initVault(VAULT_PATH);
        const item = await getNoteById(VAULT_PATH, noteId);
        return sendJson(res, 200, {
          item,
          requestId: rid,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        return sendJson(res, 404, err("NOTE_NOT_FOUND", String(error?.message || error), rid));
      }
    }

    if (req.method === "PUT" && noteId) {
      const body = await readJson(req);
      try {
        await initVault(VAULT_PATH);
        const item = await updateNoteContent(VAULT_PATH, noteId, {
          title: body.title,
          body: body.body,
          status: body.status,
          thesis: body.thesis,
          threeLineSummary: body.threeLineSummary ?? body.three_line_summary,
          startingQuestion: body.startingQuestion ?? body.starting_question,
          thesisChangeReason: body.thesisChangeReason ?? body.thesis_change_reason,
          viewpointChangeSourceNoteIds: body.viewpointChangeSourceNoteIds ?? body.viewpoint_change_source_note_ids,
          distillationStatus: body.distillationStatus ?? body.distillation_status,
          boundaryOrCounterpoint: body.boundaryOrCounterpoint ?? body.boundary_or_counterpoint,
          originalityStatus: body.originalityStatus ?? body.originality_status,
          originalitySimilarity: body.originalitySimilarity ?? body.originality_similarity,
          authorship: body.authorship,
          authorshipConfirmed: body.authorshipConfirmed,
          authorshipAiAssisted: body.authorshipAiAssisted
        });
        return sendJson(res, 200, {
          item,
          requestId: rid,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        return sendJson(
          res,
          400,
          err(error?.code || "NOTE_UPDATE_INVALID", String(error?.message || error), rid, error?.details)
        );
      }
    }

    const moveNoteId = parseMoveNotePath(url.pathname);
    if (req.method === "POST" && moveNoteId) {
      const body = await readJson(req);
      try {
        await initVault(VAULT_PATH);
        const item = await moveNoteToDirectory(VAULT_PATH, moveNoteId, body.directoryId);
        return sendJson(res, 200, {
          item,
          requestId: rid,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        return sendJson(res, 400, err("NOTE_MOVE_INVALID", String(error?.message || error), rid));
      }
    }

    if (req.method === "DELETE" && noteId) {
      try {
        await initVault(VAULT_PATH);
        const result = await deleteNoteById(VAULT_PATH, noteId);
        return sendJson(res, 200, {
          ...result,
          requestId: rid,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        return sendJson(res, 400, err("NOTE_DELETE_INVALID", String(error?.message || error), rid));
      }
    }

    if (req.method === "POST" && url.pathname === "/api/v1/assets") {
      const body = await readJson(req);
      try {
        await initVault(VAULT_PATH);
        const item = await saveNoteAsset(VAULT_PATH, body.noteId, {
          fileName: body.fileName,
          mimeType: body.mimeType,
          contentBase64: body.contentBase64,
          kind: body.kind
        });
        return sendJson(res, 201, {
          item,
          requestId: rid,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        return sendJson(res, 400, err("ASSET_UPLOAD_INVALID", String(error?.message || error), rid));
      }
    }

    if (req.method === "GET" && url.pathname === "/api/v1/assets/file") {
      const relativePath = String(url.searchParams.get("path") || "").trim().replaceAll("\\", "/");
      if (!relativePath) {
        return sendJson(res, 400, err("ASSET_PATH_REQUIRED", "asset path required", rid));
      }
      if (!relativePath.startsWith("assets/")) {
        return sendJson(res, 400, err("ASSET_PATH_INVALID", "asset path must stay inside assets/", rid));
      }
      try {
        await initVault(VAULT_PATH);
        const absolutePath = resolveVaultPath(VAULT_PATH, relativePath);
        const body = await fs.readFile(absolutePath);
        return sendBinary(res, 200, assetContentType(absolutePath), body);
      } catch (error) {
        return sendJson(res, 404, err("ASSET_NOT_FOUND", String(error?.message || error), rid));
      }
    }

    const directConnector = parseConnectorPath(url.pathname);
    if (req.method === "POST" && directConnector) {
      const body = await readJson(req);
      const preview = await importExportService.createPreview(directConnector, body.payload || body, body.options || {}, rid);
      return sendJson(res, 200, preview);
    }

    if (req.method === "POST" && url.pathname === "/api/v1/imports/preview") {
      const body = await readJson(req);
      const connector = String(body.connector || "").trim();
      if (!allowedConnectors.has(connector)) return sendJson(res, 400, err("IMPORT_PAYLOAD_INVALID", "connector invalid", rid));
      const preview = await importExportService.createPreview(connector, body.payload || {}, body.options || {}, rid);
      return sendJson(res, 200, preview);
    }

    if (req.method === "GET" && url.pathname === "/api/v1/imports") {
      const result = await importExportService.getImportRecordList({ limit: url.searchParams.get("limit") || 50 });
      return sendJson(res, 200, {
        items: result.items.map(publicImportRecord),
        count: result.items.length,
        total: result.total,
        requestId: rid,
        timestamp: new Date().toISOString()
      });
    }

    if (req.method === "POST" && url.pathname === "/api/v1/papers") {
      const body = await readJson(req);
      try {
        await initVault(VAULT_PATH);
        const item = await createPaperWorkspace(VAULT_PATH, body);
        return sendJson(res, 201, {
          item,
          requestId: rid,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        return sendJson(res, 400, err(error.code || "PAPER_WORKSPACE_INVALID", String(error?.message || error), rid));
      }
    }

    const paperId = parsePaperPath(url.pathname);
    if (req.method === "GET" && paperId) {
      try {
        await initVault(VAULT_PATH);
        const item = await getPaperWorkspace(VAULT_PATH, paperId);
        if (!item) return sendJson(res, 404, err("PAPER_WORKSPACE_NOT_FOUND", "paper workspace not found", rid));
        return sendJson(res, 200, {
          item,
          requestId: rid,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        return sendJson(res, 400, err(error.code || "PAPER_WORKSPACE_INVALID", String(error?.message || error), rid));
      }
    }

    const paperNotebookLmDraftsId = parsePaperNotebookLmDraftsPath(url.pathname);
    if (req.method === "POST" && paperNotebookLmDraftsId) {
      const body = await readJson(req);
      try {
        await initVault(VAULT_PATH);
        const result = await addNotebookLmDraft(VAULT_PATH, paperNotebookLmDraftsId, body.payload || body);
        return sendJson(res, 201, {
          item: result.workspace,
          draft: {
            id: result.draftId,
            candidateIds: result.candidates.map((item) => item.id),
            warnings: result.warnings
          },
          candidates: result.candidates,
          requestId: rid,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        const status = error.code === "PAPER_WORKSPACE_NOT_FOUND" ? 404 : 400;
        return sendJson(res, status, err(error.code || "PAPER_NOTEBOOKLM_DRAFT_INVALID", String(error?.message || error), rid));
      }
    }

    const paperTranslationsId = parsePaperTranslationsPath(url.pathname);
    if (req.method === "POST" && paperTranslationsId) {
      const body = await readJson(req);
      try {
        await initVault(VAULT_PATH);
        const result = await savePaperTranslation(VAULT_PATH, paperTranslationsId, body);
        return sendJson(res, 201, {
          item: result.workspace,
          translation: result.translation,
          candidate: result.candidate,
          requestId: rid,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        const status = error.code === "PAPER_WORKSPACE_NOT_FOUND" || error.code === "PAPER_CANDIDATE_NOT_FOUND" ? 404 : 400;
        return sendJson(res, status, err(error.code || "PAPER_TRANSLATION_INVALID", String(error?.message || error), rid));
      }
    }

    const paperPermanentCandidatesId = parsePaperPermanentCandidatesPath(url.pathname);
    if (req.method === "POST" && paperPermanentCandidatesId) {
      const body = await readJson(req);
      try {
        await initVault(VAULT_PATH);
        const result = await createPaperPermanentCandidate(VAULT_PATH, paperPermanentCandidatesId, body);
        return sendJson(res, 201, {
          item: result.workspace,
          permanentCandidate: result.permanentCandidate,
          originalityGuard: result.originalityGuard,
          evaluation: result.evaluation,
          requestId: rid,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        const status = error.code === "PAPER_WORKSPACE_NOT_FOUND" || error.code === "PAPER_CANDIDATE_NOT_FOUND" ? 404 : 400;
        return sendJson(res, status, err(error.code || "PAPER_PERMANENT_CANDIDATE_INVALID", String(error?.message || error), rid));
      }
    }

    const paperPermanentNotesId = parsePaperPermanentNotesPath(url.pathname);
    if (req.method === "POST" && paperPermanentNotesId) {
      const body = await readJson(req);
      try {
        await initVault(VAULT_PATH);
        const result = await savePaperPermanentNote(VAULT_PATH, paperPermanentNotesId, body);
        await registerImportCatalogNote(result.permanentNote, "permanent", result.writeResult);
        return sendJson(res, 201, {
          item: result.workspace,
          permanentNote: result.permanentNote,
          permanentCandidate: result.permanentCandidate,
          writeResult: {
            written: result.writeResult.written,
            skipped: result.writeResult.skipped,
            reason: result.writeResult.reason || null,
            path: path.relative(VAULT_PATH, result.writeResult.path).replaceAll("\\", "/")
          },
          requestId: rid,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        const status =
          error.code === "PAPER_WORKSPACE_NOT_FOUND" || error.code === "PAPER_PERMANENT_CANDIDATE_NOT_FOUND"
            ? 404
            : error.code === "PAPER_PERMANENT_NOTE_EXISTS" || error.code === "PAPER_PERMANENT_NOTE_ALREADY_SAVED"
              ? 409
              : 400;
        return sendJson(res, status, err(error.code || "PAPER_PERMANENT_NOTE_INVALID", String(error?.message || error), rid));
      }
    }

    const importRecordId = parseImportRecordPath(url.pathname);
    if (req.method === "GET" && importRecordId) {
      const record = await importExportService.getImportRecord(importRecordId);
      if (!record) return sendJson(res, 404, err("IMPORT_RECORD_NOT_FOUND", "import record not found", rid));
      return sendJson(res, 200, {
        importRecord: publicImportRecord(record),
        requestId: rid,
        timestamp: new Date().toISOString()
      });
    }

    if (req.method === "POST" && url.pathname === "/api/v1/originality/check") {
      const body = await readJson(req);
      const plan = normalizeOriginalityPlan(body.originalityPlan || {});
      const record = {
        literature: Array.isArray(body.literature) ? body.literature : [],
        permanent: Array.isArray(body.permanent) ? body.permanent : []
      };
      const guard = originalityGuard(record, plan);
      return sendJson(res, 200, {
        originalityGuard: {
          plan: guard.plan,
          blockedPermanentIds: guard.flaggedPermanentIds,
          evaluations: guard.evaluations,
          warnings: guard.warnings
        },
        summary: {
          permanentCount: record.permanent.length,
          blockedCount: guard.evaluations.filter((x) => x.status === "blocked").length,
          warningCount: guard.evaluations.filter((x) => x.status === "warning").length,
          passCount: guard.evaluations.filter((x) => x.status === "pass").length
        }
      });
    }

    const confirmId = parseConfirmPath(url.pathname);
    if (req.method === "POST" && confirmId) {
      const body = await readJson(req);
      const record = await importExportService.getImportRecord(confirmId);
      if (!record) return sendJson(res, 404, err("IMPORT_RECORD_NOT_FOUND", "import record not found", rid));
      try {
        const result = await importExportService.confirmImport(record, body, rid);
        return sendJson(res, 200, result);
      } catch (error) {
        const status =
          error.code === "IMPORT_ORIGINALITY_BLOCKED"
            ? 409
            : error.code === "IMPORT_STATUS_INVALID"
              ? 400
              : 400;
        return sendJson(res, status, err(error.code || "IMPORT_SELECTED_CANDIDATES_INVALID", String(error?.message || error), rid, error.details));
      }
    }

    const rollbackId = parseRollbackPath(url.pathname);
    if (req.method === "POST" && rollbackId) {
      const record = await importExportService.getImportRecord(rollbackId);
      if (!record) return sendJson(res, 404, err("IMPORT_RECORD_NOT_FOUND", "import record not found", rid));
      try {
        const result = await importExportService.rollbackImport(record, rid);
        return sendJson(res, 200, result);
      } catch (error) {
        return sendJson(res, 400, err(error.code || "IMPORT_STATUS_INVALID", String(error?.message || error), rid, error.details));
      }
    }

    if (req.method === "POST" && url.pathname === "/api/v1/exports/markdown") {
      const body = await readJson(req);
      let result;
      try {
        result = await importExportService.runMarkdownExport(body, rid);
      } catch (error) {
        if (error?.code === "EXPORT_TARGET_INSIDE_VAULT") {
          return sendJson(res, 400, err("EXPORT_TARGET_INVALID", String(error.message || error), rid));
        }
        if (error?.code === "EXPORT_SCOPE_INVALID") {
          return sendJson(res, 400, err("EXPORT_SCOPE_INVALID", String(error.message || error), rid));
        }
        throw error;
      }
      return sendJson(res, 202, {
        exportJobId: result.exportJobId,
        status: result.status,
        copied: result.copied,
        copiedBreakdown: result.copiedBreakdown,
        scope: result.scope
      });
    }

    if (req.method === "POST" && url.pathname === "/api/v1/index-cards") {
      const body = await readJson(req);
      try {
        await initVault(VAULT_PATH);
        const item = await createIndexCard(VAULT_PATH, body);
        return sendJson(res, 201, {
          item,
          requestId: rid,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        return sendJson(res, 400, err("INDEX_CARD_INVALID", String(error?.message || error), rid));
      }
    }

    if (req.method === "GET" && url.pathname === "/api/v1/index-cards") {
      try {
        await initVault(VAULT_PATH);
        const items = await listIndexCards(VAULT_PATH, {
          directoryId: url.searchParams.get("directoryId") || "",
          includeDescendants: url.searchParams.get("includeDescendants") || "true",
          indexType: url.searchParams.get("indexType") || "",
          limit: Number(url.searchParams.get("limit") || 12)
        });
        return sendJson(res, 200, {
          items,
          total: items.length,
          requestId: rid,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        return sendJson(res, 400, err("INDEX_CARD_INVALID", String(error?.message || error), rid));
      }
    }

    const indexCardMatch = url.pathname.match(/^\/api\/v1\/index-cards\/([^/]+)$/);
    if (req.method === "GET" && indexCardMatch) {
      try {
        await initVault(VAULT_PATH);
        const item = await getIndexCard(VAULT_PATH, decodeURIComponent(indexCardMatch[1]));
        return sendJson(res, 200, {
          item,
          requestId: rid,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        return sendJson(res, 400, err("INDEX_CARD_INVALID", String(error?.message || error), rid));
      }
    }

    if (req.method === "PATCH" && indexCardMatch) {
      const body = await readJson(req);
      try {
        await initVault(VAULT_PATH);
        const item = await updateIndexCard(VAULT_PATH, decodeURIComponent(indexCardMatch[1]), body);
        return sendJson(res, 200, {
          item,
          requestId: rid,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        return sendJson(res, 400, err("INDEX_CARD_INVALID", String(error?.message || error), rid));
      }
    }

    const indexCardDistillMatch = url.pathname.match(/^\/api\/v1\/index-cards\/([^/]+)\/distill$/);
    if (req.method === "POST" && indexCardDistillMatch) {
      try {
        await initVault(VAULT_PATH);
        const item = await distillIndexCard(VAULT_PATH, decodeURIComponent(indexCardDistillMatch[1]));
        return sendJson(res, 200, {
          item,
          requestId: rid,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        return sendJson(res, 400, err("INDEX_CARD_INVALID", String(error?.message || error), rid));
      }
    }

    if (req.method === "POST" && url.pathname === "/api/v1/writing/ai-analysis") {
      try {
        await initVault(VAULT_PATH);
        const body = await readJson(req);
        const notes = [
          ...(Array.isArray(body.notes) ? body.notes : []),
          ...(await loadNotesByIds(body.noteIds || body.note_ids))
        ];
        const requestPayload = {
          ...body,
          notes
        };
        const executeRemoteModel =
          enabledFlag(body, "executeRemoteModel", "execute_remote_model") ||
          enabledFlag(body, "executeModel", "execute_model");
        const providerExecution = executeRemoteModel
          ? await resolveAnalysisProviderExecution(body, {
              modelPack: "Deep Work",
              userMode: "Deep Thinking",
              modelTier: "strong_reasoning",
              privacyMode: "remote_after_confirmation"
            })
          : null;
        const explicitRemoteModel = cleanText(body.model || body.remoteModel || body.remote_model);
        const requestContext = {
          agentRunId: `run_writing_analysis_${rid}`,
          contextPackId: `ctx_writing_analysis_${rid}`,
          artifactIdSalt: rid,
          userConfirmedRemoteModel: body.userConfirmedRemoteModel === true || body.user_confirmed_remote_model === true,
          model: providerExecution
            ? requestModelFromRoute(
                providerExecution.providerDescriptor,
                providerExecution.modelRoute,
                explicitRemoteModel,
                "Remote / Confirmed"
              )
            : body.model
            ? {
                provider: cleanText(body.provider) || "remote_strong_model",
                model: cleanText(body.model),
                tier: "strong",
                mode: "Remote / Confirmed"
              }
            : null
        };
        const strongModelRequest = buildWritingStrongModelRequest(requestPayload, requestContext);
        const modelResponse = body.modelResponse ?? body.model_response ?? body.remoteModelResponse ?? body.remote_model_response;
        let modelExecution = null;
        const result = modelResponse
          ? mergeWritingStrongModelResponse(strongModelRequest, modelResponse, requestContext)
          : executeRemoteModel
            ? await runWritingStrongModelAnalysis(strongModelRequest, providerExecution.providerAdapter, requestContext).then((executionResult) => {
                modelExecution = modelExecutionSummary(executionResult.providerResponse, {
                  modelRoute: providerExecution.modelRoute
                });
                return executionResult;
              })
            : null;
        const persistArtifacts = Boolean(result) && body.persistArtifacts !== false && body.persist_artifacts !== false;
        const artifactStore = persistArtifacts ? await aiArtifactStore() : null;
        const storedArtifacts = persistArtifacts ? artifactStore.createMany(result.artifacts) : [];
        return sendJson(res, 200, {
          item: {
            request: strongModelRequest,
            modelExecution,
            result: result
              ? {
                  ...result,
                  storedArtifactIds: storedArtifacts.map((artifact) => artifact.id),
                  artifactsPersisted: persistArtifacts
                }
              : null
          },
          requestId: rid,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        const status = error?.code === "WRITING_REMOTE_MODEL_CONFIRMATION_REQUIRED" ? 403 : 400;
        return sendJson(res, status, err(error?.code || "WRITING_AI_ANALYSIS_FAILED", String(error?.message || error), rid, error?.details));
      }
    }

    if (req.method === "POST" && url.pathname === "/api/v1/writing-projects") {
      const body = await readJson(req);
      try {
        await initVault(VAULT_PATH);
        const item = await createWritingProject(VAULT_PATH, body);
        return sendJson(res, 201, {
          item,
          requestId: rid,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        return sendJson(res, 400, err("WRITING_PROJECT_INVALID", String(error?.message || error), rid));
      }
    }

    if (req.method === "GET" && url.pathname === "/api/v1/writing-projects") {
      try {
        await initVault(VAULT_PATH);
        const limit = Number(url.searchParams.get("limit") || 8);
        const items = await listWritingProjects(VAULT_PATH, {
          limit,
          q: url.searchParams.get("q") || "",
          status: url.searchParams.get("status") || "",
          hasDraft: url.searchParams.get("hasDraft") || ""
        });
        return sendJson(res, 200, {
          items,
          total: items.length,
          requestId: rid,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        return sendJson(res, 400, err("WRITING_PROJECT_INVALID", String(error?.message || error), rid));
      }
    }

    const writingProjectMatch = url.pathname.match(/^\/api\/v1\/writing-projects\/([^/]+)$/);
    if (req.method === "PATCH" && writingProjectMatch) {
      const body = await readJson(req);
      try {
        await initVault(VAULT_PATH);
        const item = await syncWritingProject(VAULT_PATH, decodeURIComponent(writingProjectMatch[1]), body);
        return sendJson(res, 200, {
          item,
          requestId: rid,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        return sendJson(res, 400, err("WRITING_PROJECT_INVALID", String(error?.message || error), rid, error?.details));
      }
    }
    if (req.method === "GET" && writingProjectMatch) {
      try {
        await initVault(VAULT_PATH);
        const item = await getWritingProject(VAULT_PATH, decodeURIComponent(writingProjectMatch[1]));
        return sendJson(res, 200, {
          item,
          requestId: rid,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        return sendJson(res, 400, err("WRITING_PROJECT_INVALID", String(error?.message || error), rid));
      }
    }

    const writingProjectIntentMatch = url.pathname.match(/^\/api\/v1\/writing-projects\/([^/]+)\/intent$/);
    if (req.method === "PATCH" && writingProjectIntentMatch) {
      const body = await readJson(req);
      try {
        await initVault(VAULT_PATH);
        const item = await updateWritingProjectIntent(VAULT_PATH, decodeURIComponent(writingProjectIntentMatch[1]), body);
        return sendJson(res, 200, {
          item,
          requestId: rid,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        return sendJson(res, 400, err("WRITING_PROJECT_INTENT_INVALID", String(error?.message || error), rid, error?.details));
      }
    }

    const writingProjectBookStructureMatch = url.pathname.match(/^\/api\/v1\/writing-projects\/([^/]+)\/book-structure$/);
    if (req.method === "PATCH" && writingProjectBookStructureMatch) {
      const body = await readJson(req);
      try {
        await initVault(VAULT_PATH);
        const item = await updateWritingProjectBookStructure(VAULT_PATH, decodeURIComponent(writingProjectBookStructureMatch[1]), body);
        return sendJson(res, 200, {
          item,
          requestId: rid,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        return sendJson(res, 400, err("WRITING_PROJECT_BOOK_STRUCTURE_INVALID", String(error?.message || error), rid, error?.details));
      }
    }

    const writingDraftBindingMatch = url.pathname.match(/^\/api\/v1\/writing-projects\/([^/]+)\/draft-note$/);
    if (req.method === "POST" && writingDraftBindingMatch) {
      const body = await readJson(req);
      try {
        await initVault(VAULT_PATH);
        const item = await bindDraftNoteToProject(VAULT_PATH, {
          writingProjectId: decodeURIComponent(writingDraftBindingMatch[1]),
          draftNoteId: body.draftNoteId || body.draft_note_id,
          sourceScaffoldId: body.sourceScaffoldId || body.source_scaffold_id,
          versionNote: body.versionNote || body.version_note
        });
        return sendJson(res, 200, {
          item,
          requestId: rid,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        return sendJson(res, 400, err("WRITING_PROJECT_INVALID", String(error?.message || error), rid));
      }
    }

    const writingCurrentDraftMatch = url.pathname.match(/^\/api\/v1\/writing-projects\/([^/]+)\/current-draft$/);
    if (req.method === "POST" && writingCurrentDraftMatch) {
      const body = await readJson(req);
      try {
        await initVault(VAULT_PATH);
        const item = await setCurrentDraftNote(VAULT_PATH, {
          writingProjectId: decodeURIComponent(writingCurrentDraftMatch[1]),
          draftNoteId: body.draftNoteId || body.draft_note_id
        });
        return sendJson(res, 200, {
          item,
          requestId: rid,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        return sendJson(res, 400, err("WRITING_PROJECT_INVALID", String(error?.message || error), rid));
      }
    }

    const writingDraftVersionsMatch = url.pathname.match(/^\/api\/v1\/writing-projects\/([^/]+)\/draft-versions$/);
    if (req.method === "GET" && writingDraftVersionsMatch) {
      try {
        await initVault(VAULT_PATH);
        const item = await listProjectDraftVersions(
          VAULT_PATH,
          decodeURIComponent(writingDraftVersionsMatch[1]),
          { limit: Number(url.searchParams.get("limit") || 12) }
        );
        return sendJson(res, 200, {
          items: item,
          total: item.length,
          requestId: rid,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        return sendJson(res, 400, err("WRITING_PROJECT_INVALID", String(error?.message || error), rid));
      }
    }

    const writingProjectScaffoldsMatch = url.pathname.match(/^\/api\/v1\/writing-projects\/([^/]+)\/scaffolds$/);
    if (req.method === "GET" && writingProjectScaffoldsMatch) {
      try {
        await initVault(VAULT_PATH);
        const item = await listProjectScaffolds(
          VAULT_PATH,
          decodeURIComponent(writingProjectScaffoldsMatch[1]),
          { limit: Number(url.searchParams.get("limit") || 12) }
        );
        return sendJson(res, 200, {
          items: item,
          total: item.length,
          requestId: rid,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        return sendJson(res, 400, err("DRAFT_SCAFFOLD_INVALID", String(error?.message || error), rid));
      }
    }

    if (req.method === "POST" && url.pathname === "/api/v1/draft-scaffolds") {
      const body = await readJson(req);
      try {
        await initVault(VAULT_PATH);
        const item = await createDraftScaffold(VAULT_PATH, body);
        return sendJson(res, 201, {
          item,
          export: {
              json: {
                id: item.id,
                writing_project_id: item.writing_project_id,
                sections: item.sections,
                open_questions: item.open_questions,
                preflight: item.preflight || null,
                generated_by: item.generated_by,
                version_note: item.version_note || "",
                created_at: item.created_at,
                updated_at: item.updated_at
              },
            markdown: item.markdown
          },
          requestId: rid,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        return sendJson(res, 400, err("DRAFT_SCAFFOLD_INVALID", String(error?.message || error), rid));
      }
    }

    const draftScaffoldMatch = url.pathname.match(/^\/api\/v1\/draft-scaffolds\/([^/]+)$/);
    if (req.method === "GET" && draftScaffoldMatch) {
      try {
        await initVault(VAULT_PATH);
        const item = await getDraftScaffold(VAULT_PATH, decodeURIComponent(draftScaffoldMatch[1]));
        return sendJson(res, 200, {
          item,
          export: {
              json: {
                id: item.id,
                writing_project_id: item.writing_project_id,
                sections: item.sections,
                open_questions: item.open_questions,
                preflight: item.preflight || null,
                generated_by: item.generated_by,
                version_note: item.version_note || "",
                created_at: item.created_at,
                updated_at: item.updated_at
              },
            markdown: item.markdown
          },
          requestId: rid,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        return sendJson(res, 400, err("DRAFT_SCAFFOLD_INVALID", String(error?.message || error), rid));
      }
    }

    if (req.method === "PATCH" && draftScaffoldMatch) {
      const body = await readJson(req);
      try {
        await initVault(VAULT_PATH);
        const item = Array.isArray(body.sections)
          ? await updateDraftScaffold(VAULT_PATH, decodeURIComponent(draftScaffoldMatch[1]), body)
          : await updateDraftScaffoldVersionNote(VAULT_PATH, decodeURIComponent(draftScaffoldMatch[1]), body);
        return sendJson(res, 200, {
          item,
          requestId: rid,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        return sendJson(res, 400, err("DRAFT_SCAFFOLD_INVALID", String(error?.message || error), rid));
      }
    }

    const draftNoteVersionMatch = url.pathname.match(/^\/api\/v1\/draft-note-versions\/([^/]+)$/);
    if (req.method === "PATCH" && draftNoteVersionMatch) {
      const body = await readJson(req);
      try {
        await initVault(VAULT_PATH);
        const item = await updateDraftNoteVersionNote(VAULT_PATH, decodeURIComponent(draftNoteVersionMatch[1]), body);
        return sendJson(res, 200, {
          item,
          requestId: rid,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        return sendJson(res, 400, err("WRITING_PROJECT_INVALID", String(error?.message || error), rid));
      }
    }


    // Desktop mode: serve mobile page and static files for phone access
    if (req.method === "GET") {
      if (url.pathname === "/mobile" || url.pathname === "/app/mobile") {
        const mobileHtmlPath = path.join(MOBILE_WEB_DIR, "mobile.html");
        try {
          const raw = await fs.readFile(mobileHtmlPath, "utf8");
          const html = raw.replaceAll('"__MOBILE_API_BASE__"', JSON.stringify("/mobile/api"));
          return sendHtml(res, 200, html);
        } catch (error) {
          return sendJson(res, 500, err("MOBILE_PAGE_ERROR", "Mobile page not found in runtime.", rid));
        }
      }
      if (url.pathname === "/mobile.js") {
        const filePath = path.join(MOBILE_WEB_DIR, "mobile.js");
        try {
          const content = await fs.readFile(filePath, "utf8");
          res.writeHead(200, { "Content-Type": "text/javascript; charset=utf-8" });
          res.end(content);
          return;
        } catch {
          return sendJson(res, 404, err("MOBILE_JS_NOT_FOUND", "mobile.js not found", rid));
        }
      }
      if (url.pathname === "/mobile.css") {
        const filePath = path.join(MOBILE_WEB_DIR, "mobile.css");
        try {
          const content = await fs.readFile(filePath, "utf8");
          res.writeHead(200, { "Content-Type": "text/css; charset=utf-8" });
          res.end(content);
          return;
        } catch {
          return sendJson(res, 404, err("MOBILE_CSS_NOT_FOUND", "mobile.css not found", rid));
        }
      }
    }
    return sendJson(res, 404, err("NOT_FOUND", "Route not found", rid));
  } catch (error) {
    const status = Number(error?.status || 500);
    return sendJson(res, status, err(error?.code || "INTERNAL_ERROR", String(error?.message || error), rid, error?.details));
  } finally {
    releaseWrite?.();
  }
});

server.listen(PORT, HOST, async () => {
  console.log(`API running on http://${HOST}:${PORT}`);
  console.log(`Vault path: ${VAULT_PATH}`);
  try {
    await initVault(VAULT_PATH);
    AI_SECRET_STATE_PATH = path.resolve(VAULT_PATH, ".yansilu", "ai-secrets.json");
    apiReady = true;
    apiStartupError = "";
    console.log("Vault initialized.");
  } catch (error) {
    apiReady = false;
    apiStartupError = String(error?.message || error);
    console.error(`Vault initialization failed: ${apiStartupError}`);
  }
});
