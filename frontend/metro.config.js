// Sentry's wrapper around the default Expo Metro config — enables source-map
// collection/upload so production stack traces are symbolicated.
const { getSentryExpoConfig } = require('@sentry/react-native/metro');

const config = getSentryExpoConfig(__dirname);

module.exports = config;
