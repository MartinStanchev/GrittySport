// Test mock for @sentry/react-native — native module isn't available under Jest.
export const init = jest.fn();
export const wrap = jest.fn((c: unknown) => c);
export const captureException = jest.fn();
export const setUser = jest.fn();
export const reactNavigationIntegration = jest.fn(() => ({
  registerNavigationContainer: jest.fn(),
}));
