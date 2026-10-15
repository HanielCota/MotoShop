import pino from "pino";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/config/env", () => ({ env: { NODE_ENV: "test" } }));

import { loggerRedaction, loggerSerializers } from "./logger";

function logOnce(payload: Record<string, unknown>): Record<string, unknown> {
  const lines: string[] = [];
  const destination = { write: (line: string) => lines.push(line) };
  pino({ redact: loggerRedaction, serializers: loggerSerializers }, destination).info(payload);

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

  it("censors secrets two levels deep, including cookies, API keys and OAuth secrets (L-14)", () => {
    const entry = logOnce({
      response: { headers: { "set-cookie": "session=1", cookie: "a=b" } },
      provider: { auth: { clientSecret: "cs", apiKey: "ak", access_token: "at" } },
      secret: "root-secret",
    });

    const serialized = JSON.stringify(entry);
    for (const value of ["session=1", "a=b", "cs", "ak", "at", "root-secret"])
      expect(serialized).not.toContain(`"${value}"`);
  });

  it("serializes errors logged under error instead of printing {} (L-14)", () => {
    const entry = logOnce({ event: "x.failed", error: new Error("database timeout") });

    expect(entry.error).toMatchObject({ type: "Error", message: "database timeout" });
  });

  it("keeps censoring secrets", () => {
    const entry = logOnce({ password: "secret", headers: { cookie: "session=1" } });

    expect(entry).toMatchObject({ password: "[REDACTED]", headers: { cookie: "[REDACTED]" } });
  });
});
