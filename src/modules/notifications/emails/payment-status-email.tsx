import { EmailItemList, EmailSubtitle, EmailText, EmailTitle } from "./email-layout";

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
    <>
      <EmailTitle>{approved ? "Pagamento confirmado" : "Não foi possível confirmar o pagamento"}</EmailTitle>
      <EmailText>Olá, {customerName}.</EmailText>
      <EmailText>
        {approved
          ? `Seu pedido ${orderNumber} foi confirmado e seguirá para preparação.`
          : `O pagamento do pedido ${orderNumber} não foi aprovado. Confira o método de pagamento e tente novamente se necessário.`}
      </EmailText>
      <EmailText>
        <strong>Total: {formatMoneyInCents(totalAmountInCents)}</strong>
      </EmailText>
      <EmailSubtitle>Itens</EmailSubtitle>
      <EmailItemList items={items} />
      <EmailText>Pedido: {orderNumber}</EmailText>
    </>
  );
}
