/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.ts'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: { allowJs: true }, diagnostics: false }],
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'json'],
  moduleNameMapper: {
    '^react-native$': '<rootDir>/src/__mocks__/react-native.ts',
    '^expo-document-picker$': '<rootDir>/src/__mocks__/expo-document-picker.ts',
    '^expo-sharing$': '<rootDir>/src/__mocks__/expo-sharing.ts',
    '^expo-file-system$': '<rootDir>/src/__mocks__/expo-file-system.ts',
  },
};
