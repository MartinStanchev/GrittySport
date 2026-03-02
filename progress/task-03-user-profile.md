## Task 3: Minimal User Profile and Settings — Done
- Migration `003_extend_users_minimal.sql`: added `timezone` and `units_preference` columns to users table (no sport/fitness fields — those belong to program criteria)
- Backend: `UserService` with `GetByID`/`Update`, `UserHandler` with `GET /api/v1/users/me` and `PUT /api/v1/users/me`, `User.ToResponse()` helper, updated all auth queries to include new columns
- Frontend: `getMe()`/`updateMe()` API functions, `AuthContext` fetches full profile via `/users/me` after auth (replaces JWT-only parsing), auto-detects timezone on first login, exposes `updateUser()` to context
- Settings screen: editable name, metric/imperial toggle, timezone field, save button with dirty-checking, log out
- **Code simplification pass:** Removed duplicate `User` interface in AuthContext (reuses exported `UserResponse` from api.ts), simplified state setters to pass API response directly
