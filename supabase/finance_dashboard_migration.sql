-- Stage Flow: Central financeira privada por show e por papel.
-- Reutiliza stage_event_budget / stage_event_expenses / stage_fee_negotiations.
-- Aplicar após event_revenue_expenses_migration.sql e show_history_reports_migration.sql.
begin;

create table if not exists public.stage_finance_musician_payments(
 invitation_id uuid primary key references public.invitations(id) on delete cascade,
 paid_amount numeric(12,2) not null default 0 check(paid_amount between 0 and 9999999.99),
 updated_at timestamptz not null default now()
);
alter table public.stage_finance_musician_payments enable row level security;
revoke all on public.stage_finance_musician_payments from public,anon,authenticated;

-- Somente o organizador vê pagamentos de toda a equipe.
create or replace function public.stage_finance_event_team(p_event_id uuid)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare v_items jsonb;
begin
 if auth.uid() is null or not exists(select 1 from public.events
  where id=p_event_id and producer_id=auth.uid()) then
  return jsonb_build_object('status','forbidden');end if;
 select coalesce(jsonb_agg(jsonb_build_object(
    'invitation_id',i.id,
    'musician_name',coalesce(nullif(p.display_name,''),'Músico convidado'),
    'invitation_status',i.status::text,
    'fee',coalesce(f.agreed_amount,i.fee_amount),
    'fee_confirmed',f.agreed_amount is not null or i.fee_amount is not null,
    'paid_amount',coalesce(pay.paid_amount,0)
 ) order by i.created_at desc,i.id),'[]'::jsonb) into v_items
 from public.invitations i
 left join public.profiles p on p.id=i.musician_id
 left join public.stage_fee_negotiations f on f.invitation_id=i.id
 left join public.stage_finance_musician_payments pay on pay.invitation_id=i.id
 where i.event_id=p_event_id and i.status='accepted';
 return jsonb_build_object('status','ok','items',v_items);
end;
$$;
revoke all on function public.stage_finance_event_team(uuid) from public,anon,authenticated;
grant execute on function public.stage_finance_event_team(uuid) to authenticated;

create or replace function public.stage_finance_save_musician_payment(
 p_invitation_id uuid,p_paid numeric
)
returns text language plpgsql security definer set search_path=''
as $$
declare v_event uuid;v_fee numeric;
begin
 if auth.uid() is null then return 'login_required';end if;
 if p_invitation_id is null or p_paid is null or p_paid<0
  or p_paid>9999999.99 or round(p_paid,2)<>p_paid then return 'invalid';end if;
 select e.id,coalesce(f.agreed_amount,i.fee_amount)
 into v_event,v_fee from public.invitations i
 join public.events e on e.id=i.event_id
 left join public.stage_fee_negotiations f on f.invitation_id=i.id
 where i.id=p_invitation_id and e.producer_id=auth.uid()
   and i.status='accepted'
 for update of i;
 if not found then return 'forbidden';end if;
 if (v_fee is null and p_paid>0) or
   (v_fee is not null and p_paid>v_fee) then return 'amount_exceeds_agreed';end if;
 insert into public.stage_finance_musician_payments(invitation_id,paid_amount,updated_at)
 values(p_invitation_id,p_paid,now())
 on conflict(invitation_id) do update set
  paid_amount=excluded.paid_amount,updated_at=now();
 return 'saved';
end;
$$;
revoke all on function public.stage_finance_save_musician_payment(uuid,numeric)
 from public,anon,authenticated;
grant execute on function public.stage_finance_save_musician_payment(uuid,numeric)
 to authenticated;

-- Consolida somente shows PRÓPRIOS, valores gerados do orçamento existente.
create or replace function public.stage_finance_organizer_overview()
returns jsonb language sql stable security definer set search_path=''
as $$
 select case when auth.uid() is null then '[]'::jsonb else
  coalesce(jsonb_agg(jsonb_build_object(
   'event_id',e.id,'title',e.title,'starts_at',e.starts_at,
   'venue',e.venue,'city',e.city,'event_status',e.status::text,
   'has_budget',b.event_id is not null,'gross_revenue',b.client_fee,
   'received',coalesce(b.received_amount,0),
   'expense_total',coalesce(x.planned,0),'expense_paid',coalesce(x.paid,0),
   'transport_total',coalesce(x.transport,0),
   'equipment_total',coalesce(x.equipment,0),
   'staff_total',coalesce(x.staff,0),
   'food_total',coalesce(x.food,0),
   'other_total',coalesce(x.other_expenses,0),
   'musician_agreed',coalesce(m.agreed,0),
   'musician_paid',coalesce(m.paid,0),
   'musician_unpriced',coalesce(m.unpriced,0),
   'musician_unpaid_count',coalesce(m.unpaid,0)
  ) order by e.starts_at desc,e.id),'[]'::jsonb) end
 from (select * from public.events where producer_id=auth.uid()
       order by starts_at desc,id limit 400) e
 left join public.stage_event_budget b on b.event_id=e.id
 left join lateral (
  select sum(amount) planned,sum(paid_amount) paid,
   sum(amount) filter(where category='transport') transport,
   sum(amount) filter(where category='equipment') equipment,
   sum(amount) filter(where category='staff') staff,
   sum(amount) filter(where category='food') food,
   sum(amount) filter(where category='other') other_expenses
  from public.stage_event_expenses where event_id=e.id
 ) x on true
 left join lateral (
  select
   sum(coalesce(f.agreed_amount,i.fee_amount)) filter(where i.status='accepted') agreed,
   sum(pay.paid_amount) filter(where i.status='accepted') paid,
   count(*) filter(where i.status='accepted' and f.agreed_amount is null
     and i.fee_amount is null) unpriced,
   count(*) filter(where i.status='accepted' and
     coalesce(pay.paid_amount,0)<coalesce(f.agreed_amount,i.fee_amount,0)) unpaid
  from public.invitations i
  left join public.stage_fee_negotiations f on f.invitation_id=i.id
  left join public.stage_finance_musician_payments pay on pay.invitation_id=i.id
  where i.event_id=e.id
 ) m on true;
$$;
revoke all on function public.stage_finance_organizer_overview() from public,anon,authenticated;
grant execute on function public.stage_finance_organizer_overview() to authenticated;
commit;
notify pgrst,'reload schema';
