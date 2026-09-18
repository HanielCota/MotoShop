"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="pt-BR">
      <body className="bg-background text-foreground flex min-h-screen items-center justify-center p-6">
        <main className="flex max-w-md flex-col gap-3 text-center">
          <h1 className="text-2xl font-semibold">Algo deu errado</h1>
          <p className="text-muted-foreground">A ocorrência foi registrada. Tente novamente em alguns instantes.</p>
        </main>
      </body>
    </html>
  );
}
