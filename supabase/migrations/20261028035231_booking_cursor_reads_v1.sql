-- Prepared only: requires separately authorized application. No legacy signature or read marker changes.
begin;
do $$begin
 if to_regclass('public.profiles') is null or to_regclass('public.stage_hiring_threads') is null or to_regclass('public.stage_hiring_messages') is null then
  raise exception 'StageFlow booking schema prerequisite missing';
 end if;
end$$;
create or replace function public.stage_hiring_threads_page(p_cursor jsonb default null, p_page_size integer default 20)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_user uuid:=auth.uid();v_at timestamptz;v_id uuid;v_rows jsonb;v_items jsonb;v_more boolean;v_last jsonb;
begin
 if v_user is null then return jsonb_build_object('version',1,'status','login_required');end if;
 if p_page_size is null or p_page_size<1 or p_page_size>50 then return jsonb_build_object('version',1,'status','invalid_page_size');end if;
 if p_cursor is not null then
  if jsonb_typeof(p_cursor) is distinct from 'object' or octet_length(p_cursor::text)>1024
   or p_cursor->'v' is distinct from '1'::jsonb or p_cursor->>'kind' is distinct from 'threads'
   or jsonb_typeof(p_cursor->'at') is distinct from 'string' or jsonb_typeof(p_cursor->'id') is distinct from 'string'
   or length(p_cursor->>'at')>64 or (p_cursor->>'at') !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}:\d{2})$'
   or (p_cursor->>'id') !~* '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
  then return jsonb_build_object('version',1,'status','invalid_cursor');end if;
  begin v_at:=(p_cursor->>'at')::timestamptz;v_id:=(p_cursor->>'id')::uuid;
  exception when data_exception then
   return jsonb_build_object('version',1,'status','invalid_cursor');end;
  if not isfinite(v_at) then return jsonb_build_object('version',1,'status','invalid_cursor');end if;
 end if;
 select coalesce(jsonb_agg(jsonb_build_object('at',t.last_message_at,'id',t.id,'item',jsonb_build_object('id',t.id,'requested_date',t.requested_date,'event_id',t.event_id,
 'availability',t.availability,'last_message_at',t.last_message_at,
 'other_id',case when t.requester_id=v_user then t.musician_id else t.requester_id end,
 'other_name',coalesce(nullif(p.display_name,''),'Usuário'),
 'acting_as',case when t.requester_id=v_user then 'requester' else 'musician' end,
 'unread',(select count(*) from public.stage_hiring_messages m where m.thread_id=t.id and m.sender_id<>v_user
 and m.created_at>coalesce(case when t.requester_id=v_user then t.requester_read_at else t.musician_read_at end,t.created_at-interval '1 second')),
 'last_message',(select left(m.body,100) from public.stage_hiring_messages m where m.thread_id=t.id order by m.created_at desc,m.id desc limit 1))) order by t.last_message_at desc,t.id desc),'[]'::jsonb)
 into v_rows from (
 select * from public.stage_hiring_threads t where v_user in(t.requester_id,t.musician_id)
 and (v_at is null or (t.last_message_at,t.id)<(v_at,v_id))
 order by t.last_message_at desc,t.id desc limit p_page_size+1
 ) t join public.profiles p on p.id=case when t.requester_id=v_user then t.musician_id else t.requester_id end;
 v_more:=jsonb_array_length(v_rows)>p_page_size;
 select coalesce(jsonb_agg(value->'item' order by ord),'[]'::jsonb) into v_items
 from jsonb_array_elements(v_rows) with ordinality as entries(value,ord) where ord<=p_page_size;
 v_last:=v_rows->(least(jsonb_array_length(v_rows),p_page_size)-1);
 return jsonb_build_object('version',1,'status','ok','items',v_items,'has_more',v_more,'next_cursor',
 case when v_more then jsonb_build_object('v',1,'kind','threads','at',v_last->'at','id',v_last->'id') else null end);
