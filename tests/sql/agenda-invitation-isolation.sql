-- Synthetic identities exist only inside this transaction on the disposable CI DB.
begin;
do $$ begin
 if to_regclass('public.stage_flow_qa_marker') is null then
  raise exception 'Disposable QA marker required; never run this on Supabase';
 end if;
 if not exists(select 1 from public.stage_flow_qa_marker where acknowledgment='ISOLATED_STAGE_FLOW_HOMOLOGATION_ONLY') then
  raise exception 'Wrong QA marker';
 end if;
end $$;
insert into auth.users(id,email) values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','organizer@example.test'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','musician@example.test'),
 ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','outsider@example.test');
insert into public.profiles(id,role,display_name) values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','producer','Organizador de teste'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','musician','Músico de teste'),
 ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','musician','Terceiro de teste');
insert into public.events(id,producer_id,title,starts_at,status,show_publicly) values
 ('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Show privado de teste',now()+interval '1 day','draft',false);
insert into public.invitations(id,event_id,musician_id) values
 ('44444444-4444-4444-8444-444444444444','11111111-1111-4111-8111-111111111111','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
grant select on public.events to authenticated;
set local role authenticated;
select set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true);
do $$ begin
 if public.stage_offer_fee('44444444-4444-4444-8444-444444444444',400,'Fixture')<>'offered' then
  raise exception 'Organizer could not offer fee';
 end if;
end $$;
select set_config('request.jwt.claim.sub','cccccccc-cccc-4ccc-8ccc-cccccccccccc',true);
do $$ begin
 if (select count(*) from public.stage_my_invitations())<>0
  or (select count(*) from public.stage_accepted_shows())<>0 then
  raise exception 'Unrelated musician can see invitations or accepted shows';
 end if;
 if public.stage_respond_invite('44444444-4444-4444-8444-444444444444',true)<>'not_found' then
  raise exception 'Unrelated musician can accept another invitation';
 end if;
 if public.stage_fee_details('44444444-4444-4444-8444-444444444444') is not null then
  raise exception 'Private fee leaked to unrelated musician';
 end if;
end $$;
select set_config('request.jwt.claim.sub','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',true);
do $$ begin
 if (select count(*) from public.stage_my_invitations() where status='pending')<>1 then
  raise exception 'Recipient cannot see their pending invitation';
 end if;
 if (select count(*) from public.stage_accepted_shows())<>0 then
  raise exception 'Pending show appeared in accepted agenda';
 end if;
 if public.stage_respond_invite('44444444-4444-4444-8444-444444444444',true)<>'fee_pending' then
  raise exception 'Unagreed fee did not block participation';
 end if;
 if public.stage_accept_fee('44444444-4444-4444-8444-444444444444')<>'accepted' then
  raise exception 'Recipient could not agree fee';
 end if;
 if public.stage_respond_invite('44444444-4444-4444-8444-444444444444',true)<>'accepted' then
  raise exception 'Recipient could not accept participation';
 end if;
 if (select count(*) from public.stage_accepted_shows() where event_id='11111111-1111-4111-8111-111111111111')<>1 then
  raise exception 'Accepted show missing or duplicated';
 end if;
 if (select count(*) from public.events)<>0 then
  raise exception 'Private organizer table is readable by guest';
 end if;
 if public.stage_respond_invite('44444444-4444-4444-8444-444444444444',false)<>'already_responded' then
  raise exception 'Repeated response can change confirmed participation';
 end if;
 if has_function_privilege('anon','public.stage_accepted_shows()','execute') then
  raise exception 'Accepted agenda callable anonymously';
 end if;
end $$;
reset role;
update public.invitations set status='cancelled' where id='44444444-4444-4444-8444-444444444444';
set local role authenticated;
select set_config('request.jwt.claim.sub','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',true);
do $$ begin
 if (select count(*) from public.stage_accepted_shows())<>0 then
  raise exception 'Cancelled participation remains in accepted agenda';
 end if;
 raise notice 'PASS: invitation, fee agreement, acceptance, private agenda, isolation and revocation';
end $$;
rollback;
