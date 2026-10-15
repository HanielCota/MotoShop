"use client";

import { Trash2 } from "lucide-react";
import { useOptimistic, useState, useTransition } from "react";

import { FormMessage } from "@/components/ui/form-message";
import { Button } from "@/components/ui/button";
import { QuantityStepper } from "@/components/ui/quantity-stepper";
import { formatMoneyInCents } from "@/lib/format";

import { updateCartItemAction } from "../actions/cart-actions";
import { notifyCartUpdated } from "./cart-events";

const failureMessage = "Não foi possível atualizar o carrinho. Tente novamente.";

/**
 * Quantidade e remoção de um item do carrinho com atualização otimista. Em caso de erro,
 * o valor volta ao do servidor e a mensagem é anunciada (`role="alert"`).
 */
export function CartItemControls({
  cartItemId,
  quantity,
  productName,
  maxQuantity = 99,
  unitPriceInCents,
}: {
  cartItemId: string;
  quantity: number;
  productName?: string | undefined;
  maxQuantity?: number | undefined;
  unitPriceInCents?: number | undefined;
}) {
  const [optimisticQuantity, setOptimisticQuantity] = useOptimistic(quantity);
  const [error, setError] = useState<string>();
  const [isPending, startTransition] = useTransition();
  const max = Math.max(1, Math.min(99, maxQuantity));

  function update(nextQuantity: number) {
    setError(undefined);
    startTransition(async () => {
      setOptimisticQuantity(nextQuantity);
      try {
        const result = await updateCartItemAction(cartItemId, nextQuantity);
        if (result.error) {
          setError(result.error);
          return;
        }
        notifyCartUpdated();
      } catch {
        setError(failureMessage);
      }
    });
  }

  const label = productName ? `Quantidade de ${productName}` : "Quantidade";

  return (
    <div className="flex flex-col items-start gap-2 sm:items-end">
      <div className="flex flex-wrap items-center gap-2">
        <QuantityStepper
          label={label}
          value={optimisticQuantity}
          min={1}
          max={Math.max(max, optimisticQuantity)}
          disabled={isPending && optimisticQuantity === 0}
          onChange={update}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon-lg"
          className="text-muted-foreground hover:text-destructive"
          aria-label={productName ? `Remover ${productName} do carrinho` : "Remover item do carrinho"}
          disabled={isPending}
          onClick={() => update(0)}
        >
          <Trash2 aria-hidden="true" />
        </Button>
      </div>
      {unitPriceInCents !== undefined ? (
        <p className="text-sm font-semibold tabular-nums" aria-live="polite">
          {formatMoneyInCents(unitPriceInCents * optimisticQuantity)}
        </p>
      ) : null}
      {maxQuantity <= 0 ? (
        <p className="text-destructive text-xs font-medium">Sem estoque no momento. Remova o item para finalizar.</p>
      ) : optimisticQuantity >= max && max < 99 ? (
        <p className="text-muted-foreground text-xs">Máximo disponível: {max}</p>
      ) : null}
      <FormMessage variant="inline" error={error ?? null} className="text-xs" />
    </div>
  );
}
