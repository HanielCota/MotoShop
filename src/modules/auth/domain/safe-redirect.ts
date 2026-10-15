const PLACEHOLDER_ORIGIN = "https://placeholder.local";
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;

/**
 * Normaliza o parâmetro `next` para um caminho interno seguro. Qualquer valor
 * que possa levar a outra origem (URLs absolutas, `//host`, `/\host`, caracteres
 * de controle que navegadores descartam) cai para "/".
 */
export function getSafeRedirectPath(next: string | null | undefined, fallback = "/"): string {
  if (!next || typeof next !== "string") return fallback;
  if (!next.startsWith("/")) return fallback;
  if (next.startsWith("//") || next.startsWith("/\\")) return fallback;
  if (CONTROL_CHARACTERS.test(next) || next.includes("\\")) return fallback;
  const decoded = tryDecodeUriComponent(next);
  if (decoded === null) return fallback;
  if (CONTROL_CHARACTERS.test(decoded) || decoded.includes("\\") || /^\/[\s/]/.test(decoded)) return fallback;

  const url = tryParseUrl(next, PLACEHOLDER_ORIGIN);
  if (!url) return fallback;
  if (url.origin !== PLACEHOLDER_ORIGIN) return fallback;
  // Segmentos "." e ".." são resolvidos pelo parser: "/..//evil.com" vira "//evil.com",
  // que o navegador trataria como URL de outra origem.
  if (url.pathname.startsWith("//")) return fallback;
  return `${url.pathname}${url.search}${url.hash}`;
}

function tryDecodeUriComponent(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

function tryParseUrl(value: string, base: string): URL | null {
  try {
    return new URL(value, base);
  } catch {
    return null;
  }
}
