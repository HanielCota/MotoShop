/** Áreas com layout próprio (Central do Lojista, Admin e APIs) não usam o cabeçalho/rodapé da loja. */
export function isStorefrontPath(pathname: string | null | undefined): pathname is string {
  if (!pathname) return false;
  return !/^\/(admin|api|seller)(\/|$)/.test(pathname);
}

/** Rótulo único para o acesso de lojistas em toda a navegação pública. */
export const sellerLinkLabel = "Venda no Moto Shop";
