-- StageFlow: add owner-only account deletion outcomes to the existing private audit.
-- DEPLOY ONLY together with app/api/admin/accounts/[id]/route.ts.
-- This migration DOES NOT delete any users or grant any new browser privileges.
begin;

alter table public.stage_owner_admin_audit
 drop constraint if exists stage_owner_admin_audit_action_check;
alter table public.stage_owner_admin_audit
 add constraint stage_owner_admin_audit_action_check check (action in (
   'verification_granted','verification_revoked',
   'venue_approved','venue_rejected',
   'pro_access_granted','pro_access_revoked',
   'account_deletion_requested','account_deleted','account_deletion_failed'
 ));

alter table public.stage_owner_admin_audit
 drop constraint if exists stage_owner_admin_audit_kind_check;
alter table public.stage_owner_admin_audit
 add constraint stage_owner_admin_audit_kind_check check (kind in (
   'singer','musician','venue','account'
 ));

-- Audit table is already protected by RLS and has no direct browser grants.
commit;
