-- StageFlow | Opt-in public booking contacts for singer and musician portfolios.
-- No private signup WhatsApp/notifications numbers are used or exposed.
begin;

create table if not exists public.stage_public_booking_contacts (
 owner_id uuid not null references public.profiles(id) on delete cascade,
 kind text not null check (kind in ('singer','musician')),
 mode text not null default 'off' check (mode in ('off','whatsapp','instagram','form')),
 phone_e164 text,
 greeting text not null default '' check (char_length(greeting) <= 260),
 updated_at timestamptz not null default now(),
 primary key(owner_id,kind),
 constraint stage_public_booking_phone_valid check (
  phone_e164 is null or phone_e164 ~ '^55[1-9][0-9]{9,10}$'
 ),
 constraint stage_public_booking_mode_valid check (
  (mode <> 'whatsapp' or phone_e164 is not null)
  and (kind <> 'musician' or mode <> 'form')
 )
);
alter table public.stage_public_booking_contacts enable row level security;
revoke all on public.stage_public_booking_contacts from public,anon,authenticated;

-- A singer and a musician can configure different destinations, even for a hybrid account.
create or replace function public.stage_my_booking_contact(p_kind text)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare v_result jsonb;
begin
 if auth.uid() is null then return jsonb_build_object('status','login_required');end if;
 if p_kind not in ('singer','musician') or p_kind is null then
  return jsonb_build_object('status','invalid');end if;
 if not exists(
  select 1 from public.profiles p where p.id=auth.uid() and p.is_artist=true
   and (case when p_kind='singer' then p.is_singer else p.is_musician end)
 ) then return jsonb_build_object('status','role_required');end if;
 select jsonb_build_object('status','ok','mode',c.mode,
  'phone',c.phone_e164,'greeting',c.greeting)
 into v_result
 from public.stage_public_booking_contacts c
 where c.owner_id=auth.uid() and c.kind=p_kind;
 return coalesce(v_result,jsonb_build_object(
  'status','ok','mode','off','phone',null,'greeting',''
 ));
end;
$$;
revoke all on function public.stage_my_booking_contact(text) from public,anon,authenticated;
grant execute on function public.stage_my_booking_contact(text) to authenticated;

create or replace function public.stage_save_booking_contact(
 p_kind text,p_mode text,p_phone text,p_greeting text
) returns text language plpgsql security definer set search_path=''
as $$
declare v_phone text;
 v_greeting text;
begin
 if auth.uid() is null then return 'login_required';end if;
 if p_kind is null or p_kind not in ('singer','musician')
  or p_mode is null or p_mode not in ('off','whatsapp','instagram','form')
 then return 'invalid';end if;
 if p_kind='musician' and p_mode='form' then return 'invalid';end if;
 if not exists(
  select 1 from public.profiles p where p.id=auth.uid() and p.is_artist=true
   and (case when p_kind='singer' then p.is_singer else p.is_musician end)
 ) then return 'role_required';end if;
 v_phone:=regexp_replace(coalesce(p_phone,''),'[^0-9]','','g');
 if length(v_phone) in (10,11) then v_phone:='55'||v_phone;end if;
 if p_mode='whatsapp' and v_phone !~ '^55[1-9][0-9]{9,10}$'
 then return 'invalid_phone';end if;
 v_greeting:=btrim(coalesce(p_greeting,''));
 if char_length(v_greeting)>260 then return 'invalid_greeting';end if;
 if p_mode='instagram' and not exists(
  select 1 from public.profiles p
  left join public.musician_portfolios m on m.profile_id=p.id
  where p.id=auth.uid() and
   (case when p_kind='singer' then
     p.instagram_url ~* '^https://(www[.])?instagram[.]com/[^[:space:]]+$'
    else m.instagram_url ~* '^https://(www[.])?instagram[.]com/[^[:space:]]+$' end)
 ) then return 'instagram_required';end if;
 if p_mode='form' and not exists(
  select 1 from public.profiles p where p.id=auth.uid()
    and p.is_singer=true and p.accept_booking_requests=true
 ) then return 'form_required';end if;
 insert into public.stage_public_booking_contacts(owner_id,kind,mode,phone_e164,greeting)
 values(auth.uid(),p_kind,p_mode,
  case when p_mode='whatsapp' then v_phone else null end,
  case when p_mode='whatsapp' then v_greeting else '' end)
 on conflict(owner_id,kind) do update
 set mode=excluded.mode,phone_e164=excluded.phone_e164,
     greeting=excluded.greeting,updated_at=now();
 return 'saved';
end;
$$;
revoke all on function public.stage_save_booking_contact(text,text,text,text) from public,anon,authenticated;
grant execute on function public.stage_save_booking_contact(text,text,text,text) to authenticated;

-- Never disclose phone without an explicitly published profile and opt-in.
-- Returns no PII from private settings or from the musician WhatsApp preference table.
create or replace function public.stage_public_booking_contact(p_kind text,p_slug text)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare v_result jsonb;
begin
 if p_kind is null or p_kind not in ('singer','musician')
   or p_slug is null or p_slug !~ '^[a-z0-9-]{3,30}$'
 then return null;end if;
 select jsonb_build_object(
  'mode',c.mode,
  'phone',case when c.mode='whatsapp' then c.phone_e164 else null end,
  'greeting',case when c.mode='whatsapp' then c.greeting else '' end
 ) into v_result
 from public.stage_public_booking_contacts c
 join public.profiles p on p.id=c.owner_id
 left join public.musician_portfolios m on m.profile_id=p.id
 where c.kind=p_kind and p.is_artist=true
  and case
    when p_kind='singer' then p.is_singer=true and p.is_public=true and p.username=p_slug
    else p.is_musician=true and m.is_published=true and m.slug=p_slug
  end;
 return v_result;
end;
$$;
revoke all on function public.stage_public_booking_contact(text,text) from public,anon,authenticated;
grant execute on function public.stage_public_booking_contact(text,text) to anon,authenticated;

commit;
notify pgrst, 'reload schema';
