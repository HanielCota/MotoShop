"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";

import { DesignSelect } from "@/components/ui/design-select";

/** Review filter or sort that applies as soon as an option is picked, keeping the page where it is. */
export function ReviewLinkSelect({
  label,
  value,
  options,
}: {
  label: string;
  value: string;
  options: { value: string; label: string; href: string }[];
}) {
  const router = useRouter();

  return (
    <label className="flex min-w-0 flex-col gap-1 text-sm font-medium">
      {label}
      <DesignSelect
        aria-label={label}
        value={value}
        onValueChange={(next) => {
          const option = options.find((item) => item.value === next);
          if (!option) return;

          router.push(option.href as Route, { scroll: false });
        }}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </DesignSelect>
    </label>
  );
}
