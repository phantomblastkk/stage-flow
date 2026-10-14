-- Stage Flow: preparar uma conta única com múltiplas funções e níveis de plano.
-- Execute no SQL Editor do Supabase antes de ativar a nova interface.
-- Mantém a coluna "role" antiga temporariamente para compatibilidade com telas atuais.

alter table public.profiles
  add column if not exists is_artist boolean not null default false,
  add column if not exists is_producer boolean not null default false,
  add column if not exists plan_code text not null default 'free',
  add column if not exists custom_subdomain_enabled boolean not null default false,
  add column if not exists marketplace_enabled boolean not null default false;

update public.profiles
set is_artist = (role = 'musician'),
    is_producer = (role = 'producer')
where is_artist = false and is_producer = false;

update public.profiles
set plan_code = 'free',
    custom_subdomain_enabled = false,
    marketplace_enabled = false
where plan_code is null or plan_code = '';

alter table public.profiles drop constraint if exists profiles_plan_code_check;
alter table public.profiles add constraint profiles_plan_code_check
  check (plan_code in ('free', 'artist_plus', 'producer_plus', 'studio'));

-- Atualiza o trigger de cadastro para gravar as funções escolhidas na tela.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  chosen_role public.account_role;
  chosen_name text;
  chosen_username text;
  chosen_artist boolean;
  chosen_producer boolean;
begin
  chosen_artist := coalesce((new.raw_user_meta_data ->> 'is_artist')::boolean, true);
  chosen_producer := coalesce((new.raw_user_meta_data ->> 'is_producer')::boolean, false);

  if not chosen_artist and not chosen_producer then
    chosen_artist := true;
  end if;

  -- Compatibilidade temporária com telas e políticas antigas.
  chosen_role := case when chosen_producer and not chosen_artist
    then 'producer'::public.account_role
    else 'musician'::public.account_role end;

  chosen_name := coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), 'Novo usuário');
  chosen_username := lower(nullif(trim(new.raw_user_meta_data ->> 'username'), ''));

  if not chosen_artist then chosen_username := null; end if;

  insert into public.profiles (id, role, display_name, username, is_artist, is_producer, plan_code, custom_subdomain_enabled, marketplace_enabled)
  values (new.id, chosen_role, chosen_name, chosen_username, chosen_artist, chosen_producer, 'free', false, false);

  return new;
end;
$$;

create or replace function public.protect_profile_access_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if auth.uid() is not null and auth.uid() = old.id then
    if new.role is distinct from old.role
      or new.subscription_status is distinct from old.subscription_status
      or new.is_artist is distinct from old.is_artist
      or new.is_producer is distinct from old.is_producer
      or new.plan_code is distinct from old.plan_code
      or new.custom_subdomain_enabled is distinct from old.custom_subdomain_enabled
      or new.marketplace_enabled is distinct from old.marketplace_enabled then
      raise exception 'As funções e os recursos do plano não podem ser alterados diretamente.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profile_access_fields_trigger on public.profiles;
create trigger protect_profile_access_fields_trigger
  before update on public.profiles
  for each row execute procedure public.protect_profile_access_fields();
