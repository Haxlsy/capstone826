-- Security Logs vs. Audit Trail switched from an action-text allow-list to a
-- category split (category = 'auth' routes to Security Logs — see
-- app/api/admin/audit-log/route.ts). That only changed what NEW rows get
-- categorized as; these two login-security events were still being logged
-- under category 'flag' before this app code change shipped, so existing
-- rows need a one-time backfill to actually move into Security Logs too.
UPDATE audit_log
SET category = 'auth'
WHERE category = 'flag'
  AND action IN (
    'Logged in — ended a previous active session on another device',
    'Account locked out after 3 failed login attempts'
  );
