import { EmailButton, EmailText, EmailTitle } from "./email-layout";

type FulfillmentStatusEmailProps = {
  customerName: string;
  orderNumber: string;
  storeName: string;
  status: "PROCESSING" | "SHIPPED" | "DELIVERED";
  trackingCode: string | null;
  trackingUrl: string | null;
};

const statusCopy = {
  PROCESSING: {
    title: "Pedido em preparação",
    description: "A loja começou a preparar a parte do seu pedido.",
  },
  SHIPPED: {
    title: "Pedido enviado",
    description: "A parte do seu pedido foi postada e já está a caminho.",
  },
  DELIVERED: {
    title: "Pedido entregue",
    description: "A entrega da parte do seu pedido foi confirmada.",
  },
} as const;

export function FulfillmentStatusEmail({
  customerName,
  orderNumber,
  storeName,
  status,
  trackingCode,
  trackingUrl,
}: FulfillmentStatusEmailProps) {
  const copy = statusCopy[status];

  return (
    <>
      <EmailTitle>{copy.title}</EmailTitle>
      <EmailText>Olá, {customerName}.</EmailText>
      <EmailText>
        {copy.description} Loja: <strong>{storeName}</strong>.
      </EmailText>
      <EmailText>Pedido: {orderNumber}</EmailText>
      {trackingCode ? (
        <EmailText>
          <strong>Código de rastreio:</strong> {trackingCode}
        </EmailText>
      ) : null}
      {trackingUrl ? <EmailButton href={trackingUrl}>Acompanhar entrega</EmailButton> : null}
      <EmailText>Você também pode acompanhar todos os detalhes acessando o pedido no Moto Shop.</EmailText>
    </>
  );
}
