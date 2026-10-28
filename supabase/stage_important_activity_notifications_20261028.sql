-- Stage Flow | Central de notificacoes: pedidos publicos, avaliacoes e atividades importantes
-- Somente fatos persistidos, em triggers da mesma transacao; sem emails/push/telefone.
-- Preserve os tipos/codigos ja instalados em qualquer ambiente, inclusive cortesias Pro.
begin;

alter table public.stage_internal_notifications
 drop constraint if exists stage_internal_notifications_source_type_check;
alter table public.stage_internal_notifications
 add constraint stage_internal_notifications_source_type_check
 check (source_type in (
   'invitation','proposal','conversation','operations','account',
   'booking','review','verification','finance'
 ));
alter table public.stage_internal_notifications
 drop constraint if exists stage_internal_notifications_event_code_check;
alter table public.stage_internal_notifications
 add constraint stage_internal_notifications_event_code_check
 check (event_code in (
   'invite_received','invite_accepted','invite_declined','invite_cancelled',
   'proposal_received','proposal_accepted','proposal_declined','proposal_withdrawn',
   'chat_message','show_briefing_changed','pro_courtesy_granted','pro_courtesy_revoked',
   'booking_received','review_received','profile_verified','finance_received'
 ));

-- O formulario publico ja valida a solicitacao, o titular e o rate limit.
-- Nao retornar nem revelar email, telefone ou mensagem na notificacao.
create or replace function public.stage_notify_artist_booking_created()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.stage_internal_notifications
   (recipient_id,source_type,source_id,event_code,title,summary,created_at)
 values
   (new.artist_id,'booking',new.id,'booking_received',
    'Novo pedido de contratacao',
    left('Voce recebeu um pedido de show em '||new.event_city||'. Confira e responda na sua caixa privada.',240),
    new.created_at)
 on conflict(recipient_id,source_type,source_id,event_code) do nothing;
 return new;
end;$$;
revoke all on function public.stage_notify_artist_booking_created() from public,anon,authenticated;
drop trigger if exists stage_notify_artist_booking_created on public.stage_artist_booking_requests;
create trigger stage_notify_artist_booking_created
 after insert on public.stage_artist_booking_requests
 for each row execute function public.stage_notify_artist_booking_created();

-- Avaliacoes sao criadas somente apos o evento qualificado ser confirmado na RPC.
create or replace function public.stage_notify_marketplace_review_created()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.stage_internal_notifications
   (recipient_id,source_type,source_id,event_code,event_id,title,summary)
 values
   (new.musician_id,'review',new.id,'review_received',new.event_id,
    'Nova avaliacao do seu trabalho',
    'Um contratante avaliou uma apresentacao concluida. Veja sua reputacao no Marketplace.')
 on conflict(recipient_id,source_type,source_id,event_code) do nothing;
 return new;
end;$$;
revoke all on function public.stage_notify_marketplace_review_created() from public,anon,authenticated;
drop trigger if exists stage_notify_marketplace_review_created on public.stage_marketplace_reviews;
create trigger stage_notify_marketplace_review_created
 after insert on public.stage_marketplace_reviews
 for each row execute function public.stage_notify_marketplace_review_created();

-- Selo verificado: so o titular do perfil, nunca outro usuario/cliente.
create or replace function public.stage_notify_profile_verified()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_summary text;
begin
 if new.kind not in ('singer','musician') then return new;end if;
 if tg_op='UPDATE' and new.verified_at is not distinct from old.verified_at
 then return new;end if;
 if not exists(select 1 from public.profiles p where p.id=new.target_id and p.is_artist=true)
 then return new;end if;
 v_summary:=case when new.kind='singer'
   then 'Seu perfil artistico recebeu o selo de verificacao Stage Flow.'
   else 'Sua atuacao como musico recebeu o selo de verificacao Stage Flow.' end;
 insert into public.stage_internal_notifications
   (recipient_id,source_type,source_id,event_code,title,summary,created_at)
 values(new.target_id,'verification',new.target_id,'profile_verified',
   'Perfil verificado',v_summary,coalesce(new.verified_at,now()))
 on conflict(recipient_id,source_type,source_id,event_code)
 do update set summary=excluded.summary,created_at=excluded.created_at,read_at=null;
 return new;
