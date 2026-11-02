import js from "@eslint/js";
import globals from "globals";
import react from "eslint-plugin-react";
import hooks from "eslint-plugin-react-hooks";

// 정적 검사: 오타·안 쓰는 변수·없는 변수·리액트 훅 규칙. 서버와 테스트는 노드, 화면은 브라우저 기준이다.
export default [
  { ignores: ["dist/", "node_modules/", "server/data/"] },
  { linterOptions: { reportUnusedDisableDirectives: "off" } },
  js.configs.recommended,
  {
    files: ["src/**/*.{js,jsx}"],
    languageOptions: { ecmaVersion: "latest", sourceType: "module", globals: globals.browser, parserOptions: { ecmaFeatures: { jsx: true } } },
    plugins: { react, "react-hooks": hooks },
    settings: { react: { version: "18" } },
    rules: {
      ...hooks.configs.recommended.rules,
      "react/jsx-uses-vars": "error", "react/jsx-uses-react": "error", "react/jsx-key": "error",
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrors: "none" }],
      "no-empty": ["error", { allowEmptyCatch: true }],
      "react-hooks/exhaustive-deps": "off",                      // 3D 화면은 한 번만 만들고 ref로 최신 값을 읽는 방식이라 의도적으로 끈다
    },
  },
  {
    files: ["server/**/*.js", "tests/**/*.js", "vite.config.js", "eslint.config.js"],
    languageOptions: { ecmaVersion: "latest", sourceType: "module", globals: { ...globals.node, fetch: "readonly" } },
    rules: { "no-unused-vars": ["warn", { argsIgnorePattern: "^_", caughtErrors: "none" }], "no-empty": ["error", { allowEmptyCatch: true }], "no-control-regex": "off" },   // 서버는 제어 문자를 일부러 걸러 낸다
  },
];
