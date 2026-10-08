import Link from "next/link";
import { ShieldAlert } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";

export default function ForbiddenPage() {
  return (
    <main className="mx-auto flex max-w-2xl flex-col items-start gap-4 px-4 py-16 sm:py-20">
      <span className="bg-warning-surface text-warning-foreground grid size-12 place-items-center rounded-full">
        <ShieldAlert aria-hidden="true" className="size-6" />
      </span>
      <h1 className="text-3xl sm:text-4xl">Acesso não autorizado</h1>
      <p className="text-muted-foreground">Sua conta não possui permissão para acessar esta área.</p>
      <div className="flex flex-wrap gap-3">
        <Link className={buttonVariants()} href="/products">
          Ir para o catálogo
        </Link>
        <Link className={buttonVariants({ variant: "outline" })} href="/login">
          Entrar com outra conta
        </Link>
      </div>
    </main>
  );
}
