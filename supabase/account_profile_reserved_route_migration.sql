-- StageFlow: prevent new artist @ usernames colliding with application routes.
-- Retains all previous reservations and reserves the unified account profile route.
begin;
create or replace function public.stage_protect_reserved_artist_usernames()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.username is not null and lower(new.username) = any(array[
    'admin','api','auth','artista','artistas','cadastro','configuracoes',
    'convite','convites','dashboard','entrar','equipes','eventos',
    'login','logout','marketplace','meu-perfil','meu-perfil-artistico',
    'meu-portfolio','meus-convites','minha-conta','musico','musicos','painel','planos',
    'assinatura','conversas','financeiro','homologacao','locais',
    'meu-desempenho','meus-shows','minha-disponibilidade',
    'notificacoes','parceiros','pro','shows-recorrentes',
    'privacidade','publico','sobre','suporte','termos','www'
  ]) then
    raise exception 'Este nome de usuário está reservado para o Stage Flow.';
  end if;
  return new;
end;
$$;
drop trigger if exists stage_reserved_artist_usernames_trigger on public.profiles;
create trigger stage_reserved_artist_usernames_trigger
before insert or update of username on public.profiles
for each row execute function public.stage_protect_reserved_artist_usernames();

commit;
