-- STAGE FLOW / MARKETPLACE DE MUSICOS
-- LANCAMENTO BLOQUEADO POR PADRAO. O usuario deve autorizar explicitamente.
-- Prerequisitos: musician_portfolios_migration.sql, musician_portfolio_appearance_migration.sql,
-- musician_portfolio_complete_migration.sql, received_invitations_migration.sql,
-- invitations_migration.sql e tabelas profiles/events/invitations existentes.
-- Pagamentos, planos, publicacao Premium e subdominios NAO sao alterados.
-- NUNCA defina stage_marketplace_control.launched=true automaticamente.
-- Preview depende de inclusao manual em stage_marketplace_preview_access.
-- Tabelas privadas sem acesso direto; use apenas RPCs com verificacao de permissao.
create extension if not exists pgcrypto;

create table if not exists public.stage_marketplace_control (
  id boolean primary key default true check (id = true),
  launched boolean not null default false,
  updated_at timestamptz not null default now()
);
insert into public.stage_marketplace_control (id,launched)
values (true,false) on conflict (id) do nothing;
revoke all on public.stage_marketplace_control from public, anon, authenticated;
alter table public.stage_marketplace_control enable row level security;

create table if not exists public.stage_marketplace_preview_access (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  granted_at timestamptz not null default now()
);
revoke all on public.stage_marketplace_preview_access from public,anon,authenticated;
alter table public.stage_marketplace_preview_access enable row level security;

-- O artista precisa permitir manualmente participar do marketplace.
-- A lista de datas e "nao disponivel" declarada, sem agenda de shows.
create table if not exists public.stage_marketplace_musician_settings (
  musician_id uuid primary key references public.profiles(id) on delete cascade,
  listed boolean not null default false,
  availability_mode text not null default 'ask'
    check (availability_mode in ('ask','accepting','unavailable')),
  blocked_dates date[] not null default '{}'::date[],
  updated_at timestamptz not null default now(),
  constraint stage_marketplace_blocked_limit check (
    cardinality(blocked_dates) <= 45
    and array_position(blocked_dates,null) is null
  )
);
revoke all on public.stage_marketplace_musician_settings from public,anon,authenticated;
alter table public.stage_marketplace_musician_settings enable row level security;
create index if not exists stage_marketplace_settings_listed_idx
on public.stage_marketplace_musician_settings(listed,musician_id);

-- Favoritos: relacionamentos privados do contratante.
create table if not exists public.stage_marketplace_favorites (
  owner_id uuid not null references public.profiles(id) on delete cascade,
  musician_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (owner_id,musician_id),
  check (owner_id <> musician_id)
);
create index if not exists stage_marketplace_favorites_owner_idx
on public.stage_marketplace_favorites(owner_id,created_at desc);
revoke all on public.stage_marketplace_favorites from public,anon,authenticated;
alter table public.stage_marketplace_favorites enable row level security;

