import { defineConfig } from "vitest/config";
import { WxtVitest } from "wxt/testing/vitest-plugin";

export default defineConfig({
  plugins: [WxtVitest()],
  test: {
    environment: "jsdom",
    pool: "forks",
    isolate: false,
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
