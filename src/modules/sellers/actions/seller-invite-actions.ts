"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireAuthenticatedUser } from "@/modules/auth/application/authorization";
import { toActionError } from "@/shared/errors/action-error";

import { acceptSellerMemberInvite, declineSellerMemberInvite } from "../application/member-invites";
import { SELLER_INVITE_UNAVAILABLE_MESSAGE } from "../domain/member-invite";

const inviteTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);

export type SellerInviteResponseState = { error?: string };

function inviteAccount(session: Awaited<ReturnType<typeof requireAuthenticatedUser>>) {
  return { userId: session.user.id, email: session.user.email, emailVerified: Boolean(session.user.emailVerified) };
}

/** Aceite pela pessoa convidada, logada com a conta do e-mail do convite (M-04). */
export async function acceptSellerInviteAction(token: string): Promise<SellerInviteResponseState> {
  const parsedToken = inviteTokenSchema.safeParse(token);
  if (!parsedToken.success) return { error: SELLER_INVITE_UNAVAILABLE_MESSAGE };
  const session = await requireAuthenticatedUser(`/convite/${parsedToken.data}`);

  try {
    const result = await acceptSellerMemberInvite({ token: parsedToken.data }, inviteAccount(session));
    if (!result.ok) return { error: result.error };
  } catch (error) {
    return { error: toActionError(error, "acceptSellerInviteAction").message };
  }

  revalidatePath("/seller", "layout");
  redirect("/seller");
}

export async function declineSellerInviteAction(token: string): Promise<SellerInviteResponseState> {
  const parsedToken = inviteTokenSchema.safeParse(token);
  if (!parsedToken.success) return { error: SELLER_INVITE_UNAVAILABLE_MESSAGE };
  const session = await requireAuthenticatedUser(`/convite/${parsedToken.data}`);

  try {
    const declined = await declineSellerMemberInvite({ token: parsedToken.data }, inviteAccount(session));
    if (!declined) return { error: SELLER_INVITE_UNAVAILABLE_MESSAGE };
  } catch (error) {
    return { error: toActionError(error, "declineSellerInviteAction").message };
  }

  revalidatePath("/seller", "layout");
  redirect("/seller");
}

const inviteIdSchema = z.string().cuid();

/** Mesma resposta pela lista de convites da Central (sem link), para quem ainda não tem loja. */
export async function respondToSellerInviteAction(
  inviteId: string,
  decision: "ACCEPT" | "DECLINE",
): Promise<SellerInviteResponseState> {
  const session = await requireAuthenticatedUser("/seller");
  const parsedInviteId = inviteIdSchema.safeParse(inviteId);
  if (!parsedInviteId.success) return { error: SELLER_INVITE_UNAVAILABLE_MESSAGE };
  if (decision !== "ACCEPT" && decision !== "DECLINE") return { error: SELLER_INVITE_UNAVAILABLE_MESSAGE };

  try {
    const lookup = { inviteId: parsedInviteId.data };
    if (decision === "DECLINE") {
      const declined = await declineSellerMemberInvite(lookup, inviteAccount(session));
      if (!declined) return { error: SELLER_INVITE_UNAVAILABLE_MESSAGE };
    }
    if (decision === "ACCEPT") {
      const result = await acceptSellerMemberInvite(lookup, inviteAccount(session));
      if (!result.ok) return { error: result.error };
    }
  } catch (error) {
    return { error: toActionError(error, "respondToSellerInviteAction").message };
  }

  revalidatePath("/seller", "layout");
  redirect("/seller");
}
