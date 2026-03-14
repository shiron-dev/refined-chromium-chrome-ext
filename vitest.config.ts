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
  },
});
