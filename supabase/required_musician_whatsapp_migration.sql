-- Stage Flow: WhatsApp obrigatório na criação de conta de músico.
-- Execute DEPOIS de whatsapp_reminders_migration.sql.
-- Executável novamente sem apagar usuários, convites ou números existentes.
-- Não execute migrações antigas que redefinam handle_new_user() após esta.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  chosen_artist boolean;
  chosen_producer boolean;
  chosen_role public.account_role;
  chosen_name text;
  chosen_username text;
  chosen_invite text;
  chosen_phone text;
  chosen_opt_in boolean;
begin
  chosen_artist := coalesce((new.raw_user_meta_data ->> 'is_artist')::boolean, true);
  chosen_producer := coalesce((new.raw_user_meta_data ->> 'is_producer')::boolean, false);
  if not chosen_artist and not chosen_producer then chosen_artist := true; end if;

  chosen_role := case when chosen_producer and not chosen_artist
    then 'producer'::public.account_role else 'musician'::public.account_role end;

  chosen_name := coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), 'Novo usuário');
  chosen_username := lower(nullif(trim(new.raw_user_meta_data ->> 'username'), ''));
  if not chosen_artist then chosen_username := null; end if;
  chosen_invite := nullif(trim(new.raw_user_meta_data ->> 'invite_code'), '');

  chosen_phone := regexp_replace(coalesce(new.raw_user_meta_data ->> 'whatsapp_phone', ''), '[^0-9]', '', 'g');
  chosen_opt_in := coalesce((new.raw_user_meta_data ->> 'whatsapp_opt_in')::boolean, false);
  if chosen_artist then
    -- Número brasileiro com DDD e código do país (55).
    if length(chosen_phone) in (10, 11) then chosen_phone := '55' || chosen_phone; end if;
    if chosen_phone !~ '^55[1-9][0-9]{9,10}$' then
      raise exception 'Informe um WhatsApp válido com DDD ao criar uma conta de músico.';
    end if;
  end if;

  insert into public.profiles
    (id, role, display_name, username, is_artist, is_producer,
     plan_code, custom_subdomain_enabled, marketplace_enabled)
  values
    (new.id, chosen_role, chosen_name, chosen_username, chosen_artist, chosen_producer,
     'free', false, false);

  if chosen_artist then
    insert into public.musician_whatsapp_preferences
      (profile_id, phone_e164, opted_in)
    values (new.id, chosen_phone, chosen_opt_in)
    on conflict (profile_id) do nothing;
  end if;

  -- Preserva convites antigos enviados a um e-mail específico.
  -- Convites novos por link continuam sendo reivindicados após login.
  if chosen_artist and chosen_invite is not null then
    update public.invitations i
      set musician_id = new.id
      where i.invite_code = chosen_invite
        and i.musician_id is null
        and i.status = 'pending'
        and lower(i.invited_email) = lower(new.email);
  end if;

  return new;
end;
$$;

-- Ao retirar autorização, manter o telefone no registro privado.
-- O organizador deixa imediatamente de recebê-lo por stage_sent_invitations_with_whatsapp().
create or replace function public.stage_save_whatsapp_preference(
  p_phone text,
  p_opt_in boolean
)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_phone text;
begin
  if auth.uid() is null then return 'login_required'; end if;

  if not coalesce(p_opt_in, false) then
    update public.musician_whatsapp_preferences
       set opted_in = false, updated_at = now()
     where profile_id = auth.uid();
    return 'disabled';
  end if;

  if not exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_artist = true
  ) then return 'artist_required'; end if;

  v_phone := regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g');
  if length(v_phone) in (10, 11) then
    v_phone := '55' || v_phone;
  end if;
  if v_phone !~ '^55[1-9][0-9]{9,10}$' then
    return 'invalid_phone';
  end if;

  insert into public.musician_whatsapp_preferences
    (profile_id, phone_e164, opted_in, updated_at)
  values (auth.uid(), v_phone, true, now())
  on conflict (profile_id) do update
    set phone_e164 = excluded.phone_e164,
        opted_in = true,
        updated_at = now();

  return 'enabled';
end;
$$;
revoke all on function public.stage_save_whatsapp_preference(text, boolean) from public;
grant execute on function public.stage_save_whatsapp_preference(text, boolean) to authenticated;
