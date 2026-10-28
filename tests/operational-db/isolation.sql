\set ON_ERROR_STOP on
select set_config('fixture.marketplace','allowed',false);
set role authenticated;
select set_config('request.jwt.claim.sub','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',false);
do $$declare result jsonb;begin
 result:=public.stage_save_performance_profile(null,'group','Grupo de Pagode','Pagode de teste','Biografia','São Paulo',array['João','Pedro'],true);
 if result->>'status'<>'saved' then raise exception 'Failed to save own group %',result;end if;
 perform set_config('fixture.group_id',result->>'id',false);
 if public.stage_save_performance_profile(null,'venue',null,'Casa indevida','','',array[]::text[],false)->>'status'<>'producer_required' then raise exception 'Producer eligibility bypass';end if;
 begin
  update public.stage_performance_profiles set account_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  raise exception 'Direct writes unexpectedly allowed';
 exception when insufficient_privilege then null;end;
end;$$;
select set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',false);
do $$declare result jsonb;begin
 if exists(select 1 from public.stage_performance_profiles) then raise exception 'Cross-account profile leak';end if;
 if public.stage_save_performance_profile(current_setting('fixture.group_id')::uuid,'group','Banda','Taken','','',array['Member'],false)->>'status'<>'not_found' then raise exception 'Cross-account edit';end if;
 if jsonb_array_length(public.stage_discover_performance_profiles('teste',null)->'items')<>1 then raise exception 'Published group missing';end if;
 perform set_config('fixture.marketplace','denied',false);
 if public.stage_discover_performance_profiles('teste',null)->>'status'<>'not_released' then raise exception 'Launch gate bypass';end if;
 perform set_config('fixture.marketplace','allowed',false);
 result:=public.stage_invite_performance_profile('11111111-1111-4111-8111-111111111111',current_setting('fixture.group_id')::uuid,1500,'Convite de teste');
 if result->>'status'<>'sent' then raise exception 'Group invitation failed %',result;end if;
 perform set_config('fixture.invitation_id',result->>'invitation_id',false);
 if (select cardinality(members) from public.stage_invitation_performance_identity)<>2 then raise exception 'Group snapshot missing';end if;
 if public.stage_invite_performance_profile('11111111-1111-4111-8111-111111111111',current_setting('fixture.group_id')::uuid,1500,'retry')->>'status'<>'existing_invite' then raise exception 'Duplicate invitation';end if;
 result:=public.stage_save_performance_profile(null,'venue',null,'Casa do produtor','','São Paulo',array[]::text[],false);
 if result->>'status'<>'saved' then raise exception 'Producer house missing';end if;
end;$$;
select set_config('request.jwt.claim.sub','cccccccc-cccc-4ccc-8ccc-cccccccccccc',false);
do $$begin
 if exists(select 1 from public.stage_invitation_performance_identity) then raise exception 'Contract leaked to third party';end if;
 if public.stage_invite_performance_profile('11111111-1111-4111-8111-111111111111',current_setting('fixture.group_id')::uuid,1,'forged')->>'status'<>'event_not_found' then raise exception 'Event ownership bypass';end if;
end;$$;
select set_config('request.jwt.claim.sub','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',false);
do $$begin
 if (select name from public.stage_invitation_performance_identity)<>'Pagode de teste' then raise exception 'Receiver cannot read contract';end if;
 perform public.stage_save_performance_profile(current_setting('fixture.group_id')::uuid,'group','Banda','New name','','',array['Changed'],true);
 if (select name from public.stage_invitation_performance_identity)<>'Pagode de teste' then raise exception 'Contract mutated after profile edit';end if;
 if public.stage_respond_invite(current_setting('fixture.invitation_id')::uuid,true)<>'fee_pending' then raise exception 'Fee agreement bypass';end if;
end;$$;
reset role;
update public.stage_fee_negotiations set agreed_amount=last_amount where invitation_id=current_setting('fixture.invitation_id')::uuid;
set role authenticated;
do $$begin
 if public.stage_respond_invite(current_setting('fixture.invitation_id')::uuid,true)<>'accepted' then raise exception 'Confirmation failed';end if;
end;$$;
reset role;
do $$begin
 if not exists(select 1 from public.stage_show_participation_finance where invitation_id=current_setting('fixture.invitation_id')::uuid) then raise exception 'Finance not generated';end if;
 if exists(select 1 from public.venues where is_official or is_partner) then raise exception 'House elevated to official/partner';end if;
end;$$;
set role authenticated;
select set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',false);
do $$begin
 if public.stage_invite_performance_profile('22222222-2222-4222-8222-222222222222',current_setting('fixture.group_id')::uuid,500,'overlap')->>'status'<>'schedule_conflict' then raise exception 'Overlapping group show allowed';end if;
end;$$;
reset role;
select 'PASS: owner isolation, group snapshot, launch gate, producer houses, fee agreement, finance and overlapping schedule';
