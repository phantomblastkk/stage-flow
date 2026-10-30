-- StageFlow | Cadastro progressivo e evidência dos consentimentos de WhatsApp.
-- Instalar ANTES de publicar o wizard_v2 em produção.
-- Não altera contas antigas, funções Pro ou dados públicos.
begin;

create table if not exists public.stage_registration_consents (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  terms_version text not null check (length(terms_version) between 5 and 48),
  privacy_version text not null check (length(privacy_version) between 5 and 48),
  terms_accepted_at timestamptz not null default now(),
  whatsapp_notifications_opt_in boolean not null default false,
  whatsapp_contact_share_opt_in boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.stage_registration_consents enable row level security;
revoke all on table public.stage_registration_consents from public, anon, authenticated;

-- The registration trigger uses the existing role mapping (lead/support/producer).
-- The WhatsApp number is stored in the private, RLS-protected
-- musician_whatsapp_preferences table for ALL new wizard accounts, even organizers.
-- 'opted_in' controls sharing with organizers; it does NOT authorize
-- StageFlow to initiate messages. That consent is stored separately above.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  chosen_artist boolean;
  chosen_producer boolean;
  chosen_kind text;
  chosen_role public.account_role;
  chosen_name text;
  chosen_username text;
  chosen_invite text;
  chosen_singer boolean;
  chosen_musician boolean;
  wizard_signup boolean;
  chosen_phone text;
  version text;
  allow_contact_share boolean;
  allow_notifications boolean;
begin
  chosen_artist := coalesce((new.raw_user_meta_data ->> 'is_artist')::boolean, true);
  chosen_producer := coalesce((new.raw_user_meta_data ->> 'is_producer')::boolean, false);
  if not chosen_artist and not chosen_producer then chosen_artist := true; end if;

  chosen_role := case when chosen_producer and not chosen_artist
    then 'producer'::public.account_role else 'musician'::public.account_role end;
  chosen_name := coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), 'Novo usuário');
  chosen_username := lower(nullif(trim(new.raw_user_meta_data ->> 'username'), ''));
  if not chosen_artist then chosen_username := null; end if;
  chosen_invite := nullif(trim(new.raw_user_meta_data ->> 'invite_code'), '');

  if chosen_artist then
    chosen_kind := new.raw_user_meta_data ->> 'artist_kind';
    if chosen_kind is null or chosen_kind not in ('lead','support') then
      chosen_kind := case when chosen_username is not null then 'lead' else 'support' end;
    end if;
  else
    chosen_kind := null;
  end if;

  chosen_singer := chosen_artist and chosen_kind = 'lead';
  chosen_musician := chosen_artist and (chosen_kind = 'support'
    or coalesce((new.raw_user_meta_data ->> 'is_musician')::boolean,false));

  wizard_signup := new.raw_user_meta_data ->> 'signup_flow' = 'wizard_v2';
  allow_contact_share := coalesce(
    (new.raw_user_meta_data ->> 'whatsapp_contact_share_opt_in')::boolean, false
  ) and chosen_artist;
  allow_notifications := coalesce(
    (new.raw_user_meta_data ->> 'whatsapp_notifications_opt_in')::boolean, false
  );
  if wizard_signup then
    if coalesce((new.raw_user_meta_data ->> 'terms_accepted')::boolean,false) is not true
      or coalesce((new.raw_user_meta_data ->> 'privacy_acknowledged')::boolean,false) is not true
    then raise exception 'É necessário aceitar os Termos e a Política de Privacidade.'; end if;
    version := nullif(btrim(new.raw_user_meta_data ->> 'terms_version'), '');
    if version is null or version <> '2026-10-29-v1'
    then raise exception 'Versão dos termos inválida.'; end if;
    if char_length(chosen_name) not between 2 and 90
    then raise exception 'Nome de cadastro inválido.'; end if;
    chosen_phone := regexp_replace(
      coalesce(new.raw_user_meta_data ->> 'whatsapp_phone',''), '[^0-9]', '', 'g'
    );
    if length(chosen_phone) in (10,11) then chosen_phone := '55'||chosen_phone; end if;
    if chosen_phone !~ '^55[1-9][0-9]{9,10}$'
    then raise exception 'Informe um WhatsApp brasileiro válido com DDD.'; end if;
  end if;

  insert into public.profiles
    (id, role, display_name, username, is_artist, is_producer,
      artist_kind, is_singer, is_musician, plan_code,
      custom_subdomain_enabled, marketplace_enabled)
  values (new.id, chosen_role, chosen_name, chosen_username,
    chosen_artist, chosen_producer, chosen_kind, chosen_singer, chosen_musician,
    'free', false, false);

  if wizard_signup then
    -- A phone is private by default and shared only after explicit separate opt-in.
    insert into public.musician_whatsapp_preferences
      (profile_id, phone_e164, opted_in)
    values (new.id, chosen_phone, allow_contact_share)
    on conflict (profile_id) do nothing;

    insert into public.stage_registration_consents
      (profile_id, terms_version, privacy_version,
       whatsapp_notifications_opt_in, whatsapp_contact_share_opt_in)
    values (new.id, version, version, allow_notifications, allow_contact_share);
  end if;

  -- Old invite links use the same authorized email matching rule.
  if chosen_artist and chosen_invite is not null then
    update public.invitations
    set musician_id = new.id
    where invite_code = chosen_invite
      and musician_id is null
      and status = 'pending'
      and lower(invited_email) = lower(new.email);
  end if;
  return new;
end;
$$;

revoke all on function public.handle_new_user() from PUBLIC,anon,authenticated;
commit;
