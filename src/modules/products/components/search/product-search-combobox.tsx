"use client";

import Image from "next/image";
import Link from "next/link";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useId, useState, type KeyboardEvent } from "react";

import type { FieldSize } from "@/components/ui/field-size";
import { popoverSurfaceClassName } from "@/components/ui/popover-surface";
import { Input } from "@/components/ui/input";
import { formatMoneyInCents } from "@/lib/format";
import { cn } from "@/lib/utils";

import type { SearchSuggestion } from "../../schemas/search-suggestions";
import { useSearchSuggestions } from "./use-search-suggestions";

type ProductSearchComboboxProps = {
  id: string;
  name?: string;
  placeholder: string;
  /** Classes for the text field; "plain" renders a bare input styled only by these classes. */
  inputClassName?: string;
  variant?: "field" | "plain";
  /** Height of the "field" variant, matching the `Button` size next to it. */
  size?: FieldSize;
  className?: string;
  defaultValue?: string;
  /** Controlled value, for fields whose text is also used elsewhere (e.g. a clear button). */
  value?: string;
  onValueChange?: (value: string) => void;
  /** Limits suggestions to one store. */
  sellerId?: string;
  /** Extra classes for the suggestion list, e.g. a width wider than a narrow field. */
  listClassName?: string;
};

/**
 * Search field with up to five product suggestions (ARIA combobox). It lives inside the existing
 * search form: Enter without a highlighted suggestion submits the full search as before.
 */
export function ProductSearchCombobox({
  id,
  name = "q",
  placeholder,
  inputClassName,
  variant = "field",
  size = "default",
  className,
  defaultValue = "",
  value,
  onValueChange,
  sellerId,
  listClassName,
}: ProductSearchComboboxProps) {
  const router = useRouter();
  const listId = useId();
  const [internalValue, setInternalValue] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const query = value ?? internalValue;
  const suggestions = useSearchSuggestions(query, sellerId);
  const expanded = open && suggestions.length > 0;
  const activeSuggestion = expanded ? suggestions[activeIndex] : undefined;
  const optionId = (index: number) => `${listId}-option-${index}`;

  function changeQuery(nextValue: string) {
    setInternalValue(nextValue);
    onValueChange?.(nextValue);
    setOpen(true);
    setActiveIndex(-1);
  }

  // Opening a product leaves the search behind; the header keeps its field across pages, so clear it.
  function leaveForSuggestion() {
    setInternalValue("");
    onValueChange?.("");
    setOpen(false);
    setActiveIndex(-1);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape" && expanded) {
      event.preventDefault();
      setOpen(false);
      return;
    }
    if (event.key === "Enter" && activeSuggestion) {
      event.preventDefault();
      leaveForSuggestion();
      router.push(activeSuggestion.href as Route);
      return;
    }

    const step = event.key === "ArrowDown" ? 1 : event.key === "ArrowUp" ? -1 : 0;
    if (step === 0 || suggestions.length === 0) return;

    event.preventDefault();
    setOpen(true);
    setActiveIndex((current) => moveActiveIndex(current, step, suggestions.length));
  }

  const inputProps = {
    id,
    name,
    type: "search",
    role: "combobox",
    autoComplete: "off",
    placeholder,
    value: query,
    "aria-autocomplete": "list",
    "aria-expanded": expanded,
    "aria-controls": listId,
    "aria-activedescendant": activeSuggestion ? optionId(activeIndex) : undefined,
    onChange: (event: { target: { value: string } }) => changeQuery(event.target.value),
    onFocus: () => setOpen(true),
    onBlur: () => setOpen(false),
    onKeyDown: handleKeyDown,
  } as const;

  return (
    <div className={cn("relative min-w-0", className)}>
      {variant === "plain" ? (
        <input {...inputProps} className={inputClassName} />
      ) : (
        <Input {...inputProps} size={size} className={inputClassName} />
      )}
      <SuggestionList
        id={listId}
        hidden={!expanded}
        suggestions={suggestions}
        activeIndex={activeIndex}
        optionId={optionId}
        query={query.trim()}
        className={listClassName}
        onNavigate={leaveForSuggestion}
      />
    </div>
  );
}

function moveActiveIndex(current: number, step: number, count: number) {
  const next = current + step;
  if (next < -1) return count - 1;
  if (next >= count) return -1;
  return next;
}

function SuggestionList({
  id,
  hidden,
  suggestions,
  activeIndex,
  optionId,
  query,
  className,
  onNavigate,
}: {
  id: string;
  hidden: boolean;
  className?: string | undefined;
  suggestions: SearchSuggestion[];
  activeIndex: number;
  optionId: (index: number) => string;
  query: string;
  onNavigate: () => void;
}) {
  return (
    // Mouse down keeps focus in the field, so the list stays open until the click lands.
    <div
      hidden={hidden}
      onMouseDown={(event) => event.preventDefault()}
      className={cn(
        popoverSurfaceClassName,
        "z-popover absolute top-full right-0 mt-2 w-full min-w-full overflow-hidden",
        className,
      )}
    >
      <ul id={id} role="listbox" aria-label="Sugestões de produtos" className="divide-border divide-y">
        {suggestions.map((suggestion, index) => (
          <SuggestionOption
            key={suggestion.id}
            id={optionId(index)}
            suggestion={suggestion}
            active={index === activeIndex}
            onNavigate={onNavigate}
          />
        ))}
      </ul>
      <button
        type="submit"
        className="border-border text-brand-strong hover:bg-muted flex min-h-11 w-full items-center border-t px-3 text-left text-sm font-semibold"
      >
        Ver todos os resultados para “{query}”
      </button>
    </div>
  );
}

function SuggestionOption({
  id,
  suggestion,
  active,
  onNavigate,
}: {
  id: string;
  suggestion: SearchSuggestion;
  active: boolean;
  onNavigate: () => void;
}) {
  return (
    <li id={id} role="option" aria-selected={active} className={cn(active && "bg-moto-brand-surface")}>
      <Link
        href={suggestion.href as Route}
        tabIndex={-1}
        onClick={onNavigate}
        className="hover:bg-muted flex items-center gap-3 px-3 py-2"
      >
        <span className="bg-surface-sunken relative size-12 shrink-0 overflow-hidden rounded-md">
          {suggestion.imageUrl ? (
            <Image src={suggestion.imageUrl} alt="" fill sizes="48px" unoptimized className="object-cover" />
          ) : null}
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="line-clamp-2 text-sm font-medium">{suggestion.name}</span>
          <span className="text-sm font-semibold tabular-nums">
            {suggestion.priceInCents !== null ? formatMoneyInCents(suggestion.priceInCents) : "Sob consulta"}
            {suggestion.isDemo ? <span className="text-muted-foreground font-normal"> · demonstração</span> : null}
          </span>
        </span>
      </Link>
    </li>
  );
}
