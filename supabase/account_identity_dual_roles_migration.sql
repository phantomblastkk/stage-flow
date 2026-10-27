-- StageFlow: explicit singer/musician roles and 60-day identity-change cooldown.
-- No paid entitlements. QA first; preserves current musician portfolios.
begin;
alter table public.profiles
 add column if not exists is_singer boolean not null default false,
 add column if not exists is_musician boolean not null default false,
 add column if not exists display_name_changed_at timestamptz,
 add column if not exists username_changed_at timestamptz;

-- Preserve previous behaviors: existing singers with published musician
-- portfolios retain their musician role. Existing support artists stay musicians.
update public.profiles p
set is_singer=(p.is_artist and p.artist_kind='lead'),
    is_musician=(p.is_artist and (p.artist_kind='support' or
      exists(select 1 from public.musician_portfolios m where m.profile_id=p.id)))
where p.is_artist=true and not(p.is_singer or p.is_musician);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  chosen_artist boolean;
  chosen_producer boolean;
  chosen_kind text;
  chosen_role public.account_role;
  chosen_name text;
  chosen_username text;
  chosen_invite text;
  chosen_singer boolean;
  chosen_musician boolean;
begin
  chosen_artist := coalesce((new.raw_user_meta_data ->> 'is_artist')::boolean, true);
  chosen_producer := coalesce((new.raw_user_meta_data ->> 'is_producer')::boolean, false);
  if not chosen_artist and not chosen_producer then chosen_artist := true; end if;

  chosen_role := case when chosen_producer and not chosen_artist
    then 'producer'::public.account_role
    else 'musician'::public.account_role end;
  chosen_name := coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), 'Novo usuário');
  chosen_username := lower(nullif(trim(new.raw_user_meta_data ->> 'username'), ''));
  if not chosen_artist then chosen_username := null; end if;
  chosen_invite := nullif(trim(new.raw_user_meta_data ->> 'invite_code'), '');

  if chosen_artist then
    chosen_kind := new.raw_user_meta_data ->> 'artist_kind';
    if chosen_kind is null or chosen_kind not in ('lead','support') then
      chosen_kind := case when chosen_username is not null then 'lead' else 'support' end;
    end if;
  else
    chosen_kind := null;
  end if;

  -- Evaluate roles only after artist_kind is resolved (including fallback).
  chosen_singer := chosen_artist and chosen_kind = 'lead';
  chosen_musician := chosen_artist and (chosen_kind = 'support'
    or coalesce((new.raw_user_meta_data ->> 'is_musician')::boolean,false));

  insert into public.profiles
    (id, role, display_name, username, is_artist, is_producer,
     artist_kind, is_singer, is_musician, plan_code, custom_subdomain_enabled, marketplace_enabled)
  values
    (new.id, chosen_role, chosen_name, chosen_username, chosen_artist,
     chosen_producer, chosen_kind, chosen_singer, chosen_musician, 'free', false, false);

  -- Compatibilidade exclusiva com convites antigos enviados por e-mail.
  -- Não atribui automaticamente convites anônimos por mera URL/metadado.
  if chosen_artist and chosen_invite is not null then
    update public.invitations
    set musician_id = new.id
    where invite_code = chosen_invite
      and musician_id is null
      and status = 'pending'
      and lower(invited_email) = lower(new.email);
  end if;
  return new;
end;
$$;

create or replace function public.protect_profile_access_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if auth.uid() is not null and auth.uid() = old.id and current_user <> 'postgres' then
    if new.role is distinct from old.role
      or new.subscription_status is distinct from old.subscription_status
      or new.is_artist is distinct from old.is_artist
      or new.is_producer is distinct from old.is_producer
      or (current_user <> 'postgres' and (
           new.is_musician is distinct from old.is_musician
           or new.is_singer is distinct from old.is_singer))
      or new.plan_code is distinct from old.plan_code
      or new.custom_subdomain_enabled is distinct from old.custom_subdomain_enabled
      or new.marketplace_enabled is distinct from old.marketplace_enabled then
      raise exception 'As funções e os recursos do plano não podem ser alterados diretamente.';
    end if;
  end if;
  return new;
end;
$$;

