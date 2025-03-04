import { defineConfig } from "tsup";

export default defineConfig((_options) => ({
  entry: ["./src/**/*.ts", "!./src/**/*_old.ts"],
  format: ["esm", "cjs"],
  sourcemap: true,
  clean: true,
  target: "node20",
  outDir: "dist",
  minify: false,
  splitting: true,
  treeshake: true,
  bundle: false,
  dts: true,
  esbuildOptions(opts, _ctx) {
    opts.drop = process.env.NODE_ENV === "production" ? ["console"] : [];
  },
  // pure:
  //   process.env.NODE_ENV === "production"
  //     ? ["console.log", "console.debug", "console.info"]
  //     : [],
}));
