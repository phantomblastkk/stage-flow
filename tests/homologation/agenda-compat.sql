-- Only for the disposable PostgreSQL in CI, never a real Supabase project.
do $$ begin
 if to_regclass('public.stage_flow_qa_marker') is null then
  raise exception 'Disposable QA marker required';
 end if;
end $$;
alter table public.invitations add column invited_email text;
alter table public.invitations add column invite_code text;
