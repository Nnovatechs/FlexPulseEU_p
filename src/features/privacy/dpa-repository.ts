import { requireCurrentSession } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  buildDpaDocument,
  DPA_ACCEPTANCE_STATEMENT,
  type DpaDocument,
} from "./dpa";
import type { OwnerLegalProfile } from "./types";

export type DpaAcceptance = {
  id: string;
  userId: string;
  dpaVersion: string;
  documentHash: string;
  acceptanceStatement: string;
  acceptedAt: string;
};

type DpaAcceptanceRow = {
  id: string;
  user_id: string;
  dpa_version: string;
  document_hash: string;
  acceptance_statement: string;
  accepted_at: string;
};

function isDuplicateDpaAcceptanceError(error: { code?: string; message?: string }) {
  return (
    error.code === "23505" ||
    error.message?.includes("duplicate key value") === true ||
    error.message?.includes("dpa_acceptances_user_id_document_hash_key") === true
  );
}

function mapDpaAcceptance(row: DpaAcceptanceRow): DpaAcceptance {
  return {
    id: row.id,
    userId: row.user_id,
    dpaVersion: row.dpa_version,
    documentHash: row.document_hash,
    acceptanceStatement: row.acceptance_statement,
    acceptedAt: row.accepted_at,
  };
}

export async function getCurrentDpaAcceptance(
  profile: OwnerLegalProfile,
): Promise<DpaAcceptance | null> {
  const session = await requireCurrentSession();

  if (session.user.id !== profile.userId) {
    throw new Error("DPA profile does not match the authenticated user.");
  }

  const document = buildDpaDocument(profile);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("dpa_acceptances")
    .select("*")
    .eq("user_id", session.user.id)
    .eq("document_hash", document.documentHash)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load DPA acceptance: ${error.message}`);
  }

  return data ? mapDpaAcceptance(data as DpaAcceptanceRow) : null;
}

export async function hasPreviousDpaAcceptance(
  profile: OwnerLegalProfile,
): Promise<boolean> {
  const session = await requireCurrentSession();

  if (session.user.id !== profile.userId) {
    throw new Error("DPA profile does not match the authenticated user.");
  }

  const document = buildDpaDocument(profile);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("dpa_acceptances")
    .select("id")
    .eq("user_id", session.user.id)
    .neq("document_hash", document.documentHash)
    .limit(1);

  if (error) {
    throw new Error(`Failed to load previous DPA acceptances: ${error.message}`);
  }

  return Array.isArray(data) && data.length > 0;
}

export async function recordCurrentDpaAcceptance(
  profile: OwnerLegalProfile,
  document: DpaDocument,
): Promise<DpaAcceptance> {
  const session = await requireCurrentSession();

  if (session.user.id !== profile.userId) {
    throw new Error("DPA profile does not match the authenticated user.");
  }

  const currentDocument = buildDpaDocument(profile);
  if (currentDocument.documentHash !== document.documentHash) {
    throw new Error("DPA document changed before acceptance.");
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("dpa_acceptances")
    .insert({
      user_id: session.user.id,
      dpa_version: document.version,
      document_hash: document.documentHash,
      document_json: document,
      acceptance_statement: DPA_ACCEPTANCE_STATEMENT,
    })
    .select("*")
    .single();

  if (error) {
    if (isDuplicateDpaAcceptanceError(error)) {
      const existingAcceptance = await getCurrentDpaAcceptance(profile);
      if (existingAcceptance) {
        return existingAcceptance;
      }
    }

    throw new Error(`Failed to record DPA acceptance: ${error.message}`);
  }

  return mapDpaAcceptance(data as DpaAcceptanceRow);
}
