"use client";
import { Button } from "@/components/ui/button";

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
          <Button type="submit" variant="outline" size="sm" disabled={defaultPending} className="rounded-md text-xs">
            {defaultPending ? "Atualizando..." : "Usar como padrão"}
          </Button>
        </form>
      ) : (
        <span className="text-xs font-medium text-emerald-700">Padrão</span>
      )}
      <form action={deleteAction}>
        <Button
          type="submit"
          variant="destructive"
          size="sm"
          disabled={deletePending}
          className="border-destructive/30 rounded-md border text-xs"
        >
          {deletePending ? "Removendo..." : "Remover"}
        </Button>
      </form>
      {defaultState.error ? <p className="text-destructive text-xs">{defaultState.error}</p> : null}
      {deleteState.error ? <p className="text-destructive text-xs">{deleteState.error}</p> : null}
    </div>
  );
}
