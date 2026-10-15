"use client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

import Image from "next/image";
import { useId, useState } from "react";

import type { PixInstructions } from "../domain/pix-instructions";

export function PixPaymentInstructions({ copyAndPasteCode, qrImageDataUrl }: PixInstructions) {
  const codeInputId = useId();
  const [copyMessage, setCopyMessage] = useState<string>();

  async function copyCode() {
    if (!copyAndPasteCode) return;
    try {
      await navigator.clipboard.writeText(copyAndPasteCode);
      setCopyMessage("Código Pix copiado.");
    } catch {
      setCopyMessage("Selecione e copie o código acima.");
    }
  }

  return (
    <section className="bg-muted/40 mt-4 space-y-4 rounded-lg p-4" aria-label="Como pagar com Pix">
      <div>
        <h3 className="font-semibold">Pague com Pix</h3>
        <p className="text-muted-foreground mt-1 text-sm">
          Abra o aplicativo do seu banco e leia o QR Code ou use o Pix Copia e Cola.
        </p>
      </div>
      {qrImageDataUrl ? (
        <Image
          src={qrImageDataUrl}
          alt="QR Code para pagar este pedido com Pix"
          width={240}
          height={240}
          unoptimized
          className="size-60 max-w-full rounded-md border bg-white p-2"
        />
      ) : null}
      {copyAndPasteCode ? (
        <div className="space-y-2">
          <label htmlFor={codeInputId} className="block text-sm font-medium">
            Pix Copia e Cola
          </label>
          <Textarea
            id={codeInputId}
            readOnly
            value={copyAndPasteCode}
            onFocus={(event) => event.currentTarget.select()}
            className="border-input bg-background h-24 w-full resize-none rounded-md border p-3 text-xs break-all"
          />
          <Button type="button" onClick={copyCode}>
            Copiar código Pix
          </Button>
          {copyMessage ? (
            <p className="text-sm" role="status">
              {copyMessage}
            </p>
          ) : null}
        </div>
      ) : null}
      <p className="text-muted-foreground text-xs">O pedido será confirmado após a aprovação do pagamento.</p>
    </section>
  );
}
