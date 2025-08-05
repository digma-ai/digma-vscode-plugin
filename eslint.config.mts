import eslint from "@eslint/js";
import eslintConfigPrettier from "eslint-config-prettier/flat";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["out/"]
  },
  eslint.configs.recommended,
  tseslint.configs.recommendedTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        project: "./tsconfig.eslint.json",
        tsconfigRootDir: import.meta.dirname,
        ecmaVersion: 2023
      },
      globals: {
        ...globals.node
      }
    },
    rules: {
      "@typescript-eslint/consistent-type-imports": "error"
    }
  },
  eslintConfigPrettier,
  // Custom rules
  {
    rules: {
      curly: "error",
      "no-console": "error",
      "no-useless-return": "error"
    }
  }
);
