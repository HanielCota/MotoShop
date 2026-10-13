import type { ReactNode } from "react";

/**
 * Payment methods the checkout accepts through Mercado Pago (`paymentMethodId` in
 * modules/checkout/schemas/checkout.ts): Pix and the credit cards below. Boleto is not offered.
 * Simplified inline marks: no image requests and sharp at any size.
 */
const paymentMethods: { name: string; mark: ReactNode }[] = [
  {
    name: "Pix",
    mark: (
      <>
        <rect width="48" height="30" rx="4" fill="#fff" />
        <path d="M13 15l5-5 5 5-5 5z" fill="#32BCAD" />
        <text x="26" y="19.5" fontFamily="Arial, sans-serif" fontSize="11" fontWeight="700" fill="#32BCAD">
          pix
        </text>
      </>
    ),
  },
  {
    name: "Visa",
    mark: (
      <>
        <rect width="48" height="30" rx="4" fill="#fff" />
        <text
          x="24"
          y="19.5"
          textAnchor="middle"
          fontFamily="Arial, sans-serif"
          fontSize="13"
          fontStyle="italic"
          fontWeight="900"
          fill="#1A1F71"
        >
          VISA
        </text>
      </>
    ),
  },
  {
    name: "Mastercard",
    mark: (
      <>
        <rect width="48" height="30" rx="4" fill="#fff" />
        <circle cx="20" cy="15" r="8" fill="#EB001B" />
        <circle cx="28" cy="15" r="8" fill="#F79E1B" />
        <path d="M24 8.07a8 8 0 0 1 0 13.86a8 8 0 0 1 0-13.86z" fill="#FF5F00" />
      </>
    ),
  },
  {
    name: "Elo",
    mark: (
      <>
        <rect width="48" height="30" rx="4" fill="#111" />
        <circle cx="12" cy="10" r="2.6" fill="#FFCB05" />
        <circle cx="12" cy="15" r="2.6" fill="#00A4E0" />
        <circle cx="12" cy="20" r="2.6" fill="#EF4123" />
        <text x="18" y="19.5" fontFamily="Arial, sans-serif" fontSize="12" fontWeight="700" fill="#fff">
          elo
        </text>
      </>
    ),
  },
  {
    name: "American Express",
    mark: (
      <>
        <rect width="48" height="30" rx="4" fill="#2E77BC" />
        <text
          x="24"
          y="18.5"
          textAnchor="middle"
          fontFamily="Arial, sans-serif"
          fontSize="9"
          fontWeight="900"
          fill="#fff"
        >
          AMEX
        </text>
      </>
    ),
  },
  {
    name: "Hipercard",
    mark: (
      <>
        <rect width="48" height="30" rx="4" fill="#B3131B" />
        <text
          x="24"
          y="18"
          textAnchor="middle"
          fontFamily="Arial, sans-serif"
          fontSize="7.5"
          fontWeight="700"
          fill="#fff"
        >
          Hipercard
        </text>
      </>
    ),
  },
  {
    name: "Diners Club",
    mark: (
      <>
        <rect width="48" height="30" rx="4" fill="#fff" />
        <circle cx="24" cy="15" r="8.5" fill="none" stroke="#0079BE" strokeWidth="2.6" />
        <path d="M24 9.5v11" stroke="#0079BE" strokeWidth="2" />
      </>
    ),
  },
  {
    name: "Cabal",
    mark: (
      <>
        <rect width="48" height="30" rx="4" fill="#0B3D91" />
        <text
          x="24"
          y="18.5"
          textAnchor="middle"
          fontFamily="Arial, sans-serif"
          fontSize="9.5"
          fontWeight="700"
          fill="#fff"
        >
          cabal
        </text>
      </>
    ),
  },
];

export function PaymentMethodIcons() {
  return (
    <ul aria-label="Formas de pagamento aceitas" className="flex flex-wrap gap-2">
      {paymentMethods.map((method) => (
        <li key={method.name}>
          <svg
            viewBox="0 0 48 30"
            width="48"
            height="30"
            role="img"
            aria-label={method.name}
            className="block rounded-[4px] ring-1 ring-white/20"
          >
            <title>{method.name}</title>
            {method.mark}
          </svg>
        </li>
      ))}
    </ul>
  );
}
