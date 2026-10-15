"use client";

import { Radio } from "@base-ui/react/radio";
import { RadioGroup } from "@base-ui/react/radio-group";
import { Star } from "lucide-react";
import { useId } from "react";

import { cn } from "@/lib/utils";

const STARS = [1, 2, 3, 4, 5] as const;

/**
 * Whole-star rating from 1 to 5 (client decision: no fractions per review). A radio group, so arrow
 * keys change the value and screen readers announce "4 estrelas, 4 de 5".
 */
export function StarRatingInput({
  label,
  value,
  onValueChange,
  disabled,
}: {
  label: string;
  value: number;
  onValueChange: (value: number) => void;
  disabled?: boolean | undefined;
}) {
  const labelId = useId();

  return (
    <div className="text-foreground text-sm font-medium">
      <p id={labelId}>{label}</p>
      <RadioGroup
        aria-labelledby={labelId}
        value={String(value)}
        onValueChange={(next) => onValueChange(Number(next))}
        disabled={disabled}
        className="mt-1 flex gap-1"
      >
        {STARS.map((stars) => (
          <Radio.Root
            key={stars}
            value={String(stars)}
            aria-label={stars === 1 ? "1 estrela" : `${stars} estrelas`}
            className="focus-visible:ring-ring/50 inline-flex size-11 items-center justify-center rounded-md outline-none focus-visible:ring-3 disabled:opacity-50"
          >
            <Star
              aria-hidden="true"
              className={cn(
                "size-7 transition-colors",
                stars <= value ? "fill-warning text-warning" : "text-muted-foreground/50",
              )}
            />
          </Radio.Root>
        ))}
      </RadioGroup>
      <p className="text-muted-foreground mt-1 text-xs font-normal" aria-hidden="true">
        {value} de 5 estrelas
      </p>
    </div>
  );
}
