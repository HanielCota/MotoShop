import "server-only";

import { logger } from "@/lib/logger";
import { authEmailConfigured } from "@/modules/auth/infrastructure/auth";
import { sendNotificationEmail } from "@/modules/notifications/application/send-notification-email";
import { EmailButton, EmailNote, EmailText, EmailTitle } from "@/modules/notifications/emails/email-layout";

import { SELLER_INVITE_TTL_DAYS } from "../domain/member-invite";
import { hashInviteToken } from "./member-invites";

/**
 * E-mail do convite de equipe. Uma falha de envio nunca muda a resposta ao lojista (a mesma para
 * e-mails com e sem conta) e o link continua disponível em "Copiar link".
 */
export async function sendSellerInviteEmail(input: {
  inviteId: string;
  to: string;
  storeName: string;
  roleLabel: string;
  url: string;
  token: string;
}): Promise<void> {
  if (!authEmailConfigured) return;

  try {
    await sendNotificationEmail({
      eventKey: `seller.invite:${input.inviteId}:${hashInviteToken(input.token)}`,
      kind: "SELLER_MEMBER_INVITE",
      to: input.to,
      subject: `Convite para a equipe da ${input.storeName} no Moto Shop`,
      react: (
        <>
          <EmailTitle>Convite para a equipe da {input.storeName}</EmailTitle>
          <EmailText>
            Você foi convidado para a Central do Lojista da {input.storeName} no Moto Shop com o perfil{" "}
            {input.roleLabel}. Entre com a conta deste e-mail para aceitar ou recusar.
          </EmailText>
          <EmailButton href={input.url}>Ver convite</EmailButton>
          <EmailNote>
            O link vale por {SELLER_INVITE_TTL_DAYS} dias e não deve ser compartilhado. Se você não esperava este
            convite, ignore esta mensagem.
          </EmailNote>
        </>
      ),
    });
  } catch (error) {
    logger.error({ event: "seller.invite_email.failed", inviteId: input.inviteId, error });
  }
}
