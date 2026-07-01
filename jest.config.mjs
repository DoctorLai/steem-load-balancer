export default {
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]sx?$': 'babel-jest', // Ensures Jest uses Babel to transform JavaScript/TypeScript files
  },
  globals: {
    'jest': true,
    'describe': true,
    'test': true,
    'expect': true,
  },
  collectCoverageFrom: ["src/**/*.js"],
  coverageReporters: ["text", "lcov", "json", "json-summary", "html"], // Specify desired coverage reporters
  coverageThreshold: {
    global: {
      branches: 72,
      functions: 88,
      lines: 85,
      statements: 85,
    },
  },
};
  