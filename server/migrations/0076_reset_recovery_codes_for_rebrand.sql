-- The recovery-code HMAC context changed with the rename to Olauda, so hashes
-- stored under the old context can never match again.
DELETE FROM public.mfa_recovery_codes;
