-- Stage Flow | Resumo financeiro PRIVADO dos músicos por show
-- Pré-requisitos: schema.sql, invitations_migration.sql e
-- private_fee_negotiations_migration.sql já executados no Supabase.
-- Execute somente este SQL; não reexecute o schema inicial.
-- Nenhum gasto é criado, nenhum pagamento efetuado, nenhuma
-- informação financeira é publicada no perfil do cantor.

create or replace function public.stage_event_financial_summary(p_event_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_summary jsonb;
begin
  if auth.uid() is null or p_event_id is null then
    return null;
  end if;

  -- Gate de autorização obrigatório ANTES de ler propostas de cachê.
  -- Nenhum outro artista ou músico recebe dados da banda por esta função.
  if not exists (
    select 1
    from public.events e
    where e.id = p_event_id and e.producer_id = auth.uid()
  ) then
    return null;
  end if;

  select jsonb_build_object(
    'event_id', p_event_id,
    'invitation_count', count(*),
    'active_count', count(*) filter (
      where i.status in ('pending','accepted')
    ),
    'accepted_count', count(*) filter (where i.status = 'accepted'),
    'confirmed_fee_count', count(*) filter (
      where i.status = 'accepted' and f.agreed_amount is not null
    ),
    'agreed_waiting_count', count(*) filter (
      where i.status = 'pending' and f.agreed_amount is not null
    ),
    'pending_fee_count', count(*) filter (
      where i.status in ('pending','accepted') and f.agreed_amount is null
    ),
    'open_offer_count', count(*) filter (
      where i.status in ('pending','accepted')
        and f.agreed_amount is null and f.last_amount is not null
    ),
    'unquoted_count', count(*) filter (
      where i.status in ('pending','accepted')
        and f.agreed_amount is null and f.last_amount is null
    ),
    'inactive_count', count(*) filter (
      where i.status in ('declined','cancelled')
    ),
    'confirmed_total', coalesce(sum(f.agreed_amount) filter (
      where i.status = 'accepted'
    ), 0),
    'agreed_waiting_total', coalesce(sum(f.agreed_amount) filter (
      where i.status = 'pending'
    ), 0),
    'agreed_total', coalesce(sum(f.agreed_amount) filter (
      where i.status in ('accepted','pending')
    ), 0),
    'open_offer_total', coalesce(sum(f.last_amount) filter (
      where i.status in ('accepted','pending')
        and f.agreed_amount is null
    ), 0),
    'items', coalesce(jsonb_agg(
      jsonb_build_object(
        'invitation_id', i.id,
        'musician_name', coalesce(
          nullif(btrim(p.display_name),''),
          'Convite ainda não resgatado'
        ),
        'has_musician', i.musician_id is not null,
        'invitation_status', i.status::text,
        'agreed_amount', f.agreed_amount,
        'last_offer_amount', case
          when f.agreed_amount is null then f.last_amount else null end
      ) order by i.created_at desc, i.id desc
    ) filter (where i.id is not null), '[]'::jsonb)
  ) into v_summary
  from public.invitations i
  left join public.profiles p on p.id = i.musician_id
  left join public.stage_fee_negotiations f on f.invitation_id = i.id
  where i.event_id = p_event_id;

  return v_summary;
end;
$$;

revoke all on function public.stage_event_financial_summary(uuid)
  from public, anon, authenticated;
grant execute on function public.stage_event_financial_summary(uuid)
  to authenticated;

-- Importante:
-- 1. Só o organizador do evento pode consultar este resumo.
-- 2. Propostas sem acordo são exibidas à parte, NÃO somadas ao custo fechado.
-- 3. Cachês acordados mas sem aceite do convite são separados dos confirmados.
-- 4. Convites recusados/cancelados não entram nos totais financeiros ativos.
-- 5. Convites aceitos sem cachê acordado permanecem "sem valor fechado".
-- 6. Este recurso não registra faturamento, recebimentos ou pagamentos.
