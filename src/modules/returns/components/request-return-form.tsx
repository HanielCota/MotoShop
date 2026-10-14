"use client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { FormMessage } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";

import { DesignSelect } from "@/components/ui/design-select";

import { useActionState } from "react";

import { requestReturnAction, type ReturnActionState } from "../actions/return-actions";

type RequestReturnFormProps = {
  orderNumber: string;
  orderItemId: string;
  maxQuantity: number;
  idempotencyKey: string;
};

const initialState: ReturnActionState = {};
const inputClassName = "h-9";

export function RequestReturnForm({ orderNumber, orderItemId, maxQuantity, idempotencyKey }: RequestReturnFormProps) {
  const [state, action, pending] = useActionState(async (previousState: ReturnActionState, formData: FormData) => {
    void previousState;
    const input = {
      orderNumber,
      orderItemId,
      quantity: Number(formData.get("quantity")),
      reason: String(formData.get("reason") ?? ""),
      customerMessage: String(formData.get("customerMessage") ?? "").trim(),
      idempotencyKey,
    };
    return requestReturnAction(input);
  }, initialState);

  return (
    <form action={action} className="bg-surface-sunken grid gap-3 rounded-lg border p-3 sm:grid-cols-2">
      <p className="text-foreground text-sm font-medium sm:col-span-2">Solicitar devolução</p>
      <label className="flex flex-col gap-1 text-xs font-medium">
        Quantidade
        <Input
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
        <DesignSelect aria-label="Motivo" className={inputClassName} name="reason" defaultValue="DAMAGED" required>
          <option value="DAMAGED">Produto danificado</option>
          <option value="WRONG_ITEM">Item diferente do pedido</option>
          <option value="NOT_AS_DESCRIBED">Produto diferente do anúncio</option>
          <option value="REGRET">Desistência</option>
          <option value="OTHER">Outro motivo</option>
        </DesignSelect>
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium sm:col-span-2">
        Observação (opcional)
        <Textarea className="h-20 min-h-20" name="customerMessage" maxLength={1000} />
      </label>
      <FormMessage error={state.error ?? null} success={state.success ?? null} className="sm:col-span-2" />
      <Button type="submit" size="sm" className="sm:col-span-2" disabled={pending || Boolean(state.result)}>
        {pending ? "Enviando..." : state.result ? "Solicitação enviada" : "Solicitar devolução"}
      </Button>
    </form>
  );
}
