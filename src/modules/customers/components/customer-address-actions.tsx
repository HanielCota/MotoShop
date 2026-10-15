"use client";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { FormMessage } from "@/components/ui/form-message";

import { useActionState } from "react";

import {
  deleteCustomerAddressAction,
  setDefaultCustomerAddressAction,
  type CustomerAddressActionState,
} from "../actions/customer-address-actions";

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
  const [defaultState, defaultAction, defaultPending] = useActionState(
    async () => setDefaultCustomerAddressAction(addressId),
    initialState,
  );

  return (
    <div className="flex flex-wrap items-center gap-2">
      {!isDefault ? (
        <form action={defaultAction}>
          <Button type="submit" variant="outline" disabled={defaultPending} className="text-xs">
            {defaultPending ? "Atualizando..." : "Usar como padrão"}
          </Button>
        </form>
      ) : null}
      <ConfirmDialog
        trigger={
          <Button type="button" variant="destructive" className="border-destructive/30 border text-xs">
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
