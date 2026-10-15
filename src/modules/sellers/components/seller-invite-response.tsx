"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import {
  acceptSellerInviteAction,
  declineSellerInviteAction,
  respondToSellerInviteAction,
} from "@/modules/sellers/actions/seller-invite-actions";

type InviteTarget = { token: string } | { inviteId: string };

function respond(target: InviteTarget, decision: "ACCEPT" | "DECLINE") {
  if ("inviteId" in target) return respondToSellerInviteAction(target.inviteId, decision);
  return decision === "ACCEPT" ? acceptSellerInviteAction(target.token) : declineSellerInviteAction(target.token);
}

/** Aceitar ou recusar um convite de equipe; em caso de sucesso a action leva para /seller. */
export function SellerInviteResponse({ target }: { target: InviteTarget }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit(decision: "ACCEPT" | "DECLINE") {
    startTransition(async () => {
      const result = await respond(target, decision);
      setError(result?.error ?? null);
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={() => submit("ACCEPT")} disabled={pending}>
          {pending ? "Enviando..." : "Aceitar convite"}
        </Button>
        <Button type="button" variant="outline" onClick={() => submit("DECLINE")} disabled={pending}>
          Recusar
        </Button>
      </div>
      <FormMessage error={error} />
    </div>
  );
}
