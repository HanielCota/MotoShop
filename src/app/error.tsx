"use client";

import { useEffect } from "react";
import Link from "next/link";
import * as Sentry from "@sentry/nextjs";
import { AlertTriangle } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import { StatusPage } from "@/components/ui/status-page";

export default function PageError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <main className="mx-auto w-full max-w-2xl px-4 sm:px-6">
      <StatusPage
        role="alert"
        icon={AlertTriangle}
        title="Não foi possível carregar esta página"
        description="Tente novamente em instantes. Se você estava finalizando uma compra, confira seus pedidos antes de repetir o pagamento."
        actions={
          <>
            <Button type="button" onClick={retry}>
              Tentar novamente
            </Button>
            <Link href="/orders" className={buttonVariants({ variant: "outline" })}>
              Consultar meus pedidos
            </Link>
          </>
        }
      />
    </main>
  );
}
