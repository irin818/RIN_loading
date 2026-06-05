import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { RinEnvironment } from "../config/environment";
import { createDefaultModelRuntimeConfig } from "../model/config";
import {
  createDefaultOwnerProfile,
  createDefaultRinProfile,
} from "../profile/profiles";
import type { RinDataLayout } from "./paths";

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export type CoreStateFileDefinition = {
  key: string;
  relativePath: string;
  english: string;
  chinese: string;
  create: (environment: RinEnvironment, now: Date) => JsonValue;
};

export type CoreStateFileStatus = {
  key: string;
  relativePath: string;
  exists: boolean;
  created: boolean;
  english: string;
  chinese: string;
};

export const CORE_STATE_FILE_DEFINITIONS: CoreStateFileDefinition[] = [
  {
    key: "user-model",
    relativePath: "config/user_model.json",
    english: "Slow-variable owner model placeholder.",
    chinese: "慢变量所有者模型占位文件。",
    create: (environment, now) => ({
      schemaVersion: 1,
      kind: "user_model",
      ownerId: environment.ownerId,
      updatedAt: now.toISOString(),
      status: "placeholder",
      summary: {
        english: "No long-term owner model has been learned yet.",
        chinese: "尚未学习任何长期所有者模型。",
      },
      interests: [],
      communicationPreferences: [],
      currentProjects: [],
      longTermGoals: [],
      notes: [],
    }),
  },
  {
    key: "ai-identity",
    relativePath: "config/ai_identity.json",
    english: "Local AI identity model placeholder.",
    chinese: "本地 AI 身份模型占位文件。",
    create: (_environment, now) => ({
      schemaVersion: 1,
      kind: "ai_identity",
      name: "RIN",
      updatedAt: now.toISOString(),
      status: "placeholder",
      coreIdentity: {
        english:
          "RIN is a local-first personal agent system. External models are replaceable reasoning engines.",
        chinese:
          "RIN 是本地优先的个人智能体系统。外部模型只是可替换的推理引擎。",
      },
      relationshipToOwner: "single-owner private assistant",
      behaviorBoundaries: [
        "Do not treat external model output as authority.",
        "Do not modify slow variables without controlled update flow.",
      ],
    }),
  },
  {
    key: "ai-state",
    relativePath: "config/ai_state.json",
    english: "Local interaction state placeholder for future embodiment.",
    chinese: "用于未来具身化的本地交互状态占位文件。",
    create: (_environment, now) => ({
      schemaVersion: 1,
      kind: "ai_state",
      updatedAt: now.toISOString(),
      mood: "neutral",
      energy: "normal",
      attention: "idle",
      engagement: "low",
      confidence: "unset",
      cognitiveLoad: "low",
      initiative: "owner-led",
      expression: "neutral",
      motion: "none",
      voiceStyle: "unset",
      note: {
        english: "State is an interaction control mechanism, not proof of emotion.",
        chinese: "状态是一种交互控制机制，不是真实情绪的证明。",
      },
    }),
  },
  {
    key: "policy-config",
    relativePath: "config/policy_config.json",
    english: "Local policy configuration placeholder.",
    chinese: "本地策略配置占位文件。",
    create: (_environment, now) => ({
      schemaVersion: 1,
      kind: "policy_config",
      updatedAt: now.toISOString(),
      slowVariablesControlFastVariables: true,
      externalContentIsInstruction: false,
      modelOutputIsAuthority: false,
      toolOutputIsInstruction: false,
    }),
  },
  {
    key: "model-config",
    relativePath: "config/model_config.json",
    english: "Provider-neutral model configuration and adapter selection.",
    chinese: "服务商中立的模型配置与 adapter 选择。",
    create: (_environment, now) => createDefaultModelRuntimeConfig(now),
  },
  {
    key: "rin-profile",
    relativePath: "config/rin_profile.json",
    english: "Manually editable local RIN profile.",
    chinese: "可手动编辑的本地 RIN profile。",
    create: (_environment, now) => createDefaultRinProfile(now),
  },
  {
    key: "owner-profile",
    relativePath: "config/owner_profile.json",
    english: "Manually editable local owner profile.",
    chinese: "可手动编辑的本地 owner profile。",
    create: (environment, now) => createDefaultOwnerProfile(environment.ownerId, now),
  },
];

export async function ensureCoreStateFiles(
  environment: RinEnvironment,
  layout: RinDataLayout,
  now: Date,
): Promise<CoreStateFileStatus[]> {
  await mkdir(layout.directories.config, { recursive: true });
  await mkdir(layout.directories.logs, { recursive: true });

  const statuses = await Promise.all(
    CORE_STATE_FILE_DEFINITIONS.map((definition) =>
      ensureCoreJsonFile(definition, environment, layout, now),
    ),
  );

  const auditLogStatus = await ensureTextFile(
    join(layout.rootDir, "logs/audit_log.jsonl"),
    "",
  );

  return [
    ...statuses,
    {
      key: "audit-log",
      relativePath: "logs/audit_log.jsonl",
      exists: true,
      created: auditLogStatus.created,
      english: "Append-only audit log placeholder.",
      chinese: "追加式审计日志占位文件。",
    },
  ];
}

export async function inspectCoreStateFiles(
  layout: RinDataLayout,
): Promise<CoreStateFileStatus[]> {
  const definitionStatuses = await Promise.all(
    CORE_STATE_FILE_DEFINITIONS.map(async (definition) => ({
      key: definition.key,
      relativePath: definition.relativePath,
      exists: await fileExists(join(layout.rootDir, definition.relativePath)),
      created: false,
      english: definition.english,
      chinese: definition.chinese,
    })),
  );

  return [
    ...definitionStatuses,
    {
      key: "audit-log",
      relativePath: "logs/audit_log.jsonl",
      exists: await fileExists(join(layout.rootDir, "logs/audit_log.jsonl")),
      created: false,
      english: "Append-only audit log placeholder.",
      chinese: "追加式审计日志占位文件。",
    },
  ];
}

async function ensureCoreJsonFile(
  definition: CoreStateFileDefinition,
  environment: RinEnvironment,
  layout: RinDataLayout,
  now: Date,
): Promise<CoreStateFileStatus> {
  const absolutePath = join(layout.rootDir, definition.relativePath);
  const existing = await fileExists(absolutePath);

  if (!existing) {
    await writeFile(
      absolutePath,
      `${JSON.stringify(definition.create(environment, now), null, 2)}\n`,
      "utf8",
    );
  } else {
    await readFile(absolutePath, "utf8");
  }

  return {
    key: definition.key,
    relativePath: definition.relativePath,
    exists: true,
    created: !existing,
    english: definition.english,
    chinese: definition.chinese,
  };
}

async function ensureTextFile(
  absolutePath: string,
  content: string,
): Promise<{ created: boolean }> {
  const existing = await fileExists(absolutePath);

  if (!existing) {
    await writeFile(absolutePath, content, "utf8");
  }

  return { created: !existing };
}

async function fileExists(absolutePath: string): Promise<boolean> {
  try {
    await access(absolutePath);
    return true;
  } catch (error) {
    if (isMissingFileError(error)) {
      return false;
    }

    throw error;
  }
}

function isMissingFileError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ENOENT"
  );
}