-- One authenticated account may add a free role, without modifying plans.
create or replace function public.stage_account_enable_role(p_role text)
returns text language plpgsql security definer set search_path=''
as $$
begin
 if auth.uid() is null then return 'login_required'; end if;
 if p_role not in ('singer','musician') or p_role is null then return 'invalid'; end if;
 update public.profiles set
   is_singer = case when p_role='singer' then true else is_singer end,
   is_musician = case when p_role='musician' then true else is_musician end,
   is_artist = true,
   artist_kind = case when p_role='singer' then 'lead'
     when artist_kind is null then 'support' else artist_kind end,
   updated_at=now()
 where id=auth.uid();
 if not found then return 'not_found';end if;
 return 'enabled';
end;
$$;
revoke all on function public.stage_account_enable_role(text) from public,anon,authenticated;
grant execute on function public.stage_account_enable_role(text) to authenticated;

-- A display name and a public @ have separate 60-day clocks.
-- Protect the timestamps even from direct profile UPDATE requests.
create or replace function public.stage_guard_profile_identity_changes()
returns trigger language plpgsql set search_path=''
as $$
begin
 if tg_op <> 'UPDATE' then return new;end if;
 if new.display_name is distinct from old.display_name then
   if old.display_name_changed_at is not null
     and now() < old.display_name_changed_at + interval '60 days'
   then raise exception 'Aguarde 60 dias para alterar o nome novamente.';end if;
   if char_length(btrim(coalesce(new.display_name,''))) not between 2 and 80
   then raise exception 'O nome precisa ter entre 2 e 80 caracteres.';end if;
   new.display_name:=btrim(new.display_name);
   new.display_name_changed_at:=now();
 else
   new.display_name_changed_at:=old.display_name_changed_at;
 end if;
 if new.username is distinct from old.username then
   if old.username_changed_at is not null
     and now() < old.username_changed_at + interval '60 days'
   then raise exception 'Aguarde 60 dias para alterar o @ novamente.';end if;
   if new.username is not null and new.username !~ '^[a-z0-9-]{3,30}$'
   then raise exception 'O @ deve ter entre 3 e 30 caracteres válidos.';end if;
   new.username_changed_at:=now();
 else
   new.username_changed_at:=old.username_changed_at;
 end if;
 return new;
end;
$$;
drop trigger if exists stage_guard_profile_identity_changes_trigger on public.profiles;
create trigger stage_guard_profile_identity_changes_trigger
 before update on public.profiles for each row
 execute function public.stage_guard_profile_identity_changes();

create or replace function public.stage_my_account_identity()
returns jsonb language sql stable security definer set search_path=''
as $$
 select jsonb_build_object(
   'display_name',p.display_name,'username',p.username,
   'is_singer',p.is_singer,'is_musician',p.is_musician,
   'is_producer',p.is_producer,'artist_kind',p.artist_kind,
   'is_public',p.is_public,
   'name_changed_at',p.display_name_changed_at,
   'username_changed_at',p.username_changed_at,
   'musician_slug',m.slug,'musician_published',coalesce(m.is_published,false))
 from public.profiles p
 left join public.musician_portfolios m on m.profile_id=p.id
 where p.id=auth.uid();
$$;
revoke all on function public.stage_my_account_identity() from public,anon,authenticated;
grant execute on function public.stage_my_account_identity() to authenticated;

create or replace function public.stage_update_account_identity(
 p_display_name text,p_username text
) returns text language plpgsql security definer set search_path=''
as $$
declare v_name text:=btrim(coalesce(p_display_name,''));
 v_username text:=nullif(lower(btrim(coalesce(p_username,''))),'');
 v_old public.profiles%rowtype;
