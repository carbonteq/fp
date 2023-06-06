// https://jestjs.io/docs/configuration

/** @type {require('@jest/types').Config.InitialOptions} */
const config = {
	moduleFileExtensions: ["js", "ts"],
	testEnvironment: "node",
	notify: false,
	rootDir: ".",
	roots: ["src", "tests"],
	testRegex: ".*\\.(spec|test|integration)\\.ts",
	testPathIgnorePatterns: ["/node_modules/"],
	transform: {
		"^.+\\.(t|j)sx?$": "@swc/jest",
	},
	transformIgnorePatterns: ["/node_modules/"],
	moduleNameMapper: {
		"^@carbonteq/fp(.*)$": ["<rootDir>/lib"],
	},
	setupFilesAfterEnv: ["jest-extended/all"],
};

module.exports = config;
