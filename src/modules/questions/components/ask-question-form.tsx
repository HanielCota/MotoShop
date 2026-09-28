"use client";
import { Textarea } from "@/components/ui/textarea";

import { useActionState } from "react";

import { askProductQuestionAction, type QuestionActionState } from "@/modules/questions/actions/question-actions";

const initialState: QuestionActionState = {};

export function AskQuestionForm({ productId }: { productId: string }) {
  const [state, formAction, pending] = useActionState(askProductQuestionAction.bind(null, productId), initialState);

  return (
    <form action={formAction} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
      <label className="block text-sm font-medium text-slate-900" htmlFor="question">
        Faça uma pergunta sobre este produto
      </label>
      <Textarea
        id="question"
        name="question"
        required
        minLength={5}
        maxLength={500}
        rows={3}
        placeholder="Ex.: Serve na CRF 250R 2025?"
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
      />
      {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      {state.success ? <p className="text-sm text-emerald-700">{state.success}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Enviando..." : "Enviar pergunta"}
      </button>
    </form>
  );
}
