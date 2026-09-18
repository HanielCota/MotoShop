import { describe, expect, it } from "vitest";

import { storeProfileSchema } from "./store-profile";

describe("storeProfileSchema", () => {
  it("accepts a valid public profile", () => {
    expect(
      storeProfileSchema.parse({
        name: "MX Parts",
        slug: "mx-parts",
        description: "Peças e equipamentos para motocross.",
      }),
    ).toEqual({
      name: "MX Parts",
      slug: "mx-parts",
      description: "Peças e equipamentos para motocross.",
    });
  });

  it("rejects an invalid slug and an oversized description", () => {
    const result = storeProfileSchema.safeParse({
      name: "MX Parts",
      slug: "MX Parts",
      description: "x".repeat(501),
    });

    expect(result.success).toBe(false);
  });
});
