import "dotenv/config";
import { defineConfig } from "prisma/config";

const databaseUrl = process.env["DIRECT_URL"] ?? process.env["DATABASE_URL"];

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  // Migrations use Neon's direct connection when it is available.
  ...(databaseUrl ? { datasource: { url: databaseUrl } } : {}),
});
