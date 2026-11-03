import { describe, expect, it } from "vitest";

import {
  DEMO_BRAND_SLUGS,
  DEMO_CATALOG_STORE_SLUGS,
  INTEGRATION_RUN_STORE_PREFIX,
  TEST_LEFTOVER_STORE_SLUGS,
  leftoverStoreWhere,
} from "../../scripts/demo-leftovers-scope";
import {
  PROTECTED_STORE_SLUGS,
  ProtectedDataError,
  assertNothingProtected,
  assertStoresConfirmed,
  describeStore,
  maskEmail,
  parseConfirmedStores,
  readDemoRemovalProtection,
  readRunMode,
  runRemoval,
  storesNeedingConfirmation,
} from "../../scripts/demo-removal-protection";

const protection = { emails: ["dono.real@empresa.test.br"] };
const demoStore = { slug: "demo-pista-norte", memberEmails: [] };
const qaStore = { slug: "qa-freitas-admin-seller", memberEmails: ["qa.bot@example.test"] };
const storeWithRealMember = {
  slug: "review-garagem-mx",
  memberEmails: ["review.lojista@example.test", "pessoa@gmail.com"],
};

describe("readDemoRemovalProtection", () => {
  it("refuses to run without the protected e-mails", () => {
    expect(() => readDemoRemovalProtection({})).toThrow(ProtectedDataError);
    expect(() => readDemoRemovalProtection({ DEMO_REMOVAL_PROTECTED_EMAILS: " , " })).toThrow(ProtectedDataError);
  });

  it("normalises the protected e-mails", () => {
    expect(readDemoRemovalProtection({ DEMO_REMOVAL_PROTECTED_EMAILS: " Dono@Loja.com ,b@c.com" })).toEqual({
      emails: ["dono@loja.com", "b@c.com"],
    });
  });
});

describe("assertNothingProtected", () => {
  it.each(PROTECTED_STORE_SLUGS)("aborts when the protected store %s falls in the scope", (slug) => {
    expect(() =>
      assertNothingProtected(protection, { stores: [demoStore, { slug, memberEmails: [] }], deletedUserEmails: [] }),
    ).toThrow(`Protected store in the removal scope: ${slug}`);
  });

  it("aborts when a protected account would be deleted, without printing the e-mail", () => {
    const run = () =>
      assertNothingProtected(protection, {
        stores: [],
        deletedUserEmails: ["review.a@example.test", "DONO.REAL@empresa.test.br"],
      });

    expect(run).toThrow("Protected account in the removal scope: do***@empresa.test.br");
    expect(run).not.toThrow(/dono\.real/);
  });

  it("lets demo and test stores through", () => {
    expect(() =>
      assertNothingProtected(protection, {
        stores: [demoStore, qaStore],
        deletedUserEmails: ["review.a@example.test"],
      }),
    ).not.toThrow();
  });
});

describe("stores with real members", () => {
  it("need a confirmation by slug before a real run", () => {
    const stores = [demoStore, qaStore, storeWithRealMember];

    expect(storesNeedingConfirmation(stores)).toEqual([storeWithRealMember]);
    expect(() => assertStoresConfirmed(stores, [])).toThrow("--confirm-stores: review-garagem-mx");
    expect(() => assertStoresConfirmed(stores, ["review-garagem-mx"])).not.toThrow();
  });

  it("reads the confirmed slugs from the command line", () => {
    expect(parseConfirmedStores(["--dry-run", "--confirm-stores=a, b,,"])).toEqual(["a", "b"]);
    expect(parseConfirmedStores(["--dry-run"])).toEqual([]);
  });

  it("masks e-mails for the report", () => {
    expect(maskEmail("pessoa@gmail.com")).toBe("pe***@gmail.com");
  });

  it("flags a protected member, which the mask alone would hide", () => {
    const store = { slug: "qa-freitas-admin-seller", memberEmails: ["dono.real@empresa.test.br"] };

    expect(describeStore(protection, store)).toEqual({
      slug: "qa-freitas-admin-seller",
      members: ["do***@empresa.test.br"],
      hasProtectedMember: true,
    });
    expect(describeStore(protection, storeWithRealMember).hasProtectedMember).toBe(false);
  });
});

describe("leftover scope", () => {
  it("lists every store exactly and never a protected one", () => {
    const where = leftoverStoreWhere();

    expect(where).toEqual({
      OR: [
        { slug: { in: [...DEMO_CATALOG_STORE_SLUGS, ...TEST_LEFTOVER_STORE_SLUGS] } },
        { slug: { startsWith: INTEGRATION_RUN_STORE_PREFIX } },
      ],
    });
    const listed = [...DEMO_CATALOG_STORE_SLUGS, ...TEST_LEFTOVER_STORE_SLUGS];
    expect(listed.some((slug) => PROTECTED_STORE_SLUGS.includes(slug))).toBe(false);
    expect(PROTECTED_STORE_SLUGS.some((slug) => slug.startsWith(INTEGRATION_RUN_STORE_PREFIX))).toBe(false);
    expect(DEMO_BRAND_SLUGS).toEqual(["apex-demo", "terra-demo"]);
  });
});

describe("run modes", () => {
  it("reads the mode from the command line, deleting for real only without a flag", () => {
    expect(readRunMode(["--dry-run"])).toBe("dry-run");
    expect(readRunMode(["--rehearse", "--confirm-stores=a"])).toBe("rehearse");
    expect(readRunMode([])).toBe("apply");
  });

  /** Stands in for Prisma: commits when the callback returns, rolls back when it throws. */
  function fakeDatabase(steps: string[]) {
    return {
      $transaction: async <T>(run: (tx: never) => Promise<T>): Promise<T> => {
        try {
          const result = await run({} as never);
          steps.push("commit");
          return result;
        } catch (error) {
          steps.push("rollback");
          throw error;
        }
      },
    };
  }

  it("always rolls a rehearsal back after the deletions ran, and still returns the report", async () => {
    const steps: string[] = [];

    const report = await runRemoval(fakeDatabase(steps) as never, "rehearse", async () => {
      steps.push("delete");
      return { removed: 3 };
    });

    expect(report).toEqual({ removed: 3 });
    expect(steps).toEqual(["delete", "rollback"]);
  });

  it("commits a real run and lets other errors through", async () => {
    const steps: string[] = [];

    await expect(runRemoval(fakeDatabase(steps) as never, "apply", async () => ({ removed: 1 }))).resolves.toEqual({
      removed: 1,
    });
    await expect(
      runRemoval(fakeDatabase(steps) as never, "rehearse", async () => {
        throw new Error("coupons_sellerId_fkey");
      }),
    ).rejects.toThrow("coupons_sellerId_fkey");
    expect(steps).toEqual(["commit", "rollback"]);
  });
});
