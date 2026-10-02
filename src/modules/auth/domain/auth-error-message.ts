const authErrorMessages: Record<string, string> = {
  EMAIL_NOT_VERIFIED: "Confirme seu e-mail antes de entrar. Você pode solicitar outro link abaixo.",
  INVALID_EMAIL_OR_PASSWORD: "E-mail ou senha incorretos.",
  INVALID_CREDENTIALS: "E-mail ou senha incorretos.",
  EMAIL_ALREADY_EXISTS: "Já existe uma conta com este e-mail. Entre ou use outro endereço.",
  USER_ALREADY_EXISTS: "Já existe uma conta com este e-mail. Entre ou use outro endereço.",
};

export function getAuthErrorMessage(code: string | undefined): string {
  if (!code) return "Não foi possível concluir a autenticação. Confira os dados e tente novamente.";
  return authErrorMessages[code] ?? "Não foi possível concluir a autenticação. Confira os dados e tente novamente.";
}
