import { expect, it } from "vitest";
import { requireTestDatabaseUrl } from "../support/test-environment";
it("requires an explicit test database", () => {
  expect(() => requireTestDatabaseUrl({})).toThrow("TEST_DATABASE_URL");
});
it("does not accept the application database under different credentials", () => {
  expect(() =>
    requireTestDatabaseUrl({
      DATABASE_URL: "postgresql://app:example@db.test/app",
      TEST_DATABASE_URL: "postgresql://tester:example@db.test/app?sslmode=require",
    }),
  ).toThrow("Refusing");
});
it("accepts an explicitly configured separate test database", () => {
  expect(
    requireTestDatabaseUrl({
      DATABASE_URL: "postgresql://app:example@db.test/app",
      TEST_DATABASE_URL: "postgresql://tester:example@isolated.test/tests",
    }),
  ).toContain("isolated.test");
});
it("requires an explicit opt-in before reusing the application database", () => {
  expect(() =>
    requireTestDatabaseUrl({
      DATABASE_URL: "postgresql://app:example@db.test/app",
      TEST_DATABASE_URL: "postgresql://tester:example@db.test/app?sslmode=require",
    }),
  ).toThrow("ALLOW_SHARED_TEST_DATABASE=true");

  expect(
    requireTestDatabaseUrl({
      DATABASE_URL: "postgresql://app:example@db.test/app",
      TEST_DATABASE_URL: "postgresql://tester:example@db.test/app?sslmode=require",
      ALLOW_SHARED_TEST_DATABASE: "true",
    }),
  ).toContain("db.test");
});
