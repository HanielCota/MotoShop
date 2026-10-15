"use client";
import { FormMessage } from "@/components/ui/form-message";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

import { answerProductQuestionAction, type QuestionActionState } from "@/modules/questions/actions/question-actions";
import { validateAnswerForm } from "@/modules/questions/schemas/question-input";
import { useClientValidation } from "@/shared/forms/client-validation";
import { useServerActionState } from "@/shared/forms/server-action-submit";

const initialState: QuestionActionState = {};

export function AnswerQuestionForm({
  questionId,
  currentAnswer,
}: {
  questionId: string;
  currentAnswer?: string | null;
}) {
  const [state, formAction, pending] = useServerActionState(
    answerProductQuestionAction.bind(null, questionId),
    initialState,
  );
  const { clientError, onSubmit } = useClientValidation(validateAnswerForm);

  return (
    <form action={formAction} onSubmit={onSubmit} noValidate className="mt-3 space-y-2">
      <label htmlFor={`answer-${questionId}`} className="block text-sm font-medium">
        Resposta pública
      </label>
      <Textarea
        id={`answer-${questionId}`}
        name="answer"
        required
        minLength={2}
        maxLength={1000}
        rows={3}
        defaultValue={currentAnswer ?? ""}
        placeholder="Escreva uma resposta pública"
      />
      <FormMessage error={clientError ?? state.error ?? null} success={clientError ? null : (state.success ?? null)} />
      <Button type="submit" disabled={pending}>
        {pending ? "Publicando..." : currentAnswer ? "Atualizar resposta" : "Responder"}
      </Button>
    </form>
  );
}
