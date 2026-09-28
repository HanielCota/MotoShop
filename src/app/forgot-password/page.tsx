import { AuthPageShell } from "@/modules/auth/components/auth-page-shell";
import { PasswordRecoveryForm } from "@/modules/auth/components/password-recovery-form";
import { authEmailConfigured } from "@/modules/auth/infrastructure/auth";

export default function ForgotPasswordPage() {
  return (
    <AuthPageShell title="Recuperar acesso" description="Enviaremos um link para o e-mail cadastrado na Moto Shop.">
      {authEmailConfigured ? (
        <PasswordRecoveryForm />
      ) : (
        <p className="text-muted-foreground text-sm">
          A recuperação por e-mail estará disponível quando o envio de mensagens da Moto Shop for ativado.
        </p>
      )}
    </AuthPageShell>
  );
}
