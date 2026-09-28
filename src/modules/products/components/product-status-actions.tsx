"use client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { useState, useTransition } from "react";

import { approveProductAction, rejectProductAction } from "@/modules/products/actions/product-actions";

export function ProductStatusActions({ productId }: { productId: string }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string>();

  function approve() {
    startTransition(async () => {
      const result = await approveProductAction(productId);
      setMessage(result.error ?? result.success);
    });
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <Button size="sm" type="button" onClick={approve} disabled={pending} className="rounded-md">
        {pending ? "Salvando..." : "Aprovar"}
      </Button>
      <form
        action={async (formData) => {
          const result = await rejectProductAction(productId, formData);
          setMessage(result.error ?? result.success);
        }}
        className="flex flex-1 gap-2"
      >
        <Input
          name="reason"
          placeholder="Motivo da rejeição"
          required
          className="border-input bg-background h-9 min-w-0 flex-1 rounded-md border px-3 text-sm"
        />
        <Button type="submit" variant="outline" size="sm" disabled={pending} className="rounded-md">
          Rejeitar
        </Button>
      </form>
      {message ? (
        <span className="text-muted-foreground text-xs" role="status">
          {message}
        </span>
      ) : null}
    </div>
  );
}
