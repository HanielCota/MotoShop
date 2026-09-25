"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { submitProductAction } from "@/modules/products/actions/product-actions";

export function ProductSubmissionAction({ productId }: { productId: string }) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ message: string; error: boolean }>();

  function submit() {
    startTransition(async () => {
      const result = await submitProductAction(productId);
      setResult({ message: result.error ?? result.success ?? "", error: Boolean(result.error) });
    });
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <Button type="button" size="sm" disabled={pending} onClick={submit}>
        {pending ? "Enviando..." : "Enviar para aprovação"}
      </Button>
      {result?.message ? (
        <span role={result.error ? "alert" : "status"} className="max-w-52 text-xs">
          {result.message}
        </span>
      ) : null}
    </div>
  );
}
