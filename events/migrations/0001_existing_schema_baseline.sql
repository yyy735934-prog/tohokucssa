-- The production database already contains the schema through PR #2.
-- This no-op migration establishes Wrangler's migration ledger so that all
-- subsequent schema changes can be applied exactly once by CI.
SELECT 1;
