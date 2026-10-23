-- Somente no Postgres descartavel: contas falsas e atribuicao X para o gerente.
insert into auth.users(id,email) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','admin.qa@example.test'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','gerente.qa@example.test');

insert into public.profiles(id,role,display_name) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','producer','Admin de Teste'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','producer','Gerente de Teste');

insert into public.stage_venue_admins(profile_id)
values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');

insert into public.stage_venue_managers(venue_id,profile_id,granted_by)
select id,'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
from public.venues where slug='deck-espetobar-qa';
