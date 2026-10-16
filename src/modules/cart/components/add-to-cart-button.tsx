"use client";

import { CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { cn } from "@/lib/utils";

import { addToCartAction } from "../actions/cart-actions";
import { notifyCartUpdated } from "./cart-events";

/**
 * Adiciona a variante ao carrinho sem sair da página: confirma com aviso inline
 * (`role="status"`) e atualiza o contador do carrinho.
 *
 * Com `stickyBar`, abaixo de `md` exibe uma barra fixa no rodapé (preço, opção e
 * "Adicionar") enquanto o botão principal está fora da tela. A barra reutiliza o
 * mesmo estado/ação do botão principal.
 */
export function AddToCartButton({
  variantId,
  disabled,
  quantity = 1,
  className,
  stickyBar,
}: {
  variantId: string;
  stickyBar?: { price: string; option?: string | undefined } | undefined;
  disabled?: boolean | undefined;
  quantity?: number | undefined;
  className?: string | undefined;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const [added, setAdded] = useState(false);
  const inlineRef = useRef<HTMLDivElement>(null);
  const [inlineVisible, setInlineVisible] = useState(true);
  const hasStickyBar = Boolean(stickyBar);

  useEffect(() => {
    const element = inlineRef.current;
    if (!hasStickyBar || !element || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => setInlineVisible(entry?.isIntersecting ?? true));
    observer.observe(element);
    return () => observer.disconnect();
  }, [hasStickyBar]);

  function handleAdd() {
    setError(undefined);
    setAdded(false);
    startTransition(async () => {
      try {
        const result = await addToCartAction(variantId, quantity);
        if (result.error) {
          setError(result.error);
          return;
        }
        setAdded(true);
        notifyCartUpdated();
        router.refresh();
      } catch {
        setError("Não foi possível adicionar ao carrinho. Tente novamente.");
      }
    });
  }

  return (
    <div className={cn("mt-3 space-y-2", className)}>
      <div ref={inlineRef}>
        <Button className="w-full" size="lg" disabled={disabled || isPending} onClick={handleAdd}>
          {isPending ? "Adicionando…" : disabled ? "Indisponível" : "Adicionar ao carrinho"}
        </Button>
      </div>
      {stickyBar && !inlineVisible ? (
        <div
          data-slot="sticky-add-to-cart"
          className="bg-background/95 z-sticky-bar shadow-sticky-bar fixed inset-x-0 bottom-0 border-t px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur md:hidden"
        >
          <div className="mx-auto flex max-w-6xl items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-foreground text-base leading-tight font-bold">{stickyBar.price}</p>
              {stickyBar.option ? <p className="text-muted-foreground truncate text-xs">{stickyBar.option}</p> : null}
            </div>
            <Button className="shrink-0" disabled={disabled || isPending} onClick={handleAdd}>
              {isPending ? "Adicionando…" : disabled ? "Indisponível" : "Adicionar"}
            </Button>
          </div>
        </div>
      ) : null}
      <div aria-live="polite">
        {added && !isPending ? (
          <p
            role="status"
            className="border-success/30 bg-success-surface text-success-foreground flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border p-3 text-sm"
          >
            <CheckCircle2 aria-hidden="true" className="size-4 shrink-0" />
            <span>Adicionado ao carrinho</span>
            <span aria-hidden="true">·</span>
            <Link href="/cart" className="font-semibold underline underline-offset-4">
              Ver carrinho
            </Link>
          </p>
        ) : null}
      </div>
      <FormMessage error={error ?? null} />
    </div>
  );
}
