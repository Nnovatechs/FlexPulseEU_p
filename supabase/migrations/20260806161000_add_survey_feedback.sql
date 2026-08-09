create table public.survey_feedback_configs (
  survey_id uuid primary key references public.surveys (id) on delete cascade,
  enabled boolean not null default false,
  question_set_version text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.survey_response_feedback (
  response_id uuid primary key references public.survey_responses (id) on delete cascade,
  question_set_version text not null,
  ease_rating integer not null check (ease_rating between 1 and 5),
  unclear_questions_text text not null,
  energy_flexibility_programme_text text not null,
  automated_control_text text not null,
  leading_questions_text text not null,
  overlap_or_technical_text text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create trigger survey_feedback_configs_set_updated_at
before update on public.survey_feedback_configs
for each row
execute function public.set_current_timestamp_updated_at();

create trigger survey_response_feedback_set_updated_at
before update on public.survey_response_feedback
for each row
execute function public.set_current_timestamp_updated_at();

alter table public.survey_feedback_configs enable row level security;
alter table public.survey_response_feedback enable row level security;

create policy "Users can read feedback config for their own surveys"
on public.survey_feedback_configs
for select
to authenticated
using (
  exists (
    select 1
    from public.surveys s
    where s.id = survey_id
      and s.created_by = auth.uid()
  )
);

create policy "Users can insert feedback config for their own surveys"
on public.survey_feedback_configs
for insert
to authenticated
with check (
  exists (
    select 1
    from public.surveys s
    where s.id = survey_id
      and s.created_by = auth.uid()
  )
);

create policy "Users can update feedback config for their own surveys"
on public.survey_feedback_configs
for update
to authenticated
using (
  exists (
    select 1
    from public.surveys s
    where s.id = survey_id
      and s.created_by = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.surveys s
    where s.id = survey_id
      and s.created_by = auth.uid()
  )
);

create policy "Users can read feedback responses for their own surveys"
on public.survey_response_feedback
for select
to authenticated
using (
  exists (
    select 1
    from public.survey_responses r
    join public.surveys s on s.id = r.survey_id
    where r.id = response_id
      and s.created_by = auth.uid()
  )
);
