import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getMarketplaceLimits } from "@/modules/admin/application/marketplace-limits";
import { SellerTeamManager } from "@/modules/sellers/components/seller-team-manager";
import { listPendingSellerInvites } from "@/modules/sellers/queries/member-invites";

type Member = { id: string; role: string; user: { name: string; email: string } };

export async function SellerTeamCard({ sellerId, members }: { sellerId: string; members: Member[] }) {
  const [invites, limits] = await Promise.all([listPendingSellerInvites(sellerId), getMarketplaceLimits()]);

  return (
    <Card id="seller-team" className="scroll-mt-24">
      <CardHeader>
        <CardTitle>Equipe da loja</CardTitle>
        <CardDescription>
          Convide pessoas por e-mail. Elas só entram na equipe depois de aceitar, com a conta desse e-mail confirmada.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <SellerTeamManager
          invites={invites}
          inviteValidForDays={limits.sellerInviteTtlDays}
          members={members.map((member) => ({
            id: member.id,
            name: member.user.name,
            email: member.user.email,
            role: member.role,
          }))}
        />
      </CardContent>
    </Card>
  );
}
