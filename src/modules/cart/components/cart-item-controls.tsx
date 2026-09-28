"use client";
import { Input } from "@/components/ui/input";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";

import { updateCartItemAction } from "../actions/cart-actions";

export function CartItemControls({ cartItemId, quantity }: { cartItemId: string; quantity: number }) {
  const [value, setValue] = useState(String(quantity));
  const [message, setMessage] = useState<string>();
  const [isPending, startTransition] = useTransition();

  function update(nextQuantity: number) {
    setMessage(undefined);
    setValue(String(nextQuantity));
    startTransition(async () => {
      const result = await updateCartItemAction(cartItemId, nextQuantity);
      setMessage(result.error ?? result.success);
    });
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <label className="sr-only" htmlFor={`quantity-${cartItemId}`}>
        Quantidade
      </label>
      <Input
        id={`quantity-${cartItemId}`}
        className="border-input bg-background h-8 w-16 rounded-md border px-2 text-center text-sm"
        type="number"
        min={0}
        max={99}
        value={value}
        disabled={isPending}
        onChange={(event) => setValue(event.target.value)}
        onBlur={() => update(Math.min(99, Math.max(0, Number(value) || 0)))}
      />
      <Button type="button" variant="ghost" size="sm" disabled={isPending} onClick={() => update(0)}>
        Remover
      </Button>
      {message ? <span className="text-muted-foreground text-xs">{message}</span> : null}
    </div>
  );
}
