import { describe, expect, it } from "vitest";

import { getInngestServeBlockReason } from "./production-guard";

describe("getInngestServeBlockReason", () => {
  it("allows any configuration outside production", () => {
    expect(getInngestServeBlockReason({ NODE_ENV: "development", INNGEST_DEV: "1" })).toBeNull();
    expect(getInngestServeBlockReason({ NODE_ENV: "test" })).toBeNull();
  });

  it("refuses dev mode in production, even with a signing key", () => {
    for (const value of ["1", "true", "http://localhost:8288"]) {
      expect(
        getInngestServeBlockReason({ NODE_ENV: "production", INNGEST_DEV: value, INNGEST_SIGNING_KEY: "signkey" }),
      ).toMatch(/INNGEST_DEV/);
    }
  });

  it("refuses production without a signing key", () => {
    expect(getInngestServeBlockReason({ NODE_ENV: "production" })).toMatch(/INNGEST_SIGNING_KEY/);
    expect(getInngestServeBlockReason({ NODE_ENV: "production", INNGEST_SIGNING_KEY: " " })).toMatch(
      /INNGEST_SIGNING_KEY/,
    );
  });

  it("serves signed cloud mode in production", () => {
    expect(
      getInngestServeBlockReason({ NODE_ENV: "production", INNGEST_DEV: "0", INNGEST_SIGNING_KEY: "signkey" }),
    ).toBeNull();
    expect(
      getInngestServeBlockReason({ NODE_ENV: "production", INNGEST_DEV: "false", INNGEST_SIGNING_KEY: "signkey" }),
    ).toBeNull();
  });
});
