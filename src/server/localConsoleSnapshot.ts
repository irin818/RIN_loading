import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { loadEnvironment } from "../config/loadEnvironment";
import { rinLive2dBodyAdapter } from "../body";
import type { LocalConsoleSnapshot } from "../console/types";
import { listRecentConversations } from "../conversation";
import { inspectRinDatabase } from "../database";
import { openRinDatabase } from "../database";
import { getMemoryCounts } from "../memory";
import { listTools, registerBuiltinTools } from "../tools";
import {
  createDataLayout,
  inspectCoreStateFiles,
  parseRinDataManifest,
} from "../storage";

type JsonRecord = Record<string, unknown>;

export async function readLocalConsoleSnapshot(
  cwd: string = process.cwd(),
): Promise<LocalConsoleSnapshot> {
  const environment = loadEnvironment();
  const layout = createDataLayout(environment.dataDir, cwd);
  const coreFiles = await inspectCoreStateFiles(layout);
  const manifestResult = await readManifest(layout.manifestPath);
  const databaseResult = readDatabase(layout);
  const memoryCounts = readMemoryCounts(layout);
  const identity = await readJsonFile(join(layout.rootDir, "config/ai_identity.json"));
  const ownerModel = await readJsonFile(join(layout.rootDir, "config/user_model.json"));
  const aiState = await readJsonFile(join(layout.rootDir, "config/ai_state.json"));
  const permissions = await readJsonFile(join(layout.rootDir, "config/permissions.json"));
  const modelConfig = await readJsonFile(join(layout.rootDir, "config/model_config.json"));
  const toolRegistry = await readJsonFile(join(layout.rootDir, "config/tool_registry.json"));
  registerBuiltinTools();

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
    permissions: {
      defaultRequiresConfirmationFrom: readString(
        permissions,
        "defaultRequiresConfirmationFrom",
      ),
      forbiddenAutomaticActions: readStringArray(
        permissions,
        "forbiddenAutomaticActions",
      ),
      riskLevels: readStringRecord(permissions, "riskLevels"),
    },
    modelConfig: {
      activeAdapter: readString(modelConfig, "activeAdapter"),
      adapterCount: readArrayLength(modelConfig, "adapters"),
      apiKeysStoredHere: readBoolean(modelConfig, "apiKeysStoredHere") ?? false,
    },
    toolRegistry: {
      toolCount: listTools().length + readArrayLength(toolRegistry, "tools"),
    },
    portability: {
      exportBundles: databaseResult.database?.counts.exportBundles ?? 0,
    },
    body: {
      adapterId: rinLive2dBodyAdapter.id,
      state: rinLive2dBodyAdapter.mapState(aiState),
      live2dReady: true,
    },
    featureGates: [
      {
        key: "chat-runtime",
        english: "Basic local conversation runtime uses the mock adapter only.",
        chinese: "基础本地对话运行时仅使用 mock adapter。",
        enabled: true,
      },
      {
        key: "model-calls",
        english: "External model calls are still not implemented.",
        chinese: "仍未实现外部模型调用。",
        enabled: false,
      },
      {
        key: "memory-writes",
        english: "MemoryManager can create proposals only; accepted memory writes remain gated.",
        chinese: "MemoryManager 只能创建提案；接受长期记忆写入仍受控。",
        enabled: true,
      },
      {
        key: "tool-execution",
        english: "Only built-in L0 tools can auto-execute through the permission gate.",
        chinese: "只有内置 L0 工具可通过权限网关自动执行。",
        enabled: true,
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

function readMemoryCounts(
  layout: ReturnType<typeof createDataLayout>,
): LocalConsoleSnapshot["memory"] {
  try {
    const database = openRinDatabase(layout);
    try {
      return getMemoryCounts(database);
    } finally {
      database.close();
    }
  } catch {
    return { proposals: 0, accepted: 0, rejected: 0, archived: 0 };
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

function readBoolean(record: JsonRecord, key: string): boolean | null {
  return typeof record[key] === "boolean" ? record[key] : null;
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

function readStringArray(record: JsonRecord, key: string): string[] {
  const value = record[key];

  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function readStringRecord(record: JsonRecord, key: string): Record<string, string> {
  const value = record[key];

  if (!isRecord(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );
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