-- Avaliacoes somente de evento realmente concluido com convite aceito.
create table if not exists public.stage_marketplace_reviews (
  id uuid primary key default gen_random_uuid(),
  organizer_id uuid not null references public.profiles(id) on delete cascade,
  musician_id uuid not null references public.profiles(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  comment text not null default '' check (char_length(comment) <= 450),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(event_id,musician_id),
  check(organizer_id <> musician_id)
);
create index if not exists stage_marketplace_reviews_musician_idx
on public.stage_marketplace_reviews(musician_id,created_at desc);
revoke all on public.stage_marketplace_reviews from public,anon,authenticated;
alter table public.stage_marketplace_reviews enable row level security;

-- Somente funcionarios adicionados manualmente pelo proprietario no SQL Editor
-- podem ver a versao nao lancada. Mesmo anon tem sem acesso ao catalogo.
create or replace function public.stage_marketplace_gate()
returns boolean
language sql stable security definer set search_path=''
as $$
  select coalesce((select launched from public.stage_marketplace_control where id=true),false)
    or (
      auth.uid() is not null and exists (
        select 1 from public.stage_marketplace_preview_access
        where profile_id=auth.uid()
      )
    );
$$;
revoke all on function public.stage_marketplace_gate() from public;
grant execute on function public.stage_marketplace_gate() to anon,authenticated;

create or replace function public.stage_marketplace_preview_status()
returns jsonb
language sql stable security definer set search_path=''
as $$
  select jsonb_build_object(
    'allowed', auth.uid() is not null and exists (
      select 1 from public.stage_marketplace_preview_access
      where profile_id=auth.uid()
    ),
    'launched', coalesce((
      select launched from public.stage_marketplace_control where id=true
    ),false)
  );
$$;
revoke all on function public.stage_marketplace_preview_status() from public;
grant execute on function public.stage_marketplace_preview_status() to authenticated;

-- PREFERENCIAS DO MUSICO: nao dependem de liberar o catalogo.
create or replace function public.stage_my_marketplace_settings()
returns jsonb language plpgsql stable security definer set search_path=''
as $$
begin
  if auth.uid() is null or not exists(
    select 1 from public.profiles where id=auth.uid() and is_artist=true
  ) then return null; end if;
  return coalesce((
    select jsonb_build_object(
      'listed',s.listed,'availability_mode',s.availability_mode,
      'blocked_dates',s.blocked_dates
    ) from public.stage_marketplace_musician_settings s
    where s.musician_id=auth.uid()
  ),jsonb_build_object('listed',false,'availability_mode','ask',
    'blocked_dates','[]'::jsonb));
end;
$$;
revoke all on function public.stage_my_marketplace_settings() from public;
grant execute on function public.stage_my_marketplace_settings() to authenticated;

create or replace function public.stage_save_marketplace_settings(
  p_listed boolean,p_availability_mode text,p_blocked_dates date[]
)
returns text language plpgsql security definer set search_path=''
as $$
declare v_blocked date[];
begin
  if auth.uid() is null then return 'login_required'; end if;
  if not exists(select 1 from public.profiles
    where id=auth.uid() and is_artist=true) then return 'artist_required'; end if;
  if p_listed is null or p_availability_mode is null
    or p_availability_mode not in ('ask','accepting','unavailable')
  then return 'invalid'; end if;
  if coalesce(cardinality(p_blocked_dates),0)>45 or
     array_position(p_blocked_dates,null) is not null
  then return 'too_many_dates'; end if;
  if exists(select 1 from unnest(coalesce(p_blocked_dates,'{}'::date[])) d
    where d<current_date or d>current_date+interval '366 days')
  then return 'invalid_date'; end if;
  if p_listed=true and not exists(
    select 1 from public.musician_portfolios
    where profile_id=auth.uid() and is_published=true
  ) then return 'publish_portfolio_first'; end if;
  v_blocked:=array(select distinct d
     from unnest(coalesce(p_blocked_dates,'{}'::date[])) d order by d);
  insert into public.stage_marketplace_musician_settings(
    musician_id,listed,availability_mode,blocked_dates,updated_at
  )values(auth.uid(),p_listed,p_availability_mode,v_blocked,now())
  on conflict(musician_id)do update set
    listed=excluded.listed,availability_mode=excluded.availability_mode,
    blocked_dates=excluded.blocked_dates,updated_at=now();
  return 'saved';
end;
$$;
revoke all on function public.stage_save_marketplace_settings(boolean,text,date[]) from public;
grant execute on function public.stage_save_marketplace_settings(boolean,text,date[]) to authenticated;

-- Pesquisa server-side: limit e offset, filtros e ranking calculados no banco.
-- Consulta publica SOMENTE se released=true. Antes disso, SOMENTE allowlist.
-- Campos da ficha sao do portfolio ja publicado, sem contatos privados.
create or replace function public.stage_marketplace_search(
  p_query text default '',
  p_city text default '',
  p_instrument text default '',
  p_genre text default '',
  p_max_fee numeric default null,
  p_date date default null,
  p_only_available boolean default false,
  p_only_favorites boolean default false,
  p_sort text default 'recent',
  p_limit integer default 18,
  p_offset integer default 0
)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare v_items jsonb;
        v_total integer;
        v_query text:=left(btrim(coalesce(p_query,'')),90);
        v_city text:=left(btrim(coalesce(p_city,'')),90);
        v_instr text:=left(btrim(coalesce(p_instrument,'')),60);
        v_genre text:=left(btrim(coalesce(p_genre,'')),60);
begin
  if not public.stage_marketplace_gate() then
    return jsonb_build_object('status','not_released','items','[]'::jsonb,'total',0);
  end if;
  if p_limit is null or p_limit<1 or p_limit>48 or p_offset is null
    or p_offset<0 or p_offset>10000
    or p_sort not in ('recent','name','experience','rating')
    or (p_max_fee is not null and (p_max_fee<0 or p_max_fee>999999.99))
    or (p_date is not null and (p_date<current_date or p_date>current_date+interval '366 days'))
  then return jsonb_build_object('status','invalid','items','[]'::jsonb,'total',0); end if;
  if p_only_favorites and auth.uid() is null
  then return jsonb_build_object('status','login_required','items','[]'::jsonb,'total',0); end if;

  with eligible as (
    select p.id as musician_id,p.display_name,m.slug,m.headline,m.bio,m.city,
      m.instruments,m.genres,m.avatar_url,m.cover_url,m.media_url,
      m.price_mode,
      case when m.price_mode='from' then m.reference_fee else null end as reference_fee,
      m.experience_years,m.performance_types,m.availability_note,m.updated_at,
      s.availability_mode,s.blocked_dates,
      coalesce(r.rating_avg,0) as rating_avg,coalesce(r.rating_count,0) as rating_count,
      (f.owner_id is not null) as is_favorite
    from public.musician_portfolios m
    join public.profiles p on p.id=m.profile_id
    join public.stage_marketplace_musician_settings s
      on s.musician_id=m.profile_id and s.listed=true
    left join lateral (
      select round(avg(rating)::numeric,1) rating_avg,count(*)::integer rating_count
      from public.stage_marketplace_reviews where musician_id=m.profile_id
    ) r on true
    left join public.stage_marketplace_favorites f
      on f.owner_id=auth.uid() and f.musician_id=m.profile_id
    where m.is_published=true and p.is_artist=true
      and (v_query='' or p.display_name ilike '%'||v_query||'%'
        or m.headline ilike '%'||v_query||'%'
        or exists(select 1 from unnest(m.instruments) a where a ilike '%'||v_query||'%'))
      and (v_city='' or m.city ilike '%'||v_city||'%')
      and (v_instr='' or exists(select 1 from unnest(m.instruments) a
        where a ilike '%'||v_instr||'%'))
      and (v_genre='' or exists(select 1 from unnest(m.genres) a
        where a ilike '%'||v_genre||'%'))
      and (p_max_fee is null or (m.price_mode='from'
        and m.reference_fee<=p_max_fee))
      and (not p_only_favorites or f.owner_id is not null)
      and (not coalesce(p_only_available,false) or
         (s.availability_mode='accepting'
           and (p_date is null or not p_date=any(s.blocked_dates))))
  ), ordered as (
    select * from eligible order by
      case when p_sort='rating' then rating_avg end desc nulls last,
      case when p_sort='rating' then rating_count end desc nulls last,
      case when p_sort='experience' then experience_years end desc nulls last,
      case when p_sort='name' then display_name end asc,
      case when p_sort='recent' then updated_at end desc nulls last,
      display_name asc,musician_id asc
    limit p_limit offset p_offset
  )
  select
    (select count(*) from eligible),
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'musician_id',o.musician_id,'name',o.display_name,
        'slug',o.slug,'headline',o.headline,'city',o.city,
        'instruments',o.instruments,'genres',o.genres,
        'avatar_url',o.avatar_url,'cover_url',o.cover_url,
        'price_mode',o.price_mode,'reference_fee',o.reference_fee,
        'experience_years',o.experience_years,'performance_types',o.performance_types,
        'availability_note',o.availability_note,'availability_mode',o.availability_mode,
        'date_blocked',case when p_date is null then false
          else p_date=any(o.blocked_dates) end,
        'rating_avg',o.rating_avg,'rating_count',o.rating_count,
        'is_favorite',o.is_favorite
      ) order by
        case when p_sort='rating' then o.rating_avg end desc nulls last,
        case when p_sort='rating' then o.rating_count end desc nulls last,
        case when p_sort='experience' then o.experience_years end desc nulls last,
        case when p_sort='name' then o.display_name end asc,
        case when p_sort='recent' then o.updated_at end desc nulls last,
        o.display_name asc,o.musician_id asc)
      from ordered o
    ),'[]'::jsonb)
  into v_total,v_items;

  return jsonb_build_object('status','ok','items',v_items,
    'total',v_total,'limit',p_limit,'offset',p_offset);
