import { requireCurrentSession } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  CreateSurveyDraftInput,
  PersistedSurvey,
  PersistedSurveyLink,
  SurveyDefinition,
  SurveyLanguageCode,
  SurveyLifecycleStatus,
  UpdateSurveyDraftInput,
  createInitialMappingContract,
  createInitialSurveyDefinition,
  normalizeSurveyResponseContextConfig,
} from "./generator-types";
import { assertSupportedSurveyLanguages } from "./languages";
import {
  compileMappingContract,
  computeMappingHash,
  computeMeasurementHash,
} from "./generator-mapping";
import { validateSurveyPublication } from "./generator-validation";

type SurveyRow = {
  id: string;
  name: string;
  status: SurveyLifecycleStatus;
  created_by: string;
  created_at: string;
  updated_at: string;
  published_at: string | null;
  default_language: string;
  supported_languages: string[];
  definition_json: SurveyDefinition;
  mapping_contract_json: ReturnType<typeof createInitialMappingContract>;
  mapping_compiled_json: ReturnType<typeof compileMappingContract> | null;
  mapping_hash: string | null;
  measurement_hash?: string | null;
};

type SurveyLinkRow = PersistedSurveyLink;

function normalizeLanguages(
  defaultLanguage: SurveyLanguageCode,
  supportedLanguages?: SurveyLanguageCode[],
) {
  const languages = Array.from(
    new Set([defaultLanguage, ...(supportedLanguages ?? [])].map((value) => value.trim())),
  ).filter(Boolean);

  assertSupportedSurveyLanguages(languages);

  return languages;
}

function syncDefinitionMetadata(
  definition: SurveyDefinition,
  defaultLanguage: SurveyLanguageCode,
  supportedLanguages: SurveyLanguageCode[],
): SurveyDefinition {
  const nextDefinition = structuredClone(definition);

  nextDefinition.survey_meta.default_language = defaultLanguage;
  nextDefinition.survey_meta.supported_languages = supportedLanguages;
  nextDefinition.survey_meta.response_context = normalizeSurveyResponseContextConfig(
    nextDefinition.survey_meta.response_context,
  );

  for (const language of supportedLanguages) {
    nextDefinition.translations[language] ??= {
      survey_title: "",
      survey_description: "",
      questions: {},
    };
  }

  for (const language of Object.keys(nextDefinition.translations)) {
    if (!supportedLanguages.includes(language)) {
      delete nextDefinition.translations[language];
    }
  }

  return nextDefinition;
}

function assertEditableDraft(survey: PersistedSurvey) {
  if (survey.status !== "draft") {
    throw new Error("Only draft surveys can be edited.");
  }
}

function mapSurveyRow(row: SurveyRow): PersistedSurvey {
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    created_by: row.created_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
    published_at: row.published_at,
    default_language: row.default_language,
    supported_languages: row.supported_languages,
    definition_json: row.definition_json,
    mapping_contract_json: row.mapping_contract_json,
    mapping_compiled_json: row.mapping_compiled_json,
    mapping_hash: row.mapping_hash,
    measurement_hash: row.measurement_hash ?? null,
  };
}

function mapSurveyLinkRow(row: SurveyLinkRow): PersistedSurveyLink {
  return {
    id: row.id,
    survey_id: row.survey_id,
    link_token: row.link_token,
    audience_label: row.audience_label,
    audience_token: row.audience_token,
    is_active: row.is_active,
    created_at: row.created_at,
  };
}

async function getOwnedSurveyRowOrThrow(surveyId: string): Promise<SurveyRow> {
  const session = await requireCurrentSession();
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("surveys")
    .select("*")
    .eq("id", surveyId)
    .eq("created_by", session.user.id)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load survey: ${error.message}`);
  }

  if (!data) {
    throw new Error("Survey not found.");
  }

  return data as SurveyRow;
}

export async function listOwnedSurveys(): Promise<PersistedSurvey[]> {
  const session = await requireCurrentSession();
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("surveys")
    .select("*")
    .eq("created_by", session.user.id)
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to list surveys: ${error.message}`);
  }

  return (data as SurveyRow[]).map(mapSurveyRow);
}

export async function getOwnedSurveyById(
  surveyId: string,
): Promise<PersistedSurvey> {
  const row = await getOwnedSurveyRowOrThrow(surveyId);
  return mapSurveyRow(row);
}

