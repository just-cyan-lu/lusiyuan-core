import { readFile } from "fs/promises";
import { resolve } from "path";

export interface PersonaContent {
  identity: string;
  personality: string;
  speakingStyle: string;
  boundaries: string;
  examples: string;
  coreMemory: string;
}

const PERSONA_DIR = resolve(process.cwd(), "persona");

async function readPersonaFile(filename: string): Promise<string> {
  return readFile(resolve(PERSONA_DIR, filename), "utf-8");
}

export async function loadPersona(): Promise<PersonaContent> {
  const [identity, personality, speakingStyle, boundaries, examples, coreMemory] =
    await Promise.all([
      readPersonaFile("identity.md"),
      readPersonaFile("personality.md"),
      readPersonaFile("speaking_style.md"),
      readPersonaFile("boundaries.md"),
      readPersonaFile("examples.md"),
      readPersonaFile("core_memory.md"),
    ]);

  return { identity, personality, speakingStyle, boundaries, examples, coreMemory };
}
