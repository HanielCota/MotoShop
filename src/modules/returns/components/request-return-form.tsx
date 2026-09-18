"use client";

import { useActionState } from "react";

import { requestReturnAction, type ReturnActionState } from "../actions/return-actions";

type RequestReturnFormProps = {
  orderNumber: string;
  orderItemId: string;
  maxQuantity: number;
  idempotencyKey: string;
  accessToken?: string;
};

const initialState: ReturnActionState = {};
const inputClassName =
  "border-input bg-background focus:ring-ring/40 h-9 w-full rounded-md border px-3 text-sm outline-none focus:ring-3";

export function RequestReturnForm({
  orderNumber,
  orderItemId,
  maxQuantity,
  idempotencyKey,
  accessToken,
}: RequestReturnFormProps) {
  const [state, action, pending] = useActionState(
    async (previousState: ReturnActionState, formData: FormData) => {
      void previousState;
      const input = {
        orderNumber,
        orderItemId,
        quantity: Number(formData.get("quantity")),
        reason: String(formData.get("reason") ?? ""),
        customerMessage: String(formData.get("customerMessage") ?? "").trim(),
        idempotencyKey,
        ...(accessToken ? { accessToken } : {}),
      };
      return requestReturnAction(input);
    },
    initialState,
  );

  return (
    <form action={action} className="bg-muted/40 mt-3 grid gap-3 rounded-lg p-3 sm:grid-cols-2">
      <label className="flex flex-col gap-1 text-xs font-medium">
        Quantidade
        <input
          className={inputClassName}
          name="quantity"
          type="number"
          min={1}
          max={maxQuantity}
          defaultValue={maxQuantity}
          required
        />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium">
        Motivo
        <select className={inputClassName} name="reason" defaultValue="DAMAGED" required>
          <option value="DAMAGED">Produto danificado</option>
          <option value="WRONG_ITEM">Item diferente do pedido</option>
          <option value="NOT_AS_DESCRIBED">Produto diferente do anúncio</option>
          <option value="REGRET">Desistência</option>
          <option value="OTHER">Outro motivo</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium sm:col-span-2">
        Observação (opcional)
        <textarea className={`${inputClassName} h-20 py-2`} name="customerMessage" maxLength={1000} />
      </label>
      {state.error ? (
        <p className="text-destructive text-xs sm:col-span-2" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p className="text-sm text-emerald-600 sm:col-span-2" role="status">
          {state.success}
        </p>
      ) : null}
      <button
        className="bg-primary text-primary-foreground hover:bg-primary/80 h-8 rounded-md px-3 text-xs font-medium disabled:opacity-50 sm:col-span-2"
        disabled={pending || Boolean(state.result)}
      >
        {pending ? "Enviando..." : state.result ? "Solicitação enviada" : "Solicitar devolução"}
      </button>
    </form>
  );
}
