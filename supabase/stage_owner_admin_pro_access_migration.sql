-- StageFlow | Concessao e revogacao de cortesia Pro pela Central do proprietario
-- Aplicar APOS stage_owner_admin_hub_migration.sql e pro_artist_publication_migration.sql.
-- Concessoes manuais sao separadas de assinaturas e cobranças:
-- nao alterar plan_code, subscription_status, pagamentos, snapshots nem DNS.
begin;

-- Reutiliza o historico privado da Central: cada alteracao efetiva fica auditada.
alter table public.stage_owner_admin_audit
  drop constraint if exists stage_owner_admin_audit_action_check;
alter table public.stage_owner_admin_audit
  add constraint stage_owner_admin_audit_action_check check(action in (
    'verification_granted','verification_revoked',
    'venue_approved','venue_rejected',
    'pro_access_granted','pro_access_revoked'
  ));

-- Uma consulta privada por pagina para exibir concessoes e distinguir
-- cortesia manual de assinatura ativa, sem expor dados em RPC anonima.
create or replace function public.stage_owner_admin_pro_snapshot(p_ids uuid[])
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare v_items jsonb;
begin
 if not public.stage_owner_admin_status() then
   return jsonb_build_object('status','forbidden','items','[]'::jsonb);
 end if;
 if p_ids is null or cardinality(p_ids)>30 or array_position(p_ids,null) is not null then
   return jsonb_build_object('status','invalid','items','[]'::jsonb);
 end if;
 select coalesce(jsonb_agg(jsonb_build_object(
   'id',p.id,
   'manual_granted',exists(select 1 from public.stage_pro_site_access a where a.owner_id=p.id),
   'paid_entitled',(p.is_artist and p.plan_code in ('artist_plus','studio')
      and p.subscription_status in ('active','trialing')),
   'effective_entitled',(p.is_singer and public.stage_pro_site_is_entitled(p.id))
 ) order by p.id),'[]'::jsonb)
 into v_items
 from (select distinct id from unnest(p_ids) as requested(id)) q
 join public.profiles p on p.id=q.id;
 return jsonb_build_object('status','ok','items',v_items);
end;
$$;
revoke all on function public.stage_owner_admin_pro_snapshot(uuid[]) from public,anon,authenticated;
grant execute on function public.stage_owner_admin_pro_snapshot(uuid[]) to authenticated;

-- Apenas o unico proprietario cadastrado pode conceder ou retirar a
-- cortesia do perfil de cantor; a assinatura paga jamais e cancelada aqui.
create or replace function public.stage_owner_admin_set_pro_access(
  p_target_id uuid,p_enabled boolean
) returns text language plpgsql security definer set search_path=''
as $$
declare
 v_paid boolean;
 v_exists boolean;
begin
 if not public.stage_owner_admin_status() then return 'forbidden';end if;
 if p_target_id is null or p_enabled is null then return 'invalid';end if;

 -- Serializa alteracoes concorrentes ao mesmo perfil.
 select (p.plan_code in ('artist_plus','studio')
     and p.subscription_status in ('active','trialing'))
 into v_paid
 from public.profiles p
 where p.id=p_target_id and p.is_artist=true and p.is_singer=true
 for update;
 if not found then return 'singer_required';end if;

 select exists(select 1 from public.stage_pro_site_access a where a.owner_id=p_target_id)
 into v_exists;
 if p_enabled then
   if v_exists then return 'unchanged';end if;
   if v_paid then return 'subscription_active';end if;
   insert into public.stage_pro_site_access(owner_id) values(p_target_id)
   on conflict(owner_id) do nothing;
   if not found then return 'unchanged';end if;
 else
   if not v_exists then
     if v_paid then return 'subscription_active';end if;
     return 'unchanged';
   end if;
   delete from public.stage_pro_site_access where owner_id=p_target_id;
   if not found then return 'unchanged';end if;
 end if;

 insert into public.stage_owner_admin_audit(actor_id,action,kind,target_id)
 values(
   auth.uid(),
   case when p_enabled then 'pro_access_granted' else 'pro_access_revoked' end,
   'singer',p_target_id
 );
 return 'saved';
end;
$$;
revoke all on function public.stage_owner_admin_set_pro_access(uuid,boolean) from public,anon,authenticated;
grant execute on function public.stage_owner_admin_set_pro_access(uuid,boolean) to authenticated;

commit;
notify pgrst, 'reload schema';
