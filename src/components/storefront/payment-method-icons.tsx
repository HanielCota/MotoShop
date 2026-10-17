import Image from "next/image";

/**
 * Payment methods the checkout accepts through Mercado Pago (`paymentMethodId` in
 * modules/checkout/schemas/checkout.ts): Pix and the credit cards below. Boleto is not offered.
 * Official brand marks served from public/, on a white tile so they read on the dark footer: Wikimedia
 * Commons SVGs (checked for scripts) and the Cabal logo from cabal.coop. Pix shows only its symbol and
 * Diners only its circle (viewBox cropped), since the full wordmarks are unreadable at this size.
 */
const paymentMethods = [
  { name: "Pix", file: "pix.svg" },
  { name: "Visa", file: "visa.svg" },
  { name: "Mastercard", file: "mastercard.svg" },
  { name: "Elo", file: "elo.svg" },
  { name: "American Express", file: "american-express.svg" },
  { name: "Hipercard", file: "hipercard.svg" },
  { name: "Diners Club", file: "diners-club.svg" },
  { name: "Cabal", file: "cabal.png" },
] as const;

export function PaymentMethodIcons() {
  return (
    <ul aria-label="Formas de pagamento aceitas" className="flex flex-wrap gap-2">
      {paymentMethods.map((method) => (
        <li
          key={method.name}
          className="flex h-[30px] w-12 items-center justify-center rounded-[4px] bg-white px-1 ring-1 ring-white/20"
        >
          {/* unoptimized: an SVG is already sharp at any size and needs no resizing. */}
          <Image
            src={`/images/payment-methods/${method.file}`}
            alt={method.name}
            width={40}
            height={20}
            unoptimized
            className="max-h-5 w-auto max-w-10 object-contain"
          />
        </li>
      ))}
    </ul>
  );
}
