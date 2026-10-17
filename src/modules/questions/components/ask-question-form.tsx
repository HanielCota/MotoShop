"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { Textarea } from "@/components/ui/textarea";
import { askProductQuestionAction, type QuestionActionState } from "@/modules/questions/actions/question-actions";
import { useServerActionState } from "@/shared/forms/server-action-submit";

const initialState: QuestionActionState = {};

export function AskQuestionForm({ productId }: { productId: string }) {
  const [state, formAction, pending] = useServerActionState(
    askProductQuestionAction.bind(null, productId),
    initialState,
  );

  return (
    <Card size="section" render={<form action={formAction} noValidate />} className="space-y-3 sm:p-4">
      <label className="text-foreground block text-sm font-medium" htmlFor="question">
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
        aria-invalid={Boolean(state.error)}
        className="w-full"
      />
      <FormMessage error={state.error ?? null} success={state.success ?? null} />
      <Button pending={pending} pendingLabel="Enviando…" type="submit">
        Enviar pergunta
      </Button>
    </Card>
  );
}