begin
 if auth.uid() is null then return 'login_required';end if;
 if char_length(v_name) not between 2 and 80 or v_name ~ '[[:cntrl:]]'
 then return 'invalid_name';end if;
 select * into v_old from public.profiles where id=auth.uid() for update;
 if not found then return 'not_found';end if;
 if v_username is distinct from v_old.username then
   if not v_old.is_singer then return 'singer_required';end if;
   if v_username is null or v_username !~ '^[a-z0-9-]{3,30}$'
   then return 'invalid_username';end if;
   if v_username=any(array['admin','api','auth','artista','artistas',
      'cadastro','configuracoes','convite','convites','dashboard',
      'entrar','equipes','eventos','login','logout','marketplace',
      'meu-perfil','meu-perfil-artistico','meu-portfolio','meus-convites',
      'musico','musicos','painel','planos','assinatura','conversas',
      'financeiro','homologacao','locais','meu-desempenho','meus-shows',
      'minha-disponibilidade','notificacoes','parceiros','pro',
      'shows-recorrentes','privacidade','publico','sobre','suporte',
      'termos','www','minha-conta'])
   then return 'reserved_username';end if;
 end if;
 if v_name is not distinct from v_old.display_name and
   v_username is not distinct from v_old.username then return 'unchanged';end if;
 if v_name is distinct from v_old.display_name and
  v_old.display_name_changed_at is not null and
  now()<v_old.display_name_changed_at+interval '60 days'
 then return 'name_cooldown';end if;
 if v_username is distinct from v_old.username and
  v_old.username_changed_at is not null and
  now()<v_old.username_changed_at+interval '60 days'
 then return 'username_cooldown';end if;
 update public.profiles set display_name=v_name,
   username=case when is_singer then v_username else username end,
   updated_at=now()
 where id=auth.uid();
 return 'saved';
exception when unique_violation then return 'username_taken';
end;
$$;
revoke all on function public.stage_update_account_identity(text,text) from public,anon,authenticated;
grant execute on function public.stage_update_account_identity(text,text) to authenticated;

-- Editors still use v3. Do not allow singer-only accounts to save musician data.
create or replace function public.stage_my_musician_portfolio()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'name', p.display_name,
    'slug', coalesce(m.slug, p.username, ''),
    'bio', coalesce(m.bio, ''),
    'city', coalesce(m.city, p.city, ''),
    'instruments', coalesce(m.instruments, '{}'::text[]),
    'genres', coalesce(m.genres, '{}'::text[]),
    'media_url', m.media_url,
    'price_mode', coalesce(m.price_mode, 'consult'),
    'reference_fee', m.reference_fee,
    'is_published', coalesce(m.is_published, false),
    'headline', coalesce(m.headline, ''),
    'theme', coalesce(m.theme, 'midnight'),
    'accent', coalesce(m.accent, 'lime'),
    'layout_style', coalesce(m.layout_style, 'spotlight'),
    'avatar_url', m.avatar_url,
    'cover_url', m.cover_url,
    'experience_years', m.experience_years,
    'performance_types', coalesce(m.performance_types, '{}'::text[]),
    'career_highlights', coalesce(m.career_highlights, '{}'::text[]),
    'availability_note', coalesce(m.availability_note, ''),
    'additional_media_urls', coalesce(m.additional_media_urls, '{}'::text[]),
    'instagram_url', m.instagram_url,
    'youtube_url', m.youtube_url,
    'spotify_url', m.spotify_url
  )
  from public.profiles p
  left join public.musician_portfolios m on m.profile_id = p.id
  where p.id = auth.uid() and p.is_musician = true
  limit 1;
$$;

create or replace function public.stage_save_musician_portfolio_v3(
  p_slug text, p_bio text, p_city text,
  p_instruments text[], p_genres text[], p_media_url text,
  p_price_mode text, p_reference_fee numeric, p_is_published boolean,
  p_headline text, p_theme text, p_accent text, p_layout_style text,
  p_avatar_url text, p_cover_url text,
  p_experience_years integer, p_performance_types text[],
  p_career_highlights text[], p_availability_note text,
  p_additional_media_urls text[],
  p_instagram_url text, p_youtube_url text, p_spotify_url text
)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_base_result text;
  v_performance text[];
  v_highlights text[];
  v_extra_media text[];
  v_instagram text := nullif(btrim(coalesce(p_instagram_url,'')), '');
  v_youtube text := nullif(btrim(coalesce(p_youtube_url,'')), '');
  v_spotify text := nullif(btrim(coalesce(p_spotify_url,'')), '');
  v_availability text := btrim(coalesce(p_availability_note,''));
