type PaymentStatusEmailProps = {
  customerName: string;
  orderNumber: string;
  totalAmountInCents: number;
  status: "APPROVED" | "FAILED" | "CANCELLED";
  items: Array<{ name: string; quantity: number }>;
};

function formatMoneyInCents(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value / 100);
}

export function PaymentStatusEmail({
  customerName,
  orderNumber,
  totalAmountInCents,
  status,
  items,
}: PaymentStatusEmailProps) {
  const approved = status === "APPROVED";

  return (
    <div style={{ color: "#172033", fontFamily: "Arial, sans-serif", lineHeight: 1.5 }}>
      <h1>{approved ? "Pagamento confirmado" : "Não foi possível confirmar o pagamento"}</h1>
      <p>Olá, {customerName}.</p>
      <p>
        {approved
          ? `Seu pedido ${orderNumber} foi confirmado e seguirá para preparação.`
          : `O pagamento do pedido ${orderNumber} não foi aprovado. Confira o método de pagamento e tente novamente se necessário.`}
      </p>
      <p>
        <strong>Total: {formatMoneyInCents(totalAmountInCents)}</strong>
      </p>
      <h2>Itens</h2>
      <ul>
        {items.map((item, index) => (
          <li key={`${item.name}-${index}`}>
            {item.name} · quantidade {item.quantity}
          </li>
        ))}
      </ul>
      <p>Pedido: {orderNumber}</p>
    </div>
  );
}
