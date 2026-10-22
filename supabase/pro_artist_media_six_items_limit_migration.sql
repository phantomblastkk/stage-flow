-- Stage Flow | LIMITE DE MIDIA DO SITE PRO DO CANTOR: 3 FOTOS + 3 VIDEOS
-- Requer premium_site_media_gallery_migration.sql,
-- pro_artist_publication_migration.sql corrigida e
-- pro_artist_independent_media_sections_migration.sql.
--
-- Compatibilidade:
--  - Nunca apaga fotos nem vídeos já cadastrados, nem altera os metadados
--    do rascunho ou do site Pro publicado.
--  - Novo cadastro aceita até 3 itens por tipo, sob o lock por artista.
--  - Publicações futuras incluem somente 3 fotos + 3 vídeos.
--  - Publicações anteriores com mais itens ficam limitadas na API pública
--    e na autorização de leitura de arquivos privados.
--  - Escolha determinística: destaque primeiro, depois ordem definida pelo
--    cantor e ID. Os excedentes permanecem armazenados como rascunho.
--  - Não concede plano, não publica rascunho, não muda URLs,
--    não habilita marketplace ou cobrança.
--  - Execute novamente com segurança se precisar. Nenhuma tabela é truncada.

begin;

-- Adicionar mídia: aplicar limite verdadeiro no servidor.
create or replace function public.stage_add_premium_site_media(
  p_kind text, p_title text, p_storage_path text, p_youtube_id text
)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_title text := btrim(coalesce(p_title,''));
  v_path text := nullif(btrim(coalesce(p_storage_path,'')), '');
  v_video text := nullif(btrim(coalesce(p_youtube_id,'')), '');
  v_total integer;
  v_type_count integer;
begin
  if v_owner is null then return 'login_required'; end if;
  if not exists (select 1 from public.profiles
                 where id = v_owner and is_artist = true) then return 'artist_required'; end if;
  if p_kind is null or p_kind not in ('photo','youtube') then return 'invalid_kind'; end if;
  if char_length(v_title) not between 1 and 90 then return 'invalid_title'; end if;

  if p_kind = 'photo' then
    if v_video is not null
      or v_path is null
      or v_path !~ '^[0-9a-f-]{36}/[0-9a-f-]{36}[.](jpg|png|webp)$'
      or split_part(v_path,'/',1) <> v_owner::text
      then return 'invalid_photo'; end if;
    if not exists (
      select 1 from storage.objects
      where bucket_id = 'stage-premium-drafts' and name = v_path
    ) then return 'upload_missing'; end if;
  else
    if v_path is not null or v_video is null
       or v_video !~ '^[a-zA-Z0-9_-]{11}$'
       then return 'invalid_video'; end if;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_owner::text, 253912));
  -- Contagem por tipo, sob o mesmo lock por artista. Permite no máximo
  -- 3 fotos + 3 vídeos, mesmo com chamadas simultâneas do aplicativo.
  select count(*) into v_type_count from public.stage_premium_site_media
  where owner_id = v_owner and media_kind = p_kind;
  if v_type_count >= 3 then
    return case when p_kind='photo' then 'limit_photos'
                else 'limit_videos' end;
  end if;
  -- Preserva destaque único global e campos de ordem existentes.
  select count(*) into v_total from public.stage_premium_site_media
  where owner_id = v_owner;

  insert into public.stage_premium_site_media
    (owner_id,media_kind,title,storage_path,youtube_id,display_order,featured)
  values
    (v_owner,p_kind,v_title,
     case when p_kind = 'photo' then v_path else null end,
     case when p_kind = 'youtube' then v_video else null end,
     coalesce((select max(display_order) + 1 from public.stage_premium_site_media where owner_id = v_owner),0),
     v_total = 0);
  return 'saved';
exception when unique_violation then return 'duplicate';
end;
$$;

-- Publicar: cria snapshot contendo SOMENTE o limite permitido.
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
  -- Apenas fotos efetivamente escolhidas para a publicação precisam
  -- estar no storage. Fotos antigas acima do limite ficam privadas.
  select count(*) into v_missing_photos
  from (
    select m.storage_path
    from public.stage_premium_site_media m
    where m.owner_id=v_owner and m.media_kind='photo'
    order by m.featured desc,m.display_order,m.id
    limit 3
  ) chosen
  where not exists(
    select 1 from storage.objects o
    where o.bucket_id='stage-premium-drafts'
      and o.name=chosen.storage_path
  );
  if v_missing_photos>0 then return 'photo_missing';end if;

  -- Na mesma transação substituímos o snapshot. Falhas não deixam
  -- uma versão parcialmente publicada.
  delete from public.stage_pro_site_public_media where owner_id=v_owner;

  insert into public.stage_pro_site_public_media(
    draft_media_id,owner_id,media_kind,title,
    storage_path,youtube_id,display_order,featured
  )
  select ranked.id,ranked.owner_id,ranked.media_kind,ranked.title,
    ranked.storage_path,ranked.youtube_id,ranked.display_order,ranked.featured
  from (
    select m.*,
      row_number() over (
        partition by m.media_kind
        order by m.featured desc,m.display_order,m.id
      ) as media_rank
    from public.stage_premium_site_media m
    where m.owner_id=v_owner
  ) ranked
  where ranked.media_rank<=3;

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

-- Consultar: nem o RPC público revela mídia acima do limite, mesmo quando
-- a publicação foi criada ANTES desta migração.
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
      from (
        select candidate.*,
          row_number() over (
            partition by candidate.media_kind
            order by candidate.featured desc,
              candidate.display_order,candidate.draft_media_id
          ) as media_rank
        from public.stage_pro_site_public_media candidate
        where candidate.owner_id=p.id
      ) m
      where m.media_rank<=3
        and (
          (m.media_kind='photo' and 'photos'=any(s.visible_sections))
          or (m.media_kind='youtube' and 'videos'=any(s.visible_sections))
        )
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

-- Storage: links sem autorização (inclusive a objetos antigos do snapshot)
-- não conseguem baixar fotos excedentes, se não houver outra regra de acesso.
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
      and m.draft_media_id in (
        select candidate.draft_media_id
        from public.stage_pro_site_public_media candidate
        where candidate.owner_id=m.owner_id
          and candidate.media_kind='photo'
        order by candidate.featured desc,
          candidate.display_order,candidate.draft_media_id
        limit 3
      )
      and s.published=true
      and 'photos'=any(s.visible_sections)
      and p.is_artist=true and p.is_public=true and p.username is not null
      and public.stage_pro_site_is_entitled(p.id)
  );
$$;

-- Permissões idênticas às RPCs existentes.
revoke all on function public.stage_add_premium_site_media(text,text,text,text)
  from public,anon,authenticated;
grant execute on function public.stage_add_premium_site_media(text,text,text,text)
  to authenticated;

revoke all on function public.stage_set_pro_site_published(boolean)
  from public,anon,authenticated;
grant execute on function public.stage_set_pro_site_published(boolean)
  to authenticated;

revoke all on function public.stage_public_pro_artist_site(text)
  from public,anon,authenticated;
grant execute on function public.stage_public_pro_artist_site(text)
  to anon,authenticated;

revoke all on function public.stage_pro_site_can_download_media(text)
  from public,anon,authenticated;
grant execute on function public.stage_pro_site_can_download_media(text)
  to anon,authenticated;

commit;
notify pgrst, 'reload schema';
