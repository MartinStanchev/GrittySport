# Progress

## Task 1: Project Scaffolding and Base App Shell — Done
- Expo React Native app in `frontend/` with TypeScript, bottom tab navigation (Home, History, Programs, Settings) using Ionicons, color palette in `src/constants/colors.ts`
- Go backend in `backend/` with chi router, `GET /api/health` endpoint, zerolog logging, multi-stage Dockerfile
- Docker Compose at root: postgres:16 + api service, `db/migrations/` ready
- **Deviation:** Used `frontend/` + `backend/` layout instead of task's suggested `gritty-fitness` app name for the Expo directory

## Task 2: User Authentication — Done
- Backend: SQL migrations for `users` and `refresh_tokens` tables, Go auth service with register/login/refresh/JWT validation, HTTP handlers, JWT middleware, bcrypt password hashing, token rotation
- Frontend: API client with token storage (SecureStore), automatic 401 refresh retry, AuthContext provider with JWT-based session restoration, Login/Register screens, AuthStack navigation, logout on Settings screen
- Integration and unit tests for service layer, handlers, and middleware
- **Code simplification pass:** Extracted shared auth screen styles to `authStyles.ts`, consolidated duplicated `AuthStackParamList` type into `AuthStackNavigator.tsx`, fixed hardcoded API URL in AuthContext to use exported `API_BASE_URL`, extracted `userFromToken` helper to deduplicate JWT payload parsing, used `errors.As` consistently in Go tests, removed unnecessary comments across backend and frontend

## Bug Fix: Registration/Login network failures — Done
- Added CORS middleware to Go backend (`main.go`) — browser was blocking cross-origin requests from Expo web
- Added `EXPO_PUBLIC_API_URL` env var support for native devices only; web always uses `localhost:8080`
- Fixed `expo-secure-store` crash on web — platform-aware storage layer (`localStorage` on web, SecureStore on native) in `api.ts`, removed direct SecureStore import from `AuthContext.tsx`
