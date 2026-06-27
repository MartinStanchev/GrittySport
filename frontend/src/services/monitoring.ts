import * as Sentry from '@sentry/react-native';

// Crash/error monitoring. No-ops unless EXPO_PUBLIC_SENTRY_DSN is set, so local
// dev and contributors without a DSN are unaffected.
const DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;

export const sentryEnabled = !!DSN;

// Reusable navigation integration so screen transitions become breadcrumbs.
export const navigationIntegration = Sentry.reactNavigationIntegration({
  enableTimeToInitialDisplay: true,
});

export function initMonitoring(): void {
  if (!DSN) return;

  Sentry.init({
    dsn: DSN,
    environment: __DEV__ ? 'development' : 'production',
    // Skip noisy local runs; report everything from real builds.
    enabled: !__DEV__,
    // Performance tracing — sample a slice to keep volume/cost low.
    tracesSampleRate: 0.2,
    integrations: [navigationIntegration],
  });
}

// captureError reports a handled error along with structured context. Use it in
// catch blocks where we recover gracefully but still want visibility (e.g. a
// workout save that fell back or failed). Safe to call when Sentry is disabled.
export function captureError(error: unknown, context?: Record<string, unknown>): void {
  if (!DSN) return;
  Sentry.captureException(error, context ? { extra: context } : undefined);
}

// Associates crashes/errors with the signed-in user. Pass null/undefined on sign-out.
export function setMonitoringUser(user: { id: string; email?: string } | null | undefined): void {
  if (!DSN) return;
  Sentry.setUser(user ? { id: user.id, email: user.email } : null);
}

export { Sentry };
