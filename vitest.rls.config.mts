import { defineConfig } from "vitest/config";

// Tests des règles RLS sur la vraie base (voir tests/rls/).
export default defineConfig({
  test: {
    include: ["tests/rls/**/*.test.ts"],
    environment: "node",
    testTimeout: 30_000,
  },
});
