-- Stage Flow | PUBLICAÇÃO REAL DO SITE PRO DO CANTOR
-- Requer: multi_role_accounts, free_artist_pages, free_artist_visuals,
-- premium_site_draft_editor, premium_site_media_gallery,
-- artist_booking_requests (para formulario privado opcional).
--
-- NOVO ENDEREÇO: /pro/SEU_USUARIO na Vercel.
-- NAO cria subdominio nem cobra plano. Acesso Pro liberado somente
-- para (A) contas manualmente autorizadas em stage_pro_site_access, ou
-- (B) plano protegido artist_plus/studio com assinatura active/trialing.
-- PUBLICAÇÃO É SEMPRE MANUAL, SEPARADA DO RASCUNHO.
-- Mesmo com acesso Pro, nao se publica sem o dono clicar Publicar.
-- Nao altera mercado, subdominios, planos, assinaturas nem dados existentes.

create table if not exists public.stage_pro_site_access (
  owner_id uuid primary key references public.profiles(id) on delete cascade,
  granted_at timestamptz not null default now()
);
create table if not exists public.stage_pro_site_publications (
  owner_id uuid primary key references public.profiles(id) on delete cascade,
  published boolean not null default false,
  theme text not null default 'midnight'
    check(theme in ('midnight','concert','ivory')),
  accent text not null default 'violet'
    check(accent in ('violet','lime','cyan','gold','coral')),
  section_order text[] not null default array['about','portfolio','agenda','contact']::text[],
  visible_sections text[] not null default array['about','portfolio','agenda','contact']::text[],
  published_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint stage_pro_public_sections_valid check(
    cardinality(section_order)=4
    and section_order @> array['about','portfolio','agenda','contact']::text[]
    and section_order <@ array['about','portfolio','agenda','contact']::text[]
    and array_position(section_order,null) is null
    and cardinality(visible_sections) between 1 and 4
    and visible_sections <@ array['about','portfolio','agenda','contact']::text[]
    and array_position(visible_sections,null) is null
  )
);

create table if not exists public.stage_pro_site_public_media (
  draft_media_id uuid primary key,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  media_kind text not null check(media_kind in ('photo','youtube')),
  title text not null check(char_length(title) between 1 and 90),
  storage_path text,
  youtube_id text,
  display_order integer not null,
  featured boolean not null default false,
  constraint stage_pro_public_media_source check (
    (media_kind='photo' and storage_path is not null
      and youtube_id is null
      and storage_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}[.](jpg|png|webp)$')
    or
    (media_kind='youtube' and youtube_id ~ '^[a-zA-Z0-9_-]{11}$'
      and storage_path is null)
  )
);
create index if not exists stage_pro_media_owner_order_idx
  on public.stage_pro_site_public_media(owner_id,display_order);
create unique index if not exists stage_pro_media_owner_featured_idx
  on public.stage_pro_site_public_media(owner_id) where featured=true;

alter table public.stage_pro_site_access enable row level security;
alter table public.stage_pro_site_publications enable row level security;
alter table public.stage_pro_site_public_media enable row level security;
revoke all on public.stage_pro_site_access from public,anon,authenticated;
revoke all on public.stage_pro_site_publications from public,anon,authenticated;
revoke all on public.stage_pro_site_public_media from public,anon,authenticated;

-- Nunca expor nomes de usuários autorizados; uma conta consulta somente
-- o próprio direito, e o público só consulta sites efetivamente publicados.
create or replace function public.stage_pro_site_is_entitled(p_owner uuid)
returns boolean language sql stable security definer set search_path=''
as $$
  select exists(
    select 1 from public.profiles p
    where p.id=p_owner and p.is_artist=true and
    (
      exists(select 1 from public.stage_pro_site_access a where a.owner_id=p_owner)
      or (p.plan_code in ('artist_plus','studio')
        and p.subscription_status in ('active','trialing'))
    )
  );
$$;
revoke all on function public.stage_pro_site_is_entitled(uuid)
  from public,anon,authenticated;

