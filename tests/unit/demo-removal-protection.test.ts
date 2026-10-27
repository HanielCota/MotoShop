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
  maskEmail,
  parseConfirmedStores,
  readDemoRemovalProtection,
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
