## Task 2: User Authentication — Done
- Backend: SQL migrations for `users` and `refresh_tokens` tables, Go auth service with register/login/refresh/JWT validation, HTTP handlers, JWT middleware, bcrypt password hashing, token rotation
- Frontend: API client with token storage (SecureStore), automatic 401 refresh retry, AuthContext provider with JWT-based session restoration, Login/Register screens, AuthStack navigation, logout on Settings screen
- Integration and unit tests for service layer, handlers, and middleware
- **Code simplification pass:** Extracted shared auth screen styles to `authStyles.ts`, consolidated duplicated `AuthStackParamList` type into `AuthStackNavigator.tsx`, fixed hardcoded API URL in AuthContext to use exported `API_BASE_URL`, extracted `userFromToken` helper to deduplicate JWT payload parsing, used `errors.As` consistently in Go tests, removed unnecessary comments across backend and frontend
