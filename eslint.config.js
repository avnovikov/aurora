import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import sonarjs from "eslint-plugin-sonarjs";

/** TypeScript smell + complexity gate (SonarJS + ESLint complexity). */
export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  sonarjs.configs.recommended,
  {
    files: ["src/**/*.ts", "tests/**/*.ts", "e2e/**/*.ts"],
    rules: {
      // Cyclomatic complexity (ESLint built-in)
      complexity: ["error", { max: 10 }],
      // Sonar cognitive complexity (default threshold 15 in recommended;
      // keep explicit so the gate is obvious in config)
      "sonarjs/cognitive-complexity": ["error", 15],
      // Extra cyclomatic gate from Sonar (off in recommended; turn on)
      "sonarjs/cyclomatic-complexity": ["error", { threshold: 10 }],
      // Noise for small pure modules
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      "public/**",
      "src/data/generated/**",
      "*.config.js",
      "*.config.ts",
    ],
  },
);
