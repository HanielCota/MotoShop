"use client";

import { useActionState } from "react";

import {
  updateNotificationPreferencesAction,
  type NotificationPreferenceActionState,
} from "../actions/notification-preference-actions";

const initialState: NotificationPreferenceActionState = {};

export function NotificationPreferencesForm({ emailOrderUpdatesEnabled }: { emailOrderUpdatesEnabled: boolean }) {
  const [state, action, pending] = useActionState(updateNotificationPreferencesAction, initialState);

  return (
    <form action={action} className="space-y-4">
      <label className="flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          name="emailOrderUpdatesEnabled"
          defaultChecked={emailOrderUpdatesEnabled}
          className="mt-1 size-4 rounded border"
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
        <p className="text-sm text-emerald-700" role="status">
          {state.success}
        </p>
      ) : null}
      <button
        className="bg-primary text-primary-foreground hover:bg-primary/80 h-10 rounded-md px-4 text-sm font-medium disabled:opacity-50"
        disabled={pending}
      >
        {pending ? "Salvando..." : "Salvar preferências"}
      </button>
    </form>
  );
}
