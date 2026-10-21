"use client";

import { Check, Copy, TicketPercent } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";

import type { ProductPageCouponView } from "../domain/product-page-coupon-view";

type CopyStatus = "idle" | "copied" | "failed";

const copyButtonLabels: Readonly<Record<CopyStatus, string>> = {
  idle: "Copiar",
  copied: "Copiado",
  failed: "Copie manualmente",
};

// The button keeps a fixed accessible name, so the result is read out from a separate live region.
function copyResultAnnouncement(status: CopyStatus, code: string): string {
  if (status === "copied") return `Código ${code} copiado.`;

  if (status === "failed") return `Não foi possível copiar o código ${code}. Selecione e copie manualmente.`;

  return "";
}

function CopyCodeButton({ code }: { code: string }) {
  const [status, setStatus] = useState<CopyStatus>("idle");

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setStatus("copied");
    } catch {
      setStatus("failed");
    }
  }

  return (
    <>
      <span role="status" className="sr-only">
        {copyResultAnnouncement(status, code)}
      </span>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={copy}
        aria-label={`Copiar código ${code}`}
        className="h-11 shrink-0 gap-1.5 px-3 sm:h-9"
      >
        {status === "copied" ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
        {copyButtonLabels[status]}
      </Button>
    </>
  );
}

/** Coupons the store chose to show on the product page; renders nothing without coupons. */
export function ProductPageCoupons({ coupons }: { coupons: ProductPageCouponView[] }) {
  if (coupons.length === 0) return null;

  return (
    <section aria-labelledby="product-coupons-title" className="border-border mt-5 rounded-xl border border-dashed p-4">
      <h2
        id="product-coupons-title"
        className="flex items-center gap-2 font-sans text-sm font-semibold tracking-normal"
      >
        <TicketPercent aria-hidden="true" className="text-brand-strong size-4" />
        Cupons desta loja
      </h2>
      {/* Text on the left (it may wrap) and the copy button always on the right, the same for every coupon. */}
      <ul className="divide-border mt-3 flex flex-col divide-y">
        {coupons.map((coupon) => (
          <li
            key={coupon.code}
            data-testid="product-coupon"
            className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 py-3 first:pt-0 last:pb-0"
          >
            <div className="min-w-0">
              <p className="text-sm">
                <span className="bg-moto-brand-surface text-brand-strong rounded px-1.5 py-0.5 font-mono font-bold tracking-wide break-all">
                  {coupon.code}
                </span>{" "}
                <span className="font-semibold">{coupon.discount}</span>
              </p>
              <p className="text-muted-foreground mt-1 text-xs">
                {[coupon.minimumPurchase, coupon.validity].filter(Boolean).join(" · ")}
              </p>
            </div>
            <CopyCodeButton code={coupon.code} />
          </li>
        ))}
      </ul>
      <p className="text-muted-foreground mt-3 text-xs">
        Use o código no checkout. O desconto vale nos itens desta loja.
      </p>
    </section>
  );
}
