import "server-only";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { env } from "@/config/env";

type IntegrationStatus = {
  name: string;
  description: string;
  configured: boolean;
  missing: string;
};

export function IntegrationReadiness() {
  const integrations: IntegrationStatus[] = [
    {
      name: "Mercado Pago",
      description: "Credencial para homologar o Pix; repasse a lojistas ainda exige integração própria.",
      configured: Boolean(env.MERCADO_PAGO_ACCESS_TOKEN),
      missing: "Token de acesso",
    },
    {
      name: "Webhook de pagamento",
      description: "Confirmação e atualização dos pagamentos recebidos.",
      configured: Boolean(env.MERCADO_PAGO_WEBHOOK_SECRET),
      missing: "Assinatura secreta do webhook",
    },
    {
      name: "Melhor Envio",
      description: "Cotações e etiquetas do serviço de frete.",
      configured: Boolean(env.MELHOR_ENVIO_TOKEN && env.MELHOR_ENVIO_USER_AGENT),
      missing: "Token de acesso e identificação da aplicação",
    },
    {
      name: "Fotos de produtos e lojas",
      description: "Armazenamento e exibição pública das imagens no R2.",
      configured: Boolean(
        env.R2_ACCOUNT_ID &&
        env.R2_ACCESS_KEY_ID &&
        env.R2_SECRET_ACCESS_KEY &&
        env.R2_BUCKET_NAME &&
        env.R2_PUBLIC_URL,
      ),
      missing: "Credenciais, bucket e URL pública do R2",
    },
    {
      name: "E-mails",
      description: "Mensagens transacionais enviadas pela Moto Shop.",
      configured: Boolean(env.RESEND_API_KEY && env.EMAIL_FROM),
      missing: "Chave do Resend e remetente",
    },
    {
      name: "Tarefas automáticas",
      description: "Processamento de eventos pelo Inngest fora do ambiente local.",
      configured: Boolean(env.INNGEST_EVENT_KEY && env.INNGEST_SIGNING_KEY),
      missing: "Chaves do Inngest",
    },
    {
      name: "Proteção contra abuso",
      description: "Infraestrutura para controle de abuso e recursos temporários.",
      configured: Boolean(env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN),
      missing: "URL e token do Upstash",
    },
    {
      name: "Monitoramento",
      description: "Registro de erros no Sentry.",
      configured: Boolean(env.SENTRY_DSN),
      missing: "DSN do Sentry",
    },
  ];

  const configuredCount = integrations.filter((integration) => integration.configured).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Integrações</CardTitle>
        <CardDescription>
          {configuredCount} de {integrations.length} configurações presentes. Este painel verifica apenas se os campos
          foram preenchidos; não confirma que as credenciais funcionam.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2">
        {integrations.map((integration) => (
          <div key={integration.name} className="flex flex-col gap-2 rounded-lg border p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-medium">{integration.name}</h3>
              <Badge variant={integration.configured ? "secondary" : "outline"}>
                {integration.configured ? "Configuração presente" : "Pendente"}
              </Badge>
            </div>
            <p className="text-muted-foreground text-sm">{integration.description}</p>
            {!integration.configured ? <p className="text-sm">Falta configurar: {integration.missing}.</p> : null}
          </div>
        ))}
        <p className="text-muted-foreground text-xs sm:col-span-2">
          O checkout com várias lojas ainda depende de uma modalidade de repasse homologada no Mercado Pago. Após
          alterar o .env.local, reinicie o servidor para atualizar este painel.
        </p>
      </CardContent>
    </Card>
  );
}
