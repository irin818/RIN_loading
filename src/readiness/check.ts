import { readFile } from "node:fs/promises";
import {
  loadEnvironment,
  loadEnvironmentSource,
} from "../config/loadEnvironment";
import type { EnvironmentSource } from "../config/loadEnvironment";
import { inspectRinDatabase } from "../database";
import { getModelRuntimeStatus, loadModelRuntimeConfig } from "../model";
import {
  createDataLayout,
  inspectCoreStateFiles,
  parseRinDataManifest,
} from "../storage";

export type ReadinessStatus = "pass" | "warn" | "fail";

export type ReadinessCheck = {
  key: string;
  status: ReadinessStatus;
  english: string;
  chinese: string;
};

export type RinReadinessReport = {
  ok: boolean;
  readyForExternalModel: boolean;
  missingEnvironment: string[];
  checks: ReadinessCheck[];
};

export async function readRinReadiness(
  cwd: string = process.cwd(),
  source: EnvironmentSource = loadEnvironmentSource(cwd),
): Promise<RinReadinessReport> {
  const environment = loadEnvironment(source);
  const layout = createDataLayout(environment.dataDir, cwd);
  const checks: ReadinessCheck[] = [];
  const manifestStatus = await readManifestStatus(layout.manifestPath);
  const coreFiles = await inspectCoreStateFiles(layout);
  const databaseStatus = readDatabaseStatus(layout);
  const modelConfig = await loadModelRuntimeConfig(layout);
  const modelStatus = getModelRuntimeStatus(modelConfig, source);

  checks.push({
    key: "manifest",
    status: manifestStatus,
    english: "Local data manifest is present and valid.",
    chinese: "本地数据 manifest 存在且有效。",
  });
  checks.push({
    key: "core-files",
    status: coreFiles.every((file) => file.exists) ? "pass" : "fail",
    english: "Core local config files are present.",
    chinese: "核心本地配置文件存在。",
  });
  checks.push({
    key: "database",
    status: databaseStatus,
    english: "SQLite database is present and inspectable.",
    chinese: "SQLite 数据库存在且可检查。",
  });
  checks.push({
    key: "model-adapter",
    status:
      modelStatus.selectedProvider === "openai-compatible" &&
      !modelStatus.externalCallsEnabled
        ? "warn"
        : "pass",
    english:
      modelStatus.externalCallsEnabled || modelStatus.selectedProvider === "mock"
        ? "Model adapter configuration is runnable."
        : "External model adapter is selected but missing environment variables.",
    chinese:
      modelStatus.externalCallsEnabled || modelStatus.selectedProvider === "mock"
        ? "模型 adapter 配置可运行。"
        : "已选择外部模型 adapter，但缺少环境变量。",
  });
  checks.push({
    key: "api-key-storage",
    status: modelStatus.apiKeysStoredHere ? "fail" : "pass",
    english: "API keys are not stored in local core config.",
    chinese: "API Key 未存储在本地核心配置中。",
  });
  checks.push({
    key: "external-model",
    status: modelStatus.externalCallsEnabled ? "pass" : "warn",
    english: modelStatus.externalCallsEnabled
      ? "External model calls are configured."
      : "External model calls are not active; provide API environment variables when ready.",
    chinese: modelStatus.externalCallsEnabled
      ? "外部模型调用已配置。"
      : "外部模型调用尚未启用；准备好时提供 API 环境变量即可。",
  });

  return {
    ok: checks.every((check) => check.status !== "fail"),
    readyForExternalModel: modelStatus.externalCallsEnabled,
    missingEnvironment: modelStatus.missingEnvironment,
    checks,
  };
}

async function readManifestStatus(
  manifestPath: string,
): Promise<ReadinessStatus> {
  try {
    parseRinDataManifest(await readFile(manifestPath, "utf8"));
    return "pass";
  } catch {
    return "fail";
  }
}

function readDatabaseStatus(
  layout: ReturnType<typeof createDataLayout>,
): ReadinessStatus {
  try {
    inspectRinDatabase(layout);
    return "pass";
  } catch {
    return "fail";
  }
}
