import Link from "next/link";

export default function ForbiddenPage() {
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-20">
      <h1 className="text-3xl font-semibold">Acesso não autorizado</h1>
      <p className="text-muted-foreground">Sua conta não possui permissão para acessar esta área.</p>
      <Link className="underline underline-offset-4" href="/products">
        Voltar para o início
      </Link>
    </main>
  );
}
