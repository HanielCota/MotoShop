import { expect, it } from "vitest";

import { requiredTextValidator } from "./required-text";

it("returns the message until the trimmed text reaches the minimum length", () => {
  const validate = requiredTextValidator("reason", "Informe o motivo.", 5);
  const form = new FormData();

  form.set("reason", "   abc ");
  expect(validate(form)).toBe("Informe o motivo.");
  form.set("reason", "Foto borrada");
  expect(validate(form)).toBeNull();
});
