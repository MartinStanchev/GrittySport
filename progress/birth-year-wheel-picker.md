# Birth-Year Wheel Picker on Consent Screen

Replaced the free-text 4-digit birth-year `TextInput` on the GDPR consent screen with a wheel-style year picker bounded `[currentYear - 100, currentYear - 16]`. The user taps the field, a modal opens with a snap-scrolling list of years (newest at top, oldest at bottom), and confirms with Done.

## Why

- The numeric input was easy to fat-finger and required custom error states for under-16 and out-of-range values.
- A bounded picker enforces the 16+ gate at the UI layer (the only valid years are presented), so the previous error/helper text and length-based validation are no longer needed.
- `birth_year` is already collected here and used by `ProfileSetupScreen` to derive age for max-HR estimation, so age is intentionally not asked again later.

## Key changes

- **New** `frontend/src/components/YearPickerSheet.tsx` — modal + `FlatList` with `snapToInterval`, fade for off-center items, bold font for the selected year. Cross-platform (no native date picker quirks).
- **Updated** `frontend/src/screens/auth/ConsentScreen.tsx`
  - State: `birthYearInput: string` → `birthYear: number | null` + `pickerOpen: boolean`.
  - UI: replaced `TextInput` with a tap-to-open field showing the selected year or "Select year" placeholder.
  - Removed the now-redundant `birthYearError`/error styling and `MIN_BIRTH_YEAR` constant; bounds come from `MIN_AGE`/`MAX_AGE`.
- Backend untouched — `services/consent.go` already validates `birth_year` (≥1900, ≤currentYear, ≥16) so the picker bounds are a strict subset of what's already accepted.

## Notes

- The picker defaults to ~14 years before the maximum allowed year if no value has been chosen, so users land near a sensible adult range rather than at the extremes.
- `ProfileSetupScreen` already had the standalone age input removed previously; no changes were needed there.
