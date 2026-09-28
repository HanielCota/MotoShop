"use client";
import { Button } from "@/components/ui/button";

import { useActionState } from "react";

import {
  generateSellerOrderShipmentAction,
  purchaseSellerOrderShipmentAction,
  refreshSellerOrderTrackingAction,
  type FulfillmentActionState,
} from "../actions/fulfillment-actions";

type ShipmentActionsProps = {
  sellerOrderId: string;
  canPurchase: boolean;
  hasShipment: boolean;
  hasTrackingCode: boolean;
};

const initialState: FulfillmentActionState = {};

export function ShipmentActions({ sellerOrderId, canPurchase, hasShipment, hasTrackingCode }: ShipmentActionsProps) {
  const [purchaseState, purchaseAction, purchasePending] = useActionState(
    async (previousState: FulfillmentActionState, formData: FormData) => {
      void previousState;
      void formData;
      return purchaseSellerOrderShipmentAction({ sellerOrderId });
    },
    initialState,
  );
  const [generateState, generateAction, generatePending] = useActionState(
    async (previousState: FulfillmentActionState, formData: FormData) => {
      void previousState;
      void formData;
      return generateSellerOrderShipmentAction({ sellerOrderId });
    },
    initialState,
  );
  const [trackingState, trackingAction, trackingPending] = useActionState(
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
              size="xs"
              className="rounded-md px-2.5 text-xs"
              disabled={hasShipment || purchasePending}
            >
              {purchasePending ? "Comprando..." : hasShipment ? "Frete comprado" : "Comprar frete"}
            </Button>
          </form>
        ) : null}
        {hasShipment && !hasTrackingCode ? (
          <form action={generateAction}>
            <Button type="submit" size="xs" className="rounded-md px-2.5 text-xs" disabled={generatePending}>
              {generatePending ? "Gerando..." : "Gerar etiqueta"}
            </Button>
          </form>
        ) : null}
        {hasShipment ? (
          <form action={trackingAction}>
            <button
              className="hover:bg-muted h-7 rounded-md px-2.5 text-xs font-medium disabled:opacity-50"
              disabled={trackingPending}
            >
              {trackingPending ? "Atualizando..." : "Atualizar rastreio"}
            </button>
          </form>
        ) : null}
      </div>
      {feedback ? (
        <p className={feedback.isError ? "text-destructive text-xs" : "text-muted-foreground text-xs"} role="status">
          {feedback.message}
        </p>
      ) : null}
    </div>
  );
}