end;$$;
revoke all on function public.stage_notify_profile_verified() from public,anon,authenticated;
drop trigger if exists stage_notify_profile_verified on public.stage_admin_verifications;
create trigger stage_notify_profile_verified
 after insert or update of verified_at on public.stage_admin_verifications
 for each row execute function public.stage_notify_profile_verified();

-- Registros de recebimento confirmados ou alterados, nunca pequenos edits de UI.
-- Uma notificacao por registro, reaberta quando o valor de fato mudar.
create or replace function public.stage_notify_musician_receipt()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_musician uuid;v_event uuid;
begin
 if coalesce(new.received_amount,0)<=0 then return new;end if;
 if tg_op='UPDATE' and new.received_amount is not distinct from old.received_amount
 then return new;end if;
 select i.musician_id,i.event_id into v_musician,v_event
 from public.invitations i where i.id=new.invitation_id;
 if v_musician is null then return new;end if;
 insert into public.stage_internal_notifications
   (recipient_id,source_type,source_id,event_code,event_id,title,summary)
 values(v_musician,'finance',new.invitation_id,'finance_received',v_event,
   'Recebimento registrado',
   'Um recebimento foi registrado ou atualizado na sua participacao. Confira o Financeiro.')
 on conflict(recipient_id,source_type,source_id,event_code)
 do update set created_at=now(),read_at=null,summary=excluded.summary;
 return new;
end;$$;
revoke all on function public.stage_notify_musician_receipt() from public,anon,authenticated;
drop trigger if exists stage_notify_musician_receipt on public.stage_show_participation_finance;
create trigger stage_notify_musician_receipt
 after insert or update of received_amount on public.stage_show_participation_finance
 for each row execute function public.stage_notify_musician_receipt();

create or replace function public.stage_notify_event_receipt()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_owner uuid;
begin
 if coalesce(new.received_amount,0)<=0 then return new;end if;
 if tg_op='UPDATE' and new.received_amount is not distinct from old.received_amount
 then return new;end if;
 select e.producer_id into v_owner from public.events e where e.id=new.event_id;
 if v_owner is null then return new;end if;
 insert into public.stage_internal_notifications
   (recipient_id,source_type,source_id,event_code,event_id,title,summary)
 values(v_owner,'finance',new.event_id,'finance_received',new.event_id,
   'Recebimento de show registrado',
   'Um recebimento de evento foi registrado ou atualizado. Confira o Financeiro.')
 on conflict(recipient_id,source_type,source_id,event_code)
 do update set created_at=now(),read_at=null,summary=excluded.summary;
 return new;
end;$$;
revoke all on function public.stage_notify_event_receipt() from public,anon,authenticated;
drop trigger if exists stage_notify_event_receipt on public.stage_event_budget;
create trigger stage_notify_event_receipt
 after insert or update of received_amount on public.stage_event_budget
 for each row execute function public.stage_notify_event_receipt();

-- Apenas pendencias recentes ja existentes, sem acordar historico antigo.
insert into public.stage_internal_notifications
 (recipient_id,source_type,source_id,event_code,title,summary,created_at)
select b.artist_id,'booking',b.id,'booking_received','Novo pedido de contratacao',
 left('Voce recebeu um pedido de show em '||b.event_city||'. Confira e responda na sua caixa privada.',240),
 b.created_at
from public.stage_artist_booking_requests b
where b.status='new' and b.created_at>=now()-interval '30 days'
on conflict(recipient_id,source_type,source_id,event_code) do nothing;

insert into public.stage_internal_notifications
 (recipient_id,source_type,source_id,event_code,title,summary,created_at)
select v.target_id,'verification',v.target_id,'profile_verified','Perfil verificado',
 case when v.kind='singer' then 'Seu perfil artistico recebeu o selo de verificacao Stage Flow.'
 else 'Sua atuacao como musico recebeu o selo de verificacao Stage Flow.' end,
 v.verified_at
from public.stage_admin_verifications v
join public.profiles p on p.id=v.target_id and p.is_artist=true
where v.kind in ('singer','musician') and v.verified_at>=now()-interval '30 days'
on conflict(recipient_id,source_type,source_id,event_code) do nothing;

commit;
notify pgrst,'reload schema';
