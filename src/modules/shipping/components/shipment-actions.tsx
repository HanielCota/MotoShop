"use client";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";

import {
  generateSellerOrderShipmentAction,
  purchaseSellerOrderShipmentAction,
  refreshSellerOrderTrackingAction,
  type FulfillmentActionState,
} from "../actions/fulfillment-actions";
import { useServerActionState } from "@/shared/forms/server-action-submit";

type ShipmentActionsProps = {
  sellerOrderId: string;
  canPurchase: boolean;
  hasShipment: boolean;
  hasTrackingCode: boolean;
  generationState: "IN_PROGRESS" | "OUTCOME_UNKNOWN" | "GENERATED" | null;
};

const initialState: FulfillmentActionState = {};

export function ShipmentActions({
  sellerOrderId,
  canPurchase,
  hasShipment,
  hasTrackingCode,
  generationState,
}: ShipmentActionsProps) {
  const [purchaseState, purchaseAction, purchasePending] = useServerActionState(
    async (previousState: FulfillmentActionState, formData: FormData) => {
      void previousState;
      void formData;
      return purchaseSellerOrderShipmentAction({ sellerOrderId });
    },
    initialState,
  );
  const [generateState, generateAction, generatePending] = useServerActionState(
    async (previousState: FulfillmentActionState, formData: FormData) => {
      void previousState;
      void formData;
      return generateSellerOrderShipmentAction({ sellerOrderId });
    },
    initialState,
  );
  const [trackingState, trackingAction, trackingPending] = useServerActionState(
    async (previousState: FulfillmentActionState, formData: FormData) => {
      void previousState;
      void formData;
      return refreshSellerOrderTrackingAction({ sellerOrderId });
    },
    initialState,
  );
  const feedback = purchaseState.error
    ? { message: purchaseState.error, isError: true }
    : purchaseState.success
      ? { message: purchaseState.success, isError: false }
      : generateState.error
        ? { message: generateState.error, isError: true }
        : generateState.success
          ? { message: generateState.success, isError: false }
          : trackingState.error
            ? { message: trackingState.error, isError: true }
            : trackingState.success
              ? { message: trackingState.success, isError: false }
              : undefined;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {canPurchase ? (
          <form action={purchaseAction}>
            <Button
              type="submit"
              variant="outline"
              size="sm"

              disabled={hasShipment || purchasePending}
            >
              {purchasePending ? "Comprando..." : hasShipment ? "Frete comprado" : "Comprar frete"}
            </Button>
          </form>
        ) : null}
        {hasShipment && !hasTrackingCode && generationState === "GENERATED" ? (
          <span className="text-muted-foreground text-xs">Etiqueta gerada · atualize o rastreio</span>
        ) : hasShipment && !hasTrackingCode && generationState ? (
          <span className="text-muted-foreground text-xs">
            {generationState === "IN_PROGRESS" ? "Geração em andamento…" : "Geração incerta · aguardando conferência"}
          </span>
        ) : hasShipment && !hasTrackingCode ? (
          <form action={generateAction}>
            <Button pending={generatePending} pendingLabel="Gerando…" type="submit" size="sm">
              Gerar etiqueta
            </Button>
          </form>
        ) : null}
        {hasShipment ? (
          <form action={trackingAction}>
            <Button pending={trackingPending} pendingLabel="Atualizando…" type="submit" variant="ghost" size="sm">
              Atualizar rastreio
            </Button>
          </form>
        ) : null}
      </div>
      {feedback ? (
        <FormMessage
          className="text-xs"
          {...(feedback.isError ? { error: feedback.message } : { success: feedback.message })}
        />
      ) : null}
    </div>
  );
}
