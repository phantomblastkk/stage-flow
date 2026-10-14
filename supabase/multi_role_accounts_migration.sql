-- Stage Flow: preparar uma conta única com múltiplas funções e níveis de plano.
-- Execute no SQL Editor do Supabase antes de ativar a nova interface.
-- Mantém a coluna "role" antiga temporariamente para compatibilidade com telas atuais.

alter table public.profiles
  add column if not exists is_artist boolean not null default false,
  add column if not exists is_producer boolean not null default false,
  add column if not exists plan_code text not null default 'free',
  add column if not exists custom_subdomain_enabled boolean not null default false,
  add column if not exists marketplace_enabled boolean not null default false;

-- Converte as contas existentes sem remover seus dados:
-- musician vira artista; producer vira produtor.
update public.profiles
set is_artist = (role = 'musician'),
    is_producer = (role = 'producer')
where is_artist = false and is_producer = false;

-- Nenhuma conta recebe recursos pagos automaticamente.
update public.profiles
set plan_code = 'free',
    custom_subdomain_enabled = false,
    marketplace_enabled = false
where plan_code is null or plan_code = '';

alter table public.profiles
  drop constraint if exists profiles_plan_code_check;

alter table public.profiles
  add constraint profiles_plan_code_check
  check (plan_code in ('free', 'artist_plus', 'producer_plus', 'studio'));

-- Evita que a própria pessoa libere recursos premium ou altere o tipo de conta
-- diretamente pela API pública do Supabase. Concessões de plano devem ocorrer
-- por fluxo confiável no servidor, após confirmação de pagamento.
create or replace function public.protect_profile_access_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if auth.uid() is not null and auth.uid() = old.id then
    if new.role is distinct from old.role then
      raise exception 'O tipo de conta não pode ser alterado diretamente.';
    end if;
    if new.subscription_status is distinct from old.subscription_status then
      raise exception 'O status da assinatura não pode ser alterado diretamente.';
    end if;
    if new.is_artist is distinct from old.is_artist
       or new.is_producer is distinct from old.is_producer then
      raise exception 'As funções da conta não podem ser alteradas diretamente.';
    end if;
    if new.plan_code is distinct from old.plan_code
       or new.custom_subdomain_enabled is distinct from old.custom_subdomain_enabled
       or new.marketplace_enabled is distinct from old.marketplace_enabled then
      raise exception 'Os recursos do plano não podem ser alterados diretamente.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profile_access_fields_trigger on public.profiles;
create trigger protect_profile_access_fields_trigger
  before update on public.profiles
  for each row execute procedure public.protect_profile_access_fields();

-- O cadastro e os convites serão atualizados na próxima etapa para preencher
-- as funções adequadas e aplicar as permissões em todas as telas e políticas.
