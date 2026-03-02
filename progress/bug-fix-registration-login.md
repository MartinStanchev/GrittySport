## Bug Fix: Registration/Login network failures — Done
- Added CORS middleware to Go backend (`main.go`) — browser was blocking cross-origin requests from Expo web
- Added `EXPO_PUBLIC_API_URL` env var support for native devices only; web always uses `localhost:8080`
- Fixed `expo-secure-store` crash on web — platform-aware storage layer (`localStorage` on web, SecureStore on native) in `api.ts`, removed direct SecureStore import from `AuthContext.tsx`
