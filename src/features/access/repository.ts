import { requireCurrentSession } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  buildTermsDocument,
  TERMS_ACCEPTANCE_STATEMENT,
  type TermsDocument,
} from "./terms";

export type TermsAcceptance = {
  id: string;
  userId: string;
  termsVersion: string;
  documentHash: string;
  acceptanceStatement: string;
  acceptedAt: string;
};

type TermsAcceptanceRow = {
  id: string;
  user_id: string;
  terms_version: string;
  document_hash: string;
  acceptance_statement: string;
  accepted_at: string;
};

function isDuplicateTermsAcceptanceError(error: { code?: string; message?: string }) {
  return (
    error.code === "23505" ||
    error.message?.includes("duplicate key value") === true ||
    error.message?.includes("terms_acceptances_user_id_document_hash_key") === true
  );
}

function isMissingTermsTableError(error: { code?: string; message?: string }) {
  return (
    error.code === "PGRST205" ||
    error.code === "42P01" ||
    error.message?.includes("terms_acceptances") === true
  );
}

function mapTermsAcceptance(row: TermsAcceptanceRow): TermsAcceptance {
  return {
    id: row.id,
    userId: row.user_id,
    termsVersion: row.terms_version,
    documentHash: row.document_hash,
    acceptanceStatement: row.acceptance_statement,
    acceptedAt: row.accepted_at,
  };
}

export async function getCurrentTermsAcceptance(): Promise<TermsAcceptance | null> {
  const session = await requireCurrentSession();
  const document = buildTermsDocument();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("terms_acceptances")
    .select("*")
    .eq("user_id", session.user.id)
    .eq("terms_version", document.version)
    .eq("document_hash", document.documentHash)
    .maybeSingle();

  if (error && isMissingTermsTableError(error)) {
    return null;
  }

  if (error) {
    throw new Error(`Failed to load terms acceptance: ${error.message}`);
  }

  return data ? mapTermsAcceptance(data as TermsAcceptanceRow) : null;
}

export async function recordCurrentTermsAcceptance(
  document: TermsDocument,
): Promise<TermsAcceptance> {
  const session = await requireCurrentSession();
  const currentDocument = buildTermsDocument();

  if (currentDocument.documentHash !== document.documentHash) {
    throw new Error("Terms document changed before acceptance.");
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("terms_acceptances")
    .insert({
      user_id: session.user.id,
      terms_version: document.version,
      document_hash: document.documentHash,
      document_json: document,
      acceptance_statement: TERMS_ACCEPTANCE_STATEMENT,
    })
    .select("*")
    .single();

  if (error) {
    if (isDuplicateTermsAcceptanceError(error)) {
      const existingAcceptance = await getCurrentTermsAcceptance();
      if (existingAcceptance) {
        return existingAcceptance;
      }
    }

    throw new Error(`Failed to record terms acceptance: ${error.message}`);
  }

  return mapTermsAcceptance(data as TermsAcceptanceRow);
}
