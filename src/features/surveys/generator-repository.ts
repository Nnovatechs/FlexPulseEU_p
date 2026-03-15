import { requireCurrentSession } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  CreateSurveyDraftInput,
  PersistedSurvey,
  SurveyDefinition,
  SurveyLanguageCode,
  SurveyLifecycleStatus,
  UpdateSurveyDraftInput,
  createInitialMappingContract,
  createInitialSurveyDefinition,
} from "./generator-types";
import {
  compileMappingContract,
  computeMappingHash,
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
};

function normalizeLanguages(
  defaultLanguage: SurveyLanguageCode,
  supportedLanguages?: SurveyLanguageCode[],
) {
  return Array.from(
    new Set([defaultLanguage, ...(supportedLanguages ?? [])].map((value) => value.trim())),
  ).filter(Boolean);
}

function syncDefinitionMetadata(
  definition: SurveyDefinition,
  defaultLanguage: SurveyLanguageCode,
  supportedLanguages: SurveyLanguageCode[],
): SurveyDefinition {
  const nextDefinition = structuredClone(definition);

  nextDefinition.survey_meta.default_language = defaultLanguage;
  nextDefinition.survey_meta.supported_languages = supportedLanguages;

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
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("surveys")
    .update({
      status: "published",
      published_at: new Date().toISOString(),
      mapping_compiled_json: mappingCompiled,
      mapping_hash: mappingHash,
    })
    .eq("id", surveyId)
    .eq("created_by", existing.created_by)
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to publish survey: ${error.message}`);
  }

  return mapSurveyRow(data as SurveyRow);
}
