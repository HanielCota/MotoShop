import { InlineNotice } from "@/components/ui/inline-notice";
import { cn } from "@/lib/utils";

type FormMessageProps = {
  error?: string | null | undefined;
  success?: string | null | undefined;
  /** `box` (default) for form feedback; `inline` is plain text for compact rows (buttons, table cells). */
  variant?: "box" | "inline" | undefined;
  className?: string | undefined;
};

/**
 * Feedback padrão de formulários com server actions. Erros usam `role="alert"`,
 * sucesso usa `role="status"` para serem anunciados por leitores de tela.
 */
export function FormMessage({ error, success, variant = "box", className }: FormMessageProps) {
  if (variant === "inline") return <InlineFormMessage error={error} success={success} className={className} />;

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

function InlineFormMessage({ error, success, className }: Omit<FormMessageProps, "variant">) {
  if (error) {
    return (
      <p role="alert" data-slot="form-message" className={cn("text-destructive text-sm", className)}>
        {error}
      </p>
    );
  }
  if (success) {
    return (
      <p
        role="status"
        aria-live="polite"
        data-slot="form-message"
        className={cn("text-success-foreground text-sm", className)}
      >
        {success}
      </p>
    );
  }
  return null;
}
