import { describe, expect, it } from "vitest";

import { storeProfileSchema } from "./store-profile";

describe("storeProfileSchema", () => {
  it("accepts a valid public profile", () => {
    expect(
      storeProfileSchema.parse({
        name: "MX Parts",
        slug: "mx-parts",
        description: "Peças e equipamentos para motocross.",
        instagramUrl: "",
        youtubeUrl: "",
        whatsappUrl: "",
        facebookUrl: "",
      }),
    ).toEqual({
      name: "MX Parts",
      slug: "mx-parts",
      description: "Peças e equipamentos para motocross.",
      instagramUrl: "",
      youtubeUrl: "",
      whatsappUrl: "",
      facebookUrl: "",
    });
  });

  it("rejects an invalid slug and an oversized description", () => {
    const result = storeProfileSchema.safeParse({
      name: "MX Parts",
      slug: "MX Parts",
      description: "x".repeat(501),
      instagramUrl: "javascript:alert(1)",
      youtubeUrl: "",
      whatsappUrl: "",
      facebookUrl: "",
    });

    expect(result.success).toBe(false);
  });

  it("accepts optional social profile URLs and rejects invalid URLs", () => {
    const valid = storeProfileSchema.safeParse({
      name: "MX Parts",
      slug: "mx-parts",
      description: "",
      instagramUrl: "https://instagram.com/mxparts",
      youtubeUrl: "",
      whatsappUrl: "https://wa.me/5511999999999",
      facebookUrl: "",
    });
    const invalid = storeProfileSchema.safeParse({
      name: "MX Parts",
      slug: "mx-parts",
      description: "",
      instagramUrl: "instagram.com/mxparts",
      youtubeUrl: "",
      whatsappUrl: "",
      facebookUrl: "",
    });

    expect(valid.success).toBe(true);
    expect(invalid.success).toBe(false);
  });

  it("only accepts the official hosts of each social network", () => {
    const base = {
      name: "MX Parts",
      slug: "mx-parts",
      description: "",
      youtubeUrl: "",
      whatsappUrl: "",
      facebookUrl: "",
    };
    const accepted = [
      { ...base, instagramUrl: "https://www.instagram.com/mxparts" },
      { ...base, instagramUrl: "", youtubeUrl: "https://youtu.be/abc" },
      { ...base, instagramUrl: "", youtubeUrl: "https://m.youtube.com/@mxparts" },
      { ...base, instagramUrl: "", facebookUrl: "https://www.facebook.com/mxparts" },
    ];
    const rejected = [
      { ...base, instagramUrl: "https://evil.example/instagram.com" },
      { ...base, instagramUrl: "https://instagram.com.evil.example/mxparts" },
      { ...base, instagramUrl: "https://instagram.com@evil.example/mxparts" },
      { ...base, instagramUrl: "https://notinstagram.com/mxparts" },
      { ...base, instagramUrl: "", youtubeUrl: "https://facebook.com/mxparts" },
      { ...base, instagramUrl: "", facebookUrl: "https://fake-facebook.com/mxparts" },
    ];

    for (const input of accepted) expect(storeProfileSchema.safeParse(input).success).toBe(true);
    for (const input of rejected) expect(storeProfileSchema.safeParse(input).success).toBe(false);
  });
});
