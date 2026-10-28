import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
const read=p=>readFileSync(resolve(process.cwd(),p),"utf8");
const migration=read("supabase/stage_important_activity_notifications_20261028.sql");
const bell=read("components/notification-bell.tsx");
const inbox=read("app/notificacoes/page.tsx");
const booking=read("app/meu-perfil-artistico/solicitacoes/page.tsx");
const base=read("supabase/internal_notifications_migration.sql");

test("requests from a public artist booking form generate a private notice in the same transaction",()=>{
  assert.match(migration,/create or replace function public\.stage_notify_artist_booking_created\(\)/);
  assert.match(migration,/after insert on public\.stage_artist_booking_requests/);
  assert.match(migration,/new\.artist_id,'booking',new\.id,'booking_received'/);
  assert.match(migration,/on conflict\(recipient_id,source_type,source_id,event_code\) do nothing/);
  assert.doesNotMatch(migration,/new\.contact_email|new\.contact_phone|new\.message/);
  assert.match(base,/revoke all on public\.stage_internal_notifications from public,anon,authenticated/);
  assert.match(base,/where recipient_id=auth\.uid\(\)/);
});

test("reviews, verified profiles and financial receipts receive important activity notices",()=>{
  for(const [fn,table] of [
    ["stage_notify_marketplace_review_created","stage_marketplace_reviews"],
    ["stage_notify_profile_verified","stage_admin_verifications"],
    ["stage_notify_musician_receipt","stage_show_participation_finance"],
    ["stage_notify_event_receipt","stage_event_budget"]
  ]){
    assert.match(migration,new RegExp("create or replace function public\\."+fn+"\\(\\)"));
    assert.match(migration,new RegExp("create trigger "+fn+".*?", "s").test(migration)
      ? /for each row execute function public\./
      : new RegExp("on public\\."+table));
  }
  assert.match(migration,/new\.received_amount is not distinct from old\.received_amount/);
  assert.match(migration,/coalesce\(new\.received_amount,0\)<=0/);
  assert.match(migration,/new\.kind not in \('singer','musician'\)/);
  assert.match(migration,/new\.target_id/);
  assert.match(migration,/on conflict\(recipient_id,source_type,source_id,event_code\)/);
});

test("existing invitations, chat, operations and Pro courtesy codes remain supported",()=>{
  for(const v of ["invitation","proposal","conversation","operations","account",
    "show_briefing_changed","pro_courtesy_granted","pro_courtesy_revoked"])assert.ok(migration.includes("'"+v+"'"));
  assert.match(migration,/stage_internal_notifications_source_type_check/);
  assert.match(migration,/stage_internal_notifications_event_code_check/);
  assert.match(migration,/where b\.status='new' and b\.created_at>=now\(\)-interval '30 days'/);
});

test("bell and full inbox route each new category to its owner-facing location",()=>{
  for(const s of [bell,inbox]){
    for(const type of ["booking","review","verification","finance"])assert.match(s,new RegExp('source_type==="'+type+'"'));
    assert.match(s,/meu-perfil-artistico\/solicitacoes\?pedido=/);
    assert.match(s,/financeiro/);
    assert.match(s,/marketplace/);
    assert.match(s,/perfil-artistico/);
  }
  assert.match(booking,/new URLSearchParams\(window\.location\.search\)\.get\("pedido"\)/);
  assert.match(booking,/getElementById\("booking-"\+focusedBooking\)/);
  assert.match(booking,/focusedBooking\?" is-notification-focus"/);
});
