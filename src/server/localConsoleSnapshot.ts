import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  loadEnvironment,
  loadEnvironmentSource,
} from "../config/loadEnvironment";
import { buildBackupDryRunManifest } from "../backup";
import { rinLive2dBodyAdapter } from "../body";
import type { LocalConsoleSnapshot } from "../console/types";
import { readSemanticContextConfig } from "../context/semanticContextConfig";
import { listRecentConversations } from "../conversation";
import { inspectRinDatabase } from "../database";
import { openRinDatabase } from "../database";
import { getMemoryCounts, listMemoryItems } from "../memory";
import {
  getModelRuntimeStatus,
  getOllamaRuntimeOptions,
  loadModelRuntimeConfig,
  OLLAMA_ADAPTER_ID,
} from "../model";
import {
  createDataLayout,
  inspectCoreStateFiles,
  parseRinDataManifest,
} from "../storage";

type JsonRecord = Record<string, unknown>;

export async function readLocalConsoleSnapshot(
  cwd: string = process.cwd(),
): Promise<LocalConsoleSnapshot> {
  const environmentSource = loadEnvironmentSource(cwd);
  const environment = loadEnvironment(environmentSource);
  const layout = createDataLayout(environment.dataDir, cwd);
  const coreFiles = await inspectCoreStateFiles(layout);
  const manifestResult = await readManifest(layout.manifestPath);
  const databaseResult = readDatabase(layout);
  const memoryCounts = readMemoryCounts(layout);
  const identity = await readJsonFile(join(layout.rootDir, "config/ai_identity.json"));
  const ownerModel = await readJsonFile(join(layout.rootDir, "config/user_model.json"));
  const aiState = await readJsonFile(join(layout.rootDir, "config/ai_state.json"));
  const modelConfig = await loadModelRuntimeConfig(layout);
  const modelStatus = getModelRuntimeStatus(modelConfig, environmentSource);
  const ollamaConfig = readOllamaSnapshotConfig(modelConfig, environmentSource);
  const semanticContext = readSemanticContextConfig(environmentSource);
  const backupManifest = await buildBackupDryRunManifest(layout);

  return {
    ok:
      manifestResult.status === "ok" &&
      coreFiles.every((coreFile) => coreFile.exists) &&
      databaseResult.status === "ok",
    generatedAt: new Date().toISOString(),
    dataDir: layout.rootDir,
    manifest: manifestResult.manifest,
    manifestStatus: manifestResult.status,
    coreFiles,
    database: databaseResult.database,
    databaseStatus: databaseResult.status,
    memory: memoryCounts,
    recentConversations:
      databaseResult.status === "ok" ? listRecentConversations(layout, 5) : [],
    identity: {
      name: readString(identity, "name"),
      status: readString(identity, "status"),
      english: readNestedString(identity, "coreIdentity", "english"),
      chinese: readNestedString(identity, "coreIdentity", "chinese"),
    },
    ownerModel: {
      status: readString(ownerModel, "status"),
      english: readNestedString(ownerModel, "summary", "english"),
      chinese: readNestedString(ownerModel, "summary", "chinese"),
      interests: readArrayLength(ownerModel, "interests"),
      communicationPreferences: readArrayLength(
        ownerModel,
        "communicationPreferences",
      ),
      currentProjects: readArrayLength(ownerModel, "currentProjects"),
      longTermGoals: readArrayLength(ownerModel, "longTermGoals"),
    },
    aiState: {
      mood: readString(aiState, "mood"),
      energy: readString(aiState, "energy"),
      attention: readString(aiState, "attention"),
      expression: readString(aiState, "expression"),
      initiative: readString(aiState, "initiative"),
    },
    modelConfig: {
      activeAdapter: modelStatus.activeAdapter,
      selectedProvider: modelStatus.selectedProvider,
      adapterCount: modelStatus.adapterCount,
      apiKeysStoredHere: modelStatus.apiKeysStoredHere,
      externalCallsEnabled: modelStatus.externalCallsEnabled,
      localCallsConfigured: modelStatus.localCallsConfigured,
      missingEnvironment: modelStatus.missingEnvironment,
      ollama:
        modelStatus.activeAdapter === OLLAMA_ADAPTER_ID ? ollamaConfig : null,
    },
    portability: {
      exportBundles: databaseResult.database?.counts.exportBundles ?? 0,
    },
    operationalStatus: {
      model: {
        activeAdapter: modelStatus.activeAdapter,
        externalCallsEnabled: modelStatus.externalCallsEnabled,
        localCallsConfigured: modelStatus.localCallsConfigured,
      },
      memory: {
        accepted: memoryCounts.accepted,
        proposals: memoryCounts.proposals,
        rejected: memoryCounts.rejected,
        archived: memoryCounts.archived,
      },
      semantic: {
        contextExpansionEnabled: semanticContext.enabled,
        mode: semanticContext.mode,
        providerCallCount: 0,
      },
      agentRuntime: {
        actionExecutionActive: false,
        toolExecutionActive: false,
        plannerActive: false,
        taskAutonomyActive: false,
        legacyToolInvocationCount:
          databaseResult.database?.counts.toolInvocations ?? 0,
      },
      backup: {
        dryRunAvailable: true,
        restoreDryRunAvailable: true,
        fileCount: backupManifest.fileCount,
        archiveCreated: backupManifest.archiveCreated,
        cloudSyncEnabled: backupManifest.cloudSyncEnabled,
      },
    },
    body: {
      adapterId: rinLive2dBodyAdapter.id,
      state: rinLive2dBodyAdapter.mapState(aiState),
      live2dReady: true,
    },
    featureGates: [
      {
        key: "chat-runtime",
        english: "Basic local conversation runtime uses the configured model adapter.",
        chinese: "基础本地对话运行时使用已配置的模型 adapter。",
        enabled: true,
      },
      {
        key: "model-calls",
        english:
          "Live model calls are available only through an explicitly configured model adapter.",
        chinese: "真实模型调用只能通过显式配置的模型 adapter 启用。",
        enabled: modelStatus.externalCallsEnabled || modelStatus.localCallsConfigured,
      },
      {
        key: "memory-writes",
        english: "MemoryManager creates proposals first; accepted memory writes require local review.",
        chinese: "MemoryManager 会先创建提案；接受长期记忆写入需要本地审查。",
        enabled: true,
      },
      {
        key: "agent-complexity",
        english:
          "General Agent actions, planner, tasks, tools, MCP, and L0-L5 permissions are decommissioned in v2.",
        chinese:
          "通用 Agent 动作、planner、task、tool、MCP 与 L0-L5 权限体系已在 v2 中退役。",
        enabled: false,
      },
      {
        key: "body-shell",
        english: "The clean body view supports local-only drag, click reactions, and a temporary bubble layer.",
        chinese: "干净身体视图支持仅本地的拖拽、点击反应和临时气泡层。",
        enabled: true,
      },
    ],
  };
}

