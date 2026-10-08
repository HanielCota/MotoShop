"use client";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { formatPriceInputFromCents, parsePriceInputToCents } from "../domain/price-input";
export function PriceFilterInput({ name, cents }: { name: string; cents: number | null }) {
  const [value, setValue] = useState(cents === null ? "" : formatPriceInputFromCents(cents));
  const parsed = parsePriceInputToCents(value);
  return (
    <>
      <Input
        className="sm:h-11"
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
