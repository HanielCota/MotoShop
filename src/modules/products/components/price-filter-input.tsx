"use client";
import { useState } from "react";
import { formatPriceInputFromCents, parsePriceInputToCents } from "../domain/price-input";
export function PriceFilterInput({ name, cents }: { name: string; cents: number | null }) {
  const [value, setValue] = useState(cents === null ? "" : formatPriceInputFromCents(cents));
  const parsed = parsePriceInputToCents(value);
  return (
    <>
      <input
        className="border-input bg-background h-11 min-w-0 rounded-md border px-3 text-sm"
        inputMode="decimal"
        pattern="[0-9]+([,.][0-9]{1,2})?"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Ex.: 50,00"
      />
      <input type="hidden" name={name} value={Number.isFinite(parsed) ? parsed : ""} />
    </>
  );
}
