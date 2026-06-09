import { readFile } from "fs/promises";
import { resolve } from "path";

export const DEFAULT_CHAT_PROFILE_ID = "default";

const CHAT_PROFILE_FILES = [
  DEFAULT_CHAT_PROFILE_ID,
  "creator_mode",
  "close_friend",
  "emotional",
  "serious",
  "public_account",
] as const;

export interface PersonaContent {
  identity: string;
  personality: string;
  speakingStyle: string;
  boundaries: string;
  examples: string;
  coreMemory: string;
  toolUsage: string;
  chatProfiles: Record<string, string>;
  runtimeStateSeed: string;
}

const PERSONA_DIR = resolve(process.cwd(), "persona");

async function readPersonaFile(filename: string): Promise<string> {
  return readFile(resolve(PERSONA_DIR, filename), "utf-8");
}

async function readOptionalPersonaFile(
  filename: string,
  fallback = ""
): Promise<string> {
  try {
    return await readPersonaFile(filename);
  } catch (error) {
    if ((error as { code?: string }).code === "ENOENT") {
      return fallback;
    }
    throw error;
  }
}

async function loadChatProfiles(): Promise<Record<string, string>> {
  const entries = await Promise.all(
    CHAT_PROFILE_FILES.map(async (id) => {
      const content = await readOptionalPersonaFile(
        `chat_profiles/${id}.md`,
        id === DEFAULT_CHAT_PROFILE_ID ? "# 默认聊天投影\n\n自然、真诚、少年感。" : ""
      );
      return [id, content] as const;
    })
  );

  return Object.fromEntries(entries);
}

export async function loadPersona(): Promise<PersonaContent> {
  const [
    identity,
    personality,
    speakingStyle,
    boundaries,
    examples,
    coreMemory,
    toolUsage,
    chatProfiles,
    runtimeStateSeed,
  ] = await Promise.all([
    readPersonaFile("identity.md"),
    readPersonaFile("personality.md"),
    readPersonaFile("speaking_style.md"),
    readPersonaFile("boundaries.md"),
    readPersonaFile("examples.md"),
    readPersonaFile("core_memory.md"),
    readPersonaFile("tool_usage.md"),
    loadChatProfiles(),
    readOptionalPersonaFile("runtime/default_state.md"),
  ]);

  return {
    identity,
    personality,
    speakingStyle,
    boundaries,
    examples,
    coreMemory,
    toolUsage,
    chatProfiles,
    runtimeStateSeed,
  };
}
