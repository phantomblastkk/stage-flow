-- StageFlow QA: only active singer/musician roles can choose that experience.
-- A musician-only account cannot claim a singer @ via direct profile update.
begin;
create or replace function public.stage_choose_artist_experience(p_kind text)
returns text language plpgsql security definer set search_path=''
as $$
begin
 if auth.uid() is null then return 'login_required';end if;
 if p_kind not in ('lead','support') or p_kind is null then return 'invalid';end if;
 if not exists(select 1 from public.profiles
   where id=auth.uid() and (
     (p_kind='lead' and is_singer=true) or
     (p_kind='support' and is_musician=true)
   )) then return 'role_required';end if;
 update public.profiles set artist_kind=p_kind,updated_at=now()
 where id=auth.uid() and is_artist=true;
 if not found then return 'artist_required';end if;
 return 'saved';
end;
$$;
revoke all on function public.stage_choose_artist_experience(text) from public,anon,authenticated;
grant execute on function public.stage_choose_artist_experience(text) to authenticated;

create or replace function public.stage_guard_profile_role_username()
returns trigger language plpgsql set search_path=''
as $$
begin
 if new.username is distinct from old.username and new.username is not null
   and not old.is_singer
 then raise exception 'Ative a função de cantor para ter um @ artístico.';end if;
 return new;
end;
$$;
drop trigger if exists stage_guard_profile_role_username_trigger on public.profiles;
create trigger stage_guard_profile_role_username_trigger
 before update of username on public.profiles for each row
 execute function public.stage_guard_profile_role_username();
commit;
notify pgrst,'reload schema';
