"use client";

import * as Sentry from "@sentry/nextjs";
import { Popover } from "@base-ui/react/popover";
import { ShoppingBag } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { formatMoneyInCents } from "@/lib/format";

import { clearCartAction, getCartPreviewAction, updateCartItemAction } from "../actions/cart-actions";
import { CART_UPDATED_EVENT } from "./cart-events";

type CartPreviewData = Awaited<ReturnType<typeof getCartPreviewAction>>;

export function CartPreview() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<CartPreviewData>();
  const [message, setMessage] = useState<string>();
  const [pending, setPending] = useState(false);
  const [isError, setIsError] = useState(false);
  const [confirmingClear, setConfirmingClear] = useState(false);

  async function refresh() {
    setPending(true);
    try {
      const result = await getCartPreviewAction();
      setData(result);
      setMessage(result.error);
      setIsError(Boolean(result.error));
    } catch (error) {
      Sentry.captureException(error);
      setMessage("Não foi possível carregar o carrinho.");
      setIsError(true);
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
    setConfirmingClear(false);
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

  async function clearCart() {
    setMessage(undefined);
    setIsError(false);
    setPending(true);
    try {
      const result = await clearCartAction();
      if (result.error) {
        setMessage(result.error);
        setIsError(true);
        return;
      }
      setData({ items: [], itemCount: 0, subtotalInCents: 0 });
      setConfirmingClear(false);
      setMessage(result.success);
      setIsError(false);
    } catch (error) {
      Sentry.captureException(error);
      setMessage("Não foi possível limpar o carrinho. Tente novamente.");
      setIsError(true);
    } finally {
      setPending(false);
    }
  }

  return (
    <Popover.Root open={open} onOpenChange={handleOpenChange}>
      <Popover.Trigger
        openOnHover
        delay={250}
        closeDelay={180}
        aria-label="Visualizar carrinho"
        className="relative inline-flex size-11 items-center justify-center rounded-md text-white/85 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
      >
        <ShoppingBag aria-hidden="true" className="size-5" />
        {data && data.itemCount > 0 ? (
          <span className="bg-moto-brand text-moto-brand-foreground absolute top-0.5 right-0.5 min-w-5 rounded-full px-1 text-center text-xs leading-5 font-bold">
            {data.itemCount > 99 ? "99+" : data.itemCount}
          </span>
        ) : null}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner side="bottom" align="end" sideOffset={8} className="z-[60]">
          <Popover.Popup className="border-border bg-background text-foreground w-[min(92vw,24rem)] rounded-xl border p-4 shadow-xl outline-none">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <Popover.Title className="font-semibold">Seu carrinho</Popover.Title>
                <Popover.Description className="text-muted-foreground text-xs">
                  {data ? `${data.itemCount} ${data.itemCount === 1 ? "item" : "itens"}` : "Resumo rápido da compra"}
                </Popover.Description>
              </div>
              {data && data.items.length > 0 ? (
                // Mantido montado durante a confirmação: desmontar o alvo do clique fecharia o popover.
                <button
                  type="button"
                  aria-expanded={confirmingClear}
                  aria-controls="cart-clear-confirm"
                  onClick={() => setConfirmingClear(true)}
                  disabled={pending || confirmingClear}
                  className="text-muted-foreground hover:text-foreground min-h-9 rounded-md px-2 text-xs font-medium underline underline-offset-4 disabled:opacity-50"
                >
                  Limpar carrinho
                </button>
              ) : null}
            </div>

            {data && data.items.length > 0 ? (
              // Oculto (não desmontado) ao cancelar: desmontar o alvo do clique fecharia o popover.
              <div
                hidden={!confirmingClear}
                id="cart-clear-confirm"
                role="alertdialog"
                aria-labelledby="cart-clear-title"
                className="border-destructive/30 bg-destructive/5 mb-3 rounded-lg border p-3"
              >
                <p id="cart-clear-title" className="text-sm font-medium">
                  Remover todos os {data.itemCount} {data.itemCount === 1 ? "item" : "itens"} do carrinho?
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={clearCart}
                    disabled={pending}
                    className="bg-destructive hover:bg-destructive/90 inline-flex min-h-11 items-center justify-center rounded-md px-4 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    Sim, limpar
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmingClear(false)}
                    className="border-border hover:bg-muted inline-flex min-h-11 items-center justify-center rounded-md border px-4 text-sm font-semibold"
                  >
                    Manter itens
                  </button>
                </div>
              </div>
            ) : null}

            {!data || pending ? (
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
                        <div className="mt-1 flex items-center gap-2" aria-label={`Quantidade de ${item.name}`}>
                          <button
                            type="button"
                            aria-label={`Diminuir quantidade de ${item.name}`}
                            disabled={pending || item.quantity <= 1}
                            onClick={() => updateItem(item.id, item.quantity - 1)}
                            className="border-border hover:bg-muted inline-flex size-9 items-center justify-center rounded-md border text-base disabled:opacity-40"
                          >
                            −
                          </button>
                          <span className="min-w-5 text-center text-xs tabular-nums" aria-live="polite">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            aria-label={`Aumentar quantidade de ${item.name}`}
                            disabled={pending || item.quantity >= Math.min(99, item.availableQuantity)}
                            onClick={() => updateItem(item.id, item.quantity + 1)}
                            className="border-border hover:bg-muted inline-flex size-9 items-center justify-center rounded-md border text-base disabled:opacity-40"
                          >
                            +
                          </button>
                        </div>
                        <p className="mt-1 text-xs">{formatMoneyInCents(item.unitPriceInCents * item.quantity)}</p>
                      </div>
                      <button
                        type="button"
                        disabled={pending}
                        aria-label={`Remover ${item.name} do carrinho`}
                        onClick={() => updateItem(item.id, 0)}
                        className="text-muted-foreground hover:text-foreground min-h-9 shrink-0 rounded-md px-2 text-xs font-medium underline underline-offset-4 disabled:opacity-50"
                      >
                        Remover
                      </button>
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
                    className="border-border hover:bg-muted flex min-h-11 items-center justify-center rounded-md border px-4 text-sm font-semibold transition-colors"
                  >
                    Ver carrinho
                  </Link>
                  <Link
                    href="/checkout"
                    className="bg-moto-brand hover:bg-moto-brand/90 text-moto-brand-foreground flex min-h-11 items-center justify-center rounded-md px-4 text-sm font-semibold transition-colors"
                  >
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
