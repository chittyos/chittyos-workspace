/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/?(*.)+(test).ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  transform: {
    '^.+\\.(ts|tsx)$': [
      'ts-jest',
      {
        tsconfig: 'tsconfig.json',
        transpilation: true,
        diagnostics: false,
        useESM: false,
      },
    ],
  },
  collectCoverageFrom: [
    'src/**/*.{ts,js}',
    '!src/**/*.d.ts',
    '!src/**/index.ts',
  ],
  moduleNameMapper: {
    '^chalk$': '<rootDir>/test-mocks/chalk.ts',
    '^ora$': '<rootDir>/test-mocks/ora.ts',
    '^boxen$': '<rootDir>/test-mocks/boxen.ts',
  },
};
