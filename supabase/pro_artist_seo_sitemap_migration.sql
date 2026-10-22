-- Stage Flow | SEO: listar SOMENTE sites Pro realmente publicos e ativos
-- Execute apos pro_artist_publication_migration.sql no SQL Editor do Supabase.
-- Nunca inclui perfil privado, site despublicado ou assinante sem direito Pro.
-- E independente do marketplace e nao modifica dados existentes.

create or replace function public.stage_public_pro_site_sitemap()
returns table(username text, updated_at timestamptz)
language sql stable security definer set search_path=''
as $$
  select p.username::text,coalesce(s.updated_at,s.published_at)::timestamptz
  from public.profiles p
  join public.stage_pro_site_publications s on s.owner_id=p.id
  where p.is_artist=true
    and p.is_public=true
    and p.username is not null
    and p.username ~ '^[a-z0-9-]{3,30}$'
    and s.published=true
    and public.stage_pro_site_is_entitled(p.id)
  order by p.username asc
  limit 5000;
$$;

revoke all on function public.stage_public_pro_site_sitemap()
  from public,anon,authenticated;
grant execute on function public.stage_public_pro_site_sitemap()
  to anon,authenticated;

notify pgrst,'reload schema';
