"use client";
import { Button } from "@/components/ui/button";

import { useEffect } from "react";
import Link from "next/link";
import * as Sentry from "@sentry/nextjs";

export default function PageError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);
  return (
    <main className="mx-auto flex max-w-lg flex-col gap-4 px-6 py-16" role="alert">
      <h1 className="text-2xl font-semibold">Não foi possível carregar esta página</h1>
      <p>
        Tente novamente em instantes. Se você estava finalizando uma compra, confira seus pedidos antes de repetir o
        pagamento.
      </p>
      <Button type="button" className="rounded-md px-4 py-3" onClick={retry}>
        Tentar novamente
      </Button>
      <Link href="/orders" className="underline">
        Consultar meus pedidos
      </Link>
    </main>
  );
}
