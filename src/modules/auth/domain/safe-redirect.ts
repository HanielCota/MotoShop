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
  let decoded: string;
  try {
    decoded = decodeURIComponent(next);
  } catch {
    return fallback;
  }
  if (CONTROL_CHARACTERS.test(decoded) || decoded.includes("\\") || /^\/[\s/]/.test(decoded)) return fallback;

  let url: URL;
  try {
    url = new URL(next, PLACEHOLDER_ORIGIN);
  } catch {
    return fallback;
  }
  if (url.origin !== PLACEHOLDER_ORIGIN) return fallback;
  return `${url.pathname}${url.search}${url.hash}`;
}
