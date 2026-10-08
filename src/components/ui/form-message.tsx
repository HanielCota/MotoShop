import { InlineNotice } from "@/components/ui/inline-notice";

type FormMessageProps = {
  error?: string | null | undefined;
  success?: string | null | undefined;
  className?: string | undefined;
};

/**
 * Feedback padrão de formulários com server actions. Erros usam `role="alert"`,
 * sucesso usa `role="status"` para serem anunciados por leitores de tela.
 */
export function FormMessage({ error, success, className }: FormMessageProps) {
  if (error) {
    return (
      <InlineNotice tone="error" role="alert" className={className}>
        {error}
      </InlineNotice>
    );
  }
  if (success) {
    return (
      <InlineNotice tone="success" role="status" aria-live="polite" className={className}>
        {success}
      </InlineNotice>
    );
  }
  return null;
}
