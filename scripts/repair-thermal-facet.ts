import { loadEnvConfig } from "@next/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { prepareThermalComfortFacetRepair } from "@/features/surveys/measurement-plan-repairs";
import type { PersistedSurvey, SurveyDefinition } from "@/features/surveys/generator-types";

type SurveyRow = {
  id: string;
  name: string;
  status: PersistedSurvey["status"];
  created_by: string;
  created_at: string;
  updated_at: string;
  published_at: string | null;
  default_language: string;
  supported_languages: string[];
  definition_json: SurveyDefinition;
  mapping_contract_json: PersistedSurvey["mapping_contract_json"];
  mapping_compiled_json: PersistedSurvey["mapping_compiled_json"];
  mapping_hash: string | null;
  measurement_hash?: string | null;
};

function printUsage() {
  console.log(
    [
      "Usage:",
      "  npm run repair:thermal-facet -- <survey-id> [--apply]",
      "",
      "Default mode is dry-run. Add --apply to persist the repaired measurement plan.",
    ].join("\n"),
  );
}

function parseArgs(argv: string[]) {
  const args = argv.slice(2);
  const apply = args.includes("--apply");
  const dryRun = !apply;
  const surveyId = args.find((arg) => !arg.startsWith("--"))?.trim() ?? "";

  if (!surveyId) {
    printUsage();
    throw new Error("Missing survey ID.");
  }

  return { surveyId, apply, dryRun };
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

async function main() {
  loadEnvConfig(process.cwd());

  const { surveyId, apply, dryRun } = parseArgs(process.argv);
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from("surveys")
    .select("*")
    .eq("id", surveyId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load survey: ${error.message}`);
  }
  if (!data) {
    throw new Error(`Survey "${surveyId}" was not found.`);
  }

  const survey = mapSurveyRow(data as SurveyRow);
  if (survey.status !== "draft") {
    throw new Error(
      `Thermal facet repair only supports draft surveys. Current status: ${survey.status}.`,
    );
  }

  const prepared = prepareThermalComfortFacetRepair(survey);

  console.log(`Survey: ${survey.id}`);
  console.log(`Name: ${survey.name}`);
  console.log(`Status: ${survey.status}`);
  console.log(`Mode: ${dryRun ? "dry-run" : "apply"}`);
  console.log(`Changed: ${prepared.changed ? "yes" : "no"}`);
  console.log(`Measurement hash before: ${prepared.previousMeasurementHash}`);
  console.log(`Measurement hash after:  ${prepared.nextMeasurementHash}`);

  if (!prepared.changed) {
    console.log("Thermal temporary-deviation facet is already repaired. No write needed.");
    return;
  }

  const thermalConcept = prepared.nextDefinition.survey_meta.measurement_plan_json?.concepts.find(
    (concept) => concept.concept_key === "thermal_comfort_norms",
  );
  const repairedFacets =
    thermalConcept?.question_intents
      ?.filter((intent) => intent.question_key.startsWith("Q_THERMAL"))
      .map((intent) => `${intent.question_key} -> ${intent.facet}`) ?? [];

  if (repairedFacets.length > 0) {
    console.log("Thermal facets after repair:");
    for (const entry of repairedFacets) {
      console.log(`  ${entry}`);
    }
  }

  if (!apply) {
    console.log("Dry-run complete. Re-run with --apply to persist this repair.");
    return;
  }

  const { data: updated, error: updateError } = await supabase
    .from("surveys")
    .update({
      definition_json: prepared.nextDefinition,
    })
    .eq("id", survey.id)
    .eq("status", "draft")
    .eq("updated_at", survey.updated_at)
    .select("id, updated_at")
    .maybeSingle();

  if (updateError) {
    throw new Error(`Failed to persist repaired draft: ${updateError.message}`);
  }
  if (!updated) {
    throw new Error(
      "Thermal facet repair did not update the draft. The survey may have changed since it was loaded.",
    );
  }

  console.log("Repair persisted successfully.");
  console.log(`Updated survey: ${updated.id}`);
  console.log(`New updated_at: ${updated.updated_at}`);
}

main().catch((error) => {
  console.error(
    error instanceof Error ? `repair:thermal-facet failed: ${error.message}` : error,
  );
  process.exitCode = 1;
});
