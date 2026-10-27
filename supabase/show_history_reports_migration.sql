-- Stage Flow | Histórico privado e painel financeiro por papel.
-- Homologação: aplicar depois de private_fee_negotiations, event_financial_summary
-- e event_revenue_expenses. Não modifica registros de casas de show.
-- Nenhum pagamento real é executado nem realizado por estas funções.
begin;

create table if not exists public.stage_show_owner_history (
  event_id uuid primary key references public.events(id) on delete cascade,
  self_confirmed boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.stage_show_participation_finance (
  invitation_id uuid primary key references public.invitations(id) on delete cascade,
  self_confirmed boolean not null default false,
  received_amount numeric(12,2) not null default 0
    check (received_amount >= 0 and received_amount <= 9999999.99),
  expense_amount numeric(12,2) not null default 0
    check (expense_amount >= 0 and expense_amount <= 9999999.99),
  updated_at timestamptz not null default now()
);

alter table public.stage_show_owner_history enable row level security;
alter table public.stage_show_participation_finance enable row level security;
revoke all on public.stage_show_owner_history from public,anon,authenticated;
revoke all on public.stage_show_participation_finance from public,anon,authenticated;

-- Não infere realização pela data. Only status 'completed' ou confirmação manual.
-- Aceites são selecionados pelo músico autenticado, sem valores de terceiros.
create or replace function public.stage_my_show_history()
returns jsonb language sql stable security definer set search_path=''
as $$
  select case when auth.uid() is null then '[]'::jsonb else
    coalesce(jsonb_agg(
      jsonb_build_object(
        'kind', z.kind, 'record_id', z.record_id, 'event_id',z.event_id,
        'title',z.title, 'venue',z.venue,'city',z.city,
        'starts_at',z.starts_at,'event_status',z.event_status,
        'organizer_name',z.organizer_name,
        'performed',z.performed,
        'manual_confirmed',z.manual_confirmed,
        'client_fee',z.client_fee,'client_received',z.client_received,
        'expenses_total',z.expenses_total,'expenses_paid',z.expenses_paid,
        'team_agreed_total',z.team_agreed_total,
        'team_unpriced_count',z.team_unpriced_count,
        'personal_fee',z.personal_fee,'personal_fee_agreed',z.personal_fee_agreed,
        'personal_received',z.personal_received,'personal_expenses',z.personal_expenses,
        'has_financial_record',z.has_financial_record
      ) order by z.starts_at desc,z.record_id
    ),'[]'::jsonb) end
  from (
    select 'organized'::text kind,e.id record_id,e.id event_id,e.title,e.venue,e.city,
      e.starts_at,e.status::text event_status,null::text organizer_name,
      (e.status='completed' or coalesce(h.self_confirmed,false)) and e.status<>'cancelled' performed,
      coalesce(h.self_confirmed,false) manual_confirmed,
      b.client_fee,b.received_amount client_received,
      (select coalesce(sum(x.amount),0) from public.stage_event_expenses x
         where x.event_id=e.id) expenses_total,
      (select coalesce(sum(x.paid_amount),0) from public.stage_event_expenses x
         where x.event_id=e.id) expenses_paid,
      (select coalesce(sum(f.agreed_amount),0) from public.invitations i
         join public.stage_fee_negotiations f on f.invitation_id=i.id
         where i.event_id=e.id and i.status in ('pending','accepted')) team_agreed_total,
      (select count(*) from public.invitations i
         left join public.stage_fee_negotiations f on f.invitation_id=i.id
         where i.event_id=e.id and i.status in ('pending','accepted')
           and f.agreed_amount is null) team_unpriced_count,
      null::numeric personal_fee,false personal_fee_agreed,
      null::numeric personal_received,null::numeric personal_expenses,
      b.event_id is not null has_financial_record
    from (select * from public.events where producer_id=auth.uid()
      order by starts_at desc,id limit 300) e
    left join public.stage_show_owner_history h on h.event_id=e.id
    left join public.stage_event_budget b on b.event_id=e.id
    union all
    select 'participation'::text,i.id record_id,e.id event_id,e.title,e.venue,e.city,
      e.starts_at,e.status::text event_status,p.display_name organizer_name,
      (e.status='completed' or coalesce(m.self_confirmed,false)) and e.status<>'cancelled' performed,
      coalesce(m.self_confirmed,false) manual_confirmed,
      null::numeric client_fee,null::numeric client_received,
      null::numeric expenses_total,null::numeric expenses_paid,
      null::numeric team_agreed_total,0::bigint team_unpriced_count,
      coalesce(f.agreed_amount,i.fee_amount) personal_fee,
      f.agreed_amount is not null personal_fee_agreed,
      m.received_amount personal_received,m.expense_amount personal_expenses,
      m.invitation_id is not null has_financial_record
    from (select * from public.invitations
      where musician_id=auth.uid() and status='accepted'
      order by created_at desc,id limit 300) i
    join public.events e on e.id=i.event_id
    join public.profiles p on p.id=e.producer_id
    left join public.stage_fee_negotiations f on f.invitation_id=i.id
    left join public.stage_show_participation_finance m on m.invitation_id=i.id
    where e.producer_id<>auth.uid()
  ) z;
$$;
revoke all on function public.stage_my_show_history() from public,anon,authenticated;
grant execute on function public.stage_my_show_history() to authenticated;

-- Estado privado próprio; nunca altera status público do show.
create or replace function public.stage_show_set_performed(
  p_record_id uuid,p_kind text,p_performed boolean
)
returns text language plpgsql security definer set search_path=''
as $$
declare v_date timestamptz;
begin
  if auth.uid() is null then return 'login_required';end if;
  if p_record_id is null or p_performed is null
    or p_kind not in ('organized','participation') then return 'invalid';end if;

  if p_kind='organized' then
    select starts_at into v_date from public.events
      where id=p_record_id and producer_id=auth.uid() and status<>'cancelled';
    if not found then return 'forbidden';end if;
    if v_date>now() then return 'too_early';end if;
    insert into public.stage_show_owner_history(event_id,self_confirmed,updated_at)
      values(p_record_id,p_performed,now())
    on conflict(event_id) do update set self_confirmed=excluded.self_confirmed,
      updated_at=now();
  else
    select e.starts_at into v_date
    from public.invitations i join public.events e on e.id=i.event_id
      where i.id=p_record_id and i.musician_id=auth.uid()
        and i.status='accepted' and e.status<>'cancelled'
        and e.producer_id<>auth.uid();
    if not found then return 'forbidden';end if;
    if v_date>now() then return 'too_early';end if;
    insert into public.stage_show_participation_finance
      (invitation_id,self_confirmed,updated_at)
      values(p_record_id,p_performed,now())
    on conflict(invitation_id) do update set self_confirmed=excluded.self_confirmed,
      updated_at=now();
  end if;
  return 'saved';
end;
$$;
revoke all on function public.stage_show_set_performed(uuid,text,boolean) from public,anon,authenticated;
grant execute on function public.stage_show_set_performed(uuid,text,boolean) to authenticated;

-- Recebimentos/despesas pessoais: anotações manuais apenas para o próprio músico.
-- O acordo não pode ser alterado por aqui; nunca expõe cachês de outros músicos.
create or replace function public.stage_show_save_participation_finance(
  p_invitation_id uuid,p_received numeric,p_expenses numeric
)
returns text language plpgsql security definer set search_path=''
as $$
begin
  if auth.uid() is null then return 'login_required';end if;
  if p_invitation_id is null or p_received is null or p_expenses is null
    or p_received<0 or p_received>9999999.99
    or p_expenses<0 or p_expenses>9999999.99
    or round(p_received,2)<>p_received
    or round(p_expenses,2)<>p_expenses then return 'invalid';end if;
  if not exists (
    select 1 from public.invitations i
    join public.events e on e.id=i.event_id
    where i.id=p_invitation_id and i.musician_id=auth.uid()
      and i.status='accepted' and e.producer_id<>auth.uid()
  ) then return 'forbidden';end if;
  insert into public.stage_show_participation_finance
    (invitation_id,received_amount,expense_amount,updated_at)
  values(p_invitation_id,p_received,p_expenses,now())
  on conflict(invitation_id) do update
    set received_amount=excluded.received_amount,
        expense_amount=excluded.expense_amount,
        updated_at=now();
  return 'saved';
end;
$$;
revoke all on function public.stage_show_save_participation_finance(uuid,numeric,numeric)
 from public,anon,authenticated;
grant execute on function public.stage_show_save_participation_finance(uuid,numeric,numeric)
 to authenticated;

commit;
notify pgrst,'reload schema';
