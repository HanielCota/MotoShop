"use client";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { FormMessage } from "@/components/ui/form-message";

import {
  deleteCustomerAddressAction,
  setDefaultCustomerAddressAction,
  type CustomerAddressActionState,
} from "../actions/customer-address-actions";
import { useServerActionState } from "@/shared/forms/server-action-submit";

const initialState: CustomerAddressActionState = {};

export function CustomerAddressActions({
  addressId,
  label,
  isDefault,
}: {
  addressId: string;
  label: string;
  isDefault: boolean;
}) {
  const [defaultState, defaultAction, defaultPending] = useServerActionState(
    async () => setDefaultCustomerAddressAction(addressId),
    initialState,
  );

  return (
    <div className="flex flex-wrap items-center gap-2">
      {!isDefault ? (
        <form action={defaultAction}>
          <Button
            pending={defaultPending}
            pendingLabel="Atualizando…"
            type="submit"
            variant="outline"
            className="text-xs"
          >
            Usar como padrão
          </Button>
        </form>
      ) : null}
      <ConfirmDialog
        trigger={
          <Button type="button" variant="destructive" className="border-destructive/30 border text-xs">
            <Trash2 aria-hidden="true" data-icon="inline-start" />
            Remover
          </Button>
        }
        title="Remover endereço?"
        description={`O endereço “${label}” sai da sua lista. Pedidos já feitos continuam com o endereço de entrega original.`}
        confirmLabel="Remover endereço"
        pendingLabel="Removendo..."
        tone="destructive"
        onConfirm={() => deleteCustomerAddressAction(addressId)}
      />
      <FormMessage error={defaultState.error ?? null} className="w-full text-xs" />
    </div>
  );
}
