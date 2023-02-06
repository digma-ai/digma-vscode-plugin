module.exports = {
  env: {
    browser: true,
    jquery: true,
    es2021: true,
    node: true
  },
  root: true,
  extends: [
    // "eslint:recommended",
    // "plugin:@typescript-eslint/recommended",
    // "plugin:@typescript-eslint/recommended-requiring-type-checking",
    "prettier"
  ],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    tsconfigRootDir: __dirname,
    project: "./tsconfig.eslint.json",
    ecmaVersion: 13,
    sourceType: "module"
  },
  plugins: ["@typescript-eslint"],
  rules: {
    /* eslint-disable @typescript-eslint/naming-convention */
    "@typescript-eslint/naming-convention": "warn",
    "@typescript-eslint/semi": "warn",
    curly: "warn",
    eqeqeq: "warn",
    "no-throw-literal": "warn",
    semi: "off"
    /* eslint-enable @typescript-eslint/naming-convention */
  },
  ignorePatterns: [
    "jaegerUi",
    "out",
    "src/views-ui/common/jquery-3.6.0.min.js",
    "src/views-ui/common/require-2.3.6.min.js"
  ]
};
