# GPS Map Recenter North Up

- Updated the live GPS recording screen so the top-right recenter control now resets the map camera to a north-up orientation instead of only animating the region.
- Added idle/pre-start location tracking from the native user-location event so the recenter button can snap back to the user before the workout has produced route points.
- Applied map padding for the live workout HUD and bottom panel so recentering and follow mode place the user marker back in the visible map area rather than too low on screen.
- Extracted `buildNorthUpCamera()` and `getLiveMapPadding()` into `frontend/src/utils/liveWorkout.ts` as a manual simplification pass; a dedicated code simplifier agent was not available in this environment.
- Added unit coverage for the new camera and padding helpers in `frontend/src/__tests__/liveWorkout.test.ts`.

## Validation

- `npm test -- --runInBand src/__tests__/liveWorkout.test.ts`
- `npm run lint` (passes with 9 pre-existing warnings elsewhere in the frontend)
- `wsl bash -lc "export PATH=/usr/local/go/bin:/home/marts/go/bin:$PATH; cd /mnt/c/Users/stanc/dev/GrittySport/backend; golangci-lint run"`

## Key Files

- `frontend/src/screens/RecordGPSScreen.tsx`
- `frontend/src/utils/liveWorkout.ts`
- `frontend/src/__tests__/liveWorkout.test.ts`
