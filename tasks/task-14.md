## Feature 14: Settings Screen Completion

### Goal
The Settings screen is fully functional with all sections.

### Task 14.1: Full Settings Implementation
- **Account Section**:
  - Show user email (read-only)
  - "Change Password" — opens a screen with current password, new password, confirm new password fields. Calls `PUT /api/auth/password` (new endpoint: validates current password, updates hash).
  - "Delete Account" — shows a confirmation dialog with warning text: "This will permanently delete your account and all data. This cannot be undone." On confirm, calls `DELETE /api/users/me`.
- Implement `DELETE /api/users/me`:
  - Hard deletes the user and all associated data (cascading FKs handle this)
  - Revokes all refresh tokens
  - Returns `204`
- Implement `PUT /api/auth/password`:
  - Body: `{ "current_password": "string", "new_password": "string" }`
  - Validates current password against hash, then updates
  - Returns `200` on success, `401` if current password wrong
- **Units Section**: Already implemented in profile. Show a toggle for Metric/Imperial that updates the user profile.
- **Connected Devices Section**: Already implemented in Feature 10.
- **Notifications Section**: Already implemented in Feature 13.
- **Data Export**:
  - "Export My Data" button calls `GET /api/export` which returns a JSON file containing: user profile, all programs with full structure, all workouts, all chat messages
  - The response is a downloadable JSON file. On the client, use `expo-file-system` to save it and `expo-sharing` to share it via the iOS share sheet.
  - Implement `GET /api/export`: assembles the full data export as a JSON object and returns it with `Content-Type: application/json` and `Content-Disposition: attachment; filename="gritty-fitness-export.json"`

### How to Test
- Change password → log out → log in with new password
- Export data → a JSON file is shared/saved, inspect it to verify completeness
- Delete account → confirm → app returns to login screen → try to log in → fails (account gone)

---