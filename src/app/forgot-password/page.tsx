import type { Metadata } from "next";
import { AuthPageShell } from "@/modules/auth/components/auth-page-shell";
import { PasswordRecoveryForm } from "@/modules/auth/components/password-recovery-form";
import { authEmailConfigured } from "@/modules/auth/infrastructure/auth";

export const metadata: Metadata = {
  title: "Recuperar acesso",
};

export default function ForgotPasswordPage() {
  return (
    <AuthPageShell
      title="Recuperar acesso"
      description={
        authEmailConfigured
          ? "Enviaremos um link para o e-mail cadastrado no Moto Shop."
          : "A redefinição de senha por e-mail ainda não está disponível."
      }
    >
      {authEmailConfigured ? (
        <PasswordRecoveryForm />
      ) : (
        <p className="text-muted-foreground text-sm">
          A recuperação por e-mail estará disponível quando o envio de mensagens do Moto Shop for ativado.
        </p>
      )}
    </AuthPageShell>
  );
}
