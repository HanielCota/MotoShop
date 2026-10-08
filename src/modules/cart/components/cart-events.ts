/** Evento de janela disparado quando o carrinho muda no cliente (ex.: produto adicionado). */
export const CART_UPDATED_EVENT = "motoshop:cart-updated";

export function notifyCartUpdated() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(CART_UPDATED_EVENT));
}
