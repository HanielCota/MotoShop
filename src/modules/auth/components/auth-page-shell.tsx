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
    <main className="bg-surface-sunken relative flex min-h-[calc(100svh-68px)] items-center justify-center overflow-hidden px-4 py-10 sm:py-16">
      <span className="bg-moto-brand pointer-events-none absolute top-0 left-0 h-1 w-full" aria-hidden="true" />
      <section className="border-border bg-card relative w-full max-w-[520px] rounded-2xl border px-5 py-8 shadow-[0_24px_65px_-50px_rgba(17,17,17,0.48)] sm:px-9 sm:py-10">
        <div className="mb-8 flex flex-col items-center">
          <Link
            href="/"
            aria-label="O Moto Shop, página inicial"
            className="bg-foreground hover:bg-foreground/90 focus-visible:ring-ring/50 flex h-[62px] w-[190px] items-center justify-center rounded-lg transition-[background-color,transform] duration-150 ease-out focus-visible:ring-3 focus-visible:outline-none active:scale-[0.98]"
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
          <p className="text-muted-foreground mt-4 text-center text-[0.62rem] font-bold tracking-[0.12em] uppercase">
            O Marketplace de quem vive o <span className="text-brand-strong">OFF-ROAD!</span>
          </p>
        </div>
        {title ? (
          <div className="mb-7">
            <h1 className="text-foreground text-3xl font-bold tracking-tight uppercase sm:text-4xl">{title}</h1>
            {description ? <p className="text-muted-foreground mt-2 text-sm leading-6">{description}</p> : null}
          </div>
        ) : null}
        {children}
      </section>
    </main>
  );
}
