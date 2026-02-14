## Feature 1: Project Scaffolding and Base App Shell

### Goal
A running React Native app on iOS with bottom tab navigation and placeholder screens. A running Go backend with health check endpoint. Docker Compose setup for local development.

### Task 1.1: React Native Project Init
- Initialize a new React Native project using Expo (managed workflow) with TypeScript template: `npx create-expo-app gritty-fitness --template expo-template-blank-typescript`
- Install and configure `@react-navigation/native`, `@react-navigation/bottom-tabs`, and `@react-navigation/native-stack`
- Install required Expo dependencies: `expo-splash-screen`, `expo-status-bar`
- Configure `app.json` with app name "Gritty Fitness", bundle identifier `com.grittyfitness.app`, and scheme `grittyfitness`
- Create a `/src` directory structure:
  - `/src/screens/` — screen components
  - `/src/components/` — shared UI components
  - `/src/services/` — API client, storage, etc.
  - `/src/hooks/` — custom React hooks
  - `/src/types/` — TypeScript type definitions
  - `/src/constants/` — colors, config, etc.
  - `/src/navigation/` — navigation configuration

### Task 1.2: Tab Navigation and Placeholder Screens
- Create a `BottomTabNavigator` with 4 tabs: Home, History, Programs, Settings
- Each tab renders a placeholder screen component with the screen name displayed centered
- Use icons from `@expo/vector-icons` (Ionicons): `home`, `time`, `barbell`, `settings`
- Define a color palette in `/src/constants/colors.ts`:
  - Primary: `#E63946` (gritty red)
  - Background: `#F8F8F8`
  - Surface: `#FFFFFF`
  - Text Primary: `#1A1A1A`
  - Text Secondary: `#666666`
  - Tab Active: `#E63946`
  - Tab Inactive: `#999999`
- Tab bar should have a white background with a subtle top border (`#E0E0E0`)

### Task 1.3: Go Backend Init
- Initialize a Go module: `github.com/grittyfitness/api`
- Use the following libraries:
  - `github.com/go-chi/chi/v5` for HTTP routing
  - `github.com/jackc/pgx/v5` for PostgreSQL
  - `github.com/golang-jwt/jwt/v5` for JWT
  - `golang.org/x/crypto/bcrypt` for password hashing
  - `github.com/rs/zerolog` for structured logging
- Create a `main.go` that starts an HTTP server on port `8080`
- Implement a single endpoint: `GET /api/health` returning `{ "status": "ok" }`
- Load configuration from environment variables: `DATABASE_URL`, `JWT_SECRET`, `PORT`
- Create a `Dockerfile` for the Go server (multi-stage build)

### Task 1.4: Docker Compose for Local Development
- Create a `docker-compose.yml` at the project root with:
  - `postgres` service: PostgreSQL 16, port 5432, volume for data persistence, database name `grittyfitness`, user `gritty`, password read from `.env`
  - `api` service: Go server, port 8080, depends on `postgres`, environment variables from `.env`
- Create a `.env.example` with all required variables
- Create a `db/migrations/` directory (empty for now; migrations are added per-feature)

### How to Test
- Run `docker compose up` — PostgreSQL and Go server start. `curl http://localhost:8080/api/health` returns `{"status":"ok"}`
- Run the Expo app on iOS device/simulator — app launches with 4-tab navigation, each showing its placeholder screen name

---