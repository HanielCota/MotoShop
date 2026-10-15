"use client";

import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";

import {
  joinMarketplaceCouponAction,
  leaveMarketplaceCouponAction,
  type CouponActionState,
} from "../actions/coupon-actions";
import { useServerActionState } from "@/shared/forms/server-action-submit";

const initialState: CouponActionState = {};

export function CampaignParticipationButton({ couponId, joined }: { couponId: string; joined: boolean }) {
  const [state, formAction, pending] = useServerActionState(async () => {
    return joined ? leaveMarketplaceCouponAction(couponId) : joinMarketplaceCouponAction(couponId);
  }, initialState);

  return (
    <form action={formAction} className="flex flex-col items-end gap-2">
      <Button type="submit" variant={joined ? "outline" : "default"} size="sm" disabled={pending}>
        {pending ? "Salvando..." : joined ? "Sair da campanha" : "Entrar na campanha"}
      </Button>
      <FormMessage error={state.error ?? null} success={state.success ?? null} className="p-2 text-xs" />
    </form>
  );
}
