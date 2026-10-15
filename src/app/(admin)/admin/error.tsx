"use client";

import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import { StatusPage } from "@/components/ui/status-page";

/**
 * Erro dentro do segmento /admin: o layout (barra e navegação) continua renderizado,
 * então o administrador pode tentar de novo ou ir para outra área.
 */
export default function AdminError({
  error,
  reset,
  retry,
}: {
  error: Error & { digest?: string };
  reset: () => void;
  /** Next 16: também recarrega os server components antes de chamar reset(). */
  retry?: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <StatusPage
      role="alert"
      icon={AlertTriangle}
      title="Não foi possível carregar esta área"
      description={
        <>
          Algo deu errado ao buscar os dados. Tente novamente em instantes ou use o menu para abrir outra área.
          {error.digest ? <span className="mt-2 block text-xs">Código do erro: {error.digest}</span> : null}
        </>
      }
      actions={
        <>
          <Button type="button" onClick={() => (retry ?? reset)()}>
            Tentar novamente
          </Button>
          <Link href="/admin" className={buttonVariants({ variant: "outline" })}>
            Voltar à visão geral
          </Link>
        </>
      }
    />
  );
}
