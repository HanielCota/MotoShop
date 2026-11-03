"use client";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { FormMessage } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";

import { DesignSelect } from "@/components/ui/design-select";

import { requestReturnAction, type ReturnActionState } from "../actions/return-actions";
import { useClientValidation } from "@/shared/forms/client-validation";
import { useServerActionState } from "@/shared/forms/server-action-submit";

import { discardReturnPhotos, ReturnPhotoPicker, uploadReturnPhotos } from "./return-photo-picker";

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
    // Texto com teclado numérico (DN-07): só dígitos, sem vazio virar 0 nem "1e0" virar 1.
    const text = String(formData.get("quantity") ?? "").trim();
    const quantity = /^\d+$/.test(text) ? Number(text) : Number.NaN;
    if (Number.isInteger(quantity) && quantity >= 1 && quantity <= maxQuantity) return null;
    return { message: `Informe uma quantidade entre 1 e ${maxQuantity}.`, field: "quantity" };
  };
}

type UploadedReturnPhoto = { key: string; fileId: string };

/**
 * Sends the return and, when it is not registered (an error answer or no answer at all), deletes the
 * photos already uploaded, so they do not stay orphaned in ImageKit.
 */
export async function submitReturnWithoutOrphanPhotos(input: {
  target: { orderNumber: string; orderItemId: string };
  photos: readonly UploadedReturnPhoto[];
  submit: () => Promise<ReturnActionState>;
  discard?: typeof discardReturnPhotos;
}): Promise<ReturnActionState> {
  const discard = input.discard ?? discardReturnPhotos;

  try {
    const result = await input.submit();
    if (result.error) await discard(input.target, input.photos);

    return result;
  } catch (error) {
    await discard(input.target, input.photos);
    throw error;
  }
}

export function RequestReturnForm({ orderNumber, orderItemId, maxQuantity, idempotencyKey }: RequestReturnFormProps) {
  const [photos, setPhotos] = useState<File[]>([]);
  const [state, action, pending] = useServerActionState(
    async (previousState: ReturnActionState, formData: FormData): Promise<ReturnActionState> => {
      void previousState;
      const target = { orderNumber, orderItemId };
      const uploaded = await uploadPhotosOrError(target, photos);
      if ("error" in uploaded) return { error: uploaded.error };

      const result = await submitReturnWithoutOrphanPhotos({
        target,
        photos: uploaded.photos,
        submit: async () =>
          requestReturnAction({
            ...target,
            quantity: Number(formData.get("quantity")),
            reason: String(formData.get("reason") ?? ""),
            customerMessage: String(formData.get("customerMessage") ?? "").trim(),
            idempotencyKey,
            photos: uploaded.photos,
          }),
      });
      // Sent: the photos are on the server now, so the local previews go away and free their memory.
      if (result.result != null) setPhotos([]);

      return result;
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
          inputMode="numeric"
          autoComplete="off"
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
      <ReturnPhotoPicker files={photos} onFilesChange={setPhotos} disabled={pending || Boolean(state.result)} />
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

async function uploadPhotosOrError(
  target: { orderNumber: string; orderItemId: string },
  files: readonly File[],
): Promise<{ photos: Awaited<ReturnType<typeof uploadReturnPhotos>> } | { error: string }> {
  try {
    return { photos: await uploadReturnPhotos(target, files) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Não foi possível enviar as fotos." };
  }
}
