"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { Route } from "next";

import { Button } from "@/components/ui/button";

import { addToCartAction } from "../actions/cart-actions";

export function AddToCartButton({ variantId, disabled }: { variantId: string; disabled?: boolean }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string>();

  function handleAdd() {
    setError(undefined);
    startTransition(async () => {
      const result = await addToCartAction(variantId, 1);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.push("/cart" as Route);
    });
  }

  return (
    <div className="mt-3 space-y-2">
      <Button className="w-full" disabled={disabled || isPending} onClick={handleAdd}>
        {isPending ? "Adicionando…" : disabled ? "Indisponível" : "Adicionar ao carrinho"}
      </Button>
      {error ? <p className="text-destructive text-xs">{error}</p> : null}
    </div>
  );
}
