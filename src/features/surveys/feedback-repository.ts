import { requireCurrentSession } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getPublishedSurveyByIdPublic, getPublicSurveyLinkByToken } from "./public-survey-load";
import {
  SURVEY_FEEDBACK_VERSION,
  buildSurveyFeedbackQuestionReferences,
  isSurveyFeedbackEligible,
} from "./feedback";
import type { SurveyLanguageCode } from "./generator-types";
import type { SubmittedSurveyAnswer } from "./response-validation";

export type SurveyFeedbackConfig = {
  survey_id: string;
  enabled: boolean;
  question_set_version: string;
  created_at: string;
  updated_at: string;
};

type SurveyResponseFeedbackRow = {
  response_id: string;
  question_set_version: string;
  ease_rating: number;
  unclear_questions_text: string;
  energy_flexibility_programme_text: string;
  automated_control_text: string;
  leading_questions_text: string;
  overlap_or_technical_text: string;
  created_at: string;
  updated_at: string;
};

type SurveyResponseRow = {
  id: string;
  survey_id: string;
  survey_link_id: string;
  submitted_language: SurveyLanguageCode;
  answers_json: Record<string, SubmittedSurveyAnswer>;
};

function mapSurveyFeedbackConfig(row: SurveyFeedbackConfig): SurveyFeedbackConfig {
  return {
    survey_id: row.survey_id,
    enabled: row.enabled,
    question_set_version: row.question_set_version,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function assertOwnedSurvey(surveyId: string) {
  await requireCurrentSession();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("surveys")
    .select("id, default_language")
    .eq("id", surveyId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to verify survey ownership: ${error.message}`);
  }

  if (!data?.id) {
    throw new Error("Survey not found or inaccessible.");
  }

  return data as { id: string; default_language: string };
}

export async function getOwnedSurveyFeedbackConfig(
  surveyId: string,
): Promise<SurveyFeedbackConfig | null> {
  await assertOwnedSurvey(surveyId);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("survey_feedback_configs")
    .select("*")
    .eq("survey_id", surveyId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load survey feedback configuration: ${error.message}`);
  }

  return data ? mapSurveyFeedbackConfig(data as SurveyFeedbackConfig) : null;
}

export async function setOwnedSurveyFeedbackEnabled(input: {
  surveyId: string;
  enabled: boolean;
}): Promise<SurveyFeedbackConfig> {
  const survey = await assertOwnedSurvey(input.surveyId);
  if (input.enabled && !isSurveyFeedbackEligible(survey.default_language)) {
    throw new Error("Survey feedback can only be enabled when English is the default language.");
  }

  const supabase = await createSupabaseServerClient();
  const payload = {
    survey_id: input.surveyId,
    enabled: input.enabled,
    question_set_version: SURVEY_FEEDBACK_VERSION,
  };
  const { data, error } = await supabase
    .from("survey_feedback_configs")
    .upsert(payload, { onConflict: "survey_id" })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to save survey feedback configuration: ${error.message}`);
  }

  return mapSurveyFeedbackConfig(data as SurveyFeedbackConfig);
}

export async function getPublicSurveyFeedbackConfig(
  surveyId: string,
): Promise<SurveyFeedbackConfig | null> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("survey_feedback_configs")
    .select("*")
    .eq("survey_id", surveyId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load public survey feedback configuration: ${error.message}`);
  }

  return data ? mapSurveyFeedbackConfig(data as SurveyFeedbackConfig) : null;
}

export async function getPublicSurveyFeedbackPageData(input: {
  linkToken: string;
  responseId: string;
}) {
  const [link, supabase] = await Promise.all([
    getPublicSurveyLinkByToken(input.linkToken),
    Promise.resolve(createSupabaseAdminClient()),
  ]);
  if (!link) {
    return null;
  }

  const survey = await getPublishedSurveyByIdPublic(link.survey_id);
  if (!survey) {
    return null;
  }

  const config = await getPublicSurveyFeedbackConfig(survey.id);
  if (!config?.enabled || !isSurveyFeedbackEligible(survey.default_language)) {
    return null;
  }

  const { data: responseRow, error: responseError } = await supabase
    .from("survey_responses")
    .select("id, survey_id, survey_link_id, submitted_language, answers_json")
    .eq("id", input.responseId)
    .maybeSingle();

  if (responseError) {
    throw new Error(`Failed to load feedback response context: ${responseError.message}`);
  }

  if (
    !responseRow ||
    responseRow.survey_id !== survey.id ||
    responseRow.survey_link_id !== link.id
  ) {
    return null;
  }

  const response = responseRow as SurveyResponseRow;
  return {
    survey,
    link,
    response,
    config,
    questionReferences: buildSurveyFeedbackQuestionReferences({
      survey,
      submittedLanguage: response.submitted_language,
      answers: response.answers_json,
    }),
  };
}

export async function createPublicSurveyResponseFeedback(input: {
  responseId: string;
  easeRating: number;
  unclearQuestionsText: string;
  energyFlexibilityProgrammeText: string;
  automatedControlText: string;
  leadingQuestionsText: string;
  overlapOrTechnicalText: string;
}) {
  const supabase = createSupabaseAdminClient();
  const payload = {
    response_id: input.responseId,
    question_set_version: SURVEY_FEEDBACK_VERSION,
    ease_rating: input.easeRating,
    unclear_questions_text: input.unclearQuestionsText,
    energy_flexibility_programme_text: input.energyFlexibilityProgrammeText,
    automated_control_text: input.automatedControlText,
    leading_questions_text: input.leadingQuestionsText,
    overlap_or_technical_text: input.overlapOrTechnicalText,
  };
  const { error } = await supabase
    .from("survey_response_feedback")
    .insert(payload);

  if (error) {
    if (error.code === "23505") {
      throw new Error("Survey feedback has already been submitted for this response.");
    }
    throw new Error(`Failed to save survey feedback response: ${error.message}`);
  }
}

export async function getPublicSurveyFeedbackCompletionUrl(responseId: string) {
  const supabase = createSupabaseAdminClient();
  const { data: externalRef, error: refError } = await supabase
    .from("response_external_refs")
    .select("integration_id")
    .eq("response_id", responseId)
    .maybeSingle();

  if (refError) {
    throw new Error(`Failed to load external response reference: ${refError.message}`);
  }

  if (!externalRef?.integration_id) {
    return null;
  }

  const { data: integration, error: integrationError } = await supabase
    .from("survey_link_integrations")
    .select("provider, completion_url, is_active")
    .eq("id", externalRef.integration_id)
    .maybeSingle();

  if (integrationError) {
    throw new Error(`Failed to load survey feedback completion target: ${integrationError.message}`);
  }

  if (
    !integration ||
    integration.provider !== "prolific" ||
    integration.is_active !== true ||
    typeof integration.completion_url !== "string"
  ) {
    return null;
  }

  return integration.completion_url;
}

export async function getOwnedSurveyResponseFeedback(
  responseId: string,
): Promise<SurveyResponseFeedbackRow | null> {
  await requireCurrentSession();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("survey_response_feedback")
    .select("*")
    .eq("response_id", responseId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load stored survey feedback response: ${error.message}`);
  }

  return data ? (data as SurveyResponseFeedbackRow) : null;
}