end;$$;
revoke all on function public.stage_hiring_threads_page(jsonb,integer) from public,anon,authenticated;
grant execute on function public.stage_hiring_threads_page(jsonb,integer) to authenticated;
create or replace function public.stage_hiring_messages_page(p_thread_id uuid, p_cursor jsonb default null, p_page_size integer default 50)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_user uuid:=auth.uid();v_at timestamptz;v_id uuid;v_rows jsonb;v_items jsonb;v_more boolean;v_last jsonb;
begin
 if v_user is null then return jsonb_build_object('version',1,'status','login_required');end if;
 if not exists(select 1 from public.stage_hiring_threads t where t.id=p_thread_id and v_user in(t.requester_id,t.musician_id)) then
 return jsonb_build_object('version',1,'status','forbidden');end if;
 if p_page_size is null or p_page_size<1 or p_page_size>100 then return jsonb_build_object('version',1,'status','invalid_page_size');end if;
 if p_cursor is not null then
  if jsonb_typeof(p_cursor) is distinct from 'object' or octet_length(p_cursor::text)>1024
   or p_cursor->'v' is distinct from '1'::jsonb or p_cursor->>'kind' is distinct from 'messages'
   or jsonb_typeof(p_cursor->'at') is distinct from 'string' or jsonb_typeof(p_cursor->'id') is distinct from 'string'
   or length(p_cursor->>'at')>64 or (p_cursor->>'at') !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}:\d{2})$'
   or (p_cursor->>'id') !~* '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
   or p_cursor->>'thread_id' is distinct from p_thread_id::text
  then return jsonb_build_object('version',1,'status','invalid_cursor');end if;
  begin v_at:=(p_cursor->>'at')::timestamptz;v_id:=(p_cursor->>'id')::uuid;
  exception when data_exception then
   return jsonb_build_object('version',1,'status','invalid_cursor');end;
  if not isfinite(v_at) then return jsonb_build_object('version',1,'status','invalid_cursor');end if;
 end if;
 select coalesce(jsonb_agg(jsonb_build_object('at',m.created_at,'id',m.id,'item',jsonb_build_object(
 'id',m.id,'body',m.body,'is_mine',m.sender_id=v_user,'created_at',m.created_at)) order by m.created_at desc,m.id desc),'[]'::jsonb)
 into v_rows from (
 select * from public.stage_hiring_messages m where m.thread_id=p_thread_id
 and (v_at is null or (m.created_at,m.id)<(v_at,v_id))
 order by m.created_at desc,m.id desc limit p_page_size+1
 ) m;
 v_more:=jsonb_array_length(v_rows)>p_page_size;
 select coalesce(jsonb_agg(value->'item' order by ord),'[]'::jsonb) into v_items
 from jsonb_array_elements(v_rows) with ordinality as entries(value,ord) where ord<=p_page_size;
 v_last:=v_rows->(least(jsonb_array_length(v_rows),p_page_size)-1);
 return jsonb_build_object('version',1,'status','ok','items',v_items,'has_more',v_more,'next_cursor',
 case when v_more then jsonb_build_object('v',1,'kind','messages','at',v_last->'at','id',v_last->'id','thread_id',p_thread_id) else null end);
end;$$;
revoke all on function public.stage_hiring_messages_page(uuid,jsonb,integer) from public,anon,authenticated;
grant execute on function public.stage_hiring_messages_page(uuid,jsonb,integer) to authenticated;
create or replace function public.stage_hiring_thread(p_thread_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_user uuid:=auth.uid();v_item jsonb;
begin
 if v_user is null then return jsonb_build_object('version',1,'status','login_required');end if;
 select jsonb_build_object('id',t.id,'requested_date',t.requested_date,'event_id',t.event_id,
 'availability',t.availability,'last_message_at',t.last_message_at,
 'other_id',case when t.requester_id=v_user then t.musician_id else t.requester_id end,
 'other_name',coalesce(nullif(p.display_name,''),'Usuário'),
 'acting_as',case when t.requester_id=v_user then 'requester' else 'musician' end,
 'unread',(select count(*) from public.stage_hiring_messages m where m.thread_id=t.id and m.sender_id<>v_user
 and m.created_at>coalesce(case when t.requester_id=v_user then t.requester_read_at else t.musician_read_at end,t.created_at-interval '1 second')),
 'last_message',(select left(m.body,100) from public.stage_hiring_messages m where m.thread_id=t.id order by m.created_at desc,m.id desc limit 1)) into v_item from public.stage_hiring_threads t
 join public.profiles p on p.id=case when t.requester_id=v_user then t.musician_id else t.requester_id end
 where t.id=p_thread_id and v_user in(t.requester_id,t.musician_id);
 if v_item is null then return jsonb_build_object('version',1,'status','forbidden');end if;
 return jsonb_build_object('version',1,'status','ok','item',v_item);
end;$$;
revoke all on function public.stage_hiring_thread(uuid) from public,anon,authenticated;
grant execute on function public.stage_hiring_thread(uuid) to authenticated;
commit;
