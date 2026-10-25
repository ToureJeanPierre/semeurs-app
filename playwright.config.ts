import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 30_000,
  use: { baseURL: `http://localhost:${PORT}`, locale: "fr-CI" },
  projects: [{ name: "android", use: { ...devices["Pixel 7"] } }],
  webServer: {
    command: `npm run start -- -p ${PORT}`,
    port: PORT,
    reuseExistingServer: !process.env.CI,
    env: {
      // Valeurs factices : ces tests ne se connectent pas à Supabase.
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://exemple.supabase.co",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "sb_publishable_test",
      SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY ?? "sb_secret_test",
      APP_LOCK_SECRET: process.env.APP_LOCK_SECRET ?? "secret-de-test-".padEnd(40, "x"),
    },
  },
});
