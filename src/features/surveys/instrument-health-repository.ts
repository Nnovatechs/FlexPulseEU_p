import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { MapperOutput } from "@/features/surveys/generator-types";
import { getOwnedSurveyById } from "./generator-repository";
import type {
  InstrumentHealthFeedbackRecord,
  InstrumentHealthLoadedResponse,
  InstrumentHealthSource,
} from "./analytics/instrument-health";
import type { SubmittedSurveyAnswer } from "./response-validation";

const IN_FILTER_CHUNK = 200;

type SurveyResponseLiteRow = {
  id: string;
  pipeline_status: string;
  submitted_language: string;
  measurement_hash_at_submission: string | null;
  mapping_hash_at_submission: string | null;
};

type SurveyResponseAnswersRow = {
  id: string;
  answers_json: Record<string, SubmittedSurveyAnswer>;
};

type ResponseMappingRow = {
  response_id: string;
  mapper_output_json: MapperOutput;
};

type FeedbackRow = {
  response_id: string;
  question_set_version: string;
  ease_rating: number;
  unclear_questions_text: string | null;
  energy_flexibility_programme_text: string | null;
  automated_control_text: string | null;
  leading_questions_text: string | null;
  overlap_or_technical_text: string | null;
};

function chunkIds(ids: string[]) {
  const chunks: string[][] = [];
  for (let index = 0; index < ids.length; index += IN_FILTER_CHUNK) {
    chunks.push(ids.slice(index, index + IN_FILTER_CHUNK));
  }
  return chunks;
}

function countFilledText(row: FeedbackRow) {
  return [
    row.unclear_questions_text,
    row.energy_flexibility_programme_text,
    row.automated_control_text,
    row.leading_questions_text,
    row.overlap_or_technical_text,
  ].filter((value) => typeof value === "string" && value.trim().length > 0).length;
}

async function selectByIds<T>(
  ids: string[],
  loadChunk: (chunk: string[]) => Promise<T[]>,
) {
  if (ids.length === 0) {
    return [] as T[];
  }

  const rows: T[] = [];
  for (const chunk of chunkIds(ids)) {
    rows.push(...(await loadChunk(chunk)));
  }
  return rows;
}

export async function loadOwnedInstrumentHealthSource(
  surveyId: string,
): Promise<InstrumentHealthSource> {
  const survey = await getOwnedSurveyById(surveyId);
  const supabase = await createSupabaseServerClient();

  const { data: liteRowsRaw, error: liteError } = await supabase
    .from("survey_responses")
    .select(
      "id, pipeline_status, submitted_language, measurement_hash_at_submission, mapping_hash_at_submission",
    )
    .eq("survey_id", survey.id);

  if (liteError) {
    throw new Error(`Failed to load instrument health responses: ${liteError.message}`);
  }

  const liteRows = (liteRowsRaw ?? []) as SurveyResponseLiteRow[];
  const currentMeasurementHash = survey.measurement_hash ?? null;
  const includedIds = liteRows
    .filter((row) => {
      if (row.pipeline_status !== "ready") {
        return false;
      }

      if (currentMeasurementHash == null) {
        return row.measurement_hash_at_submission == null;
      }

      return row.measurement_hash_at_submission === currentMeasurementHash;
    })
    .map((row) => row.id);
  const readyIds = liteRows
    .filter((row) => row.pipeline_status === "ready")
    .map((row) => row.id);

  const [answerRows, mappingRows, feedbackRows, feedbackConfigResult] = await Promise.all([
    selectByIds(includedIds, async (chunk) => {
      const { data, error } = await supabase
        .from("survey_responses")
        .select("id, answers_json")
        .in("id", chunk);

      if (error) {
        throw new Error(`Failed to load instrument health answers: ${error.message}`);
      }

      return (data ?? []) as SurveyResponseAnswersRow[];
    }),
    selectByIds(readyIds, async (chunk) => {
      const { data, error } = await supabase
        .from("response_mapping")
        .select("response_id, mapper_output_json")
        .in("response_id", chunk);

      if (error) {
        throw new Error(`Failed to load instrument health mappings: ${error.message}`);
      }

      return (data ?? []) as ResponseMappingRow[];
    }),
    selectByIds(includedIds, async (chunk) => {
      const { data, error } = await supabase
        .from("survey_response_feedback")
        .select(
          "response_id, question_set_version, ease_rating, unclear_questions_text, energy_flexibility_programme_text, automated_control_text, leading_questions_text, overlap_or_technical_text",
        )
        .in("response_id", chunk);

      if (error) {
        throw new Error(`Failed to load instrument health debrief: ${error.message}`);
      }

      return (data ?? []) as FeedbackRow[];
    }),
    supabase
      .from("survey_feedback_configs")
      .select("enabled")
      .eq("survey_id", survey.id)
      .maybeSingle(),
  ]);

  const answersById = new Map(answerRows.map((row) => [row.id, row.answers_json]));
  const mappingsById = new Map(mappingRows.map((row) => [row.response_id, row.mapper_output_json]));

  const responses: InstrumentHealthLoadedResponse[] = liteRows.map((row) => ({
    pipelineStatus: row.pipeline_status,
    submittedLanguage: row.submitted_language,
    measurementHashAtSubmission: row.measurement_hash_at_submission,
    mappingHashAtSubmission: row.mapping_hash_at_submission,
    answers: answersById.get(row.id) ?? null,
    persistedOutput: mappingsById.get(row.id) ?? null,
  }));

  const feedback: InstrumentHealthFeedbackRecord[] = feedbackRows.map((row) => ({
    easeRating: row.ease_rating,
    questionSetVersion: row.question_set_version,
    textFieldFilledCount: countFilledText(row),
  }));

  return {
    survey,
    responses,
    feedback,
    feedbackConfigEnabled:
      typeof feedbackConfigResult.data?.enabled === "boolean" ? feedbackConfigResult.data.enabled : null,
  };
}
