"use client";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";

import { useActionState } from "react";

import {
  deleteCustomerAddressAction,
  setDefaultCustomerAddressAction,
  type CustomerAddressActionState,
} from "../actions/customer-address-actions";

const initialState: CustomerAddressActionState = {};

export function CustomerAddressActions({ addressId, isDefault }: { addressId: string; isDefault: boolean }) {
  const [defaultState, defaultAction, defaultPending] = useActionState(
    async () => setDefaultCustomerAddressAction(addressId),
    initialState,
  );
  const [deleteState, deleteAction, deletePending] = useActionState(
    async () => deleteCustomerAddressAction(addressId),
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
      <form action={deleteAction}>
        <Button
          type="submit"
          variant="destructive"
          disabled={deletePending}
          className="border-destructive/30 border text-xs"
        >
          {deletePending ? "Removendo..." : "Remover"}
        </Button>
      </form>
      <FormMessage error={defaultState.error ?? deleteState.error ?? null} className="w-full text-xs" />
    </div>
  );
}
