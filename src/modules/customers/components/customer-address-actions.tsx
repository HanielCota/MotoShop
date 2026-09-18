"use client";

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
          <button type="submit" disabled={defaultPending} className="rounded-md border px-3 py-2 text-xs font-medium">
            {defaultPending ? "Atualizando..." : "Usar como padrão"}
          </button>
        </form>
      ) : (
        <span className="text-xs font-medium text-emerald-700">Padrão</span>
      )}
      <form action={deleteAction}>
        <button
          type="submit"
          disabled={deletePending}
          className="text-destructive rounded-md border px-3 py-2 text-xs font-medium"
        >
          {deletePending ? "Removendo..." : "Remover"}
        </button>
      </form>
      {defaultState.error ? <p className="text-destructive text-xs">{defaultState.error}</p> : null}
      {deleteState.error ? <p className="text-destructive text-xs">{deleteState.error}</p> : null}
    </div>
  );
}
