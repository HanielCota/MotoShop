import type { ClientFormValidator } from "./client-validation";

/**
 * Campo de texto obrigatório validado antes do envio, no lugar do `required` nativo (DN-03): o erro
 * aparece no `FormMessage` do formulário, em português, e o servidor continua validando.
 */
export function requiredTextValidator(name: string, message: string, minLength = 1): ClientFormValidator {
  return (formData) => (String(formData.get(name) ?? "").trim().length >= minLength ? null : message);
}
