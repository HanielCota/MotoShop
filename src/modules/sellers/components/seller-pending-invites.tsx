import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAuthenticatedUser } from "@/modules/auth/application/authorization";
import { listPendingInvitesForAccount } from "@/modules/sellers/application/member-invites";
import { SellerInviteResponse } from "@/modules/sellers/components/seller-invite-response";
import { getSellerMemberRoleLabel } from "@/modules/sellers/domain/member-roles";

/** Convites pendentes do e-mail verificado da conta, para quem ainda não faz parte de uma loja (M-04). */
export async function SellerPendingInvites() {
  const session = await requireAuthenticatedUser("/seller");
  const invites = await listPendingInvitesForAccount({
    userId: session.user.id,
    email: session.user.email,
    emailVerified: Boolean(session.user.emailVerified),
  });
  if (invites.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Convites para equipes</CardTitle>
        <CardDescription>Aceite para entrar na equipe de uma loja em vez de cadastrar a sua.</CardDescription>
      </CardHeader>
      <CardContent className="divide-border divide-y">
        {invites.map((invite) => (
          <div key={invite.id} className="flex flex-col gap-3 py-3 md:flex-row md:items-center md:justify-between">
            <p className="text-sm">
              <span className="font-medium">{invite.seller.store?.name ?? "Loja"}</span> · perfil{" "}
              {getSellerMemberRoleLabel(invite.role)}
            </p>
            <SellerInviteResponse target={{ inviteId: invite.id }} />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
