import "server-only";

import { db } from "@/lib/database";

import { getSellerInviteDaysLeft } from "../domain/member-invite";

/** Convites pendentes da própria loja; sempre filtrados pelo `sellerId`. */
export async function listPendingSellerInvites(sellerId: string, now = new Date()) {
  const invites = await db.sellerMemberInvite.findMany({
    where: { sellerId, status: "PENDING", expiresAt: { gt: now } },
    select: { id: true, email: true, role: true, expiresAt: true },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return invites.map((invite) => ({
    id: invite.id,
    email: invite.email,
    role: invite.role,
    daysLeft: getSellerInviteDaysLeft(invite.expiresAt, now),
  }));
}
