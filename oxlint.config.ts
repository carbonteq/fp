import { defineConfig } from "oxlint"

export default defineConfig({
  options: {
    typeAware: true,
    // typeCheck: true,
    reportUnusedDisableDirectives: "warn",
  },
  plugins: ["eslint", "import", "oxc", "promise", "typescript", "unicorn"],
  ignorePatterns: [
    "node_modules/",
    "dist",
    ".output",
    ".rumdl_cache",
    "data",
    ".claude",
    ".opencode",
    ".jj",
    ".git",
    ".agents",
  ],
  jsPlugins: [],
  rules: {
    "no-unused-vars": "off",
    "await-thenable": "off",
    "typescript/no-base-to-string": "off",
    "typescript/no-floating-promises": "off",
  },
  settings: {
    jsdoc: {},
    vitest: { typecheck: true },
  },
})
