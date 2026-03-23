# Activity Edit Screen Refresh

- Updated `frontend/src/screens/ActivityDetailScreen.tsx` so edit/create mode uses the newer Kinetic panel treatment instead of flat divider-only sections.
- Restyled the day-of-week and activity-type selectors with bordered pills on a distinct panel surface, improving contrast in dark mode.
- Updated `frontend/src/components/PrescriptionEditor.tsx` so exercise/set cards use an inset accent surface and the actual inputs sit on a separate input background.
- Tightened typography, spacing, multiline field sizing, and add/remove controls to better match the newer app-wide design language.

## Key Files

- `frontend/src/screens/ActivityDetailScreen.tsx`
- `frontend/src/components/PrescriptionEditor.tsx`

## Verification

- Frontend tests: `npm test -- --runInBand` ✅
- Frontend lint: `npm run lint` ✅ with pre-existing warnings in unrelated files
- Backend lint: `wsl bash -lc "export PATH=/usr/local/go/bin:/home/marts/go/bin:$PATH; cd /mnt/c/Users/stanc/dev/GrittySport/backend; golangci-lint run"` ✅
- Backend tests: `wsl bash -lc "export PATH=/usr/local/go/bin:/home/marts/go/bin:$PATH; cd /mnt/c/Users/stanc/dev/GrittySport/backend; go test ./..."` ⚠️ pre-existing failure in `backend/internal/ai/prompt_test.go` due missing prompt fixture / nil prompt loader

## Notes

- I performed a manual simplification pass while refreshing the UI. A dedicated code simplifier agent was not available in this environment.
