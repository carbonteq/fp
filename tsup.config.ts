import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["./src/**/*.ts", "!./src/**/*_old.ts"],
  format: ["esm", "cjs"],
  sourcemap: true,
  clean: true,
  target: "node20",
  outDir: "dist",
  minify: false,
  bundle: false,
  dts: true,
});
