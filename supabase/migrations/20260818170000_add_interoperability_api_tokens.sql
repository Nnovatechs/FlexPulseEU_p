create table public.interoperability_api_tokens (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 80),
  token_hash text not null unique,
  token_prefix text not null check (char_length(trim(token_prefix)) > 0),
  scopes text[] not null check (
    coalesce(array_length(scopes, 1), 0) > 0
    and scopes <@ array['surveys:read', 'data:read', 'analytics:read']::text[]
  ),
  created_at timestamptz not null default timezone('utc', now()),
  expires_at timestamptz,
  revoked_at timestamptz,
  last_used_at timestamptz,
  rate_window_started_at timestamptz,
  rate_window_count integer not null default 0 check (rate_window_count >= 0)
);

create index interoperability_api_tokens_owner_idx
  on public.interoperability_api_tokens (owner_user_id, created_at desc);

create index interoperability_api_tokens_active_idx
  on public.interoperability_api_tokens (owner_user_id, revoked_at, expires_at);

alter table public.interoperability_api_tokens enable row level security;

create or replace function public.consume_interoperability_token_rate_limit(
  p_token_hash text,
  p_limit integer,
  p_window_seconds integer default 60
)
returns table (
  token_id uuid,
  owner_user_id uuid,
  scopes text[],
  allowed boolean,
  remaining integer,
  reset_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  token_row public.interoperability_api_tokens%rowtype;
  now_utc timestamptz := timezone('utc', now());
  window_start timestamptz;
  next_count integer;
begin
  select *
  into token_row
  from public.interoperability_api_tokens
  where token_hash = p_token_hash
    and revoked_at is null
    and (expires_at is null or expires_at > now_utc)
  for update;

  if not found then
    return;
  end if;

  if token_row.rate_window_started_at is null
    or token_row.rate_window_started_at + make_interval(secs => p_window_seconds) <= now_utc then
    window_start := now_utc;
    next_count := 1;
  else
    window_start := token_row.rate_window_started_at;
    next_count := token_row.rate_window_count + 1;
  end if;

  update public.interoperability_api_tokens
  set
    rate_window_started_at = window_start,
    rate_window_count = next_count,
    last_used_at = now_utc
  where id = token_row.id;

  token_id := token_row.id;
  owner_user_id := token_row.owner_user_id;
  scopes := token_row.scopes;
  allowed := next_count <= p_limit;
  remaining := greatest(p_limit - least(next_count, p_limit), 0);
  reset_at := window_start + make_interval(secs => p_window_seconds);
  return next;
end;
$$;

revoke all on function public.consume_interoperability_token_rate_limit(text, integer, integer)
  from public, anon, authenticated;

grant execute on function public.consume_interoperability_token_rate_limit(text, integer, integer)
  to service_role;