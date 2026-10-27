-- QA-compatible repair for deployments that already ran the dual-role migration.
-- Makes signup roles non-null and consistent with the selected artist experience.
-- Only replaces the existing registration trigger function; no accounts are changed.
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
begin
  chosen_artist := coalesce((new.raw_user_meta_data ->> 'is_artist')::boolean, true);
  chosen_producer := coalesce((new.raw_user_meta_data ->> 'is_producer')::boolean, false);
  if not chosen_artist and not chosen_producer then chosen_artist := true; end if;

  chosen_role := case when chosen_producer and not chosen_artist
    then 'producer'::public.account_role
    else 'musician'::public.account_role end;
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

  -- Evaluate roles only after artist_kind is resolved (including fallback).
  chosen_singer := chosen_artist and chosen_kind = 'lead';
  chosen_musician := chosen_artist and (chosen_kind = 'support'
    or coalesce((new.raw_user_meta_data ->> 'is_musician')::boolean,false));

  insert into public.profiles
    (id, role, display_name, username, is_artist, is_producer,
     artist_kind, is_singer, is_musician, plan_code, custom_subdomain_enabled, marketplace_enabled)
  values
    (new.id, chosen_role, chosen_name, chosen_username, chosen_artist,
     chosen_producer, chosen_kind, chosen_singer, chosen_musician, 'free', false, false);

  -- Compatibilidade exclusiva com convites antigos enviados por e-mail.
  -- Não atribui automaticamente convites anônimos por mera URL/metadado.
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