create or replace function public.stage_my_pro_site_publication()
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare v_username text;v_public boolean;v_published boolean:=false;
begin
  if auth.uid() is null then return null;end if;
  select username,is_public into v_username,v_public from public.profiles
  where id=auth.uid() and is_artist=true;
  if not found then return null;end if;
  select coalesce(published,false) into v_published
    from public.stage_pro_site_publications where owner_id=auth.uid();
  return jsonb_build_object(
    'entitled',public.stage_pro_site_is_entitled(auth.uid()),
    'published',coalesce(v_published,false),
    'username',v_username,
    'profile_public',v_public,
    'url_path',case when v_username is null then null else '/pro/'||v_username end
  );
end;
$$;
revoke all on function public.stage_my_pro_site_publication()
  from public,anon,authenticated;
grant execute on function public.stage_my_pro_site_publication() to authenticated;

-- Fotografias continuam no bucket PRIVADO do rascunho.
-- Autorização de leitura pública é somente para os arquivos que constam
-- do último snapshot, enquanto o site/propriedade/plano seguem ativos.
-- Nenhum link assinado de rascunho é exposto.
create or replace function public.stage_pro_site_can_download_media(p_path text)
returns boolean language sql stable security definer set search_path=''
as $$
  select p_path is not null and exists(
    select 1
    from public.stage_pro_site_public_media m
    join public.stage_pro_site_publications s on s.owner_id=m.owner_id
    join public.profiles p on p.id=m.owner_id
    where m.media_kind='photo'
      and m.storage_path=p_path
      and s.published=true
      and p.is_artist=true and p.is_public=true and p.username is not null
      and public.stage_pro_site_is_entitled(p.id)
  );
$$;
revoke all on function public.stage_pro_site_can_download_media(text)
  from public,anon,authenticated;
-- A storage policy precisa poder invocar esta função definer.
grant execute on function public.stage_pro_site_can_download_media(text)
  to anon,authenticated;

drop policy if exists "stage_pro_published_media_read" on storage.objects;
create policy "stage_pro_published_media_read"
on storage.objects for select to anon,authenticated
using (
  bucket_id='stage-premium-drafts'
  and public.stage_pro_site_can_download_media(name)
);

-- Impede que o dono exclua um arquivo ainda presente no site publicado.
-- Para remover a foto, primeiro deve despublicar ou substituir a publicação.
drop policy if exists "stage_premium_draft_delete_own" on storage.objects;
create policy "stage_premium_draft_delete_own"
on storage.objects for delete to authenticated
using (
  bucket_id='stage-premium-drafts'
  and (storage.foldername(name))[1]=(select auth.uid())::text
  and not public.stage_pro_site_can_download_media(name)
);

-- Página pública retorna apenas o snapshot publicado + dados já públicos
-- da página gratuita do próprio cantor.
-- Sem login, sem contato privado, sem media que ainda não tenha sido publicada,
-- sem convites, rascunhos, cachês, contratos, permissões ou solicitações.
create or replace function public.stage_public_pro_artist_site(p_username text)
returns jsonb
language plpgsql stable security definer set search_path=''
as $$
declare v_result jsonb;
begin
  if p_username is null or p_username !~ '^[a-z0-9-]{3,30}$'
  then return null;end if;

  select jsonb_build_object(
    'artist',jsonb_build_object(
      'name',p.display_name,'username',p.username,
      'headline',p.artist_headline,'bio',coalesce(p.bio,''),
      'city',coalesce(p.city,''),
      'instagram_url',p.instagram_url,
      'youtube_url',p.youtube_url,
      'spotify_url',p.spotify_url,
      'avatar_path',p.artist_avatar_path,
      'cover_path',p.artist_cover_path,
      'bookings_enabled',coalesce(p.accept_booking_requests,false)
    ),
    'design',jsonb_build_object(
      'theme',s.theme,'accent',s.accent,
      'section_order',s.section_order,
      'visible_sections',s.visible_sections
    ),
    'media',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',m.draft_media_id,'media_kind',m.media_kind,
        'title',m.title,'storage_path',m.storage_path,
        'youtube_id',m.youtube_id,'featured',m.featured,
        'display_order',m.display_order
      ) order by m.display_order,m.draft_media_id)
      from public.stage_pro_site_public_media m
      where m.owner_id=p.id
    ),'[]'::jsonb),
    'events',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',ev.id,'title',ev.title,'venue',ev.venue,
        'city',ev.city,'starts_at',ev.starts_at
      ) order by ev.starts_at)
      from (
        select id,title,venue,city,starts_at
        from public.events
        where producer_id=p.id
          and show_publicly=true and status='published'
          and starts_at>=now()
        order by starts_at asc limit 40
      ) ev
    ),'[]'::jsonb)
  )
  into v_result
  from public.profiles p
  join public.stage_pro_site_publications s
    on s.owner_id=p.id and s.published=true
  where p.username=p_username
    and p.is_artist=true and p.is_public=true
    and public.stage_pro_site_is_entitled(p.id)
  limit 1;

  return v_result;
