import Image from "next/image";

import { cn } from "@/lib/utils";

/**
 * Payment methods the checkout accepts through Mercado Pago (`paymentMethodId` in
 * modules/checkout/schemas/checkout.ts): Pix and the credit cards below. Boleto is not offered.
 * Official brand marks served from public/, on a white tile so they read on the dark footer: Wikimedia
 * Commons SVGs (checked for scripts) and the Cabal logo from cabal.coop. Pix shows only its symbol and
 * Diners only its circle (viewBox cropped), since the full wordmarks are unreadable at this size.
 */
// width/height: each mark's own aspect ratio, fitted in the tile's 40x20 area, so the browser reserves the
// rendered size and next/image does not warn that CSS changed only one dimension.
type PaymentMethodMark = { name: string; file: string; width: number; height: number };

export const pixPaymentMethod: PaymentMethodMark = { name: "Pix", file: "pix.svg", width: 26, height: 20 };

export const cardPaymentMethods: readonly PaymentMethodMark[] = [
  { name: "Visa", file: "visa.svg", width: 40, height: 13 },
  { name: "Mastercard", file: "mastercard.svg", width: 32, height: 20 },
  { name: "Elo", file: "elo.svg", width: 40, height: 16 },
  { name: "American Express", file: "american-express.svg", width: 20, height: 20 },
  { name: "Hipercard", file: "hipercard.svg", width: 40, height: 18 },
  { name: "Diners Club", file: "diners-club.svg", width: 20, height: 20 },
  { name: "Cabal", file: "cabal.png", width: 40, height: 14 },
];

const paymentMethods = [pixPaymentMethod, ...cardPaymentMethods];

/**
 * One brand mark on its white tile; the ring adapts to a dark (footer) or light (checkout) background.
 * `decorative` when the name is already written next to it, so it is not read twice.
 */
export function PaymentMethodIcon({
  method,
  className,
  decorative = false,
}: {
  method: PaymentMethodMark;
  className?: string;
  decorative?: boolean;
}) {
  return (
    <span
      className={cn(
        "flex h-[30px] w-12 shrink-0 items-center justify-center rounded-[4px] bg-white px-1 ring-1 ring-white/20",
        className,
      )}
    >
      {/* unoptimized: the SVGs are sharp at any size and the Cabal PNG has only 6 KB, so resizing gains nothing. */}
      <Image
        src={`/images/payment-methods/${method.file}`}
        alt={decorative ? "" : method.name}
        width={method.width}
        height={method.height}
        unoptimized
        className="object-contain"
      />
    </span>
  );
}

export function PaymentMethodIcons() {
  return (
    <ul aria-label="Formas de pagamento aceitas" className="flex flex-wrap gap-2">
      {paymentMethods.map((method) => (
        <li key={method.name}>
          <PaymentMethodIcon method={method} />
        </li>
      ))}
    </ul>
  );
}
