import { createHmac, timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";
import { z } from "zod";

import { env } from "@/config/env";
import { ingestMercadoPagoWebhook } from "@/modules/payments/application/ingest-webhook";

/** Signed notifications older (or further in the future) than this are treated as replays. */
const SIGNATURE_TOLERANCE_MS = 5 * 60 * 1000;
/** Mercado Pago notifications are a few hundred bytes; anything larger is refused before parsing. */
const MAX_BODY_BYTES = 64 * 1024;

export async function POST(request: Request) {
  const body = await readBoundedBody(request, MAX_BODY_BYTES);
  if (body === null) return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  const identifier = z.union([z.string().min(1).max(100), z.number().int().positive()]);
  const parsed = z
    .object({ id: identifier, type: z.string().min(1).max(100), data: z.object({ id: identifier }) })
    .passthrough()
    .safeParse(parseJson(body));
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  const payload = parsed.data;
  const paymentId = String(payload.data.id);
  const type = payload.type;
  const queryId = new URL(request.url).searchParams.get("data.id");
  if (queryId !== null && queryId !== paymentId)
    return NextResponse.json({ error: "Payment id mismatch" }, { status: 400 });

  const signatureError = verifyMercadoPagoSignature(request, paymentId);
  if (signatureError) return signatureError;
  if (type !== "payment") return NextResponse.json({ received: true, ignored: true }, { status: 202 });

  const result = await ingestMercadoPagoWebhook({ notificationId: String(payload.id), type, payload });
  switch (result.outcome) {
    case "ALREADY_PROCESSED":
      return NextResponse.json({ received: true, duplicate: true }, { status: 202 });
    case "PERSISTENCE_FAILED":
      return NextResponse.json({ error: "Could not persist webhook" }, { status: 500 });
    case "ENQUEUE_FAILED":
      return NextResponse.json({ error: "Could not enqueue webhook" }, { status: 503 });
    case "ENQUEUED":
      return NextResponse.json({ received: true, duplicate: result.duplicate }, { status: 202 });
  }
}

function verifyMercadoPagoSignature(request: Request, paymentId: string): NextResponse | undefined {
  if (!env.MERCADO_PAGO_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Webhook secret is not configured" }, { status: 503 });
  }

  const signature = request.headers.get("x-signature");
  const requestId = request.headers.get("x-request-id");
  const timestamp = signature?.match(/(?:^|,)\s*ts=([^,]+)/)?.[1]?.trim();
  const receivedHash = signature?.match(/(?:^|,)\s*v1=([^,]+)/)?.[1]?.trim();
  if (!signature || !requestId || !timestamp || !receivedHash) {
    return NextResponse.json({ error: "Invalid webhook signature" }, { status: 401 });
  }

  const manifest = `id:${paymentId.toLowerCase()};request-id:${requestId};ts:${timestamp};`;
  const expectedHash = createHmac("sha256", env.MERCADO_PAGO_WEBHOOK_SECRET).update(manifest).digest("hex");
  const expectedBuffer = Buffer.from(expectedHash, "utf8");
  const receivedBuffer = Buffer.from(receivedHash, "utf8");
  if (expectedBuffer.length !== receivedBuffer.length || !timingSafeEqual(expectedBuffer, receivedBuffer)) {
    return NextResponse.json({ error: "Invalid webhook signature" }, { status: 401 });
  }
  if (!isFreshSignatureTimestamp(timestamp, Date.now())) {
    return NextResponse.json({ error: "Expired webhook signature" }, { status: 401 });
  }
}

/** Mercado Pago sends `ts` in milliseconds; seconds are accepted defensively. */
function isFreshSignatureTimestamp(timestamp: string, nowMs: number): boolean {
  if (!/^\d{1,16}$/.test(timestamp)) return false;
  const value = Number(timestamp);
  const timestampMs = value < 100_000_000_000 ? value * 1000 : value;
  return Math.abs(nowMs - timestampMs) <= SIGNATURE_TOLERANCE_MS;
}

/** Reads the body as text, stopping (null) as soon as it exceeds `maxBytes`, even without Content-Length. */
async function readBoundedBody(request: Request, maxBytes: number): Promise<string | null> {
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) return null;
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > maxBytes) {
      await reader.cancel().catch(() => undefined);
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
