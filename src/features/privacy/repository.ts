import { requireCurrentSession } from "@/lib/auth/session";
import { getLegalConfig } from "@/lib/config/legal";
import { getRawLocationRetentionLabel } from "@/lib/config/response-retention";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  buildSurveyLegalSnapshot,
  isOwnerLegalProfileComplete,
  type OwnerLegalProfile,
  type OwnerLegalProfileInput,
  type SurveyLegalSnapshot,
  type SurveyLegalSnapshotRecord,
} from "./types";

type OwnerLegalProfileRow = {
  user_id: string;
  controller_name: string;
  controller_country: string;
  contact_email: string;
  privacy_email: string;
  dpo_email: string | null;
  created_at: string;
  updated_at: string;
};

type SurveyLegalSnapshotRow = {
  survey_id: string;
  owner_id: string;
  snapshot_json: SurveyLegalSnapshot;
  captured_at: string;
};

function mapOwnerLegalProfile(row: OwnerLegalProfileRow): OwnerLegalProfile {
  return {
    userId: row.user_id,
    controllerName: row.controller_name,
    controllerCountry: row.controller_country,
    contactEmail: row.contact_email,
    privacyEmail: row.privacy_email,
    dpoEmail: row.dpo_email,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapSurveyLegalSnapshot(
  row: SurveyLegalSnapshotRow,
): SurveyLegalSnapshotRecord {
  return {
    surveyId: row.survey_id,
    ownerId: row.owner_id,
    snapshot: row.snapshot_json,
    capturedAt: row.captured_at,
  };
}

export async function getCurrentOwnerLegalProfile(): Promise<OwnerLegalProfile | null> {
  const session = await requireCurrentSession();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("owner_legal_profiles")
    .select("*")
    .eq("user_id", session.user.id)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load Privacy Settings: ${error.message}`);
  }

  return data ? mapOwnerLegalProfile(data as OwnerLegalProfileRow) : null;
}

export async function saveCurrentOwnerLegalProfile(
  input: OwnerLegalProfileInput,
): Promise<OwnerLegalProfile> {
  const session = await requireCurrentSession();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("owner_legal_profiles")
    .upsert(
      {
        user_id: session.user.id,
        controller_name: input.controllerName,
        controller_country: input.controllerCountry,
        contact_email: input.contactEmail,
        privacy_email: input.privacyEmail,
        dpo_email: input.dpoEmail,
      },
      { onConflict: "user_id" },
    )
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to save Privacy Settings: ${error.message}`);
  }

  return mapOwnerLegalProfile(data as OwnerLegalProfileRow);
}

export async function prepareSurveyLegalSnapshot(
  surveyId: string,
  surveyOwnerId: string,
): Promise<SurveyLegalSnapshotRecord> {
  const session = await requireCurrentSession();

  if (session.user.id !== surveyOwnerId) {
    throw new Error("Survey owner does not match the authenticated user.");
  }

  const profile = await getCurrentOwnerLegalProfile();
  if (!isOwnerLegalProfileComplete(profile)) {
    throw new Error("Privacy Settings are incomplete.");
  }

  const capturedAt = new Date().toISOString();
  const snapshot = buildSurveyLegalSnapshot(
    profile,
    getLegalConfig(),
    getRawLocationRetentionLabel(),
    capturedAt,
  );
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("survey_legal_snapshots")
    .upsert(
      {
        survey_id: surveyId,
        owner_id: surveyOwnerId,
        snapshot_json: snapshot,
        captured_at: capturedAt,
      },
      { onConflict: "survey_id" },
    )
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to prepare survey privacy information: ${error.message}`);
  }

  return mapSurveyLegalSnapshot(data as SurveyLegalSnapshotRow);
}

export async function getPublicSurveyLegalSnapshot(
  surveyId: string,
): Promise<SurveyLegalSnapshotRecord | null> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("survey_legal_snapshots")
    .select("*")
    .eq("survey_id", surveyId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load survey privacy information: ${error.message}`);
  }

  return data ? mapSurveyLegalSnapshot(data as SurveyLegalSnapshotRow) : null;
}
