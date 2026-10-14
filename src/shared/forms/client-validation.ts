"use client";

import { useState, type FormEvent } from "react";

/** Valida o formulário antes do envio; devolve a mensagem do primeiro problema ou `null`. */
export type ClientFormValidator = (formData: FormData) => string | null;

/**
 * BUG-011: valida no navegador com as mesmas regras do servidor. Quando há erro, o envio é
 * cancelado e a mensagem aparece no lugar de sempre; o servidor continua validando tudo.
 */
export function useClientValidation(validate: ClientFormValidator) {
  const [clientError, setClientError] = useState<string | null>(null);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    const message = validate(new FormData(event.currentTarget));
    setClientError(message);
    if (message) event.preventDefault();
  }

  return { clientError, onSubmit, clearClientError: () => setClientError(null) };
}
