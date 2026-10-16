"use client";
import { startTransition, useRef } from "react";

import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import {
  createOwnShippingMethodAction,
  setOwnShippingMethodActiveAction,
  advanceOwnShipmentAction,
  type OwnShippingState,
} from "../actions/own-shipping-actions";
import { validateOwnShippingMethodForm } from "../domain/own-shipping";
import { useClientValidation } from "@/shared/forms/client-validation";
import { useServerActionState } from "@/shared/forms/server-action-submit";

const initial: OwnShippingState = {};
function Feedback({ state, clientError = null }: { state: OwnShippingState; clientError?: string | null }) {
  return (
    <FormMessage error={clientError ?? state.error ?? null} success={clientError ? null : (state.success ?? null)} />
  );
}
export function OwnShippingMethodForm() {
  const [state, action, pending] = useServerActionState(createOwnShippingMethodAction, initial);
  const { clientError, onSubmit } = useClientValidation(validateOwnShippingMethodForm);
  return (
    <form action={action} onSubmit={onSubmit} noValidate className="grid gap-4 sm:grid-cols-2">
      <label className="grid gap-2 sm:col-span-2">
        Nome da entrega
        <Input name="name" required minLength={3} maxLength={80} placeholder="Entrega local" />
      </label>
      <label className="grid gap-2">
        CEP inicial
        <Input
          name="postalCodeStart"
          inputMode="numeric"
          pattern="[0-9]{5}-?[0-9]{3}"
          placeholder="00000-000"
          required
        />
      </label>
      <label className="grid gap-2">
        CEP final
        <Input name="postalCodeEnd" inputMode="numeric" pattern="[0-9]{5}-?[0-9]{3}" placeholder="00000-000" required />
      </label>
      <label className="grid gap-2">
        Preço por pedido da loja (R$)
        <Input name="price" inputMode="decimal" pattern="[0-9]+([,.][0-9]{1,2})?" required placeholder="15,00" />
      </label>
      <label className="grid gap-2">
        Prazo em dias úteis
        <Input name="estimatedDeliveryDays" inputMode="numeric" autoComplete="off" maxLength={3} />
      </label>
      <div className="sm:col-span-2">
        <Feedback state={state} clientError={clientError} />
      </div>
      <Button pending={pending} pendingLabel="Salvando…" type="submit" size="lg" className="px-4">
        Criar modalidade
      </Button>
    </form>
  );
}
export function OwnShippingToggle({ id, active }: { id: string; active: boolean }) {
  const [state, action, pending] = useServerActionState(setOwnShippingMethodActiveAction, initial);
  const formRef = useRef<HTMLFormElement>(null);
  return (
    <form ref={formRef} action={action} className="grid gap-2">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="active" value={String(!active)} />
      {active ? (
        // Desativar tira a modalidade do checkout: pede confirmação (BUG-004).
        <ConfirmDialog
          trigger={
            <Button type="button" size="lg" className="px-4" disabled={pending}>
              {pending ? "Salvando…" : "Desativar"}
            </Button>
          }
          title="Desativar esta modalidade de entrega?"
          description="Ela deixa de aparecer no checkout. Pedidos já feitos não mudam."
          confirmLabel="Desativar"
          tone="destructive"
          onConfirm={() => submitForm(formRef.current, action)}
        />
      ) : (
        <Button type="submit" size="lg" className="px-4" disabled={pending}>
          {pending ? "Salvando…" : "Ativar"}
        </Button>
      )}
      <Feedback state={state} />
    </form>
  );
}

/** Envia o formulário pela action depois da confirmação; o resultado aparece no próprio formulário. */
function submitForm(form: HTMLFormElement | null, action: (formData: FormData) => void) {
  if (!form) return;
  const formData = new FormData(form);
  startTransition(() => action(formData));
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
  const [state, action, pending] = useServerActionState(advanceOwnShipmentAction, initial);
  const formRef = useRef<HTMLFormElement>(null);
  if (!canShip && !canDeliver) return null;
  return (
    <form ref={formRef} action={action} className="grid gap-3">
      <input type="hidden" name="sellerOrderId" value={sellerOrderId} />
      <input type="hidden" name="status" value={canShip ? "SHIPPED" : "DELIVERED"} />
      {canShip && (
        <label className="grid gap-2">
          Código de rastreio (opcional)
          <Input name="trackingCode" maxLength={100} />
        </label>
      )}
      <p className="text-muted-foreground text-sm">
        {canShip ? "Confirme somente após despachar o pedido." : "Confirme somente após a entrega ao destinatário."}
      </p>
      {/* A transição não volta atrás: confirma antes de marcar como enviado ou entregue (BUG-004). */}
      <ConfirmDialog
        trigger={
          <Button type="button" size="lg" className="px-4" disabled={pending}>
            {pending ? "Atualizando…" : canShip ? "Confirmar envio próprio" : "Confirmar entrega"}
          </Button>
        }
        title={canShip ? "Confirmar que o pedido foi despachado?" : "Confirmar que o pedido foi entregue?"}
        description={
          canShip
            ? "O cliente é avisado que o pedido está a caminho. Esta etapa não pode ser desfeita."
            : "O pedido passa a entregue e libera devolução para o cliente. Esta etapa não pode ser desfeita."
        }
        confirmLabel={canShip ? "Confirmar envio" : "Confirmar entrega"}
        onConfirm={() => submitForm(formRef.current, action)}
      />
      <Feedback state={state} />
    </form>
  );
}