end;
$$;
revoke all on function public.stage_marketplace_search(
  text,text,text,text,numeric,date,boolean,boolean,text,integer,integer
) from public;
grant execute on function public.stage_marketplace_search(
  text,text,text,text,numeric,date,boolean,boolean,text,integer,integer
) to anon,authenticated;

-- FAVORITOS: exigem sessao e liberacao (ou preview).
create or replace function public.stage_marketplace_toggle_favorite(
  p_musician_id uuid,p_favorite boolean
)
returns text language plpgsql security definer set search_path=''
as $$
begin
  if auth.uid() is null then return 'login_required'; end if;
  if not public.stage_marketplace_gate() then return 'not_released'; end if;
  if p_musician_id is null or p_musician_id=auth.uid() or p_favorite is null
    then return 'invalid'; end if;
  if not exists(select 1 from public.musician_portfolios m
    join public.stage_marketplace_musician_settings s on s.musician_id=m.profile_id
    where m.profile_id=p_musician_id and m.is_published=true and s.listed=true)
    then return 'not_listed'; end if;
  if p_favorite then
    insert into public.stage_marketplace_favorites(owner_id,musician_id)
    values(auth.uid(),p_musician_id) on conflict do nothing;
  else
    delete from public.stage_marketplace_favorites
      where owner_id=auth.uid() and musician_id=p_musician_id;
  end if;
  return 'saved';
