-- Stage Flow | Receita e despesas extras PRIVADAS de cada show
-- Execute APÓS event_financial_summary_migration.sql e schema inicial.
-- NÃO reexecute schema.sql. Nenhuma cobrança ou pagamento é realizado.
-- Este modelo não registra pagamento de cachês a músicos; mantém somente
-- acordos financeiros dos convites existentes como custos previstos.
-- Pode ser executado novamente sem apagar os dados já registrados.

create extension if not exists pgcrypto;

create table if not exists public.stage_event_budget (
  event_id uuid primary key references public.events(id) on delete cascade,
  client_fee numeric(12,2),
  received_amount numeric(12,2) not null default 0,
  updated_at timestamptz not null default now(),
  constraint stage_event_budget_fee_check
    check (client_fee is null or client_fee between 0 and 9999999.99),
  constraint stage_event_budget_received_check
    check (received_amount >= 0 and received_amount <= 9999999.99
       and ((client_fee is not null and received_amount <= client_fee)
         or (client_fee is null and received_amount = 0)))
);

create table if not exists public.stage_event_expenses (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  description text not null
    check (char_length(btrim(description)) between 2 and 120),
  category text not null default 'other'
    check (category in ('transport','equipment','staff','food','other')),
  amount numeric(12,2) not null check (amount > 0 and amount <= 999999.99),
  paid_amount numeric(12,2) not null default 0
    check (paid_amount >= 0 and paid_amount <= amount),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists stage_event_expenses_event_idx
on public.stage_event_expenses(event_id,created_at desc,id desc);

alter table public.stage_event_budget enable row level security;
alter table public.stage_event_expenses enable row level security;

-- Sem acesso direto via PostgREST. Todas as operações são via RPC
-- autenticada que verifica o proprietário do evento.
revoke all on public.stage_event_budget from public, anon, authenticated;
revoke all on public.stage_event_expenses from public, anon, authenticated;

create or replace function public.stage_my_event_budget(p_event_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_fee numeric(12,2);
  v_received numeric(12,2) := 0;
  v_expense_total numeric(12,2) := 0;
  v_expense_paid numeric(12,2) := 0;
  v_expenses jsonb := '[]'::jsonb;
  v_musician jsonb;
  v_musician_total numeric(12,2) := 0;
  v_unpriced integer := 0;
begin
  if auth.uid() is null or p_event_id is null or not exists (
    select 1 from public.events
    where id = p_event_id and producer_id = auth.uid()
  ) then return null; end if;

  select b.client_fee, b.received_amount
  into v_fee, v_received
  from public.stage_event_budget b
  where b.event_id = p_event_id;

  select coalesce(sum(x.amount),0),
         coalesce(sum(x.paid_amount),0),
         coalesce(jsonb_agg(
           jsonb_build_object(
             'id',x.id,
             'description',x.description,
             'category',x.category,
             'amount',x.amount,
             'paid_amount',x.paid_amount
           ) order by x.created_at desc,x.id desc
         ),'[]'::jsonb)
  into v_expense_total, v_expense_paid, v_expenses
  from public.stage_event_expenses x
  where x.event_id = p_event_id;

  -- Reusa EXATAMENTE as mesmas regras financeiras do resumo existente:
  -- cachês acordados de convites ativos, sem valores recusados/cancelados.
  v_musician := public.stage_event_financial_summary(p_event_id);
  v_musician_total := coalesce((v_musician->>'agreed_total')::numeric,0);
  v_unpriced := coalesce((v_musician->>'pending_fee_count')::integer,0);

  return jsonb_build_object(
    'event_id', p_event_id,
    'client_fee', v_fee,
    'received_amount', coalesce(v_received,0),
    'to_receive', case when v_fee is null then null
      else v_fee - coalesce(v_received,0) end,
    'expenses_total', v_expense_total,
    'expenses_paid_total', v_expense_paid,
    'expenses_unpaid_total', v_expense_total - v_expense_paid,
    'expenses', v_expenses,
    'musician_agreed_total', v_musician_total,
    'musician_unpriced_count', v_unpriced,
    'projected_partial_result', case when v_fee is null then null
      else v_fee - v_musician_total - v_expense_total end
  );
end;
$$;
revoke all on function public.stage_my_event_budget(uuid)
  from public, anon, authenticated;
grant execute on function public.stage_my_event_budget(uuid) to authenticated;

create or replace function public.stage_save_event_budget(
  p_event_id uuid, p_client_fee numeric, p_received_amount numeric
)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_received numeric := p_received_amount;
begin
  if auth.uid() is null then return 'login_required'; end if;
  if p_event_id is null or not exists (
    select 1 from public.events
    where id = p_event_id and producer_id = auth.uid()
  ) then return 'event_not_found'; end if;

  if p_client_fee is not null and (
    p_client_fee < 0 or p_client_fee > 9999999.99
    or round(p_client_fee,2) <> p_client_fee
  ) then return 'invalid_client_fee'; end if;
  if v_received is null or v_received < 0 or v_received > 9999999.99
    or round(v_received,2) <> v_received
    or (p_client_fee is null and v_received <> 0)
    or (p_client_fee is not null and v_received > p_client_fee)
  then return 'invalid_received'; end if;

  insert into public.stage_event_budget (
    event_id,client_fee,received_amount,updated_at
  )
  values (p_event_id,p_client_fee,v_received,now())
  on conflict (event_id) do update set
    client_fee=excluded.client_fee,
    received_amount=excluded.received_amount,
    updated_at=now();
  return 'saved';
end;
$$;
revoke all on function public.stage_save_event_budget(uuid,numeric,numeric)
  from public, anon, authenticated;
grant execute on function public.stage_save_event_budget(uuid,numeric,numeric)
  to authenticated;

create or replace function public.stage_save_event_expense(
  p_event_id uuid,
  p_expense_id uuid,
  p_description text,
  p_category text,
  p_amount numeric,
  p_paid_amount numeric
)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_description text := btrim(coalesce(p_description,''));
  v_count integer;
  v_id uuid;
begin
  if auth.uid() is null then
    return jsonb_build_object('status','login_required');
  end if;

  -- A mesma linha de evento é bloqueada em toda inserção para
  -- impedir exceder o limite sob requisições simultâneas.
  perform 1 from public.events
  where id = p_event_id and producer_id = auth.uid()
  for update;
  if not found then
    return jsonb_build_object('status','event_not_found');
  end if;

  if char_length(v_description) not between 2 and 120
    or p_category is null
    or p_category not in ('transport','equipment','staff','food','other')
    or p_amount is null or p_amount <= 0 or p_amount > 999999.99
    or round(p_amount,2) <> p_amount
    or p_paid_amount is null or p_paid_amount < 0
    or p_paid_amount > p_amount
    or round(p_paid_amount,2) <> p_paid_amount
  then return jsonb_build_object('status','invalid'); end if;

  if p_expense_id is not null then
    update public.stage_event_expenses
    set description=v_description,category=p_category,amount=p_amount,
        paid_amount=p_paid_amount,updated_at=now()
    where id=p_expense_id and event_id=p_event_id
    returning id into v_id;
    if v_id is null then
      return jsonb_build_object('status','expense_not_found');
    end if;
    return jsonb_build_object('status','updated','id',v_id);
  end if;

  select count(*) into v_count from public.stage_event_expenses
  where event_id=p_event_id;
  if v_count >= 60 then
    return jsonb_build_object('status','limit_reached');
  end if;

  insert into public.stage_event_expenses
    (event_id,description,category,amount,paid_amount)
  values
    (p_event_id,v_description,p_category,p_amount,p_paid_amount)
  returning id into v_id;

  return jsonb_build_object('status','created','id',v_id);
end;
$$;
revoke all on function public.stage_save_event_expense(
  uuid,uuid,text,text,numeric,numeric
) from public, anon, authenticated;
grant execute on function public.stage_save_event_expense(
  uuid,uuid,text,text,numeric,numeric
) to authenticated;

create or replace function public.stage_delete_event_expense(
  p_event_id uuid,p_expense_id uuid
)
returns text
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null then return 'login_required'; end if;
  if not exists (
    select 1 from public.events
    where id=p_event_id and producer_id=auth.uid()
  ) then return 'event_not_found'; end if;

  delete from public.stage_event_expenses
  where event_id=p_event_id and id=p_expense_id;
  if not found then return 'expense_not_found'; end if;
  return 'deleted';
end;
$$;
revoke all on function public.stage_delete_event_expense(uuid,uuid)
  from public, anon, authenticated;
grant execute on function public.stage_delete_event_expense(uuid,uuid)
  to authenticated;

-- Sem disparo de cobranças ou movimentações bancárias.
-- 'Valor recebido' e 'Despesa paga' são controles manuais informados pelo
-- organizador, NÃO comprovantes de transferência.
-- Pagamentos aos músicos continuam não rastreados nesta versão.
