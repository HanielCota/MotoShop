import "server-only";

import { Resend } from "resend";

import { env } from "@/config/env";
import type { EmailProvider, SendEmailInput, SendEmailResult } from "@/shared/email/email-provider";
import { ApplicationError } from "@/shared/errors/application-error";

export class ResendEmailProvider implements EmailProvider {
  async send(input: SendEmailInput): Promise<SendEmailResult> {
    const config = this.getConfig();
    const resend = new Resend(config.apiKey);
    const { data, error } = await resend.emails.send(
      {
        from: config.from,
        to: input.to,
        subject: input.subject,
        react: input.react,
        ...(input.replyTo ? { replyTo: input.replyTo } : {}),
      },
      input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : undefined,
    );

    if (error || !data) {
      throw new ApplicationError({
        code: "INTERNAL_ERROR",
        message: "Transactional email could not be queued.",
        cause: error,
      });
    }

    return { id: data.id };
  }

  private getConfig() {
    if (!env.RESEND_API_KEY || !env.EMAIL_FROM) {
      throw new ApplicationError({ code: "CONFIGURATION_ERROR", message: "Resend is not configured." });
    }

    return { apiKey: env.RESEND_API_KEY, from: env.EMAIL_FROM };
  }
}
