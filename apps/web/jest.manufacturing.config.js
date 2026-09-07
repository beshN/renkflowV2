const nextJest = require('next/jest');

module.exports = nextJest({ dir: './' })({
  testEnvironment: 'node',
  setupFilesAfterEnv: [],
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/$1' },
  testMatch: ['<rootDir>/lib/features/manufacturing/**/__tests__/**/*.test.ts'],
  clearMocks: true,
});
