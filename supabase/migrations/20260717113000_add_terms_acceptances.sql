create table public.terms_acceptances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  terms_version text not null check (char_length(trim(terms_version)) > 0),
  document_hash text not null check (char_length(document_hash) = 64),
  document_json jsonb not null
    check (jsonb_typeof(document_json) = 'object'),
  acceptance_statement text not null
    check (char_length(trim(acceptance_statement)) > 0),
  accepted_at timestamptz not null default timezone('utc', now()),
  unique (user_id, document_hash)
);

create index terms_acceptances_user_accepted_idx
on public.terms_acceptances (user_id, accepted_at desc);

alter table public.terms_acceptances enable row level security;

create policy "Users can read their own terms acceptances"
on public.terms_acceptances
for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can accept terms for themselves"
on public.terms_acceptances
for insert
to authenticated
with check (auth.uid() = user_id);
