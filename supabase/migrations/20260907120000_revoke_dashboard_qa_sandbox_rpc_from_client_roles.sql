-- The original Dashboard QA RPCs only revoked EXECUTE from PUBLIC.
-- Supabase also grants EXECUTE to anon/authenticated by default, so a logged-in
-- client could call this SECURITY DEFINER function with an arbitrary owner id.
-- These migrations already ran in production; this follow-up only tightens grants.

revoke all on function public.upsert_dashboard_qa_sandbox_dataset(
  uuid, text, text, jsonb, jsonb, jsonb, jsonb, jsonb
) from public, anon, authenticated;

grant execute on function public.upsert_dashboard_qa_sandbox_dataset(
  uuid, text, text, jsonb, jsonb, jsonb, jsonb, jsonb
) to service_role;
