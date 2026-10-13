/**
 * Lê os campos de texto enviados para devolvê-los ao formulário quando o servidor
 * recusa o envio: o React limpa campos não controlados depois de uma action.
 */
export function readSubmittedValues<Key extends string>(formData: FormData, keys: readonly Key[]): Record<Key, string> {
  const entries = keys.map((key) => {
    const value = formData.get(key);
    return [key, typeof value === "string" ? value : ""] as const;
  });
  return Object.fromEntries(entries) as Record<Key, string>;
}
