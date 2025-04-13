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
  };
  