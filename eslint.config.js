// eslint.config.js
import js from "@eslint/js";
import globals from 'globals';

export default [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        process: "readonly",
        __dirname: "readonly",
        require: "readonly",
        module: "readonly",
        console: "readonly",  // <-- added console
        setTimeout: "readonly",  // <-- added setTimeout
        clearTimeout: "readonly",  // <-- added clearTimeout
      },
    },
    rules: {
      "no-unused-vars": "warn",
      "no-console": "off",
    },
  },
  {
    // Jest-specific config
    files: ['**/*.test.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.node,
        ...globals.jest,  // 👈 this is the key to fixing `describe`, `test`, `expect`
      },
    },
  }  
];

