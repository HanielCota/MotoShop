"use client";

import Link from "next/link";

import { authClient } from "@/modules/auth/infrastructure/auth-client";

/**
 * Last footer shortcut: "Entrar" for visitors, "Minha conta" once signed in. The footer itself stays
 * a server component; only this link reads the session, like the header account menu.
 */
export function FooterAccountLink({ className }: { className: string }) {
  const { data: session } = authClient.useSession();

  return session?.user ? (
    <Link href="/account/profile" className={className}>
      Minha conta
    </Link>
  ) : (
    <Link href="/login" className={className}>
      Entrar
    </Link>
  );
}
