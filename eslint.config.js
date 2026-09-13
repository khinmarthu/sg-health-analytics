import js from "@eslint/js";
import tseslint from "typescript-eslint";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";

// One shared config for the whole monorepo (backend, frontend, infra,
// packages/types) rather than a separate config per package — different
// rules apply to different paths below (e.g. React rules only under
// frontend/), but it's simpler to keep it in one file.
export default tseslint.config(
  { ignores: ["**/dist/**", "**/node_modules/**", "**/cdk.out/**", "**/coverage/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // A leading underscore marks a variable as intentionally unused (e.g.
    // destructuring to omit a field: `const { x: _omit, ...rest } = obj`).
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },
  {
    files: ["backend/**/*.ts", "infra/**/*.ts"],
    languageOptions: { globals: globals.node },
  },
  {
    files: ["frontend/**/*.{ts,tsx}"],
    languageOptions: { globals: globals.browser },
    plugins: { react, "react-hooks": reactHooks },
    rules: {
      ...react.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      "react/react-in-jsx-scope": "off", // new JSX transform doesn't need React imported
      "react/prop-types": "off", // using TypeScript types instead
    },
    settings: { react: { version: "detect" } },
  },
);
