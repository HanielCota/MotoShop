"use client";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";

import { startTransition, useActionState } from "react";
import { formatPriceInputFromCents } from "@/modules/products/domain/price-input";
import { updateSellerCommissionAction, type SellerCommissionState } from "../actions/seller-commission-actions";

const initialState: SellerCommissionState = {};

export function SellerCommissionForm({
  sellerId,
  commissionBpsOverride,
}: {
  sellerId: string;
  commissionBpsOverride: number | null;
}) {
  const [state, action, pending] = useActionState(updateSellerCommissionAction.bind(null, sellerId), initialState);
  const previous = state.savedValue !== undefined ? state.savedValue : commissionBpsOverride;
  return (
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
          className="border-input bg-background h-10 min-w-0 rounded-md border px-3 text-sm"
        />
      </label>
      <p className="text-muted-foreground text-xs">
        Em branco usa a comissão padrão. Zero define 0%. Aplica-se somente a novos pedidos.
      </p>
      <Button type="submit" disabled={pending} className="rounded-md">
        {pending ? "Salvando..." : "Salvar comissão da loja"}
      </Button>
      <FormMessage error={state.error ?? null} success={state.success ?? null} />
    </form>
  );
}
