-- Teste de isolamento das casas parceiras — EXECUTAR SOMENTE EM PROJETO DE TESTE.
-- Preparacao: aplicar as 3 migracoes do modulo de casas; criar duas casas
-- oficiais/parceiras/ativas (X, Y), dois usuarios no Auth+profiles, vincular
-- gestor A SOMENTE a casa X; A NAO deve ser administrador global.
--
-- Este script escolhe automaticamente um gestor com acesso exclusivo a X e
-- outra casa parceira Y sem acesso. Insere registros temporarios e ROLLBACK
-- desfaz todos eles. Execute tudo de uma vez, nunca remova o ROLLBACK final.
-- Simula o JWT no SQL Editor (postgres) para exercitar as RPCs SECURITY DEFINER.
-- Nao e um teste das permissoes de GRANT/RLS do usuario de conexao: testar
-- tambem chamadas diretas com chaves de usuario no ambiente de QA.
begin;

do $security_test$
declare
  v_manager uuid;
  v_house_x uuid;
  v_house_y uuid;
  v_event_y uuid;
  v_photo_y uuid;
  v_own_show uuid;
  v_payload jsonb;
  v_reply text;
  v_outsider uuid := gen_random_uuid();
begin
  select m.profile_id,m.venue_id,y.id
  into v_manager,v_house_x,v_house_y
  from public.stage_venue_managers m
  join public.venues x on x.id=m.venue_id
  join public.venues y on y.id<>x.id
    and y.active and y.is_official and y.is_partner
  where x.active and x.is_official and x.is_partner
    and not exists(select 1 from public.stage_venue_admins a where a.profile_id=m.profile_id)
    and not exists(select 1 from public.stage_venue_managers other
       where other.profile_id=m.profile_id and other.venue_id=y.id)
  order by m.granted_at,y.id limit 1;

  if v_manager is null then
    raise exception 'PRECONDICAO FALHOU: configure duas casas parceiras X e Y e gestor autorizado apenas para X no projeto de teste.';
  end if;

  -- Registro Y inserido por postgres para testar ID conhecido de outra casa.
  insert into public.stage_venue_calendar_events(venue_id,title,starts_at,status)
    values(v_house_y,'Teste isolamento Y - nao divulgar',
      now()+interval '2 days','draft')
    returning id into v_event_y;
  insert into public.stage_venue_gallery(venue_id,media_path,caption)
    values(v_house_y, v_house_y::text||'/gallery/'||gen_random_uuid()::text||'.jpg',
      'Imagem teste isolamento')
    returning id into v_photo_y;

  perform set_config('request.jwt.claim.sub',v_manager::text,true);
  if auth.uid() is distinct from v_manager then
    raise exception 'Nao foi possivel simular JWT na sessao de teste';
  end if;

  if not public.stage_venue_can_manage(v_house_x)
     or public.stage_venue_can_manage(v_house_y) then
    raise exception 'FALHA: gestor acessa a casa errada';
  end if;
  select public.stage_venue_partner_access() into v_payload;
  if v_payload->>'status'<>'ok'
     or not exists (
       select 1 from jsonb_array_elements(v_payload->'items') i
       where i->>'id'=v_house_x::text
     )
     or exists (
       select 1 from jsonb_array_elements(v_payload->'items') i
       where i->>'id'=v_house_y::text
     ) then
    raise exception 'FALHA: portal lista casas nao autorizadas';
  end if;

  select public.stage_venue_calendar_admin_list(v_house_y) into v_payload;
  if v_payload->>'status'<>'forbidden' then
    raise exception 'FALHA: agenda de Y vazou (%).',v_payload;
  end if;

  select public.stage_venue_calendar_admin_save(
    jsonb_build_object('venue_id',v_house_y,'title','Tentativa de invadir Y',
      'starts_at',(now()+interval '3 days')::text,'status','published')
  ) into v_payload;
  if v_payload->>'status'<>'forbidden' then
    raise exception 'FALHA: criacao de evento em Y nao bloqueada';
  end if;

  select public.stage_venue_calendar_admin_flyer(v_event_y,null) into v_reply;
  if v_reply<>'forbidden' then raise exception 'FALHA: flyer de Y alteravel';end if;
  select public.stage_venue_calendar_admin_delete(v_event_y) into v_reply;
  if v_reply<>'forbidden' then raise exception 'FALHA: evento de Y apagavel';end if;
  select public.stage_venue_gallery_admin_remove(v_photo_y) into v_reply;
  if v_reply<>'forbidden' then raise exception 'FALHA: foto de Y apagavel';end if;
  select public.stage_venue_gallery_admin_add(
    v_house_y,v_house_y::text||'/gallery/'||gen_random_uuid()::text||'.jpg','Teste'
  ) into v_reply;
  if v_reply<>'forbidden' then raise exception 'FALHA: foto adicionavel a Y';end if;

  if public.stage_venue_media_can_upload(
     v_house_y::text||'/flyer/'||gen_random_uuid()::text||'.jpg')
    or public.stage_venue_media_can_upload(
     v_house_x::text||'/logo/'||gen_random_uuid()::text||'.jpg')
    or public.stage_venue_media_can_upload(
     v_house_x::text||'/cover/'||gen_random_uuid()::text||'.jpg')
    or not public.stage_venue_media_can_upload(
     v_house_x::text||'/gallery/'||gen_random_uuid()::text||'.jpg')
  then raise exception 'FALHA: permissão de upload nao isolada';end if;

  select public.stage_venue_admin_list() into v_payload;
  if v_payload->>'status'<>'forbidden' then
    raise exception 'FALHA: gestor consegue listar todos os cadastros';end if;
  select public.stage_venue_admin_managers(v_house_x) into v_payload;
  if v_payload->>'status'<>'forbidden' then
    raise exception 'FALHA: gestor consegue listar todos os gestores';end if;
  select public.stage_venue_admin_set_manager(
    v_house_x,'teste-invalido@example.com',true) into v_reply;
  if v_reply<>'forbidden' then
    raise exception 'FALHA: gestor consegue conceder acessos';end if;

  -- Confirmar que A ainda pode executar a operacao permitida na sua casa X.
  select public.stage_venue_calendar_admin_save(jsonb_build_object(
    'venue_id',v_house_x,'title','Teste permitido na casa X',
    'starts_at',(now()+interval '4 days')::text,'status','draft'
  )) into v_payload;
  if v_payload->>'status'<>'ok' then
    raise exception 'FALHA: gestor nao consegue cadastrar show em X (%).',v_payload;
  end if;
  v_own_show:=(v_payload->>'id')::uuid;
  select public.stage_venue_calendar_admin_delete(v_own_show) into v_reply;
  if v_reply<>'ok' then
    raise exception 'FALHA: gestor nao consegue remover o proprio show de teste';
  end if;

  -- Usuário sem vinculo nao pode acessar nem X nem Y.
  perform set_config('request.jwt.claim.sub',v_outsider::text,true);
  if public.stage_venue_can_manage(v_house_x)
     or public.stage_venue_can_manage(v_house_y) then
    raise exception 'FALHA: pessoa sem autorizacao ganhou acesso';
  end if;
  select public.stage_venue_calendar_admin_list(v_house_x) into v_payload;
  if v_payload->>'status'<>'forbidden' then
    raise exception 'FALHA: visitante acessa a agenda privada';
  end if;
  raise notice 'PASSOU: isolamento X/Y, upload, gestor, anonimo, administracao global, operacoes permitidas.';
end;
$security_test$;
rollback;
