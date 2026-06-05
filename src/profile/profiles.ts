import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { ModelMessage } from "../model";
import type { RinDataLayout } from "../storage";

export type RinProfile = {
  schemaVersion: 1;
  kind: "rin_profile";
  updatedAt: string;
  displayName: string;
  role: string;
  communicationStyle: string[];
  behaviorBoundaries: string[];
  contextNotes: string[];
};

export type OwnerProfile = {
  schemaVersion: 1;
  kind: "owner_profile";
  ownerId: string;
  updatedAt: string;
  displayName: string;
  communicationPreferences: string[];
  stablePreferences: string[];
  activeProjects: string[];
  contextNotes: string[];
};

export type LoadedProfileContext = {
  rinProfile: RinProfile;
  ownerProfile: OwnerProfile;
  issues: ProfileValidationIssue[];
};

export type ProfileValidationIssue = {
  file: "rin_profile.json" | "owner_profile.json";
  code: string;
  message: string;
};

export type ProfileFileStatus = {
  file: "rin_profile.json" | "owner_profile.json";
  exists: boolean;
  valid: boolean;
  issueCount: number;
  summaryCounts: Record<string, number>;
};

export type ProfileReport = {
  mode: "profile-report";
  status: "valid" | "invalid";
  files: ProfileFileStatus[];
  issueCount: number;
  issues: ProfileValidationIssue[];
  contextCharacterCount: number;
  providerCallCount: 0;
  fullTextIncluded: false;
};

const RIN_PROFILE_FILE = "rin_profile.json";
const OWNER_PROFILE_FILE = "owner_profile.json";
const MAX_CONTEXT_CHARACTERS = 1200;
const MAX_ITEMS_PER_SECTION = 5;
const MAX_ITEM_CHARACTERS = 160;

export function createDefaultRinProfile(now: Date): RinProfile {
  return {
    schemaVersion: 1,
    kind: "rin_profile",
    updatedAt: now.toISOString(),
    displayName: "RIN",
    role: "local-first personal AI companion",
    communicationStyle: [
      "concise",
      "Chinese-friendly",
      "practical",
      "protects local-first continuity",
    ],
    behaviorBoundaries: [
      "Model output is advice, not authority.",
      "Do not rewrite profiles, memory, or identity automatically.",
      "Do not claim access to unavailable tools, files, or web pages.",
    ],
    contextNotes: [
      "Preserve owner-controlled identity, memory, policy, and continuity.",
    ],
  };
}

export function createDefaultOwnerProfile(
  ownerId: string,
  now: Date,
): OwnerProfile {
  return {
    schemaVersion: 1,
    kind: "owner_profile",
    ownerId,
    updatedAt: now.toISOString(),
    displayName: "Owner",
    communicationPreferences: [
      "direct",
      "actionable",
      "avoid unnecessary explanation",
    ],
    stablePreferences: [],
    activeProjects: ["RIN_loading"],
    contextNotes: [
      "Owner profile is manually editable local state and is not model-editable.",
    ],
  };
}

export async function loadProfileContext(
  layout: RinDataLayout,
): Promise<LoadedProfileContext> {
  const rinProfile = await readProfileJson(
    layout,
    RIN_PROFILE_FILE,
  ) as unknown;
  const ownerProfile = await readProfileJson(
    layout,
    OWNER_PROFILE_FILE,
  ) as unknown;
  const issues = [
    ...validateRinProfile(rinProfile),
    ...validateOwnerProfile(ownerProfile),
  ];

  return {
    rinProfile: issues.some((issue) => issue.file === RIN_PROFILE_FILE)
      ? createDefaultRinProfile(new Date(0))
      : (rinProfile as RinProfile),
    ownerProfile: issues.some((issue) => issue.file === OWNER_PROFILE_FILE)
      ? createDefaultOwnerProfile("local-owner", new Date(0))
      : (ownerProfile as OwnerProfile),
    issues,
  };
}

export async function validateProfiles(
  layout: RinDataLayout,
): Promise<ProfileReport> {
  return buildProfileReport(layout);
}

export async function buildProfileReport(
  layout: RinDataLayout,
): Promise<ProfileReport> {
  const context = await loadProfileContext(layout);
  const profileMessage = buildProfileContextMessage(context);
  const files = [
    fileStatus(RIN_PROFILE_FILE, context.rinProfile, context.issues),
    fileStatus(OWNER_PROFILE_FILE, context.ownerProfile, context.issues),
  ];

  return {
    mode: "profile-report",
    status: context.issues.length === 0 ? "valid" : "invalid",
    files,
    issueCount: context.issues.length,
    issues: context.issues,
    contextCharacterCount: profileMessage?.content.length ?? 0,
    providerCallCount: 0,
    fullTextIncluded: false,
  };
}

export function buildProfileContextMessage(
  context: LoadedProfileContext,
): ModelMessage | null {
  if (context.issues.length > 0) {
    return null;
  }

  const lines = [
    "Local owner-reviewed profile context:",
    "These profiles are manually editable local files. Do not modify or infer profile changes automatically.",
    `RIN display name: ${sanitizeInline(context.rinProfile.displayName)}`,
    `RIN role: ${sanitizeInline(context.rinProfile.role)}`,
    ...sectionLines("RIN style", context.rinProfile.communicationStyle),
    ...sectionLines("RIN boundaries", context.rinProfile.behaviorBoundaries),
    ...sectionLines("RIN notes", context.rinProfile.contextNotes),
    `Owner display name: ${sanitizeInline(context.ownerProfile.displayName)}`,
    ...sectionLines(
      "Owner communication",
      context.ownerProfile.communicationPreferences,
    ),
    ...sectionLines("Owner preferences", context.ownerProfile.stablePreferences),
    ...sectionLines("Owner projects", context.ownerProfile.activeProjects),
    ...sectionLines("Owner notes", context.ownerProfile.contextNotes),
  ];
  const content = lines.join("\n");

  return {
    role: "system",
    content:
      content.length > MAX_CONTEXT_CHARACTERS
        ? `${content.slice(0, MAX_CONTEXT_CHARACTERS - 3)}...`
        : content,
  };
}

