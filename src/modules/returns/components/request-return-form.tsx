"use client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { FormMessage } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";

import { DesignSelect } from "@/components/ui/design-select";

import { requestReturnAction, type ReturnActionState } from "../actions/return-actions";
import { useClientValidation } from "@/shared/forms/client-validation";
import { useServerActionState } from "@/shared/forms/server-action-submit";

type RequestReturnFormProps = {
  orderNumber: string;
  orderItemId: string;
  maxQuantity: number;
  idempotencyKey: string;
};

const initialState: ReturnActionState = {};

/** Same rule as the server: a whole quantity between 1 and what was bought (DN-03). */
export function validateReturnQuantity(maxQuantity: number) {
  return (formData: FormData) => {
    const quantity = Number(formData.get("quantity"));
    if (Number.isInteger(quantity) && quantity >= 1 && quantity <= maxQuantity) return null;
    return `Informe uma quantidade entre 1 e ${maxQuantity}.`;
  };
}

export function RequestReturnForm({ orderNumber, orderItemId, maxQuantity, idempotencyKey }: RequestReturnFormProps) {
  const [state, action, pending] = useServerActionState(
    async (previousState: ReturnActionState, formData: FormData) => {
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
    },
    initialState,
  );
  const { clientError, onSubmit } = useClientValidation(validateReturnQuantity(maxQuantity));

  return (
    <form
      action={action}
      onSubmit={onSubmit}
      noValidate
      className="bg-surface-sunken grid gap-3 rounded-lg border p-3 sm:grid-cols-2"
    >
      <p className="text-foreground text-sm font-medium sm:col-span-2">Solicitar devolução</p>
      <label className="flex flex-col gap-1 text-xs font-medium">
        Quantidade
        <Input
          size="sm"
          name="quantity"
          type="number"
          min={1}
          max={maxQuantity}
          defaultValue={maxQuantity}
          aria-invalid={clientError ? true : undefined}
        />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium">
        Motivo
        <DesignSelect aria-label="Motivo" size="sm" name="reason" defaultValue="DAMAGED">
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
      <FormMessage
        error={clientError ?? state.error ?? null}
        success={clientError ? null : (state.success ?? null)}
        className="sm:col-span-2"
      />
      <Button type="submit" size="sm" className="sm:col-span-2" disabled={pending || Boolean(state.result)}>
        {pending ? "Enviando..." : state.result ? "Solicitação enviada" : "Solicitar devolução"}
      </Button>
    </form>
  );
}
