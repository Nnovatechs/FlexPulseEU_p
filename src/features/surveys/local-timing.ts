import { AsyncLocalStorage } from "node:async_hooks";
import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

type SurveyTimingStatus = "success" | "error";

type SurveyTimingStep = {
  index: number;
  name: string;
  path: string;
  started_at: string;
  completed_at: string;
  duration_ms: number;
  status: SurveyTimingStatus;
  meta?: Record<string, unknown>;
  error?: {
    name: string;
    message: string;
  };
};

type SurveyTimingRun = {
  run_id: string;
  operation: string;
  survey_id?: string;
  owner_user_id?: string;
  started_at: string;
  completed_at?: string;
  backend_total_ms?: number;
  status: SurveyTimingStatus;
  meta?: Record<string, unknown>;
  error?: {
    name: string;
    message: string;
  };
  steps: SurveyTimingStep[];
};

type SurveyTimingStore = {
  run: SurveyTimingRun;
  stack: string[];
  stepIndex: number;
};

type SurveyTimingOperationInput = {
  operation: string;
  surveyId?: string;
  ownerUserId?: string;
  meta?: Record<string, unknown>;
};

const TIMING_ROOT = path.join(process.cwd(), ".tmp", "survey-timing");
const TIMING_RUNS_FILE = path.join(TIMING_ROOT, "runs.jsonl");
const timingStorage = new AsyncLocalStorage<SurveyTimingStore>();
const FLAG_VALUES = new Set(["1", "true", "yes", "on"]);

function isFlagEnabled(value: string | undefined) {
  return value ? FLAG_VALUES.has(value.trim().toLowerCase()) : false;
}

export function isSurveyTimingEnabled() {
  if (isFlagEnabled(process.env.SURVEY_PIPELINE_TIMING)) {
    return true;
  }

  return process.env.NODE_ENV === "development";
}

function nowIso() {
  return new Date().toISOString();
}

function serializeError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
    };
  }

  return {
    name: "UnknownError",
    message: String(error),
  };
}

async function appendTimingRun(run: SurveyTimingRun) {
  try {
    await mkdir(TIMING_ROOT, { recursive: true });
    await appendFile(TIMING_RUNS_FILE, `${JSON.stringify(run)}\n`, "utf8");
  } catch {
    // Timing must never change product behavior.
  }
}

export async function withSurveyTimingOperation<T>(
  input: SurveyTimingOperationInput,
  fn: () => Promise<T>,
): Promise<T> {
  if (!isSurveyTimingEnabled()) {
    return fn();
  }

  const startedAt = Date.now();
  const run: SurveyTimingRun = {
    run_id: randomUUID(),
    operation: input.operation,
    ...(input.surveyId ? { survey_id: input.surveyId } : {}),
    ...(input.ownerUserId ? { owner_user_id: input.ownerUserId } : {}),
    started_at: nowIso(),
    status: "success",
    ...(input.meta ? { meta: input.meta } : {}),
    steps: [],
  };

  return timingStorage.run(
    {
      run,
      stack: [],
      stepIndex: 0,
    },
    async () => {
      try {
        return await fn();
      } catch (error) {
        run.status = "error";
        run.error = serializeError(error);
        throw error;
      } finally {
        run.completed_at = nowIso();
        run.backend_total_ms = Date.now() - startedAt;
        await appendTimingRun(run);
      }
    },
  );
}

export async function timeSurveyStep<T>(
  name: string,
  meta: Record<string, unknown> | undefined,
  fn: () => Promise<T>,
): Promise<T> {
  const store = timingStorage.getStore();
  if (!store) {
    return fn();
  }

  const startedAt = Date.now();
  store.stack.push(name);
  const pathLabel = store.stack.join(" > ");

  try {
    const result = await fn();
    store.run.steps.push({
      index: ++store.stepIndex,
      name,
      path: pathLabel,
      started_at: new Date(startedAt).toISOString(),
      completed_at: nowIso(),
      duration_ms: Date.now() - startedAt,
      status: "success",
      ...(meta ? { meta } : {}),
    });
    return result;
  } catch (error) {
    store.run.steps.push({
      index: ++store.stepIndex,
      name,
      path: pathLabel,
      started_at: new Date(startedAt).toISOString(),
      completed_at: nowIso(),
      duration_ms: Date.now() - startedAt,
      status: "error",
      ...(meta ? { meta } : {}),
      error: serializeError(error),
    });
    throw error;
  } finally {
    store.stack.pop();
  }
}
