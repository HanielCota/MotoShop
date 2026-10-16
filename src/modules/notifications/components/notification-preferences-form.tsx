"use client";

import { startTransition, useState } from "react";

import { DesignCheckbox } from "@/components/ui/design-checkbox";
import { FormMessage } from "@/components/ui/form-message";
import { useServerActionState } from "@/shared/forms/server-action-submit";

import {
  updateNotificationPreferencesAction,
  type NotificationPreferenceActionState,
} from "../actions/notification-preference-actions";

const initialState: NotificationPreferenceActionState = {};

/** A single on/off preference: it saves as soon as it is checked or unchecked, with no extra button. */
export function NotificationPreferencesForm({ emailOrderUpdatesEnabled }: { emailOrderUpdatesEnabled: boolean }) {
  const [enabled, setEnabled] = useState(emailOrderUpdatesEnabled);
  const [state, action, pending] = useServerActionState(
    async (previousState: NotificationPreferenceActionState, nextEnabled: boolean) => {
      const formData = new FormData();
      if (nextEnabled) formData.set("emailOrderUpdatesEnabled", "on");
      const result = await updateNotificationPreferencesAction(previousState, formData);
      // Failed: the checkbox goes back to what is actually saved.
      if (result.error) setEnabled(!nextEnabled);
      return result;
    },
    initialState,
  );

  function change(nextEnabled: boolean) {
    setEnabled(nextEnabled);
    startTransition(() => action(nextEnabled));
  }

  return (
    <div className="space-y-3">
      <label className="flex items-start gap-3 text-sm">
        <DesignCheckbox
          name="emailOrderUpdatesEnabled"
          checked={enabled}
          onCheckedChange={change}
          disabled={pending}
          className="mt-1"
        />
        <span>
          <span className="font-medium">Atualizações dos meus pedidos</span>
          <span className="text-muted-foreground mt-1 block">
            Receber e-mails quando um pedido entrar em preparação, for enviado ou for entregue.
          </span>
        </span>
      </label>
      <p className="text-muted-foreground text-xs">Salvo automaticamente ao marcar ou desmarcar.</p>
      <FormMessage variant="inline" error={state.error ?? null} success={pending ? null : (state.success ?? null)} />
    </div>
  );
}
