"use client";

import { useState, type FormEvent } from "react";

/** Valida o formulário antes do envio; devolve o problema encontrado ou `null`. */
export type ClientFormValidator<Problem = string> = (formData: FormData) => Problem | null;

/**
 * BUG-011: valida no navegador com as mesmas regras do servidor. Quando há problema, o envio é
 * cancelado e a mensagem aparece no lugar de sempre; o servidor continua validando tudo.
 */
export function useClientValidation<Problem = string>(validate: ClientFormValidator<Problem>) {
  const [clientError, setClientError] = useState<Problem | null>(null);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    const problem = validate(new FormData(event.currentTarget));
    setClientError(problem);
    if (problem !== null) event.preventDefault();
  }

  return { clientError, onSubmit, clearClientError: () => setClientError(null) };
}
