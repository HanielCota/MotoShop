"use client";
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
    <form action={formAction} className="mt-3 space-y-2">
      <Textarea
        name="answer"
        required
        minLength={2}
        maxLength={1000}
        rows={3}
        defaultValue={currentAnswer ?? ""}
        placeholder="Escreva uma resposta pública"
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
      />
      {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      {state.success ? <p className="text-sm text-emerald-700">{state.success}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Publicando..." : currentAnswer ? "Atualizar resposta" : "Responder"}
      </button>
    </form>
  );
}
