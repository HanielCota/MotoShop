import { expect, it } from "vitest";
import { z } from "zod";

import { firstIssue } from "./first-issue-message";

const schema = z.object({ name: z.string().min(2, "Informe o nome."), priceInCents: z.number() });

it("returns null for valid input and the first schema message with its field otherwise", () => {
  expect(firstIssue(schema, { name: "Luiz", priceInCents: 100 }, "Confira os dados.")).toBeNull();
  expect(firstIssue(schema, { name: "", priceInCents: 100 }, "Confira os dados.")).toEqual({
    message: "Informe o nome.",
    field: "name",
  });
});

it("names the form control when the schema key differs from it", () => {
  expect(firstIssue(schema, { name: "Luiz" }, "Confira os dados.", { priceInCents: "price" })).toMatchObject({
    field: "price",
  });
});
