import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { MapperOutput } from "./generator-types";

type PersistResponseMappingInput = {
  responseId: string;
  mapperOutput: MapperOutput;
  mappingHashUsed: string | null;
  measurementHashUsed: string | null;
  mapperVersion: string;
};

export async function upsertResponseMappingResult(
  input: PersistResponseMappingInput,
) {
  const supabase = createSupabaseAdminClient();

  const { error } = await supabase.from("response_mapping").upsert({
    response_id: input.responseId,
    mapper_output_json: input.mapperOutput,
    mapping_hash_used: input.mappingHashUsed,
    measurement_hash_used: input.measurementHashUsed,
    mapper_version: input.mapperVersion,
    processed_at: new Date().toISOString(),
  });

  if (error) {
    throw new Error(`Failed to persist response mapping: ${error.message}`);
  }
}