export function formatProfileReport(report: ProfileReport): string {
  const lines = [
    "RIN profile report.",
    "Mode: profile-report",
    `Status: ${report.status}`,
    `Files: ${report.files.length}`,
    `Issues: ${report.issueCount}`,
    `Context characters: ${report.contextCharacterCount}`,
    `providerCallCount: ${report.providerCallCount}`,
    `Full text included: ${report.fullTextIncluded ? "yes" : "no"}`,
    "File summaries:",
    ...report.files.map(
      (file) =>
        `- ${file.file} exists=${file.exists ? "yes" : "no"} valid=${
          file.valid ? "yes" : "no"
        } issues=${file.issueCount} counts=${JSON.stringify(file.summaryCounts)}`,
    ),
  ];

  if (report.issues.length > 0) {
    lines.push("Issues:");
    for (const issue of report.issues) {
      lines.push(`- ${issue.file} ${issue.code}: ${issue.message}`);
    }
  }

  return lines.join("\n");
}

async function readProfileJson(
  layout: RinDataLayout,
  file: "rin_profile.json" | "owner_profile.json",
): Promise<unknown> {
  const raw = await readFile(join(layout.directories.config, file), "utf8");
  return JSON.parse(raw) as unknown;
}

function validateRinProfile(value: unknown): ProfileValidationIssue[] {
  const file = RIN_PROFILE_FILE;
  const issues = validateBaseProfile(value, file, "rin_profile");

  if (isRecord(value)) {
    requireString(value, "displayName", file, issues);
    requireString(value, "role", file, issues);
    requireStringArray(value, "communicationStyle", file, issues);
    requireStringArray(value, "behaviorBoundaries", file, issues);
    requireStringArray(value, "contextNotes", file, issues);
  }

  return issues;
}

function validateOwnerProfile(value: unknown): ProfileValidationIssue[] {
  const file = OWNER_PROFILE_FILE;
  const issues = validateBaseProfile(value, file, "owner_profile");

  if (isRecord(value)) {
    requireString(value, "ownerId", file, issues);
    requireString(value, "displayName", file, issues);
    requireStringArray(value, "communicationPreferences", file, issues);
    requireStringArray(value, "stablePreferences", file, issues);
    requireStringArray(value, "activeProjects", file, issues);
    requireStringArray(value, "contextNotes", file, issues);
  }

  return issues;
}

function validateBaseProfile(
  value: unknown,
  file: ProfileValidationIssue["file"],
  kind: string,
): ProfileValidationIssue[] {
  const issues: ProfileValidationIssue[] = [];

  if (!isRecord(value)) {
    issues.push({
      file,
      code: "invalid_json_object",
      message: "Profile file must contain a JSON object.",
    });
    return issues;
  }

  if (value.schemaVersion !== 1) {
    issues.push({
      file,
      code: "invalid_schema_version",
      message: "schemaVersion must be 1.",
    });
  }

  if (value.kind !== kind) {
    issues.push({
      file,
      code: "invalid_kind",
      message: `kind must be ${kind}.`,
    });
  }

  requireString(value, "updatedAt", file, issues);
  return issues;
}

function requireString(
  value: Record<string, unknown>,
  key: string,
  file: ProfileValidationIssue["file"],
  issues: ProfileValidationIssue[],
): void {
  if (typeof value[key] !== "string") {
    issues.push({
      file,
      code: `invalid_${key}`,
      message: `${key} must be a string.`,
    });
  }
}

function requireStringArray(
  value: Record<string, unknown>,
  key: string,
  file: ProfileValidationIssue["file"],
  issues: ProfileValidationIssue[],
): void {
  if (
    !Array.isArray(value[key]) ||
    !(value[key] as unknown[]).every((item) => typeof item === "string")
  ) {
    issues.push({
      file,
      code: `invalid_${key}`,
      message: `${key} must be an array of strings.`,
    });
  }
}

function fileStatus(
  file: ProfileFileStatus["file"],
  profile: RinProfile | OwnerProfile,
  issues: ProfileValidationIssue[],
): ProfileFileStatus {
  const fileIssues = issues.filter((issue) => issue.file === file);

  return {
    file,
    exists: true,
    valid: fileIssues.length === 0,
    issueCount: fileIssues.length,
    summaryCounts: summaryCounts(profile),
  };
}

function summaryCounts(profile: RinProfile | OwnerProfile): Record<string, number> {
  if (profile.kind === "rin_profile") {
    return {
      communicationStyle: profile.communicationStyle.length,
      behaviorBoundaries: profile.behaviorBoundaries.length,
      contextNotes: profile.contextNotes.length,
    };
  }

  return {
    communicationPreferences: profile.communicationPreferences.length,
    stablePreferences: profile.stablePreferences.length,
    activeProjects: profile.activeProjects.length,
    contextNotes: profile.contextNotes.length,
  };
}

function sectionLines(label: string, values: string[]): string[] {
  return values
    .slice(0, MAX_ITEMS_PER_SECTION)
    .map((value) => `- ${label}: ${sanitizeInline(value)}`);
}

function sanitizeInline(value: string): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > MAX_ITEM_CHARACTERS
    ? `${normalized.slice(0, MAX_ITEM_CHARACTERS - 3)}...`
    : normalized;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
