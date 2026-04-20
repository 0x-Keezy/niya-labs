import nextJest from 'next/jest.js'
 
const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files in your test environment
  dir: './',
})
 
// Add any custom config to be passed to Jest
/** @type {import('jest').Config} */
const config = {
  // Add more setup options before each test is run
  // setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],

  testEnvironment: 'jest-environment-jsdom',
  setupFilesAfterEnv: ['./jest.setup.mjs'],

  // Collect coverage from source only — excludes tests, declaration files,
  // stories, and Next.js framework entry points that have no meaningful logic.
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.stories.{ts,tsx}',
    '!src/pages/_app.tsx',
    '!src/pages/_document.tsx',
  ],

  // Starter coverage floor — increase when new tests land.
  // Current real coverage is ~0.6%; 10% is a reachable first rung so CI
  // fails loudly if tests regress, without blocking day-to-day work.
  coverageThreshold: {
    global: {
      lines: 10,
      statements: 10,
      functions: 10,
      branches: 5,
    },
  },
}
 
// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
export default createJestConfig(config)
