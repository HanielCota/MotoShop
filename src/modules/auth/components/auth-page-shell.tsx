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
    <main className="relative flex min-h-[calc(100svh-68px)] items-center justify-center overflow-hidden bg-[#eee9df] px-4 py-10 sm:py-16">
      <span className="pointer-events-none absolute top-0 left-0 h-1 w-full bg-[#fe6900]" aria-hidden="true" />
      <section className="relative w-full max-w-[520px] border border-[#d1c9bb] bg-[#fbf9f4] px-5 py-8 shadow-[0_24px_65px_-50px_rgba(17,17,17,0.48)] sm:px-9 sm:py-10">
        <div className="mb-8 flex flex-col items-center">
          <Link
            href="/"
            aria-label="O Moto Shop, página inicial"
            className="flex h-[62px] w-[190px] items-center justify-center bg-[#191918] transition-[background-color,transform] duration-150 ease-out hover:bg-[#292824] active:scale-[0.98]"
          >
            <Image
              src="/Banner2-Sem-Fundo.png"
              alt="O Moto Shop"
              width={6000}
              height={1000}
              priority
              className="h-auto w-[168px] object-contain"
            />
          </Link>
          <p className="mt-4 text-center text-[0.62rem] font-bold tracking-[0.12em] text-[#5f5a50] uppercase">
            O Marketplace de quem vive o <span className="text-[#a63a0b]">OFF-ROAD!</span>
          </p>
        </div>
        {title ? (
          <div className="mb-7">
            <h1 className="text-3xl font-bold tracking-tight text-[#1b1a18] uppercase sm:text-4xl">{title}</h1>
            {description ? <p className="mt-2 text-sm leading-6 text-[#625e56]">{description}</p> : null}
          </div>
        ) : null}
        {children}
      </section>
    </main>
  );
}
