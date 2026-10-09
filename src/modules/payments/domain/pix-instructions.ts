type PixPayment = {
  method: string | null;
  status: string;
  providerMetadata: unknown;
};

export type PixInstructions = {
  copyAndPasteCode?: string;
  qrImageDataUrl?: string;
};

export function getPixInstructions(payment: PixPayment): PixInstructions | null {
  if (payment.method !== "pix" || !["PENDING", "PROCESSING"].includes(payment.status)) return null;

  const interaction = asRecord(asRecord(payment.providerMetadata)?.point_of_interaction);
  const transaction = asRecord(interaction?.transaction_data);
  if (!transaction) return null;

  const rawCode = transaction.qr_code;
  const copyAndPasteCode =
    typeof rawCode === "string" && rawCode.trim().length > 0 && rawCode.length <= 8_192 ? rawCode.trim() : undefined;

  const qrImageDataUrl = toQrImageDataUrl(transaction.qr_code_base64);

  return copyAndPasteCode || qrImageDataUrl
    ? {
        ...(copyAndPasteCode ? { copyAndPasteCode } : {}),
        ...(qrImageDataUrl ? { qrImageDataUrl } : {}),
      }
    : null;
}

function toQrImageDataUrl(rawImage: unknown): string | undefined {
  if (typeof rawImage !== "string" || rawImage.length === 0 || rawImage.length > 1_000_000) return undefined;
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(rawImage)) return undefined;
  if (rawImage.startsWith("iVBOR")) return `data:image/png;base64,${rawImage}`;
  if (rawImage.startsWith("/9j/")) return `data:image/jpeg;base64,${rawImage}`;
  return undefined;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}
