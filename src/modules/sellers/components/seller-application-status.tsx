import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { SellerStatus } from "@/generated/prisma/enums";

const copy: Record<
  Exclude<SellerStatus, "APPROVED" | "ACTIVE">,
  { label: string; description: string; guidance: string }
> = {
  PENDING: {
    label: "Em análise",
    description: "Cadastro recebido e aguardando análise pelo Moto Shop.",
    guidance: "Quando a loja for aprovada, você poderá cadastrar produtos e controlar o estoque por variação.",
  },
  REJECTED: {
    label: "Não aprovado",
    description: "O cadastro da loja não foi aprovado.",
    guidance: "Entre em contato com a equipe do Moto Shop para entender os próximos passos.",
  },
  SUSPENDED: {
    label: "Suspensa",
    description: "A operação desta loja está temporariamente suspensa.",
    guidance: "Entre em contato com a equipe do Moto Shop para esclarecer a situação.",
  },
  BLOCKED: {
    label: "Bloqueada",
    description: "O acesso operacional desta loja está bloqueado.",
    guidance: "Entre em contato com a equipe do Moto Shop para esclarecer a situação.",
  },
};

export function SellerApplicationStatus({
  storeName,
  status,
  rejectionReason = null,
}: {
  storeName: string;
  status: Exclude<SellerStatus, "APPROVED" | "ACTIVE">;
  /** Motivo informado pelo Moto Shop ao recusar o cadastro (BUG-005). */
  rejectionReason?: string | null;
}) {
  const content = copy[status];

  return (
    <Card>
      <CardHeader>
        <CardTitle>{storeName}</CardTitle>
        <CardDescription>{content.description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-start gap-3">
        <Badge variant="secondary">Status: {content.label}</Badge>
        {status === "REJECTED" && rejectionReason ? (
          <p className="text-sm">
            <span className="font-medium">Motivo da recusa:</span> {rejectionReason}
          </p>
        ) : null}
        <p className="text-muted-foreground text-sm">{content.guidance}</p>
      </CardContent>
    </Card>
  );
}
