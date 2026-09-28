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
    <main className="flex min-h-[calc(100svh-68px)] items-center justify-center bg-[#f0f1f2] px-4 py-10 sm:py-16">
      <section className="w-full max-w-[520px] rounded-[22px] border border-[#cfd2d5] bg-white px-5 py-8 shadow-[0_18px_60px_-45px_rgba(17,17,17,0.35)] sm:px-8 sm:py-10">
        <div className="mb-9 flex flex-col items-center">
          <Link
            href="/"
            aria-label="Moto Shop, página inicial"
            className="flex h-[72px] w-[210px] items-center justify-center rounded-2xl bg-[#191918] shadow-sm transition-transform hover:-translate-y-0.5"
          >
            <Image
              src="/Banner2-Sem-Fundo.png"
              alt="Moto Shop"
              width={6000}
              height={1000}
              priority
              className="h-auto w-[168px] object-contain"
            />
          </Link>
          <span className="mt-5 h-1 w-12 rounded-full bg-[#ed5a17]" aria-hidden="true" />
        </div>
        {title ? (
          <div className="mb-7">
            <h1 className="text-2xl font-semibold tracking-tight text-[#1b1a18] sm:text-[28px]">{title}</h1>
            {description ? <p className="mt-2 text-sm leading-6 text-[#626365]">{description}</p> : null}
          </div>
        ) : null}
        {children}
      </section>
    </main>
  );
}
