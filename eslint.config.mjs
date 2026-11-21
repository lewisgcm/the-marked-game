// ESLint flat config (ESLint 9+). Replaces the old .eslintrc, which ESLint 10 no longer reads.
import js from "@eslint/js";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import prettierRecommended from "eslint-plugin-prettier/recommended";
import roblox from "eslint-plugin-roblox-ts";

export default [
	{ ignores: ["out/**", "include/**", "build/**", "node_modules/**", "tools/**", "assets/**"] },
	js.configs.recommended,
	...tsPlugin.configs["flat/recommended"],
	roblox.configs.recommended,
	{
		files: ["src/**/*.ts", "src/**/*.tsx"],
		languageOptions: {
			parser: tsParser,
			parserOptions: {
				ecmaFeatures: { jsx: true },
				ecmaVersion: 2018,
				sourceType: "module",
				// The roblox-ts preset turns on typescript-eslint's projectService, which finds
				// tsconfig.json itself, so no "project" setting here.
			},
		},
		rules: {
			// roblox-ts globals (game, workspace, typeIs, ...) are declared by @rbxts/types;
			// the TypeScript compiler already reports undefined names.
			"no-undef": "off",
		},
	},
	prettierRecommended,
	{
		rules: {
			"prettier/prettier": "warn",
		},
	},
];
