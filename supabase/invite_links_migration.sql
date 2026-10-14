-- Stage Flow: vincular convite de e-mail ao novo músico.
-- Executar depois de multi_role_accounts_migration.sql e invitations_migration.sql.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  chosen_artist boolean;
  chosen_producer boolean;
  chosen_role public.account_role;
  chosen_name text;
  chosen_username text;
  chosen_invite text;
begin
  chosen_artist := coalesce((new.raw_user_meta_data ->> 'is_artist')::boolean, true);
  chosen_producer := coalesce((new.raw_user_meta_data ->> 'is_producer')::boolean, false);
  if not chosen_artist and not chosen_producer then chosen_artist := true; end if;
  chosen_role := case when chosen_producer and not chosen_artist then 'producer'::public.account_role else 'musician'::public.account_role end;
  chosen_name := coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), 'Novo usuário');
  chosen_username := lower(nullif(trim(new.raw_user_meta_data ->> 'username'), ''));
  if not chosen_artist then chosen_username := null; end if;
  chosen_invite := nullif(trim(new.raw_user_meta_data ->> 'invite_code'), '');

  insert into public.profiles (id, role, display_name, username, is_artist, is_producer, plan_code, custom_subdomain_enabled, marketplace_enabled)
  values (new.id, chosen_role, chosen_name, chosen_username, chosen_artist, chosen_producer, 'free', false, false);

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
