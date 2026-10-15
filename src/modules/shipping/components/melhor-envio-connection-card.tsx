import Link from "next/link";
import type { Route } from "next";
import { ArrowUpRight, CheckCircle2, CircleAlert, Truck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { isMelhorEnvioOAuthConfigured } from "@/modules/shipping/infrastructure/melhor-envio-oauth";

const feedback: Record<string, string> = {
  connected: "Conta do Melhor Envio conectada com segurança.",
  authorization_failed: "Não foi possível concluir a autorização. Confira os dados do aplicativo e tente novamente.",
  session_expired: "Sua sessão expirou durante a autorização. Entre novamente e tente outra vez.",
  permission_denied: "Seu usuário não tem permissão para conectar integrações desta loja.",
};

export function MelhorEnvioConnectionCard({
  connected,
  shippingStatus,
}: {
  connected: boolean;
  shippingStatus: string | undefined;
}) {
  const configured = isMelhorEnvioOAuthConfigured();
  const message = shippingStatus ? feedback[shippingStatus] : undefined;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="bg-moto-brand/10 text-brand-strong grid size-11 shrink-0 place-items-center rounded-xl">
              <Truck className="size-5" aria-hidden="true" />
            </span>
            <div>
              <CardTitle>Melhor Envio</CardTitle>
              <CardDescription className="mt-1">
                Conecte a conta da sua loja para calcular fretes e gerar etiquetas.
              </CardDescription>
            </div>
          </div>
          <Badge variant={connected ? "default" : "outline"}>{connected ? "Conectado" : "Não conectado"}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {message ? (
          <p className="flex items-start gap-2 text-sm" role="status">
            {shippingStatus === "connected" ? (
              <CheckCircle2 className="text-success mt-0.5 size-4" aria-hidden="true" />
            ) : (
              <CircleAlert className="text-warning mt-0.5 size-4" aria-hidden="true" />
            )}
            {message}
          </p>
        ) : null}
        <p className="text-muted-foreground text-sm leading-6">
          A conexão permite calcular fretes, comprar e gerar etiquetas com o saldo da sua conta do Melhor Envio e
          acompanhar as entregas. Uma etiqueta só é comprada quando alguém da loja confirma o envio de um pedido.
        </p>
        {configured ? (
          <Link
            href={"/api/shipping/melhor-envio/connect" as Route}
            className="bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:ring-ring inline-flex min-h-10 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            {connected ? "Reconectar conta" : "Conectar Melhor Envio"}
            <ArrowUpRight className="size-4" aria-hidden="true" />
          </Link>
        ) : (
          <p className="rounded-lg border border-dashed px-4 py-3 text-sm">
            A configuração do aplicativo ainda não foi concluída neste ambiente.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
