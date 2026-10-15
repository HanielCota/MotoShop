"use client";

import { Dialog } from "@base-ui/react/dialog";
import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { DesignRadio, DesignRadioGroup } from "@/components/ui/design-radio";
import { DesignSelect } from "@/components/ui/design-select";
import { FormMessage } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  getManualAdjustmentChange,
  isManualAdjustmentKind,
  MANUAL_ADJUSTMENT_NOTE_MAX_LENGTH,
  parseManualAdjustmentQuantity,
  validateManualAdjustment,
  type ManualAdjustmentKind,
} from "@/modules/inventory/domain/manual-adjustment";
import { adjustInventoryAction } from "@/modules/products/actions/product-actions";

export type AdjustableVariant = { id: string; title: string; sku: string; availableQuantity: number };

const kindOptions: readonly { value: ManualAdjustmentKind; label: string; quantityLabel: string }[] = [
  { value: "IN", label: "Chegou mercadoria (entrada)", quantityLabel: "Quantidade que chegou" },
  { value: "OUT", label: "Saiu sem venda: perda, avaria ou uso (saída)", quantityLabel: "Quantidade que saiu" },
  { value: "CORRECTION", label: "Contei e o número está errado (correção)", quantityLabel: "Quantidade contada" },
];

function formatUnits(quantity: number) {
  return `${quantity} ${quantity === 1 ? "unidade" : "unidades"}`;
}

/** Um ajuste por vez, com prévia do novo saldo antes de salvar (UX-10). */
export function InventoryAdjustDialog({
  productName,
  variants,
}: {
  productName: string;
  variants: readonly AdjustableVariant[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [variantId, setVariantId] = useState(variants[0]?.id ?? "");
  const [kind, setKind] = useState<ManualAdjustmentKind>("IN");
  const [quantityText, setQuantityText] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const quantityId = useId();
  const noteId = useId();

  const variant = variants.find((item) => item.id === variantId) ?? variants[0];
  if (!variant) return null;

  const kindOption = kindOptions.find((option) => option.value === kind) ?? kindOptions[0];
  const quantity = parseManualAdjustmentQuantity(quantityText);
  const nextQuantity = Number.isNaN(quantity)
    ? null
    : variant.availableQuantity + getManualAdjustmentChange({ kind, quantity }, variant.availableQuantity);

  function changeOpen(nextOpen: boolean) {
    if (pending) return;

    setOpen(nextOpen);
    setError(null);
    if (nextOpen) setSuccess(null);
  }

  function save() {
    const adjustment = { kind, quantity, note: note.trim() || undefined };
    const clientError = validateManualAdjustment(adjustment);
    if (clientError) {
      setError(clientError);
      return;
    }
    if (!variant) return;

    const targetId = variant.id;
    startTransition(async () => {
      const result = await adjustInventoryAction(targetId, adjustment);
      if (result.error) {
        setError(result.error);
        return;
      }

      setOpen(false);
      setQuantityText("");
      setNote("");
      setSuccess(result.success ?? "Estoque atualizado.");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <Dialog.Root open={open} onOpenChange={changeOpen}>
        <Dialog.Trigger render={<Button type="button" variant="outline" size="sm" />}>Ajustar estoque</Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/55" />
          <Dialog.Popup
            aria-busy={pending}
            className="bg-background text-foreground fixed top-1/2 left-1/2 z-50 max-h-[calc(100dvh-2rem)] w-[min(92vw,30rem)] -translate-x-1/2 -translate-y-1/2 space-y-4 overflow-y-auto rounded-xl border p-5 shadow-xl"
          >
            <div className="space-y-1">
              <Dialog.Title className="text-lg font-semibold">Ajustar estoque</Dialog.Title>
              <Dialog.Description className="text-muted-foreground text-sm">{productName}</Dialog.Description>
            </div>

            {variants.length > 1 ? (
              <label className="flex flex-col gap-2 text-sm font-medium">
                Variação
                <DesignSelect
                  aria-label="Variação"
                  value={variant.id}
                  onValueChange={(value) => setVariantId(String(value))}
                  disabled={pending}
                >
                  {variants.map((item) => (
                    <option key={item.id} value={item.id}>
                      {`${item.title} (${formatUnits(item.availableQuantity)}) · ${item.sku}`}
                    </option>
                  ))}
                </DesignSelect>
              </label>
            ) : (
              <p className="text-sm">
                {variant.title} · SKU {variant.sku}
              </p>
            )}

            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">O que aconteceu?</legend>
              <DesignRadioGroup
                label="O que aconteceu?"
                value={kind}
                onValueChange={(value) => {
                  if (isManualAdjustmentKind(value)) setKind(value);
                }}
                disabled={pending}
                className="grid gap-2"
              >
                {kindOptions.map((option) => (
                  <label
                    key={option.value}
                    className={cn(
                      "flex min-h-11 cursor-pointer items-center gap-3 rounded-md border px-3 text-sm",
                      option.value === kind && "border-brand-strong",
                    )}
                  >
                    <DesignRadio value={option.value} />
                    {option.label}
                  </label>
                ))}
              </DesignRadioGroup>
            </fieldset>

            <div className="space-y-2">
              <label htmlFor={quantityId} className="block text-sm font-medium">
                {kindOption?.quantityLabel}
              </label>
              <Input
                id={quantityId}
                inputMode="numeric"
                autoComplete="off"
                value={quantityText}
                onChange={(event) => setQuantityText(event.target.value)}
                disabled={pending}
              />
            </div>

            <p className="bg-muted/50 rounded-md border p-3 text-sm" aria-live="polite">
              Estoque: <strong>{formatUnits(variant.availableQuantity)}</strong>
              {nextQuantity === null ? null : (
                <>
                  {" "}
                  → <strong className={cn(nextQuantity < 0 && "text-destructive")}>{formatUnits(nextQuantity)}</strong>
                </>
              )}
            </p>

            <div className="space-y-2">
              <label htmlFor={noteId} className="block text-sm font-medium">
                Observação <span className="text-muted-foreground font-normal">(opcional)</span>
              </label>
              <Input
                id={noteId}
                value={note}
                maxLength={MANUAL_ADJUSTMENT_NOTE_MAX_LENGTH}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Ex.: nota fiscal 1234"
                disabled={pending}
              />
            </div>

            <FormMessage error={error} />

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Dialog.Close disabled={pending} render={<Button type="button" variant="outline" />}>
                Cancelar
              </Dialog.Close>
              <Button pending={pending} pendingLabel="Salvando…" type="button" onClick={save}>
                Salvar ajuste
              </Button>
            </div>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
      <FormMessage success={success} className="text-xs" />
    </div>
  );
}
