import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          "argsIgnorePattern": "^_",
          "varsIgnorePattern": "^_",
          "caughtErrorsIgnorePattern": "^_"
        }
      ]
    }
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Compiled backend output
    "backend/dist/**",
    // Backend utility/test scripts (CommonJS)
    "backend/check-user.js",
    "backend/create-test-data.js",
    "backend/init-weights.js",
    "backend/promote-admin.js",
    "backend/run-feedback-migration.js",
    "backend/run-migration.js",
    "backend/test-api.js",
    "backend/test-db.js",
    "backend/test-prisma-models.js",
    // Root-level utility scripts
    "promote-admin.js",
    "test-api.js",
    "ecosystem.config.js",
  ]),
]);

export default eslintConfig;
