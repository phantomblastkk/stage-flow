-- StageFlow | Chat publico limitado a artistas que optaram pelo catalogo.
-- A ativacao e separada; sem alteracoes em pagamentos, WhatsApp ou RLS.
begin;
create or replace function public.stage_hiring_start(
 p_musician_id uuid,p_date date default null,p_event_id uuid default null
)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_thread uuid;v_user uuid:=auth.uid();v_date date:=p_date;v_hidden boolean:=false;
begin
 if v_user is null then return jsonb_build_object('status','login_required');end if;
 if not public.stage_hiring_can_start(v_user) then
  return jsonb_build_object('status','not_released');end if;
 -- Novos chats exigem portfolio publicado e inclusao voluntaria no catalogo.
 if p_musician_id is null or p_musician_id=v_user
   or not exists (
     select 1 from public.profiles p
     join public.musician_portfolios m on m.profile_id=p.id and m.is_published=true
     join public.stage_marketplace_musician_settings s
       on s.musician_id=p.id and s.listed=true
     where p.id=p_musician_id and p.is_artist=true
   )
 then return jsonb_build_object('status','invalid_musician');end if;
 -- A tabela de moderacao ainda pode faltar no banco QA; no oficial,
 -- um perfil moderado nunca pode receber novos contatos.
 if to_regclass('public.stage_marketplace_hidden_musicians') is not null then
   execute 'select exists(select 1 from public.stage_marketplace_hidden_musicians where musician_id=$1)'
     into v_hidden using p_musician_id;
   if v_hidden then return jsonb_build_object('status','invalid_musician');end if;
 end if;
 if v_date is not null and (v_date<current_date or v_date>current_date+interval '366 days')
 then return jsonb_build_object('status','invalid_date');end if;
 if p_event_id is not null then
   if not exists(select 1 from public.events
     where id=p_event_id and producer_id=v_user and status<>'cancelled')
   then return jsonb_build_object('status','invalid_event');end if;
 end if;
 -- Adiciona limite diário de novas conversas para impedir varredura e spam.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user::text, 330924));
 select id into v_thread from public.stage_hiring_threads
 where requester_id=v_user and musician_id=p_musician_id
   and requested_date is not distinct from v_date
   and event_id is not distinct from p_event_id limit 1;
 if v_thread is null then
   if (select count(*) from public.stage_hiring_threads
     where requester_id=v_user and created_at>now()-interval '1 day')>=15
   then return jsonb_build_object('status','daily_limit');end if;
   insert into public.stage_hiring_threads(requester_id,musician_id,requested_date,event_id)
     values(v_user,p_musician_id,v_date,p_event_id) returning id into v_thread;
 end if;
 return jsonb_build_object('status','ok','thread_id',v_thread);
end;
$$;
revoke all on function public.stage_hiring_start(uuid,date,uuid) from public,anon,authenticated;
grant execute on function public.stage_hiring_start(uuid,date,uuid) to authenticated;
commit;
notify pgrst, 'reload schema';
