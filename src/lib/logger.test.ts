import pino from "pino";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/config/env", () => ({ env: { NODE_ENV: "test" } }));

import { loggerRedaction } from "./logger";

function logOnce(payload: Record<string, unknown>): Record<string, unknown> {
  const lines: string[] = [];
  const destination = { write: (line: string) => lines.push(line) };
  pino({ redact: loggerRedaction }, destination).info(payload);

  const [line] = lines;
  if (!line) throw new Error("Expected one log line");
  return JSON.parse(line) as Record<string, unknown>;
}

describe("loggerRedaction", () => {
  it("censors e-mail, CPF and phone at the top level", () => {
    const entry = logOnce({ event: "test", email: "a@example.test", cpf: "12345678909", phone: "11999990000" });

    expect(entry).toMatchObject({ event: "test", email: "[REDACTED]", cpf: "[REDACTED]", phone: "[REDACTED]" });
  });

  it("censors personal data one level deep without touching operational fields", () => {
    const entry = logOnce({ order: { id: "order-1", customerEmail: "a@example.test", customerPhone: "11999990000" } });

    expect(entry.order).toEqual({ id: "order-1", customerEmail: "[REDACTED]", customerPhone: "[REDACTED]" });
  });

  it("censors CPF/CNPJ fields named as in the profile and the checkout", () => {
    const entry = logOnce({
      taxId: "52998224725",
      input: { customerTaxId: "52998224725", customerPhone: "11999990000" },
    });

    expect(entry).toMatchObject({
      taxId: "[REDACTED]",
      input: { customerTaxId: "[REDACTED]", customerPhone: "[REDACTED]" },
    });
  });

  it("keeps censoring secrets", () => {
    const entry = logOnce({ password: "secret", headers: { cookie: "session=1" } });

    expect(entry).toMatchObject({ password: "[REDACTED]", headers: { cookie: "[REDACTED]" } });
  });
});
