"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { getCurrentSession } from "@/modules/auth/application/authorization";
import { claimGuestOrder } from "@/modules/orders/application/claim-guest-order";
import { resolveCustomerOrderIdentity } from "@/modules/orders/application/resolve-customer-order-access";
import { clearGuestOrderCookie, readGuestOrderCookie } from "@/modules/orders/infrastructure/guest-order-cookie";
import { toActionError } from "@/shared/errors/action-error";
import { assertRateLimit } from "@/shared/rate-limit/consume-rate-limit";

const schema = z.object({
  orderNumber: z.string().trim().min(1).max(64),
  accessToken: z.string().trim().min(20).max(200),
});

export type ClaimGuestOrderState = { error?: string };

export async function claimGuestOrderAction(
  _previousState: ClaimGuestOrderState,
  formData: FormData,
): Promise<ClaimGuestOrderState> {
  const session = await getCurrentSession();
  if (!session) return { error: "Entre na sua conta para vincular este pedido." };
  const parsed = schema.safeParse({
    orderNumber: formData.get("orderNumber"),
    // The guest token comes from the order's HttpOnly cookie, never from the form.
    accessToken: (await readGuestOrderCookie()) ?? "",
  });
  if (!parsed.success) return { error: "O link do pedido é inválido." };

  try {
    await assertRateLimit({ key: `claim-order:${session.user.id}`, windowSeconds: 60, max: 5 });
    // The cookie may hold the checkout token or the e-mail link token: both resolve to the order's guest hash.
    const identity = await resolveCustomerOrderIdentity({
      orderNumber: parsed.data.orderNumber,
      accessToken: parsed.data.accessToken,
    });
    if (!identity || !("guestAccessTokenHash" in identity)) return { error: "O link do pedido é inválido." };
    await claimGuestOrder({
      orderNumber: parsed.data.orderNumber,
      guestAccessTokenHash: identity.guestAccessTokenHash,
      userId: session.user.id,
      userEmail: session.user.email,
      userEmailVerified: session.user.emailVerified === true,
    });
    // The claim revoked the guest token; the cookie that carried it is useless now.
    await clearGuestOrderCookie(parsed.data.orderNumber);
    revalidatePath("/orders");
    revalidatePath(`/orders/${parsed.data.orderNumber}`);
  } catch (error) {
    return { error: toActionError(error, "claimGuestOrderAction").message };
  }

  // Outside the try: redirect() works by throwing, and the order page now opens through the account.
  redirect(`/orders/${encodeURIComponent(parsed.data.orderNumber)}`);
}
