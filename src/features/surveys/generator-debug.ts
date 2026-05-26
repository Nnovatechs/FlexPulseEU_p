import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const DEBUG_FLAG_VALUES = new Set(["1", "true", "yes", "on"]);
const DEBUG_ROOT = path.join(
  process.cwd(),
  ".tmp",
  "survey-generator",
  "latest",
);

function isDebugFlagEnabled(value: string | undefined) {
  return value ? DEBUG_FLAG_VALUES.has(value.trim().toLowerCase()) : false;
}

export function isSurveyGeneratorDebugEnabled() {
  return isDebugFlagEnabled(process.env.SURVEY_GENERATOR_DEBUG);
}

async function ensureParentDirectory(relativePath: string) {
  const targetPath = path.join(DEBUG_ROOT, relativePath);
  await mkdir(path.dirname(targetPath), { recursive: true });
  return targetPath;
}

export async function resetSurveyGeneratorDebugLatest() {
  if (!isSurveyGeneratorDebugEnabled()) {
    return;
  }

  await rm(DEBUG_ROOT, { recursive: true, force: true });
  await mkdir(DEBUG_ROOT, { recursive: true });
}

export async function writeSurveyGeneratorDebugText(
  relativePath: string,
  contents: string,
) {
  if (!isSurveyGeneratorDebugEnabled()) {
    return;
  }

  const targetPath = await ensureParentDirectory(relativePath);
  await writeFile(targetPath, contents, "utf8");
}

export async function writeSurveyGeneratorDebugJson(
  relativePath: string,
  value: unknown,
) {
  await writeSurveyGeneratorDebugText(
    relativePath,
    JSON.stringify(value, null, 2),
  );
}
