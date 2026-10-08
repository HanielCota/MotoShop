"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";
import {
  approveProductAction,
  rejectProductAction,
  type ProductActionState,
} from "@/modules/products/actions/product-actions";

export function ProductStatusActions({ productId }: { productId: string }) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ProductActionState>({});

  function approve() {
    startTransition(async () => {
      setResult(await approveProductAction(productId));
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <Button size="sm" type="button" onClick={approve} disabled={pending}>
          {pending ? "Salvando..." : "Aprovar"}
        </Button>
        <form
          action={(formData) =>
            startTransition(async () => {
              setResult(await rejectProductAction(productId, formData));
            })
          }
          className="flex flex-1 gap-2"
        >
          <label className="sr-only" htmlFor={`reject-reason-${productId}`}>
            Motivo da rejeição
          </label>
          <Input
            id={`reject-reason-${productId}`}
            name="reason"
            placeholder="Motivo da rejeição"
            required
            minLength={5}
            maxLength={1000}
            className="min-w-0 flex-1"
          />
          <Button type="submit" variant="outline" size="sm" disabled={pending}>
            Rejeitar
          </Button>
        </form>
      </div>
      <FormMessage error={result.error ?? null} success={result.success ?? null} />
    </div>
  );
}
