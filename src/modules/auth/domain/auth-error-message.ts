const tooManyRequestsMessage = "Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente novamente.";

const authErrorMessages: Record<string, string> = {
  EMAIL_NOT_VERIFIED: "Confirme seu e-mail antes de entrar. Você pode solicitar outro link abaixo.",
  INVALID_EMAIL_OR_PASSWORD: "E-mail ou senha incorretos.",
  INVALID_CREDENTIALS: "E-mail ou senha incorretos.",
  EMAIL_ALREADY_EXISTS: "Já existe uma conta com este e-mail. Entre ou use outro endereço.",
  INVALID_NAME: "Informe um nome entre 2 e 120 caracteres.",
  USER_ALREADY_EXISTS: "Já existe uma conta com este e-mail. Entre ou use outro endereço.",
  TOO_MANY_REQUESTS: tooManyRequestsMessage,
};

const genericAuthErrorMessage = "Não foi possível concluir a autenticação. Confira os dados e tente novamente.";

/** Wrong e-mail or password: the login offers recovery and sign-up without revealing if the account exists. */
export function isInvalidCredentialsError(code: string | undefined, status?: number): boolean {
  if (status === 429 || !code) return false;
  return code === "INVALID_EMAIL_OR_PASSWORD" || code === "INVALID_CREDENTIALS";
}

/** Maps Better Auth errors to Portuguese copy; 429s (per-IP or per-account limits) share one message. */
export function getAuthErrorMessage(code: string | undefined, status?: number): string {
  if (status === 429) return tooManyRequestsMessage;
  if (!code) return genericAuthErrorMessage;
  return authErrorMessages[code] ?? genericAuthErrorMessage;
}
