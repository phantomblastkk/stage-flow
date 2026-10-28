\set ON_ERROR_STOP on
begin;
set local plpgsql.check_asserts = on;
set local role authenticated;
select set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true);
do $$
declare page jsonb;cur jsonb;ids uuid[]:='{}';n integer:=0;row jsonb;first_page jsonb;
begin
 assert not has_table_privilege('authenticated','public.stage_hiring_threads','SELECT');
 assert not has_table_privilege('authenticated','public.stage_hiring_messages','SELECT');
 assert not has_function_privilege('anon','public.stage_hiring_threads_page(jsonb,integer)','EXECUTE');
 assert not has_function_privilege('anon','public.stage_hiring_messages_page(uuid,jsonb,integer)','EXECUTE');
 assert not has_function_privilege('anon','public.stage_hiring_thread(uuid)','EXECUTE');
 loop
  page:=public.stage_hiring_threads_page(cur,20);n:=n+1;
  assert page->>'status'='ok' and page->>'version'='1';
  assert jsonb_array_length(page->'items')<=20;
  for row in select value from jsonb_array_elements(page->'items') loop ids:=array_append(ids,(row->>'id')::uuid);end loop;
  if n=1 then
   first_page:=page;assert page=public.stage_hiring_threads_page(null,20),'retry must be deterministic';
   assert page->'next_cursor'->>'at' like '%.123456%','cursor lost microseconds';
   assert page->'items'->0->>'id'='10000000-0000-4000-8000-000000000085';
  end if;
  exit when not (page->>'has_more')::boolean;
  cur:=page->'next_cursor';assert cur is not null and cur<>'null'::jsonb;assert n<10;
 end loop;
 assert cardinality(ids)=85,'must pass the legacy 80-thread cap';
 assert (select count(distinct id) from unnest(ids) id)=85,'duplicate thread';
 assert page->'next_cursor'='null'::jsonb;
 assert public.stage_hiring_thread('10000000-0000-4000-8000-000000000001')->>'status'='ok','lookup outside first page';
 assert public.stage_hiring_threads_page(null,51)->>'status'='invalid_page_size';
 assert public.stage_hiring_threads_page(null,null)->>'status'='invalid_page_size';
 for cur in select value from jsonb_array_elements('[[],{}, {"v":2}, {"v":1,"kind":"threads","at":"infinity","id":"bad"}, {"v":1,"kind":"threads","at":"2026-02-31T00:00:00Z","id":"10000000-0000-4000-8000-000000000001"}, {"v":1,"kind":"threads","at":"2026-10-28T00:00:00+99:99","id":"10000000-0000-4000-8000-000000000001"}]') loop
  assert public.stage_hiring_threads_page(cur,20)->>'status'='invalid_cursor','malformed cursor';
 end loop;
 cur:=null;ids:='{}';n:=0;
 loop
  page:=public.stage_hiring_messages_page('10000000-0000-4000-8000-000000000001',cur,50);n:=n+1;
  assert page->>'status'='ok';assert jsonb_array_length(page->'items')<=50;
  for row in select value from jsonb_array_elements(page->'items') loop
   ids:=array_append(ids,(row->>'id')::uuid);assert row->>'is_mine'='false';
  end loop;
  if n=1 then
   assert page=public.stage_hiring_messages_page('10000000-0000-4000-8000-000000000001',null,50);
   assert page->'next_cursor'->>'at' like '%.654321%';
   assert public.stage_hiring_messages_page('10000000-0000-4000-8000-000000000002',page->'next_cursor',50)->>'status'='invalid_cursor','cursor must bind thread';
  end if;
  exit when not (page->>'has_more')::boolean;
  cur:=page->'next_cursor';assert n<10;
 end loop;
 assert cardinality(ids)=205,'must pass legacy 200-message cap';
 assert (select count(distinct id) from unnest(ids) id)=205;
 assert page->'next_cursor'='null'::jsonb;
 assert public.stage_hiring_messages_page('10000000-0000-4000-8000-000000000002')->'items'='[]'::jsonb;
 assert public.stage_hiring_messages_page('10000000-0000-4000-8000-000000000001',null,101)->>'status'='invalid_page_size';
 raise notice 'PASS pagination: 85 threads / 205 messages, ties, microseconds, retry, final page, empty and invalid cursors';
end$$;
select set_config('request.jwt.claim.sub','cccccccc-cccc-4ccc-8ccc-cccccccccccc',true);
do $$begin
 assert public.stage_hiring_threads_page()->'items'='[]'::jsonb;
 assert public.stage_hiring_thread('10000000-0000-4000-8000-000000000001')->>'status'='forbidden';
 assert public.stage_hiring_messages_page('10000000-0000-4000-8000-000000000001')->>'status'='forbidden';
 raise notice 'PASS isolation: unrelated account cannot read threads or messages';
end$$;
select set_config('request.jwt.claim.sub','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',true);
do $$begin
 assert jsonb_array_length(public.stage_hiring_threads_page()->'items')=20;
 assert public.stage_hiring_messages_page('10000000-0000-4000-8000-000000000001')->'items'->0->>'is_mine'='true';
end$$;
select set_config('request.jwt.claim.sub','',true);
do $$begin
 assert public.stage_hiring_threads_page()->>'status'='login_required';
 assert public.stage_hiring_thread('10000000-0000-4000-8000-000000000001')->>'status'='login_required';
 assert public.stage_hiring_messages_page('10000000-0000-4000-8000-000000000001')->>'status'='login_required';
end$$;
reset role;
do $$begin
 assert not exists(select 1 from public.stage_hiring_threads where requester_read_at is not null or musician_read_at is not null),'reads must not mark messages read';
end$$;
insert into public.stage_hiring_messages values('20000000-0000-4000-8000-000000000206','10000000-0000-4000-8000-000000000001','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','New fixture','2026-10-28 00:00:01+00');
set local role authenticated;
select set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true);
do $$declare page jsonb;begin
 page:=public.stage_hiring_messages_page('10000000-0000-4000-8000-000000000001','{"v":1,"kind":"messages","thread_id":"10000000-0000-4000-8000-000000000001","at":"2026-10-28T00:00:00.654321Z","id":"20000000-0000-4000-8000-000000000156"}',50);
 assert page->'items'->0->>'id'='20000000-0000-4000-8000-000000000155';
 assert public.stage_hiring_messages_page('10000000-0000-4000-8000-000000000001')->'items'->0->>'id'='20000000-0000-4000-8000-000000000206';
 raise notice 'PASS insertion: older cursor remains stable; fresh page sees new message; no read markers changed';
end$$;
reset role;
set local role anon;
do $$declare blocked boolean:=false;begin
 begin perform public.stage_hiring_threads_page();exception when insufficient_privilege then blocked:=true;end;
 assert blocked,'anonymous execute must be rejected';
end$$;
reset role;
do $$begin assert not exists(select 1 from public.stage_hiring_threads where requester_read_at is not null or musician_read_at is not null);end$$;
rollback;
