"use client";
import { Button } from "@/components/ui/button";

import { DesignCheckbox } from "@/components/ui/design-checkbox";

import { useState } from "react";

import {
  updateNotificationPreferencesAction,
  type NotificationPreferenceActionState,
} from "../actions/notification-preference-actions";
import { useServerActionState } from "@/shared/forms/server-action-submit";

const initialState: NotificationPreferenceActionState = {};

export function NotificationPreferencesForm({ emailOrderUpdatesEnabled }: { emailOrderUpdatesEnabled: boolean }) {
  const [enabled, setEnabled] = useState(emailOrderUpdatesEnabled);
  const [state, action, pending] = useServerActionState(
    async (previousState: NotificationPreferenceActionState, formData: FormData) => {
      const result = await updateNotificationPreferencesAction(previousState, formData);
      if (result.success) setEnabled(formData.get("emailOrderUpdatesEnabled") === "on");
      return result;
    },
    initialState,
  );

  return (
    <form action={action} className="space-y-4">
      <label className="flex items-start gap-3 text-sm">
        <DesignCheckbox
          name="emailOrderUpdatesEnabled"
          checked={enabled}
          onCheckedChange={setEnabled}
          className="mt-1"
        />
        <span>
          <span className="font-medium">Atualizações dos meus pedidos</span>
          <span className="text-muted-foreground mt-1 block">
            Receber e-mails quando um pedido entrar em preparação, for enviado ou for entregue.
          </span>
        </span>
      </label>
      {state.error ? (
        <p className="text-destructive text-sm" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p className="text-success-foreground text-sm" role="status">
          {state.success}
        </p>
      ) : null}
      <Button pending={pending} pendingLabel="Salvando…" type="submit" className="rounded-md px-4">
        Salvar preferências
      </Button>
    </form>
  );
}
