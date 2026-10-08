"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { submitProductAction, type ProductActionState } from "@/modules/products/actions/product-actions";

export function ProductSubmissionAction({
  productId,
  redirectTo,
}: {
  productId: string;
  /** Where to go after a successful submission (the edit page stops accepting the product). */
  redirectTo?: Route;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ProductActionState>({});

  function submit() {
    startTransition(async () => {
      const next = await submitProductAction(productId);
      setResult(next);
      if (next.success && redirectTo) router.push(redirectTo);
    });
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <Button type="button" size="sm" disabled={pending} onClick={submit}>
        {pending ? "Enviando..." : "Enviar para aprovação"}
      </Button>
      <FormMessage error={result.error ?? null} success={result.success ?? null} className="max-w-64 p-2 text-xs" />
    </div>
  );
}
