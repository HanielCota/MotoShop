"use client";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";

import { startTransition } from "react";
import { formatPercentFromBps } from "@/lib/format";
import { formatPriceInputFromCents } from "@/modules/products/domain/price-input";
import { updateSellerCommissionAction, type SellerCommissionState } from "../actions/seller-commission-actions";
import { useServerActionState } from "@/shared/forms/server-action-submit";

const initialState: SellerCommissionState = {};

/** "10% (desta loja)" or "padrão do marketplace (5%)"; the default is unknown before it is first saved. */
export function describeSellerCommission(commissionBpsOverride: number | null, defaultCommissionBps: number | null) {
  if (commissionBpsOverride != null) return `${formatPercentFromBps(commissionBpsOverride)} (desta loja)`;
  if (defaultCommissionBps == null) return "padrão do marketplace";

  return `padrão do marketplace (${formatPercentFromBps(defaultCommissionBps)})`;
}

/** One line with the commission in force; the form only opens on "Alterar", so Aprovar and Recusar stand out. */
export function SellerCommissionForm({
  sellerId,
  commissionBpsOverride,
  defaultCommissionBps,
}: {
  sellerId: string;
  commissionBpsOverride: number | null;
  defaultCommissionBps: number | null;
}) {
  const [state, action, pending] = useServerActionState(
    updateSellerCommissionAction.bind(null, sellerId),
    initialState,
  );
  const previous = state.savedValue !== undefined ? state.savedValue : commissionBpsOverride;
  return (
    <details className="group mt-2 text-sm">
      <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
        Comissão: <strong>{describeSellerCommission(previous, defaultCommissionBps)}</strong> ·{" "}
        <span className="text-brand-strong underline underline-offset-4 group-open:hidden">Alterar</span>
        <span className="text-muted-foreground hidden underline underline-offset-4 group-open:inline">Fechar</span>
      </summary>
      <form
        action={action}
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          startTransition(() => action(data));
        }}
        className="mt-3 grid max-w-md gap-2 rounded-md border p-3"
        aria-label="Comissão individual da loja"
      >
        <input
          name="previousCommissionPercent"
          type="hidden"
          value={previous == null ? "" : formatPriceInputFromCents(previous)}
          readOnly
        />
        <label className="flex flex-col gap-1 text-sm font-medium">
          Comissão individual (%)
          <Input
            name="commissionPercent"
            inputMode="decimal"
            placeholder="Usar comissão padrão"
            defaultValue={commissionBpsOverride == null ? "" : formatPriceInputFromCents(commissionBpsOverride)}
          />
        </label>
        <p className="text-muted-foreground text-xs">
          Em branco usa a comissão padrão. Zero define 0%. Aplica-se somente a novos pedidos.
        </p>
        <Button pending={pending} pendingLabel="Salvando…" type="submit">
          Salvar comissão da loja
        </Button>
        <FormMessage error={state.error ?? null} success={state.success ?? null} />
      </form>
    </details>
  );
}