end;
$$;
revoke all on function public.stage_marketplace_toggle_favorite(uuid,boolean) from public;
grant execute on function public.stage_marketplace_toggle_favorite(uuid,boolean) to authenticated;

-- ORGANIZADOR escolhe SHOW EXISTENTE de sua conta.
create or replace function public.stage_marketplace_my_events()
returns jsonb language sql stable security definer set search_path=''
as $$
  select case when auth.uid() is null or not public.stage_marketplace_gate()
    then '[]'::jsonb else coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',e.id,'title',e.title,'starts_at',e.starts_at,'city',e.city
      ) order by e.starts_at asc)
      from public.events e where e.producer_id=auth.uid()
        and e.status in ('draft','published')
        and e.starts_at>=now()
    ),'[]'::jsonb) end;
$$;
revoke all on function public.stage_marketplace_my_events() from public;
grant execute on function public.stage_marketplace_my_events() to authenticated;

-- CONVITE DIRETO E INDIVIDUAL: nao publica show, nao aceita cachê,
-- nao envia WhatsApp, nao concede privilegios ou assinaturas.
create or replace function public.stage_marketplace_invite_musician(
  p_event_id uuid,p_musician_id uuid,p_message text
)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_id uuid;v_status text;
        v_message text:=nullif(btrim(coalesce(p_message,'')),'');
begin
  if auth.uid() is null then return jsonb_build_object('status','login_required'); end if;
  if not public.stage_marketplace_gate() then
    return jsonb_build_object('status','not_released'); end if;
  if p_event_id is null or p_musician_id is null or auth.uid()=p_musician_id
    then return jsonb_build_object('status','invalid'); end if;
  if v_message is not null and char_length(v_message)>500
    then return jsonb_build_object('status','invalid_message'); end if;
  if not exists(select 1 from public.events e where e.id=p_event_id
    and e.producer_id=auth.uid() and e.status in ('draft','published')
    and e.starts_at>=now()) then return jsonb_build_object('status','event_not_found');end if;
  if not exists(
    select 1 from public.musician_portfolios m
    join public.stage_marketplace_musician_settings s on s.musician_id=m.profile_id
    where m.profile_id=p_musician_id and m.is_published=true
      and s.listed=true and s.availability_mode<>'unavailable'
  ) then return jsonb_build_object('status','not_listed');end if;
  -- Um dia bloqueado explicitamente pelo musico nao pode ser convidado
  -- via marketplace. Sao Paulo e a timezone padrao inicial do produto;
  -- horarios de eventos em outros fusos devem ser definidos futuramente.
  if exists (
    select 1 from public.events e
    join public.stage_marketplace_musician_settings s
      on s.musician_id=p_musician_id
    where e.id=p_event_id and e.producer_id=auth.uid()
      and (e.starts_at at time zone 'America/Sao_Paulo')::date
        =any(s.blocked_dates)
  ) then return jsonb_build_object('status','date_unavailable');end if;

  insert into public.invitations(event_id,musician_id,message,status)
  values(p_event_id,p_musician_id,v_message,'pending')
  on conflict(event_id,musician_id)do nothing
  returning id into v_id;
  if v_id is null then
    select i.id,i.status::text into v_id,v_status
    from public.invitations i where i.event_id=p_event_id
      and i.musician_id=p_musician_id limit 1;
    return jsonb_build_object('status','already_exists','invitation_id',v_id,
      'invitation_status',v_status);
  end if;
  return jsonb_build_object('status','sent','invitation_id',v_id);
