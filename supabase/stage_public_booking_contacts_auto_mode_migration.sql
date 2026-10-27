-- Align already-installed StageFlow booking preferences with the automatic fallback.
begin;
alter table public.stage_public_booking_contacts
 drop constraint if exists stage_public_booking_contacts_mode_check;
alter table public.stage_public_booking_contacts
 add constraint stage_public_booking_contacts_mode_check
 check (mode in ('auto','off','whatsapp','instagram','form'));
alter table public.stage_public_booking_contacts alter column mode set default 'auto';

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
  'status','ok','mode','auto','phone',null,'greeting',''
 ));
end;
$$;

create or replace function public.stage_save_booking_contact(
 p_kind text,p_mode text,p_phone text,p_greeting text
) returns text language plpgsql security definer set search_path=''
as $$
declare v_phone text;
 v_greeting text;
begin
 if auth.uid() is null then return 'login_required';end if;
 if p_kind is null or p_kind not in ('singer','musician')
  or p_mode is null or p_mode not in ('auto','off','whatsapp','instagram','form')
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
revoke all on function public.stage_my_booking_contact(text) from public,anon,authenticated;
grant execute on function public.stage_my_booking_contact(text) to authenticated;
revoke all on function public.stage_save_booking_contact(text,text,text,text) from public,anon,authenticated;
grant execute on function public.stage_save_booking_contact(text,text,text,text) to authenticated;
commit;
notify pgrst,'reload schema';
