import { expect, it } from "vitest";
import { z } from "zod";

import { firstIssueMessage } from "./first-issue-message";

const schema = z.object({ name: z.string().min(2, "Informe o nome.") });

it("returns null for valid input and the first schema message otherwise", () => {
  expect(firstIssueMessage(schema, { name: "Luiz" }, "Confira os dados.")).toBeNull();
  expect(firstIssueMessage(schema, { name: "" }, "Confira os dados.")).toBe("Informe o nome.");
});
