import { expect, it } from "vitest";

import { requiredTextValidator } from "./required-text";

it("returns the message and field until the trimmed text reaches the minimum length", () => {
  const validate = requiredTextValidator("reason", "Informe o motivo.", 5);
  const form = new FormData();

  form.set("reason", "   abc ");
  expect(validate(form)).toEqual({ message: "Informe o motivo.", field: "reason" });
  form.set("reason", "Foto borrada");
  expect(validate(form)).toBeNull();
});
