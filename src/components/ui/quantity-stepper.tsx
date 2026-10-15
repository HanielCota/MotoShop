"use client";

import { Minus, Plus } from "lucide-react";
import { useId, useState, type KeyboardEvent } from "react";

import { cn } from "@/lib/utils";

type QuantityStepperProps = {
  /** Nome acessível do campo (ex.: "Quantidade de Capacete Apex"). */
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number | undefined;
  max?: number | undefined;
  disabled?: boolean | undefined;
  id?: string | undefined;
  className?: string | undefined;
  /** Mostra o rótulo visualmente; por padrão fica só para leitores de tela. */
  showLabel?: boolean | undefined;
};

const buttonClass =
  "text-foreground hover:bg-muted focus-visible:ring-ring/50 inline-flex size-11 shrink-0 items-center justify-center outline-none transition-colors focus-visible:ring-3 disabled:cursor-not-allowed disabled:opacity-40";

/**
 * Seletor de quantidade acessível: botões −/+ de 44px e campo numérico no meio.
 * Os botões confirmam na hora; o campo confirma com Enter ou ao sair dele.
 */
export function QuantityStepper({
  label,
  value,
  onChange,
  min = 1,
  max = 99,
  disabled,
  id,
  className,
  showLabel = false,
}: QuantityStepperProps) {
  const generatedId = useId();
  const lowerLabel = label.charAt(0).toLowerCase() + label.slice(1);
  const inputId = id ?? generatedId;
  const [draft, setDraft] = useState(String(value));
  const [syncedValue, setSyncedValue] = useState(value);
  if (syncedValue !== value) {
    setSyncedValue(value);
    setDraft(String(value));
  }

  function commit(next: number) {
    const clamped = Math.min(max, Math.max(min, next));
    setDraft(String(value));
    if (clamped !== value) onChange(clamped);
  }

  function commitDraft() {
    if (!/^\d+$/.test(draft.trim())) {
      setDraft(String(value));
      return;
    }
    commit(Number(draft));
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      commitDraft();
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      commit(value + 1);
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      commit(value - 1);
      return;
    }

    if (event.key === "Escape") setDraft(String(value));
  }

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <label htmlFor={inputId} className={showLabel ? "text-sm font-medium" : "sr-only"}>
        {label}
      </label>
      <div
        data-slot="quantity-stepper"
        className="border-input bg-background inline-flex w-fit items-center overflow-hidden rounded-md border"
      >
        <button
          type="button"
          className={buttonClass}
          aria-label={`Diminuir ${lowerLabel}`}
          aria-controls={inputId}
          disabled={disabled || value <= min}
          onClick={() => commit(value - 1)}
        >
          <Minus aria-hidden="true" className="size-4" />
        </button>
        <input
          id={inputId}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="off"
          maxLength={String(max).length}
          className="focus-visible:bg-muted/50 h-11 w-12 border-x bg-transparent text-center text-sm tabular-nums outline-none disabled:opacity-50"
          value={draft}
          disabled={disabled}
          onChange={(event) => setDraft(event.target.value.replace(/\D/g, ""))}
          onBlur={commitDraft}
          onKeyDown={handleKeyDown}
        />
        <button
          type="button"
          className={buttonClass}
          aria-label={`Aumentar ${lowerLabel}`}
          aria-controls={inputId}
          disabled={disabled || value >= max}
          onClick={() => commit(value + 1)}
        >
          <Plus aria-hidden="true" className="size-4" />
        </button>
      </div>
    </div>
  );
}
