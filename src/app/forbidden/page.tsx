import type { Metadata } from "next";
import Link from "next/link";
import { ShieldAlert } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { StatusPage } from "@/components/ui/status-page";

export const metadata: Metadata = {
  title: "Acesso não autorizado",
  robots: { index: false, follow: false },
};

export default function ForbiddenPage() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 sm:px-6">
      <StatusPage
        icon={ShieldAlert}
        title="Acesso não autorizado"
        description="Sua conta não possui permissão para acessar esta área."
        actions={
          <>
            <Link className={buttonVariants()} href="/products">
              Ir para o catálogo
            </Link>
            <Link className={buttonVariants({ variant: "outline" })} href="/login">
              Entrar com outra conta
            </Link>
          </>
        }
      />
    </main>
  );
}
