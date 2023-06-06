import type { RollupOptions } from "rollup";

import { swc, defineRollupSwcOption } from "rollup-plugin-swc3";
import { typescriptPaths } from "rollup-plugin-typescript-paths";
import externals from "rollup-plugin-node-externals";

const config: RollupOptions =
	// CommonJS (for Node) & ESM (for bundlers)
	{
		input: "src/index.ts",
		output: [
			{
				file: "lib/index.js",
				format: "cjs",
				sourcemap: false,
			},
			{
				file: "lib/index.mjs",
				format: "es",
				sourcemap: false,
			},
			// { file: pkg.main, format: 'cjs', sourcemap: false },
			// { file: pkg.module, format: 'es', sourcemap: false },
		],
		plugins: [
			typescriptPaths({ preserveExtensions: true }),
			externals(),
			swc(
				defineRollupSwcOption({
					minify: true,
					tsconfig: "./tsconfig.build.json",
					jsc: {
						minify: {
							mangle: false,
							compress: true,
						},
						experimental: {
							keepImportAssertions: true,
						},
					},
				}),
			),
		],
		// external: ['oxide.ts', 'oxide.ts/dist/core', 'node:crypto'],
	};

export default config;
