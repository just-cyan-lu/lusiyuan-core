import test from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";

test("persona samples do not overuse assistant questions", async () => {
  const sampleDir = resolve(process.cwd(), "persona/samples");
  const filenames = (await readdir(sampleDir))
    .filter((filename) => filename.endsWith(".md"))
    .sort();

  let assistantLines = 0;
  let questionLines = 0;

  for (const filename of filenames) {
    const raw = await readFile(resolve(sampleDir, filename), "utf-8");
    const lines = raw
      .split(/\r?\n/)
      .filter((line) => line.startsWith("陆思源："));
    const questions = lines.filter((line) => /[？?]/.test(line));

    assistantLines += lines.length;
    questionLines += questions.length;
  }

  assert.ok(assistantLines > 0);
  assert.ok(
    questionLines / assistantLines <= 0.25,
    `assistant sample question ratio is too high: ${questionLines}/${assistantLines}`
  );
});
