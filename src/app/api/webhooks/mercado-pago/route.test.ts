import { createHmac } from "node:crypto";
import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  findUnique: vi.fn(),
  update: vi.fn(),
  send: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/config/env", () => ({ env: { MERCADO_PAGO_WEBHOOK_SECRET: "test-webhook-secret" } }));
vi.mock("@/lib/database", () => ({
  db: { webhookEvent: { create: mocks.create, findUnique: mocks.findUnique, update: mocks.update } },
}));
vi.mock("@/lib/inngest/client", () => ({ inngest: { send: mocks.send } }));

import { POST } from "./route";

function signedRequest(signatureValid = true, timestamp = String(Date.now())): Request {
  const paymentId = "123456";
  const requestId = "test-request-id";
  const hash = createHmac("sha256", signatureValid ? "test-webhook-secret" : "wrong-secret")
    .update(`id:${paymentId};request-id:${requestId};ts:${timestamp};`)
    .digest("hex");
  return new Request("http://localhost:3000/api/webhooks/mercado-pago", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-request-id": requestId,
      "x-signature": `ts=${timestamp},v1=${hash}`,
    },
    body: JSON.stringify({ id: "notification-1", type: "payment", data: { id: paymentId } }),
  });
}

beforeEach(() => {
  Object.values(mocks).forEach((mock) => mock.mockReset());
  mocks.send.mockResolvedValue({ ids: ["job-1"] });
});

it("rejects different body and signed query resource identifiers", async () => {
  const original = signedRequest();
  const response = await POST(
    new Request("http://localhost:3000/api/webhooks/mercado-pago?data.id=999", {
      method: "POST",
      headers: original.headers,
      body: await original.text(),
    }),
  );
  expect(response.status).toBe(400);
  expect(mocks.create).not.toHaveBeenCalled();
});

it("requires a notification id instead of collapsing distinct updates into one event", async () => {
  const original = signedRequest();
  const payload = await original.json();
  delete payload.id;
  const response = await POST(
    new Request(original.url, { method: "POST", headers: original.headers, body: JSON.stringify(payload) }),
  );
  expect(response.status).toBe(400);
  expect(mocks.send).not.toHaveBeenCalled();
});

it("preserves a persisted event when the job queue fails so delivery can retry", async () => {
  mocks.create.mockResolvedValue({ id: "event-1", status: "RECEIVED" });
  mocks.send.mockRejectedValueOnce(new Error("queue unavailable"));
  const response = await POST(signedRequest());
  expect(response.status).toBe(503);
  expect(mocks.update).toHaveBeenCalledWith(
    expect.objectContaining({ data: expect.objectContaining({ status: "FAILED" }) }),
  );
});

it("persists a signed payment notification before enqueueing it", async () => {
  mocks.create.mockResolvedValue({ id: "event-1", status: "RECEIVED" });
  const response = await POST(signedRequest());
  expect(response.status).toBe(202);
  expect(await response.json()).toEqual({ received: true, duplicate: false });
  expect(mocks.create).toHaveBeenCalledWith(
    expect.objectContaining({ data: expect.objectContaining({ externalId: "notification-1" }) }),
  );
  expect(mocks.send).toHaveBeenCalledWith({
    name: "motoshop/payment.webhook.received",
    data: { webhookEventId: "event-1" },
  });
  expect(mocks.create.mock.invocationCallOrder[0]).toBeLessThan(mocks.send.mock.invocationCallOrder[0]!);
});

it("does not enqueue an already processed notification again", async () => {
  mocks.create.mockRejectedValue({ code: "P2002" });
  mocks.findUnique.mockResolvedValue({ id: "event-1", status: "PROCESSED" });
  const response = await POST(signedRequest());
  expect(response.status).toBe(202);
  expect(await response.json()).toEqual({ received: true, duplicate: true });
  expect(mocks.send).not.toHaveBeenCalled();
});

it("rejects invalid signatures without persisting or enqueueing", async () => {
  const response = await POST(signedRequest(false));
  expect(response.status).toBe(401);
  expect(mocks.create).not.toHaveBeenCalled();
  expect(mocks.send).not.toHaveBeenCalled();
});

it.each([
  { label: "older than five minutes", offsetMs: -6 * 60 * 1000 },
  { label: "more than five minutes in the future", offsetMs: 6 * 60 * 1000 },
])("rejects a validly signed notification whose timestamp is $label (replay)", async ({ offsetMs }) => {
  const response = await POST(signedRequest(true, String(Date.now() + offsetMs)));
  expect(response.status).toBe(401);
  expect(mocks.create).not.toHaveBeenCalled();
  expect(mocks.send).not.toHaveBeenCalled();
});

it("accepts a timestamp within the tolerance window", async () => {
  mocks.create.mockResolvedValue({ id: "event-1", status: "RECEIVED" });
  const response = await POST(signedRequest(true, String(Date.now() - 4 * 60 * 1000)));
  expect(response.status).toBe(202);
});

it("refuses oversized bodies before parsing, with or without Content-Length", async () => {
  const original = signedRequest();
  const payload = { ...(await original.json()), padding: "x".repeat(70 * 1024) };
  const body = JSON.stringify(payload);
  const declared = await POST(new Request(original.url, { method: "POST", headers: original.headers, body }));
  expect(declared.status).toBe(413);

  const encoded = new TextEncoder().encode(body);
  const streamed = new ReadableStream<Uint8Array>({
    start(controller) {
      for (let offset = 0; offset < encoded.length; offset += 8 * 1024)
        controller.enqueue(encoded.slice(offset, offset + 8 * 1024));
      controller.close();
    },
  });
  const headers = new Headers(original.headers);
  headers.delete("content-length");
  const chunked = await POST(
    new Request(original.url, { method: "POST", headers, body: streamed, duplex: "half" } as RequestInit),
  );
  expect(chunked.status).toBe(413);
  expect(mocks.create).not.toHaveBeenCalled();
});