export async function createSurveyDraft(
  input: CreateSurveyDraftInput,
): Promise<PersistedSurvey> {
  const session = await requireCurrentSession();
  const supabase = await createSupabaseServerClient();

  const name = input.name.trim();
  const defaultLanguage = input.default_language.trim();
  const languages = normalizeLanguages(defaultLanguage, input.supported_languages);

  if (!name) {
    throw new Error("Survey name is required.");
  }

  if (!defaultLanguage) {
    throw new Error("Default language is required.");
  }

  const definition = createInitialSurveyDefinition(defaultLanguage, languages);
  const mapping = createInitialMappingContract();

  const { data, error } = await supabase
    .from("surveys")
    .insert({
      name,
      status: "draft",
      created_by: session.user.id,
      default_language: defaultLanguage,
      supported_languages: languages,
      definition_json: definition,
      mapping_contract_json: mapping,
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to create survey draft: ${error.message}`);
  }

  return mapSurveyRow(data as SurveyRow);
}

export async function updateSurveyDraft(
  input: UpdateSurveyDraftInput,
): Promise<PersistedSurvey> {
  const existing = await getOwnedSurveyById(input.surveyId);
  assertEditableDraft(existing);

  const name = input.name?.trim() ?? existing.name;
  const defaultLanguage = (input.default_language ?? existing.default_language).trim();
  const supportedLanguages = normalizeLanguages(
    defaultLanguage,
    input.supported_languages ?? existing.supported_languages,
  );

  if (!name) {
    throw new Error("Survey name is required.");
  }

  if (!defaultLanguage) {
    throw new Error("Default language is required.");
  }

  const definition = syncDefinitionMetadata(
    input.definition_json ?? existing.definition_json,
    defaultLanguage,
    supportedLanguages,
  );
  const mappingContract = input.mapping_contract_json ?? existing.mapping_contract_json;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("surveys")
    .update({
      name,
      default_language: defaultLanguage,
      supported_languages: supportedLanguages,
      definition_json: definition,
      mapping_contract_json: mappingContract,
    })
    .eq("id", input.surveyId)
    .eq("created_by", existing.created_by)
    .eq("status", "draft")
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to update survey draft: ${error.message}`);
  }

  return mapSurveyRow(data as SurveyRow);
}

export async function publishSurvey(surveyId: string): Promise<PersistedSurvey> {
  const existing = await getOwnedSurveyById(surveyId);
  assertEditableDraft(existing);

  const issues = validateSurveyPublication(
    existing.definition_json,
    existing.mapping_contract_json,
  );

  if (issues.length > 0) {
    const summary = issues.map((issue) => `${issue.path}: ${issue.message}`).join(" | ");
    throw new Error(`Survey cannot be published yet. ${summary}`);
  }

  const mappingCompiled = compileMappingContract(existing.mapping_contract_json);
  const mappingHash = computeMappingHash(existing.mapping_contract_json);
  const measurementPlan = existing.definition_json.survey_meta.measurement_plan_json;

  if (!measurementPlan) {
    throw new Error("Survey cannot be published yet. Missing measurement plan.");
  }

  const measurementHash = computeMeasurementHash(measurementPlan);
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("surveys")
    .update({
      status: "published",
      published_at: new Date().toISOString(),
      mapping_compiled_json: mappingCompiled,
      mapping_hash: mappingHash,
      measurement_hash: measurementHash,
    })
    .eq("id", surveyId)
    .eq("created_by", existing.created_by)
    .eq("status", "draft")
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to publish survey: ${error.message}`);
  }

  return mapSurveyRow(data as SurveyRow);
}

export async function deleteOwnedSurveyDraft(surveyId: string): Promise<void> {
  const session = await requireCurrentSession();
  const existing = await getOwnedSurveyById(surveyId);

  if (existing.status !== "draft") {
    throw new Error("Only draft surveys can be deleted.");
  }

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("surveys")
    .delete()
    .eq("id", surveyId)
    .eq("created_by", session.user.id)
    .eq("status", "draft");

  if (error) {
    throw new Error(`Failed to delete survey: ${error.message}`);
  }
}

export async function archiveOwnedSurvey(surveyId: string): Promise<PersistedSurvey> {
  const existing = await getOwnedSurveyById(surveyId);

  if (existing.status !== "published") {
    throw new Error("Only published surveys can be archived.");
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("surveys")
    .update({ status: "archived" })
    .eq("id", surveyId)
    .eq("created_by", existing.created_by)
    .eq("status", "published")
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to archive survey: ${error.message}`);
  }

  return mapSurveyRow(data as SurveyRow);
}

export async function listOwnedSurveyLinks(
  surveyId: string,
): Promise<PersistedSurveyLink[]> {
  const existing = await getOwnedSurveyById(surveyId);
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("survey_links")
    .select("*")
    .eq("survey_id", existing.id)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Failed to list survey links: ${error.message}`);
  }

  return ((data ?? []) as SurveyLinkRow[]).map(mapSurveyLinkRow);
}

export async function getOwnedDefaultSurveyLink(
  surveyId: string,
): Promise<PersistedSurveyLink | null> {
  const links = await listOwnedSurveyLinks(surveyId);

  const defaultLink =
    links.find((link) => link.audience_token === "default") ?? links[0] ?? null;

  return defaultLink;
}
