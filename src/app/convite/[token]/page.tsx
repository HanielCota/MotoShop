import type { Metadata, Route } from "next";
import Link from "next/link";
import { MailX, UsersRound } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusPage } from "@/components/ui/status-page";
import { requireAuthenticatedUser } from "@/modules/auth/application/authorization";
import { findUsableSellerInvite } from "@/modules/sellers/application/member-invites";
import { SellerInviteResponse } from "@/modules/sellers/components/seller-invite-response";
import { SELLER_INVITE_UNAVAILABLE_MESSAGE } from "@/modules/sellers/domain/member-invite";
import { getSellerMemberRoleLabel } from "@/modules/sellers/domain/member-roles";

// O token está na URL: sem indexação e sem enviar o endereço como Referer para outros sites.
export const metadata: Metadata = {
  title: "Convite para a equipe",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

const tokenPattern = /^[A-Za-z0-9_-]{43}$/;

/** Página de aceite do convite de equipe (M-04); exige a conta do e-mail convidado, verificada. */
export default async function SellerInvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const session = await requireAuthenticatedUser(`/convite/${token}`);
  const invite = tokenPattern.test(token)
    ? await findUsableSellerInvite(token, {
        userId: session.user.id,
        email: session.user.email,
        emailVerified: Boolean(session.user.emailVerified),
      })
    : null;

  if (!invite) {
    return (
      <main className="mx-auto w-full max-w-2xl px-4 sm:px-6">
        <StatusPage
          icon={MailX}
          title="Convite indisponível"
          description={`${SELLER_INVITE_UNAVAILABLE_MESSAGE} Entre com a conta do e-mail convidado, confirmada, ou peça um novo link à loja.`}
          actions={
            <Link className={buttonVariants({ variant: "outline" })} href={"/seller" as Route}>
              Ir para a Central do Lojista
            </Link>
          }
        />
      </main>
    );
  }

  const storeName = invite.seller.store?.name ?? "loja";
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6">
      <Card>
        <CardHeader>
          <span className="bg-moto-brand-surface text-brand-strong mb-2 grid size-10 place-items-center rounded-lg">
            <UsersRound className="size-5" aria-hidden="true" />
          </span>
          <CardTitle as="h1" className="text-xl">
            Convite para a equipe da {storeName}
          </CardTitle>
          <CardDescription>
            Perfil: {getSellerMemberRoleLabel(invite.role)}. Ao aceitar, sua conta passa a acessar a Central do Lojista
            desta loja. Você pode sair quando quiser.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SellerInviteResponse target={{ token }} />
        </CardContent>
      </Card>
    </main>
  );
}
