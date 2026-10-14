-- Stage Flow: lembretes manuais de WhatsApp com consentimento do músico.
-- Execute após received_invitations_migration.sql.
-- Não envia mensagens automaticamente. O organizador abre uma conversa pronta
-- para revisar e enviar pelo próprio WhatsApp.

-- Dados privados: nunca armazenar contatos de lembrete na tabela pública profiles.
create table if not exists public.musician_whatsapp_preferences (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  phone_e164 text not null check (phone_e164 ~ '^[1-9][0-9]{9,14}$'),
  opted_in boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.musician_whatsapp_preferences enable row level security;
revoke all on table public.musician_whatsapp_preferences from PUBLIC, anon, authenticated;

-- Apenas o músico autenticado pode consultar sua própria configuração.
create or replace function public.stage_my_whatsapp_preference()
returns table (phone text, opted_in boolean)
language sql stable security definer set search_path = ''
as $$
  select pref.phone_e164, pref.opted_in
  from public.musician_whatsapp_preferences pref
  where pref.profile_id = auth.uid()
  limit 1;
$$;
revoke all on function public.stage_my_whatsapp_preference() from PUBLIC;
grant execute on function public.stage_my_whatsapp_preference() to authenticated;

-- Consentimento expresso e revogável. O número fica disponível somente aos
-- organizadores de eventos em que o músico possui convite pendente ou aceito.
create or replace function public.stage_save_whatsapp_preference(
  p_phone text,
  p_opt_in boolean
)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_phone text;
begin
  if auth.uid() is null then return 'login_required'; end if;

  if not coalesce(p_opt_in, false) then
    delete from public.musician_whatsapp_preferences
    where profile_id = auth.uid();
    return 'disabled';
  end if;

  if not exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_artist = true
  ) then return 'artist_required'; end if;

  v_phone := regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g');

  -- Telefone brasileiro digitado com DDD: acrescente automaticamente +55.
  if length(v_phone) in (10, 11) then
    v_phone := '55' || v_phone;
  end if;

  if v_phone !~ '^[1-9][0-9]{9,14}$' then
    return 'invalid_phone';
  end if;

  insert into public.musician_whatsapp_preferences
    (profile_id, phone_e164, opted_in, updated_at)
  values (auth.uid(), v_phone, true, now())
  on conflict (profile_id) do update
    set phone_e164 = excluded.phone_e164,
        opted_in = true,
        updated_at = now();

  return 'enabled';
end;
$$;
revoke all on function public.stage_save_whatsapp_preference(text, boolean) from PUBLIC;
grant execute on function public.stage_save_whatsapp_preference(text, boolean) to authenticated;

-- Versão nova; não altera o retorno da função stage_sent_invitations antiga.
-- O contato só é entregue ao DONO do evento e apenas com permissão do músico.
create or replace function public.stage_sent_invitations_with_whatsapp()
returns table (
  id uuid,
  event_id uuid,
  event_title text,
  event_starts_at timestamptz,
  event_venue text,
  event_city text,
  status text,
  musician_name text,
  musician_phone text,
  invite_code text,
  created_at timestamptz,
  responded_at timestamptz
)
language sql stable security definer set search_path = ''
as $$
  select
    i.id,
    e.id,
    e.title,
    e.starts_at,
    e.venue,
    e.city,
    i.status::text,
    musician.display_name,
    case
      when pref.opted_in = true and i.status in ('pending', 'accepted')
      then pref.phone_e164 else null
    end,
    case
      when i.musician_id is null
        and i.invited_email is null
        and i.status = 'pending'
      then i.invite_code else null
    end,
    i.created_at,
    i.responded_at
  from public.events e
  join public.invitations i on i.event_id = e.id
  left join public.profiles musician on musician.id = i.musician_id
  left join public.musician_whatsapp_preferences pref
    on pref.profile_id = i.musician_id
  where auth.uid() is not null
    and e.producer_id = auth.uid()
  order by e.starts_at desc, i.created_at desc;
$$;
revoke all on function public.stage_sent_invitations_with_whatsapp() from PUBLIC;
grant execute on function public.stage_sent_invitations_with_whatsapp() to authenticated;
