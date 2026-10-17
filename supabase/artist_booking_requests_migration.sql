-- Stage Flow | Pedidos de contratação da página gratuita do cantor
-- Execute DEPOIS de supabase/free_artist_pages_migration.sql.
-- Nenhum dado de contato do cantor é exposto e nenhum site premium é ativado.
-- Solicitações só entram para artistas com perfil gratuito publicado.
-- Proteção básica: honeypot + limite por artista e por e-mail em janela de 24h.
-- CAPTCHA e avisos por e-mail poderão ser adicionados futuramente.

create extension if not exists pgcrypto;

create table if not exists public.stage_artist_booking_requests (
  id uuid primary key default gen_random_uuid(),
  artist_id uuid not null references public.profiles(id) on delete cascade,
  contact_name text not null,
  contact_email text not null,
  contact_phone text,
  event_city text not null,
  event_date date,
  message text not null,
  status text not null default 'new'
    check (status in ('new','contacted','archived')),
  consented_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint stage_booking_name_check check (char_length(contact_name) between 2 and 100),
  constraint stage_booking_email_check check (
    char_length(contact_email) between 5 and 254
    and contact_email ~* '^[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}$'
  ),
  constraint stage_booking_phone_check check (
    contact_phone is null
    or (char_length(contact_phone) between 8 and 22
      and contact_phone ~ '^[0-9+(). -]+$')
  ),
  constraint stage_booking_city_check check (char_length(event_city) between 2 and 140),
  constraint stage_booking_message_check check (char_length(message) between 20 and 1500)
);

create index if not exists stage_artist_booking_owner_created_idx
on public.stage_artist_booking_requests (artist_id,created_at desc);

create index if not exists stage_artist_booking_rate_idx
on public.stage_artist_booking_requests (artist_id, contact_email,created_at desc);

alter table public.stage_artist_booking_requests enable row level security;

-- Nem SELECT nem INSERT direto para anon/authenticated.
-- Todas as operações usam RPCs com checagem de proprietário.
revoke all on public.stage_artist_booking_requests from public, anon, authenticated;

-- Formulário público: vê APENAS um retorno de status genérico, não
-- dados pessoais, nem informações do proprietário.
create or replace function public.stage_submit_artist_booking(
  p_username text,
  p_contact_name text,
  p_contact_email text,
  p_contact_phone text,
  p_event_city text,
  p_event_date date,
  p_message text,
  p_consent boolean,
  p_website text
)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_artist_id uuid;
  v_email text := lower(btrim(coalesce(p_contact_email, '')));
  v_name text := btrim(coalesce(p_contact_name, ''));
  v_phone text := nullif(btrim(coalesce(p_contact_phone, '')), '');
  v_city text := btrim(coalesce(p_event_city, ''));
  v_message text := btrim(coalesce(p_message, ''));
  v_slug text := lower(btrim(coalesce(p_username,'')));
  v_count integer;
begin
  -- Campo invisível aos usuários reais; bots que o preencherem
  -- recebem confirmação neutra e não criam registros.
  if nullif(btrim(coalesce(p_website,'')), '') is not null
    then return 'received'; end if;

  if p_consent is distinct from true then return 'consent_required'; end if;
  if char_length(v_name) not between 2 and 100 then return 'invalid_name'; end if;
  if char_length(v_email) not between 5 and 254
    or v_email !~* '^[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}$'
    then return 'invalid_email'; end if;
  if v_phone is not null and (
    char_length(v_phone) not between 8 and 22
    or v_phone !~ '^[0-9+(). -]+$'
  ) then return 'invalid_phone'; end if;
  if char_length(v_city) not between 2 and 140 then return 'invalid_city'; end if;
  if char_length(v_message) not between 20 and 1500
    then return 'invalid_message'; end if;
  if p_event_date is not null and (
    p_event_date < current_date
    or p_event_date > (current_date + interval '3 years')::date
  ) then return 'invalid_date'; end if;
  if char_length(v_slug) not between 3 and 30 then return 'unavailable'; end if;

  select id into v_artist_id
  from public.profiles
  where username = v_slug and is_artist = true and is_public = true
  limit 1;
  if v_artist_id is null then return 'unavailable'; end if;

  -- Advisory lock evita corrida entre solicitações simultâneas.
  perform pg_advisory_xact_lock(hashtextextended(v_artist_id::text, 198409));

  -- Proteção durável básica (não depende de cookie/IP fornecido pelo cliente).
  select count(*) into v_count
  from public.stage_artist_booking_requests
  where artist_id = v_artist_id and created_at >= now() - interval '24 hours';
  if v_count >= 60 then return 'too_many_requests'; end if;

  select count(*) into v_count
  from public.stage_artist_booking_requests
  where artist_id = v_artist_id and contact_email = v_email
    and created_at >= now() - interval '24 hours';
  if v_count >= 2 then return 'too_many_requests'; end if;

  insert into public.stage_artist_booking_requests
    (artist_id,contact_name,contact_email,contact_phone,event_city,
     event_date,message,consented_at)
  values (
    v_artist_id, v_name, v_email, v_phone, v_city,
    p_event_date, v_message, now()
  );
  return 'received';
end;
$$;

revoke all on function public.stage_submit_artist_booking(
  text,text,text,text,text,date,text,boolean,text
) from public;
grant execute on function public.stage_submit_artist_booking(
  text,text,text,text,text,date,text,boolean,text
) to anon, authenticated;

-- Inbox privada: nenhuma consulta a uma solicitação de outro cantor.
create or replace function public.stage_my_artist_bookings()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  if auth.uid() is null or not exists(
    select 1 from public.profiles where id = auth.uid() and is_artist = true
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
        'created_at', b.created_at
      ) order by b.created_at desc, b.id desc
    )
    from (
      select * from public.stage_artist_booking_requests
      where artist_id = auth.uid()
      order by created_at desc, id desc limit 100
    ) b
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.stage_my_artist_bookings() from public;
grant execute on function public.stage_my_artist_bookings() to authenticated;

-- Gerencie status sem conceder edição de dados do solicitante.
create or replace function public.stage_update_artist_booking_status(
  p_id uuid, p_status text
)
returns text
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null then return 'login_required'; end if;
  if p_status is null or p_status not in ('new','contacted','archived')
    then return 'invalid_status'; end if;
  update public.stage_artist_booking_requests
  set status = p_status, updated_at = now()
  where id = p_id and artist_id = auth.uid();
  if not found then return 'not_found'; end if;
  return 'saved';
end;
$$;
revoke all on function public.stage_update_artist_booking_status(uuid,text)
  from public;
grant execute on function public.stage_update_artist_booking_status(uuid,text)
  to authenticated;

-- IMPORTANTE: o público pode ENVIAR pedidos apenas pelo formulário;
-- visualizar ou administrar sempre exige auth.uid() do artista.
