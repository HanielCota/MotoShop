"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";

import { highlightInvalidField, problemField, type FieldProblem } from "./field-error-focus";

/** Valida o formulário antes do envio; devolve o problema encontrado ou `null`. */
export type ClientFormValidator<Problem = string | FieldProblem> = (formData: FormData) => Problem | null;

/** A `FieldProblem` is shown by its message; any other problem shape is returned as is. */
type ShownProblem<Problem> = Problem extends FieldProblem ? string : Problem;

/**
 * BUG-011: valida no navegador com as mesmas regras do servidor. Quando há problema, o envio é
 * cancelado, a mensagem aparece no lugar de sempre e o campo errado pisca e recebe o foco; o
 * servidor continua validando tudo.
 */
export function useClientValidation<Problem = string | FieldProblem>(validate: ClientFormValidator<Problem>) {
  const [problem, setProblem] = useState<Problem | null>(null);
  const [failedAttempt, setFailedAttempt] = useState(0);
  const failedForm = useRef<HTMLFormElement | null>(null);

  // Runs after the error rendered, so fields marked by it are already `aria-invalid`.
  useEffect(() => {
    const form = failedForm.current;
    if (!form) return;
    failedForm.current = null;
    highlightInvalidField(form, problemField(problem));
  }, [failedAttempt, problem]);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    const found = validate(new FormData(event.currentTarget));
    setProblem(found);
    if (found === null) return;

    event.preventDefault();
    failedForm.current = event.currentTarget;
    setFailedAttempt((attempt) => attempt + 1);
  }

  return { clientError: shownProblem(problem), onSubmit, clearClientError: () => setProblem(null) };
}

function shownProblem<Problem>(problem: Problem | null): ShownProblem<Problem> | null {
  if (isFieldProblem(problem)) return problem.message as ShownProblem<Problem>;
  return problem as ShownProblem<Problem> | null;
}

function isFieldProblem(problem: unknown): problem is FieldProblem {
  return typeof problem === "object" && problem !== null && "message" in problem && typeof problem.message === "string";
}
