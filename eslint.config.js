// eslint.config.js
const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");
const prettier = require("eslint-plugin-prettier");

module.exports = defineConfig([
  expoConfig,
  { ignores: ["dist/*", "node_modules/*", ".expo/*"] },
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    plugins: { prettier },
    rules: {
      // Prettier integrado + forzar LF aquí mismo
      "prettier/prettier": ["error", { endOfLine: "lf" }],

      // Arrow functions obligatorias
      "func-style": ["error", "expression"],
      "prefer-arrow-callback": ["error"],
      "react/function-component-definition": [
        "error",
        {
          namedComponents: "arrow-function",
          unnamedComponents: "arrow-function",
        },
      ],
    },
  },
]);
