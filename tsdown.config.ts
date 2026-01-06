import { defineConfig } from "tsdown";

export default defineConfig((_options) => ({
  entry: ["./src/**/*.ts", "!./src/**/*_old.ts"],
  format: ["esm", "cjs"],
  sourcemap: true,
  clean: true,
  target: "node22",
  outDir: "dist",
  minify: false,
  splitting: true,
  treeshake: true,
  unbundle: true,
  dts: true,
  platform: "node",
}));