end;
$$;
revoke all on function public.stage_public_pro_artist_site(text)
  from public,anon,authenticated;
grant execute on function public.stage_public_pro_artist_site(text)
  to anon,authenticated;

-- O perfil gratuito pode exibir o atalho para Pro sem ler dados do rascunho.
create or replace function public.stage_public_pro_site_available(p_username text)
returns boolean language sql stable security definer set search_path=''
as $
  select exists(
    select 1 from public.profiles p
    join public.stage_pro_site_publications s
      on s.owner_id=p.id and s.published=true
    where p_username is not null
      and p.username=lower(btrim(p_username))
      and p.is_artist=true and p.is_public=true
      and public.stage_pro_site_is_entitled(p.id)
  );
$;
revoke all on function public.stage_public_pro_site_available(text)
  from public,anon,authenticated;
grant execute on function public.stage_public_pro_site_available(text)
  to anon,authenticated;

-- Publicar é escolha explícita do cantor com acesso Pro. Um rascunho
-- precisa estar SALVO para virar snapshot, jamais lemos a prévia no cliente
-- para confiar em permissões ou ativar plano.
create or replace function public.stage_set_pro_site_published(p_publish boolean)
returns text
language plpgsql security definer set search_path=''
as $$
declare
  v_owner uuid:=auth.uid();
  v_profile public.profiles%rowtype;
  v_draft public.stage_premium_site_drafts%rowtype;
  v_missing_photos integer;
begin
  if v_owner is null then return 'login_required';end if;
  if p_publish is null then return 'invalid';end if;
  select * into v_profile from public.profiles
    where id=v_owner and is_artist=true for update;
  if not found then return 'artist_required';end if;

  -- Despublicar é permitido mesmo se a assinatura expirou.
  if p_publish=false then
    update public.stage_pro_site_publications
      set published=false,updated_at=now()
      where owner_id=v_owner;
    return 'unpublished';
  end if;

  if not public.stage_pro_site_is_entitled(v_owner)
  then return 'pro_access_required';end if;
  if v_profile.username is null or v_profile.is_public=false
  then return 'publish_free_profile_first';end if;

  -- Usa o mesmo lock das rotinas privadas da galeria.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_owner::text,253912));

  select * into v_draft from public.stage_premium_site_drafts
    where owner_id=v_owner;
  if not found then return 'save_draft_first';end if;

  -- Não transforma fotografia temporária não enviada em galeria pública.
  select count(*) into v_missing_photos
  from public.stage_premium_site_media m
  where m.owner_id=v_owner and m.media_kind='photo'
    and not exists(
      select 1 from storage.objects o
      where o.bucket_id='stage-premium-drafts'
        and o.name=m.storage_path
    );
  if v_missing_photos>0 then return 'photo_missing';end if;

  -- Na mesma transação substituímos o snapshot. Falhas não deixam
  -- uma versão parcialmente publicada.
  delete from public.stage_pro_site_public_media where owner_id=v_owner;

  insert into public.stage_pro_site_public_media(
    draft_media_id,owner_id,media_kind,title,
    storage_path,youtube_id,display_order,featured
  )
  select id,owner_id,media_kind,title,
    storage_path,youtube_id,display_order,featured
  from public.stage_premium_site_media
  where owner_id=v_owner;

  insert into public.stage_pro_site_publications(
    owner_id,published,theme,accent,section_order,
    visible_sections,published_at,updated_at
  ) values (
    v_owner,true,v_draft.theme,v_draft.accent,
    v_draft.section_order,v_draft.visible_sections,now(),now()
  )
  on conflict(owner_id) do update
    set published=true,theme=excluded.theme,accent=excluded.accent,
      section_order=excluded.section_order,
      visible_sections=excluded.visible_sections,
      published_at=now(),updated_at=now();

  return 'published';
