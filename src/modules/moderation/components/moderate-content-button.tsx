"use client";
import { FormMessage } from "@/components/ui/form-message";
import { Button } from "@/components/ui/button";

import { moderateContentAction, type ModerateContentState } from "../actions/moderate-content-action";
import type { ModerationKind } from "../queries/moderation-queue";
import { useServerActionState } from "@/shared/forms/server-action-submit";

const initialState: ModerateContentState = {};

export function ModerateContentButton({ kind, id, hidden }: { kind: ModerationKind; id: string; hidden: boolean }) {
  const [state, action, pending] = useServerActionState(moderateContentAction, initialState);
  return (
    <form action={action} className="flex flex-col items-start gap-1">
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="hide" value={String(!hidden)} />
      <Button type="submit" variant="outline" disabled={pending} className="rounded-md">
        {pending ? "Aguarde..." : hidden ? "Restaurar" : "Ocultar"}
      </Button>
      <FormMessage variant="inline" error={state.error ?? null} success={state.success ?? null} />
    </form>
  );
}
