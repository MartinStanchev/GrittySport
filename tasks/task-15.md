## Feature 15: Polish and Final Integration

### Goal
Tie up loose ends, ensure all features work together end-to-end, and polish the UI.

### Task 15.1: Program Cache for Offline
- On app foreground (when online), fetch the active program and upcoming activities and store them in SQLite
- When the app is offline, read from the SQLite cache so the Home screen still displays the program and upcoming activities
- Show a subtle "Offline" banner at the top of the screen when there's no connectivity

### Task 15.2: Chat Unread Badge
- Add a small red badge to the chat bar on the Home screen when there are unread Grit messages
- Track "last read" message ID in AsyncStorage. On chat open, update it. On new messages arriving (via WebSocket or on app foreground), compare.

### Task 15.3: Error Handling and Edge Cases
- All API calls should have proper error handling with user-facing error messages (not raw error codes)
- Handle token expiration gracefully (auto-refresh is implemented; verify it works in all scenarios)
- Handle WebSocket disconnection during active chat (show reconnecting indicator, auto-reconnect)
- Handle GPS permission denial with a clear explanation screen
- Handle HealthKit permission denial gracefully

### Task 15.4: Loading States
- All screens that fetch data should show skeleton loaders or activity indicators while loading
- The Home screen should show a skeleton layout for the program card and upcoming activities during initial load
- Chat message sending should show the user's message immediately (optimistic UI) with a subtle pending indicator until confirmed

### Task 15.5: App Icon and Splash Screen
- Design and configure the app icon. We can use Stitch or you can design icon ideas yourself. 
- Configure the splash screen in `app.json` with the app name and icon
- Use `expo-splash-screen` to hold the splash until initial auth check completes

### How to Test
- Full end-to-end flow: register → complete profile → create a program with Grit → see upcoming workouts → record a GPS run → get Grit's review → have Grit adjust the program → check history → export data
- Test offline: turn on airplane mode → open app → see cached program → record a workout → reconnect → workout syncs
- Test edge cases: let a workout be missed → Grit reaches out → respond → Grit adjusts program
