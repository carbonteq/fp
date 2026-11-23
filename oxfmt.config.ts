import { defineConfig } from "oxfmt"

export default defineConfig({
  embeddedLanguageFormatting: "auto",
  ignorePatterns: [
    "node_modules",
    "dist",
    ".jj",
    ".git",
    "src/routeTree.gen.ts",
    "data",
    ".claude",
    "src/components/ui",
    ".output",
    ".tanstack",
    ".rumdl_cache",
    "*.md",
    ".agents",
  ],
  sortImports: {
    groups: [
      "type-import",
      ["value-builtin", "value-external"],
      "type-internal",
      "value-internal",
      ["type-parent", "type-sibling", "type-index"],
      ["value-parent", "value-sibling", "value-index"],
      { newlinesBetween: true },
      "unknown",
    ],
    internalPattern: ["@/"],
  },
  sortTailwindcss: { stylesheet: "src/styles/globals.css" },
  printWidth: 80, // like biome
  useTabs: false,
  tabWidth: 2,
  semi: false,
  singleQuote: false,
  trailingComma: "all",
  bracketSpacing: true,
  arrowParens: "always",
  overrides: [
    { files: ["*.json", "*.jsonc"], options: { trailingComma: "none" } },
  ],
})
