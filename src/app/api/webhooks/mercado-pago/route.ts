import { createHmac, timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";
import { z } from "zod";

import { env } from "@/config/env";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/database";
import { inngest } from "@/lib/inngest/client";

export async function POST(request: Request) {
  const identifier = z.union([z.string().min(1).max(100), z.number().int().positive()]);
  const parsed = z
    .object({ id: identifier, type: z.string().min(1).max(100), data: z.object({ id: identifier }) })
    .passthrough()
    .safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  const payload = parsed.data;
  const paymentId = String(payload.data.id);
  const type = payload.type;
  const notificationId = String(payload.id);
  const queryId = new URL(request.url).searchParams.get("data.id");
  if (queryId !== null && queryId !== paymentId)
    return NextResponse.json({ error: "Payment id mismatch" }, { status: 400 });

  const signatureError = verifyMercadoPagoSignature(request, paymentId);
  if (signatureError) return signatureError;
  if (type !== "payment") return NextResponse.json({ received: true, ignored: true }, { status: 202 });

  let webhookEvent;
  let duplicate = false;
  try {
    webhookEvent = await db.webhookEvent.create({
      data: {
        provider: "MERCADO_PAGO",
        externalId: notificationId,
        type,
        payload: payload as Prisma.InputJsonValue,
      },
    });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      duplicate = true;
      webhookEvent = await db.webhookEvent.findUnique({
        where: { provider_externalId: { provider: "MERCADO_PAGO", externalId: notificationId } },
      });
    } else {
      return NextResponse.json({ error: "Could not persist webhook" }, { status: 500 });
    }
  }

  if (!webhookEvent) return NextResponse.json({ error: "Could not persist webhook" }, { status: 500 });
  if (webhookEvent.status === "PROCESSED") {
    return NextResponse.json({ received: true, duplicate: true }, { status: 202 });
  }
  try {
    await inngest.send({ name: "motoshop/payment.webhook.received", data: { webhookEventId: webhookEvent.id } });
  } catch {
    await db.webhookEvent.update({
      where: { id: webhookEvent.id },
      data: { status: "FAILED", error: "Could not enqueue webhook workflow." },
    });
    return NextResponse.json({ error: "Could not enqueue webhook" }, { status: 503 });
  }

  return NextResponse.json({ received: true, duplicate }, { status: 202 });
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
}
