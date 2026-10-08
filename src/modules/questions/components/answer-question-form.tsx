"use client";
import { FormMessage } from "@/components/ui/form-message";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

import { useActionState } from "react";

import { answerProductQuestionAction, type QuestionActionState } from "@/modules/questions/actions/question-actions";

const initialState: QuestionActionState = {};

export function AnswerQuestionForm({
  questionId,
  currentAnswer,
}: {
  questionId: string;
  currentAnswer?: string | null;
}) {
  const [state, formAction, pending] = useActionState(answerProductQuestionAction.bind(null, questionId), initialState);

  return (
    <form action={formAction} noValidate className="mt-3 space-y-2">
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
      <FormMessage error={state.error ?? null} success={state.success ?? null} />
      <Button type="submit" disabled={pending}>
        {pending ? "Publicando..." : currentAnswer ? "Atualizar resposta" : "Responder"}
      </Button>
    </form>
  );
}
