import { randomUUID } from "node:crypto";
import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { appendAuditEvent, openRinDatabase } from "../database";
import type { RinDataLayout } from "../storage";

export type ExportBundleResult = {
  id: string;
  bundlePath: string;
  manifestPath: string;
  createdAt: string;
};

export async function exportAgentStateBundle(
  layout: RinDataLayout,
  now: Date = new Date(),
): Promise<ExportBundleResult> {
  await mkdir(layout.directories.bundles, { recursive: true });
  const id = randomUUID();
  const createdAt = now.toISOString();
  const safeTimestamp = createdAt.replaceAll(":", "-");
  const bundlePath = join(layout.directories.bundles, `agent-state-${safeTimestamp}`);
  const manifestPath = join(bundlePath, "manifest.json");

  await mkdir(bundlePath, { recursive: true });
  await cp(join(layout.rootDir, "config"), join(bundlePath, "config"), {
    recursive: true,
  });
  await cp(join(layout.rootDir, "databases"), join(bundlePath, "databases"), {
    recursive: true,
  });

  const sourceManifest = JSON.parse(
    await readFile(join(layout.rootDir, "manifest.json"), "utf8"),
  ) as Record<string, unknown>;
  const bundleManifest = {
    bundleId: id,
    createdAt,
    sourceManifest,
    includes: ["config", "databases"],
    note: {
      english: "Manual local export bundle. Cloud sync is not implemented.",
      chinese: "手动本地导出包。尚未实现云同步。",
    },
  };

  await writeFile(manifestPath, `${JSON.stringify(bundleManifest, null, 2)}\n`, "utf8");

  const database = openRinDatabase(layout);
  try {
    database
      .prepare(
        `
          INSERT INTO export_bundles (id, bundle_path, manifest_json, created_at)
          VALUES (?, ?, ?, ?)
        `,
      )
      .run(id, bundlePath, JSON.stringify(bundleManifest), createdAt);
    appendAuditEvent(database, {
      eventType: "bundle.exported",
      payload: { bundleId: id, bundlePath },
      now,
    });
  } finally {
    database.close();
  }

  return { id, bundlePath, manifestPath, createdAt };
}
