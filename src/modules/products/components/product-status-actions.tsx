"use client";

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
      <button
        type="button"
        onClick={approve}
        disabled={pending}
        className="bg-primary text-primary-foreground hover:bg-primary/80 h-9 rounded-md px-3 text-sm font-medium disabled:opacity-50"
      >
        {pending ? "Salvando..." : "Aprovar"}
      </button>
      <form
        action={async (formData) => {
          const result = await rejectProductAction(productId, formData);
          setMessage(result.error ?? result.success);
        }}
        className="flex flex-1 gap-2"
      >
        <input
          name="reason"
          placeholder="Motivo da rejeição"
          required
          className="border-input bg-background h-9 min-w-0 flex-1 rounded-md border px-3 text-sm"
        />
        <button
          disabled={pending}
          className="border-border hover:bg-muted h-9 rounded-md border px-3 text-sm font-medium disabled:opacity-50"
        >
          Rejeitar
        </button>
      </form>
      {message ? (
        <span className="text-muted-foreground text-xs" role="status">
          {message}
        </span>
      ) : null}
    </div>
  );
}
