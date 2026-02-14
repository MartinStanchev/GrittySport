## Feature 2: User Authentication

### Goal
Users can register with email/password, log in, and stay authenticated. The app shows either the Auth screens or the main tab navigator depending on login state. JWT tokens are stored securely on device.

### Task 2.1: Database Migration — Users Table
- Create migration file `db/migrations/001_create_users.sql`:
  ```sql
  CREATE EXTENSION IF NOT EXISTS "pgcrypto";

  CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE INDEX idx_users_email ON users(email);
  ```
- Create a simple migration runner in Go that reads `.sql` files from `db/migrations/` in order and executes them against the database on server startup. Track applied migrations in a `schema_migrations` table.

### Task 2.2: Auth API Endpoints
- Implement `POST /api/auth/register`:
  - Request body: `{ "email": "string", "password": "string", "name": "string" }`
  - Validate: email format (basic regex), password minimum 8 characters, name non-empty
  - Hash password with bcrypt cost 12
  - Insert user into `users` table
  - Return `201` with `{ "user": { "id", "email", "name" }, "access_token": "jwt", "refresh_token": "uuid" }`
  - Return `409` if email already exists
- Implement `POST /api/auth/login`:
  - Request body: `{ "email": "string", "password": "string" }`
  - Look up user by email, compare bcrypt hash
  - Return `200` with `{ "user": { "id", "email", "name" }, "access_token": "jwt", "refresh_token": "uuid" }`
  - Return `401` if credentials are invalid
- Implement `POST /api/auth/refresh`:
  - Request body: `{ "refresh_token": "uuid" }`
  - Validate refresh token exists in DB and is not expired
  - Return new access token and new refresh token (rotate)
  - Return `401` if refresh token is invalid or expired
- JWT access token:
  - Payload: `{ "sub": "user_id", "email": "email", "exp": now + 15 minutes }`
  - Signed with HS256 using `JWT_SECRET`
- Refresh token:
  - Stored in a `refresh_tokens` table: `id UUID PK, user_id UUID FK, token UUID UNIQUE, expires_at TIMESTAMPTZ, created_at TIMESTAMPTZ`
  - Expires after 30 days
  - On refresh, delete old token and create new one
- Create an auth middleware function that extracts the JWT from the `Authorization: Bearer <token>` header, validates it, and injects the user ID into the request context. Apply this middleware to all `/api/*` routes except `/api/auth/*` and `/api/health`.

### Task 2.3: Auth Screens in React Native
- Install `expo-secure-store` for secure token storage
- Create a `LoginScreen` at `/src/screens/auth/LoginScreen.tsx`:
  - Fields: Email (keyboard type `email-address`, autocapitalize off), Password (secure text entry)
  - "Log In" button — calls `POST /api/auth/login`
  - Link at bottom: "Don't have an account? Register" — navigates to RegisterScreen
  - Show inline error messages for validation failures and API errors below the relevant field
  - Show a loading spinner on the button while the request is in flight
- Create a `RegisterScreen` at `/src/screens/auth/RegisterScreen.tsx`:
  - Fields: Name, Email, Password, Confirm Password
  - "Create Account" button — validates confirm password matches, calls `POST /api/auth/register`
  - Link at bottom: "Already have an account? Log In"
  - Same error handling and loading behavior as LoginScreen
- Both screens share a consistent layout: app logo/title at top ("GRITTY FITNESS" in bold), form centered vertically, minimal styling with the app color palette

### Task 2.4: Auth State Management and API Client
- Create an API client module at `/src/services/api.ts`:
  - Base URL configurable (read from app config / environment)
  - Wraps `fetch` with automatic `Authorization: Bearer` header injection
  - On 401 response: automatically attempt token refresh using the stored refresh token. If refresh succeeds, retry the original request. If refresh fails, clear tokens and redirect to login.
  - Export typed functions: `register(email, password, name)`, `login(email, password)`, `refreshToken()`
- Create an `AuthContext` at `/src/contexts/AuthContext.tsx`:
  - State: `user` (object or null), `isLoading` (boolean), `isAuthenticated` (boolean)
  - On app launch: check SecureStore for existing tokens. If access token exists and is not expired, set user as authenticated. If expired, attempt refresh. If no tokens, show login.
  - Expose functions: `signIn(email, password)`, `signUp(email, password, name)`, `signOut()`
  - `signOut` clears SecureStore tokens and resets state
- Update the root `App.tsx`:
  - Wrap everything in `AuthProvider`
  - If `isLoading`, show a splash/loading screen
  - If `isAuthenticated`, show the `BottomTabNavigator`
  - If not authenticated, show an `AuthStackNavigator` (Login ↔ Register)

### How to Test
- Start the backend with `docker compose up`
- Open app on iOS device — you see the Login screen
- Tap "Register" — register a new account — on success, you land on the Home tab
- Kill and reopen the app — you are still logged in (token persisted)
- Go to Settings placeholder, add a temporary "Log Out" button — tap it, you return to Login screen
- Log in with the account you created — you land on the Home tab

---