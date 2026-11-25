module.exports = {
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/tests', '<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.js', '**/?(*.)+(spec|test).js'],
  collectCoverageFrom: [
    'src/**/*.js',
    'index.js',
    '!src/**/index.js',
    '!src/**/*.test.js',
    '!src/**/__tests__/**',
  ],
  coverageThresholds: {
    global: {
      branches: 50,
      functions: 50,
      lines: 50,
      statements: 50,
    },
  },
  setupFiles: ['<rootDir>/tests/setup.js'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  transform: {
    '^.+\\.js$': ['babel-jest', { configFile: require.resolve('./.babelrc') }],
  },
  transformIgnorePatterns: ['/node_modules/(?!@lapo/asn1js/)'],
  testTimeout: 10000,
};
