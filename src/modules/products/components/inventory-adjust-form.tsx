"use client";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";

import { FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { adjustInventoryAction, type ProductActionState } from "@/modules/products/actions/product-actions";
import {
  parseInventoryAdjustmentInput,
  validateInventoryAdjustment,
} from "@/modules/products/domain/inventory-adjustment-input";
import { callServerAction } from "@/shared/forms/server-action-submit";

export function InventoryAdjustForm({ variantId }: { variantId: string }) {
  const router = useRouter();
  const [quantityChange, setQuantityChange] = useState("");
  const [result, setResult] = useState<ProductActionState>({});
  const [pending, startTransition] = useTransition();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const adjustment = parseInventoryAdjustmentInput(quantityChange);
    const clientError = validateInventoryAdjustment(adjustment);
    if (clientError) {
      setResult({ error: clientError });
      return;
    }
    startTransition(async () => {
      const result = await callServerAction(() => adjustInventoryAction(variantId, adjustment));
      setResult(result);
      if (result.success) {
        setQuantityChange("");
        router.refresh();
      }
    });
  }

  return (
    <form onSubmit={submit} noValidate className="mt-2 flex flex-wrap items-center gap-2">
      <label className="sr-only" htmlFor={`inventory-${variantId}`}>
        Ajuste de estoque
      </label>
      <Input
        id={`inventory-${variantId}`}
        className="h-9 w-32 text-sm"
        type="number"
        step="1"
        value={quantityChange}
        onChange={(event) => setQuantityChange(event.target.value)}
        placeholder="+/- quantidade"
        required
      />
      <Button type="submit" variant="outline" size="sm" disabled={pending}>
        {pending ? "..." : "Ajustar"}
      </Button>
      <FormMessage error={result.error ?? null} success={result.success ?? null} className="basis-full p-2 text-xs" />
    </form>
  );
}
