"use client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { adjustInventoryAction } from "@/modules/products/actions/product-actions";

export function InventoryAdjustForm({ variantId }: { variantId: string }) {
  const router = useRouter();
  const [quantityChange, setQuantityChange] = useState("");
  const [message, setMessage] = useState<string>();
  const [pending, startTransition] = useTransition();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      const result = await adjustInventoryAction(variantId, Number(quantityChange));
      setMessage(result.error ?? result.success);
      if (result.success) {
        setQuantityChange("");
        router.refresh();
      }
    });
  }

  return (
    <form onSubmit={submit} className="mt-2 flex flex-wrap items-center gap-2">
      <label className="sr-only" htmlFor={`inventory-${variantId}`}>
        Ajuste de estoque
      </label>
      <Input
        id={`inventory-${variantId}`}
        className="border-input bg-background h-8 w-28 rounded-md border px-2 text-xs"
        type="number"
        step="1"
        value={quantityChange}
        onChange={(event) => setQuantityChange(event.target.value)}
        placeholder="+/- quantidade"
        required
      />
      <Button type="submit" variant="outline" size="compact" className="px-2" disabled={pending}>
        {pending ? "..." : "Ajustar"}
      </Button>
      {message ? (
        <span className="text-muted-foreground text-xs" role="status">
          {message}
        </span>
      ) : null}
    </form>
  );
}