begin
  if auth.uid() is null then return 'login_required'; end if;
  if not exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_musician = true
  ) then return 'artist_required'; end if;

  if p_experience_years is not null
    and p_experience_years not between 0 and 60
  then return 'invalid_experience'; end if;
  if char_length(v_availability) > 140
  then return 'invalid_availability'; end if;

  if coalesce(cardinality(p_performance_types),0) > 5
    or coalesce(cardinality(p_career_highlights),0) > 4
    or coalesce(cardinality(p_additional_media_urls),0) > 2
  then return 'too_many_details'; end if;

  if exists (
    select 1 from unnest(coalesce(p_performance_types,'{}'::text[])) item
    where item is null or char_length(btrim(item)) not between 2 and 45
  ) then return 'invalid_performance'; end if;

  if exists (
    select 1 from unnest(coalesce(p_career_highlights,'{}'::text[])) item
    where item is null or char_length(btrim(item)) not between 4 and 120
  ) then return 'invalid_highlights'; end if;

  if exists (
    select 1 from unnest(coalesce(p_additional_media_urls,'{}'::text[])) item
    where item is null or char_length(btrim(item)) > 500
      or btrim(item) !~* '^https://[^[:space:]]+$'
  ) then return 'invalid_media'; end if;

  if v_instagram is not null and (
    char_length(v_instagram) > 500 or
    v_instagram !~* '^https://(www[.])?instagram[.]com/[^[:space:]]+$'
  ) then return 'invalid_social'; end if;
  if v_youtube is not null and (
    char_length(v_youtube) > 500 or
    (v_youtube !~* '^https://(www[.]|m[.])?youtube[.]com/[^[:space:]]+$'
     and v_youtube !~* '^https://youtu[.]be/[^[:space:]]+$')
  ) then return 'invalid_social'; end if;
  if v_spotify is not null and (
    char_length(v_spotify) > 500 or
    v_spotify !~* '^https://open[.]spotify[.]com/[^[:space:]]+$'
  ) then return 'invalid_social'; end if;

  v_performance := array(
    select distinct btrim(item) from
      unnest(coalesce(p_performance_types,'{}'::text[])) item
  );
  v_highlights := array(
    select btrim(item) from
      unnest(coalesce(p_career_highlights,'{}'::text[])) item
  );
  v_extra_media := array(
    select btrim(item) from
      unnest(coalesce(p_additional_media_urls,'{}'::text[])) item
  );

  v_base_result := public.stage_save_musician_portfolio_v2(
    p_slug,p_bio,p_city,p_instruments,p_genres,p_media_url,
    p_price_mode,p_reference_fee,p_is_published,p_headline,
    p_theme,p_accent,p_layout_style,p_avatar_url,p_cover_url
  );
  if v_base_result <> 'saved' then
    return v_base_result;
  end if;

  update public.musician_portfolios
  set experience_years = p_experience_years::smallint,
      performance_types = v_performance,
      career_highlights = v_highlights,
      availability_note = v_availability,
      additional_media_urls = v_extra_media,
      instagram_url = v_instagram,
      youtube_url = v_youtube,
      spotify_url = v_spotify
  where profile_id = auth.uid();

  return 'saved';
end;
$$;

-- Guard the musician table, including any older RPC that writes directly.
create or replace function public.stage_guard_musician_portfolio_role()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
 if not exists (select 1 from public.profiles p
   where p.id=new.profile_id and p.is_musician=true)
 then raise exception 'Ative a função de músico para usar o portfólio.';end if;
 return new;
end;
$$;
drop trigger if exists stage_guard_musician_portfolio_role_trigger on public.musician_portfolios;
create trigger stage_guard_musician_portfolio_role_trigger
 before insert or update on public.musician_portfolios
 for each row execute function public.stage_guard_musician_portfolio_role();

-- The default marketplace toggles are musician-only.
create or replace function public.stage_marketplace_musician_guard()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
 if not exists(select 1 from public.profiles p
   where p.id=new.musician_id and p.is_musician=true)
 then raise exception 'A função de músico é necessária.';end if;
 return new;
end;
$$;
drop trigger if exists stage_marketplace_musician_guard_trigger on public.stage_marketplace_musician_settings;
create trigger stage_marketplace_musician_guard_trigger
 before insert or update on public.stage_marketplace_musician_settings
 for each row execute function public.stage_marketplace_musician_guard();
commit;
notify pgrst,'reload schema';
