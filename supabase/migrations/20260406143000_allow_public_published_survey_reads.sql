create policy "Public can read published surveys"
on public.surveys
for select
to anon, authenticated
using (status = 'published');

create policy "Public can read active links for published surveys"
on public.survey_links
for select
to anon, authenticated
using (
  is_active = true
  and exists (
    select 1
    from public.surveys s
    where s.id = survey_id
      and s.status = 'published'
  )
);
