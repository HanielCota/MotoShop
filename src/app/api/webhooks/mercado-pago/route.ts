import { createHmac, timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import { env } from "@/config/env";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/database";
import { inngest } from "@/lib/inngest/client";

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!payload) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  const data =
    typeof payload.data === "object" && payload.data !== null ? (payload.data as Record<string, unknown>) : undefined;
  const paymentId = String(data?.id ?? "");
  const type = String(payload.type ?? payload.action ?? "payment");
  const notificationId = String(payload.id ?? `${type}:${paymentId}`);
  if (!paymentId) return NextResponse.json({ error: "Missing payment id" }, { status: 400 });

  const signatureError = verifyMercadoPagoSignature(request, paymentId);
  if (signatureError) return signatureError;

  let webhookEvent;
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
      webhookEvent = await db.webhookEvent.findUnique({
        where: { provider_externalId: { provider: "MERCADO_PAGO", externalId: notificationId } },
      });
    } else {
      return NextResponse.json({ error: "Could not persist webhook" }, { status: 500 });
    }
  }

  if (!webhookEvent) return NextResponse.json({ error: "Could not persist webhook" }, { status: 500 });
  try {
    await inngest.send({ name: "motoshop/payment.webhook.received", data: { webhookEventId: webhookEvent.id } });
  } catch {
    await db.webhookEvent.update({
      where: { id: webhookEvent.id },
      data: { status: "FAILED", error: "Could not enqueue webhook workflow." },
    });
    return NextResponse.json({ error: "Could not enqueue webhook" }, { status: 503 });
  }

  return NextResponse.json({ received: true, duplicate: webhookEvent.status !== "RECEIVED" }, { status: 202 });
}

function verifyMercadoPagoSignature(request: Request, paymentId: string): NextResponse | undefined {
  if (!env.MERCADO_PAGO_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Webhook secret is not configured" }, { status: 503 });
  }

  const signature = request.headers.get("x-signature");
  const requestId = request.headers.get("x-request-id");
  const timestamp = signature?.match(/(?:^|,)ts=([^,]+)/)?.[1];
  const receivedHash = signature?.match(/(?:^|,)v1=([^,]+)/)?.[1];
  if (!signature || !requestId || !timestamp || !receivedHash) {
    return NextResponse.json({ error: "Invalid webhook signature" }, { status: 401 });
  }

  const manifest = `id:${paymentId};request-id:${requestId};ts:${timestamp};`;
  const expectedHash = createHmac("sha256", env.MERCADO_PAGO_WEBHOOK_SECRET).update(manifest).digest("hex");
  const expectedBuffer = Buffer.from(expectedHash, "utf8");
  const receivedBuffer = Buffer.from(receivedHash, "utf8");
  if (expectedBuffer.length !== receivedBuffer.length || !timingSafeEqual(expectedBuffer, receivedBuffer)) {
    return NextResponse.json({ error: "Invalid webhook signature" }, { status: 401 });
  }
}
