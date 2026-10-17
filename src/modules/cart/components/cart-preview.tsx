"use client";

import * as Sentry from "@sentry/nextjs";
import { Popover } from "@base-ui/react/popover";
import { ShoppingBag, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { QuantityStepper } from "@/components/ui/quantity-stepper";
import { popoverSurfaceClassName } from "@/components/ui/popover-surface";
import { formatMoneyInCents } from "@/lib/format";
import { cn } from "@/lib/utils";

import { clearCartAction, getCartPreviewAction, updateCartItemAction } from "../actions/cart-actions";
import { CART_UPDATED_EVENT } from "./cart-events";

type CartPreviewData = Awaited<ReturnType<typeof getCartPreviewAction>>;

/** The count in the badge is part of the accessible name (IC-11): "Carrinho, 3 itens". */
export function cartTriggerLabel(itemCount: number): string {
  if (itemCount <= 0) return "Carrinho, vazio";
  return `Carrinho, ${itemCount} ${itemCount === 1 ? "item" : "itens"}`;
}

export function CartPreview() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<CartPreviewData>();
  const [message, setMessage] = useState<string>();
  const [pending, setPending] = useState(false);
  const [isError, setIsError] = useState(false);
  // Reading the cart failed: there is nothing to show, so the popover offers a retry instead of "Carregando".
  const [loadFailed, setLoadFailed] = useState(false);

  async function refresh() {
    setPending(true);
    try {
      const result = await getCartPreviewAction();
      setData(result);
      setLoadFailed(false);
      setMessage(result.error);
      setIsError(Boolean(result.error));
    } catch (error) {
      Sentry.captureException(error);
      setLoadFailed(true);
    } finally {
      setPending(false);
    }
  }

  // Mantém o contador atualizado quando um produto é adicionado em outra parte da página.
  useEffect(() => {
    const handleCartUpdated = () => void refresh();
    window.addEventListener(CART_UPDATED_EVENT, handleCartUpdated);
    return () => window.removeEventListener(CART_UPDATED_EVENT, handleCartUpdated);
  }, []);

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (nextOpen) refresh();
  }

  async function updateItem(cartItemId: string, quantity: number) {
    setMessage(undefined);
    setIsError(false);
    setPending(true);
    try {
      const result = await updateCartItemAction(cartItemId, quantity);
      if (result.error) {
        setMessage(result.error);
        setIsError(true);
        return;
      }
      const updated = await getCartPreviewAction();
      setData(updated);
    } catch (error) {
      Sentry.captureException(error);
      setMessage("Não foi possível atualizar o carrinho. Tente novamente.");
      setIsError(true);
    } finally {
      setPending(false);
    }
  }

  /** Runs from the confirmation dialog: returning an error keeps the dialog open with the message. */
  async function clearCart(): Promise<{ error?: string }> {
    setMessage(undefined);
    setIsError(false);
    try {
      const result = await clearCartAction();
      if (result.error) return { error: result.error };

      setData({ items: [], itemCount: 0, subtotalInCents: 0 });
      setMessage(result.success);
      return {};
    } catch (error) {
      Sentry.captureException(error);
      return { error: "Não foi possível limpar o carrinho. Tente novamente." };
    }
  }

  return (
    <Popover.Root open={open} onOpenChange={handleOpenChange}>
      <Popover.Trigger
        openOnHover
        delay={250}
        closeDelay={180}
        aria-label={cartTriggerLabel(data?.itemCount ?? 0)}
        className="relative inline-flex size-11 items-center justify-center rounded-md text-white/85 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
      >
        <ShoppingBag aria-hidden="true" className="size-5" />
        {data && data.itemCount > 0 ? (
          <span
            aria-hidden="true"
            className="bg-moto-brand text-moto-brand-foreground absolute top-0.5 right-0.5 min-w-5 rounded-full px-1 text-center text-xs leading-5 font-bold"
          >
            {data.itemCount > 99 ? "99+" : data.itemCount}
          </span>
        ) : null}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner side="bottom" align="end" sideOffset={8} className="z-popover">
          <Popover.Popup className={cn(popoverSurfaceClassName, "w-[min(92vw,24rem)] p-4 outline-none")}>
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <Popover.Title className="font-semibold">Seu carrinho</Popover.Title>
                <Popover.Description className="text-muted-foreground text-xs">
                  {data ? `${data.itemCount} ${data.itemCount === 1 ? "item" : "itens"}` : "Resumo rápido da compra"}
                </Popover.Description>
              </div>
              {data && data.items.length > 0 ? (
                <ConfirmDialog
                  trigger={
                    <Button type="button" variant="link" size="sm" disabled={pending}>
                      Limpar carrinho
                    </Button>
                  }
                  title="Limpar carrinho?"
                  description={`${data.itemCount === 1 ? "O item sai" : `Os ${data.itemCount} itens saem`} do carrinho. Você pode adicionar os produtos de novo depois.`}
                  confirmLabel="Limpar carrinho"
                  pendingLabel="Limpando..."
                  tone="destructive"
                  onConfirm={clearCart}
                />
              ) : null}
            </div>

            {loadFailed && !pending ? <CartLoadError onRetry={() => void refresh()} /> : null}
            {(!data && !loadFailed) || pending ? (
              <p className="text-muted-foreground py-6 text-center text-sm">Carregando carrinho…</p>
            ) : null}
            {data && !pending && data.items.length === 0 ? (
              <div className="py-6 text-center">
                <ShoppingBag aria-hidden="true" className="text-muted-foreground mx-auto mb-2 size-7" />
                <p className="text-sm font-medium">Seu carrinho está vazio</p>
                <Link
                  href="/products"
                  className="text-brand-strong mt-2 inline-flex min-h-10 items-center text-sm font-medium underline underline-offset-4"
                >
                  Explorar produtos
                </Link>
              </div>
            ) : null}
            {data && data.items.length > 0 ? (
              <>
                <ul className="max-h-72 divide-y overflow-y-auto" aria-label="Itens no carrinho">
                  {data.items.slice(0, 5).map((item) => (
                    <li key={item.id} className="flex items-start justify-between gap-3 py-3">
                      <div className="min-w-0">
                        <p className="line-clamp-2 text-sm font-medium">{item.name}</p>
                        <p className="text-muted-foreground mt-0.5 text-xs">{item.variant}</p>
                        <QuantityStepper
                          label={`Quantidade de ${item.name}`}
                          value={item.quantity}
                          min={1}
                          max={Math.max(item.quantity, Math.min(99, item.availableQuantity))}
                          disabled={pending}
                          onChange={(quantity) => updateItem(item.id, quantity)}
                          className="mt-1"
                        />
                        <p className="mt-1 text-xs">{formatMoneyInCents(item.unitPriceInCents * item.quantity)}</p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-destructive shrink-0"
                        disabled={pending}
                        aria-label={`Remover ${item.name} do carrinho`}
                        onClick={() => updateItem(item.id, 0)}
                      >
                        <Trash2 aria-hidden="true" />
                      </Button>
                    </li>
                  ))}
                </ul>
                {data.items.length > 5 ? (
                  <p className="text-muted-foreground py-2 text-xs">e mais {data.items.length - 5} itens</p>
                ) : null}
                <div className="flex items-center justify-between border-t pt-3 text-sm">
                  <span>Subtotal</span>
                  <strong>{formatMoneyInCents(data.subtotalInCents)}</strong>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <Link
                    href="/cart"
                    className={cn(buttonVariants({ variant: "outline", className: "w-full font-semibold" }))}
                  >
                    Ver carrinho
                  </Link>
                  <Link href="/checkout" className={cn(buttonVariants({ className: "w-full font-semibold" }))}>
                    Finalizar compra
                  </Link>
                </div>
              </>
            ) : null}
            {message ? (
              <p
                role={isError ? "alert" : "status"}
                className={isError ? "text-destructive mt-2 text-xs" : "text-muted-foreground mt-2 text-xs"}
              >
                {message}
              </p>
            ) : null}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

function CartLoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <div role="alert" className="py-5 text-center">
      <p className="text-sm font-medium">Não foi possível carregar o carrinho.</p>
      <p className="text-muted-foreground mt-1 text-xs">Confira a conexão e tente de novo.</p>
      <div className="mt-3 flex flex-wrap justify-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onRetry}>
          Tentar de novo
        </Button>
        <Link href="/cart" className={cn(buttonVariants({ variant: "link", size: "sm" }))}>
          Ir para o carrinho
        </Link>
      </div>
    </div>
  );
}
