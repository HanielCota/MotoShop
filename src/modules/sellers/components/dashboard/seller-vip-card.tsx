import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatDate } from "@/lib/format";

type ActiveSubscription = { status: string; endsAt: Date };

export function SellerVipCard({ subscription }: { subscription?: ActiveSubscription | null | undefined }) {
  return (
    <Card id="seller-vip" className="scroll-mt-24">
      <CardHeader>
        <CardTitle>Plano VIP</CardTitle>
        <CardDescription>
          Mais exposição para produtos aprovados, com identificação de conteúdo patrocinado.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {subscription ? (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <StatusBadge domain="subscription" status={subscription.status} label="VIP ativo" />
            <span className="text-muted-foreground">
              Válido até <time dateTime={subscription.endsAt.toISOString()}>{formatDate(subscription.endsAt)}</time> ·
              ativação administrada pelo Moto Shop.
            </span>
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">
            Sua loja ainda não possui VIP ativo. Fale com o Moto Shop para solicitar a ativação.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