function readOllamaSnapshotConfig(
  modelConfig: Awaited<ReturnType<typeof loadModelRuntimeConfig>>,
  source: ReturnType<typeof loadEnvironmentSource>,
): LocalConsoleSnapshot["modelConfig"]["ollama"] {
  const adapter = modelConfig.adapters.find(
    (config) => config.id === OLLAMA_ADAPTER_ID,
  );

  if (!adapter) {
    return null;
  }

  const options = getOllamaRuntimeOptions(adapter, source);

  return {
    baseUrl: options.baseUrl,
    model: options.model,
    timeoutMs: options.timeoutMs,
    numPredict: options.generationOptions.numPredict,
    temperature: options.generationOptions.temperature,
    topP: options.generationOptions.topP,
    invalidEnvironment: options.invalidEnvironment,
  };
}

function readMemoryCounts(
  layout: ReturnType<typeof createDataLayout>,
): LocalConsoleSnapshot["memory"] {
  try {
    const database = openRinDatabase(layout);
    try {
      return {
        ...getMemoryCounts(database),
        recent: listMemoryItems(database, { limit: 8 }),
      };
    } finally {
      database.close();
    }
  } catch {
    return { proposals: 0, accepted: 0, rejected: 0, archived: 0, recent: [] };
  }
}

function readDatabase(
  layout: ReturnType<typeof createDataLayout>,
): {
  database: LocalConsoleSnapshot["database"];
  status: LocalConsoleSnapshot["databaseStatus"];
} {
  try {
    return { database: inspectRinDatabase(layout), status: "ok" };
  } catch {
    return { database: null, status: "invalid" };
  }
}

async function readManifest(
  manifestPath: string,
): Promise<{
  manifest: LocalConsoleSnapshot["manifest"];
  status: LocalConsoleSnapshot["manifestStatus"];
}> {
  try {
    return {
      manifest: parseRinDataManifest(await readFile(manifestPath, "utf8")),
      status: "ok",
    };
  } catch (error) {
    if (isMissingFileError(error)) {
      return { manifest: null, status: "missing" };
    }

    return { manifest: null, status: "invalid" };
  }
}

async function readJsonFile(absolutePath: string): Promise<JsonRecord> {
  try {
    const parsed: unknown = JSON.parse(await readFile(absolutePath, "utf8"));
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function readString(record: JsonRecord, key: string): string | null {
  return typeof record[key] === "string" ? record[key] : null;
}

function readNestedString(
  record: JsonRecord,
  parentKey: string,
  childKey: string,
): string | null {
  const parent = record[parentKey];

  return isRecord(parent) && typeof parent[childKey] === "string"
    ? parent[childKey]
    : null;
}

function readArrayLength(record: JsonRecord, key: string): number {
  return Array.isArray(record[key]) ? record[key].length : 0;
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isMissingFileError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ENOENT"
  );
}
