import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: [
      // wxt.config.ts の paths: "~/*" -> "./app/*" を再現
      { find: /^~\/(.*)/, replacement: "/home/user/refined-chromium-chrome-ext/app/$1" },
    ],
  },
  test: {
    environment: "jsdom",
    pool: "forks",
    isolate: false,
    setupFiles: ["src/tests/setup.ts"],
    include: ["src/tests/**/*.test.ts"],
    exclude: ["node_modules", "e2e"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["src/**/*.ts", "src/**/*.tsx", "entrypoints/**/*.ts", "entrypoints/**/*.tsx"],
      exclude: ["src/tests/**", "node_modules"],
    },
  },
});