end;
$$;
revoke all on function public.stage_set_pro_site_published(boolean)
  from public,anon,authenticated;
grant execute on function public.stage_set_pro_site_published(boolean)
  to authenticated;

-- Evita que o editor exclua foto ainda usada na versão publicada.
-- Outras ações do editor (renomear, reordenar, destacar) permanecem
-- alterações somente do rascunho até a republicação explícita.
create or replace function public.stage_remove_premium_site_media(p_id uuid)
returns text
language plpgsql security definer set search_path=''
as $$
declare
  v_owner uuid:=auth.uid();
  v_was_featured boolean;
  v_next uuid;
begin
  if v_owner is null then return 'login_required';end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_owner::text,253912));
  if exists (
    select 1 from public.stage_pro_site_public_media m
    join public.stage_pro_site_publications s on s.owner_id=m.owner_id
    where m.draft_media_id=p_id
      and m.owner_id=v_owner and m.media_kind='photo'
      and s.published=true
  ) then return 'published_media_in_use';end if;

  delete from public.stage_premium_site_media
  where owner_id=v_owner and id=p_id returning featured into v_was_featured;
  if not found then return 'not_found';end if;
  if v_was_featured then
    select id into v_next
    from public.stage_premium_site_media
    where owner_id=v_owner
    order by display_order,created_at,id limit 1;
    if v_next is not null then
      update public.stage_premium_site_media set featured=true
      where owner_id=v_owner and id=v_next;
    end if;
  end if;
  return 'saved';
end;
$$;
revoke all on function public.stage_remove_premium_site_media(uuid)
  from public,anon,authenticated;
grant execute on function public.stage_remove_premium_site_media(uuid)
  to authenticated;

-- Reserva o prefixo /pro para não colidir com @ do perfil gratuito.
-- Preserva as demais palavras reservadas existentes.
create or replace function public.stage_protect_reserved_artist_usernames()
returns trigger language plpgsql set search_path=''
as $
begin
  if new.username is not null and lower(new.username) = any(array[
    'admin','api','auth','artista','artistas','cadastro','configuracoes',
    'convite','convites','dashboard','entrar','equipes','eventos',
    'login','logout','marketplace','meu-perfil','meu-perfil-artistico',
    'meu-portfolio','meu-desempenho','meus-convites','musico','musicos',
    'painel','planos','privacidade','pro','publico','sobre','suporte',
    'termos','www'
  ]) then
    raise exception 'Este nome de usuário está reservado para o Stage Flow.';
  end if;
  return new;
end;
$;

-- Autorização de teste/manual, aplicada SOMENTE pelo administrador:
-- insert into public.stage_pro_site_access(owner_id)
-- select id from auth.users where lower(email)=lower('SEU_EMAIL')
-- on conflict(owner_id) do nothing;
-- O cantor ainda precisa salvar seu rascunho e clicar Publicar.
--
-- IMPORTANTE: custom_subdomain_enabled NÃO ativa domínios DNS.
-- /pro/USUARIO funciona na Vercel. Subdomínios requerem DNS, wildcard
-- e configuração de host confiável, em uma etapa independente.
