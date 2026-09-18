import type { ReactNode } from "react";

export type SendEmailInput = {
  to: string | string[];
  subject: string;
  react: ReactNode;
  replyTo?: string;
};

export type SendEmailResult = { id: string };

export interface EmailProvider {
  send(input: SendEmailInput): Promise<SendEmailResult>;
}
