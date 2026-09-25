"use client";
import { useActionState } from "react";
import {
  createOwnShippingMethodAction,
  setOwnShippingMethodActiveAction,
  advanceOwnShipmentAction,
  type OwnShippingState,
} from "../actions/own-shipping-actions";

const initial: OwnShippingState = {};
const inputClass = "h-11 w-full min-w-0 rounded-md border bg-background px-3";
const buttonClass = "min-h-11 rounded-md bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50";
function Feedback({ state }: { state: OwnShippingState }) {
  return (
    <>
      {state.error && (
        <p role="alert" className="text-destructive">
          {state.error}
        </p>
      )}
      {state.success && <p role="status">{state.success}</p>}
    </>
  );
}
export function OwnShippingMethodForm() {
  const [state, action, pending] = useActionState(createOwnShippingMethodAction, initial);
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <label className="grid gap-2 sm:col-span-2">
        Nome da entrega
        <input className={inputClass} name="name" required minLength={3} maxLength={80} placeholder="Entrega local" />
      </label>
      <label className="grid gap-2">
        CEP inicial
        <input
          className={inputClass}
          name="postalCodeStart"
          inputMode="numeric"
          pattern="[0-9]{5}-?[0-9]{3}"
          placeholder="00000-000"
          required
        />
      </label>
      <label className="grid gap-2">
        CEP final
        <input
          className={inputClass}
          name="postalCodeEnd"
          inputMode="numeric"
          pattern="[0-9]{5}-?[0-9]{3}"
          placeholder="00000-000"
          required
        />
      </label>
      <label className="grid gap-2">
        Preço por pedido da loja (R$)
        <input
          className={inputClass}
          name="price"
          inputMode="decimal"
          pattern="[0-9]+([,.][0-9]{1,2})?"
          required
          placeholder="15,00"
        />
      </label>
      <label className="grid gap-2">
        Prazo em dias úteis
        <input className={inputClass} name="estimatedDeliveryDays" type="number" min={1} max={365} required />
      </label>
      <div className="sm:col-span-2">
        <Feedback state={state} />
      </div>
      <button className={buttonClass} disabled={pending}>
        {pending ? "Salvando…" : "Criar modalidade"}
      </button>
    </form>
  );
}
export function OwnShippingToggle({ id, active }: { id: string; active: boolean }) {
  const [state, action, pending] = useActionState(setOwnShippingMethodActiveAction, initial);
  return (
    <form action={action} className="grid gap-2">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="active" value={String(!active)} />
      <button className={buttonClass} disabled={pending}>
        {pending ? "Salvando…" : active ? "Desativar" : "Ativar"}
      </button>
      <Feedback state={state} />
    </form>
  );
}
export function OwnShipmentActions({
  sellerOrderId,
  canShip,
  canDeliver,
}: {
  sellerOrderId: string;
  canShip: boolean;
  canDeliver: boolean;
}) {
  const [state, action, pending] = useActionState(advanceOwnShipmentAction, initial);
  if (!canShip && !canDeliver) return null;
  return (
    <form action={action} className="grid gap-3">
      <input type="hidden" name="sellerOrderId" value={sellerOrderId} />
      <input type="hidden" name="status" value={canShip ? "SHIPPED" : "DELIVERED"} />
      {canShip && (
        <label className="grid gap-2">
          Código de rastreio (opcional)
          <input className={inputClass} name="trackingCode" maxLength={100} />
        </label>
      )}
      <p className="text-muted-foreground text-sm">
        {canShip ? "Confirme somente após despachar o pedido." : "Confirme somente após a entrega ao destinatário."}
      </p>
      <button className={buttonClass} disabled={pending}>
        {pending ? "Atualizando…" : canShip ? "Confirmar envio próprio" : "Confirmar entrega"}
      </button>
      <Feedback state={state} />
    </form>
  );
}
