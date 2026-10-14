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
