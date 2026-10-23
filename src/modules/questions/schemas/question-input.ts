import { z } from "zod";

import type { FieldProblem } from "@/shared/forms/field-error-focus";
import { firstIssue } from "@/shared/forms/first-issue-message";

export const questionSchema = z.object({
  question: z.string().trim().min(5, "Escreva uma pergunta maior.").max(500),
});
export const answerSchema = z.object({
  answer: z.string().trim().min(2, "Escreva uma resposta.").max(1000, "Use no máximo 1000 caracteres na resposta."),
});

/** Mesma regra no servidor e no navegador (BUG-011). */
export function validateAnswerForm(formData: FormData): FieldProblem | null {
  return firstIssue(answerSchema, { answer: formData.get("answer") }, "Escreva uma resposta.");
}
