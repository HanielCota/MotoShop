/**
 * Tone shown next to a color name in the public filter. The color is free text typed by
 * the store, so the swatch is only a visual hint: it reads the first word of each part ("Preto fosco"
 * → preto, "Azul/amarelo" or "Azul e amarelo" → azul and amarelo), ignoring accents, case and the feminine form.
 */
const toneByColorWord: Readonly<Record<string, string>> = {
  preto: "#111111",
  preta: "#111111",
  branco: "#ffffff",
  branca: "#ffffff",
  cinza: "#8a8d91",
  grafite: "#3c3f44",
  prata: "#c0c4c8",
  vermelho: "#d32f2f",
  vermelha: "#d32f2f",
  vinho: "#7b1e2b",
  rosa: "#e8559a",
  laranja: "#ff6a00",
  amarelo: "#f5c400",
  amarela: "#f5c400",
  dourado: "#c9a227",
  dourada: "#c9a227",
  verde: "#2e7d32",
  azul: "#1f5bd8",
  roxo: "#7b3fa2",
  roxa: "#7b3fa2",
  marrom: "#6d4c41",
  bege: "#d9c3a0",
};

// "Azul/amarelo" gets two halves; a name with more parts gets no swatch.
const maximumColorParts = 2;

function normalizeWord(text: string): string | undefined {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim()
    .split(/\s+/)[0];
}

function toneOf(part: string): string | null {
  const word = normalizeWord(part);
  if (word == null || word.length === 0) return null;

  return toneByColorWord[word] ?? null;
}

/** CSS background for the swatch, or null when any part of the name has no known tone. */
export function colorSwatchBackground(colorName: string): string | null {
  // "Azul/amarelo" and "Preto e vermelho" both name two colors.
  const tones = colorName.split(/\s*\/\s*|\s+e\s+/i).map(toneOf);
  if (tones.length === 0 || tones.length > maximumColorParts) return null;
  if (tones.some((tone) => tone === null)) return null;

  const [first, second] = tones;
  if (first == null) return null;

  if (second == null) return first;

  return `linear-gradient(135deg, ${first} 50%, ${second} 50%)`;
}
