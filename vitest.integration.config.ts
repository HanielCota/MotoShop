import path from "node:path";
import { config } from "dotenv";
import { defineConfig } from "vitest/config";
config({ path: ".env.local", quiet: true });
// Tests must never use live payment, shipping, mail or storage credentials.
for (const key of Object.keys(process.env))
  if (/^(MERCADO_PAGO|MELHOR_ENVIO|R2_|RESEND_|EMAIL_FROM|UPSTASH_)/.test(key)) delete process.env[key];
export default defineConfig({
  resolve: { alias: { "@": path.resolve("src"), "server-only": path.resolve("tests/support/server-only.ts") } },
  test: {
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    testTimeout: 60_000,
    hookTimeout: 60_000,
    fileParallelism: false,
  },
});
