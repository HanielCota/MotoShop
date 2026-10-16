"use client";

import { useEffect } from "react";
import Link from "next/link";
import * as Sentry from "@sentry/nextjs";
import { CircleX } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import { StatusPage } from "@/components/ui/status-page";

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
    <StatusPage
      role="alert"
      icon={CircleX}
      title="Não foi possível carregar esta área da loja"
      description="Seus dados estão seguros. Tente novamente em instantes; se o problema continuar, volte à visão geral."
      actions={
        <>
          <Button type="button" onClick={() => (retry ?? reset)()}>
            Tentar novamente
          </Button>
          <Link href="/seller" className={buttonVariants({ variant: "outline" })}>
            Ir para a visão geral
          </Link>
        </>
      }
    />
  );
}
