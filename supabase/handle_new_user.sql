-- Stage Flow: create a profile automatically after Supabase Auth signup.
-- Run this in Supabase Dashboard > SQL Editor > New query.
-- Review together with supabase/schema.sql before production use.

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
begin
  if new.raw_user_meta_data ->> 'role' = 'producer' then
    chosen_role := 'producer'::public.account_role;
  else
    chosen_role := 'musician'::public.account_role;
  end if;

  chosen_name := coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), 'Novo usuário');
  chosen_username := lower(nullif(trim(new.raw_user_meta_data ->> 'username'), ''));

  if chosen_role = 'producer' then
    chosen_username := null;
  end if;

  insert into public.profiles (id, role, display_name, username)
  values (new.id, chosen_role, chosen_name, chosen_username);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Note: this creates the profile row only. It does not activate a paid plan,
-- publish the artist page, or replace the need for hardened production RLS.

-- Prevent regular signed-in users from changing their own account role or
-- subscription state through the profile update policy.
create or replace function public.protect_profile_access_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if auth.uid() is not null and auth.uid() = old.id then
    if new.role is distinct from old.role then
      raise exception 'O tipo de conta não pode ser alterado por esta operação.';
    end if;
    if new.subscription_status is distinct from old.subscription_status then
      raise exception 'O status da assinatura não pode ser alterado por esta operação.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profile_access_fields_trigger on public.profiles;
create trigger protect_profile_access_fields_trigger
  before update on public.profiles
  for each row execute procedure public.protect_profile_access_fields();
