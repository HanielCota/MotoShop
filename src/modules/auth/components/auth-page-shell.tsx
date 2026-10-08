import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";

export function AuthPageShell({
  children,
  title,
  description,
}: {
  children: ReactNode;
  title?: string;
  description?: string;
}) {
  return (
    <main className="relative flex min-h-[calc(100svh-68px)] items-center justify-center overflow-hidden bg-surface-sunken px-4 py-10 sm:py-16">
      <span className="pointer-events-none absolute top-0 left-0 h-1 w-full bg-moto-brand" aria-hidden="true" />
      <section className="relative w-full max-w-[520px] border border-border bg-card rounded-2xl px-5 py-8 shadow-[0_24px_65px_-50px_rgba(17,17,17,0.48)] sm:px-9 sm:py-10">
        <div className="mb-8 flex flex-col items-center">
          <Link
            href="/"
            aria-label="O Moto Shop, página inicial"
            className="flex h-[62px] w-[190px] items-center justify-center rounded-lg bg-foreground transition-[background-color,transform] duration-150 ease-out hover:bg-foreground/90 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none active:scale-[0.98]"
          >
            <Image
              src="/Banner2-Sem-Fundo.png"
              alt=""
              width={6000}
              height={1000}
              priority
              className="h-auto w-[168px] object-contain"
            />
          </Link>
          <p className="mt-4 text-center text-[0.62rem] font-bold tracking-[0.12em] text-muted-foreground uppercase">
            O Marketplace de quem vive o <span className="text-brand-strong">OFF-ROAD!</span>
          </p>
        </div>
        {title ? (
          <div className="mb-7">
            <h1 className="text-3xl font-bold tracking-tight text-foreground uppercase sm:text-4xl">{title}</h1>
            {description ? <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p> : null}
          </div>
        ) : null}
        {children}
      </section>
    </main>
  );
}
