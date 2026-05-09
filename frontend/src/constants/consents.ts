// Bumping any version here forces existing users to re-accept on next launch.
// Keep in sync with the matching constants in backend/internal/models/consent.go.
export const ConsentVersions = {
  terms: '2026-05-08',
  privacy: '2026-05-08',
  health_data: '2026-05-08',
  age_16_plus: '2026-05-08',
  marketing: '2026-05-08',
} as const;
