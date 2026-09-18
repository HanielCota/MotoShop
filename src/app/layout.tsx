import type { Metadata } from "next";
import { Geist } from "next/font/google";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { env } from "@/config/env";

import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  metadataBase: new URL(env.BETTER_AUTH_URL),
  title: {
    default: "Moto Shop | Peças, Acessórios e Equipamentos para Motocross",
    template: "%s | Moto Shop",
  },
  description:
    "Loja especializada em peças de alta performance, acessórios e equipamentos para motocross e off-road. Guidões, capacetes, escapamentos, pneus e proteções com envio para todo o Brasil.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="pt-BR" className={cn("font-sans", geist.variable)}>
      <body className="min-h-screen bg-[#f8f9fa] text-slate-900 antialiased selection:bg-[#2563eb] selection:text-white">
        {children}
      </body>
    </html>
  );
}
