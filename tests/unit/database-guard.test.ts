import { describe, expect, it } from "vitest";

import { requireScriptDatabaseUrl } from "../../scripts/database-guard";

const demo = "postgresql://user:secret@ep-demo-123.sa-east-1.aws.neon.tech/neondb?sslmode=require";

describe("requireScriptDatabaseUrl (H-01)", () => {
  it.each(["postgresql://u:p@localhost:5432/db", "postgresql://u:p@127.0.0.1/db", "postgresql://u:p@db.localhost/db"])(
    "always allows a local database (%s)",
    (url) => {
      expect(() => requireScriptDatabaseUrl({ DATABASE_URL: url }, "seed")).not.toThrow();
    },
  );

  it("refuses a remote host that is not listed", () => {
    expect(() => requireScriptDatabaseUrl({ DATABASE_URL: demo }, "db:seed:review")).toThrow(
      /db:seed:review refused to run on database host "ep-demo-123\.sa-east-1\.aws\.neon\.tech"/,
    );
  });

  it("runs on a host listed in SCRIPT_DATABASE_HOSTS, ignoring case and spaces", () => {
    expect(
      requireScriptDatabaseUrl(
        { DATABASE_URL: demo, SCRIPT_DATABASE_HOSTS: " other.neon.tech , EP-DEMO-123.sa-east-1.aws.neon.tech" },
        "seed",
      ),
    ).toBe(demo);
  });

  it("does not leak the password in the refusal", () => {
    expect(() => requireScriptDatabaseUrl({ DATABASE_URL: demo }, "seed")).toThrow(
      expect.not.objectContaining({ message: /secret/ }),
    );
  });

  it("requires DATABASE_URL", () => {
    expect(() => requireScriptDatabaseUrl({}, "seed")).toThrow("seed: DATABASE_URL is required.");
  });
});
