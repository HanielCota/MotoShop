"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { leaveSellerStoreAction } from "@/modules/sellers/actions/seller-member-actions";
import { getSellerMemberRoleLabel } from "@/modules/sellers/domain/member-roles";

/** Para quem não é o responsável: mostra o perfil na loja e permite sair dela (M-04). */
export function SellerMembershipCard({ storeName, role }: { storeName: string; role: string }) {
  return (
    <Card id="seller-membership" className="scroll-mt-24">
      <CardHeader>
        <CardTitle>Sua participação</CardTitle>
        <CardDescription>
          Você faz parte da {storeName} como {getSellerMemberRoleLabel(role)}.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <span className="text-muted-foreground">Ao sair, você perde o acesso a esta loja.</span>
        <ConfirmDialog
          trigger={
            <Button type="button" variant="outline" className="text-destructive">
              Sair da loja
            </Button>
          }
          title={`Sair da ${storeName}?`}
          description="Você perde o acesso à Central do Lojista desta loja. Para voltar, é preciso um novo convite."
          confirmLabel="Sair da loja"
          pendingLabel="Saindo..."
          tone="destructive"
          // Em caso de sucesso a action redireciona para /seller; o erro fica no próprio diálogo.
          onConfirm={async () => ({ error: (await leaveSellerStoreAction())?.error ?? null })}
        />
      </CardContent>
    </Card>
  );
}
