-- Stage Flow | Transformar pedido de contratação em show privado na agenda.
-- Execute DEPOIS de artist_booking_requests_migration.sql e de schema.sql.
-- Mantém dados de contato exclusivamente na caixa de pedidos.
-- Nunca publica o evento, não confirma contratação, não envia convites.
-- Seguro ao executar novamente; nenhuma informação anterior é apagada.

alter table public.stage_artist_booking_requests
  add column if not exists event_id uuid references public.events(id) on delete set null;

create unique index if not exists stage_booking_linked_event_unique_idx
  on public.stage_artist_booking_requests(event_id) where event_id is not null;

-- Dados do pedido ligados ao show só são visíveis ao próprio cantor autenticado.
-- Também mantém compatibilidade com pedidos anteriores que não possuem evento.
create or replace function public.stage_my_artist_bookings()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  if auth.uid() is null or not exists (
    select 1 from public.profiles
    where id = auth.uid() and is_artist = true
  ) then return null; end if;

  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'id', b.id,
        'contact_name', b.contact_name,
        'contact_email', b.contact_email,
        'contact_phone', b.contact_phone,
        'event_city', b.event_city,
        'event_date', b.event_date,
        'message', b.message,
        'status', b.status,
        'created_at', b.created_at,
        'event_id', b.event_id,
        'event_status', e.status,
        'event_title', e.title,
        'event_starts_at', e.starts_at,
        'event_venue', e.venue,
        'event_description', e.description
      ) order by b.created_at desc, b.id desc
    )
    from (
      select *
      from public.stage_artist_booking_requests
      where artist_id = auth.uid()
      order by created_at desc, id desc
      limit 100
    ) b
    left join public.events e
      on e.id = b.event_id and e.producer_id = auth.uid()
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.stage_my_artist_bookings() from public;
grant execute on function public.stage_my_artist_bookings() to authenticated;

-- Criar show privado ou editar o rascunho já ligado a este pedido.
-- Operação atômica e idempotente: clicar duas vezes não cria dois shows.
-- O horário é escolhido conscientemente; não inventamos um horário
-- para propostas que trouxeram somente a data.
create or replace function public.stage_save_event_from_booking(
  p_booking_id uuid,
  p_title text,
  p_starts_at timestamptz,
  p_venue text,
  p_description text
)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_booking public.stage_artist_booking_requests%rowtype;
  v_event_id uuid;
  v_status public.event_status;
  v_title text := btrim(coalesce(p_title, ''));
  v_venue text := nullif(btrim(coalesce(p_venue, '')), '');
  v_description text := nullif(btrim(coalesce(p_description, '')), '');
begin
  if v_user is null then
    return jsonb_build_object('status','login_required');
  end if;
  if not exists (
    select 1 from public.profiles where id = v_user and is_artist = true
  ) then
    return jsonb_build_object('status','artist_required');
  end if;

  if char_length(v_title) not between 3 and 120 then
    return jsonb_build_object('status','invalid_title');
  end if;
  if v_venue is not null and char_length(v_venue) > 180 then
    return jsonb_build_object('status','invalid_venue');
  end if;
  if v_description is not null and char_length(v_description) > 1500 then
    return jsonb_build_object('status','invalid_description');
  end if;
  if p_starts_at is null or p_starts_at < now() then
    return jsonb_build_object('status','invalid_date');
  end if;
  if p_starts_at > now() + interval '3 years' then
    return jsonb_build_object('status','invalid_date');
  end if;

  -- Bloqueia a proposta para evitar duplicação por cliques simultâneos.
  select * into v_booking
  from public.stage_artist_booking_requests
  where id = p_booking_id and artist_id = v_user
  for update;

  if not found then
    return jsonb_build_object('status','booking_not_found');
  end if;

  if v_booking.event_id is not null then
    select status into v_status from public.events
    where id = v_booking.event_id and producer_id = v_user
    for update;

    if found then
      if v_status <> 'draft' then
        return jsonb_build_object(
          'status','not_editable','event_id',v_booking.event_id
        );
      end if;
      update public.events
      set title = v_title,
          venue = v_venue,
          city = v_booking.event_city,
          starts_at = p_starts_at,
          description = v_description,
          status = 'draft',
          show_publicly = false,
          updated_at = now()
      where id = v_booking.event_id
        and producer_id = v_user
        and status = 'draft';

      if found then
        return jsonb_build_object(
          'status','updated','event_id',v_booking.event_id
        );
      end if;
      return jsonb_build_object('status','not_editable');
    end if;
  end if;

  insert into public.events (
    producer_id, title, description, venue, city,
    starts_at, ends_at, status, show_publicly
  ) values (
    v_user, v_title, v_description, v_venue, v_booking.event_city,
    p_starts_at, null, 'draft', false
  )
  returning id into v_event_id;

  update public.stage_artist_booking_requests
  set event_id = v_event_id, updated_at = now()
  where id = v_booking.id and artist_id = v_user;

  return jsonb_build_object('status','created','event_id',v_event_id);
end;
$$;

revoke all on function public.stage_save_event_from_booking(
  uuid,text,timestamptz,text,text
) from public;
grant execute on function public.stage_save_event_from_booking(
  uuid,text,timestamptz,text,text
) to authenticated;

-- Se o cantor posteriormente publicar um show pela interface de eventos,
-- esta rotina não pode republicá-lo nem editá-lo como rascunho.
-- Se o show for excluído, a referência do pedido vira NULL,
-- permitindo criar novo rascunho somente por ação explícita.
