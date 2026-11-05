"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { FormMessage } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";
import { NETWORK_ERROR_MESSAGE } from "@/shared/forms/server-action-submit";

import {
  updateMarketplaceLimitsAction,
  type MarketplaceLimitsActionState,
} from "../actions/marketplace-configuration-actions";
import {
  MARKETPLACE_LIMIT_BOUNDS,
  MARKETPLACE_LIMIT_DEFAULTS,
  marketplaceLimitFields,
  type MarketplaceLimitField,
  type StoredMarketplaceLimits,
} from "../domain/marketplace-limits";
import {
  marketplaceLimitLabels,
  marketplaceLimitsSchema,
  type MarketplaceLimitsFormInput,
} from "../schemas/marketplace-limits";

// Field inputs are at most two digits; the server rejects anything longer anyway.
const LIMIT_INPUT_MAX_LENGTH = 2;

/** What each limit changes, after the accepted range. */
const limitEffects = {
  productPhotoLimit: "Quem já tem mais fotos não perde nenhuma.",
  photoMaxSizeInMegabytes: "Vale para produto, logo, banner e devolução.",
  returnPhotoLimit: "",
  lastUnitsThreshold: "O cliente vê na página do produto.",
  lowStockThreshold: "",
  newProductDays: "Com 0, o selo some.",
  sellerInviteTtlDays: "Convites já enviados mantêm a validade.",
} as const satisfies Record<MarketplaceLimitField, string>;

const unitSuffix: Partial<Record<MarketplaceLimitField, string>> = {
  lastUnitsThreshold: " unidades",
  lowStockThreshold: " unidades",
};

function limitHint(field: MarketplaceLimitField): string {
  const bounds = MARKETPLACE_LIMIT_BOUNDS[field];
  const range = `De ${bounds.min} a ${bounds.max}${unitSuffix[field] ?? ""}.`;
  const effect = limitEffects[field];
  return effect === "" ? range : `${range} ${effect}`;
}

/** Limites card: every field may be left blank to keep the value of today, shown as the placeholder. */
export function MarketplaceLimitsForm({ defaultValues }: { defaultValues: MarketplaceLimitsFormInput }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<MarketplaceLimitsActionState>({});
  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<MarketplaceLimitsFormInput, unknown, StoredMarketplaceLimits>({
    resolver: zodResolver(marketplaceLimitsSchema),
    defaultValues,
  });

  // The server validates the typed text again, so it receives the raw fields, not the parsed values.
  const submit = handleSubmit(() => {
    setState({});
    startTransition(async () => {
      const result = await saveMarketplaceLimits(getValues());
      setState(result);
      if (result.success == null) return;

      router.refresh();
    });
  });

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        {marketplaceLimitFields.map((field) => (
          <FormField
            key={field}
            id={`marketplace-limits-${field}`}
            label={marketplaceLimitLabels[field]}
            hint={limitHint(field)}
            error={errors[field]?.message}
          >
            {(control) => (
              <Input
                {...control}
                {...register(field)}
                type="text"
                inputMode="numeric"
                autoComplete="off"
                placeholder={String(MARKETPLACE_LIMIT_DEFAULTS[field])}
                maxLength={LIMIT_INPUT_MAX_LENGTH}
                className="h-9"
              />
            )}
          </FormField>
        ))}
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
        <Button
          pending={pending}
          pendingLabel="Salvando…"
          type="submit"
          size="sm"
          className="self-start px-4 sm:self-auto"
        >
          Salvar limites
        </Button>
      </div>
      <FormMessage error={state.error ?? null} success={state.success ?? null} />
    </form>
  );
}

async function saveMarketplaceLimits(values: MarketplaceLimitsFormInput): Promise<MarketplaceLimitsActionState> {
  try {
    return await updateMarketplaceLimitsAction(values);
  } catch {
    return { error: NETWORK_ERROR_MESSAGE };
  }
}
