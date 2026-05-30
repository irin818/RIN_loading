import type { RinDataManifest } from "../storage";
import type { CoreStateFileStatus } from "../storage/coreFiles";
import type { DatabaseStatus } from "../database";
import type {
  ConversationMessageRecord,
  ConversationRecord,
  ConversationTurnResult,
} from "../conversation";
import type { BodyState } from "../body";
import type { MemoryRecord } from "../memory";

export type LocalConsoleSnapshot = {
  ok: boolean;
  generatedAt: string;
  dataDir: string;
  manifest: RinDataManifest | null;
  manifestStatus: "ok" | "missing" | "invalid";
  coreFiles: CoreStateFileStatus[];
  database: DatabaseStatus | null;
  databaseStatus: "ok" | "missing" | "invalid";
  memory: {
    proposals: number;
    accepted: number;
    rejected: number;
    archived: number;
    recent: MemoryRecord[];
  };
  recentConversations: ConversationRecord[];
  identity: {
    name: string | null;
    status: string | null;
    english: string | null;
    chinese: string | null;
  };
  ownerModel: {
    status: string | null;
    english: string | null;
    chinese: string | null;
    interests: number;
    communicationPreferences: number;
    currentProjects: number;
    longTermGoals: number;
  };
  aiState: {
    mood: string | null;
    energy: string | null;
    attention: string | null;
    expression: string | null;
    initiative: string | null;
  };
  permissions: {
    defaultRequiresConfirmationFrom: string | null;
    forbiddenAutomaticActions: string[];
    riskLevels: Record<string, string>;
  };
  modelConfig: {
    activeAdapter: string | null;
    selectedProvider: string;
    adapterCount: number;
    apiKeysStoredHere: boolean;
    externalCallsEnabled: boolean;
    missingEnvironment: string[];
  };
  toolRegistry: {
    toolCount: number;
  };
  portability: {
    exportBundles: number;
  };
  body: {
    adapterId: string;
    state: BodyState;
    live2dReady: boolean;
  };
  featureGates: Array<{
    key: string;
    english: string;
    chinese: string;
    enabled: boolean;
  }>;
};

export type ConversationTurnResponse = {
  ok: true;
  turn: ConversationTurnResult;
  snapshot: LocalConsoleSnapshot;
};

export type ConversationListResponse = {
  ok: true;
  conversations: ConversationRecord[];
  snapshot: LocalConsoleSnapshot;
};

export type ConversationDetailResponse = {
  ok: true;
  conversation: ConversationRecord;
  messages: ConversationMessageRecord[];
  snapshot: LocalConsoleSnapshot;
};
