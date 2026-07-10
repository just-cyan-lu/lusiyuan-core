import { readdir, readFile } from "fs/promises";
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
  personality: string;
  conversationBehavior: string;
  expressionRules: string;
  toolUsage: string;
  chatProfiles: Record<string, string>;
  runtimeCore: string;
  runtimeStateSeed: string;
  slices: PersonaSlice[];
  samples: PersonaSample[];
}

export interface PersonaSlice {
  id: string;
  category: "canon" | "boundary";
  profiles: string[];
  keywords: string[];
  priority: number;
  content: string;
}

export interface PersonaSample {
  id: string;
  profiles: string[];
  keywords: string[];
  priority: number;
  content: string;
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

async function loadPersonaSlices(): Promise<PersonaSlice[]> {
  return loadMarkdownFolder("slices", parsePersonaSlice);
}

async function loadSamples(): Promise<PersonaSample[]> {
  return loadMarkdownFolder("samples", parseSample);
}

async function loadMarkdownFolder<T>(
  dirname: string,
  parse: (filename: string, raw: string) => T
): Promise<T[]> {
  const dir = resolve(PERSONA_DIR, dirname);
  let filenames: string[];

  try {
    filenames = await readdir(dir);
  } catch (error) {
    if ((error as { code?: string }).code === "ENOENT") return [];
    throw error;
  }

  return Promise.all(
    filenames
      .filter((filename) => filename.endsWith(".md"))
      .sort()
      .map(async (filename) => {
        const raw = await readFile(resolve(dir, filename), "utf-8");
        return parse(filename, raw);
      })
  );
}

function parsePersonaSlice(filename: string, raw: string): PersonaSlice {
  const match = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/m.exec(raw);
  const metadata = match ? parseSliceMetadata(match[1]) : {};
  const content = (match ? match[2] : raw).trim();
  const id = metadata.id ?? filename.replace(/\.md$/, "");

  return {
    id,
    category: metadata.category === "boundary" ? "boundary" : "canon",
    profiles: splitCsv(metadata.profiles),
    keywords: splitCsv(metadata.keywords),
    priority: parsePriority(metadata.priority),
    content,
  };
}

function parseSample(filename: string, raw: string): PersonaSample {
  const match = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/m.exec(raw);
  const metadata = match ? parseSliceMetadata(match[1]) : {};
  const content = (match ? match[2] : raw).trim();
  const id = metadata.id ?? filename.replace(/\.md$/, "");

  return {
    id,
    profiles: splitCsv(metadata.profiles),
    keywords: splitCsv(metadata.keywords),
    priority: parsePriority(metadata.priority),
    content,
  };
}

function parseSliceMetadata(raw: string): Record<string, string> {
  const metadata: Record<string, string> = {};
  for (const line of raw.split(/\r?\n/)) {
    const match = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line.trim());
    if (!match) continue;
    metadata[match[1]] = match[2];
  }
  return metadata;
}

function splitCsv(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parsePriority(value: string | undefined): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 50;
}

export async function loadPersona(): Promise<PersonaContent> {
  const [
    personality,
    conversationBehavior,
    expressionRules,
    toolUsage,
    chatProfiles,
    runtimeCore,
    runtimeStateSeed,
    slices,
    samples,
  ] = await Promise.all([
    readPersonaFile("personality.md"),
    readOptionalPersonaFile("conversation_behavior.md"),
    readOptionalPersonaFile("expression_rules.md"),
    readPersonaFile("tool_usage.md"),
    loadChatProfiles(),
    readOptionalPersonaFile("runtime/core.md"),
    readOptionalPersonaFile("runtime/default_state.md"),
    loadPersonaSlices(),
    loadSamples(),
  ]);

  return {
    personality,
    conversationBehavior,
    expressionRules,
    toolUsage,
    chatProfiles,
    runtimeCore,
    runtimeStateSeed,
    slices,
    samples,
  };
}
