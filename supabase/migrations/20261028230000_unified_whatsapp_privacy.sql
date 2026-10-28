-- Stage Flow: one verified account phone, independent WhatsApp sharing and notifications.
-- Apply only after hiring_chat_whatsapp_migration.sql and fixed identity schema.
-- New registrations use Supabase phone OTP; a provider must be configured in Auth.
begin;

create table if not exists public.musician_whatsapp_preferences (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  phone_e164 text not null check (phone_e164 ~ '^[1-9][0-9]{9,14}$'),
  opted_in boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table public.musician_whatsapp_preferences
  add column if not exists notify_opted_in boolean not null default false;
alter table public.musician_whatsapp_preferences enable row level security;
revoke all on table public.musician_whatsapp_preferences from public, anon, authenticated;

-- Preserve old contact and notification choices. Unverified numbers are never sent to.
insert into public.musician_whatsapp_preferences(profile_id,phone_e164,notify_opted_in)
select h.profile_id,h.phone_e164,h.opted_in
from public.stage_hiring_whatsapp_preferences h
where h.phone_e164 ~ '^[1-9][0-9]{9,14}$'
on conflict(profile_id) do update set
  notify_opted_in = excluded.notify_opted_in;

-- Only auth.users owns a VERIFIED phone. Raw metadata and preferences are not proof.
create or replace function public.stage_my_whatsapp_privacy()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare u auth.users%rowtype; p public.musician_whatsapp_preferences%rowtype;
        v_verified boolean; v_digits text;
begin
 if auth.uid() is null then return jsonb_build_object('status','login_required');end if;
 select * into u from auth.users where id=auth.uid();
 select * into p from public.musician_whatsapp_preferences where profile_id=auth.uid();
 v_digits:=regexp_replace(coalesce(u.phone,''),'[^0-9]','','g');
 v_verified:=u.phone_confirmed_at is not null and v_digits ~ '^[1-9][0-9]{9,14}$';
 return jsonb_build_object('status','ok',
   'phone',case when v_verified then v_digits else coalesce(p.phone_e164,v_digits) end,
   'verified',v_verified,
   'share',coalesce(p.opted_in,false),
   'notifications',coalesce(p.notify_opted_in,false));
end;$$;
revoke all on function public.stage_my_whatsapp_privacy() from public,anon,authenticated;
grant execute on function public.stage_my_whatsapp_privacy() to authenticated;

-- Both preferences live on one row; never accept a phone number in this RPC.
create or replace function public.stage_set_whatsapp_privacy(
  p_share boolean default null,p_notifications boolean default null
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=auth.uid();v_auth auth.users%rowtype;
        v_pref public.musician_whatsapp_preferences%rowtype;
        v_phone text; v_verified boolean;
begin
 if v_uid is null then return jsonb_build_object('status','login_required');end if;
 select * into v_auth from auth.users where id=v_uid;
 v_phone:=regexp_replace(coalesce(v_auth.phone,''),'[^0-9]','','g');
 v_verified:=v_auth.phone_confirmed_at is not null and v_phone ~ '^[1-9][0-9]{9,14}$';
 if not v_verified then return jsonb_build_object('status','phone_verification_required');end if;
 insert into public.musician_whatsapp_preferences
   (profile_id,phone_e164,opted_in,notify_opted_in)
 values(v_uid,v_phone,coalesce(p_share,false),coalesce(p_notifications,false))
 on conflict(profile_id) do update set
   phone_e164=excluded.phone_e164,
   opted_in=coalesce(p_share,public.musician_whatsapp_preferences.opted_in),
   notify_opted_in=coalesce(p_notifications,public.musician_whatsapp_preferences.notify_opted_in),
   updated_at=now()
 returning * into v_pref;
 insert into public.stage_hiring_whatsapp_preferences
   (profile_id,phone_e164,opted_in)
 values (v_uid,v_phone,v_pref.notify_opted_in)
 on conflict(profile_id) do update set
   phone_e164=excluded.phone_e164,opted_in=excluded.opted_in,updated_at=now();
 if not v_pref.notify_opted_in then
   update public.stage_hiring_whatsapp_outbox set status='expired'
   where recipient_id=v_uid and status='queued';
 end if;
 return jsonb_build_object('status','ok','phone',v_phone,'verified',true,
   'share',v_pref.opted_in,'notifications',v_pref.notify_opted_in);
end;$$;
revoke all on function public.stage_set_whatsapp_privacy(boolean,boolean) from public,anon,authenticated;
grant execute on function public.stage_set_whatsapp_privacy(boolean,boolean) to authenticated;

-- Auth sends and verifies OTP. Only the confirmed change updates both legacy mirrors.
create or replace function public.stage_sync_verified_account_phone()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_phone text;v_pref public.musician_whatsapp_preferences%rowtype;
begin
 v_phone:=regexp_replace(coalesce(new.phone,''),'[^0-9]','','g');
 if new.phone_confirmed_at is null or v_phone !~ '^[1-9][0-9]{9,14}$'
 then return new; end if;
 if not exists(select 1 from public.profiles where id=new.id) then return new;end if;
 insert into public.musician_whatsapp_preferences
   (profile_id,phone_e164,opted_in,notify_opted_in)
 values(new.id,v_phone,
   coalesce((new.raw_user_meta_data->>'whatsapp_opt_in')::boolean,false),
   coalesce((new.raw_user_meta_data->>'whatsapp_notifications_consent')::boolean,false))
 on conflict(profile_id) do update set phone_e164=excluded.phone_e164,updated_at=now()
 returning * into v_pref;
 insert into public.stage_hiring_whatsapp_preferences(profile_id,phone_e164,opted_in)
 values(new.id,v_phone,v_pref.notify_opted_in)
 on conflict(profile_id) do update set
  phone_e164=excluded.phone_e164,opted_in=excluded.opted_in,updated_at=now();
 return new;
end;$$;
revoke all on function public.stage_sync_verified_account_phone() from public,anon,authenticated;
drop trigger if exists stage_account_phone_verified on auth.users;
create trigger stage_account_phone_verified
after insert or update of phone,phone_confirmed_at on auth.users
for each row execute function public.stage_sync_verified_account_phone();

-- For verified existing accounts, reconcile mirrors from Auth now.
insert into public.musician_whatsapp_preferences(profile_id,phone_e164)
select u.id,regexp_replace(u.phone,'[^0-9]','','g')
from auth.users u join public.profiles p on p.id=u.id
where u.phone_confirmed_at is not null
 and regexp_replace(coalesce(u.phone,''),'[^0-9]','','g') ~ '^[1-9][0-9]{9,14}$'
on conflict(profile_id) do update
 set phone_e164=excluded.phone_e164,updated_at=now();

-- Never dispatch chat notifications to phones that Auth has not verified.
update public.stage_hiring_whatsapp_preferences h
set opted_in=false,updated_at=now()
where not exists(
  select 1 from auth.users u where u.id=h.profile_id
   and u.phone_confirmed_at is not null
   and regexp_replace(coalesce(u.phone,''),'[^0-9]','','g')=h.phone_e164
);
update public.stage_hiring_whatsapp_preferences h
set phone_e164=p.phone_e164,opted_in=p.notify_opted_in,updated_at=now()
from public.musician_whatsapp_preferences p
join auth.users u on u.id=p.profile_id
where h.profile_id=p.profile_id and u.phone_confirmed_at is not null
 and regexp_replace(coalesce(u.phone,''),'[^0-9]','','g')=p.phone_e164;

-- Legacy RPCs may toggle consent but may not silently replace the verified number.
create or replace function public.stage_save_whatsapp_preference(p_phone text,p_opt_in boolean)
returns text language plpgsql security definer set search_path='' as $$
declare v_phone text;v_result jsonb;
begin
 if auth.uid() is null then return 'login_required';end if;
 select regexp_replace(coalesce(phone,''),'[^0-9]','','g')
 into v_phone from auth.users
 where id=auth.uid() and phone_confirmed_at is not null;
 if v_phone is null then return 'phone_verification_required';end if;
 if p_phone is not null and regexp_replace(p_phone,'[^0-9]','','g')<>v_phone
 then return 'phone_verification_required';end if;
 v_result:=public.stage_set_whatsapp_privacy(p_share:=coalesce(p_opt_in,false));
 return case when v_result->>'status'<>'ok' then v_result->>'status'
  when p_opt_in then 'enabled' else 'disabled' end;
end;$$;
revoke all on function public.stage_save_whatsapp_preference(text,boolean) from public,anon,authenticated;
grant execute on function public.stage_save_whatsapp_preference(text,boolean) to authenticated;

create or replace function public.stage_hiring_whatsapp_settings(
 p_phone text default null,p_consent boolean default null
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_phone text;v_result jsonb;
begin
 if auth.uid() is null then return jsonb_build_object('status','login_required');end if;
 select regexp_replace(coalesce(phone,''),'[^0-9]','','g')
 into v_phone from auth.users where id=auth.uid() and phone_confirmed_at is not null;
 if p_consent is not null then
   if v_phone is null or
      (p_phone is not null and regexp_replace(p_phone,'[^0-9]','','g')<>v_phone)
   then return jsonb_build_object('status','phone_verification_required');end if;
   v_result:=public.stage_set_whatsapp_privacy(p_notifications:=p_consent);
 else
   v_result:=public.stage_my_whatsapp_privacy();
 end if;
 return jsonb_build_object('status',v_result->>'status',
   'phone',v_result->>'phone','opted_in',coalesce((v_result->>'notifications')::boolean,false));
end;$$;
revoke all on function public.stage_hiring_whatsapp_settings(text,boolean) from public,anon,authenticated;
grant execute on function public.stage_hiring_whatsapp_settings(text,boolean) to authenticated;

-- Old organiser-facing RPC must respect verification as well as sharing.
create or replace function public.stage_sent_invitations_with_whatsapp()
returns table (id uuid,event_id uuid,event_title text,event_starts_at timestamptz,
 venue text,city text,status text,musician_name text,musician_phone text,
 invite_code text,created_at timestamptz,responded_at timestamptz)
language sql stable security definer set search_path='' as $$
select i.id,e.id,e.title,e.starts_at,e.venue,e.city,i.status::text,
 musician.display_name,
 case when pref.opted_in=true and u.phone_confirmed_at is not null
   and regexp_replace(coalesce(u.phone,''),'[^0-9]','','g')=pref.phone_e164
   and i.status in ('pending','accepted') then pref.phone_e164 else null end,
 case when i.musician_id is null and i.invited_email is null and i.status='pending'
   then i.invite_code else null end,
 i.created_at,i.responded_at
from public.events e
join public.invitations i on i.event_id=e.id
left join public.profiles musician on musician.id=i.musician_id
left join public.musician_whatsapp_preferences pref on pref.profile_id=i.musician_id
left join auth.users u on u.id=i.musician_id
where auth.uid() is not null and e.producer_id=auth.uid()
order by e.starts_at desc,i.created_at desc;
$$;
revoke all on function public.stage_sent_invitations_with_whatsapp() from public,anon,authenticated;
grant execute on function public.stage_sent_invitations_with_whatsapp() to authenticated;

commit;