end;
$$;
revoke all on function public.stage_marketplace_invite_musician(uuid,uuid,text) from public;
grant execute on function public.stage_marketplace_invite_musician(uuid,uuid,text) to authenticated;

-- AVALIACOES: so se o organizador foi dono de evento COMPLETED
-- e o musico aceitou convite daquele show. So uma por evento/musico.
create or replace function public.stage_marketplace_my_reviewable(
  p_musician_id uuid
)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
begin
  if auth.uid() is null or not public.stage_marketplace_gate()
    then return '[]'::jsonb; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'event_id',e.id,'event_title',e.title,
      'starts_at',e.starts_at,'reviewed',r.id is not null
    ) order by e.starts_at desc)
    from public.events e
    join public.invitations i on i.event_id=e.id
      and i.musician_id=p_musician_id and i.status='accepted'
    left join public.stage_marketplace_reviews r on r.event_id=e.id
      and r.musician_id=p_musician_id
    where e.producer_id=auth.uid() and e.status='completed'
      and e.starts_at<now() and e.producer_id<>p_musician_id
  ),'[]'::jsonb);
end;
$$;
revoke all on function public.stage_marketplace_my_reviewable(uuid) from public;
grant execute on function public.stage_marketplace_my_reviewable(uuid) to authenticated;

create or replace function public.stage_marketplace_submit_review(
  p_event_id uuid,p_musician_id uuid,p_rating integer,p_comment text
)
returns text language plpgsql security definer set search_path=''
as $$
declare v_comment text:=btrim(coalesce(p_comment,''));
begin
  if auth.uid() is null then return 'login_required'; end if;
  if not public.stage_marketplace_gate() then return 'not_released'; end if;
  if p_rating is null or p_rating not between 1 and 5
    or char_length(v_comment)>450 then return 'invalid';end if;
  if p_musician_id=auth.uid() or not exists(
    select 1 from public.events e
    join public.invitations i on i.event_id=e.id
    where e.id=p_event_id and e.producer_id=auth.uid()
      and e.status='completed' and e.starts_at<now()
      and i.musician_id=p_musician_id and i.status='accepted'
  ) then return 'not_eligible';end if;
  if exists(select 1 from public.stage_marketplace_reviews
    where event_id=p_event_id and musician_id=p_musician_id)
    then return 'already_reviewed';end if;
  insert into public.stage_marketplace_reviews(
    organizer_id,musician_id,event_id,rating,comment)
  values(auth.uid(),p_musician_id,p_event_id,p_rating,v_comment);
  return 'saved';
exception when unique_violation then return 'already_reviewed';
end;
$$;
revoke all on function public.stage_marketplace_submit_review(uuid,uuid,integer,text) from public;
grant execute on function public.stage_marketplace_submit_review(uuid,uuid,integer,text)
  to authenticated;

-- A lista de avaliacoes tambem fica fechada ate lancamento/autorizacao.
-- Titulo do show nao e exposto; somente nota, comentario e nome do avaliador.
create or replace function public.stage_marketplace_reviews_for_musician(p_musician_id uuid)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
begin
  if not public.stage_marketplace_gate() then return '[]'::jsonb;end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id',r.id,'organizer_name',p.display_name,
      'rating',r.rating,'comment',r.comment,'created_at',r.created_at
    ) order by r.created_at desc)
    from (
      select * from public.stage_marketplace_reviews
      where musician_id=p_musician_id order by created_at desc limit 30
    ) r join public.profiles p on p.id=r.organizer_id
  ),'[]'::jsonb);
end;
$$;
revoke all on function public.stage_marketplace_reviews_for_musician(uuid) from public;
grant execute on function public.stage_marketplace_reviews_for_musician(uuid)
  to anon,authenticated;

-- OPERACAO DE LANCAMENTO (somente apos autorizacao do fundador):
-- 1) substituir o teaser publico pelo catalogo real no Next.js
-- 2) executar NO SQL EDITOR explicitamente:
--    update public.stage_marketplace_control set launched=true,updated_at=now() where id=true;
-- Previa ANTES do lancamento: no SQL Editor, adicione somente a sua conta:
-- insert into public.stage_marketplace_preview_access(profile_id)
-- select id from auth.users where email='SEU_EMAIL'
-- on conflict(profile_id) do nothing;
-- Nao ative launced=true durante os testes.
