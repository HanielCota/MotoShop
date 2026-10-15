"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { FormMessage } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";
import {
  approveProductAction,
  rejectProductAction,
  type ProductActionState,
} from "@/modules/products/actions/product-actions";
import { callServerAction } from "@/shared/forms/server-action-submit";

export function ProductStatusActions({ productId, hasImages = true }: { productId: string; hasImages?: boolean }) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ProductActionState>({});

  function approve() {
    startTransition(async () => {
      setResult(await callServerAction(() => approveProductAction(productId)));
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        {hasImages ? (
          <Button size="sm" type="button" onClick={approve} disabled={pending}>
            {pending ? "Salvando..." : "Aprovar"}
          </Button>
        ) : (
          // Sem foto, a aprovação pede confirmação: o produto entra na loja sem imagem (UX-14).
          <ConfirmDialog
            trigger={
              <Button size="sm" type="button" disabled={pending}>
                Aprovar
              </Button>
            }
            title="Aprovar sem fotos?"
            description="Este produto não tem fotos. Ele aparecerá sem imagem na loja."
            confirmLabel="Aprovar mesmo assim"
            pendingLabel="Salvando..."
            onConfirm={async () => {
              const actionResult = await callServerAction(() => approveProductAction(productId));
              setResult(actionResult);
              return { error: actionResult.error ?? null };
            }}
          />
        )}
        <form
          action={(formData) =>
            startTransition(async () => {
              setResult(await callServerAction(() => rejectProductAction(productId, formData)));
            })
          }
          className="flex flex-1 gap-2"
        >
          <label className="sr-only" htmlFor={`reject-reason-${productId}`}>
            Motivo da recusa
          </label>
          <Input
            id={`reject-reason-${productId}`}
            name="reason"
            placeholder="Motivo da recusa"
            required
            minLength={5}
            maxLength={1000}
            className="min-w-0 flex-1"
          />
          <Button type="submit" variant="outline" size="sm" disabled={pending}>
            Recusar
          </Button>
        </form>
      </div>
      <FormMessage error={result.error ?? null} success={result.success ?? null} />
    </div>
  );
}
