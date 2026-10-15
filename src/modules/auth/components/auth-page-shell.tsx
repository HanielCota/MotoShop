import type { ReactNode } from "react";

/** Card shared by login, sign-up and password recovery; the brand lives only in the navigation bar. */
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
