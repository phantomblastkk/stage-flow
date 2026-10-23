-- Stage Flow | Fixture 100% ficticia de HOMOLOGACAO
-- NUNCA execute em producao. Requer migracoes de casas ja aplicadas.
-- Cria duas casas QA, shows independentes da agenda de musicos e sugestoes falsas.
-- Sem pessoas reais, telefones, perfis Auth ou imagens de producao.
begin;

do $qa_fixture$
declare
  v_city bigint;
  v_deck uuid;
  v_other uuid;
begin
  -- Impede aplicar fixtures acidentalmente em qualquer projeto sem habilitacao explicita.
  if to_regclass('public.stage_flow_qa_marker') is null then
    raise exception 'ABORTADO: este banco nao foi habilitado para fixtures de homologacao.';
  end if;
  if not exists (
    select 1 from public.stage_flow_qa_marker
    where acknowledgment='ISOLATED_STAGE_FLOW_HOMOLOGATION_ONLY'
  ) then
    raise exception 'ABORTADO: marcador de homologacao invalido.';
  end if;
  select id into v_city from public.cities
    where name='São Paulo' and state_code='SP' and active
    order by id limit 1;
  if v_city is null then
    raise exception 'Cidade Sao Paulo/SP nao encontrada; migracao venues_catalog pendente.';
  end if;

  insert into public.venues
    (name,city_id,address,slug,description,is_official,is_partner,active)
  values (
    'Deck Espeto Bar — HOMOLOGAÇÃO', v_city,
    'Endereço fictício — ambiente de teste',
    'deck-espetobar-qa',
    'Página de demonstração: eventos, flyers e fotos são dados fictícios.',
    true,true,true
  )
  on conflict (slug) where slug is not null do update
    set is_official=true,is_partner=true,active=true,updated_at=now()
  returning id into v_deck;

  insert into public.venues
    (name,city_id,address,slug,description,is_official,is_partner,active)
  values (
    'Casa B — HOMOLOGAÇÃO',v_city,
    'Endereço fictício — ambiente de teste',
    'casa-b-qa',
    'Segunda casa usada para testar o isolamento de permissões.',
    true,true,true
  )
  on conflict (slug) where slug is not null do update
    set is_official=true,is_partner=true,active=true,updated_at=now()
  returning id into v_other;

  -- Um show publicado para demonstrar calendário e destaque.
  if not exists (
    select 1 from public.stage_venue_calendar_events
    where venue_id=v_deck and title='Show de teste — Sexta no Deck'
  ) then
    insert into public.stage_venue_calendar_events
      (venue_id,title,description,starts_at,status)
    values (
      v_deck,'Show de teste — Sexta no Deck',
      'Apresentação fictícia cadastrada pela casa, não pela agenda de um músico.',
      ((current_date + 5) + time '20:00') at time zone 'America/Sao_Paulo',
      'published'
    );
  end if;

  -- Rascunho nao deve aparecer na pagina publica.
  if not exists (
    select 1 from public.stage_venue_calendar_events
    where venue_id=v_deck and title='Show de teste — Rascunho privado'
  ) then
    insert into public.stage_venue_calendar_events
      (venue_id,title,starts_at,status)
    values (
      v_deck,'Show de teste — Rascunho privado',
      ((current_date + 6) + time '21:00') at time zone 'America/Sao_Paulo',
      'draft'
    );
  end if;

  -- Teste de isolamento: nao deve aparecer no calendario Deck.
  if not exists (
    select 1 from public.stage_venue_calendar_events
    where venue_id=v_other and title='Show de teste — Casa B'
  ) then
    insert into public.stage_venue_calendar_events
      (venue_id,title,starts_at,status)
    values (
      v_other,'Show de teste — Casa B',
      ((current_date + 7) + time '19:30') at time zone 'America/Sao_Paulo',
      'published'
    );
  end if;

  if not exists (
    select 1 from public.stage_venue_artist_suggestions
    where venue_id=v_deck and artist_name='Grupo Fictício de QA'
  ) then
    insert into public.stage_venue_artist_suggestions
      (venue_id,artist_name,visitor_name,message)
    values (
      v_deck,'Grupo Fictício de QA',
      'Visitante de Teste',
      'Mensagem inventada para verificar a caixa de sugestões.'
    );
  end if;
end;
$qa_fixture$;

commit;
