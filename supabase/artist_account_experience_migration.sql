-- Stage Flow | Diferenciar cantor/artista principal de músico de apoio
-- Execute DEPOIS das migrações multi_role_accounts_migration.sql,
-- invite_links_migration.sql e free_artist_pages_migration.sql.
-- Compatível com cadastros e convites existentes. Seguro ao executar novamente.
--
-- artist_kind é APENAS a experiência preferida no painel, jamais concede
-- direitos de assinatura, marketplace, subdomínio ou acesso aos dados de shows.

alter table public.profiles
  add column if not exists artist_kind text;

-- Pessoas com @ configurado são inicialmente classificadas como cantores,
-- músicos convidados e perfis sem @ como apoio; poderão mudar no painel.
update public.profiles
set artist_kind = case
  when is_artist = false then null
  when username is not null then 'lead'
  else 'support'
end
where artist_kind is null
   or (is_artist = false and artist_kind is not null);

alter table public.profiles
  drop constraint if exists profiles_artist_kind_check;
alter table public.profiles
  add constraint profiles_artist_kind_check
  check (
    (is_artist = true and artist_kind in ('lead', 'support'))
    or (is_artist = false and artist_kind is null)
  );

-- O trigger existente de cadastro com convite por e-mail precisa manter a
-- vinculação legada do convite. Só adicionamos a preferência de experiência.
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

  insert into public.profiles
    (id, role, display_name, username, is_artist, is_producer,
     artist_kind, plan_code, custom_subdomain_enabled, marketplace_enabled)
  values
    (new.id, chosen_role, chosen_name, chosen_username, chosen_artist,
     chosen_producer, chosen_kind, 'free', false, false);

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

-- Um cantor pode tocar como músico de apoio e vice-versa.
-- Mudar a tela preferida NÃO muda papel, plano, assinatura ou privilégios.
create or replace function public.stage_choose_artist_experience(p_kind text)
returns text
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null then return 'login_required'; end if;
  if p_kind is null or p_kind not in ('lead','support') then return 'invalid'; end if;
  update public.profiles
    set artist_kind = p_kind, updated_at = now()
    where id = auth.uid() and is_artist = true;
  if not found then return 'artist_required'; end if;
  return 'saved';
end;
$$;
revoke all on function public.stage_choose_artist_experience(text) from PUBLIC;
grant execute on function public.stage_choose_artist_experience(text) to authenticated;
