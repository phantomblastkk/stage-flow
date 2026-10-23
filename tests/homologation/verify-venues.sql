-- Smoke test para DADOS FICTICIOS de HOMOLOGACAO.
-- Executar APENAS em banco isolado, depois do seed-venues.sql.
-- Leitura de calendarios/perfis + verificacao de separacao.
-- Apenas SELECTs e asserts; nenhum dado real e modificado.
do $qa_check$
declare
  v_deck jsonb;
  v_other jsonb;
  v_list jsonb;
  v_month date;
  v_title text := 'Show de teste — Sexta no Deck';
begin
  select public.stage_public_venue('deck-espetobar-qa') into v_deck;
  select public.stage_public_venue('casa-b-qa') into v_other;

  if v_deck is null or v_deck->>'name'<>'Deck Espeto Bar — HOMOLOGAÇÃO' then
    raise exception 'FAIL: Deck Espeto Bar QA sem perfil oficial';
  end if;
  if v_other is null or v_other->>'name'<>'Casa B — HOMOLOGAÇÃO' then
    raise exception 'FAIL: Casa B QA sem perfil oficial';
  end if;

  if not exists (
    select 1 from public.stage_venue_calendar_events
    where venue_id=(v_deck->>'id')::uuid and title=v_title and status='published'
  ) then raise exception 'FAIL: show publicado nao cadastrado';
  end if;

  -- Testa o proprio mes do evento publicado, inclusive passagem de mes.
  select date_trunc('month',starts_at at time zone 'America/Sao_Paulo')::date
  into v_month from public.stage_venue_calendar_events
  where venue_id=(v_deck->>'id')::uuid and title=v_title
  order by created_at desc limit 1;

  select public.stage_venue_public_month('deck-espetobar-qa',v_month) into v_list;
  if v_list->>'status'<>'ok'
    or not exists (select 1 from jsonb_array_elements(v_list->'events') e where e->>'title'=v_title)
  then raise exception 'FAIL: show nao aparece no calendario publico do Deck';
  end if;
  if exists (
    select 1 from jsonb_array_elements(v_list->'events') e
    where e->>'title' in ('Show de teste — Rascunho privado','Show de teste — Casa B')
  ) then raise exception 'FAIL: calendario publico vazou rascunho ou casa vizinha';
  end if;

  select public.stage_venue_public_highlights('deck-espetobar-qa') into v_list;
  if v_list->>'status'<>'ok'
    or not exists(select 1 from jsonb_array_elements(v_list->'events') e where e->>'title'=v_title)
  then raise exception 'FAIL: proximo show nao aparece no destaque';
  end if;

  -- Sugestoes devem estar presentes na caixa da casa, mas nao no perfil publico.
  if not exists (
    select 1 from public.stage_venue_artist_suggestions
    where venue_id=(v_deck->>'id')::uuid
      and artist_name='Grupo Fictício de QA'
  ) then raise exception 'FAIL: sugestao de teste ausente';
  end if;
  if v_deck ? 'suggestions' then
    raise exception 'FAIL: sugestoes privadas publicadas no perfil';
  end if;

  raise notice 'PASSOU: calendario independente, perfil, destaque, rascunho privado, isolamento e sugestoes.';
end;
$qa_check$;
