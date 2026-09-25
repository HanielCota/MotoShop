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
    <div style={{ color: "#172033", fontFamily: "Arial, sans-serif", lineHeight: 1.5 }}>
      <h1>{copy.title}</h1>
      <p>Olá, {customerName}.</p>
      <p>
        {copy.description} Seller: <strong>{storeName}</strong>.
      </p>
      <p>Pedido: {orderNumber}</p>
      {trackingCode ? (
        <p>
          <strong>Código de rastreio:</strong> {trackingCode}
        </p>
      ) : null}
      {trackingUrl ? (
        <p>
          <a href={trackingUrl}>Acompanhar entrega</a>
        </p>
      ) : null}
      <p>Você também pode acompanhar todos os detalhes acessando o pedido na Moto Shop.</p>
    </div>
  );
}
