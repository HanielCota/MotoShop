type GuestOrderConfirmationEmailProps = {
  customerName: string;
  orderNumber: string;
  totalAmountInCents: number;
  orderLink: string;
};

function formatMoneyInCents(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value / 100);
}

/** Sent to guests right after checkout: the only way back to the order from another device. */
export function GuestOrderConfirmationEmail({
  customerName,
  orderNumber,
  totalAmountInCents,
  orderLink,
}: GuestOrderConfirmationEmailProps) {
  return (
    <div style={{ color: "#172033", fontFamily: "Arial, sans-serif", lineHeight: 1.5 }}>
      <h1>Recebemos o seu pedido</h1>
      <p>Olá, {customerName}.</p>
      <p>
        O pedido <strong>{orderNumber}</strong> foi registrado no Moto Shop. Total:{" "}
        <strong>{formatMoneyInCents(totalAmountInCents)}</strong>.
      </p>
      <p>Pelo link abaixo você acompanha o pagamento, as entregas e pode pedir cancelamento ou devolução.</p>
      <p>
        <a
          href={orderLink}
          style={{
            backgroundColor: "#fe6900",
            borderRadius: "6px",
            color: "#171716",
            display: "inline-block",
            fontWeight: 700,
            padding: "12px 20px",
            textDecoration: "none",
          }}
        >
          Acompanhar pedido
        </a>
      </p>
      <p style={{ color: "#5b6170", fontSize: "13px" }}>
        O link é pessoal: quem tiver acesso a ele vê os dados do pedido. Se criar uma conta no Moto Shop com este mesmo
        e-mail, você pode vincular o pedido a ela.
      </p>
    </div>
  );
}
