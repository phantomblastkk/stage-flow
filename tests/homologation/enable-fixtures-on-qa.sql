-- Execute SOMENTE depois de verificar visualmente que está no Supabase de HOMOLOGAÇÃO.
-- Na produção: PROIBIDO. Este marcador habilita a inserção de dados fictícios.
create table if not exists public.stage_flow_qa_marker (
  acknowledgment text primary key
);
insert into public.stage_flow_qa_marker (acknowledgment)
values ('ISOLATED_STAGE_FLOW_HOMOLOGATION_ONLY')
on conflict (acknowledgment) do nothing;
