import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SellerTeamManager } from "@/modules/sellers/components/seller-team-manager";

type Member = { id: string; role: string; user: { name: string; email: string } };

export function SellerTeamCard({ members }: { members: Member[] }) {
  return (
    <Card id="seller-team" className="scroll-mt-24">
      <CardHeader>
        <CardTitle>
          <h2 className="text-lg">Equipe da loja</h2>
        </CardTitle>
        <CardDescription>
          Adicione contas existentes e limite o acesso por função. Convites por e-mail ficam para uma etapa posterior.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <SellerTeamManager
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
