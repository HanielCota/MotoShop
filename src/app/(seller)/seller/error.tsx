"use client";

import { useEffect } from "react";
import Link from "next/link";
import * as Sentry from "@sentry/nextjs";
import { AlertTriangle } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";

type SellerErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
  /** Next 16 também expõe `retry`, que refaz a renderização no servidor. */
  retry?: () => void;
};

export default function SellerError({ error, reset, retry }: SellerErrorProps) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <section role="alert" className="bg-card ring-foreground/10 flex flex-col items-start gap-4 rounded-xl p-6 ring-1">
      <span className="bg-warning-surface text-warning-foreground grid size-11 place-items-center rounded-full">
        <AlertTriangle className="size-5" aria-hidden="true" />
      </span>
      <div className="space-y-1">
        <h1 className="text-2xl">Não foi possível carregar esta área da loja</h1>
        <p className="text-muted-foreground max-w-xl text-sm">
          Seus dados estão seguros. Tente novamente em instantes; se o problema continuar, volte à visão geral.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={() => (retry ?? reset)()}>
          Tentar novamente
        </Button>
        <Link href="/seller" className={buttonVariants({ variant: "outline" })}>
          Ir para a visão geral
        </Link>
      </div>
    </section>
  );
}
