"use client";

import { HeartIcon } from "lucide-react";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";

import { toggleFavoriteAction } from "../actions/favorite-actions";

export function FavoriteButton({ productId, initialIsFavorite }: { productId: string; initialIsFavorite: boolean }) {
  const [isFavorite, setIsFavorite] = useState(initialIsFavorite);
  const [error, setError] = useState<string>();
  const [isPending, startTransition] = useTransition();

  function handleToggle() {
    setError(undefined);
    startTransition(async () => {
      const result = await toggleFavoriteAction(productId);
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
        <HeartIcon fill={isFavorite ? "currentColor" : "none"} />
        {isPending ? "Salvando…" : isFavorite ? "Favoritado" : "Favoritar"}
      </Button>
      {error ? <p className="text-destructive text-xs">{error}</p> : null}
    </div>
  );
}
