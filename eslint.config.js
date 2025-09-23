// eslint.config.js
const { defineConfig } = require("eslint/config");
const expo = require("eslint-config-expo/flat");
const prettier = require("eslint-plugin-prettier");
const unusedImports = require("eslint-plugin-unused-imports");

module.exports = defineConfig([
  // 1) Inserta TODO el preset de Expo
  ...expo,

  // 2) Ignora carpetas
  { ignores: ["dist/*", "node_modules/*", ".expo/*"] },

  // 3) Tus reglas adicionales (sin tocar @typescript-eslint)
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    plugins: {
      prettier,
      "unused-imports": unusedImports,
    },
    rules: {
      // Prettier + fuerza LF
      "prettier/prettier": ["error", { endOfLine: "auto" }],

      // Arrow functions
      "func-style": ["error", "expression"],
      "prefer-arrow-callback": "error",
      "react/function-component-definition": [
        "error",
        { namedComponents: "arrow-function", unnamedComponents: "arrow-function" },
      ],

      // Desactiva el core (para no duplicar reportes)
      "no-unused-vars": "off",

      // Borra imports no usados (autofix)
      "unused-imports/no-unused-imports": "error",

      // Y marca variables/args no usados (con prefijo _ permitido)
      "unused-imports/no-unused-vars": [
        "error",
        {
          vars: "all",
          varsIgnorePattern: "^_",
          args: "after-used",
          argsIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],
    },
  },
]);
