import { defineConfig } from "bunup";

const isProd = process.env.NODE_ENV === "production";

export default defineConfig({
  entry: ["./src/**/*.ts", "!./src/**/*_old.ts"],
  format: ["cjs", "esm"],
  sourcemap: "linked",
  minify: false,
  minifyWhitespace: isProd,
  minifySyntax: isProd,
  minifyIdentifiers: false,
  clean: true,
  target: "node",
  splitting: false,
  dts: true,
  preferredTsconfig: "./tsconfig.build.json",
  unused: true,
  drop: isProd ? ["console"] : undefined,
  exports: false,
  // exports: true
});
