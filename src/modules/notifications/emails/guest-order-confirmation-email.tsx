import { EmailButton, EmailNote, EmailText, EmailTitle } from "./email-layout";

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
    <>
      <EmailTitle>Recebemos o seu pedido</EmailTitle>
      <EmailText>Olá, {customerName}.</EmailText>
      <EmailText>
        O pedido <strong>{orderNumber}</strong> foi registrado no Moto Shop. Total:{" "}
        <strong>{formatMoneyInCents(totalAmountInCents)}</strong>.
      </EmailText>
      <EmailText>
        Pelo link abaixo você acompanha o pagamento, as entregas e pode pedir cancelamento ou devolução.
      </EmailText>
      <EmailButton href={orderLink}>Acompanhar pedido</EmailButton>
      <EmailNote>
        O link é pessoal: quem tiver acesso a ele vê os dados do pedido. Se criar uma conta no Moto Shop com este mesmo
        e-mail, você pode vincular o pedido a ela.
      </EmailNote>
    </>
  );
}
