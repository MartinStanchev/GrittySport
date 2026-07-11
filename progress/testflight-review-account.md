# TestFlight / App Store Review Account (Static OTP)

Apple's Beta App Review (external TestFlight testers) and App Store review require working sign-in credentials. With passwordless email-OTP auth, reviewers can't receive our emails — so one designated account gets a fixed 6-digit code that is never emailed.

## How it works

- Two env vars: `REVIEW_ACCOUNT_EMAIL` + `REVIEW_ACCOUNT_OTP`. Both unset (or email unset) = feature fully disabled. Invalid config (bad email, code not exactly 6 digits) fails startup via `log.Fatal`.
- `AuthService.SetReviewAccount(email, code)` normalizes the email and validates the code, storing them on the service (`reviewEmail`/`reviewOTP` fields).
- `RequestOTP`: when the normalized request email matches the review account, the bcrypt-hashed `email_otps` row is inserted with the static code instead of a random one, and the `mailer.SendOTP` + `recordSend` steps are skipped (early return after tx commit).
- `VerifyOTP` needed **zero changes** — attempt cap (5), 10-min expiry, `FOR UPDATE` serialization, single-use consumption, and the timing/enumeration protections all apply to the review account exactly as to real users.
- The code must be exactly 6 digits because `AuthScreen`'s OTP input strips non-digits and caps at 6.

## Reviewer flow

1. Reviewer enters the review email, taps "send code" (inserts the OTP row; no email goes out).
2. Reviewer types the static code from the App Store Connect review notes.
3. Normal login — consent screen etc. apply, so pre-seed the account (complete consents, create a program) before submitting for review.

## Drive-by test fixes (pre-existing failures in `services` package)

- `user_test.go` (`TestDeleteAccount_AnonymizesConsentsAndCascadesUserData`) had rotted: hardcoded `"v1"` consent versions (server-authoritative versions are `models.TermsVersion` etc. since security-audit-batch-2), missing required `BirthYear`, and `ip_address` (inet) scanned into `*string` — fixed with models constants, a `BirthYear` pointer, and an `ip_address::text` cast.
- `cleanTables`/`TestMain` cleanup now also deletes `user_consents`: consent rows orphaned by raw `DELETE FROM users` (cascade `SET NULL`, no anonymizing UPDATE) polluted the unscoped assertion query across tests.

## Key files

- `backend/internal/services/auth.go` — `SetReviewAccount`, review branch in `RequestOTP`
- `backend/main.go` — env wiring + startup log
- `backend/internal/services/auth_test.go` — 3 new tests + `user_consents` cleanup
- `backend/internal/services/user_test.go` — repaired DeleteAccount test
