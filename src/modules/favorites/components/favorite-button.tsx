"use client";

import { HeartIcon } from "lucide-react";
import { useState, useTransition } from "react";

import { FormMessage } from "@/components/ui/form-message";
import { Button } from "@/components/ui/button";

import { toggleFavoriteAction } from "../actions/favorite-actions";
import { callServerAction } from "@/shared/forms/server-action-submit";

export function FavoriteButton({ productId, initialIsFavorite }: { productId: string; initialIsFavorite: boolean }) {
  const [isFavorite, setIsFavorite] = useState(initialIsFavorite);
  const [error, setError] = useState<string>();
  const [isPending, startTransition] = useTransition();

  function handleToggle() {
    setError(undefined);
    startTransition(async () => {
      const result = await callServerAction(() => toggleFavoriteAction(productId));
      if (result.error) {
        setError(result.error);
        return;
      }
      setIsFavorite(result.isFavorite ?? false);
    });
  }

  return (
    <div className="space-y-1">
      <Button
        type="button"
        variant={isFavorite ? "secondary" : "outline"}
        aria-pressed={isFavorite}
        disabled={isPending}
        onClick={handleToggle}
      >
        <HeartIcon
          aria-hidden="true"
          fill={isFavorite ? "currentColor" : "none"}
          className={isFavorite ? "text-brand-strong" : undefined}
        />
        {isPending ? "Salvando…" : isFavorite ? "Favoritado" : "Favoritar"}
      </Button>
      <FormMessage variant="inline" error={error ?? null} className="text-xs" />
    </div>
  );
}
