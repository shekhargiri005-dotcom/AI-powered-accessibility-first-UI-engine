import type { Config } from 'jest'
import nextJest from 'next/jest.js'
 
const createJestConfig = nextJest({
  dir: './',
})
 
const config: Config = {
  coverageProvider: 'v8',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  collectCoverageFrom: [
    'lib/security/**/*.ts',
    'lib/ai/adapters/**/*.ts',
    'lib/validation/**/*.ts',
    '!lib/**/*.d.ts',
  ],
}
 
export default createJestConfig(config)
